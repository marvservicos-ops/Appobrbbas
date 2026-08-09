import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// O Resend gera o próprio Message-ID (ignora qualquer header customizado enviado
// na criação) — só é possível saber o valor real consultando a API depois do envio.
export async function buscarMessageIdReal(emailId: string): Promise<string | null> {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    if (tentativa > 0) await new Promise(r => setTimeout(r, 800))
    try {
      const { data } = await resend.emails.get(emailId)
      const messageId = (data as unknown as { message_id?: string } | null)?.message_id
      if (messageId) return messageId
    } catch {
      // tenta de novo
    }
  }
  return null
}
