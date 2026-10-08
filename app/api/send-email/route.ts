import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)
const DEFAULT_FROM = process.env.EMAIL_FROM ?? 'joaovictor@marvservicos.com.br'
const DOMINIO_VERIFICADO = '@marvservicos.com.br'

export async function POST(req: NextRequest) {
  const { to, subject, body, obraId, templateId, templateNome } = await req.json()

  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Campos obrigatórios: to, subject, body' }, { status: 400 })
  }

  // Remetente é sempre determinado pelo usuário autenticado na sessão (nunca pelo payload do cliente).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let fromEmail = DEFAULT_FROM
  let fromNome = 'MARV Serviços'
  let nomeUsuario: string | null = null
  let copiaPara: string | null = user?.email ?? null
  if (user) {
    const { data: profile } = await supabase.from('app_profiles').select('email, nome').eq('id', user.id).maybeSingle()
    nomeUsuario = profile?.nome ?? null
    if (profile?.email) copiaPara = profile.email
    if (profile?.email && profile.email.toLowerCase().endsWith(DOMINIO_VERIFICADO)) {
      fromEmail = profile.email
      fromNome = profile.nome || fromNome
    }
  }

  // O envio sai pelo Resend, não pela caixa de e-mail do usuário — então nada
  // aparece em "Enviados". Uma cópia oculta pra quem enviou serve de comprovante.
  const isHtml = body.trim().startsWith('<')
  const { data, error } = await resend.emails.send({
    from: `${fromNome} (MARV Serviços) <${fromEmail}>`,
    to: [to],
    bcc: copiaPara && copiaPara.toLowerCase() !== to.trim().toLowerCase() ? [copiaPara] : undefined,
    replyTo: fromEmail,
    subject,
    ...(isHtml ? { html: body } : { text: body }),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let registrado = false
  if (obraId) {
    const { error: logError } = await supabase.from('obra_emails_enviados').insert({
      obra_id: obraId,
      template_id: templateId ?? null,
      template_nome: templateNome ?? null,
      destinatario: to,
      assunto: subject,
      remetente: fromEmail,
      resend_id: data?.id ?? null,
      status: 'sent',
      enviado_por: user?.id ?? null,
      enviado_por_nome: nomeUsuario,
    })
    registrado = !logError
  }

  return NextResponse.json({ id: data?.id, copiaPara, registrado })
}
