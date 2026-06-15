'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Edit2, ArrowUpCircle, ArrowDownCircle, RefreshCw, Package, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EstoqueItem, EstoqueMovimentacao } from '@/lib/types'
import Link from 'next/link'

function formatDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function ItemDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [item, setItem] = useState<EstoqueItem | null>(null)
  const [movs, setMovs] = useState<EstoqueMovimentacao[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const supabase = createClient()
    const [itemRes, movsRes] = await Promise.all([
      supabase.from('estoque_itens').select('*, categoria:estoque_categorias(*)').eq('id', id).single(),
      supabase.from('estoque_movimentacoes').select('*, obra:obras(titulo)').eq('item_id', id).order('created_at', { ascending: false }),
    ])
    if (itemRes.data) setItem(itemRes.data as EstoqueItem)
    if (movsRes.data) setMovs(movsRes.data as EstoqueMovimentacao[])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [id])

  async function registrarDevolucao(movId: string, quantidade: number) {
    const supabase = createClient()
    await supabase.from('estoque_movimentacoes').update({
      status: 'devolvido_total',
      quantidade_devolvida: quantidade,
      data_devolucao: new Date().toISOString().split('T')[0],
    }).eq('id', movId)
    // Atualiza quantidade no estoque
    if (item) {
      await supabase.from('estoque_itens').update({
        quantidade_atual: item.quantidade_atual + quantidade
      }).eq('id', item.id)
    }
    load()
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-[#4F7CFF] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!item) return <div className="p-6 text-[#64748B]">Item não encontrado.</div>

  const nivel = item.quantidade_atual <= 0 ? 'critico' : item.quantidade_atual <= item.quantidade_minima ? 'baixo' : 'ok'
  const cat = item.categoria as any
  const totalEntradas = movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.quantidade, 0)
  const totalSaidas = movs.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.quantidade, 0)
  const pendentes = movs.filter(m => m.status === 'pendente_devolucao')

  return (
    <div className="flex flex-col h-full">
      <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center px-6 gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-[#64748B] hover:text-[#0F172A]">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-syne font-semibold text-[#0F172A] flex-1">{item.nome}</h1>
        <Link href={`/estoque/itens/${id}/editar`} className="btn-secondary text-sm">
          <Edit2 size={14} /> Editar
        </Link>
        <Link href={`/estoque/movimentacao?tipo=saida&item_id=${id}`} className="btn-secondary text-sm">
          <ArrowDownCircle size={14} className="text-red-500" /> Saída
        </Link>
        <Link href={`/estoque/movimentacao?tipo=entrada&item_id=${id}`} className="btn-primary text-sm">
          <ArrowUpCircle size={14} /> Entrada
        </Link>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Left: info do item */}
          <div className="space-y-4">
            {/* Foto */}
            <div className="card p-0 overflow-hidden">
              {item.foto_url ? (
                <img src={item.foto_url} alt={item.nome} className="w-full h-48 object-cover" />
              ) : (
                <div className="w-full h-48 bg-[#F8FAFC] flex items-center justify-center">
                  <Package size={48} className="text-[#CBD5E1]" />
                </div>
              )}
              <div className="p-4">
                {cat && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: cat.cor + '20', color: cat.cor }}>
                    {cat.nome}
                  </span>
                )}
                <h2 className="font-syne font-bold text-lg text-[#0F172A] mt-2">{item.nome}</h2>
                {item.descricao && <p className="text-sm text-[#64748B] mt-1">{item.descricao}</p>}
              </div>
            </div>

            {/* Detalhes */}
            <div className="card space-y-3">
              <h3 className="font-syne font-semibold text-sm text-[#0F172A]">Detalhes</h3>
              {item.codigo_interno && <InfoRow label="Código Interno" value={item.codigo_interno} />}
              {item.codigo_barras && <InfoRow label="Código de Barras" value={item.codigo_barras} mono />}
              {item.localizacao && <InfoRow label="Localização" value={item.localizacao} />}
              {item.unidade && <InfoRow label="Unidade" value={item.unidade} />}
              {item.preco_unitario && <InfoRow label="Preço Unitário" value={`R$ ${item.preco_unitario.toFixed(2)}`} />}
            </div>
          </div>

          {/* Right: estoque e movimentações */}
          <div className="col-span-2 space-y-4">
            {/* Status do estoque */}
            <div className="grid grid-cols-3 gap-4">
              <div className={`card text-center ${nivel === 'critico' ? 'border-red-200 bg-red-50/50' : nivel === 'baixo' ? 'border-amber-200 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/50'}`}>
                <div className={`font-syne text-4xl font-bold ${nivel === 'critico' ? 'text-red-500' : nivel === 'baixo' ? 'text-amber-500' : 'text-emerald-600'}`}>
                  {item.quantidade_atual}
                </div>
                <div className="text-xs text-[#64748B] mt-1">{item.unidade} em estoque</div>
                <div className="mt-2">
                  {nivel === 'critico' && <span className="text-xs font-bold text-red-600 flex items-center justify-center gap-1"><AlertTriangle size={12} /> Zerado</span>}
                  {nivel === 'baixo' && <span className="text-xs font-bold text-amber-600 flex items-center justify-center gap-1"><AlertTriangle size={12} /> Abaixo do mínimo</span>}
                  {nivel === 'ok' && <span className="text-xs font-bold text-emerald-600 flex items-center justify-center gap-1"><CheckCircle2 size={12} /> OK</span>}
                </div>
              </div>
              <div className="card text-center">
                <div className="font-syne text-2xl font-bold text-emerald-600">+{totalEntradas}</div>
                <div className="text-xs text-[#64748B] mt-1">Total entradas</div>
              </div>
              <div className="card text-center">
                <div className="font-syne text-2xl font-bold text-red-500">-{totalSaidas}</div>
                <div className="text-xs text-[#64748B] mt-1">Total saídas</div>
              </div>
            </div>

            {/* Barra de nível */}
            <div className="card">
              <div className="flex justify-between text-xs text-[#64748B] mb-2">
                <span>Nível do estoque</span>
                <span>Mín: {item.quantidade_minima} {item.unidade}{item.quantidade_maxima ? ` · Máx: ${item.quantidade_maxima}` : ''}</span>
              </div>
              <div className="h-3 bg-[#F1F5F9] rounded-full overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all ${nivel === 'critico' ? 'bg-red-500' : nivel === 'baixo' ? 'bg-amber-400' : 'bg-emerald-500'}`}
                  style={{ width: item.quantidade_maxima ? `${Math.min(100, (item.quantidade_atual / item.quantidade_maxima) * 100)}%` : `${Math.min(100, (item.quantidade_atual / (item.quantidade_minima * 3)) * 100)}%` }}
                />
              </div>
            </div>

            {/* Devoluções pendentes */}
            {pendentes.length > 0 && (
              <div className="card border-amber-100">
                <h3 className="font-syne font-semibold text-sm text-[#0F172A] mb-3 flex items-center gap-2">
                  <RefreshCw size={15} className="text-amber-500" /> Devoluções Pendentes ({pendentes.length})
                </h3>
                <div className="space-y-2">
                  {pendentes.map(mov => (
                    <div key={mov.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <div>
                        <div className="text-sm font-medium text-[#0F172A]">{mov.responsavel}</div>
                        <div className="text-xs text-[#64748B]">
                          {mov.quantidade} {item.unidade} · saiu em {formatDate(mov.created_at)}
                          {mov.data_prevista_devolucao && ` · previsto: ${formatDate(mov.data_prevista_devolucao)}`}
                        </div>
                        {(mov.obra as any)?.titulo && <div className="text-xs text-[#4F7CFF]">Obra: {(mov.obra as any).titulo}</div>}
                      </div>
                      <button
                        onClick={() => registrarDevolucao(mov.id, mov.quantidade)}
                        className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                      >
                        Devolvido
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Histórico */}
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <h3 className="font-syne font-semibold text-sm text-[#0F172A]">Histórico de Movimentações</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8F0]">
                    <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Tipo</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Responsável</th>
                    <th className="text-right text-xs font-semibold text-[#64748B] px-4 py-2.5">Qtd</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Obra</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Status</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {movs.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-sm text-[#94A3B8]">Nenhuma movimentação registrada.</td></tr>
                  ) : movs.map(mov => (
                    <tr key={mov.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            mov.tipo === 'entrada' ? 'bg-emerald-100' :
                            mov.tipo === 'devolucao' ? 'bg-blue-100' :
                            mov.tipo === 'ajuste' ? 'bg-purple-100' : 'bg-red-100'
                          }`}>
                            {mov.tipo === 'entrada' ? <TrendingUp size={11} className="text-emerald-600" /> :
                             mov.tipo === 'devolucao' ? <RefreshCw size={11} className="text-blue-600" /> :
                             <TrendingDown size={11} className="text-red-600" />}
                          </div>
                          <span className="text-xs font-medium capitalize text-[#374151]">{mov.tipo}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#374151]">{mov.responsavel}</td>
                      <td className={`px-4 py-3 text-sm font-bold text-right ${mov.tipo === 'saida' ? 'text-red-500' : 'text-emerald-600'}`}>
                        {mov.tipo === 'saida' ? '-' : '+'}{mov.quantidade}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#64748B]">{(mov.obra as any)?.titulo || '—'}</td>
                      <td className="px-4 py-3">
                        <StatusMovBadge status={mov.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[#64748B]">{formatDate(mov.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#64748B]">{label}</span>
      <span className={`text-xs font-medium text-[#0F172A] ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function StatusMovBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    concluido: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Concluído' },
    pendente_devolucao: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pend. Devolução' },
    devolvido_parcial: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Dev. Parcial' },
    devolvido_total: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Devolvido' },
  }
  const c = config[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: status }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>{c.label}</span>
}
