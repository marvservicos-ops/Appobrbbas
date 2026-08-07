import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sincronizarRdosDaObra } from '@/lib/diarioObra'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const supabase = createServiceClient()
  const { data: obras } = await supabase.from('obras').select('id, titulo').not('diario_obra_id', 'is', null)

  const resultados: Record<string, unknown> = {}
  for (const obra of obras ?? []) {
    try {
      resultados[obra.titulo] = await sincronizarRdosDaObra(obra.id)
    } catch (e) {
      resultados[obra.titulo] = { erro: e instanceof Error ? e.message : String(e) }
    }
  }

  return NextResponse.json({ ok: true, obras: obras?.length ?? 0, resultados },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } })
}
