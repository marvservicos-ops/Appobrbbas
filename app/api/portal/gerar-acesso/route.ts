import { NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, profileCan } from '@/lib/access'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const profile = await getCurrentProfile()
  if (!profileCan(profile, 'financeiro')) {
    return NextResponse.json({ error: 'Sem permissão para gerar acesso do cliente.' }, { status: 403 })
  }

  const body = await request.json()
  const obraId = String(body.obraId ?? '')
  if (!obraId) return NextResponse.json({ error: 'obraId é obrigatório.' }, { status: 400 })

  const token = crypto.randomBytes(24).toString('hex')
  const pin = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  const pinHash = await bcrypt.hash(pin, 10)

  const service = createServiceClient()

  const { error: deactivateError } = await service
    .from('obra_acessos_cliente')
    .update({ ativo: false })
    .eq('obra_id', obraId)
    .eq('ativo', true)
  if (deactivateError) return NextResponse.json({ error: deactivateError.message }, { status: 500 })

  const { error: insertError } = await service
    .from('obra_acessos_cliente')
    .insert({ obra_id: obraId, token, pin_hash: pinHash, ativo: true, created_by: user.id })
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ token, pin })
}
