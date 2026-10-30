import { NextResponse } from 'next/server'
import { exigirUsuarioAtivo } from '@/lib/apiAuth'
import { createServiceClient } from '@/lib/supabase/service'
import { mensagemErro } from '@/lib/erros'
import { PERMISSOES_IDS } from '@/lib/permissoes'

const ADMIN_PRINCIPAL = 'joaovictor@marvservicos.com.br'

function semServiceRole() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  console.error('[admin/users] SUPABASE_SERVICE_ROLE_KEY não configurada')
  return NextResponse.json({ error: 'O servidor não está configurado para gerenciar usuários. Fale com o suporte.' }, { status: 503 })
}

export async function POST(request: Request) {
  const auth = await exigirUsuarioAtivo({ admin: true })
  if (!auth.ok) return auth.resposta
  const faltaChave = semServiceRole()
  if (faltaChave) return faltaChave

  const body = await request.json()
  const nome = String(body.nome ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const role = body.role === 'admin' ? 'admin' : 'usuario'
  const permissions = Array.isArray(body.permissions) ? body.permissions.filter((p: unknown) => typeof p === 'string' && PERMISSOES_IDS.includes(p)) : []

  if (!nome || !email || password.length < 8) {
    return NextResponse.json({ error: 'Informe nome, e-mail e uma senha com pelo menos 8 caracteres.' }, { status: 400 })
  }

  const admin = createServiceClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome },
  })
  if (error) return NextResponse.json({ error: mensagemErro(error, 'Não foi possível criar o usuário') }, { status: 400 })

  const { error: profileError } = await admin
    .from('app_profiles')
    .update({ nome, role, permissions, active: true })
    .eq('id', data.user.id)
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id)
    return NextResponse.json({ error: mensagemErro(profileError, 'Não foi possível criar o usuário') }, { status: 500 })
  }

  return NextResponse.json({ user: { id: data.user.id, email, nome, role, permissions, active: true } }, { status: 201 })
}

// Edição de um usuário existente pelo admin. Corpo: { id, ...um ou mais de }
//   active: boolean   → bloqueia/desbloqueia (perfil + ban no Auth, derruba a sessão)
//   nome, email       → dados cadastrais (Auth + app_profiles)
//   password          → define nova senha
export async function PATCH(request: Request) {
  const auth = await exigirUsuarioAtivo({ admin: true })
  if (!auth.ok) return auth.resposta
  const faltaChave = semServiceRole()
  if (faltaChave) return faltaChave

  const body = await request.json()
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'Usuário não informado.' }, { status: 400 })

  const admin = createServiceClient()
  const { data: alvo, error: alvoErr } = await admin.from('app_profiles').select('id,email,nome,active').eq('id', id).maybeSingle()
  if (alvoErr || !alvo) {
    if (alvoErr) console.error('[admin/users PATCH] erro ao ler perfil', alvoErr)
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
  }
  const ehPrincipal = String(alvo.email).toLowerCase() === ADMIN_PRINCIPAL

  // ── Bloquear / desbloquear ──
  if (typeof body.active === 'boolean') {
    if (!body.active && (ehPrincipal || id === auth.user.id)) {
      return NextResponse.json({ error: ehPrincipal ? 'O administrador principal não pode ser bloqueado.' : 'Você não pode bloquear o seu próprio acesso.' }, { status: 400 })
    }
    const { error: banErr } = await admin.auth.admin.updateUserById(id, { ban_duration: body.active ? 'none' : '876000h' })
    if (banErr) return NextResponse.json({ error: mensagemErro(banErr, body.active ? 'Não foi possível desbloquear' : 'Não foi possível bloquear') }, { status: 500 })
    const { error } = await admin.from('app_profiles').update({ active: body.active }).eq('id', id)
    if (error) {
      // desfaz o ban para não ficar meio bloqueado
      await admin.auth.admin.updateUserById(id, { ban_duration: alvo.active ? 'none' : '876000h' })
      return NextResponse.json({ error: mensagemErro(error, 'Não foi possível salvar a situação') }, { status: 500 })
    }
  }

  // ── Nome / e-mail ──
  const nome = typeof body.nome === 'string' ? body.nome.trim() : undefined
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined
  if (nome !== undefined || email !== undefined) {
    if (nome !== undefined && !nome) return NextResponse.json({ error: 'Informe o nome.' }, { status: 400 })
    if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
    if (email !== undefined && ehPrincipal && email !== ADMIN_PRINCIPAL) {
      return NextResponse.json({ error: 'O e-mail do administrador principal não pode ser alterado.' }, { status: 400 })
    }
    const mudouEmail = email !== undefined && email !== String(alvo.email).toLowerCase()
    const { error: authErr } = await admin.auth.admin.updateUserById(id, {
      ...(mudouEmail ? { email, email_confirm: true } : {}),
      ...(nome !== undefined ? { user_metadata: { nome } } : {}),
    })
    if (authErr) return NextResponse.json({ error: mensagemErro(authErr, 'Não foi possível salvar os dados') }, { status: 400 })
    const { error } = await admin.from('app_profiles').update({
      ...(nome !== undefined ? { nome } : {}),
      ...(mudouEmail ? { email } : {}),
    }).eq('id', id)
    if (error) return NextResponse.json({ error: mensagemErro(error, 'Não foi possível salvar os dados') }, { status: 500 })
  }

  // ── Nova senha ──
  if (body.password !== undefined) {
    const password = String(body.password)
    if (password.length < 8) return NextResponse.json({ error: 'A senha precisa ter pelo menos 8 caracteres.' }, { status: 400 })
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) return NextResponse.json({ error: mensagemErro(error, 'Não foi possível definir a senha') }, { status: 400 })
  }

  const { data: atualizado } = await admin.from('app_profiles').select('*').eq('id', id).maybeSingle()
  return NextResponse.json({ ok: true, user: atualizado })
}
