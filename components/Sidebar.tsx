'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Wrench, BarChart2, Users, Settings, User, Package, Menu, X, ShieldCheck, DollarSign, StickyNote, LayoutDashboard, Thermometer, Leaf, CalendarDays } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAccess } from '@/lib/useAccess'

const navItemsBase = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/obras', label: 'Obras', icon: Wrench },
  { href: '/manutencoes', label: 'Manutenções', icon: Thermometer },
  { href: '/estoque', label: 'Estoque', icon: Package },
  { href: '/esg', label: 'ESG', icon: Leaf },
  { href: '/financeiro', label: 'Financeiro', icon: DollarSign, adminOnly: true },
  { href: '/administrativo', label: 'Administrativo', icon: BarChart2, adminOnly: true },
  { href: '/funcionarios', label: 'Funcionários', icon: Users, adminOnly: true },
  { href: '/funcionarios/alocacao', label: 'Alocação', icon: CalendarDays },
  { href: '/notas', label: 'Notas', icon: StickyNote },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart2 },
  { href: '/clientes', label: 'Clientes', icon: Users },
]

const bottomItems = [
  { href: '/perfil', label: 'Perfil', icon: User },
  { href: '/configuracoes', label: 'Config', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isAdmin } = useAccess()
  const navItems = navItemsBase.filter(item => !item.adminOnly || isAdmin)
  const accountItems = isAdmin
    ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck }, ...bottomItems]
    : bottomItems

  useEffect(() => {
    if (!mobileOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [mobileOpen])

  const NavLink = ({ href, label, icon: Icon, onClick }: { href: string; label: string; icon: any; onClick?: () => void }) => {
    const active = pathname === href || (pathname.startsWith(href + '/') && href !== '/funcionarios')
    return (
      <Link href={href} onClick={onClick}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative
          ${active ? 'text-[#4F7CFF] bg-[#EEF2FF]' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'}`}>
        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#4F7CFF] rounded-r-full" />}
        <Icon size={18} />
        {label}
      </Link>
    )
  }

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="hidden md:flex w-[220px] shrink-0 bg-[#F8FAFC] border-r border-[#E2E8F0] flex-col h-dvh sticky top-0">
        <div className="px-6 py-5 border-b border-[#E2E8F0]">
          <div className="flex flex-col gap-1">
            <img src="/marv-logo.png" alt="MARV" className="h-8 w-auto object-contain" />
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => <NavLink key={item.href} {...item} />)}
        </nav>
        <div className="px-3 py-4 border-t border-[#E2E8F0] space-y-1">
          {accountItems.map(item => <NavLink key={item.href} {...item} />)}
        </div>
      </aside>

      {/* ── Mobile top bar ───────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-[#E2E8F0] flex items-end justify-between px-4 pb-2 h-[calc(3.5rem+env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <img src="/marv-logo.png" alt="MARV" className="h-6 w-auto object-contain" />
        </div>
        <button type="button" aria-label="Abrir menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9]">
          <Menu size={20} className="text-[#64748B]" />
        </button>
      </div>

      {/* ── Mobile drawer overlay ────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          {/* Drawer */}
          <aside aria-label="Menu principal" className="relative w-[min(82vw,300px)] bg-white h-dvh flex flex-col shadow-2xl pt-[env(safe-area-inset-top)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <div className="flex flex-col gap-1">
                <img src="/marv-logo.png" alt="MARV" className="h-8 w-auto object-contain" />
              </div>
              <button type="button" aria-label="Fechar menu" autoFocus onClick={() => setMobileOpen(false)} className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9]">
                <X size={18} className="text-[#64748B]" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map(item => <NavLink key={item.href} {...item} onClick={() => setMobileOpen(false)} />)}
            </nav>
            <div className="px-3 py-4 border-t border-[#E2E8F0] space-y-1">
              {accountItems.map(item => <NavLink key={item.href} {...item} onClick={() => setMobileOpen(false)} />)}
            </div>
          </aside>
        </div>
      )}

      {/* ── Mobile bottom nav ────────────────────────────── */}
      <nav aria-label="Navegação principal" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-[#E2E8F0] flex pb-[env(safe-area-inset-bottom)]">
        {[...navItems, ...bottomItems].slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link key={href} href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 min-h-16 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${active ? 'text-[#4F7CFF]' : 'text-[#64748B]'}`}>
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
