'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, ShieldCheck, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { AppProfile, AppRole } from '@/lib/access'

const PERMISSOES = [{ id: 'financeiro', label: 'Financeiro e medições' }]

export default function AdminUsuariosPage() {
  const [profiles, setProfiles] = useState<AppProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('app_profiles').select('*').order('email')
    setProfiles((data ?? []) as AppProfile[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function update(profile: AppProfile, changes: Partial<AppProfile>) {
    setSaving(profile.id)
    const next = { ...profile, ...changes }
    const supabase = createClient()
    const { error } = await supabase.from('app_profiles').update({ role: next.role, permissions: next.permissions, active: next.active }).eq('id', profile.id)
    if (!error) setProfiles(list => list.map(p => p.id === profile.id ? next : p))
    else alert(error.message)
    setSaving(null)
  }

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-[#4F7CFF]" /></div>

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4F7CFF]">Acesso</p>
        <h1 className="font-syne text-2xl md:text-3xl font-bold text-[#0F172A] mt-1">Usuários e permissões</h1>
        <p className="text-sm text-[#64748B] mt-1">Defina quem pode acessar informações financeiras.</p>
      </div>
      <div className="space-y-3">
        {profiles.map(profile => (
          <div key={profile.id} className="card">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${profile.role === 'admin' ? 'bg-violet-50 text-violet-600' : 'bg-slate-100 text-slate-600'}`}>
                {profile.role === 'admin' ? <ShieldCheck size={20} /> : <UserRound size={20} />}
              </div>
              <div className="min-w-0 md:w-64">
                <p className="font-semibold text-sm text-[#0F172A] truncate">{profile.nome || profile.email}</p>
                <p className="text-xs text-[#64748B] truncate">{profile.email}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                <label className="text-xs text-[#64748B]">Perfil
                  <select disabled={profile.email.toLowerCase() === 'joaovictor@marvservicos.com.br'} value={profile.role} onChange={e => update(profile, { role: e.target.value as AppRole })} className="field mt-1 disabled:bg-[#F1F5F9] disabled:text-[#64748B]">
                    <option value="usuario">Usuário</option><option value="admin">Administrador</option>
                  </select>
                </label>
                <div className="text-xs text-[#64748B]">Permissões
                  <div className="mt-1 min-h-11 flex items-center gap-2">
                    {PERMISSOES.map(p => {
                      const checked = profile.role === 'admin' || profile.permissions.includes(p.id)
                      return <label key={p.id} className="flex items-center gap-2 text-sm text-[#374151]"><input type="checkbox" checked={checked} disabled={profile.role === 'admin'} onChange={() => update(profile, { permissions: checked ? profile.permissions.filter(x => x !== p.id) : [...profile.permissions, p.id] })} className="w-4 h-4 accent-[#4F7CFF]" />{p.label}</label>
                    })}
                  </div>
                </div>
                <div className="text-xs text-[#64748B]">Situação
                  <button disabled={profile.email.toLowerCase() === 'joaovictor@marvservicos.com.br'} onClick={() => update(profile, { active: !profile.active })} className={`mt-1 min-h-11 w-full rounded-lg border text-sm font-semibold disabled:opacity-60 ${profile.active ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                    {profile.active ? 'Ativo' : 'Bloqueado'}
                  </button>
                </div>
              </div>
              <div className="w-6 shrink-0">{saving === profile.id && <Loader2 size={17} className="animate-spin text-[#4F7CFF]" />}{saving !== profile.id && <Check size={16} className="text-emerald-500" />}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
