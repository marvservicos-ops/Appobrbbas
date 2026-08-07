import { NextRequest, NextResponse } from 'next/server'
import { enviarTelegram } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  const { produtoNome, estoqueNome, quantidadeAnterior, quantidadeNova, quantidadeMinima, unidade } = await req.json()

  if (typeof quantidadeMinima !== 'number' || quantidadeMinima <= 0) {
    return NextResponse.json({ ok: true, enviado: false })
  }

  // Só alerta no momento em que cruza o limite (evita spam a cada nova saída do mesmo item já crítico)
  const cruzouAgora = quantidadeAnterior > quantidadeMinima && quantidadeNova <= quantidadeMinima
  if (!cruzouAgora) {
    return NextResponse.json({ ok: true, enviado: false })
  }

  const marca = quantidadeNova < 0 ? '🔴' : '🟠'
  const texto = `${marca} <b>Estoque crítico</b>\n${estoqueNome} — ${produtoNome}\nQuantidade atual: <b>${quantidadeNova} ${unidade ?? ''}</b> (mínimo: ${quantidadeMinima})`
  const resultado = await enviarTelegram(texto, process.env.TELEGRAM_THREAD_ESTOQUE)
  return NextResponse.json({ ok: resultado.ok, enviado: resultado.ok })
}
