import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { cronAutorizado } from '@/lib/apiAuth'
import { enviarResumoSemana } from '@/lib/contasPagarEmail'

export const dynamic = 'force-dynamic'

// Toda segunda às 08:00 (Brasília): boletos que devem aparecer no DDA na semana
export async function GET(req: NextRequest) {
  const negado = cronAutorizado(req, 'cron/contas-pagar-semana')
  if (negado) return negado

  const r = await enviarResumoSemana(createServiceClient())
  if (!r.ok) console.error('[cron/contas-pagar-semana]', r.motivo)
  return NextResponse.json(r, { status: r.ok ? 200 : 500, headers: { 'Cache-Control': 'no-store' } })
}
