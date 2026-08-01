import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase/service'

const COOKIE_NAME = 'portal_session'
const SESSAO_DIAS = 30

export async function POST(request: Request, { params }: { params: { token: string } }) {
  const { pin } = await request.json()
  if (!pin) return NextResponse.json({ error: 'Informe o PIN.' }, { status: 400 })

  const service = createServiceClient()

  const { data: acesso } = await service
    .from('obra_acessos_cliente')
    .select('id, pin_hash')
    .eq('token', params.token)
    .eq('ativo', true)
    .maybeSingle()

  if (!acesso) return NextResponse.json({ error: 'Link ou PIN inválido.' }, { status: 401 })

  const valido = await bcrypt.compare(String(pin), acesso.pin_hash)
  if (!valido) return NextResponse.json({ error: 'Link ou PIN inválido.' }, { status: 401 })

  const expiresAt = new Date(Date.now() + SESSAO_DIAS * 24 * 60 * 60 * 1000)
  const { data: sessao, error: sessaoError } = await service
    .from('obra_portal_sessoes')
    .insert({ acesso_id: acesso.id, expires_at: expiresAt.toISOString() })
    .select('id')
    .single()
  if (sessaoError || !sessao) return NextResponse.json({ error: 'Erro ao criar sessão.' }, { status: 500 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, sessao.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/portal',
    maxAge: SESSAO_DIAS * 24 * 60 * 60,
  })
  return res
}
