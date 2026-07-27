import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'noreply@marvservicos.com.br'

export async function POST(req: NextRequest) {
  const { to, subject, body } = await req.json()

  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Campos obrigatórios: to, subject, body' }, { status: 400 })
  }

  const { data, error } = await resend.emails.send({
    from: `MARV Serviços <${FROM}>`,
    to: [to],
    subject,
    text: body,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data?.id })
}
