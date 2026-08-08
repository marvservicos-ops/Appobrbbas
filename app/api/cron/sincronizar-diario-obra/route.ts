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
  // obra do marv-gestão), inclusive as que forem criadas no futuro.
  const resultados = await sincronizarBackupCompleto()

  return NextResponse.json({ ok: true, obras: Object.keys(resultados).length, resultados },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } })
}
