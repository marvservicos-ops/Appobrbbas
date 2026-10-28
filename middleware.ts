import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && !pathname.startsWith('/login') && !pathname.startsWith('/auth') && !pathname.startsWith('/pub') && !pathname.startsWith('/portal') && !pathname.startsWith('/api/portal') && !pathname.startsWith('/api/cron')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Usuário bloqueado pelo admin: derruba a sessão. (O bloqueio também bane a
  // conta no Auth, mas isso só vale quando o token expira — aqui é imediato.)
  if (user && !pathname.startsWith('/auth')) {
    const { data: perfil } = await supabase.from('app_profiles').select('active').eq('id', user.id).maybeSingle()
    if (perfil && perfil.active === false) {
      await supabase.auth.signOut({ scope: 'local' })
      const resposta = pathname.startsWith('/api/')
        ? NextResponse.json({ error: 'Seu acesso foi bloqueado. Fale com o administrador.' }, { status: 403 })
        : (() => {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            url.search = '?bloqueado=1'
            return NextResponse.redirect(url)
          })()
      // leva junto os cookies apagados pelo signOut
      supabaseResponse.cookies.getAll().forEach(c => resposta.cookies.set(c))
      return resposta
    }
  }

  // Logado abrindo /login vai para o Dashboard — exceto quando veio do link de
  // "esqueci a senha" (?recovery=1), que precisa mostrar o formulário de nova senha.
  if (user && pathname.startsWith('/login') && request.nextUrl.searchParams.get('recovery') !== '1') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
