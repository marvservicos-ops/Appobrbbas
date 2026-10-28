import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/service'
import { baixarArquivoDrive } from '@/lib/diarioObra'
import { buscarMessageIdReal } from '@/lib/emailThread'
import { exigirUsuarioAtivo, escaparHtml, limparHtmlBasico } from '@/lib/apiAuth'
import { remetenteDaSessao } from '@/lib/remetente'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'joaovictor@marvservicos.com.br'
const MAX_POR_ENVIO = 10
// Uma conversa de e-mail por tipo de relatório do contrato: o Chiller de
// novembro responde o de outubro, o monitoramento responde o monitoramento etc.
const chaveThread = (tipoId: string) => `rel:${tipoId}`

export const maxDuration = 30

// Envia ao cliente relatórios de UM tipo do contrato (PDFs importados do Diário de Obra para o Drive)
export async function POST(req: NextRequest) {
  const auth = await exigirUsuarioAtivo()
  if (!auth.ok) return auth.resposta
  const { user } = auth

  const { contratoId, tipoId, relatorioIds, destinatarios, cc, assunto, mensagem, assinaturaHtml } = await req.json()

  if (!contratoId || !tipoId || !Array.isArray(relatorioIds) || relatorioIds.length === 0 || !Array.isArray(destinatarios) || destinatarios.length === 0 || !assunto) {
    return NextResponse.json({ error: 'Campos obrigatórios: contratoId, tipoId, relatorioIds, destinatarios, assunto' }, { status: 400 })
  }
  if (relatorioIds.length > MAX_POR_ENVIO) {
    return NextResponse.json({ error: `Envie no máximo ${MAX_POR_ENVIO} relatórios por vez.` }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Só relatórios da obra do Diário vinculada a este tipo, deste contrato
  const { data: tipo } = await supabase.from('contrato_relatorio_tipos').select('id, nome, diario_obra_id')
    .eq('id', tipoId).eq('contrato_id', contratoId).maybeSingle()
  if (!tipo) {
    return NextResponse.json({ error: 'Tipo de relatório não encontrado neste contrato.' }, { status: 404 })
  }

  const { data: relatorios, error: relErr } = await supabase
    .from('diario_obra_relatorios')
    .select('id, numero, data, drive_file_id')
    .in('id', relatorioIds)
    .eq('diario_obra_id_externo', tipo.diario_obra_id)
  if (relErr) console.error('[manutencao/relatorios/enviar] erro ao ler relatórios', relErr)

  if (!relatorios || relatorios.length === 0) {
    return NextResponse.json({ error: 'Relatório(s) não encontrado(s).' }, { status: 404 })
  }
  if (relatorios.length !== new Set(relatorioIds).size) {
    return NextResponse.json({ error: 'Algum relatório selecionado não pertence a este tipo de relatório.' }, { status: 400 })
  }
  const semArquivo = relatorios.filter(r => !r.drive_file_id)
  if (semArquivo.length > 0) {
    return NextResponse.json({ error: `Relatório(s) sem PDF no Drive: ${semArquivo.map(r => `#${r.numero}`).join(', ')}` }, { status: 400 })
  }

  let attachments
  try {
    attachments = await Promise.all(relatorios.map(async r => {
      const buffer = await baixarArquivoDrive(r.drive_file_id as string)
      const nome = String(tipo.nome || 'Relatorio')
        .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-')
      const data = r.data ? String(r.data) : String(r.numero ?? r.id.slice(0, 8))
      return { filename: `${nome}_${data}.pdf`, content: buffer.toString('base64') }
    }))
  } catch (err) {
    console.error('[manutencao/relatorios/enviar] falha ao baixar PDF do Drive', err)
    return NextResponse.json({ error: 'Não foi possível baixar o PDF do Google Drive. Tente de novo.' }, { status: 500 })
  }

  const { data: thread } = await supabase
    .from('relatorio_email_threads')
    .select('ultimo_message_id')
    .eq('contrato_id', contratoId)
    .eq('tipo', chaveThread(tipo.id))
    .maybeSingle()

  const headers: Record<string, string> = {}
  if (thread?.ultimo_message_id) {
    headers['In-Reply-To'] = thread.ultimo_message_id
    headers['References'] = thread.ultimo_message_id
  }

  const remetente = remetenteDaSessao(user, auth.profile, FROM)
  const corpo = String(mensagem ?? '').split('\n').map((l: string) => escaparHtml(l) || '&nbsp;').join('<br>')
  const assinatura = remetente.assinaturaHtml ?? (assinaturaHtml ? limparHtmlBasico(String(assinaturaHtml)) : '')
  const html = assinatura ? `${corpo}<br><br>${assinatura}` : corpo
  const ccLimpo = Array.isArray(cc) ? cc.filter(Boolean) : []
  const copiaPara = remetente.copiaPara
  const jaRecebe = [...destinatarios, ...ccLimpo].map((e: string) => e.trim().toLowerCase())
  const bcc = copiaPara && !jaRecebe.includes(copiaPara.toLowerCase()) ? [copiaPara] : undefined

  const { data, error } = await resend.emails.send({
    from: remetente.from,
    to: destinatarios,
    ...(ccLimpo.length > 0 ? { cc: ccLimpo } : {}),
    ...(bcc ? { bcc } : {}),
    subject: assunto,
    html,
    attachments,
    headers,
  })

  if (error) {
    console.error('[manutencao/relatorios/enviar] falha no Resend', error)
    return NextResponse.json({ error: 'Não foi possível enviar o e-mail. Confira os endereços e tente de novo.' }, { status: 500 })
  }

  let messageId: string | null = thread?.ultimo_message_id ?? null
  if (data?.id) {
    const resultado = await buscarMessageIdReal(data.id)
    if (resultado.messageId) messageId = resultado.messageId
  }
  // Daqui pra baixo o e-mail JÁ saiu: falhas viram aviso, não erro (reenviar duplicaria o e-mail).
  const avisos: string[] = []
  const { error: threadErr } = await supabase.from('relatorio_email_threads').upsert({
    contrato_id: contratoId,
    obra_id: null,
    tipo: chaveThread(tipo.id),
    ultimo_message_id: messageId,
    ultimo_destinatarios: destinatarios,
    ultimo_cc: ccLimpo,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'contrato_id,tipo' })
  if (threadErr) {
    console.error('[manutencao/relatorios/enviar] erro ao salvar conversa', threadErr)
    avisos.push('O e-mail foi enviado, mas a conversa não foi salva (o próximo envio vai abrir um e-mail novo).')
  }

  const { error: marcarErr } = await supabase.from('diario_obra_relatorios').update({
    email_enviado_em: new Date().toISOString(),
    email_enviado_para: [...destinatarios, ...ccLimpo],
    email_enviado_por: remetente.nome || remetente.email,
  }).in('id', relatorios.map(r => r.id))
  if (marcarErr) {
    console.error('[manutencao/relatorios/enviar] erro ao marcar como enviados', marcarErr)
    avisos.push('O e-mail foi enviado, mas os relatórios não foram marcados como enviados.')
  }

  return NextResponse.json({ ok: true, id: data?.id, copiaPara: bcc?.[0] ?? null, avisos: avisos.length ? avisos : undefined })
}
