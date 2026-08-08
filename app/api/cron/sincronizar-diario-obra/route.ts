import { NextRequest, NextResponse } from 'next/server'
import { sincronizarBackupCompleto } from '@/lib/diarioObra'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  // Faz backup de TODAS as obras do Diário de Obra (vinculadas ou não a uma
  // obra do marv-gestão), inclusive as que forem criadas no futuro. Roda em
  // lotes internamente (sem round-trip de rede) até terminar ou até um teto
  // de rodadas, pra não estourar o tempo limite da function.
  let rodadas = 0
  let completo = false
  let resultadosFinais: Record<string, unknown> = {}
  while (!completo && rodadas < 15) {
    rodadas++
    const { resultados, completo: c } = await sincronizarBackupCompleto(20)
    resultadosFinais = { ...resultadosFinais, ...resultados }
    completo = c
  }

  return NextResponse.json({ ok: true, rodadas, completo, obras: Object.keys(resultadosFinais).length, resultados: resultadosFinais },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } })
}
