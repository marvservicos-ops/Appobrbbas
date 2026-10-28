import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { AppProfile } from '@/lib/access'

type Resultado =
  | { ok: true; user: User; profile: AppProfile; resposta?: undefined }
  | { ok: false; resposta: NextResponse; user?: undefined; profile?: undefined }

// Para rotas de API (principalmente as que usam service role, que ignora RLS):
// exige usuário logado e com perfil ativo. Opcionalmente exige admin ou uma permissão.
// Uso:
//   const auth = await exigirUsuarioAtivo()
//   if (!auth.ok) return auth.resposta
export async function exigirUsuarioAtivo(opcoes: { admin?: boolean; permissao?: string } = {}): Promise<Resultado> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, resposta: NextResponse.json({ error: 'Sua sessão expirou. Entre de novo.' }, { status: 401 }) }
  }

  const { data: profile, error } = await supabase
    .from('app_profiles')
    .select('id,email,nome,cargo,role,permissions,active')
    .eq('id', user.id)
    .maybeSingle()
  if (error) console.error('[exigirUsuarioAtivo] erro ao ler perfil', error)
  if (!profile || profile.active === false) {
    return { ok: false, resposta: NextResponse.json({ error: 'Seu acesso está bloqueado. Fale com o administrador.' }, { status: 403 }) }
  }

  const p = profile as AppProfile
  const isAdmin = p.role === 'admin'
  if (opcoes.admin && !isAdmin) {
    return { ok: false, resposta: NextResponse.json({ error: 'Apenas administradores podem fazer isso.' }, { status: 403 }) }
  }
  if (opcoes.permissao && !isAdmin && !(p.permissions ?? []).includes(opcoes.permissao)) {
    return { ok: false, resposta: NextResponse.json({ error: 'Você não tem permissão para fazer isso.' }, { status: 403 }) }
  }

  return { ok: true, user, profile: p }
}

// Confere o header Authorization dos crons da Vercel. Sem CRON_SECRET definido,
// recusa (antes deixava passar qualquer um).
export function cronAutorizado(req: Request, rota: string): NextResponse | null {
  const segredo = process.env.CRON_SECRET
  if (!segredo) {
    console.error(`[${rota}] CRON_SECRET não definido no ambiente — requisição recusada.`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}

// Escapa texto para HTML (e-mail / Telegram com parse_mode HTML)
export function escaparHtml(t: string): string {
  return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Limpeza simples de HTML vindo do usuário (assinatura de e-mail): remove
// <script>/<style>/<iframe>/<object>/<embed>, atributos on*= e links javascript:.
// Não é um sanitizador completo — a assinatura é do próprio usuário e o destino
// é um cliente de e-mail (que já bloqueia scripts), então isto basta para
// evitar o pior.
export function limparHtmlBasico(html: string): string {
  return String(html ?? '')
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')?\s*javascript:[^"'>\s]*("|')?/gi, '$1="#"')
}
