import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/service'
import { gerarPdfsDeUrls } from '@/lib/pdf'
import { buscarMessageIdReal } from '@/lib/emailThread'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'joaovictor@marvservicos.com.br'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.marvservicos.com.br'
const MAX_RDOS_POR_ENVIO = 6 // acima disso, risco de estourar o timeout da function no plano atual

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { obraId, rdoIds, destinatarios, assunto, mensagem } = await req.json()

  if (!obraId || !Array.isArray(rdoIds) || rdoIds.length === 0 || !Array.isArray(destinatarios) || destinatarios.length === 0 || !assunto) {
    return NextResponse.json({ error: 'Campos obrigatórios: obraId, rdoIds, destinatarios, assunto' }, { status: 400 })
  }
  if (rdoIds.length > MAX_RDOS_POR_ENVIO) {
    return NextResponse.json({ error: `Envie no máximo ${MAX_RDOS_POR_ENVIO} relatórios por vez.` }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: rdos } = await supabase.from('rdos').select('id, numero, data').in('id', rdoIds)
  if (!rdos || rdos.length === 0) {
    return NextResponse.json({ error: 'Relatório(s) não encontrado(s).' }, { status: 404 })
  }

  let pdfs: Buffer[]
  try {
    pdfs = await gerarPdfsDeUrls(rdoIds.map((id: string) => `${APP_URL}/print/rdo/${id}`))
  } catch (err) {
    return NextResponse.json({ error: `Falha ao gerar PDF: ${err instanceof Error ? err.message : 'erro desconhecido'}` }, { status: 500 })
  }

  const attachments = rdoIds.map((id: string, i: number) => {
    const rdo = rdos.find(r => r.id === id)
    const numero = rdo?.numero ? String(rdo.numero).padStart(3, '0') : String(i + 1)
    return { filename: `RDO-${numero}.pdf`, content: pdfs[i].toString('base64') }
  })

  const { data: thread } = await supabase
    .from('relatorio_email_threads')
    .select('ultimo_message_id')
    .eq('obra_id', obraId)
    .eq('tipo', 'rdo')
    .maybeSingle()

  const headers: Record<string, string> = {}
  if (thread?.ultimo_message_id) {
    headers['In-Reply-To'] = thread.ultimo_message_id
    headers['References'] = thread.ultimo_message_id
  }

  const html = String(mensagem ?? '').split('\n').map((l: string) => l || '&nbsp;').join('<br>')

  const { data, error } = await resend.emails.send({
    from: `MARV Serviços <${FROM}>`,
    to: destinatarios,
    subject: assunto,
    html,
    attachments,
    headers,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // O Resend gera o próprio Message-ID — só sabemos o valor real consultando depois do envio
  if (data?.id) {
    const messageId = await buscarMessageIdReal(data.id)
    if (messageId) {
      await supabase.from('relatorio_email_threads').upsert({
        obra_id: obraId,
        tipo: 'rdo',
        ultimo_message_id: messageId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'obra_id,tipo' })
    }
  }

  return NextResponse.json({ ok: true, id: data?.id })
}
