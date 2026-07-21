'use client'

import { useEffect, useState } from 'react'
import { Package, TrendingDown, TrendingUp, Scale } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const dataBR = (v?: string) => v ? new Date(v).toLocaleDateString('pt-BR') : '—'

interface Registro {
  id: string
  produto_nome: string
  quantidade: number
  unidade?: string
  preco_unitario_custo?: number | null
  valor_total?: number | null
  data: string
  responsavel: string
  tipo: 'entrada' | 'saida'
  estoque_nome?: string
}

export default function ObraCentroCustos({ obraId }: { obraId: string }) {
  const [saidas, setSaidas] = useState<Registro[]>([])
  const [devolucoes, setDevolucoes] = useState<Registro[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('estoque_registros')
        .select('*, estoque:estoques(nome)')
        .eq('obra_id', obraId)
        .order('data', { ascending: false })

      if (data) {
        const mapped = data.map((r: any) => ({
          ...r,
          estoque_nome: r.estoque?.nome,
        }))
        setSaidas(mapped.filter((r: Registro) => r.tipo === 'saida'))
        setDevolucoes(mapped.filter((r: Registro) => r.tipo === 'entrada'))
      }
      setLoading(false)
    }
    load()
  }, [obraId])

  const totalSaidas = saidas.reduce((sum, r) => sum + (r.valor_total || 0), 0)
  const totalDevolucoes = devolucoes.reduce((sum, r) => sum + (r.valor_total || 0), 0)
  const custoLiquido = totalSaidas - totalDevolucoes

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[#4F7CFF] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 border-l-4 border-l-red-400">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={14} className="text-red-400" />
            <p className="text-xs text-[#64748B] font-medium">Total Consumido</p>
          </div>
          <p className="font-syne font-bold text-2xl text-[#0F172A]">{moeda(totalSaidas)}</p>
          <p className="text-xs text-[#94A3B8] mt-1">{saidas.length} saídas de material</p>
        </div>
        <div className="card p-4 border-l-4 border-l-green-400">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-green-500" />
            <p className="text-xs text-[#64748B] font-medium">Total Devolvido</p>
          </div>
          <p className="font-syne font-bold text-2xl text-green-600">{moeda(totalDevolucoes)}</p>
          <p className="text-xs text-[#94A3B8] mt-1">{devolucoes.length} devoluções ao estoque</p>
        </div>
        <div className="card p-4 border-l-4 border-l-[#4F7CFF]">
          <div className="flex items-center gap-2 mb-1">
            <Scale size={14} className="text-[#4F7CFF]" />
            <p className="text-xs text-[#64748B] font-medium">Custo Líquido</p>
          </div>
          <p className="font-syne font-bold text-2xl text-[#0F172A]">{moeda(custoLiquido)}</p>
          <p className="text-xs text-[#94A3B8] mt-1">consumido − devolvido</p>
        </div>
      </div>

      {/* Tabela de saídas */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center gap-2">
          <TrendingDown size={15} className="text-red-400" />
          <h2 className="font-syne font-semibold text-sm text-[#0F172A]">Materiais Consumidos</h2>
        </div>

        {saidas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package size={20} className="text-[#CBD5E1] mb-2" />
            <p className="text-sm font-medium text-[#374151]">Nenhum material registrado</p>
            <p className="text-xs text-[#94A3B8] mt-1">As saídas vinculadas a esta obra aparecerão aqui.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Material</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden sm:table-cell">Estoque</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Qtd</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Custo Unit.</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Total</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden md:table-cell">Data</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden md:table-cell">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {saidas.map(r => (
                  <tr key={r.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-[#0F172A]">{r.produto_nome}</td>
                    <td className="px-4 py-3 text-sm text-[#64748B] hidden sm:table-cell">{r.estoque_nome ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#374151]">{r.quantidade} {r.unidade ?? ''}</td>
                    <td className="px-4 py-3 text-sm text-[#374151]">{r.preco_unitario_custo ? moeda(r.preco_unitario_custo) : '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-red-600">{r.valor_total ? moeda(r.valor_total) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#64748B] hidden md:table-cell">{dataBR(r.data)}</td>
                    <td className="px-4 py-3 text-sm text-[#64748B] hidden md:table-cell">{r.responsavel}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#F8FAFC] border-t-2 border-[#E2E8F0]">
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-[#374151]">Subtotal saídas</td>
                  <td className="px-4 py-3 text-sm font-bold text-red-700">{moeda(totalSaidas)}</td>
                  <td colSpan={2} className="hidden md:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Tabela de devoluções */}
      {devolucoes.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center gap-2">
            <TrendingUp size={15} className="text-green-500" />
            <h2 className="font-syne font-semibold text-sm text-[#0F172A]">Devoluções ao Estoque</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F0FDF4]">
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Material</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden sm:table-cell">Estoque</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Qtd</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Custo Unit.</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Crédito</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden md:table-cell">Data</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden md:table-cell">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {devolucoes.map(r => (
                  <tr key={r.id} className="border-b border-[#F1F5F9] hover:bg-[#F0FDF4] transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-[#0F172A]">{r.produto_nome}</td>
                    <td className="px-4 py-3 text-sm text-[#64748B] hidden sm:table-cell">{r.estoque_nome ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#374151]">{r.quantidade} {r.unidade ?? ''}</td>
                    <td className="px-4 py-3 text-sm text-[#374151]">{r.preco_unitario_custo ? moeda(r.preco_unitario_custo) : '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-green-600">−{r.valor_total ? moeda(r.valor_total) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#64748B] hidden md:table-cell">{dataBR(r.data)}</td>
                    <td className="px-4 py-3 text-sm text-[#64748B] hidden md:table-cell">{r.responsavel}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#F0FDF4] border-t-2 border-[#BBF7D0]">
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-[#374151]">Subtotal devoluções</td>
                  <td className="px-4 py-3 text-sm font-bold text-green-700">−{moeda(totalDevolucoes)}</td>
                  <td colSpan={2} className="hidden md:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Balanço final */}
      {(saidas.length > 0 || devolucoes.length > 0) && (
        <div className="card p-4 flex items-center justify-between bg-[#F8FAFF] border-[#C7D2FE]">
          <div className="flex items-center gap-2">
            <Scale size={16} className="text-[#4F7CFF]" />
            <span className="font-syne font-semibold text-[#374151]">Custo Líquido da Obra</span>
          </div>
          <span className="font-syne font-bold text-xl text-[#4F7CFF]">{moeda(custoLiquido)}</span>
        </div>
      )}
    </div>
  )
}
