import { createClient } from '@/lib/supabase/server'

export type AppRole = 'admin' | 'usuario'

export interface AppProfile {
  id: string
  email: string
  nome?: string | null
  cargo?: string | null
  role: AppRole
  permissions: string[]
  active: boolean
}

export async function getCurrentProfile(): Promise<AppProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('app_profiles')
    .select('id,email,nome,cargo,role,permissions,active')
    .eq('id', user.id)
    .maybeSingle()
  return data as AppProfile | null
}

export function profileCan(profile: AppProfile | null, permission: string) {
  return Boolean(profile?.active && (profile.role === 'admin' || profile.permissions?.includes(permission)))
}
