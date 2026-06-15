'use client'

import { useEffect, useState } from 'react'
import { Package, AlertTriangle, TrendingDown, TrendingUp, ArrowUpCircle, ArrowDownCircle, RefreshCw, Plus, Search, Filter } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EstoqueItem, EstoqueMovimentacao } from '@/lib/types'
import Topbar from '@/components/Topbar'
import Link from 'next/link'

function nivelEstoque(item: EstoqueItem): 'critico' | 'baixo' | 'ok' {
  if (item.quantidade_atual <= 0) return 'critico'
  if (item.quantidade_atual <= item.quantidade_minima) return 'baixo'
  return 'ok'
}

function formatCurrency(v?: number | null) {
  if (!v) return null
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function EstoquePage() {
  const [itens, setItens] = useState<EstoqueItem[]>([])
  const [movs, setMovs] = useState<EstoqueMovimentacao[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const [itensRes, movsRes] = await Promise.all([
      supabase.from('estoque_itens').select('*, categoria:estoque_categorias(*)').eq('ativo', true).order('nome'),
      supabase.from('estoque_movimentacoes').select('*, item:estoque_itens(nome, unidade)').order('created_at', { ascending: false }).limit(10),
    ])
    if (itensRes.data) setItens(itensRes.data as EstoqueItem[])
    if (movsRes.data) setMovs(movsRes.data as EstoqueMovimentacao[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const criticos = itens.filter(i => nivelEstoque(i) === 'critico')
  const baixos = itens.filter(i => nivelEstoque(i) === 'baixo')
  const pendentesDevolucao = movs.filter(m => m.status === 'pendente_devolucao')
  const filtered = itens.filter(i => i.nome.toLowerCase().includes(search.toLowerCase()))

  const valorTotal = itens.reduce((s, i) => s + (i.quantidade_atual * (i.preco_unitario || 0)), 0)

  return (
    <div className="flex flex-col h-full">
      <Topbar searchPlaceholder="Buscar item no estoque..." onSearch={setSearch} />

      <div className="p-6 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-syne text-2xl font-bold text-[#0F172A]">Controle de Estoque</h1>
            <p className="text-sm text-[#64748B] mt-0.5">Gerencie materiais, EPIs, ferramentas e equipamentos</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/estoque/movimentacao?tipo=saida" className="btn-secondary">
              <ArrowDownCircle size={16} className="text-red-500" />
              Saída
            </Link>
            <Link href="/estoque/movimentacao?tipo=entrada" className="btn-secondary">
              <ArrowUpCircle size={16} className="text-emerald-500" />
              Entrada
            </Link>
            <Link href="/estoque/itens/novo" className="btn-primary">
              <Plus size={16} />
              Novo Item
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#64748B]">Total de Itens</span>
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Package size={16} className="text-[#4F7CFF]" />
              </div>
            </div>
            <div className="font-syne text-3xl font-bold text-[#0F172A]">{itens.length}</div>
            <div className="text-xs text-[#64748B] mt-1">{itens.filter(i => i.ativo).length} ativos</div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#64748B]">Estoque Crítico</span>
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                <AlertTriangle size={16} className="text-red-500" />
              </div>
            </div>
            <div className="font-syne text-3xl font-bold text-red-500">{criticos.length + baixos.length}</div>
            <div className="text-xs text-red-500 mt-1">{criticos.length} zerados · {baixos.length} abaixo do mínimo</div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#64748B]">Devoluções Pendentes</span>
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                <RefreshCw size={16} className="text-amber-500" />
              </div>
            </div>
            <div className="font-syne text-3xl font-bold text-amber-500">{pendentesDevolucao.length}</div>
            <div className="text-xs text-amber-500 mt-1">ferramentas/materiais fora</div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#64748B]">Valor em Estoque</span>
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                <TrendingUp size={16} className="text-emerald-500" />
              </div>
            </div>
            <div className="font-syne text-2xl font-bold text-emerald-600">
              {valorTotal > 0 ? formatCurrency(valorTotal) : '—'}
            </div>
            <div className="text-xs text-[#64748B] mt-1">custo estimado total</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Lista de itens */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-syne font-semibold text-[#0F172A]">Itens em Estoque</h2>
              <Link href="/estoque/itens" className="text-sm text-[#4F7CFF] hover:underline">Ver todos →</Link>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <div key={i} className="card h-16 animate-pulse bg-[#F1F5F9]" />)}
              </div>
            ) : (
              <div className="card p-0 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Item</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Categoria</th>
                      <th className="text-right text-xs font-semibold text-[#64748B] px-4 py-3">Quantidade</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 15).map(item => {
                      const nivel = nivelEstoque(item)
                      const cat = item.categoria as any
                      return (
                        <tr key={item.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/estoque/itens/${item.id}`} className="flex items-center gap-3 group">
                              {item.foto_url ? (
                                <img src={item.foto_url} alt={item.nome} className="w-8 h-8 rounded-lg object-cover border border-[#E2E8F0]" />
                              ) : (
                                <div className="w-8 h-8 bg-[#F1F5F9] rounded-lg flex items-center justify-center">
                                  <Package size={14} className="text-[#94A3B8]" />
                                </div>
                              )}
                              <div>
                                <div className="text-sm font-medium text-[#0F172A] group-hover:text-[#4F7CFF]">{item.nome}</div>
                                {item.localizacao && <div className="text-xs text-[#94A3B8]">{item.localizacao}</div>}
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            {cat && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: cat.cor + '20', color: cat.cor }}>
                                {cat.nome}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-semibold text-sm ${nivel === 'critico' ? 'text-red-500' : nivel === 'baixo' ? 'text-amber-500' : 'text-[#0F172A]'}`}>
                              {item.quantidade_atual} {item.unidade}
                            </span>
                            <div className="text-xs text-[#94A3B8]">mín: {item.quantidade_minima}</div>
                          </td>
                          <td className="px-4 py-3">
                            {nivel === 'critico' && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" /> Zerado
                              </span>
                            )}
                            {nivel === 'baixo' && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> Baixo
                              </span>
                            )}
                            {nivel === 'ok' && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> OK
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-10 text-sm text-[#94A3B8]">
                        Nenhum item cadastrado. <Link href="/estoque/itens/novo" className="text-[#4F7CFF] hover:underline">Adicionar item</Link>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sidebar direita */}
          <div className="space-y-4">
            {/* Alertas */}
            {(criticos.length > 0 || baixos.length > 0) && (
              <div className="card border-red-100 bg-red-50/50">
                <h3 className="font-syne font-semibold text-sm text-[#0F172A] mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-500" /> Alertas de Estoque
                </h3>
                <div className="space-y-2">
                  {[...criticos, ...baixos].slice(0, 5).map(item => (
                    <Link key={item.id} href={`/estoque/itens/${item.id}`}>
                      <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-[#E2E8F0] hover:border-red-200 transition-colors">
                        <div className="text-sm font-medium text-[#0F172A] truncate">{item.nome}</div>
                        <span className={`text-xs font-bold ml-2 shrink-0 ${item.quantidade_atual <= 0 ? 'text-red-500' : 'text-amber-500'}`}>
                          {item.quantidade_atual} {item.unidade}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Últimas movimentações */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-syne font-semibold text-sm text-[#0F172A]">Últimas Movimentações</h3>
                <Link href="/estoque/movimentacoes" className="text-xs text-[#4F7CFF] hover:underline">Ver todas</Link>
              </div>
              <div className="space-y-2">
                {movs.slice(0, 6).map(mov => {
                  const item = mov.item as any
                  return (
                    <div key={mov.id} className="flex items-center gap-3 py-2 border-b border-[#F1F5F9] last:border-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        mov.tipo === 'entrada' ? 'bg-emerald-100' :
                        mov.tipo === 'devolucao' ? 'bg-blue-100' :
                        'bg-red-100'
                      }`}>
                        {mov.tipo === 'entrada' ? <TrendingUp size={12} className="text-emerald-600" /> :
                         mov.tipo === 'devolucao' ? <RefreshCw size={12} className="text-blue-600" /> :
                         <TrendingDown size={12} className="text-red-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-[#0F172A] truncate">{item?.nome || '—'}</div>
                        <div className="text-xs text-[#94A3B8]">{mov.responsavel}</div>
                      </div>
                      <div className={`text-xs font-bold shrink-0 ${mov.tipo === 'entrada' || mov.tipo === 'devolucao' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {mov.tipo === 'saida' ? '-' : '+'}{mov.quantidade} {item?.unidade}
                      </div>
                    </div>
                  )
                })}
                {movs.length === 0 && <p className="text-xs text-[#94A3B8] text-center py-4">Nenhuma movimentação ainda.</p>}
              </div>
            </div>

            {/* Devoluções pendentes */}
            {pendentesDevolucao.length > 0 && (
              <div className="card border-amber-100">
                <h3 className="font-syne font-semibold text-sm text-[#0F172A] mb-3 flex items-center gap-2">
                  <RefreshCw size={16} className="text-amber-500" /> Devoluções Pendentes
                </h3>
                <div className="space-y-2">
                  {pendentesDevolucao.slice(0, 4).map(mov => {
                    const item = mov.item as any
                    return (
                      <div key={mov.id} className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                        <div className="text-xs font-medium text-[#0F172A]">{item?.nome}</div>
                        <div className="text-xs text-[#64748B]">{mov.responsavel} · {mov.quantidade} {item?.unidade}</div>
                        {mov.data_prevista_devolucao && (
                          <div className="text-xs text-amber-600 mt-0.5">
                            Previsto: {new Date(mov.data_prevista_devolucao + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
