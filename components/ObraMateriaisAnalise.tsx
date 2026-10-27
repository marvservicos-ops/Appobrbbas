'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Ruler, Target, Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EstoqueProdutoCategoria } from '@/lib/types'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

// Sugestões de grandeza para obras de climatização; o nome é livre
export const GRANDEZAS_SUGERIDAS: { nome: string; unidade: string }[] = [
  { nome: 'Máquinas', unidade: 'un' },
  { nome: 'Capacidade', unidade: 'TR' },
  { nome: 'Duto', unidade: 'm²' },
  { nome: 'Tubulação frigorígena', unidade: 'm' },
]

interface Registro {
  id: string
  produto_id?: string | null
  produto_nome: string
  quantidade: number
  unidade?: string
  valor_total?: number | null
  tipo: 'entrada' | 'saida'
}

interface Grandeza { id: string; obra_id: string; nome: string; unidade: string | null; valor: number }
interface Previsao {
  id: string; obra_id: string
  produto_id: string | null; categoria_id: string | null
  quantidade: number | null; valor: number | null; observacao: string | null
}
interface ProdutoInfo { id: string; nome: string; unidade: string; categoria_id: string | null; estoque_id: string }

// Acima disso a previsão vira alerta vermelho (abaixo, até 100%, segue verde; entre 100% e isso, âmbar)
const MARGEM_ALERTA = 1.2

export default function ObraMateriaisAnalise({ obraId, saidas, devolucoes, custoComprasDiretas }: {
  obraId: string
  saidas: Registro[]
  devolucoes: Registro[]
  custoComprasDiretas: number
}) {
  const [categorias, setCategorias] = useState<EstoqueProdutoCategoria[]>([])
  const [produtos, setProdutos] = useState<ProdutoInfo[]>([])
  const [grandezas, setGrandezas] = useState<Grandeza[]>([])
  const [previsoes, setPrevisoes] = useState<Previsao[]>([])
  const [grandezaSel, setGrandezaSel] = useState('')
  const [aberto, setAberto] = useState(true)
  const [loading, setLoading] = useState(true)

  async function load() {
    const supabase = createClient()
    const [catRes, gRes, pRes] = await Promise.all([
      supabase.from('estoque_produto_categorias').select('*').order('ordem').order('nome'),
      supabase.from('obra_grandezas').select('*').eq('obra_id', obraId).order('created_at'),
      supabase.from('obra_previsao_materiais').select('*').eq('obra_id', obraId).order('created_at'),
    ])
    const cats = (catRes.data ?? []) as EstoqueProdutoCategoria[]
    setCategorias(cats)
    setGrandezas((gRes.data ?? []) as Grandeza[])
    setPrevisoes((pRes.data ?? []) as Previsao[])
    // Produtos dos estoques que usam categoria (materiais), para previsão e para classificar os registros
    const estoqueIds = Array.from(new Set(cats.map(c => c.estoque_id)))
    if (estoqueIds.length > 0) {
      const { data: prods } = await supabase.from('estoque_produtos')
        .select('id, nome, unidade, categoria_id, estoque_id').in('estoque_id', estoqueIds).eq('ativo', true).order('nome')
      setProdutos((prods ?? []) as ProdutoInfo[])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [obraId])

  // Registros de produtos fora dos estoques de materiais (ex.: EPI) também precisam da categoria (nenhuma)
  const [catDeProduto, setCatDeProduto] = useState<Map<string, string | null>>(new Map())
  useEffect(() => {
    const ids = Array.from(new Set([...saidas, ...devolucoes].map(r => r.produto_id).filter(Boolean))) as string[]
    if (ids.length === 0) { setCatDeProduto(new Map()); return }
    createClient().from('estoque_produtos').select('id, categoria_id').in('id', ids)
      .then(({ data }) => setCatDeProduto(new Map((data ?? []).map((p: { id: string; categoria_id: string | null }) => [p.id, p.categoria_id]))))
  }, [saidas, devolucoes])

  useEffect(() => {
    if (!grandezaSel && grandezas.length > 0) setGrandezaSel(grandezas[0].id)
    if (grandezaSel && !grandezas.some(g => g.id === grandezaSel)) setGrandezaSel(grandezas[0]?.id ?? '')
  }, [grandezas, grandezaSel])

  if (loading) return null
  // Sem categorias configuradas em nenhum estoque, a análise não tem o que mostrar
  if (categorias.length === 0) return null

  // ── custo líquido por categoria ────────────────────
  const porCategoria = new Map<string, number>()
  const sinal = (r: Registro) => (r.tipo === 'saida' ? 1 : -1)
  for (const r of [...saidas, ...devolucoes]) {
    const cat = (r.produto_id && catDeProduto.get(r.produto_id)) || '__sem__'
    porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + sinal(r) * (r.valor_total || 0))
  }
  const linhas = [
    ...categorias.map(c => ({ id: c.id, nome: c.nome, cor: c.cor, valor: porCategoria.get(c.id) ?? 0 })),
    { id: '__sem__', nome: 'Sem categoria', cor: '#94A3B8', valor: porCategoria.get('__sem__') ?? 0 },
    { id: '__compras__', nome: 'Compras diretas (Materiais da Obra)', cor: '#3B82F6', valor: custoComprasDiretas },
  ].filter(l => l.valor !== 0 || categorias.some(c => c.id === l.id))
  const total = linhas.reduce((s, l) => s + l.valor, 0)
  const grandeza = grandezas.find(g => g.id === grandezaSel)
  const divisor = grandeza && grandeza.valor > 0 ? grandeza.valor : 0

  // ── realizado por produto (qtd líquida) e por categoria (R$ líquido) ─
  const qtdPorProduto = new Map<string, number>()
  for (const r of [...saidas, ...devolucoes]) {
    if (!r.produto_id) continue
    qtdPorProduto.set(r.produto_id, (qtdPorProduto.get(r.produto_id) ?? 0) + sinal(r) * r.quantidade)
  }
  const produtoPorId = new Map(produtos.map(p => [p.id, p]))
  const categoriaPorId = new Map(categorias.map(c => [c.id, c]))

  return (
    <div className="card p-0 overflow-hidden">
      <button onClick={() => setAberto(a => !a)} className="w-full flex items-center justify-between px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors">
        <div className="flex items-center gap-2">
          <BarChart3 size={15} className="text-[#4F7CFF]" />
          <span className="font-syne font-semibold text-sm text-[#0F172A]">Análise de Materiais</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[#0F172A]">{moeda(total)}{divisor > 0 && <span className="text-xs font-medium text-[#64748B]"> · {moeda(total / divisor)}/{grandeza?.unidade || grandeza?.nome}</span>}</span>
          {aberto ? <ChevronDown size={15} className="text-[#94A3B8]" /> : <ChevronRight size={15} className="text-[#94A3B8]" />}
        </div>
      </button>
      {aberto && (
        <div className="p-4 space-y-6">
          {/* Por categoria */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Custo por categoria</h4>
              {grandezas.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-[#64748B]">
                  Índice por
                  <select className="field text-xs py-1 w-auto" value={grandezaSel} onChange={e => setGrandezaSel(e.target.value)}>
                    {grandezas.map(g => <option key={g.id} value={g.id}>{g.nome}{g.unidade ? ` (${g.unidade})` : ''}</option>)}
                  </select>
                </label>
              )}
            </div>
            <div className="space-y-1.5">
              {linhas.map(l => (
                <div key={l.id} className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l.cor }} />
                  <span className="text-sm text-[#374151] flex-1 min-w-0 truncate">{l.nome}</span>
                  <div className="hidden sm:block w-32 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${total > 0 ? Math.max(0, Math.min(100, (l.valor / total) * 100)) : 0}%`, backgroundColor: l.cor }} />
                  </div>
                  <span className="text-sm font-semibold text-[#0F172A] w-28 text-right">{moeda(l.valor)}</span>
                  {divisor > 0 && <span className="text-xs text-[#64748B] w-28 text-right">{moeda(l.valor / divisor)}/{grandeza?.unidade || 'un'}</span>}
                </div>
              ))}
              <div className="flex items-center gap-3 pt-2 border-t border-[#F1F5F9]">
                <span className="w-2.5" />
                <span className="text-sm font-bold text-[#0F172A] flex-1">Total</span>
                <span className="text-sm font-bold text-[#0F172A] w-28 text-right">{moeda(total)}</span>
                {divisor > 0 && <span className="text-xs font-semibold text-[#374151] w-28 text-right">{moeda(total / divisor)}/{grandeza?.unidade || 'un'}</span>}
              </div>
            </div>
            {grandezas.length === 0 && (
              <p className="text-xs text-[#94A3B8] mt-2">Cadastre as grandezas da obra abaixo (máquinas, TR, m² de duto...) para ver o custo por unidade.</p>
            )}
          </div>

          <GrandezasEditor obraId={obraId} grandezas={grandezas} onChange={load} />

          <PrevisaoEditor
            obraId={obraId} previsoes={previsoes} produtos={produtos} categorias={categorias}
            realizadoProduto={id => qtdPorProduto.get(id) ?? 0}
            realizadoCategoria={id => porCategoria.get(id) ?? 0}
            produtoPorId={produtoPorId} categoriaPorId={categoriaPorId}
            onChange={load}
          />
        </div>
      )}
    </div>
  )
}

// ── Grandezas da obra ─────────────────────────────────
function GrandezasEditor({ obraId, grandezas, onChange }: { obraId: string; grandezas: Grandeza[]; onChange: () => void }) {
  const [editando, setEditando] = useState<Grandeza | 'nova' | null>(null)
  const [nome, setNome] = useState('')
  const [unidade, setUnidade] = useState('')
  const [valor, setValor] = useState('')

  function abrir(g: Grandeza | 'nova', sugestao?: { nome: string; unidade: string }) {
    setEditando(g)
    if (g === 'nova') { setNome(sugestao?.nome ?? ''); setUnidade(sugestao?.unidade ?? ''); setValor('') }
    else { setNome(g.nome); setUnidade(g.unidade ?? ''); setValor(String(g.valor)) }
  }

  async function salvar() {
    if (!nome.trim()) return
    const supabase = createClient()
    const dados = { nome: nome.trim(), unidade: unidade.trim() || null, valor: parseFloat(valor) || 0 }
    if (editando === 'nova') await supabase.from('obra_grandezas').insert({ obra_id: obraId, ...dados })
    else if (editando) await supabase.from('obra_grandezas').update(dados).eq('id', editando.id)
    setEditando(null)
    onChange()
  }

  async function excluir(g: Grandeza) {
    if (!confirm(`Excluir "${g.nome}"?`)) return
    await createClient().from('obra_grandezas').delete().eq('id', g.id)
    onChange()
  }

  const sugestoes = GRANDEZAS_SUGERIDAS.filter(s => !grandezas.some(g => g.nome.toLowerCase() === s.nome.toLowerCase()))

  return (
    <div>
      <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2 flex items-center gap-1.5"><Ruler size={12} /> Grandezas da obra</h4>
      <div className="flex flex-wrap gap-2">
        {grandezas.map(g => (
          <div key={g.id} className="group flex items-center gap-2 px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
            <span className="text-sm text-[#374151]">{g.nome}: <strong>{num(g.valor)}</strong> {g.unidade ?? ''}</span>
            <button onClick={() => abrir(g)} className="text-[#94A3B8] hover:text-[#4F7CFF]"><Pencil size={12} /></button>
            <button onClick={() => excluir(g)} className="text-[#94A3B8] hover:text-red-500"><Trash2 size={12} /></button>
          </div>
        ))}
        {sugestoes.map(s => (
          <button key={s.nome} onClick={() => abrir('nova', s)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-[#64748B] border border-dashed border-[#CBD5E1] rounded-lg hover:border-[#4F7CFF] hover:text-[#4F7CFF]">
            <Plus size={12} /> {s.nome} ({s.unidade})
          </button>
        ))}
        <button onClick={() => abrir('nova')}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-[#64748B] border border-dashed border-[#CBD5E1] rounded-lg hover:border-[#4F7CFF] hover:text-[#4F7CFF]">
          <Plus size={12} /> Outra
        </button>
      </div>
      {editando && (
        <div className="flex flex-wrap items-end gap-2 mt-3 p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-[#64748B] mb-1">Nome</label>
            <input className="field text-sm" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Máquinas" />
          </div>
          <div className="w-24">
            <label className="block text-xs text-[#64748B] mb-1">Unidade</label>
            <input className="field text-sm" value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="un, TR, m²" />
          </div>
          <div className="w-28">
            <label className="block text-xs text-[#64748B] mb-1">Quantidade</label>
            <input type="number" step="any" className="field text-sm" autoFocus value={valor} onChange={e => setValor(e.target.value)} />
          </div>
          <button onClick={salvar} className="btn-primary text-sm py-2"><Check size={14} /></button>
          <button onClick={() => setEditando(null)} className="px-3 py-2 text-sm text-[#64748B] hover:bg-[#F1F5F9] rounded-lg"><X size={14} /></button>
        </div>
      )}
    </div>
  )
}

// ── Previsto x realizado ──────────────────────────────
function PrevisaoEditor({ obraId, previsoes, produtos, categorias, realizadoProduto, realizadoCategoria, produtoPorId, categoriaPorId, onChange }: {
  obraId: string
  previsoes: Previsao[]
  produtos: ProdutoInfo[]
  categorias: EstoqueProdutoCategoria[]
  realizadoProduto: (id: string) => number
  realizadoCategoria: (id: string) => number
  produtoPorId: Map<string, ProdutoInfo>
  categoriaPorId: Map<string, EstoqueProdutoCategoria>
  onChange: () => void
}) {
  const [editando, setEditando] = useState<Previsao | 'nova' | null>(null)
  const [alvo, setAlvo] = useState('') // 'p:<id>' ou 'c:<id>'
  const [valor, setValor] = useState('')
  const [observacao, setObservacao] = useState('')

  function abrir(p: Previsao | 'nova') {
    setEditando(p)
    if (p === 'nova') { setAlvo(''); setValor(''); setObservacao('') }
    else {
      setAlvo(p.produto_id ? `p:${p.produto_id}` : `c:${p.categoria_id}`)
      setValor(String(p.produto_id ? p.quantidade ?? '' : p.valor ?? ''))
      setObservacao(p.observacao ?? '')
    }
  }

  async function salvar() {
    if (!alvo || !valor) return
    const [tipo, id] = alvo.split(':')
    const v = parseFloat(valor) || 0
    const dados = tipo === 'p'
      ? { produto_id: id, categoria_id: null, quantidade: v, valor: null, observacao: observacao.trim() || null }
      : { produto_id: null, categoria_id: id, quantidade: null, valor: v, observacao: observacao.trim() || null }
    const supabase = createClient()
    if (editando === 'nova') await supabase.from('obra_previsao_materiais').insert({ obra_id: obraId, ...dados })
    else if (editando) await supabase.from('obra_previsao_materiais').update(dados).eq('id', editando.id)
    setEditando(null)
    onChange()
  }

  async function excluir(p: Previsao) {
    if (!confirm('Excluir esta previsão?')) return
    await createClient().from('obra_previsao_materiais').delete().eq('id', p.id)
    onChange()
  }

  const alvoTipo = alvo.split(':')[0]
  const alvoProduto = alvoTipo === 'p' ? produtoPorId.get(alvo.split(':')[1]) : null

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide flex items-center gap-1.5"><Target size={12} /> Previsto x realizado</h4>
        <button onClick={() => abrir('nova')} className="flex items-center gap-1 text-xs font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] px-2 py-1 rounded-lg">
          <Plus size={12} /> Previsão
        </button>
      </div>
      {previsoes.length === 0 && !editando && (
        <p className="text-xs text-[#94A3B8]">
          Lance quanto você espera gastar nesta obra (ex.: 500 parafusos, ou R$ 2.000 de Fixação). O app compara com o que saiu menos o que voltou e avisa quando estourar.
        </p>
      )}
      {previsoes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                <th className="text-left text-xs font-semibold text-[#64748B] px-2 py-2">Item</th>
                <th className="text-right text-xs font-semibold text-[#64748B] px-2 py-2">Previsto</th>
                <th className="text-right text-xs font-semibold text-[#64748B] px-2 py-2">Realizado</th>
                <th className="text-left text-xs font-semibold text-[#64748B] px-2 py-2 w-40">Consumo</th>
                <th className="w-14" />
              </tr>
            </thead>
            <tbody>
              {previsoes.map(p => {
                const prod = p.produto_id ? produtoPorId.get(p.produto_id) : null
                const cat = p.categoria_id ? categoriaPorId.get(p.categoria_id) : null
                const previsto = (p.produto_id ? p.quantidade : p.valor) ?? 0
                const realizado = p.produto_id ? realizadoProduto(p.produto_id) : realizadoCategoria(p.categoria_id!)
                const pct = previsto > 0 ? realizado / previsto : 0
                const cor = pct > MARGEM_ALERTA ? '#EF4444' : pct > 1 ? '#F59E0B' : '#10B981'
                const fmt = (v: number) => p.produto_id ? `${num(v)} ${prod?.unidade ?? ''}` : moeda(v)
                return (
                  <tr key={p.id} className="border-b border-[#F1F5F9] group">
                    <td className="px-2 py-2 text-sm text-[#374151]">
                      {prod?.nome ?? (cat ? `Categoria: ${cat.nome}` : '(item removido)')}
                      {p.observacao && <span className="block text-[11px] text-[#94A3B8]">{p.observacao}</span>}
                    </td>
                    <td className="px-2 py-2 text-sm text-right text-[#374151]">{fmt(previsto)}</td>
                    <td className="px-2 py-2 text-sm text-right font-semibold" style={{ color: cor }}>{fmt(realizado)}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct * 100)}%`, backgroundColor: cor }} />
                        </div>
                        <span className="text-xs font-semibold w-11 text-right" style={{ color: cor }}>{Math.round(pct * 100)}%</span>
                      </div>
                      {pct > MARGEM_ALERTA && <span className="text-[10px] font-semibold text-red-600">Acima do previsto — verificar</span>}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => abrir(p)} className="text-[#94A3B8] hover:text-[#4F7CFF]"><Pencil size={13} /></button>
                        <button onClick={() => excluir(p)} className="text-[#94A3B8] hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {editando && (
        <div className="flex flex-wrap items-end gap-2 mt-3 p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-[#64748B] mb-1">Produto ou categoria</label>
            <select className="field text-sm" value={alvo} onChange={e => setAlvo(e.target.value)}>
              <option value="">Selecione...</option>
              <optgroup label="Categoria (previsão em R$)">
                {categorias.map(c => <option key={c.id} value={`c:${c.id}`}>{c.nome}</option>)}
              </optgroup>
              <optgroup label="Produto (previsão em quantidade)">
                {produtos.map(p => <option key={p.id} value={`p:${p.id}`}>{p.nome}</option>)}
              </optgroup>
            </select>
          </div>
          <div className="w-32">
            <label className="block text-xs text-[#64748B] mb-1">{alvoTipo === 'c' ? 'Valor (R$)' : `Quantidade${alvoProduto ? ` (${alvoProduto.unidade})` : ''}`}</label>
            <input type="number" step="any" min="0" className="field text-sm" value={valor} onChange={e => setValor(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-[#64748B] mb-1">Observação</label>
            <input className="field text-sm" value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Opcional" />
          </div>
          <button onClick={salvar} disabled={!alvo || !valor} className="btn-primary text-sm py-2"><Check size={14} /></button>
          <button onClick={() => setEditando(null)} className="px-3 py-2 text-sm text-[#64748B] hover:bg-[#F1F5F9] rounded-lg"><X size={14} /></button>
        </div>
      )}
    </div>
  )
}
