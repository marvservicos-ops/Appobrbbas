// Mensagens vão com parse_mode HTML: todo texto vindo do banco (nome de produto,
// estoque etc.) precisa passar por escaparTelegram, senão um "<" ou "&" derruba o envio.
export const escaparTelegram = (t: unknown) =>
  String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Limite do Telegram é 4096 caracteres por mensagem; deixamos folga.
const LIMITE = 4000

// Quebra em pedaços de até LIMITE caracteres, preferindo quebrar em fim de linha
// (assim nenhuma tag HTML de uma linha fica cortada ao meio).
export function quebrarMensagem(texto: string, limite = LIMITE): string[] {
  if (texto.length <= limite) return [texto]
  const partes: string[] = []
  let atual = ''
  for (const linha of texto.split('\n')) {
    const candidata = atual ? `${atual}\n${linha}` : linha
    if (candidata.length <= limite) { atual = candidata; continue }
    if (atual) partes.push(atual)
    // linha sozinha maior que o limite: corta na marra (raro)
    let resto = linha
    while (resto.length > limite) { partes.push(resto.slice(0, limite)); resto = resto.slice(limite) }
    atual = resto
  }
  if (atual) partes.push(atual)
  return partes
}

async function enviarUma(token: string, chatId: string, texto: string, threadId?: string) {
  const body: Record<string, unknown> = { chat_id: chatId, text: texto, parse_mode: 'HTML' }
  if (threadId) body.message_thread_id = Number(threadId)

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (!data.ok) {
      console.error('[telegram] falha ao enviar mensagem', res.status, data.description)
      return { ok: false, error: data.description ?? 'Falha ao enviar mensagem' }
    }
    return { ok: true }
  } catch (e) {
    console.error('[telegram] erro de rede ao enviar mensagem', e)
    return { ok: false, error: 'Erro de rede ao falar com o Telegram' }
  }
}

export async function enviarTelegram(texto: string, threadId?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    console.error('[telegram] TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados')
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados' }
  }

  const partes = quebrarMensagem(texto)
  for (let i = 0; i < partes.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 600)) // ~1 msg/s por chat
    const r = await enviarUma(token, chatId, partes[i], threadId)
    if (!r.ok) return r
  }
  return { ok: true }
}
