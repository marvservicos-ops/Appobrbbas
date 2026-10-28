import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/service'
import { gerarPdfsDeUrls } from '@/lib/pdf'
import { buscarMessageIdReal } from '@/lib/emailThread'
import { exigirUsuarioAtivo, escaparHtml, limparHtmlBasico } from '@/lib/apiAuth'
import { remetenteDaSessao } from '@/lib/remetente'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'joaovictor@marvservicos.com.br'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.marvservicos.com.br'
const MAX_RDOS_POR_ENVIO = 6 // acima disso, risco de estourar o timeout da function no plano atual

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await exigirUsuarioAtivo()
  if (!auth.ok) return auth.resposta

  // remetenteNome/remetenteEmail do corpo são ignorados: o remetente vem da sessão.
  const { obraId, rdoIds, destinatarios, cc, assunto, mensagem, assinaturaHtml } = await req.json()

  if (!obraId || !Array.isArray(rdoIds) || rdoIds.length === 0 || !Array.isArray(destinatarios) || destinatarios.length === 0 || !assunto) {
    return NextResponse.json({ error: 'Campos obrigatórios: obraId, rdoIds, destinatarios, assunto' }, { status: 400 })
  }
  if (rdoIds.length > MAX_RDOS_POR_ENVIO) {
    return NextResponse.json({ error: `Envie no máximo ${MAX_RDOS_POR_ENVIO} relatórios por vez.` }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: rdos, error: rdosErr } = await supabase.from('rdos').select('id, numero, data').in('id', rdoIds).eq('obra_id', obraId)
  if (rdosErr) console.error('[enviar-rdo] erro ao ler RDOs', rdosErr)
  if (!rdos || rdos.length === 0) {
    return NextResponse.json({ error: 'Relatório(s) não encontrado(s).' }, { status: 404 })
  }
  if (rdos.length !== new Set(rdoIds).size) {
    return NextResponse.json({ error: 'Algum relatório selecionado não pertence a esta obra.' }, { status: 400 })
  }

  let pdfs: Buffer[]
  try {
    // Cookies da sessão de quem está enviando: /print/rdo exige login.
    pdfs = await gerarPdfsDeUrls(rdoIds.map((id: string) => `${APP_URL}/print/rdo/${id}`), {
      cookies: req.cookies.getAll().map(c => ({ name: c.name, value: c.value })),
      seletorPronto: '.no-print', // botão "Imprimir" que a página só mostra depois de carregar os dados
    })
  } catch (err) {
    console.error('[enviar-rdo] falha ao gerar PDF', err)
    const msg = err instanceof Error && err.message.startsWith('Não foi possível gerar o PDF') ? err.message : 'Não foi possível gerar o PDF do relatório.'
    return NextResponse.json({ error: `${msg} Tente de novo.` }, { status: 500 })
  }

  const attachments = rdoIds.map((id: string, i: number) => {
    const rdo = rdos.find(r => r.id === id)
    const numero = rdo?.numero ? String(rdo.numero).padStart(3, '0') : String(i + 1)
    return { filename: `RDO-${numero}.pdf`, content: pdfs[i].toString('base64') }
  })

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

  const remetente = remetenteDaSessao(auth.user, auth.profile, FROM)
  const corpo = String(mensagem ?? '').split('\n').map((l: string) => escaparHtml(l) || '&nbsp;').join('<br>')
  const assinatura = remetente.assinaturaHtml ?? (assinaturaHtml ? limparHtmlBasico(String(assinaturaHtml)) : '')
  const html = assinatura ? `${corpo}<br><br>${assinatura}` : corpo
  const from = remetente.from

  const ccLimpo = Array.isArray(cc) ? cc.filter(Boolean) : []

  const { data, error } = await resend.emails.send({
    from,
    to: destinatarios,
    ...(ccLimpo.length > 0 ? { cc: ccLimpo } : {}),
    subject: assunto,
    html,
    attachments,
    headers,
  })

  if (error) {
    console.error('[enviar-rdo] falha no Resend', error)
    return NextResponse.json({ error: 'Não foi possível enviar o e-mail. Confira os endereços e tente de novo.' }, { status: 500 })
  }

  // O Resend gera o próprio Message-ID — só sabemos o valor real consultando depois do envio
  let messageId: string | null = thread?.ultimo_message_id ?? null
  if (data?.id) {
    const resultado = await buscarMessageIdReal(data.id)
    if (resultado.messageId) messageId = resultado.messageId
  }
  const { error: threadErr } = await supabase.from('relatorio_email_threads').upsert({
    obra_id: obraId,
    tipo: 'rdo',
    ultimo_message_id: messageId,
    ultimo_destinatarios: destinatarios,
    ultimo_cc: ccLimpo,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'obra_id,tipo' })
  // O e-mail já saiu; falha aqui só faz o próximo envio não entrar na mesma conversa.
  if (threadErr) console.error('[enviar-rdo] e-mail enviado, mas não salvei a conversa', threadErr)

  return NextResponse.json({ ok: true, id: data?.id })
}
