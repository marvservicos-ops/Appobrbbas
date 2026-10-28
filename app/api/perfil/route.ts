import { NextResponse } from 'next/server'
import { exigirUsuarioAtivo } from '@/lib/apiAuth'
import { createServiceClient } from '@/lib/supabase/service'

// O RLS de app_profiles só deixa admin atualizar perfil. Esta rota deixa cada
// usuário atualizar SÓ o próprio nome e cargo (usados como remetente nos e-mails).
export async function PATCH(request: Request) {
  const auth = await exigirUsuarioAtivo()
  if (!auth.ok) return auth.resposta

  const body = await request.json()
  const nome = String(body.nome ?? '').trim().slice(0, 120)
  const cargo = String(body.cargo ?? '').trim().slice(0, 120)
  if (!nome) return NextResponse.json({ error: 'Informe o seu nome.' }, { status: 400 })

  const { error } = await createServiceClient()
    .from('app_profiles')
    .update({ nome, cargo: cargo || null })
    .eq('id', auth.user.id)
  if (error) {
    console.error('[api/perfil] erro ao salvar perfil', error)
    return NextResponse.json({ error: 'Não foi possível salvar o perfil. Tente de novo.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
