'use client'

import { Search, Bell, ChevronDown, AlertTriangle, Calendar, Package, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface TopbarProps {
  searchPlaceholder?: string
  onSearch?: (q: string) => void
}

interface Notificacao {
  id: string
  tipo: 'medicao_atrasada' | 'estoque_critico'
  titulo: string
  subtitulo: string
  link: string
}

export default function Topbar({ searchPlaceholder = 'Buscar obra ou projeto...', onSearch }: TopbarProps) {
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [notifs, setNotifs] = useState<Notificacao[]>([])
  const [loadingNotif, setLoadingNotif] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function carregarNotificacoes() {
    if (notifs.length > 0 || loadingNotif) { setShowNotif(v => !v); return }
    setLoadingNotif(true)
    setShowNotif(true)
    const sb = createClient()
    const hoje = new Date().toISOString().split('T')[0]

    const [{ data: meds }, { data: prods }] = await Promise.all([
      sb.from('obra_medicoes').select('id, nome, data_prevista, obra_id, obras:obra_id(titulo)')
        .eq('status', 'planejada').lt('data_prevista', hoje).order('data_prevista').limit(10),
      sb.from('estoque_produtos').select('id, nome, quantidade_atual, quantidade_minima, estoque_id, estoques:estoque_id(id, nome)')
        .eq('ativo', true).not('quantidade_minima', 'is', null).gt('quantidade_minima', 0).limit(20),
    ])

    const lista: Notificacao[] = []

    for (const m of (meds ?? []) as any[]) {
      const d = new Date(m.data_prevista + 'T12:00:00')
      const dias = Math.floor((new Date().getTime() - d.getTime()) / 86400000)
      lista.push({
        id: `med-${m.id}`, tipo: 'medicao_atrasada',
        titulo: m.nome,
        subtitulo: `${m.obras?.titulo ?? 'Obra'} · ${dias}d atrasada`,
        link: `/obras/${m.obra_id}/financeiro`,
      })
    }

    for (const p of (prods ?? []) as any[]) {
      if ((p.quantidade_atual ?? 0) < (p.quantidade_minima ?? 0)) {
        lista.push({
          id: `est-${p.id}`, tipo: 'estoque_critico',
          titulo: p.nome,
          subtitulo: `Estoque ${(p.estoques as any)?.nome ?? ''} · ${p.quantidade_atual} restantes (mín. ${p.quantidade_minima})`,
          link: `/estoque/${(p.estoques as any)?.id ?? ''}`,
        })
      }
    }

    setNotifs(lista)
    setLoadingNotif(false)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="min-h-16 bg-white border-b border-[#E2E8F0] flex items-center px-4 md:px-6 gap-2 md:gap-4 sticky top-0 z-10">
      <div className="flex-1 max-w-md relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          onChange={e => onSearch?.(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#4F7CFF] transition-colors"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* Notificações */}
        <div ref={notifRef} className="relative">
          <button type="button" aria-label="Notificações"
            onClick={carregarNotificacoes}
            className="relative w-11 h-11 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] transition-colors">
            <Bell size={18} className="text-[#64748B]" />
            {notifs.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            )}
            {notifs.length === 0 && !loadingNotif && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#4F7CFF] rounded-full" />
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9]">
                <span className="text-sm font-semibold text-[#0F172A]">Alertas</span>
                <button onClick={() => setShowNotif(false)} className="text-[#94A3B8] hover:text-[#374151]"><X size={14} /></button>
              </div>
              {loadingNotif ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[#4F7CFF] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notifs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm font-medium text-[#374151]">Tudo em ordem</p>
                  <p className="text-xs text-[#94A3B8] mt-1">Nenhum alerta no momento.</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-[#F8FAFC]">
                  {notifs.map(n => (
                    <Link key={n.id} href={n.link} onClick={() => setShowNotif(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAFC] transition-colors">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${n.tipo === 'medicao_atrasada' ? 'bg-red-50' : 'bg-amber-50'}`}>
                        {n.tipo === 'medicao_atrasada'
                          ? <Calendar size={13} className="text-red-500" />
                          : <Package size={13} className="text-amber-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0F172A] truncate">{n.titulo}</p>
                        <p className="text-xs text-[#94A3B8] truncate">{n.subtitulo}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Avatar + menu */}
        <div className="relative">
          <button type="button" aria-label="Abrir menu do usuário" aria-expanded={showMenu}
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors">
            <div className="w-8 h-8 rounded-full bg-[#4F7CFF] text-white text-xs font-semibold flex items-center justify-center">
              MG
            </div>
            <ChevronDown size={14} className="text-[#64748B]" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#E2E8F0] rounded-lg shadow-lg py-1 z-50">
              <Link href="/perfil" onClick={() => setShowMenu(false)}
                className="block px-4 py-2 text-sm text-[#374151] hover:bg-[#F8FAFC] transition-colors">
                Meu perfil
              </Link>
              <Link href="/configuracoes" onClick={() => setShowMenu(false)}
                className="block px-4 py-2 text-sm text-[#374151] hover:bg-[#F8FAFC] transition-colors">
                Configurações
              </Link>
              <div className="border-t border-[#F1F5F9] mt-1 pt-1">
                <button onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-[#EF4444] hover:bg-[#FEF2F2] transition-colors">
                  Sair
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
