'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowUpCircle, ArrowDownCircle, Search, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EstoqueItem, Obra, TipoMovimentacao } from '@/lib/types'

function MovimentacaoForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tipoParam = searchParams.get('tipo') as 'entrada' | 'saida' || 'entrada'
  const itemIdParam = searchParams.get('item_id') || ''

  const [tipo, setTipo] = useState<'entrada' | 'saida'>(tipoParam)
  const [itens, setItens] = useState<EstoqueItem[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<EstoqueItem | null>(null)
  const [showItemDropdown, setShowItemDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    quantidade: '',
    responsavel: '',
    obra_id: '',
    motivo: '',
    observacoes: '',
    requer_devolucao: false,
    data_prevista_devolucao: '',
  })

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('estoque_itens').select('*, categoria:estoque_categorias(nome, cor)').eq('ativo', true).order('nome'),
      supabase.from('obras').select('id, titulo').in('status', ['Em Andamento', 'Em Planejamento']).order('titulo'),
    ]).then(([itensRes, obrasRes]) => {
      if (itensRes.data) {
        setItens(itensRes.data as EstoqueItem[])
        if (itemIdParam) {
          const found = itensRes.data.find(i => i.id === itemIdParam)
          if (found) { setSelectedItem(found as EstoqueItem); setItemSearch(found.nome) }
        }
      }
      if (obrasRes.data) setObras(obrasRes.data as Obra[])
    })
  }, [itemIdParam])

  function set(field: string, value: string | boolean) { setForm(f => ({ ...f, [field]: value })) }

  const filteredItens = itens.filter(i => i.nome.toLowerCase().includes(itemSearch.toLowerCase())).slice(0, 8)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedItem) { setError('Selecione um item.'); return }
    const qtd = parseFloat(form.quantidade)
    if (!qtd || qtd <= 0) { setError('Informe uma quantidade válida.'); return }
    if (tipo === 'saida' && qtd > selectedItem.quantidade_atual) {
      setError(`Quantidade insuficiente. Disponível: ${selectedItem.quantidade_atual} ${selectedItem.unidade}`)
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()

    const novaQtd = tipo === 'entrada'
      ? selectedItem.quantidade_atual + qtd
      : selectedItem.quantidade_atual - qtd

    const status = tipo === 'saida' && form.requer_devolucao ? 'pendente_devolucao' : 'concluido'

    const [movRes] = await Promise.all([
      supabase.from('estoque_movimentacoes').insert({
        item_id: selectedItem.id,
        tipo,
        quantidade: qtd,
        responsavel: form.responsavel,
        obra_id: form.obra_id || null,
        motivo: form.motivo || null,
        observacoes: form.observacoes || null,
        status,
        data_prevista_devolucao: form.requer_devolucao && form.data_prevista_devolucao ? form.data_prevista_devolucao : null,
      }),
      supabase.from('estoque_itens').update({
        quantidade_atual: novaQtd,
        updated_at: new Date().toISOString(),
      }).eq('id', selectedItem.id),
    ])

    if (movRes.error) { setError(movRes.error.message); setLoading(false); return }
    router.push(`/estoque/itens/${selectedItem.id}`)
  }

  const isEntrada = tipo === 'entrada'

  return (
    <div className="flex flex-col h-full">
      <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center px-6 gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-[#64748B] hover:text-[#0F172A]"><ArrowLeft size={18} /></button>
        <h1 className="font-syne font-semibold text-[#0F172A]">Registrar Movimentação</h1>
      </header>

      <div className="p-6 max-w-xl">
        {/* Tipo toggle */}
        <div className="flex gap-2 mb-6 p-1 bg-[#F1F5F9] rounded-xl">
          <button
            type="button"
            onClick={() => setTipo('entrada')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${isEntrada ? 'bg-white text-emerald-600 shadow-sm' : 'text-[#64748B] hover:text-[#374151]'}`}
          >
            <ArrowUpCircle size={16} /> Entrada de Material
          </button>
          <button
            type="button"
            onClick={() => setTipo('saida')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${!isEntrada ? 'bg-white text-red-500 shadow-sm' : 'text-[#64748B] hover:text-[#374151]'}`}
          >
            <ArrowDownCircle size={16} /> Saída de Material
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Seleção do item */}
          <div className="card">
            <label className="block text-sm font-medium text-[#374151] mb-2">Item *</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                className="field pl-8"
                placeholder="Buscar item no estoque..."
                value={itemSearch}
                onChange={e => { setItemSearch(e.target.value); setShowItemDropdown(true); if (!e.target.value) setSelectedItem(null) }}
                onFocus={() => setShowItemDropdown(true)}
              />
              {showItemDropdown && itemSearch && filteredItens.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-20 overflow-hidden">
                  {filteredItens.map(item => {
                    const cat = item.categoria as any
                    const disponivel = item.quantidade_atual
                    const semEstoque = tipo === 'saida' && disponivel <= 0
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={semEstoque}
                        onClick={() => { setSelectedItem(item); setItemSearch(item.nome); setShowItemDropdown(false) }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F8FAFC] transition-colors border-b border-[#F1F5F9] last:border-0 ${semEstoque ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        {item.foto_url ? (
                          <img src={item.foto_url} alt={item.nome} className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <div className="w-8 h-8 bg-[#F1F5F9] rounded-lg flex items-center justify-center"><Package size={14} className="text-[#94A3B8]" /></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#0F172A]">{item.nome}</div>
                          {cat && <div className="text-xs" style={{ color: cat.cor }}>{cat.nome}</div>}
                        </div>
                        <div className={`text-xs font-semibold ${disponivel <= item.quantidade_minima ? 'text-amber-500' : 'text-[#64748B]'}`}>
                          {disponivel} {item.unidade}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Item selecionado */}
            {selectedItem && (
              <div className={`mt-3 p-3 rounded-lg border ${isEntrada ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#0F172A]">{selectedItem.nome}</span>
                  <span className="text-xs text-[#64748B]">Disponível: <strong>{selectedItem.quantidade_atual} {selectedItem.unidade}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Quantidade e responsável */}
          <div className="card">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  Quantidade * {selectedItem && <span className="text-[#94A3B8]">({selectedItem.unidade})</span>}
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="field"
                  value={form.quantidade}
                  onChange={e => set('quantidade', e.target.value)}
                  placeholder="0"
                />
                {tipo === 'saida' && selectedItem && form.quantidade && parseFloat(form.quantidade) > selectedItem.quantidade_atual && (
                  <p className="text-xs text-red-500 mt-1">Quantidade maior que o disponível!</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Responsável *</label>
                <input required className="field" value={form.responsavel} onChange={e => set('responsavel', e.target.value)} placeholder="Nome de quem movimenta" />
              </div>
            </div>
          </div>

          {/* Obra vinculada */}
          <div className="card">
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Vincular a uma Obra</label>
            <select className="field" value={form.obra_id} onChange={e => set('obra_id', e.target.value)}>
              <option value="">Sem obra vinculada</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
            </select>
          </div>

          {/* Motivo e observações */}
          <div className="card">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  {isEntrada ? 'Origem / Fornecedor' : 'Motivo da Saída'}
                </label>
                <input className="field" value={form.motivo} onChange={e => set('motivo', e.target.value)}
                  placeholder={isEntrada ? 'Ex: Compra, Devolução de obra...' : 'Ex: Utilização na obra, Manutenção...'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Observações</label>
                <textarea rows={2} className="field resize-none" value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="Informações adicionais..." />
              </div>
            </div>
          </div>

          {/* Devolução (apenas para saída) */}
          {tipo === 'saida' && (
            <div className="card border-amber-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requer_devolucao}
                  onChange={e => set('requer_devolucao', e.target.checked)}
                  className="w-4 h-4 accent-[#4F7CFF]"
                />
                <div>
                  <div className="text-sm font-medium text-[#374151]">Este material precisa ser devolvido</div>
                  <div className="text-xs text-[#94A3B8]">Ferramentas, equipamentos de teste, EPIs emprestados...</div>
                </div>
              </label>
              {form.requer_devolucao && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Data Prevista de Devolução</label>
                  <input type="date" className="field w-48" value={form.data_prevista_devolucao} onChange={e => set('data_prevista_devolucao', e.target.value)} />
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors">Cancelar</button>
            <button
              type="submit"
              disabled={loading}
              className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-60 ${isEntrada ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}
            >
              {isEntrada ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
              {loading ? 'Registrando...' : isEntrada ? 'Registrar Entrada' : 'Registrar Saída'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function MovimentacaoPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-[#4F7CFF] border-t-transparent rounded-full animate-spin" /></div>}>
      <MovimentacaoForm />
    </Suspense>
  )
}
