'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Wrench, BarChart2, Users, FileText, Settings, User } from 'lucide-react'

const navItems = [
  { href: '/obras', label: 'Obras', icon: Wrench },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart2 },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/documentos', label: 'Documentos', icon: FileText },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[220px] shrink-0 bg-[#F8FAFC] border-r border-[#E2E8F0] flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#4F7CFF] rounded-lg flex items-center justify-center">
            <Wrench size={16} className="text-white" />
          </div>
          <div>
            <div className="font-syne font-700 text-[14px] leading-tight text-[#0F172A]">MARV Gestão</div>
            <div className="text-[10px] text-[#64748B] uppercase tracking-wide">Mechanical Engineering</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative group
                ${active
                  ? 'text-[#4F7CFF] bg-[#EEF2FF]'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
                }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#4F7CFF] rounded-r-full" />
              )}
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-[#E2E8F0] space-y-1">
        <Link
          href="/perfil"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
        >
          <User size={18} />
          Perfil
        </Link>
        <Link
          href="/configuracoes"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
        >
          <Settings size={18} />
          Configurações
        </Link>
      </div>
    </aside>
  )
}
