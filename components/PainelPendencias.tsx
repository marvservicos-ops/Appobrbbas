'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { calcularPendencias, type Pendencia, type Grupo, type IconePendencia } from '@/lib/pendencias'
import {
  Users, FileText, Send, DollarSign, Package, CalendarClock, Thermometer,
  CheckCircle2, ChevronRight, Loader2, ClipboardCheck, Clock,
} from 'lucide-react'

// Painel que lista o que ficou sem lançar ou sem conferir — a regra fica em
// lib/pendencias.ts (compartilhada com o e-mail diário).

const ICONES: Record<IconePendencia, any> = {
  alocacao: Users, rdo: FileText, email: Send, financeiro: DollarSign,
  material: Package, cronograma: CalendarClock, manutencao: Thermometer, prazo: Clock,
}

export default function PainelPendencias() {
  const [pendencias, setPendencias] = useState<Pendencia[] | null>(null)

  useEffect(() => {
    async function load() {
      setPendencias(await calcularPendencias(createClient(), new Date()))
    }
    load()
  }, [])

  if (pendencias === null) return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 flex items-center gap-2 text-sm text-[#94A3B8]">
      <Loader2 size={15} className="animate-spin" /> Verificando pendências…
    </div>
  )

  if (pendencias.length === 0) return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
      <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-emerald-800">Tudo em dia</p>
        <p className="text-xs text-emerald-700">Nenhum lançamento ou conferência pendente.</p>
      </div>
    </div>
  )

  const grupos: { key: Grupo; titulo: string; sub: string }[] = [
    { key: 'lancar', titulo: 'Falta lançar', sub: 'coisas que aconteceram e não estão no sistema' },
    { key: 'conferir', titulo: 'Falta conferir', sub: 'dados que provavelmente estão desatualizados' },
  ]

  return (
    <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-amber-100 bg-amber-50/60">
        <ClipboardCheck size={16} className="text-amber-600" />
        <h2 className="font-syne font-semibold text-[#0F172A] text-sm">Pendências</h2>
        <span className="text-[11px] font-bold bg-amber-500 text-white rounded-full px-2 py-0.5">{pendencias.length}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x divide-[#F1F5F9]">
        {grupos.map(g => {
          const itens = pendencias.filter(p => p.grupo === g.key)
          return (
            <div key={g.key}>
              <div className="px-5 pt-4 pb-2">
                <p className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide">{g.titulo} <span className="text-[#94A3B8]">({itens.length})</span></p>
                <p className="text-[11px] text-[#94A3B8]">{g.sub}</p>
              </div>
              {itens.length === 0 && (
                <p className="px-5 pb-4 text-xs text-emerald-600 flex items-center gap-1.5"><CheckCircle2 size={13} /> Nada pendente</p>
              )}
              <div className="divide-y divide-[#F8FAFC]">
                {itens.map(p => {
                  const Icone = ICONES[p.icone]
                  const alta = p.gravidade === 'alta'
                  return (
                    <Link key={p.id} href={p.href} className="flex items-start gap-3 px-5 py-3 hover:bg-[#F8FAFC] transition-colors group">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${alta ? 'bg-red-50' : 'bg-amber-50'}`}>
                        <Icone size={14} className={alta ? 'text-red-500' : 'text-amber-500'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0F172A]">{p.titulo}</p>
                        {p.detalhe && <p className="text-xs text-[#64748B] mt-0.5">{p.detalhe}</p>}
                      </div>
                      <ChevronRight size={14} className="text-[#CBD5E1] group-hover:text-[#4F7CFF] mt-1.5 shrink-0" />
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
