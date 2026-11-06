import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { exigirUsuarioAtivo } from '@/lib/apiAuth'
import { remetenteDaSessao } from '@/lib/remetente'
import { emailValido, htmlEmail, nomeArquivoExcel, pendenciasEnvio, planilhaLiberacao, type Liberacao } from '@/lib/liberacoes'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'joaovictor@marvservicos.com.br'

// Envia a solicitação já salva (lê do banco — o corpo da requisição só traz o id),
// com a tabela no corpo do e-mail e em Excel anexo.
export async function POST(req: NextRequest) {
  const auth = await exigirUsuarioAtivo({ admin: true })
  if (!auth.ok) return auth.resposta

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Solicitação não informada.' }, { status: 400 })

  const supabase = await createClient()
  const { data, error: erroLeitura } = await supabase.from('liberacoes').select('*').eq('id', id).maybeSingle()
  if (erroLeitura) console.error('[liberacoes/enviar] erro ao ler', erroLeitura)
  if (!data) return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
  const lib = data as Liberacao

  const pendencias = pendenciasEnvio(lib)
  if (pendencias.length) return NextResponse.json({ error: pendencias.join('. ') + '.' }, { status: 400 })

  const para = lib.destinatarios.map(e => e.trim()).filter(Boolean)
  const cc = lib.cc.map(e => e.trim()).filter(Boolean).filter(e => !para.some(p => p.toLowerCase() === e.toLowerCase()))
  const invalidos = [...para, ...cc].filter(e => !emailValido(e))
  if (invalidos.length) return NextResponse.json({ error: `E-mail inválido: ${invalidos.join(', ')}` }, { status: 400 })

  const remetente = remetenteDaSessao(auth.user, auth.profile, FROM)
  const corpo = htmlEmail(lib.mensagem, lib)
  const html = remetente.assinaturaHtml ? `${corpo}<br>${remetente.assinaturaHtml}` : corpo

  const excel = XLSX.write(planilhaLiberacao(lib), { type: 'buffer', bookType: 'xlsx' }) as Buffer

  // O envio sai pelo Resend: a cópia oculta para quem enviou serve de comprovante.
  const todos = [...para, ...cc].map(e => e.toLowerCase())
  const copiaOculta = remetente.copiaPara && !todos.includes(remetente.copiaPara.toLowerCase()) ? [remetente.copiaPara] : undefined

  const { data: enviado, error } = await resend.emails.send({
    from: remetente.from,
    to: para,
    ...(cc.length ? { cc } : {}),
    ...(copiaOculta ? { bcc: copiaOculta } : {}),
    replyTo: remetente.email,
    subject: lib.assunto,
    html,
    attachments: [{ filename: nomeArquivoExcel(lib), content: excel.toString('base64') }],
  })

  if (error) {
    console.error('[liberacoes/enviar] falha no Resend', error)
    return NextResponse.json({ error: 'Não foi possível enviar o e-mail. Confira os endereços e tente de novo.' }, { status: 500 })
  }

  const agora = new Date().toISOString()
  const { error: erroStatus } = await supabase.from('liberacoes').update({
    status: 'enviada',
    envios: (lib.envios ?? 0) + 1,
    enviada_em: agora,
    enviada_por_nome: auth.profile.nome || auth.profile.email || null,
    resend_id: enviado?.id ?? null,
    updated_at: agora,
  }).eq('id', lib.id)
  // O e-mail já saiu; só o status na tela que fica desatualizado.
  if (erroStatus) console.error('[liberacoes/enviar] enviado, mas não marquei como enviada', erroStatus)

  return NextResponse.json({ ok: true, enviadaEm: agora, copiaPara: copiaOculta?.[0] ?? null })
}
