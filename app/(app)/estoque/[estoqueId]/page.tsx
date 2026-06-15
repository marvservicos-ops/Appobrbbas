'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Plus, Upload, Package, Thermometer, Droplets, Shield, Sparkles, Shirt, Trash2, X, Loader2, ChevronDown, ChevronUp, Pencil, CheckSquare, Square } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Estoque, EstoqueCampo, EstoqueProduto, EstoqueRegistro } from '@/lib/types'
import Link from 'next/link'

const ICONE_MAP: Record<string, React.ReactNode> = {
  shield: <Shield size={18} />, sparkles: <Sparkles size={18} />,
  thermometer: <Thermometer size={18} />, shirt: <Shirt size={18} />,
  droplets: <Droplets size={18} />, package: <Package size={18} />,
}
const ICONES = ['package', 'shield', 'sparkles', 'thermometer', 'shirt', 'droplets']
const CORES = ['#4F7CFF', '#F59E0B', '#2DD4BF', '#8B5CF6', '#06B6D4', '#EF4444', '#10B981', '#F97316']

type Tab = 'registros' | 'produtos' | 'configurar'

export default function EstoqueDetalhe() {
  const { estoqueId } = useParams<{ estoqueId: string }>()
  const [estoque, setEstoque] = useState<Estoque | null>(null)
  const [campos, setCampos] = useState<EstoqueCampo[]>([])
  const [produtos, setProdutos] = useState<EstoqueProduto[]>([])
  const [registros, setRegistros] = useState<EstoqueRegistro[]>([])
  const [tab, setTab] = useState<Tab>('registros')
  const [loading, setLoading] = useState(true)
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [showEdit, setShowEdit] = useState(false)
  const [editandoProduto, setEditandoProduto] = useState<EstoqueProduto | null>(null)

  // Seleção em lote
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [excluindoLote, setExcluindoLote] = useState(false)

  async function load() {
    const supabase = createClient()
    const [{ data: est }, { data: cam }, { data: prod }, { data: regs }] = await Promise.all([
      supabase.from('estoques').select('*').eq('id', estoqueId).single(),
      supabase.from('estoque_campos').select('*').eq('estoque_id', estoqueId).order('ordem'),
      supabase.from('estoque_produtos').select('*').eq('estoque_id', estoqueId).eq('ativo', true).order('nome'),
      supabase.from('estoque_registros').select('*, valores:estoque_registro_valores(*)').eq('estoque_id', estoqueId).order('data', { ascending: false }).order('created_at', { ascending: false }),
    ])
    setEstoque(est)
    setCampos(cam ?? [])
    setProdutos(prod ?? [])
    setRegistros(regs ?? [])
    setSelecionados(new Set())
    setLoading(false)
  }

  useEffect(() => { load() }, [estoqueId])

  async function excluirRegistro(id: string) {
    if (!confirm('Excluir este registro?')) return
    const supabase = createClient()
    await supabase.from('estoque_registros').delete().eq('id', id)
    setRegistros(r => r.filter(x => x.id !== id))
  }

  async function excluirSelecionados() {
    if (selecionados.size === 0) return
    if (!confirm(`Excluir ${selecionados.size} registro(s) selecionado(s)?`)) return
    setExcluindoLote(true)
    const supabase = createClient()
    await supabase.from('estoque_registros').delete().in('id', Array.from(selecionados))
    setRegistros(r => r.filter(x => !selecionados.has(x.id)))
    setSelecionados(new Set())
    setExcluindoLote(false)
  }

  async function excluirProduto(id: string) {
    if (!confirm('Desativar este produto?')) return
    const supabase = createClient()
    await supabase.from('estoque_produtos').update({ ativo: false }).eq('id', id)
    setProdutos(p => p.filter(x => x.id !== id))
  }

  function toggleSelecionado(id: string) {
    setSelecionados(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTodos() {
    if (selecionados.size === registrosOrdenados.length) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(registrosOrdenados.map(r => r.id)))
    }
  }

  const registrosOrdenados = [...registros].sort((a, b) => {
    const da = new Date(a.data).getTime(), db = new Date(b.data).getTime()
    return sortDir === 'desc' ? db - da : da - db
  })

  const todosSelec = registrosOrdenados.length > 0 && selecionados.size === registrosOrdenados.length

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 size={28} className="animate-spin text-[#4F7CFF]" />
    </div>
  )

  if (!estoque) return (
    <div className="p-8 text-center text-[#64748B]">Estoque não encontrado.</div>
  )

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 md:gap-4 mb-5">
        <Link href="/estoque" className="w-9 h-9 rounded-xl border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors">
          <ArrowLeft size={16} className="text-[#64748B]" />
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: estoque.cor }}>
            {ICONE_MAP[estoque.icone] ?? <Package size={18} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-syne font-bold text-xl text-[#0F172A]">{estoque.nome}</h1>
              <button onClick={() => setShowEdit(true)} className="text-[#94A3B8] hover:text-[#4F7CFF] transition-colors">
                <Pencil size={14} />
              </button>
            </div>
            {estoque.descricao && <p className="text-xs text-[#64748B]">{estoque.descricao}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/estoque/${estoqueId}/importar`}
            className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] transition-colors">
            <Upload size={14} /> Importar CSV
          </Link>
          <Link href={`/estoque/${estoqueId}/registrar`} className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2">
            <Plus size={14} /> <span className="hidden sm:inline">Novo </span>Registro
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#F1F5F9] p-1 rounded-xl w-fit">
        {(['registros', 'produtos', 'configurar'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-all ${tab === t ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#374151]'}`}>
            {t === 'registros' ? `Registros (${registros.length})` : t === 'produtos' ? `Produtos (${produtos.length})` : 'Configurar'}
          </button>
        ))}
      </div>

      {/* Tab: Registros */}
      {tab === 'registros' && (
        <div className="space-y-3">
          {/* Barra de ação em lote */}
          {selecionados.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-[#EEF2FF] rounded-xl border border-[#C7D2FE]">
              <span className="text-sm font-medium text-[#4F7CFF]">{selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''}</span>
              <button onClick={excluirSelecionados} disabled={excluindoLote}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors ml-auto">
                {excluindoLote ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Excluir selecionados
              </button>
              <button onClick={() => setSelecionados(new Set())} className="text-[#64748B] hover:text-[#374151]">
                <X size={16} />
              </button>
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            {registros.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center">
                  <Package size={24} className="text-[#94A3B8]" />
                </div>
                <p className="font-medium text-[#374151]">Nenhum registro ainda</p>
                <p className="text-sm text-[#94A3B8]">Clique em &quot;Novo Registro&quot; para começar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="px-4 py-3 w-8">
                        <button onClick={toggleTodos} className="text-[#94A3B8] hover:text-[#4F7CFF] transition-colors">
                          {todosSelec ? <CheckSquare size={16} className="text-[#4F7CFF]" /> : <Square size={16} />}
                        </button>
                      </th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">
                        <button className="flex items-center gap-1" onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
                          Data {sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                        </button>
                      </th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Tipo</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Produto</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Qtd</th>
                      {campos.map(c => (
                        <th key={c.id} className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">{c.nome}</th>
                      ))}
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Responsável</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Assinatura</th>
                      <th className="px-4 py-3 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {registrosOrdenados.map(reg => {
                      const selec = selecionados.has(reg.id)
                      return (
                        <tr key={reg.id}
                          className={`border-b border-[#F1F5F9] transition-colors group cursor-pointer ${selec ? 'bg-[#F5F7FF]' : 'hover:bg-[#F8FAFC]'}`}
                          onClick={() => toggleSelecionado(reg.id)}>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <button onClick={() => toggleSelecionado(reg.id)} className="text-[#94A3B8] hover:text-[#4F7CFF] transition-colors">
                              {selec ? <CheckSquare size={16} className="text-[#4F7CFF]" /> : <Square size={16} />}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#374151] whitespace-nowrap">
                            {new Date(reg.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${reg.tipo === 'saida' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                              {reg.tipo === 'saida' ? 'Saída' : 'Entrada'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-[#0F172A]">{reg.produto_nome}</td>
                          <td className="px-4 py-3 text-sm text-[#374151]">{reg.quantidade} {reg.unidade ?? ''}</td>
                          {campos.map(c => {
                            const val = reg.valores?.find(v => v.campo_id === c.id)
                            return <td key={c.id} className="px-4 py-3 text-sm text-[#374151]">{val?.valor ?? '—'}</td>
                          })}
                          <td className="px-4 py-3 text-sm text-[#374151]">{reg.responsavel}</td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            {reg.assinatura_url
                              ? <img src={reg.assinatura_url} alt="assinatura" className="h-8 object-contain border border-[#E2E8F0] rounded" />
                              : <span className="text-xs text-[#94A3B8]">—</span>}
                          </td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <button onClick={() => excluirRegistro(reg.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-[#94A3B8] hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Produtos */}
      {tab === 'produtos' && (
        <div className="space-y-4">
          <AddProdutoInline estoqueId={estoqueId} onAdded={load} />
          <div className="card p-0 overflow-hidden">
            {produtos.length === 0 ? (
              <div className="py-12 text-center text-[#94A3B8] text-sm">Nenhum produto cadastrado.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left text-xs font-semibold text-[#64748B] px-3 py-3">Produto</th>
                    <th className="hidden md:table-cell text-left text-xs font-semibold text-[#64748B] px-3 py-3">Código</th>
                    <th className="hidden sm:table-cell text-left text-xs font-semibold text-[#64748B] px-3 py-3">Unidade</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] px-3 py-3">Qtd</th>
                    <th className="hidden sm:table-cell text-left text-xs font-semibold text-[#64748B] px-3 py-3">Mín.</th>
                    <th className="px-3 py-3 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {produtos.map(p => (
                    <tr key={p.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] group">
                      <td className="px-3 py-3 text-sm font-medium text-[#0F172A]">{p.nome}</td>
                      <td className="hidden md:table-cell px-3 py-3 text-sm text-[#64748B]">{p.codigo ?? '—'}</td>
                      <td className="hidden sm:table-cell px-3 py-3 text-sm text-[#64748B]">{p.unidade}</td>
                      <td className="px-3 py-3 text-sm text-[#374151]">{p.quantidade_atual}</td>
                      <td className="hidden sm:table-cell px-3 py-3 text-sm text-[#374151]">{p.quantidade_minima}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditandoProduto(p)} className="text-[#94A3B8] hover:text-[#4F7CFF]">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => excluirProduto(p.id)} className="text-[#94A3B8] hover:text-red-500">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: Configurar */}
      {tab === 'configurar' && (
        <ConfigurarCampos estoqueId={estoqueId} campos={campos} onUpdated={load} />
      )}

      {/* Modal editar produto */}
      {editandoProduto && (
        <ModalEditarProduto
          produto={editandoProduto}
          onClose={() => setEditandoProduto(null)}
          onSaved={() => { setEditandoProduto(null); load() }}
        />
      )}

      {/* Modal editar estoque */}
      {showEdit && estoque && (
        <ModalEditarEstoque
          estoque={estoque}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load() }}
        />
      )}
    </div>
  )
}

// ── Modal editar produto ──────────────────────────────
function ModalEditarProduto({ produto, onClose, onSaved }: { produto: EstoqueProduto; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(produto.nome)
  const [codigo, setCodigo] = useState(produto.codigo ?? '')
  const [codigoBarras, setCodigoBarras] = useState((produto as any).codigo_barras ?? '')
  const [unidade, setUnidade] = useState(produto.unidade)
  const [qtdAtual, setQtdAtual] = useState(String(produto.quantidade_atual))
  const [qtdMin, setQtdMin] = useState(String(produto.quantidade_minima))
  const [loading, setLoading] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('estoque_produtos').update({
      nome: nome.trim(),
      codigo: codigo.trim() || null,
      codigo_barras: codigoBarras.trim() || null,
      unidade: unidade.trim() || 'un',
      quantidade_atual: parseFloat(qtdAtual) || 0,
      quantidade_minima: parseFloat(qtdMin) || 0,
    }).eq('id', produto.id)
    setLoading(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">Editar Produto</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={salvar} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome *</label>
            <input required className="field" value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Código / Nº CA</label>
              <input className="field" value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Unidade</label>
              <input className="field" value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="un" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Código de Barras / QR Code</label>
            <input className="field font-mono" value={codigoBarras} onChange={e => setCodigoBarras(e.target.value)}
              placeholder="Aponte o leitor ou digite manualmente" />
            <p className="text-xs text-[#94A3B8] mt-1">Para usar leitor: clique no campo e escaneie o produto.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Qtd Atual</label>
              <input type="number" step="any" className="field" value={qtdAtual} onChange={e => setQtdAtual(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Qtd Mínima</label>
              <input type="number" step="any" className="field" value={qtdMin} onChange={e => setQtdMin(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal editar estoque ──────────────────────────────
function ModalEditarEstoque({ estoque, onClose, onSaved }: { estoque: Estoque; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(estoque.nome)
  const [descricao, setDescricao] = useState(estoque.descricao ?? '')
  const [cor, setCor] = useState(estoque.cor)
  const [icone, setIcone] = useState(estoque.icone)
  const [loading, setLoading] = useState(false)

  const ICONE_MAP_FULL: Record<string, React.ReactNode> = {
    shield: <Shield size={20} />, sparkles: <Sparkles size={20} />,
    thermometer: <Thermometer size={20} />, shirt: <Shirt size={20} />,
    droplets: <Droplets size={20} />, package: <Package size={20} />,
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.from('estoques').update({ nome, descricao: descricao || null, cor, icone }).eq('id', estoque.id)
    setLoading(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">Editar Estoque</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={salvar} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome *</label>
            <input required className="field" value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Descrição</label>
            <input className="field" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Ícone</label>
            <div className="flex gap-2 flex-wrap">
              {ICONES.map(ic => (
                <button key={ic} type="button" onClick={() => setIcone(ic)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 transition-colors ${icone === ic ? 'border-[#4F7CFF] bg-[#EEF2FF]' : 'border-[#E2E8F0]'}`}
                  style={{ color: icone === ic ? '#4F7CFF' : '#64748B' }}>
                  {ICONE_MAP_FULL[ic]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {CORES.map(c => (
                <button key={c} type="button" onClick={() => setCor(c)}
                  className={`w-8 h-8 rounded-full border-4 transition-all ${cor === c ? 'border-white ring-2 ring-offset-1 ring-[#4F7CFF] scale-110' : 'border-white'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Adicionar produto inline ──────────────────────────
function AddProdutoInline({ estoqueId, onAdded }: { estoqueId: string; onAdded: () => void }) {
  const [show, setShow] = useState(false)
  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')
  const [codigoBarras, setCodigoBarras] = useState('')
  const [unidade, setUnidade] = useState('un')
  const [qtdMin, setQtdMin] = useState('0')
  const [loading, setLoading] = useState(false)

  async function salvar() {
    if (!nome.trim()) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('estoque_produtos').insert({
      estoque_id: estoqueId, nome: nome.trim(),
      codigo: codigo || null,
      codigo_barras: codigoBarras || null,
      unidade, quantidade_minima: parseFloat(qtdMin) || 0,
    })
    setNome(''); setCodigo(''); setCodigoBarras(''); setUnidade('un'); setQtdMin('0')
    setShow(false); setLoading(false)
    onAdded()
  }

  if (!show) return (
    <button onClick={() => setShow(true)} className="flex items-center gap-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] px-3 py-2 rounded-lg transition-colors">
      <Plus size={14} /> Adicionar produto
    </button>
  )

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-[#64748B] mb-1">Nome *</label>
          <input autoFocus className="field text-sm" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do produto" />
        </div>
        <div className="w-32">
          <label className="block text-xs font-medium text-[#64748B] mb-1">Código / Nº CA</label>
          <input className="field text-sm" value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Ex: CA-12345" />
        </div>
        <div className="w-24">
          <label className="block text-xs font-medium text-[#64748B] mb-1">Unidade</label>
          <input className="field text-sm" value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="un" />
        </div>
        <div className="w-24">
          <label className="block text-xs font-medium text-[#64748B] mb-1">Qtd Mín.</label>
          <input type="number" className="field text-sm" value={qtdMin} onChange={e => setQtdMin(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-[#64748B] mb-1">Código de Barras / QR Code</label>
          <input className="field text-sm font-mono" value={codigoBarras} onChange={e => setCodigoBarras(e.target.value)} placeholder="Use o leitor ou digite manualmente" />
        </div>
        <div className="flex gap-2">
          <button onClick={salvar} disabled={loading} className="btn-primary text-sm py-2">{loading ? '...' : 'Salvar'}</button>
          <button onClick={() => setShow(false)} className="px-3 py-2 text-sm text-[#64748B] hover:bg-[#F1F5F9] rounded-lg"><X size={14} /></button>
        </div>
      </div>
    </div>
  )
}

// ── Configurar campos customizados ────────────────────
function ConfigurarCampos({ estoqueId, campos, onUpdated }: { estoqueId: string; campos: EstoqueCampo[]; onUpdated: () => void }) {
  const [showAdd, setShowAdd] = useState(false)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<'text' | 'number' | 'date' | 'unit'>('text')
  const [obrigatorio, setObrigatorio] = useState(false)
  const [loading, setLoading] = useState(false)

  async function addCampo() {
    if (!nome.trim()) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('estoque_campos').insert({
      estoque_id: estoqueId, nome: nome.trim(), tipo, obrigatorio, ordem: campos.length,
    })
    setNome(''); setTipo('text'); setObrigatorio(false); setShowAdd(false); setLoading(false)
    onUpdated()
  }

  async function excluirCampo(id: string) {
    if (!confirm('Excluir este campo? Os dados já registrados serão perdidos.')) return
    const supabase = createClient()
    await supabase.from('estoque_campos').delete().eq('id', id)
    onUpdated()
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div className="card">
        <h3 className="font-syne font-semibold text-[#0F172A] mb-1">Campos customizados</h3>
        <p className="text-xs text-[#64748B] mb-4">Campos extras que aparecem em cada registro deste estoque. Data, Produto, Qtd, Responsável e Assinatura são sempre incluídos.</p>
        <div className="space-y-2">
          {campos.length === 0 && <p className="text-sm text-[#94A3B8]">Nenhum campo extra configurado.</p>}
          {campos.map(c => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
              <div>
                <span className="text-sm font-medium text-[#374151]">{c.nome}</span>
                <span className="ml-2 text-xs text-[#94A3B8]">{c.tipo}{c.obrigatorio ? ' · obrigatório' : ''}</span>
              </div>
              <button onClick={() => excluirCampo(c.id)} className="text-[#94A3B8] hover:text-red-500 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        {showAdd ? (
          <div className="mt-4 pt-4 border-t border-[#E2E8F0] space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Nome *</label>
                <input autoFocus className="field text-sm" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Nº CA" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Tipo</label>
                <select className="field text-sm" value={tipo} onChange={e => setTipo(e.target.value as typeof tipo)}>
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="date">Data</option>
                  <option value="unit">Unidade de medida</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-[#374151] cursor-pointer">
              <input type="checkbox" checked={obrigatorio} onChange={e => setObrigatorio(e.target.checked)} className="rounded" />
              Campo obrigatório
            </label>
            <div className="flex gap-2">
              <button onClick={addCampo} disabled={loading} className="btn-primary text-sm py-2">{loading ? '...' : 'Adicionar'}</button>
              <button onClick={() => setShowAdd(false)} className="px-3 py-2 text-sm text-[#64748B] hover:bg-[#F1F5F9] rounded-lg">Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} className="mt-4 flex items-center gap-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] px-3 py-2 rounded-lg transition-colors w-full justify-center border border-dashed border-[#4F7CFF]">
            <Plus size={14} /> Adicionar campo
          </button>
        )}
      </div>
    </div>
  )
}
