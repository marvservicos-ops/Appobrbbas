import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/service'
import { baixarArquivoDrive } from '@/lib/diarioObra'
import { buscarMessageIdReal } from '@/lib/emailThread'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'joaovictor@marvservicos.com.br'
const MAX_POR_ENVIO = 10

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const { obraId, relatorioIds, destinatarios, assunto, mensagem } = await req.json()

  if (!obraId || !Array.isArray(relatorioIds) || relatorioIds.length === 0 || !Array.isArray(destinatarios) || destinatarios.length === 0 || !assunto) {
    return NextResponse.json({ error: 'Campos obrigatórios: obraId, relatorioIds, destinatarios, assunto' }, { status: 400 })
  }
  if (relatorioIds.length > MAX_POR_ENVIO) {
    return NextResponse.json({ error: `Envie no máximo ${MAX_POR_ENVIO} relatórios por vez.` }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: relatorios } = await supabase
    .from('diario_obra_relatorios')
    .select('id, numero, data, drive_file_id')
    .in('id', relatorioIds)

  if (!relatorios || relatorios.length === 0) {
    return NextResponse.json({ error: 'Relatório(s) não encontrado(s).' }, { status: 404 })
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
    return NextResponse.json({ error: `Falha ao baixar PDF do Drive: ${err instanceof Error ? err.message : 'erro desconhecido'}` }, { status: 500 })
  }

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

  let messageId: string | null = null
  let debugBusca: unknown = null
  if (data?.id) {
    const resultado = await buscarMessageIdReal(data.id)
    messageId = resultado.messageId
    debugBusca = resultado.debug
    if (messageId) {
      await supabase.from('relatorio_email_threads').upsert({
        obra_id: obraId,
        tipo: 'rdo',
        ultimo_message_id: messageId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'obra_id,tipo' })
    }
  }

  return NextResponse.json({
    ok: true,
    id: data?.id,
    debug: {
      threadAnterior: thread?.ultimo_message_id ?? null,
      headersEnviados: headers,
      messageIdNovoEncontrado: messageId,
      buscaMessageId: debugBusca,
    },
  })
}
