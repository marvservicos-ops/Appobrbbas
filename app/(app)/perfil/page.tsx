'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import { Settings, Loader2, ShieldCheck, User } from 'lucide-react'

export default function PerfilPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ nome: string; email: string; cargo: string; role: string } | null>(null)

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const { data: { user: authUser } } = await sb.auth.getUser()
      if (!authUser) return
      const { data: profile } = await sb.from('app_profiles').select('role').eq('id', authUser.id).maybeSingle()
      setUser({
        nome: authUser.user_metadata?.nome ?? authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? 'Usuário',
        email: authUser.email ?? '',
        cargo: authUser.user_metadata?.cargo ?? '',
        role: (profile as any)?.role ?? 'usuario',
      })
    }
    load()
  }, [])

  const initials = user?.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() ?? 'MG'

  return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="flex-1 overflow-auto p-4 md:p-8 max-w-lg mx-auto w-full">
        <h1 className="font-syne font-bold text-xl text-[#0F172A] mb-6">Meu Perfil</h1>

        {!user ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#4F7CFF]" /></div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-[#4F7CFF] text-white text-xl font-bold flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div>
                <h2 className="font-syne font-bold text-lg text-[#0F172A]">{user.nome}</h2>
                {user.cargo && <p className="text-sm text-[#64748B]">{user.cargo}</p>}
                <p className="text-sm text-[#94A3B8]">{user.email}</p>
              </div>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
              <div className="flex items-center gap-3 py-2">
                {user.role === 'admin' ? (
                  <ShieldCheck size={16} className="text-[#4F7CFF]" />
                ) : (
                  <User size={16} className="text-[#64748B]" />
                )}
                <div>
                  <p className="text-sm font-medium text-[#374151]">Nível de acesso</p>
                  <p className="text-xs text-[#94A3B8]">{user.role === 'admin' ? 'Administrador — acesso completo' : 'Usuário — acesso padrão'}</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => router.push('/configuracoes')}
              className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-[#E2E8F0] rounded-2xl text-sm font-medium text-[#374151] hover:bg-[#F8FAFC] hover:border-[#4F7CFF] hover:text-[#4F7CFF] transition-all">
              <Settings size={15} />
              Editar dados e configurações
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
