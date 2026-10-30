'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Wrench, Settings, Package, Menu, X, ShieldCheck, DollarSign, LayoutDashboard, Thermometer, Leaf, CalendarDays, HardHat, Building2, Receipt, ShieldPlus, Ellipsis, Truck, CalendarCheck, FileSignature } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAccess } from '@/lib/useAccess'

type NavItem = { href: string; label: string; icon: any; adminOnly?: boolean; permissao?: string }

// Menu agrupado pelo uso do dia a dia. Notas fica só no botão flutuante e
// Perfil no menu do avatar (Topbar).
const secoesBase: { titulo: string; itens: NavItem[] }[] = [
  {
    titulo: 'Operação',
    itens: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/obras', label: 'Obras', icon: Wrench },
      { href: '/manutencoes', label: 'Manutenções', icon: Thermometer },
      { href: '/funcionarios/alocacao', label: 'Alocação', icon: CalendarDays },
      { href: '/estoque', label: 'Estoque', icon: Package },
    ],
  },
  {
    titulo: 'Cadastros',
    itens: [
      { href: '/funcionarios', label: 'Funcionários', icon: HardHat, adminOnly: true },
      { href: '/funcionarios/documentos', label: 'Documentos RH', icon: FileSignature, adminOnly: true },
      { href: '/clientes', label: 'Clientes', icon: Building2 },
      { href: '/fornecedores', label: 'Fornecedores', icon: Truck },
    ],
  },
  {
    titulo: 'Segurança e ESG',
    itens: [
      { href: '/documentos', label: 'PT / APR', icon: ShieldPlus },
      { href: '/esg', label: 'ESG', icon: Leaf },
    ],
  },
  {
    titulo: 'Gestão',
    itens: [
      { href: '/financeiro', label: 'Financeiro', icon: DollarSign, adminOnly: true },
      { href: '/contas-pagar', label: 'Contas a pagar', icon: CalendarCheck, permissao: 'contas_pagar' },
      { href: '/administrativo', label: 'Custos da empresa', icon: Receipt, adminOnly: true },
    ],
  },
]

// Barra inferior do celular: as telas mais usadas + "Mais" (abre o menu completo)
const barraCelular = ['/dashboard', '/obras', '/funcionarios/alocacao', '/estoque']

const contaItens: NavItem[] = [
  { href: '/configuracoes', label: 'Config', icon: Settings },
]

// /funcionarios não fica ativo dentro de /funcionarios/alocacao
const estaAtivo = (pathname: string, href: string) =>
  pathname === href || (pathname.startsWith(href + '/') && href !== '/funcionarios')

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isAdmin, can } = useAccess()
  const secoes = secoesBase
    .map(s => ({ ...s, itens: s.itens.filter(i => (!i.adminOnly || isAdmin) && (!i.permissao || can(i.permissao))) }))
    .filter(s => s.itens.length > 0)
  const accountItems = isAdmin
    ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck }, ...contaItens]
    : contaItens
  const todosItens = secoesBase.flatMap(s => s.itens)
  const itensBarra = barraCelular.map(href => todosItens.find(i => i.href === href)!)
  const maisAtivo = !itensBarra.some(i => estaAtivo(pathname, i.href))

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
    const active = estaAtivo(pathname, href)
    return (
      <Link href={href} onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative
          ${active ? 'text-[#4F7CFF] bg-[#EEF2FF]' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'}`}>
        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#4F7CFF] rounded-r-full" />}
        <Icon size={18} />
        {label}
      </Link>
    )
  }

  const Secoes = ({ onClick }: { onClick?: () => void }) => (
    <>
      {secoes.map((s, i) => (
        <div key={s.titulo} className={i > 0 ? 'mt-4' : ''}>
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">{s.titulo}</p>
          <div className="space-y-0.5">
            {s.itens.map(item => <NavLink key={item.href} {...item} onClick={onClick} />)}
          </div>
        </div>
      ))}
    </>
  )

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="hidden md:flex w-[220px] shrink-0 bg-[#F8FAFC] border-r border-[#E2E8F0] flex-col h-dvh sticky top-0">
        <div className="px-6 py-5 border-b border-[#E2E8F0]">
          <div className="flex flex-col gap-1">
            <img src="/marv-logo.png" alt="MARV" className="h-8 w-auto object-contain" />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <Secoes />
        </nav>
        <div className="px-3 py-3 border-t border-[#E2E8F0] space-y-0.5">
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
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <Secoes onClick={() => setMobileOpen(false)} />
            </nav>
            <div className="px-3 py-3 border-t border-[#E2E8F0] space-y-0.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              {accountItems.map(item => <NavLink key={item.href} {...item} onClick={() => setMobileOpen(false)} />)}
            </div>
          </aside>
        </div>
      )}

      {/* ── Mobile bottom nav ────────────────────────────── */}
      <nav aria-label="Navegação principal" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-[#E2E8F0] flex pb-[env(safe-area-inset-bottom)]">
        {itensBarra.map(({ href, label, icon: Icon }) => {
          const active = estaAtivo(pathname, href)
          return (
            <Link key={href} href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 min-h-16 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${active ? 'text-[#4F7CFF]' : 'text-[#64748B]'}`}>
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Mais opções do menu" aria-expanded={mobileOpen}
          className={`flex-1 min-h-16 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${maisAtivo ? 'text-[#4F7CFF]' : 'text-[#64748B]'}`}>
          <Ellipsis size={20} />
          <span className="text-[10px] font-medium">Mais</span>
        </button>
      </nav>
    </>
  )
}
