import { NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { exigirUsuarioAtivo } from '@/lib/apiAuth'
import { createServiceClient } from '@/lib/supabase/service'

// obra_acessos_cliente não tem mais policy para o navegador (ver
// supabase/migrations/2026_10_28_seguranca.sql): toda leitura/escrita passa por aqui,
// com checagem da permissão "financeiro".

// GET ?obraId=... → token do acesso ativo da obra (para montar o link do portal)
export async function GET(request: Request) {
  const auth = await exigirUsuarioAtivo({ permissao: 'financeiro' })
  if (!auth.ok) return auth.resposta

  const obraId = new URL(request.url).searchParams.get('obraId') ?? ''
  if (!obraId) return NextResponse.json({ error: 'obraId é obrigatório.' }, { status: 400 })

  const { data, error } = await createServiceClient()
    .from('obra_acessos_cliente')
    .select('token')
    .eq('obra_id', obraId)
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[portal/gerar-acesso GET]', error)
    return NextResponse.json({ error: 'Não foi possível consultar o acesso do cliente.' }, { status: 500 })
  }
  return NextResponse.json({ token: data?.token ?? null })
}

export async function POST(request: Request) {
  const auth = await exigirUsuarioAtivo({ permissao: 'financeiro' })
  if (!auth.ok) return auth.resposta
  const { user } = auth

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
  if (deactivateError) {
    console.error('[portal/gerar-acesso] erro ao desativar acesso anterior', deactivateError)
    return NextResponse.json({ error: 'Não foi possível gerar o acesso. Tente de novo.' }, { status: 500 })
  }

  const { error: insertError } = await service
    .from('obra_acessos_cliente')
    .insert({ obra_id: obraId, token, pin_hash: pinHash, ativo: true, created_by: user.id })
  if (insertError) {
    console.error('[portal/gerar-acesso] erro ao criar acesso', insertError)
    return NextResponse.json({ error: 'Não foi possível gerar o acesso. Tente de novo.' }, { status: 500 })
  }

  return NextResponse.json({ token, pin })
}
