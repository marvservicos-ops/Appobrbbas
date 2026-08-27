import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { limparDuplicadosDaObra } from '@/lib/diarioObra'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { obraId } = await req.json()
  if (!obraId) return NextResponse.json({ error: 'obraId é obrigatório' }, { status: 400 })

  try {
    const supabase = createServiceClient()
    const { data: obra, error } = await supabase.from('obras').select('titulo').eq('id', obraId).single()
    if (error || !obra) throw new Error('Obra não encontrada')

    const resultado = await limparDuplicadosDaObra(obra.titulo)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
