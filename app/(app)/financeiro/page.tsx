'use client'

import { useEffect, useState } from 'react'
import { DollarSign, Package, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

interface ProdutoCC {
  id: string
  nome: string
  quantidade_atual: number
  unidade: string
  preco_unitario: number
  valor_imobilizado: number
  estoque_id: string
}

interface EstoqueCC {
  id: string
  nome: string
  cor: string
  icone: string
  produtos: ProdutoCC[]
  total: number
  expanded: boolean
}

export default function FinanceiroPage() {
  const [estoques, setEstoques] = useState<EstoqueCC[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: estData }, { data: prodData }] = await Promise.all([
        supabase.from('estoques').select('id, nome, cor, icone').order('nome'),
        supabase.from('estoque_produtos')
          .select('id, estoque_id, nome, quantidade_atual, unidade, preco_unitario')
          .eq('ativo', true)
          .gt('quantidade_atual', 0)
          .not('preco_unitario', 'is', null)
          .order('nome'),
      ])

      const estoquesMap: Record<string, EstoqueCC> = {}
      for (const e of estData ?? []) {
        estoquesMap[e.id] = { ...e, produtos: [], total: 0, expanded: true }
      }
      for (const p of prodData ?? []) {
        const val = p.quantidade_atual * (p.preco_unitario || 0)
        const prod: ProdutoCC = {
          ...p,
          preco_unitario: p.preco_unitario || 0,
          valor_imobilizado: val,
        }
        if (estoquesMap[p.estoque_id]) {
          estoquesMap[p.estoque_id].produtos.push(prod)
          estoquesMap[p.estoque_id].total += val
        }
      }

      setEstoques(Object.values(estoquesMap).filter(e => e.produtos.length > 0))
      setLoading(false)
    }
    load()
  }, [])

  const totalGeral = estoques.reduce((sum, e) => sum + e.total, 0)
  const totalItens = estoques.reduce((sum, e) => sum + e.produtos.length, 0)

  function toggleEstoque(id: string) {
    setEstoques(list => list.map(e => e.id === id ? { ...e, expanded: !e.expanded } : e))
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="p-4 md:p-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-syne text-xl md:text-2xl font-bold text-[#0F172A]">Financeiro</h1>
            <p className="text-xs md:text-sm text-[#64748B] mt-0.5 hidden sm:block">Centro de custo e controles financeiros da empresa</p>
          </div>
        </div>

        {/* Cards resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="card p-4 border-l-4 border-l-[#4F7CFF]">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={14} className="text-[#4F7CFF]" />
              <p className="text-xs text-[#64748B] font-medium">Total Imobilizado</p>
            </div>
            <p className="font-syne font-bold text-2xl text-[#0F172A]">{moeda(totalGeral)}</p>
            <p className="text-xs text-[#94A3B8] mt-1">valor total em estoque</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package size={14} className="text-[#64748B]" />
              <p className="text-xs text-[#64748B] font-medium">Itens com Saldo</p>
            </div>
            <p className="font-syne font-bold text-2xl text-[#0F172A]">{totalItens}</p>
            <p className="text-xs text-[#94A3B8] mt-1">produtos com quantidade {'>'} 0</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown size={14} className="text-[#64748B]" />
              <p className="text-xs text-[#64748B] font-medium">Categorias de Estoque</p>
            </div>
            <p className="font-syne font-bold text-2xl text-[#0F172A]">{estoques.length}</p>
            <p className="text-xs text-[#94A3B8] mt-1">com itens valorizados</p>
          </div>
        </div>

        {/* Seção Centro de Custo Geral */}
        <div className="mb-2 flex items-center gap-2">
          <h2 className="font-syne font-semibold text-[#0F172A]">Centro de Custo Geral — Estoque</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-[#4F7CFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : estoques.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 text-center">
            <Package size={32} className="text-[#CBD5E1] mb-3" />
            <p className="text-sm font-medium text-[#374151]">Nenhum item valorizado</p>
            <p className="text-xs text-[#94A3B8] mt-1">Adicione preços aos produtos no estoque para ver o custo imobilizado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {estoques.map(e => (
              <div key={e.id} className="card p-0 overflow-hidden">
                {/* Header do estoque */}
                <button
                  onClick={() => toggleEstoque(e.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#F8FAFC] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: e.cor }}>
                      {e.nome[0]}
                    </div>
                    <div className="text-left">
                      <p className="font-syne font-semibold text-sm text-[#0F172A]">{e.nome}</p>
                      <p className="text-xs text-[#94A3B8]">{e.produtos.length} produto{e.produtos.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-syne font-bold text-[#4F7CFF]">{moeda(e.total)}</span>
                    {e.expanded ? <ChevronDown size={16} className="text-[#94A3B8]" /> : <ChevronRight size={16} className="text-[#94A3B8]" />}
                  </div>
                </button>

                {/* Produtos */}
                {e.expanded && (
                  <div className="border-t border-[#F1F5F9]">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#F8FAFC]">
                          <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2">Produto</th>
                          <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2 hidden sm:table-cell">Qtd</th>
                          <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2 hidden sm:table-cell">CMP</th>
                          <th className="text-right text-xs font-semibold text-[#64748B] px-4 py-2">Imobilizado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {e.produtos.map(p => (
                          <tr key={p.id} className="border-t border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                            <td className="px-4 py-2.5 text-sm text-[#374151]">{p.nome}</td>
                            <td className="px-4 py-2.5 text-sm text-[#64748B] hidden sm:table-cell">{p.quantidade_atual} {p.unidade}</td>
                            <td className="px-4 py-2.5 text-sm text-[#64748B] hidden sm:table-cell">{moeda(p.preco_unitario)}</td>
                            <td className="px-4 py-2.5 text-sm font-semibold text-[#0F172A] text-right">{moeda(p.valor_imobilizado)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}

            {/* Total geral */}
            <div className="card p-4 bg-[#F8FAFF] border-[#C7D2FE] flex items-center justify-between">
              <span className="font-syne font-semibold text-[#374151]">Total Geral Imobilizado</span>
              <span className="font-syne font-bold text-xl text-[#4F7CFF]">{moeda(totalGeral)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
