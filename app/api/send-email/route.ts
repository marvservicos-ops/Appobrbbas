import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)
const DEFAULT_FROM = process.env.EMAIL_FROM ?? 'joaovictor@marvservicos.com.br'
const DOMINIO_VERIFICADO = '@marvservicos.com.br'

export async function POST(req: NextRequest) {
  const { to, subject, body } = await req.json()

  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Campos obrigatórios: to, subject, body' }, { status: 400 })
  }

  // Remetente é sempre determinado pelo usuário autenticado na sessão (nunca pelo payload do cliente).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let fromEmail = DEFAULT_FROM
  let fromNome = 'MARV Serviços'
  if (user) {
    const { data: profile } = await supabase.from('app_profiles').select('email, nome').eq('id', user.id).maybeSingle()
    if (profile?.email && profile.email.toLowerCase().endsWith(DOMINIO_VERIFICADO)) {
      fromEmail = profile.email
      fromNome = profile.nome || fromNome
    }
  }

  const isHtml = body.trim().startsWith('<')
  const { data, error } = await resend.emails.send({
    from: `${fromNome} (MARV Serviços) <${fromEmail}>`,
    to: [to],
    replyTo: fromEmail,
    subject,
    ...(isHtml ? { html: body } : { text: body }),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data?.id })
}
