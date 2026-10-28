import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase/service'

const COOKIE_NAME = 'portal_session'
const SESSAO_DIAS = 30

// Limite simples de tentativas de PIN: 5 erros em 15 min bloqueiam o link por 15 min.
// LIMITAÇÃO: o contador fica em memória da instância do servidor (na Vercel cada
// instância tem o seu e ele zera quando a função "esfria"). Somado ao token de 48
// caracteres e à espera de 1s por erro, já torna força bruta impraticável; para um
// limite global seria preciso guardar as falhas no banco.
const MAX_FALHAS = 5
const JANELA_MS = 15 * 60 * 1000
const falhas = new Map<string, { qtd: number; desde: number }>()

function bloqueado(token: string) {
  const f = falhas.get(token)
  if (!f) return false
  if (Date.now() - f.desde > JANELA_MS) { falhas.delete(token); return false }
  return f.qtd >= MAX_FALHAS
}

async function registrarFalha(token: string) {
  const f = falhas.get(token)
  if (!f || Date.now() - f.desde > JANELA_MS) falhas.set(token, { qtd: 1, desde: Date.now() })
  else f.qtd++
  await new Promise(r => setTimeout(r, 1000))
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  const { pin } = await request.json()
  if (!pin) return NextResponse.json({ error: 'Informe o PIN.' }, { status: 400 })

  if (bloqueado(params.token)) {
    return NextResponse.json({ error: 'Muitas tentativas erradas. Aguarde 15 minutos e tente de novo.' }, { status: 429 })
  }

  const service = createServiceClient()

  const { data: acesso } = await service
    .from('obra_acessos_cliente')
    .select('id, pin_hash')
    .eq('token', params.token)
    .eq('ativo', true)
    .maybeSingle()

  if (!acesso) {
    await registrarFalha(params.token)
    return NextResponse.json({ error: 'Link ou PIN inválido.' }, { status: 401 })
  }

  const valido = await bcrypt.compare(String(pin), acesso.pin_hash)
  if (!valido) {
    await registrarFalha(params.token)
    return NextResponse.json({ error: 'Link ou PIN inválido.' }, { status: 401 })
  }
  falhas.delete(params.token)

  const expiresAt = new Date(Date.now() + SESSAO_DIAS * 24 * 60 * 60 * 1000)
  const { data: sessao, error: sessaoError } = await service
    .from('obra_portal_sessoes')
    .insert({ acesso_id: acesso.id, expires_at: expiresAt.toISOString() })
    .select('id')
    .single()
  if (sessaoError || !sessao) {
    console.error('[portal/verify] erro ao criar sessão', sessaoError)
    return NextResponse.json({ error: 'Não foi possível entrar agora. Tente de novo.' }, { status: 500 })
  }

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
