import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('app_profiles')
    .select('role,active')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile?.active || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem criar usuários.' }, { status: 403 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' }, { status: 503 })
  }

  const body = await request.json()
  const nome = String(body.nome ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const role = body.role === 'admin' ? 'admin' : 'usuario'
  const permissions = Array.isArray(body.permissions) ? body.permissions.filter((p: unknown) => p === 'financeiro') : []

  if (!nome || !email || password.length < 8) {
    return NextResponse.json({ error: 'Informe nome, e-mail e uma senha com pelo menos 8 caracteres.' }, { status: 400 })
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { error: profileError } = await admin
    .from('app_profiles')
    .update({ nome, role, permissions, active: true })
    .eq('id', data.user.id)
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ user: { id: data.user.id, email, nome, role, permissions, active: true } }, { status: 201 })
}
