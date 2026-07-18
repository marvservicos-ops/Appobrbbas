'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppProfile } from '@/lib/access'

export function useAccess() {
  const [profile, setProfile] = useState<AppProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (active) setLoading(false); return }
      const { data } = await supabase
        .from('app_profiles')
        .select('id,email,nome,cargo,role,permissions,active')
        .eq('id', user.id)
        .maybeSingle()
      if (active) {
        setProfile(data as AppProfile | null)
        setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  const isAdmin = profile?.active === true && profile.role === 'admin'
  const can = (permission: string) => Boolean(profile?.active && (isAdmin || profile.permissions?.includes(permission)))
  return { profile, loading, isAdmin, can }
}
