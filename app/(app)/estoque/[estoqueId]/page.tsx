'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Upload, Settings, Package, Thermometer, Droplets, Shield, Sparkles, Shirt, Trash2, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Estoque, EstoqueCampo, EstoqueProduto, EstoqueRegistro } from '@/lib/types'
import Link from 'next/link'

const ICONE_MAP: Record<string, React.ReactNode> = {
  shield: <Shield size={18} />, sparkles: <Sparkles size={18} />,
  thermometer: <Thermometer size={18} />, shirt: <Shirt size={18} />,
  droplets: <Droplets size={18} />, package: <Package size={18} />,
}

type Tab = 'registros' | 'produtos' | 'configurar'

export default function EstoqueDetalhe() {
  const { estoqueId } = useParams<{ estoqueId: string }>()
  const router = useRouter()
  const [estoque, setEstoque] = useState<Estoque | null>(null)
  const [campos, setCampos] = useState<EstoqueCampo[]>([])
  const [produtos, setProdutos] = useState<EstoqueProduto[]>([])
  const [registros, setRegistros] = useState<EstoqueRegistro[]>([])
  const [tab, setTab] = useState<Tab>('registros')
  const [loading, setLoading] = useState(true)
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

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
    setLoading(false)
  }

  useEffect(() => { load() }, [estoqueId])

  async function excluirRegistro(id: string) {
    if (!confirm('Excluir este registro?')) return
    const supabase = createClient()
    await supabase.from('estoque_registros').delete().eq('id', id)
    setRegistros(r => r.filter(x => x.id !== id))
  }

  async function excluirProduto(id: string) {
    if (!confirm('Desativar este produto?')) return
    const supabase = createClient()
    await supabase.from('estoque_produtos').update({ ativo: false }).eq('id', id)
    setProdutos(p => p.filter(x => x.id !== id))
  }

  const registrosOrdenados = [...registros].sort((a, b) => {
    const da = new Date(a.data).getTime(), db = new Date(b.data).getTime()
    return sortDir === 'desc' ? db - da : da - db
  })

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 size={28} className="animate-spin text-[#4F7CFF]" />
    </div>
  )

  if (!estoque) return (
    <div className="p-8 text-center text-[#64748B]">Estoque não encontrado.</div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/estoque" className="w-9 h-9 rounded-xl border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors">
          <ArrowLeft size={16} className="text-[#64748B]" />
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: estoque.cor }}>
            {ICONE_MAP[estoque.icone] ?? <Package size={18} />}
          </div>
          <div>
            <h1 className="font-syne font-bold text-xl text-[#0F172A]">{estoque.nome}</h1>
            {estoque.descricao && <p className="text-xs text-[#64748B]">{estoque.descricao}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/estoque/${estoqueId}/importar`}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] transition-colors">
            <Upload size={14} /> Importar CSV
          </Link>
          <Link href={`/estoque/${estoqueId}/registrar`}
            className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Novo Registro
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
        <div className="card p-0 overflow-hidden">
          {registros.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center">
                <Package size={24} className="text-[#94A3B8]" />
              </div>
              <p className="font-medium text-[#374151]">Nenhum registro ainda</p>
              <p className="text-sm text-[#94A3B8]">Clique em "Novo Registro" para começar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
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
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {registrosOrdenados.map(reg => (
                    <tr key={reg.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors group">
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
                      <td className="px-4 py-3">
                        {reg.assinatura_url
                          ? <img src={reg.assinatura_url} alt="assinatura" className="h-8 object-contain border border-[#E2E8F0] rounded" />
                          : <span className="text-xs text-[#94A3B8]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => excluirRegistro(reg.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[#94A3B8] hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
                    <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Produto</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Código</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Unidade</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Qtd Atual</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Qtd Mín.</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {produtos.map(p => (
                    <tr key={p.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] group">
                      <td className="px-4 py-3 text-sm font-medium text-[#0F172A]">{p.nome}</td>
                      <td className="px-4 py-3 text-sm text-[#64748B]">{p.codigo ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-[#64748B]">{p.unidade}</td>
                      <td className="px-4 py-3 text-sm text-[#374151]">{p.quantidade_atual}</td>
                      <td className="px-4 py-3 text-sm text-[#374151]">{p.quantidade_minima}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => excluirProduto(p.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[#94A3B8] hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
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
    </div>
  )
}

// ── Adicionar produto inline ──────────────────────────
function AddProdutoInline({ estoqueId, onAdded }: { estoqueId: string; onAdded: () => void }) {
  const [show, setShow] = useState(false)
  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')
  const [unidade, setUnidade] = useState('un')
  const [qtdMin, setQtdMin] = useState('0')
  const [loading, setLoading] = useState(false)

  async function salvar() {
    if (!nome.trim()) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('estoque_produtos').insert({
      estoque_id: estoqueId, nome: nome.trim(), codigo: codigo || null,
      unidade, quantidade_minima: parseFloat(qtdMin) || 0,
    })
    setNome(''); setCodigo(''); setUnidade('un'); setQtdMin('0')
    setShow(false); setLoading(false)
    onAdded()
  }

  if (!show) return (
    <button onClick={() => setShow(true)}
      className="flex items-center gap-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] px-3 py-2 rounded-lg transition-colors">
      <Plus size={14} /> Adicionar produto
    </button>
  )

  return (
    <div className="card flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs font-medium text-[#64748B] mb-1">Nome *</label>
        <input autoFocus className="field text-sm" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do produto" />
      </div>
      <div className="w-32">
        <label className="block text-xs font-medium text-[#64748B] mb-1">Código</label>
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
      <div className="flex gap-2">
        <button onClick={salvar} disabled={loading} className="btn-primary text-sm py-2">{loading ? '...' : 'Salvar'}</button>
        <button onClick={() => setShow(false)} className="px-3 py-2 text-sm text-[#64748B] hover:bg-[#F1F5F9] rounded-lg"><X size={14} /></button>
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
                <label className="block text-xs font-medium text-[#64748B] mb-1">Nome do campo *</label>
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
