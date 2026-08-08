import { NextResponse } from 'next/server'
import { sincronizarBackupCompleto } from '@/lib/diarioObra'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
  try {
    const resultados = await sincronizarBackupCompleto()
    return NextResponse.json({ ok: true, obras: Object.keys(resultados).length, resultados })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
