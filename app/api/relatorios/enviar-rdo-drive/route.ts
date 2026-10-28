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

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const auth = await exigirUsuarioAtivo()
  if (!auth.ok) return auth.resposta
  const { user } = auth

  // remetenteNome/remetenteEmail do corpo são ignorados: o remetente vem da sessão.
  const { obraId, relatorioIds, destinatarios, cc, assunto, mensagem, assinaturaHtml } = await req.json()

  if (!obraId || !Array.isArray(relatorioIds) || relatorioIds.length === 0 || !Array.isArray(destinatarios) || destinatarios.length === 0 || !assunto) {
    return NextResponse.json({ error: 'Campos obrigatórios: obraId, relatorioIds, destinatarios, assunto' }, { status: 400 })
  }
  if (relatorioIds.length > MAX_POR_ENVIO) {
    return NextResponse.json({ error: `Envie no máximo ${MAX_POR_ENVIO} relatórios por vez.` }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: relatorios, error: relErr } = await supabase
    .from('diario_obra_relatorios')
    .select('id, numero, data, drive_file_id')
    .in('id', relatorioIds)
    .eq('obra_id', obraId)
  if (relErr) console.error('[enviar-rdo-drive] erro ao ler relatórios', relErr)

  if (!relatorios || relatorios.length === 0) {
    return NextResponse.json({ error: 'Relatório(s) não encontrado(s).' }, { status: 404 })
  }
  if (relatorios.length !== new Set(relatorioIds).size) {
    return NextResponse.json({ error: 'Algum relatório selecionado não pertence a esta obra.' }, { status: 400 })
  }
  const semArquivo = relatorios.filter(r => !r.drive_file_id)
  if (semArquivo.length > 0) {
    return NextResponse.json({ error: `Relatório(s) sem PDF no Drive: ${semArquivo.map(r => `#${r.numero}`).join(', ')}` }, { status: 400 })
  }

  let attachments
  try {
    attachments = await Promise.all(relatorios.map(async r => {
      const buffer = await baixarArquivoDrive(r.drive_file_id as string)
      const numero = r.numero ? String(r.numero).padStart(3, '0') : r.id.slice(0, 8)
      return { filename: `RDO-${numero}.pdf`, content: buffer.toString('base64') }
    }))
  } catch (err) {
    console.error('[enviar-rdo-drive] falha ao baixar PDF do Drive', err)
    return NextResponse.json({ error: 'Não foi possível baixar o PDF do Google Drive. Tente de novo.' }, { status: 500 })
  }

  const { data: thread } = await supabase
    .from('relatorio_email_threads')
    .select('ultimo_message_id, ultimo_destinatarios, ultimo_cc')
    .eq('obra_id', obraId)
    .eq('tipo', 'rdo')
    .maybeSingle()

  const headers: Record<string, string> = {}
  if (thread?.ultimo_message_id) {
    headers['In-Reply-To'] = thread.ultimo_message_id
    headers['References'] = thread.ultimo_message_id
  }

  // Manda do e-mail de quem está logado (domínio verificado no Resend), nunca do corpo da requisição
  const remetente = remetenteDaSessao(user, auth.profile, FROM)
  const corpo = String(mensagem ?? '').split('\n').map((l: string) => escaparHtml(l) || '&nbsp;').join('<br>')
  // Assinatura: a salva no perfil do usuário (servidor). Se não houver, aceita a do
  // navegador, só com limpeza básica (sem <script>/on*=) — limitação conhecida.
  const assinatura = remetente.assinaturaHtml ?? (assinaturaHtml ? limparHtmlBasico(String(assinaturaHtml)) : '')
  const html = assinatura ? `${corpo}<br><br>${assinatura}` : corpo
  const from = remetente.from

  const ccLimpo = Array.isArray(cc) ? cc.filter(Boolean) : []

  // O envio sai pelo Resend, não pela caixa do Gmail — nada aparece em
  // "Enviados". Uma cópia oculta pra quem enviou serve de comprovante.
  const copiaPara = remetente.copiaPara
  const jaRecebe = [...destinatarios, ...ccLimpo].map((e: string) => e.trim().toLowerCase())
  const bcc = copiaPara && !jaRecebe.includes(copiaPara.toLowerCase()) ? [copiaPara] : undefined

  const { data, error } = await resend.emails.send({
    from,
    to: destinatarios,
    ...(ccLimpo.length > 0 ? { cc: ccLimpo } : {}),
    ...(bcc ? { bcc } : {}),
    subject: assunto,
    html,
    attachments,
    headers,
  })

  if (error) {
    console.error('[enviar-rdo-drive] falha no Resend', error)
    return NextResponse.json({ error: 'Não foi possível enviar o e-mail. Confira os endereços e tente de novo.' }, { status: 500 })
  }

  let messageId: string | null = thread?.ultimo_message_id ?? null
  if (data?.id) {
    const resultado = await buscarMessageIdReal(data.id)
    if (resultado.messageId) messageId = resultado.messageId
  }
  // Daqui pra baixo o e-mail JÁ saiu: falhas são registradas e avisadas, mas não
  // viram erro (reenviar duplicaria o e-mail para o cliente).
  const avisos: string[] = []
  const { error: threadErr } = await supabase.from('relatorio_email_threads').upsert({
    obra_id: obraId,
    tipo: 'rdo',
    ultimo_message_id: messageId,
    ultimo_destinatarios: destinatarios,
    ultimo_cc: ccLimpo,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'obra_id,tipo' })
  if (threadErr) console.error('[enviar-rdo-drive] erro ao salvar conversa', threadErr)

  const nomeRemetente = remetente.nome || remetente.email
  // Marca cada RDO enviado (mostra "Enviado em" na tabela e alimenta as Pendências)
  const { error: marcarErr } = await supabase.from('diario_obra_relatorios').update({
    email_enviado_em: new Date().toISOString(),
    email_enviado_para: [...destinatarios, ...ccLimpo],
    email_enviado_por: nomeRemetente,
  }).in('id', relatorios.map(r => r.id))
  if (marcarErr) {
    console.error('[enviar-rdo-drive] erro ao marcar RDOs como enviados', marcarErr)
    avisos.push('O e-mail foi enviado, mas os relatórios não foram marcados como enviados.')
  }

  // Entra no histórico "Enviados nesta obra", que consulta no Resend se o
  // e-mail foi entregue ou devolvido.
  const numeros = relatorios.map(r => r.numero).filter(n => n != null).sort((a, b) => a - b)
  const { error: histErr } = await supabase.from('obra_emails_enviados').insert({
    obra_id: obraId,
    template_nome: `RDO ${numeros.map(n => `#${n}`).join(', ')}`,
    destinatario: [...destinatarios, ...ccLimpo].join(', '),
    assunto,
    remetente: remetente.email,
    resend_id: data?.id ?? null,
    status: 'sent',
    enviado_por: user.id,
    enviado_por_nome: remetente.nome,
  })
  if (histErr) {
    console.error('[enviar-rdo-drive] erro ao registrar no histórico', histErr)
    avisos.push('O e-mail foi enviado, mas não entrou no histórico da obra.')
  }

  return NextResponse.json({ ok: true, id: data?.id, copiaPara: bcc?.[0] ?? null, avisos: avisos.length ? avisos : undefined })
}
