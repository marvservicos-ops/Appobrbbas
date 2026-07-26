'use client'

import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { ReceiptText, TrendingDown, ArrowLeft, TrendingUp, Loader2 } from 'lucide-react'
import ObraPagamentos from '@/components/ObraPagamentos'
import ObraCentroCustos from '@/components/ObraCentroCustos'
import { createClient } from '@/lib/supabase/client'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const pctFmt = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%'

type SubTab = 'medicoes' | 'centro-custos'

interface DRE {
  totalContrato: number
  totalFaturado: number
  totalRecebido: number
  totalCusto: number
  margem: number
  margemPct: number
}

function DreSummary({ obraId }: { obraId: string }) {
  const [dre, setDre] = useState<DRE | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const [{ data: meds }, { data: estReg }, { data: mats }, { data: alocs }] = await Promise.all([
        sb.from('obra_medicoes').select('status, valor_previsto').eq('obra_id', obraId),
        sb.from('estoque_registros').select('valor_total').eq('obra_id', obraId).eq('tipo', 'saida'),
        sb.from('obra_materiais').select('valor_total').eq('obra_id', obraId).eq('tipo_compra', 'interna'),
        sb.from('funcionario_alocacoes')
          .select('percentual, funcionarios:funcionario_id(custo_diario, salario_bruto, dias_mes)')
          .eq('obra_id', obraId).eq('tipo', 'obra'),
      ])

      const totalContrato = (meds ?? []).reduce((s: number, m: any) => s + (m.valor_previsto || 0), 0)
      const totalFaturado = (meds ?? []).filter((m: any) => ['faturada', 'recebida'].includes(m.status))
        .reduce((s: number, m: any) => s + (m.valor_previsto || 0), 0)
      const totalRecebido = (meds ?? []).filter((m: any) => m.status === 'recebida')
        .reduce((s: number, m: any) => s + (m.valor_previsto || 0), 0)

      const custoEstoque = (estReg ?? []).reduce((s: number, r: any) => s + (r.valor_total || 0), 0)
      const custoMateriais = (mats ?? []).reduce((s: number, m: any) => s + (m.valor_total || 0), 0)
      const custoMaoObra = (alocs ?? []).reduce((s: number, a: any) => {
        const f = a.funcionarios as any
        if (!f) return s
        const custoDia = f.custo_diario ?? (f.salario_bruto && f.dias_mes ? f.salario_bruto / f.dias_mes : 0)
        return s + ((a.percentual || 100) / 100) * custoDia
      }, 0)
      const totalCusto = custoEstoque + custoMateriais + custoMaoObra

      const margem = totalFaturado - totalCusto
      const margemPct = totalFaturado > 0 ? (margem / totalFaturado) * 100 : 0

      setDre({ totalContrato, totalFaturado, totalRecebido, totalCusto, margem, margemPct })
      setLoading(false)
    }
    load()
  }, [obraId])

  if (loading) return (
    <div className="px-4 md:px-6 py-3 border-b border-[#F1F5F9] flex justify-center">
      <Loader2 size={16} className="animate-spin text-[#94A3B8]" />
    </div>
  )
  if (!dre || dre.totalContrato === 0) return null

  const margemOk = dre.margemPct >= 20
  const margemWarn = dre.margemPct >= 0 && dre.margemPct < 20

  return (
    <div className="px-4 md:px-6 py-3 border-b border-[#F1F5F9] bg-[#FAFAFA]">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <p className="text-[10px] text-[#94A3B8] font-medium uppercase tracking-wide mb-0.5">Contrato total</p>
          <p className="text-sm font-bold text-[#0F172A]">{moeda(dre.totalContrato)}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#94A3B8] font-medium uppercase tracking-wide mb-0.5">Faturado</p>
          <p className="text-sm font-bold text-[#4F7CFF]">{moeda(dre.totalFaturado)}</p>
          <div className="h-1 bg-[#E2E8F0] rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-[#4F7CFF] rounded-full" style={{ width: `${Math.min(100, dre.totalContrato > 0 ? (dre.totalFaturado / dre.totalContrato) * 100 : 0)}%` }} />
          </div>
        </div>
        <div>
          <p className="text-[10px] text-[#94A3B8] font-medium uppercase tracking-wide mb-0.5">Custo real</p>
          <p className="text-sm font-bold text-[#EF4444]">{moeda(dre.totalCusto)}</p>
          <p className="text-[10px] text-[#94A3B8]">estoque + mat. + m.o.</p>
        </div>
        <div>
          <p className="text-[10px] text-[#94A3B8] font-medium uppercase tracking-wide mb-0.5">Margem bruta</p>
          <p className={`text-sm font-bold ${margemOk ? 'text-[#10B981]' : margemWarn ? 'text-amber-600' : 'text-red-600'}`}>
            {moeda(dre.margem)}
          </p>
          <p className={`text-[10px] font-medium ${margemOk ? 'text-[#10B981]' : margemWarn ? 'text-amber-600' : 'text-red-500'}`}>
            {pctFmt(dre.margemPct)} sobre faturado
          </p>
        </div>
      </div>
    </div>
  )
}

function FinanceiroContent() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const subTab = (searchParams.get('aba') ?? 'medicoes') as SubTab

  function setSubTab(t: SubTab) {
    router.replace(`/obras/${id}/financeiro?aba=${t}`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-navegação */}
      <div className="flex items-center gap-1 px-4 md:px-6 pt-4 pb-0 border-b border-[#E2E8F0] bg-white">
        <button onClick={() => router.push(`/obras/${id}`)}
          className="w-7 h-7 rounded-lg border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors mr-2 shrink-0 -mb-px">
          <ArrowLeft size={14} className="text-[#64748B]" />
        </button>
        {([
          { key: 'medicoes', label: 'Medições', icon: ReceiptText },
          { key: 'centro-custos', label: 'Centro de Custos', icon: TrendingDown },
        ] as { key: SubTab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
              subTab === key
                ? 'border-[#4F7CFF] text-[#4F7CFF]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* DRE resumo */}
      <DreSummary obraId={id} />

      {/* Conteúdo */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {subTab === 'medicoes' && <ObraPagamentos obraId={id} />}
        {subTab === 'centro-custos' && <ObraCentroCustos obraId={id} />}
      </div>
    </div>
  )
}

export default function ObraFinanceiroPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-[#4F7CFF] border-t-transparent rounded-full animate-spin" /></div>}>
      <FinanceiroContent />
    </Suspense>
  )
}
