'use client'

import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { ReceiptText, TrendingDown, ArrowLeft, TrendingUp, Loader2 } from 'lucide-react'
import ObraPagamentos from '@/components/ObraPagamentos'
import ObraCentroCustos from '@/components/ObraCentroCustos'
import { createClient } from '@/lib/supabase/client'
import { carregarTotaisObra } from '@/lib/financeiroObra'
import { mensagemErro } from '@/lib/erros'

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
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true); setErro('')
      // Mesma regra de totais do Centro de Custos e das Medições
      const { totais, error } = await carregarTotaisObra(createClient(), obraId)
      if (error || !totais) {
        setErro(mensagemErro(error, 'Não foi possível carregar o resumo financeiro'))
        setDre(null)
        setLoading(false)
        return
      }
      const margem = totais.faturado - totais.custoTotal
      const margemPct = totais.faturado > 0 ? (margem / totais.faturado) * 100 : 0
      setDre({
        totalContrato: totais.contrato, totalFaturado: totais.faturado, totalRecebido: totais.recebido,
        totalCusto: totais.custoTotal, margem, margemPct,
      })
      setLoading(false)
    }
    load()
  }, [obraId, tentativa])

  if (loading) return (
    <div className="px-4 md:px-6 py-3 border-b border-[#F1F5F9] flex justify-center">
      <Loader2 size={16} className="animate-spin text-[#94A3B8]" />
    </div>
  )
  if (erro) return (
    <div className="px-4 md:px-6 py-2.5 border-b border-[#F1F5F9] bg-red-50 flex items-center justify-between gap-3">
      <p className="text-xs text-red-700">{erro}</p>
      <button onClick={() => setTentativa(t => t + 1)} className="text-xs font-semibold text-red-700 underline shrink-0">Tentar de novo</button>
    </div>
  )
  if (!dre || (dre.totalContrato === 0 && dre.totalFaturado === 0 && dre.totalCusto === 0)) return null

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
        <button onClick={() => router.push(`/obras/${id}`)} aria-label="Voltar para a obra" title="Voltar para a obra"
          className="w-9 h-9 rounded-lg border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors mr-2 shrink-0 -mb-px">
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
