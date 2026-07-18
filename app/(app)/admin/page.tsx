'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Banknote, CircleDollarSign, Clock3, Loader2, ReceiptText, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Linha = {
  id: string; obra_id: string; percentual: number; valor_previsto: number
  valor_faturado?: number; valor_recebido?: number; status: string; data_vencimento?: string
  obra?: { id: string; titulo: string } | null
}

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

export default function AdminFinanceiroPage() {
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('obra_medicoes')
        .select('id,obra_id,percentual,valor_previsto,valor_faturado,valor_recebido,status,data_vencimento,obra:obras(id,titulo)')
        .neq('status', 'cancelada')
      setLinhas((data ?? []) as unknown as Linha[])
      setLoading(false)
    }
    load()
  }, [])

  const resumo = useMemo(() => {
    const previsto = linhas.reduce((s, x) => s + Number(x.valor_previsto || 0), 0)
    const faturado = linhas.reduce((s, x) => s + Number(x.valor_faturado || 0), 0)
    const recebido = linhas.reduce((s, x) => s + Number(x.valor_recebido || 0), 0)
    const vencidas = linhas.filter(x => x.status !== 'recebida' && x.data_vencimento && new Date(x.data_vencimento + 'T23:59:59') < new Date())
    return { previsto, faturado, recebido, aberto: Math.max(0, faturado - recebido), aFaturar: Math.max(0, previsto - faturado), vencidas }
  }, [linhas])

  const obras = useMemo(() => {
    const map = new Map<string, { obra: Linha['obra']; previsto: number; faturado: number; recebido: number; etapas: number }>()
    linhas.forEach(x => {
      const atual = map.get(x.obra_id) ?? { obra: x.obra, previsto: 0, faturado: 0, recebido: 0, etapas: 0 }
      atual.previsto += Number(x.valor_previsto || 0)
      atual.faturado += Number(x.valor_faturado || 0)
      atual.recebido += Number(x.valor_recebido || 0)
      atual.etapas += 1
      map.set(x.obra_id, atual)
    })
    return Array.from(map.entries())
  }, [linhas])

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-[#4F7CFF]" /></div>

  const cards = [
    { label: 'Planejado', value: resumo.previsto, icon: TrendingUp, tone: 'bg-slate-50 text-slate-700' },
    { label: 'Faturado', value: resumo.faturado, icon: ReceiptText, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Recebido', value: resumo.recebido, icon: CircleDollarSign, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Em aberto', value: resumo.aberto, icon: Clock3, tone: 'bg-amber-50 text-amber-700' },
  ]

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4F7CFF]">Visão administrativa</p>
        <h1 className="font-syne text-2xl md:text-3xl font-bold text-[#0F172A] mt-1">Controle financeiro</h1>
        <p className="text-sm text-[#64748B] mt-1">Medições, faturamento e recebimentos de todas as obras.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="card p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tone}`}><Icon size={17} /></div>
            <p className="text-xs text-[#64748B] mt-3">{label}</p>
            <p className="font-syne text-lg md:text-xl font-bold text-[#0F172A] mt-0.5">{moeda(value)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-syne font-semibold text-[#0F172A]">Obras com plano de medição</h2>
            <span className="text-xs text-[#64748B]">{obras.length} obras</span>
          </div>
          <div className="space-y-3">
            {obras.map(([id, item]) => {
              const progresso = item.previsto ? Math.min(100, item.faturado / item.previsto * 100) : 0
              return (
                <Link key={id} href={`/obras/${id}/pagamentos`} className="block p-4 rounded-xl border border-[#E2E8F0] hover:border-[#4F7CFF]/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="font-semibold text-sm text-[#0F172A] line-clamp-2">{item.obra?.titulo ?? 'Obra'}</p><p className="text-xs text-[#64748B] mt-1">{item.etapas} etapas</p></div>
                    <p className="font-semibold text-sm text-[#0F172A] shrink-0">{moeda(item.faturado)}</p>
                  </div>
                  <div className="h-2 bg-[#F1F5F9] rounded-full mt-3 overflow-hidden"><div className="h-full bg-[#4F7CFF] rounded-full" style={{ width: `${progresso}%` }} /></div>
                </Link>
              )
            })}
            {!obras.length && <p className="text-sm text-[#94A3B8] py-8 text-center">Nenhum plano de medição configurado.</p>}
          </div>
        </div>
        <div className="card">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Banknote size={19} /></div>
          <p className="text-xs text-[#64748B] mt-4">Ainda não faturado</p>
          <p className="font-syne text-2xl font-bold text-[#0F172A] mt-1">{moeda(resumo.aFaturar)}</p>
          <div className="border-t border-[#E2E8F0] mt-5 pt-4">
            <p className="text-xs text-[#64748B]">Etapas vencidas sem recebimento</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{resumo.vencidas.length}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
