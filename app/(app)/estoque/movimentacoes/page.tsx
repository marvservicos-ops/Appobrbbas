'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, RefreshCw, Filter } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EstoqueMovimentacao } from '@/lib/types'
import Topbar from '@/components/Topbar'
import Link from 'next/link'

function formatDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  concluido: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Concluído' },
  pendente_devolucao: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pend. Devolução' },
  devolvido_parcial: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Dev. Parcial' },
  devolvido_total: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Devolvido' },
}

export default function MovimentacoesPage() {
  const [movs, setMovs] = useState<EstoqueMovimentacao[]>([])
  const [loading, setLoading] = useState(true)
  const [tipoFilter, setTipoFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    createClient()
      .from('estoque_movimentacoes')
      .select('*, item:estoque_itens(nome, unidade, foto_url), obra:obras(titulo)')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) setMovs(data as EstoqueMovimentacao[])
        setLoading(false)
      })
  }, [])

  const filtered = movs.filter(m => {
    const item = m.item as any
    const matchSearch = !search ||
      (item?.nome || '').toLowerCase().includes(search.toLowerCase()) ||
      m.responsavel.toLowerCase().includes(search.toLowerCase())
    const matchTipo = !tipoFilter || m.tipo === tipoFilter
    return matchSearch && matchTipo
  })

  return (
    <div>
      <Topbar searchPlaceholder="Buscar por item ou responsável..." onSearch={setSearch} />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-syne text-2xl font-bold text-[#0F172A]">Movimentações</h1>
            <p className="text-sm text-[#64748B] mt-0.5">Histórico completo de entradas e saídas</p>
          </div>
          <div className="flex gap-2">
            <Link href="/estoque/movimentacao?tipo=entrada" className="btn-secondary text-sm">
              <TrendingUp size={14} className="text-emerald-500" /> Nova Entrada
            </Link>
            <Link href="/estoque/movimentacao?tipo=saida" className="btn-secondary text-sm">
              <TrendingDown size={14} className="text-red-500" /> Nova Saída
            </Link>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 mb-4">
          <Filter size={14} className="text-[#64748B]" />
          {['', 'entrada', 'saida', 'devolucao', 'ajuste'].map(t => (
            <button key={t} onClick={() => setTipoFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${tipoFilter === t ? 'bg-[#4F7CFF] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}>
              {t || 'Todos'}
            </button>
          ))}
        </div>

        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Item</th>
                <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Tipo</th>
                <th className="text-right text-xs font-semibold text-[#64748B] px-4 py-3">Quantidade</th>
                <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Responsável</th>
                <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Obra</th>
                <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-[#F1F5F9]">
                    {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-[#F1F5F9] rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-sm text-[#94A3B8]">Nenhuma movimentação encontrada.</td></tr>
              ) : filtered.map(mov => {
                const item = mov.item as any
                const obra = mov.obra as any
                const sc = statusConfig[mov.status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: mov.status }
                return (
                  <tr key={mov.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3">
                      <Link href={`/estoque/itens/${mov.item_id}`} className="flex items-center gap-2 group">
                        {item?.foto_url ? (
                          <img src={item.foto_url} className="w-7 h-7 rounded-lg object-cover" alt="" />
                        ) : (
                          <div className="w-7 h-7 bg-[#F1F5F9] rounded-lg flex items-center justify-center">
                            <span className="text-[10px] text-[#94A3B8]">📦</span>
                          </div>
                        )}
                        <span className="text-sm font-medium text-[#0F172A] group-hover:text-[#4F7CFF]">{item?.nome || '—'}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${mov.tipo === 'entrada' ? 'bg-emerald-100' : mov.tipo === 'devolucao' ? 'bg-blue-100' : 'bg-red-100'}`}>
                          {mov.tipo === 'entrada' ? <TrendingUp size={11} className="text-emerald-600" /> :
                           mov.tipo === 'devolucao' ? <RefreshCw size={11} className="text-blue-600" /> :
                           <TrendingDown size={11} className="text-red-600" />}
                        </div>
                        <span className="text-xs font-medium capitalize text-[#374151]">{mov.tipo}</span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-sm font-bold text-right ${mov.tipo === 'saida' ? 'text-red-500' : 'text-emerald-600'}`}>
                      {mov.tipo === 'saida' ? '-' : '+'}{mov.quantidade} {item?.unidade}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#374151]">{mov.responsavel}</td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">{obra?.titulo || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{sc.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">{formatDate(mov.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
