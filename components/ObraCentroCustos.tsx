'use client'

import { useEffect, useState } from 'react'
import { Package, TrendingDown } from 'lucide-react'
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
  const [registros, setRegistros] = useState<Registro[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('estoque_registros')
        .select('*, estoque:estoques(nome)')
        .eq('obra_id', obraId)
        .eq('tipo', 'saida')
        .order('data', { ascending: false })

      if (data) {
        setRegistros(data.map((r: any) => ({
          ...r,
          estoque_nome: r.estoque?.nome,
        })))
      }
      setLoading(false)
    }
    load()
  }, [obraId])

  const totalCusto = registros.reduce((sum, r) => sum + (r.valor_total || 0), 0)
  const totalItens = registros.reduce((sum, r) => sum + r.quantidade, 0)

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[#4F7CFF] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-[#64748B] mb-1">Total de Materiais</p>
          <p className="font-syne font-bold text-2xl text-[#0F172A]">{moeda(totalCusto)}</p>
          <p className="text-xs text-[#94A3B8] mt-1">{registros.length} registros de saída</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[#64748B] mb-1">Itens Consumidos</p>
          <p className="font-syne font-bold text-2xl text-[#0F172A]">{totalItens.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-[#94A3B8] mt-1">unidades no total</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[#64748B] mb-1">Categorias</p>
          <p className="font-syne font-bold text-2xl text-[#0F172A]">
            {new Set(registros.map(r => r.estoque_nome).filter(Boolean)).size}
          </p>
          <p className="text-xs text-[#94A3B8] mt-1">tipos de estoque</p>
        </div>
      </div>

      {/* Tabela de registros */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center gap-2">
          <TrendingDown size={15} className="text-red-400" />
          <h2 className="font-syne font-semibold text-sm text-[#0F172A]">Materiais Consumidos</h2>
        </div>

        {registros.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-3">
              <Package size={20} className="text-[#CBD5E1]" />
            </div>
            <p className="text-sm font-medium text-[#374151]">Nenhum material registrado</p>
            <p className="text-xs text-[#94A3B8] mt-1">As saídas de estoque vinculadas a esta obra aparecerão aqui.</p>
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
                {registros.map(r => (
                  <tr key={r.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-[#0F172A]">{r.produto_nome}</td>
                    <td className="px-4 py-3 text-sm text-[#64748B] hidden sm:table-cell">{r.estoque_nome ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#374151]">{r.quantidade} {r.unidade ?? ''}</td>
                    <td className="px-4 py-3 text-sm text-[#374151]">
                      {r.preco_unitario_custo ? moeda(r.preco_unitario_custo) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-red-600">
                      {r.valor_total ? moeda(r.valor_total) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#64748B] hidden md:table-cell">{dataBR(r.data)}</td>
                    <td className="px-4 py-3 text-sm text-[#64748B] hidden md:table-cell">{r.responsavel}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#F8FAFC] border-t-2 border-[#E2E8F0]">
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-[#374151]">Total</td>
                  <td className="px-4 py-3 text-sm font-bold text-red-700">{moeda(totalCusto)}</td>
                  <td colSpan={2} className="hidden md:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
