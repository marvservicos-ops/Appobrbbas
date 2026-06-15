'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Wrench, BarChart2, Users, FileText, Settings, User, Package, Menu, X } from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/obras', label: 'Obras', icon: Wrench },
  { href: '/estoque', label: 'Estoque', icon: Package },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart2 },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/documentos', label: 'Documentos', icon: FileText },
]

const bottomItems = [
  { href: '/perfil', label: 'Perfil', icon: User },
  { href: '/configuracoes', label: 'Config', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const NavLink = ({ href, label, icon: Icon, onClick }: { href: string; label: string; icon: any; onClick?: () => void }) => {
    const active = pathname.startsWith(href)
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
      <aside className="hidden md:flex w-[220px] shrink-0 bg-[#F8FAFC] border-r border-[#E2E8F0] flex-col h-screen sticky top-0">
        <div className="px-6 py-5 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#4F7CFF] rounded-lg flex items-center justify-center">
              <Wrench size={16} className="text-white" />
            </div>
            <div>
              <div className="font-syne font-bold text-[14px] leading-tight text-[#0F172A]">MARV Gestão</div>
              <div className="text-[10px] text-[#64748B] uppercase tracking-wide">Mechanical Engineering</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => <NavLink key={item.href} {...item} />)}
        </nav>
        <div className="px-3 py-4 border-t border-[#E2E8F0] space-y-1">
          {bottomItems.map(item => <NavLink key={item.href} {...item} />)}
        </div>
      </aside>

      {/* ── Mobile top bar ───────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#4F7CFF] rounded-lg flex items-center justify-center">
            <Wrench size={14} className="text-white" />
          </div>
          <span className="font-syne font-bold text-[15px] text-[#0F172A]">MARV Gestão</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9]">
          <Menu size={20} className="text-[#64748B]" />
        </button>
      </div>

      {/* ── Mobile drawer overlay ────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          {/* Drawer */}
          <aside className="relative w-[260px] bg-white h-full flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#4F7CFF] rounded-lg flex items-center justify-center">
                  <Wrench size={16} className="text-white" />
                </div>
                <div>
                  <div className="font-syne font-bold text-[14px] leading-tight text-[#0F172A]">MARV Gestão</div>
                  <div className="text-[10px] text-[#64748B] uppercase tracking-wide">Mechanical Engineering</div>
                </div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9]">
                <X size={18} className="text-[#64748B]" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map(item => <NavLink key={item.href} {...item} onClick={() => setMobileOpen(false)} />)}
            </nav>
            <div className="px-3 py-4 border-t border-[#E2E8F0] space-y-1">
              {bottomItems.map(item => <NavLink key={item.href} {...item} onClick={() => setMobileOpen(false)} />)}
            </div>
          </aside>
        </div>
      )}

      {/* ── Mobile bottom nav ────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2E8F0] flex">
        {[...navItems, ...bottomItems].slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${active ? 'text-[#4F7CFF]' : 'text-[#94A3B8]'}`}>
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
