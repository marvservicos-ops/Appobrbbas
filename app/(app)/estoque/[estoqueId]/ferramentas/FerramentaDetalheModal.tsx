'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Wrench, Building2, QrCode, Undo2, Hammer, Ban, CheckCircle2, Pencil, Briefcase, UserCheck, Plus, ChevronLeft, Printer, Trash2, Search, Package, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Ferramenta, FerramentaEmprestimoItem, FerramentaDefeito, CampoTecnico, FerramentaDado, EstoqueProduto, MalaEstoqueProduto, MalaEstoqueRegistro } from '@/lib/types'
import ModalDevolverItem from './ModalDevolverItem'
import ModalDefeito from './ModalDefeito'
import ModalEditarFerramenta from './ModalEditarFerramenta'
import ModalAtribuirMala from './ModalAtribuirMala'
import ModalNovaFerramenta from './ModalNovaFerramenta'

function statusLabelMap(modoPatrimonio: boolean): Record<string, string> {
  return modoPatrimonio
    ? { disponivel: 'Em operação', emprestada: 'Em uso', em_manutencao: 'Com defeito', baixada: 'Fora de uso' }
    : { disponivel: 'Disponível', emprestada: 'Emprestada', em_manutencao: 'Em manutenção', baixada: 'Baixada' }
}
const STATUS_COLOR: Record<string, string> = {
  disponivel: 'bg-emerald-50 text-emerald-700', emprestada: 'bg-amber-50 text-amber-700',
  em_manutencao: 'bg-red-50 text-red-700', baixada: 'bg-[#F1F5F9] text-[#64748B]',
}
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

function DadosTecnicos({ ferramentaId }: { ferramentaId: string }) {
  const [todos, setTodos] = useState<CampoTecnico[]>([])
  const [dados, setDados] = useState<FerramentaDado[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [novoCampo, setNovoCampo] = useState('')
  const [editando, setEditando] = useState<Record<string, string>>({})

  async function load() {
    const sb = createClient()
    const [{ data: c }, { data: d }] = await Promise.all([
      sb.from('campos_tecnicos').select('*').order('ordem').order('nome'),
      sb.from('ferramenta_dados').select('*, campo:campos_tecnicos(*)').eq('ferramenta_id', ferramentaId),
    ])
    setTodos((c ?? []) as CampoTecnico[])
    setDados((d ?? []) as unknown as FerramentaDado[])
  }

  useEffect(() => { load() }, [ferramentaId])

  const dadosCampoIds = new Set(dados.map(d => d.campo_id))
  const disponiveis = todos.filter(c => !dadosCampoIds.has(c.id))

  async function adicionarCampo(campo: CampoTecnico) {
    const { data } = await createClient().from('ferramenta_dados').insert({
      ferramenta_id: ferramentaId, campo_id: campo.id, valor: '',
    }).select('*, campo:campos_tecnicos(*)').single()
    if (data) setDados(prev => [...prev, data as unknown as FerramentaDado])
    setShowPicker(false)
  }

  async function criarEAdicionar() {
    if (!novoCampo.trim()) return
    const sb = createClient()
    const { data: campo } = await sb.from('campos_tecnicos').insert({
      nome: novoCampo.trim(), ordem: todos.length,
    }).select().single()
    if (!campo) return
    setTodos(prev => [...prev, campo as CampoTecnico])
    await adicionarCampo(campo as CampoTecnico)
    setNovoCampo('')
  }

  async function salvarValor(dado: FerramentaDado) {
    const valor = editando[dado.id] ?? dado.valor
    await createClient().from('ferramenta_dados').update({ valor }).eq('id', dado.id)
    setDados(prev => prev.map(d => d.id === dado.id ? { ...d, valor } : d))
    setEditando(prev => { const n = { ...prev }; delete n[dado.id]; return n })
  }

  async function removerDado(dadoId: string) {
    await createClient().from('ferramenta_dados').delete().eq('id', dadoId)
    setDados(prev => prev.filter(d => d.id !== dadoId))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-[#374151]">Dados Técnicos</h3>
        <button onClick={() => setShowPicker(v => !v)}
          className="flex items-center gap-1 text-xs font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] px-2 py-1 rounded-lg transition-colors">
          <Plus size={12} /> Adicionar campo
        </button>
      </div>

      {showPicker && (
        <div className="mb-3 border border-[#E2E8F0] rounded-xl overflow-hidden">
          {disponiveis.length > 0 && (
            <div className="divide-y divide-[#F1F5F9] max-h-40 overflow-y-auto">
              {disponiveis.map(c => (
                <button key={c.id} onClick={() => adicionarCampo(c)}
                  className="w-full text-left px-3 py-2 text-xs text-[#0F172A] hover:bg-[#F8FAFC] flex items-center justify-between group transition-colors">
                  <span>{c.nome}{c.unidade ? ` (${c.unidade})` : ''}</span>
                  <Plus size={12} className="text-[#4F7CFF] opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 p-2.5 bg-[#F8FAFC] border-t border-[#E2E8F0]">
            <input
              autoFocus
              className="field text-xs py-1.5 flex-1"
              placeholder="Criar novo campo..."
              value={novoCampo}
              onChange={e => setNovoCampo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') criarEAdicionar(); if (e.key === 'Escape') setShowPicker(false) }}
            />
            <button onClick={criarEAdicionar} disabled={!novoCampo.trim()}
              className="text-xs bg-[#4F7CFF] text-white px-2.5 py-1.5 rounded-lg hover:bg-[#3D68F0] disabled:opacity-50">
              Criar
            </button>
          </div>
        </div>
      )}

      {dados.length === 0 ? (
        <p className="text-xs text-[#94A3B8]">Nenhum dado técnico cadastrado ainda.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {dados.map(d => (
            <div key={d.id} className="bg-[#F8FAFC] rounded-lg px-3 py-2">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[11px] text-[#94A3B8]">{d.campo.nome}{d.campo.unidade ? ` (${d.campo.unidade})` : ''}</p>
                <button onClick={() => removerDado(d.id)} className="text-[#CBD5E1] hover:text-red-400 shrink-0">
                  <Trash2 size={11} />
                </button>
              </div>
              <input
                className="text-sm font-medium text-[#0F172A] bg-transparent border-b border-transparent focus:border-[#4F7CFF] focus:outline-none w-full"
                value={editando[d.id] ?? d.valor}
                onChange={e => setEditando(prev => ({ ...prev, [d.id]: e.target.value }))}
                onBlur={() => salvarValor(d)}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ModalAdicionarMaterialMala({ malaId, estoqueId, jaRastreados, onClose, onSaved }: {
  malaId: string; estoqueId: string; jaRastreados: string[]; onClose: () => void; onSaved: () => void
}) {
  const [catalogo, setCatalogo] = useState<EstoqueProduto[]>([])
  const [produtoId, setProdutoId] = useState('')
  const [quantidadeMinima, setQuantidadeMinima] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    createClient().from('estoque_produtos').select('*').eq('estoque_id', estoqueId).eq('ativo', true).order('nome')
      .then(({ data }) => setCatalogo((data ?? []) as EstoqueProduto[]))
  }, [estoqueId])

  const disponiveis = catalogo.filter(p => !jaRastreados.includes(p.id))

  async function salvar() {
    if (!produtoId) return
    setSaving(true)
    await createClient().from('mala_estoque_produtos').insert({
      mala_id: malaId, produto_id: produtoId, quantidade_minima: parseFloat(quantidadeMinima) || 0,
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#0F172A]">Adicionar material</h3>
          <button onClick={onClose}><X size={18} className="text-[#94A3B8]" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[#64748B] block mb-1">Material do catálogo *</label>
            <select className="field text-sm" value={produtoId} onChange={e => setProdutoId(e.target.value)}>
              <option value="">Selecione...</option>
              {disponiveis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[#64748B] block mb-1">Quantidade mínima</label>
            <input type="number" min="0" step="any" className="field text-sm" value={quantidadeMinima} onChange={e => setQuantidadeMinima(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-xs text-[#64748B] px-3 py-1.5 hover:bg-[#F1F5F9] rounded-lg">Cancelar</button>
          <button onClick={salvar} disabled={!produtoId || saving} className="text-xs bg-[#4F7CFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#3D68F0] disabled:opacity-50">Adicionar</button>
        </div>
      </div>
    </div>
  )
}

function ModalMovimentacaoMaterialMala({ malaId, produtos, onClose, onSaved }: {
  malaId: string; produtos: MalaEstoqueProduto[]; onClose: () => void; onSaved: () => void
}) {
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('saida')
  const [produtoId, setProdutoId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [observacoes, setObservacoes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const produto = produtos.find(p => p.produto_id === produtoId)

  async function salvar() {
    setError('')
    const qtd = parseFloat(quantidade)
    if (!produtoId) { setError('Selecione o material.'); return }
    if (!qtd || qtd <= 0) { setError('Informe a quantidade.'); return }
    if (!responsavel.trim()) { setError('Informe o responsável.'); return }
    if (tipo === 'saida' && produto && produto.quantidade_atual - qtd < 0) {
      setError(`Saldo insuficiente. Disponível: ${produto.quantidade_atual}.`); return
    }
    setSaving(true)
    const sb = createClient()
    await sb.from('mala_estoque_registros').insert({
      mala_id: malaId, produto_id: produtoId, tipo, quantidade: qtd,
      responsavel: responsavel.trim(), data, observacoes: observacoes || null,
    })
    if (produto) {
      const novaQtd = produto.quantidade_atual + (tipo === 'entrada' ? qtd : -qtd)
      await sb.from('mala_estoque_produtos').update({ quantidade_atual: novaQtd }).eq('id', produto.id)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#0F172A]">Nova movimentação</h3>
          <button onClick={onClose}><X size={18} className="text-[#94A3B8]" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(['saida', 'entrada'] as const).map(t => (
              <button key={t} type="button" onClick={() => setTipo(t)}
                className={`py-2 rounded-lg text-xs font-medium border-2 transition-all ${tipo === t
                  ? t === 'saida' ? 'border-red-400 bg-red-50 text-red-600' : 'border-green-400 bg-green-50 text-green-600'
                  : 'border-[#E2E8F0] text-[#64748B]'}`}>
                {t === 'saida' ? 'Saída' : 'Entrada'}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs font-medium text-[#64748B] block mb-1">Material *</label>
            <select className="field text-sm" value={produtoId} onChange={e => setProdutoId(e.target.value)}>
              <option value="">Selecione...</option>
              {produtos.map(p => <option key={p.produto_id} value={p.produto_id}>{p.produto?.nome} ({p.quantidade_atual} {p.produto?.unidade})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#64748B] block mb-1">Quantidade *</label>
              <input type="number" min="0" step="any" className="field text-sm" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#64748B] block mb-1">Data</label>
              <input type="date" className="field text-sm" value={data} onChange={e => setData(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[#64748B] block mb-1">Responsável *</label>
            <input className="field text-sm" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#64748B] block mb-1">Observações</label>
            <input className="field text-sm" value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-xs text-[#64748B] px-3 py-1.5 hover:bg-[#F1F5F9] rounded-lg">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="text-xs bg-[#4F7CFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#3D68F0] disabled:opacity-50">Salvar</button>
        </div>
      </div>
    </div>
  )
}

function MateriaisMala({ malaId, estoqueId }: { malaId: string; estoqueId: string }) {
  const [produtos, setProdutos] = useState<MalaEstoqueProduto[]>([])
  const [registros, setRegistros] = useState<MalaEstoqueRegistro[]>([])
  const [showAdicionar, setShowAdicionar] = useState(false)
  const [showMovimentacao, setShowMovimentacao] = useState(false)

  async function load() {
    const sb = createClient()
    const [{ data: p }, { data: r }] = await Promise.all([
      sb.from('mala_estoque_produtos').select('*, produto:estoque_produtos(nome, unidade)').eq('mala_id', malaId).order('created_at'),
      sb.from('mala_estoque_registros').select('*, produto:estoque_produtos(nome, unidade)').eq('mala_id', malaId).order('created_at', { ascending: false }).limit(20),
    ])
    setProdutos((p ?? []) as unknown as MalaEstoqueProduto[])
    setRegistros((r ?? []) as unknown as MalaEstoqueRegistro[])
  }

  useEffect(() => { load() }, [malaId])

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-[#374151]">Materiais de uso</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowAdicionar(true)}
            className="flex items-center gap-1 text-xs font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] px-2 py-1 rounded-lg transition-colors">
            <Plus size={12} /> Adicionar material
          </button>
          <button onClick={() => setShowMovimentacao(true)} disabled={produtos.length === 0}
            className="flex items-center gap-1 text-xs font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] px-2 py-1 rounded-lg transition-colors disabled:opacity-40">
            <Plus size={12} /> Movimentação
          </button>
        </div>
      </div>

      {produtos.length === 0 ? (
        <p className="text-xs text-[#94A3B8]">Nenhum material de uso cadastrado nesta mala ainda.</p>
      ) : (
        <div className="space-y-1.5">
          {produtos.map(p => {
            const critico = p.quantidade_atual <= p.quantidade_minima && p.quantidade_minima > 0
            return (
              <div key={p.id} className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 ${critico ? 'bg-amber-50' : 'bg-[#F8FAFC]'}`}>
                <span className="text-[#374151] font-medium">{p.produto?.nome}</span>
                <span className="flex items-center gap-1.5">
                  {critico && <span className="px-1.5 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700">Crítico</span>}
                  <span className="font-semibold text-[#0F172A]">{p.quantidade_atual} {p.produto?.unidade}</span>
                </span>
              </div>
            )
          })}
        </div>
      )}

      {registros.length > 0 && (
        <div className="mt-3 space-y-1">
          {registros.map(r => (
            <div key={r.id} className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
              {r.tipo === 'entrada'
                ? <ArrowDownCircle size={12} className="text-green-500 shrink-0" />
                : <ArrowUpCircle size={12} className="text-red-500 shrink-0" />}
              <span className="truncate">{r.produto?.nome} · {r.responsavel ?? '—'} · {fmtData(r.data)}</span>
              <span className={`ml-auto font-semibold ${r.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                {r.tipo === 'entrada' ? '+' : '-'}{r.quantidade}
              </span>
            </div>
          ))}
        </div>
      )}

      {showAdicionar && (
        <ModalAdicionarMaterialMala malaId={malaId} estoqueId={estoqueId} jaRastreados={produtos.map(p => p.produto_id)}
          onClose={() => setShowAdicionar(false)} onSaved={() => { setShowAdicionar(false); load() }} />
      )}
      {showMovimentacao && (
        <ModalMovimentacaoMaterialMala malaId={malaId} produtos={produtos}
          onClose={() => setShowMovimentacao(false)} onSaved={() => { setShowMovimentacao(false); load() }} />
      )}
    </div>
  )
}

export default function FerramentaDetalheModal({ ferramentaId, modoPatrimonio = false, onClose, onChanged }: {
  ferramentaId: string; modoPatrimonio?: boolean; onClose: () => void; onChanged: () => void
}) {
  const STATUS_LABEL = statusLabelMap(modoPatrimonio)
  const [currentId, setCurrentId] = useState(ferramentaId)
  const [voltarPara, setVoltarPara] = useState<string | null>(null)
  const [ferramenta, setFerramenta] = useState<Ferramenta | null>(null)
  const [conteudoMala, setConteudoMala] = useState<Ferramenta[]>([])
  const [historicoEmprestimos, setHistoricoEmprestimos] = useState<FerramentaEmprestimoItem[]>([])
  const [defeitos, setDefeitos] = useState<FerramentaDefeito[]>([])
  const [loading, setLoading] = useState(true)
  const [showQr, setShowQr] = useState(false)
  const [showDevolver, setShowDevolver] = useState(false)
  const [showDefeito, setShowDefeito] = useState(false)
  const [showEditar, setShowEditar] = useState(false)
  const [showAtribuir, setShowAtribuir] = useState(false)
  const [showNovoItemMala, setShowNovoItemMala] = useState(false)
  const [buscaMala, setBuscaMala] = useState('')
  const [processando, setProcessando] = useState(false)

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const [{ data: f }, { data: hist }, { data: defs }] = await Promise.all([
      supabase.from('ferramentas').select('*, mala:mala_id(id, nome, codigo_interno, responsavel_atual:funcionarios(id, nome)), responsavel_atual:funcionarios(id, nome)').eq('id', currentId).single(),
      supabase.from('ferramenta_emprestimo_itens').select('*, emprestimo:ferramenta_emprestimos(*, funcionario:funcionarios(id, nome))').eq('ferramenta_id', currentId).order('created_at', { ascending: false }),
      supabase.from('ferramenta_defeitos').select('*').eq('ferramenta_id', currentId).order('data', { ascending: false }),
    ])
    setFerramenta(f as unknown as Ferramenta)
    setHistoricoEmprestimos((hist ?? []) as unknown as FerramentaEmprestimoItem[])
    setDefeitos(defs ?? [])

    if ((f as any)?.eh_mala) {
      const { data: itens } = await supabase.from('ferramentas').select('*').eq('mala_id', currentId).order('nome')
      setConteudoMala(itens ?? [])
    } else {
      setConteudoMala([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [currentId])

  function abrirFilho(id: string) {
    setVoltarPara(currentId)
    setCurrentId(id)
  }
  function voltar() {
    if (voltarPara) { setCurrentId(voltarPara); setVoltarPara(null) }
  }

  const itemAberto = historicoEmprestimos.find(h => !h.data_devolucao)

  async function concluirManutencao() {
    if (!ferramenta) return
    setProcessando(true)
    const supabase = createClient()
    const defeitoAberto = defeitos.find(d => !d.resolvido)
    if (defeitoAberto) {
      await supabase.from('ferramenta_defeitos').update({ resolvido: true, data_resolucao: new Date().toISOString().split('T')[0] }).eq('id', defeitoAberto.id)
    }
    await supabase.from('ferramentas').update({ status: 'disponivel' }).eq('id', ferramenta.id)
    setProcessando(false)
    load(); onChanged()
  }

  async function darBaixa() {
    if (!ferramenta) return
    if (!confirm('Dar baixa nesta ferramenta? Essa ação é definitiva e ela deixará de contar no patrimônio ativo.')) return
    setProcessando(true)
    const supabase = createClient()
    await supabase.from('ferramentas').update({ status: 'baixada' }).eq('id', ferramenta.id)
    setProcessando(false)
    load(); onChanged()
  }

  const url = typeof window !== 'undefined' && ferramenta ? `${window.location.origin}/pub/ferramenta/${ferramenta.id}` : ''
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(url)}`

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[calc(100dvh-env(safe-area-inset-top))] overflow-y-auto mt-auto sm:mt-0">
        {loading || !ferramenta ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={24} className="animate-spin text-[#4F7CFF]" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                {voltarPara && (
                  <button onClick={voltar} className="text-[#94A3B8] hover:text-[#4F7CFF] transition-colors" title="Voltar para a mala">
                    <ChevronLeft size={16} />
                  </button>
                )}
                <h2 className="font-syne font-semibold text-[#0F172A]">{ferramenta.nome}</h2>
                {ferramenta.codigo_interno && <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">{ferramenta.codigo_interno}</span>}
                <button onClick={() => setShowEditar(true)} className="text-[#94A3B8] hover:text-[#4F7CFF] transition-colors" title={modoPatrimonio ? 'Editar item' : 'Editar ferramenta'}>
                  <Pencil size={14} />
                </button>
              </div>
              <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
            </div>

            <div className="p-4 md:p-6 space-y-5">
              {ferramenta.mala_id && ferramenta.mala && (
                <button onClick={() => abrirFilho(ferramenta.mala!.id)}
                  className="w-full text-left flex items-center gap-2 text-xs text-[#4F7CFF] bg-[#EEF2FF] px-3 py-2 rounded-lg hover:bg-[#E0E7FF] transition-colors">
                  <Briefcase size={13} /> Faz parte da mala <strong>{ferramenta.mala.nome}</strong>{ferramenta.mala.codigo_interno ? ` (${ferramenta.mala.codigo_interno})` : ''}
                </button>
              )}

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {ferramenta.foto_url
                    ? <img src={ferramenta.foto_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-[#E2E8F0]" />
                    : <div className="w-16 h-16 rounded-xl bg-[#F1F5F9] flex items-center justify-center text-[#94A3B8]">
                        {ferramenta.eh_mala ? <Briefcase size={22} /> : modoPatrimonio ? <Building2 size={22} /> : <Wrench size={22} />}
                      </div>}
                  {ferramenta.foto_url_2 && (
                    <img src={ferramenta.foto_url_2} alt="" className="w-16 h-16 rounded-xl object-cover border border-[#E2E8F0]" />
                  )}
                </div>
                <div>
                  {ferramenta.eh_mala ? (
                    ferramenta.responsavel_atual
                      ? <p className="text-sm font-medium text-[#4F7CFF]">Com {ferramenta.responsavel_atual.nome}</p>
                      : <p className="text-sm text-[#94A3B8]">Sem responsável definido</p>
                  ) : ferramenta.mala_id && ferramenta.status === 'disponivel' ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#4F7CFF]">
                      {ferramenta.mala?.responsavel_atual ? `Com ${ferramenta.mala.responsavel_atual.nome} (na mala)` : 'Na mala · sem responsável'}
                    </span>
                  ) : (
                    <>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[ferramenta.status]}`}>
                        {STATUS_LABEL[ferramenta.status]}
                      </span>
                      {itemAberto?.emprestimo?.funcionario && (
                        <p className="text-xs text-amber-700 font-medium mt-1">com {itemAberto.emprestimo.funcionario.nome} desde {fmtData(itemAberto.emprestimo.data_emprestimo)}</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-[#94A3B8]">Código interno</p><p className="text-[#374151] font-mono">{ferramenta.codigo_interno || '—'}</p></div>
                <div><p className="text-xs text-[#94A3B8]">Categoria</p><p className="text-[#374151]">{ferramenta.categoria || '—'}</p></div>
                <div><p className="text-xs text-[#94A3B8]">Marca / Modelo</p><p className="text-[#374151]">{[ferramenta.marca, ferramenta.modelo].filter(Boolean).join(' · ') || '—'}</p></div>
                <div><p className="text-xs text-[#94A3B8]">Nº de série</p><p className="text-[#374151]">{ferramenta.numero_serie || '—'}</p></div>
                <div><p className="text-xs text-[#94A3B8]">Valor de aquisição</p><p className="text-[#374151]">{ferramenta.valor_aquisicao ? moeda(ferramenta.valor_aquisicao) : '—'}</p></div>
              </div>

              {/* Ações */}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowQr(true)}
                  className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0] px-3 py-1.5 rounded-xl hover:bg-[#F8FAFC] transition-colors">
                  <QrCode size={13} /> QR Code
                </button>
                {ferramenta.eh_mala && (
                  <button onClick={() => setShowAtribuir(true)}
                    className="flex items-center gap-1.5 text-xs text-[#4F7CFF] border border-[#C7D2FE] px-3 py-1.5 rounded-xl hover:bg-[#EEF2FF] transition-colors">
                    <UserCheck size={13} /> {ferramenta.responsavel_atual ? 'Trocar responsável' : 'Atribuir responsável'}
                  </button>
                )}
                {ferramenta.eh_mala && (
                  <a href={`/print/mala/${ferramenta.id}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0] px-3 py-1.5 rounded-xl hover:bg-[#F8FAFC] transition-colors">
                    <Printer size={13} /> Imprimir contrato
                  </a>
                )}
                {!ferramenta.eh_mala && !ferramenta.mala_id && ferramenta.status === 'emprestada' && itemAberto && (
                  <button onClick={() => setShowDevolver(true)}
                    className="flex items-center gap-1.5 text-xs text-amber-700 border border-amber-200 px-3 py-1.5 rounded-xl hover:bg-amber-50 transition-colors">
                    <Undo2 size={13} /> Devolver
                  </button>
                )}
                {!ferramenta.eh_mala && ferramenta.status !== 'emprestada' && ferramenta.status !== 'baixada' && ferramenta.status !== 'em_manutencao' && (
                  <button onClick={() => setShowDefeito(true)}
                    className="flex items-center gap-1.5 text-xs text-red-700 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors">
                    <Hammer size={13} /> Registrar defeito
                  </button>
                )}
                {!ferramenta.eh_mala && ferramenta.status === 'em_manutencao' && (
                  <button onClick={concluirManutencao} disabled={processando}
                    className="flex items-center gap-1.5 text-xs text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl hover:bg-emerald-50 transition-colors">
                    <CheckCircle2 size={13} /> Concluir manutenção
                  </button>
                )}
                {!ferramenta.eh_mala && (ferramenta.status === 'disponivel' || ferramenta.status === 'em_manutencao') && (
                  <button onClick={darBaixa} disabled={processando}
                    className="flex items-center gap-1.5 text-xs text-[#64748B] border border-[#E2E8F0] px-3 py-1.5 rounded-xl hover:bg-[#F1F5F9] transition-colors ml-auto">
                    <Ban size={13} /> Dar baixa
                  </button>
                )}
              </div>

              {/* Conteúdo da mala */}
              {ferramenta.eh_mala && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#374151]">Conteúdo da mala</h3>
                    <button onClick={() => setShowNovoItemMala(true)} className="flex items-center gap-1 text-xs font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] px-2 py-1 rounded-lg transition-colors">
                      <Plus size={12} /> Adicionar item
                    </button>
                  </div>
                  {conteudoMala.length === 0 ? (
                    <p className="text-xs text-[#94A3B8]">Nenhuma ferramenta cadastrada nesta mala ainda.</p>
                  ) : (
                    <>
                      <div className="relative mb-2">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                        <input value={buscaMala} onChange={e => setBuscaMala(e.target.value)}
                          placeholder="Buscar por nome ou código..."
                          className="field pl-8 text-xs py-1.5" />
                      </div>
                      {(() => {
                        const termo = buscaMala.trim().toLowerCase()
                        const itensFiltrados = termo
                          ? conteudoMala.filter(item =>
                              item.nome.toLowerCase().includes(termo) ||
                              (item.codigo_interno ?? '').toLowerCase().includes(termo))
                          : conteudoMala
                        return itensFiltrados.length === 0 ? (
                          <p className="text-xs text-[#94A3B8]">Nenhum item encontrado.</p>
                        ) : (
                    <div className="space-y-1.5">
                      {itensFiltrados.map(item => (
                        <button key={item.id} onClick={() => abrirFilho(item.id)}
                          className="w-full flex items-center justify-between text-xs bg-[#F8FAFC] hover:bg-[#F1F5F9] rounded-lg px-3 py-2 transition-colors text-left">
                          <span className="text-[#374151] font-medium">{item.nome}{item.codigo_interno ? ` · ${item.codigo_interno}` : ''}</span>
                          {item.status === 'disponivel' ? (
                            <span className="px-1.5 py-0.5 rounded-full font-semibold bg-[#EEF2FF] text-[#4F7CFF]">Na mala</span>
                          ) : (
                            <span className={`px-1.5 py-0.5 rounded-full font-semibold ${STATUS_COLOR[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                          )}
                        </button>
                      ))}
                    </div>
                        )
                      })()}
                    </>
                  )}
                </div>
              )}

              {/* Materiais de uso (consumíveis) da mala */}
              {ferramenta.eh_mala && (
                <MateriaisMala malaId={ferramenta.id} estoqueId={ferramenta.estoque_id} />
              )}

              {/* Histórico de empréstimos */}
              {!modoPatrimonio && !ferramenta.eh_mala && !ferramenta.mala_id && (
                <div>
                  <h3 className="text-sm font-semibold text-[#374151] mb-2">Histórico de empréstimos</h3>
                  {historicoEmprestimos.length === 0 ? (
                    <p className="text-xs text-[#94A3B8]">Nenhum empréstimo registrado.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {historicoEmprestimos.map(h => (
                        <div key={h.id} className="flex items-center justify-between text-xs bg-[#F8FAFC] rounded-lg px-3 py-2">
                          <span className="text-[#374151]">{h.emprestimo?.funcionario?.nome ?? '—'}</span>
                          <span className="text-[#94A3B8]">{fmtData(h.emprestimo?.data_emprestimo)} → {h.data_devolucao ? fmtData(h.data_devolucao) : 'em aberto'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Dados técnicos */}
              {!ferramenta.eh_mala && <DadosTecnicos ferramentaId={ferramenta.id} />}

              {/* Histórico de defeitos */}
              <div>
                <h3 className="text-sm font-semibold text-[#374151] mb-2">Histórico de defeitos</h3>
                {defeitos.length === 0 ? (
                  <p className="text-xs text-[#94A3B8]">Nenhum defeito registrado.</p>
                ) : (
                  <div className="space-y-1.5">
                    {defeitos.map(d => (
                      <div key={d.id} className="text-xs bg-[#F8FAFC] rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[#374151] font-medium">{d.descricao}</span>
                          <span className={d.resolvido ? 'text-emerald-600' : 'text-red-600'}>{d.resolvido ? 'Resolvido' : 'Em aberto'}</span>
                        </div>
                        <span className="text-[#94A3B8]">{fmtData(d.data)}{d.custo ? ` · ${moeda(d.custo)}` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {showQr && ferramenta && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => setShowQr(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-col items-center gap-4 max-w-xs w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-syne font-semibold text-[#0F172A]">{modoPatrimonio ? 'QR Code do Patrimônio' : 'QR Code da Ferramenta'}</h3>
            <img src={qrSrc} alt="QR Code" className="w-56 h-56 rounded-xl" />
            <p className="text-xs text-[#94A3B8] text-center">Escaneie para ver a ficha pública {modoPatrimonio ? 'deste item' : 'desta ferramenta'}</p>
            <div className="flex gap-2 w-full">
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center text-xs text-[#4F7CFF] border border-[#C7D2FE] px-3 py-2 rounded-lg hover:bg-[#EEF2FF] transition-colors">
                Abrir ficha
              </a>
              <a href={`/pub/etiqueta-ferramenta/${ferramenta.id}`} target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center text-xs bg-[#4F7CFF] text-white px-3 py-2 rounded-lg hover:bg-[#3D68F0] transition-colors">
                Imprimir etiqueta
              </a>
            </div>
            <button onClick={() => setShowQr(false)} className="text-xs text-[#94A3B8] hover:text-[#64748B]">Fechar</button>
          </div>
        </div>
      )}

      {showDevolver && itemAberto && (
        <ModalDevolverItem item={itemAberto} onClose={() => setShowDevolver(false)} onSaved={() => { setShowDevolver(false); load(); onChanged() }} />
      )}
      {showDefeito && ferramenta && (
        <ModalDefeito ferramentaId={ferramenta.id} onClose={() => setShowDefeito(false)} onSaved={() => { setShowDefeito(false); load(); onChanged() }} />
      )}
      {showEditar && ferramenta && (
        <ModalEditarFerramenta ferramenta={ferramenta} modoPatrimonio={modoPatrimonio} onClose={() => setShowEditar(false)} onSaved={() => { setShowEditar(false); load(); onChanged() }} />
      )}
      {showAtribuir && ferramenta && (
        <ModalAtribuirMala ferramentaId={ferramenta.id} responsavelAtualId={ferramenta.responsavel_atual_id}
          onClose={() => setShowAtribuir(false)}
          onSaved={() => { setShowAtribuir(false); load(); onChanged(); window.open(`/print/mala/${ferramenta.id}`, '_blank') }} />
      )}
      {showNovoItemMala && ferramenta && (
        <ModalNovaFerramenta estoqueId={ferramenta.estoque_id} malaIdPadrao={ferramenta.id}
          onClose={() => setShowNovoItemMala(false)}
          onCreated={() => { setShowNovoItemMala(false); load(); onChanged() }} />
      )}
    </div>
  )
}
