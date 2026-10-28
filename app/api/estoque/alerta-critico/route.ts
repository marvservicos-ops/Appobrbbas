import { NextRequest, NextResponse } from 'next/server'
import { enviarTelegram, escaparTelegram } from '@/lib/telegram'
import { exigirUsuarioAtivo } from '@/lib/apiAuth'
import { formatarQtd } from '@/lib/numero'

export async function POST(req: NextRequest) {
  const auth = await exigirUsuarioAtivo()
  if (!auth.ok) return auth.resposta

  const { produtoNome, estoqueNome, quantidadeAnterior, quantidadeNova, quantidadeMinima, unidade } = await req.json()

  if (typeof quantidadeMinima !== 'number' || quantidadeMinima <= 0) {
    return NextResponse.json({ ok: true, enviado: false })
  }

  // Critério de crítico (igual ao sino, Dashboard e relatório diário): atual <= mínimo.
  // Só alerta no momento em que cruza o limite (evita spam a cada nova saída do mesmo item já crítico)
  const anterior = Number(quantidadeAnterior)
  const nova = Number(quantidadeNova)
  const cruzouAgora = anterior > quantidadeMinima && nova <= quantidadeMinima
  if (!cruzouAgora) {
    return NextResponse.json({ ok: true, enviado: false })
  }

  const marca = nova < 0 ? '🔴' : '🟠'
  const texto = `${marca} <b>Estoque crítico</b>\n${escaparTelegram(estoqueNome)} — ${escaparTelegram(produtoNome)}\nQuantidade atual: <b>${formatarQtd(nova)} ${escaparTelegram(unidade ?? '')}</b> (mínimo: ${formatarQtd(quantidadeMinima)})`
  const resultado = await enviarTelegram(texto, process.env.TELEGRAM_THREAD_ESTOQUE)
  if (!resultado.ok) console.error('[estoque/alerta-critico] falha no Telegram', resultado.error)
  return NextResponse.json({ ok: resultado.ok, enviado: resultado.ok })
}
