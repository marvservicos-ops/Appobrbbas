import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Destino dos links de e-mail do Supabase (recuperação de senha etc.).
// O @supabase/ssr usa PKCE: o link chega com ?code=..., que precisa ser trocado
// por uma sessão aqui no servidor antes de seguir para `next`.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  // `next` só pode ser caminho interno (evita redirecionar para outro site)
  const nextParam = searchParams.get('next') ?? '/dashboard'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
    console.error('[auth/callback] falha ao trocar o código pela sessão', error)
  }
  return NextResponse.redirect(`${origin}/login?erro=link`)
}
