export async function enviarTelegram(texto: string, threadId?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return { ok: false, error: 'TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados' }

  const body: Record<string, unknown> = { chat_id: chatId, text: texto, parse_mode: 'HTML' }
  if (threadId) body.message_thread_id = Number(threadId)

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.ok) return { ok: false, error: data.description ?? 'Falha ao enviar mensagem' }
  return { ok: true }
}
