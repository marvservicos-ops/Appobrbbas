import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Client service-role: ignora RLS. Uso EXCLUSIVO em rotas de API server-side
// (nunca importar em client components). Usado pelo portal do cliente, que
// não tem sessão Supabase e não deve depender de políticas RLS para anon.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
