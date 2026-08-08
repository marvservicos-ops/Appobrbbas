import { NextRequest, NextResponse } from 'next/server'
import { sincronizarBackupCompleto } from '@/lib/diarioObra'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const limite = typeof body?.limite === 'number' && body.limite > 0 ? body.limite : 20
    const { resultados, completo } = await sincronizarBackupCompleto(limite)
    return NextResponse.json({ ok: true, obras: Object.keys(resultados).length, resultados, completo })
  } catch (e) {
    console.error('[diario-obra/backup-completo]', e)
    const nome = e instanceof Error ? e.constructor.name : typeof e
    const stack = e instanceof Error && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : undefined
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      errorType: nome,
      errorStack: stack,
    }, { status: 500 })
  }
}
