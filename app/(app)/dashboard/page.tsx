'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import { useAccess } from '@/lib/useAccess'
import {
  Wrench, TrendingUp, AlertTriangle, Package,
  Calendar, ChevronRight, Loader2, Clock, Users,
  CheckCircle2, Circle,
} from 'lucide-react'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const dataBR = (v?: string) => v ? new Date(v + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

interface KPIs {
  obrasEmAndamento: number
  obrasAprovadas: number
  totalAFaturarMes: number
  medicoesVencendo: number
  estoquesCriticos: number
  funcionariosSemAlocacaoHoje: number
}

interface ObraAndamento {
  id: string
  titulo: string
  status: string
  engenheiro_responsavel?: string | null
  previsao_termino?: string | null
  totalMedicoes: number
  faturado: number
}

interface MedicaoVencendo {
  id: string
  obra_id: string
  obra_titulo: string
  nome: string
  data_prevista: string
  valor_previsto: number
  dias_atraso: number
}

interface ProdutoCritico {
  id: string
  nome: string
  estoque_nome: string
  quantidade_atual: number
  quantidade_minima: number
  unidade: string
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Em Andamento': { bg: '#EEF2FF', text: '#4F7CFF' },
  'Aprovada':     { bg: '#ECFDF5', text: '#10B981' },
  'Em Orçamento': { bg: '#FFFBEB', text: '#F59E0B' },
  'Concluída':    { bg: '#F1F5F9', text: '#64748B' },
}

export default function DashboardPage() {
  const router = useRouter()
  const { isAdmin } = useAccess()
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [obras, setObras] = useState<ObraAndamento[]>([])
  const [medicoes, setMedicoes] = useState<MedicaoVencendo[]>([])
  const [criticos, setCriticos] = useState<ProdutoCritico[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAdmin === undefined) return
    async function load() {
      const sb = createClient()
      const hoje = new Date()
      const hojeStr = hoje.toISOString().split('T')[0]
      const em7dias = new Date(hoje); em7dias.setDate(hoje.getDate() + 7)
      const em7Str = em7dias.toISOString().split('T')[0]
      const mesInicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
      const mesFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0]

      const adminQueries = isAdmin ? [
        sb.from('obra_medicoes').select('obra_id, status, valor_previsto')
          .gte('data_prevista', mesInicio).lte('data_prevista', mesFim).eq('status', 'planejada'),
        sb.from('obra_medicoes')
          .select('id, obra_id, nome, data_prevista, valor_previsto, obras:obra_id(titulo)')
          .eq('status', 'planejada').lte('data_prevista', em7Str).order('data_prevista'),
      ] : [Promise.resolve({ data: [] }), Promise.resolve({ data: [] })]

      const [
        { data: obrasData },
        { data: medicoesData },
        { data: medicoesVencendoData },
        { data: produtosData },
        { data: funcsData },
        { data: alocHojeData },
      ] = await Promise.all([
        sb.from('obras').select('id, titulo, status, engenheiro_responsavel, previsao_termino')
          .in('status', ['Em Andamento', 'Aprovada']).order('titulo'),
        adminQueries[0],
        adminQueries[1],
        sb.from('estoque_produtos').select('id, nome, quantidade_atual, quantidade_minima, unidade, estoque_id, estoques:estoque_id(nome)')
          .eq('ativo', true).not('quantidade_minima', 'is', null).gt('quantidade_minima', 0),
        sb.from('funcionarios').select('id').eq('ativo', true),
        sb.from('funcionario_alocacoes').select('funcionario_id').eq('data', hojeStr),
      ])

      // Obras em andamento com somatório de medições
      const obraIds = (obrasData ?? []).map(o => o.id)
      let medicoesObras: any[] = []
      if (obraIds.length > 0) {
        const { data } = await sb.from('obra_medicoes')
          .select('obra_id, status, valor_previsto').in('obra_id', obraIds)
        medicoesObras = data ?? []
      }

      const obrasFormatadas: ObraAndamento[] = (obrasData ?? []).map(o => {
        const meds = medicoesObras.filter(m => m.obra_id === o.id)
        const total = meds.reduce((s: number, m: any) => s + (m.valor_previsto || 0), 0)
        const fat = meds.filter((m: any) => ['faturada', 'recebida'].includes(m.status))
          .reduce((s: number, m: any) => s + (m.valor_previsto || 0), 0)
        return { id: o.id, titulo: o.titulo, status: o.status, engenheiro_responsavel: o.engenheiro_responsavel, previsao_termino: o.previsao_termino, totalMedicoes: total, faturado: fat }
      })

      // Medições vencendo/atrasadas
      const medicoesFormatadas: MedicaoVencendo[] = (medicoesVencendoData ?? []).map((m: any) => {
        const dPrev = new Date(m.data_prevista + 'T12:00:00')
        const diasAtraso = Math.floor((hoje.getTime() - dPrev.getTime()) / 86400000)
        return {
          id: m.id, obra_id: m.obra_id,
          obra_titulo: m.obras?.titulo ?? '—',
          nome: m.nome, data_prevista: m.data_prevista,
          valor_previsto: m.valor_previsto || 0,
          dias_atraso: diasAtraso,
        }
      }).sort((a, b) => b.dias_atraso - a.dias_atraso)

      // Estoque crítico
      const criticos: ProdutoCritico[] = (produtosData ?? [])
        .filter((p: any) => (p.quantidade_atual ?? 0) < (p.quantidade_minima ?? 0))
        .map((p: any) => ({
          id: p.id, nome: p.nome,
          estoque_nome: (p.estoques as any)?.nome ?? '—',
          quantidade_atual: p.quantidade_atual ?? 0,
          quantidade_minima: p.quantidade_minima ?? 0,
          unidade: p.unidade ?? '',
        }))

      // Funcionários sem alocação hoje (dia útil)
      const dow = hoje.getDay()
      const isDiaUtil = dow >= 1 && dow <= 5
      const alocadosHoje = new Set((alocHojeData ?? []).map((a: any) => a.funcionario_id))
      const semAlocacao = isDiaUtil ? (funcsData ?? []).filter(f => !alocadosHoje.has(f.id)).length : 0

      setKpis({
        obrasEmAndamento: (obrasData ?? []).filter(o => o.status === 'Em Andamento').length,
        obrasAprovadas: (obrasData ?? []).filter(o => o.status === 'Aprovada').length,
        totalAFaturarMes: (medicoesData ?? []).reduce((s: number, m: any) => s + (m.valor_previsto || 0), 0),
        medicoesVencendo: medicoesFormatadas.length,
        estoquesCriticos: criticos.length,
        funcionariosSemAlocacaoHoje: semAlocacao,
      })
      setObras(obrasFormatadas)
      setMedicoes(medicoesFormatadas)
      setCriticos(criticos)
      setLoading(false)
    }
    load()
  }, [isAdmin])

  if (loading) return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#4F7CFF]" />
      </div>
    </div>
  )

  const hoje = new Date()
  const diaSemana = hoje.toLocaleDateString('pt-BR', { weekday: 'long' })
  const dataHoje = hoje.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">

        {/* Saudação */}
        <div>
          <h1 className="font-syne font-bold text-xl md:text-2xl text-[#0F172A] capitalize">{diaSemana},</h1>
          <p className="text-sm text-[#64748B] capitalize">{dataHoje}</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/obras" className="bg-white border border-[#E2E8F0] rounded-2xl p-4 hover:border-[#4F7CFF] hover:shadow-sm transition-all group">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-[#EEF2FF] rounded-xl flex items-center justify-center">
                <Wrench size={15} className="text-[#4F7CFF]" />
              </div>
              <span className="text-xs text-[#64748B] font-medium">Em andamento</span>
            </div>
            <p className="text-3xl font-bold text-[#0F172A]">{kpis?.obrasEmAndamento ?? 0}</p>
            {(kpis?.obrasAprovadas ?? 0) > 0 && (
              <p className="text-xs text-[#94A3B8] mt-1">+{kpis?.obrasAprovadas} aprovadas</p>
            )}
          </Link>

          {isAdmin && (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-[#ECFDF5] rounded-xl flex items-center justify-center">
                  <TrendingUp size={15} className="text-[#10B981]" />
                </div>
                <span className="text-xs text-[#64748B] font-medium">A faturar este mês</span>
              </div>
              <p className="text-xl font-bold text-[#0F172A]">{moeda(kpis?.totalAFaturarMes ?? 0)}</p>
              <p className="text-xs text-[#94A3B8] mt-1">medições planejadas</p>
            </div>
          )}

          <Link href="/funcionarios/alocacao"
            className={`bg-white border rounded-2xl p-4 transition-all hover:shadow-sm ${(kpis?.funcionariosSemAlocacaoHoje ?? 0) > 0 ? 'border-amber-200 hover:border-amber-400' : 'border-[#E2E8F0] hover:border-[#4F7CFF]'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${(kpis?.funcionariosSemAlocacaoHoje ?? 0) > 0 ? 'bg-amber-50' : 'bg-[#F1F5F9]'}`}>
                <Users size={15} className={(kpis?.funcionariosSemAlocacaoHoje ?? 0) > 0 ? 'text-amber-500' : 'text-[#64748B]'} />
              </div>
              <span className="text-xs text-[#64748B] font-medium">Sem alocação hoje</span>
            </div>
            <p className={`text-3xl font-bold ${(kpis?.funcionariosSemAlocacaoHoje ?? 0) > 0 ? 'text-amber-600' : 'text-[#0F172A]'}`}>
              {kpis?.funcionariosSemAlocacaoHoje ?? 0}
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">funcionários</p>
          </Link>

          <div className={`bg-white border rounded-2xl p-4 ${(kpis?.estoquesCriticos ?? 0) > 0 ? 'border-red-200' : 'border-[#E2E8F0]'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${(kpis?.estoquesCriticos ?? 0) > 0 ? 'bg-red-50' : 'bg-[#F1F5F9]'}`}>
                <Package size={15} className={(kpis?.estoquesCriticos ?? 0) > 0 ? 'text-red-500' : 'text-[#64748B]'} />
              </div>
              <span className="text-xs text-[#64748B] font-medium">Estoque crítico</span>
            </div>
            <p className={`text-3xl font-bold ${(kpis?.estoquesCriticos ?? 0) > 0 ? 'text-red-600' : 'text-[#0F172A]'}`}>
              {kpis?.estoquesCriticos ?? 0}
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">produtos abaixo do mínimo</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Obras ativas */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
              <h2 className="font-syne font-semibold text-[#0F172A] text-sm">Obras ativas</h2>
              <Link href="/obras" className="text-xs text-[#4F7CFF] hover:underline font-medium flex items-center gap-1">
                Ver todas <ChevronRight size={13} />
              </Link>
            </div>
            <div className="divide-y divide-[#F8FAFC]">
              {obras.length === 0 && (
                <p className="text-sm text-[#94A3B8] text-center py-8">Nenhuma obra ativa.</p>
              )}
              {obras.map(o => {
                const pctFat = o.totalMedicoes > 0 ? (o.faturado / o.totalMedicoes) * 100 : 0
                const sc = STATUS_COLORS[o.status] ?? { bg: '#F1F5F9', text: '#64748B' }
                return (
                  <Link key={o.id} href={`/obras/${o.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F8FAFC] transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-[#0F172A] truncate">{o.titulo}</p>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: sc.bg, color: sc.text }}>{o.status}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {o.totalMedicoes > 0 && (
                          <div className="flex items-center gap-1.5 flex-1">
                            <div className="flex-1 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                              <div className="h-full bg-[#10B981] rounded-full transition-all"
                                style={{ width: `${Math.min(100, pctFat)}%` }} />
                            </div>
                            <span className="text-[10px] text-[#94A3B8] shrink-0">{Math.round(pctFat)}% fat.</span>
                          </div>
                        )}
                        {o.previsao_termino && (
                          <span className="text-[10px] text-[#94A3B8] flex items-center gap-0.5 shrink-0">
                            <Clock size={9} /> {dataBR(o.previsao_termino)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-[#CBD5E1] group-hover:text-[#4F7CFF] transition-colors shrink-0" />
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Medições vencendo / atrasadas — só admin */}
          {isAdmin && <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
              <h2 className="font-syne font-semibold text-[#0F172A] text-sm">Medições pendentes</h2>
              <span className="text-xs text-[#94A3B8]">próximos 7 dias</span>
            </div>
            <div className="divide-y divide-[#F8FAFC]">
              {medicoes.length === 0 && (
                <div className="flex items-center gap-3 px-5 py-8 justify-center">
                  <CheckCircle2 size={16} className="text-[#10B981]" />
                  <p className="text-sm text-[#94A3B8]">Nenhuma medição pendente.</p>
                </div>
              )}
              {medicoes.map(m => {
                const atrasada = m.dias_atraso > 0
                return (
                  <Link key={m.id} href={`/obras/${m.obra_id}/financeiro`}
                    className="flex items-start gap-3 px-5 py-3.5 hover:bg-[#F8FAFC] transition-colors group">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${atrasada ? 'bg-red-400' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F172A] truncate">{m.nome}</p>
                      <p className="text-xs text-[#64748B] truncate">{m.obra_titulo}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[#94A3B8]">
                          <Calendar size={9} className="inline mr-0.5" />{dataBR(m.data_prevista)}
                        </span>
                        {atrasada && (
                          <span className="text-[10px] font-semibold text-red-500">{m.dias_atraso}d atrasada</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-[#0F172A]">{moeda(m.valor_previsto)}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>}
        </div>

        {/* Estoque crítico */}
        {criticos.length > 0 && (
          <div className="bg-white border border-red-100 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-red-50">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-red-500" />
                <h2 className="font-syne font-semibold text-[#0F172A] text-sm">Estoque crítico</h2>
              </div>
              <Link href="/estoque" className="text-xs text-[#4F7CFF] hover:underline font-medium">Ver estoques</Link>
            </div>
            <div className="divide-y divide-[#FFF5F5] px-5">
              {criticos.map(p => (
                <div key={p.id} className="flex items-center gap-3 py-3">
                  <Circle size={8} className="text-red-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{p.nome}</p>
                    <p className="text-xs text-[#94A3B8]">{p.estoque_nome}</p>
                  </div>
                  <div className="text-right text-xs shrink-0">
                    <p className="font-bold text-red-600">{p.quantidade_atual} {p.unidade}</p>
                    <p className="text-[#94A3B8]">mín. {p.quantidade_minima}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
