import { NextRequest, NextResponse } from 'next/server'
import { sincronizarRdosDaObra } from '@/lib/diarioObra'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { obraId } = await req.json()
  if (!obraId) return NextResponse.json({ error: 'obraId é obrigatório' }, { status: 400 })

  try {
    const resultado = await sincronizarRdosDaObra(obraId)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
