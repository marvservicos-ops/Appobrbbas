import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { exigirUsuarioAtivo } from '@/lib/apiAuth'
import { enviarResumoSemana } from '@/lib/contasPagarEmail'

export const dynamic = 'force-dynamic'

// "Enviar agora" da tela: manda o resumo da semana para os destinatários configurados
export async function POST() {
  const auth = await exigirUsuarioAtivo({ permissao: 'contas_pagar' })
  if (!auth.ok) return auth.resposta

  const r = await enviarResumoSemana(createServiceClient())
  if (!r.ok) console.error('[contas-pagar/alerta-semana]', r.motivo)
  return NextResponse.json(r, { status: r.ok ? 200 : 500 })
}
