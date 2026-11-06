import { NextResponse } from 'next/server'
import { exigirUsuarioAtivo } from '@/lib/apiAuth'
import { createServiceClient } from '@/lib/supabase/service'

// Usuários ativos do app (nome, e-mail, cargo) para os atalhos de contato nos
// envios de e-mail. A RLS de app_profiles só deixa admin ler todos, por isso
// passa pelo servidor e devolve só esses três campos.
export async function GET() {
  const auth = await exigirUsuarioAtivo()
  if (!auth.ok) return auth.resposta

  const { data, error } = await createServiceClient()
    .from('app_profiles')
    .select('nome, email, cargo')
    .eq('active', true)
    .order('nome')
  if (error) {
    console.error('[usuarios/contatos]', error)
    return NextResponse.json({ error: 'Não foi possível carregar os usuários.' }, { status: 500 })
  }
  return NextResponse.json({ usuarios: (data ?? []).filter(u => u.email) })
}
