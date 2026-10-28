'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { X, Loader2, Wrench, Building2, QrCode, Undo2, Hammer, Ban, CheckCircle2, Pencil, Briefcase, UserCheck, Plus, ChevronLeft, Printer, Trash2, Search, Package, ArrowDownCircle, ArrowUpCircle, FileText, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Ferramenta, FerramentaEmprestimoItem, FerramentaDefeito, CampoTecnico, FerramentaDado, EstoqueProduto, MalaEstoqueProduto, MalaEstoqueRegistro } from '@/lib/types'
import ModalDevolverItem from './ModalDevolverItem'
import ModalDefeito from './ModalDefeito'
import ModalEditarFerramenta from './ModalEditarFerramenta'
import ModalAtribuirMala from './ModalAtribuirMala'
import ModalNovaFerramenta from './ModalNovaFerramenta'
import { PhotoLightbox, usePhotoLightbox } from '@/components/PhotoLightbox'
import { mensagemErro } from '@/lib/erros'
import { hojeLocal } from '@/lib/datas'
import { arred, formatarQtd, numeroOuPadrao, parseNumeroBR } from '@/lib/numero'
import { ajustarSaldo } from '@/lib/estoque/saldo'
import { abrirAbaVazia } from './devolucao'

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
    const { data, error } = await createClient().from('ferramenta_dados').insert({
      ferramenta_id: ferramentaId, campo_id: campo.id, valor: '',
    }).select('*, campo:campos_tecnicos(*)').single()
    if (error || !data) { alert(mensagemErro(error, 'Erro ao adicionar campo')); return false }
    setDados(prev => [...prev, data as unknown as FerramentaDado])
    setShowPicker(false)
    return true
  }

  async function criarEAdicionar() {
    if (!novoCampo.trim()) return
    const sb = createClient()
    const { data: campo, error } = await sb.from('campos_tecnicos').insert({
      nome: novoCampo.trim(), ordem: todos.length,
    }).select().single()
    if (error || !campo) { alert(mensagemErro(error, 'Erro ao criar campo')); return }
    setTodos(prev => [...prev, campo as CampoTecnico])
    if (await adicionarCampo(campo as CampoTecnico)) setNovoCampo('')
  }

  async function salvarValor(dado: FerramentaDado) {
    const valor = editando[dado.id] ?? dado.valor
    if (valor === dado.valor) {
      setEditando(prev => { const n = { ...prev }; delete n[dado.id]; return n })
      return
    }
    const { error } = await createClient().from('ferramenta_dados').update({ valor }).eq('id', dado.id)
    // Falhou: volta a mostrar o valor salvo, não o digitado
    if (!error) setDados(prev => prev.map(d => d.id === dado.id ? { ...d, valor } : d))
    setEditando(prev => { const n = { ...prev }; delete n[dado.id]; return n })
    if (error) alert(mensagemErro(error, `Erro ao salvar "${dado.campo.nome}"`))
  }

  async function removerDado(dado: FerramentaDado) {
    if (!confirm(`Remover o dado técnico "${dado.campo.nome}"${dado.valor ? ` (${dado.valor})` : ''} desta ferramenta?`)) return
    const { error } = await createClient().from('ferramenta_dados').delete().eq('id', dado.id)
    if (error) { alert(mensagemErro(error, 'Erro ao remover dado técnico')); return }
    setDados(prev => prev.filter(d => d.id !== dado.id))
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
                  <Plus size={12} className="text-[#4F7CFF] opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100" />
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
                <button onClick={() => removerDado(d)} aria-label={`Remover ${d.campo.nome}`} title="Remover dado técnico"
                  className="p-2 -m-1.5 rounded-lg text-[#CBD5E1] hover:text-red-400 hover:bg-red-50 shrink-0">
                  <Trash2 size={13} />
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

// Sem `material`: adiciona um material do catálogo à mala.
// Com `material`: edita a quantidade mínima de um já rastreado.
function ModalAdicionarMaterialMala({ malaId, estoqueId, jaRastreados, material, onClose, onSaved }: {
  malaId: string; estoqueId: string; jaRastreados: string[]; material?: MalaEstoqueProduto; onClose: () => void; onSaved: () => void
}) {
  const [catalogo, setCatalogo] = useState<EstoqueProduto[]>([])
  const [produtoId, setProdutoId] = useState(material?.produto_id ?? '')
  const [quantidadeMinima, setQuantidadeMinima] = useState(material ? String(material.quantidade_minima).replace('.', ',') : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [modoNovo, setModoNovo] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novaUnidade, setNovaUnidade] = useState('un')

  useEffect(() => {
    if (material) return
    createClient().from('estoque_produtos').select('*').eq('estoque_id', estoqueId).eq('ativo', true).order('nome')
      .then(({ data }) => setCatalogo((data ?? []) as EstoqueProduto[]))
  }, [estoqueId, material])

  const disponiveis = catalogo.filter(p => !jaRastreados.includes(p.id))

  async function salvar() {
    if (saving) return
    setError('')
    const minima = numeroOuPadrao(quantidadeMinima, 0)
    if (minima < 0) { setError('Quantidade mínima inválida.'); return }
    setSaving(true)
    const sb = createClient()

    if (material) {
      const { error: errUpd } = await sb.from('mala_estoque_produtos').update({ quantidade_minima: minima }).eq('id', material.id)
      if (errUpd) { setError(mensagemErro(errUpd, 'Erro ao salvar')); setSaving(false); return }
      setSaving(false)
      onSaved()
      return
    }

    let idFinal = produtoId
    if (modoNovo) {
      if (!novoNome.trim()) { setError('Informe o nome do material.'); setSaving(false); return }
      const { data: novo, error: err } = await sb.from('estoque_produtos').insert({
        estoque_id: estoqueId, nome: novoNome.trim(), unidade: novaUnidade.trim() || 'un',
        quantidade_atual: 0, quantidade_minima: 0, ativo: true,
      }).select().single()
      if (err || !novo) { setError(mensagemErro(err, 'Erro ao criar material')); setSaving(false); return }
      idFinal = novo.id
    }

    if (!idFinal) { setError('Selecione ou cadastre um material.'); setSaving(false); return }

    const { error: err2 } = await sb.from('mala_estoque_produtos').insert({
      mala_id: malaId, produto_id: idFinal, quantidade_minima: minima,
    })
    if (err2) { setError(mensagemErro(err2, 'Erro ao adicionar material')); setSaving(false); return }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#0F172A]">{material ? 'Editar material' : 'Adicionar material'}</h3>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -m-2 rounded-lg hover:bg-[#F1F5F9]"><X size={18} className="text-[#94A3B8]" /></button>
        </div>
        <div className="space-y-3">
          {material ? (
            <p className="text-sm font-medium text-[#374151]">{material.produto?.nome ?? 'Material'}</p>
          ) : !modoNovo ? (
            <div>
              <label className="text-xs font-medium text-[#64748B] block mb-1">Material do catálogo *</label>
              <select className="field text-sm" value={produtoId} onChange={e => setProdutoId(e.target.value)}>
                <option value="">Selecione...</option>
                {disponiveis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <button type="button" onClick={() => { setModoNovo(true); setProdutoId('') }}
                className="text-xs text-[#4F7CFF] hover:underline mt-1.5">+ Cadastrar novo material</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-[#64748B] block mb-1">Nome do material *</label>
                  <input className="field text-sm" value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Ex: Fita isolante" autoFocus />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#64748B] block mb-1">Unidade</label>
                  <input className="field text-sm" value={novaUnidade} onChange={e => setNovaUnidade(e.target.value)} placeholder="un" />
                </div>
              </div>
              <button type="button" onClick={() => setModoNovo(false)} className="text-xs text-[#4F7CFF] hover:underline">← Usar material já cadastrado</button>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-[#64748B] block mb-1">Quantidade mínima</label>
            <input type="text" inputMode="decimal" className="field text-sm" value={quantidadeMinima} onChange={e => setQuantidadeMinima(e.target.value)} placeholder="0" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-xs text-[#64748B] px-3 py-1.5 hover:bg-[#F1F5F9] rounded-lg">Cancelar</button>
          <button onClick={salvar} disabled={saving || (!material && !modoNovo && !produtoId)} className="text-xs bg-[#4F7CFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#3D68F0] disabled:opacity-50">
            {saving ? 'Salvando…' : material ? 'Salvar' : 'Adicionar'}
          </button>
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
  const [data, setData] = useState(hojeLocal())
  const [observacoes, setObservacoes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const produto = produtos.find(p => p.produto_id === produtoId)

  async function salvar() {
    if (saving) return
    setError('')
    const qtd = parseNumeroBR(quantidade)
    if (!produtoId || !produto) { setError('Selecione o material.'); return }
    if (!qtd || Number.isNaN(qtd) || qtd <= 0) { setError('Informe a quantidade.'); return }
    if (!responsavel.trim()) { setError('Informe o responsável.'); return }
    if (tipo === 'saida' && arred(produto.quantidade_atual - qtd) < 0) {
      setError(`Saldo insuficiente. Disponível: ${formatarQtd(produto.quantidade_atual)}.`); return
    }
    setSaving(true)
    const sb = createClient()
    // 1) Registro; se falhar, o saldo não é tocado
    const { data: reg, error: errReg } = await sb.from('mala_estoque_registros').insert({
      mala_id: malaId, produto_id: produtoId, tipo, quantidade: qtd,
      responsavel: responsavel.trim(), data, observacoes: observacoes || null,
    }).select('id').single()
    if (errReg || !reg) { setError(mensagemErro(errReg, 'Erro ao registrar movimentação')); setSaving(false); return }
    // 2) Saldo somado no banco; se falhar, desfaz o registro para não ficar divergente
    const { error: errSaldo } = await ajustarSaldo(sb, produto.id, tipo === 'entrada' ? qtd : -qtd, { tabela: 'mala_estoque_produtos' })
    if (errSaldo) {
      const { error: errDel } = await sb.from('mala_estoque_registros').delete().eq('id', reg.id)
      if (errDel) console.error('Erro ao desfazer registro da mala', errDel)
      setError(mensagemErro(errSaldo, 'Erro ao atualizar o saldo da mala'))
      setSaving(false)
      return
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#0F172A]">Nova movimentação</h3>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -m-2 rounded-lg hover:bg-[#F1F5F9]"><X size={18} className="text-[#94A3B8]" /></button>
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
              {produtos.map(p => <option key={p.produto_id} value={p.produto_id}>{p.produto?.nome} ({formatarQtd(p.quantidade_atual)} {p.produto?.unidade})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#64748B] block mb-1">Quantidade *</label>
              <input type="text" inputMode="decimal" className="field text-sm" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" />
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
          <button onClick={salvar} disabled={saving} className="text-xs bg-[#4F7CFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#3D68F0] disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button>
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
  const [editandoMaterial, setEditandoMaterial] = useState<MalaEstoqueProduto | null>(null)
  const [processando, setProcessando] = useState<string | null>(null)

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

  async function removerMaterial(m: MalaEstoqueProduto) {
    const saldo = m.quantidade_atual > 0 ? ` O saldo de ${formatarQtd(m.quantidade_atual)} ${m.produto?.unidade ?? ''} deixa de ser controlado.` : ''
    if (!confirm(`Remover "${m.produto?.nome ?? 'material'}" da mala?${saldo} O histórico de movimentações é mantido.`)) return
    setProcessando(m.id)
    const { error } = await createClient().from('mala_estoque_produtos').delete().eq('id', m.id)
    setProcessando(null)
    if (error) { alert(mensagemErro(error, 'Erro ao remover material')); return }
    load()
  }

  // Estorno: desfaz o efeito no saldo e apaga a movimentação lançada errada
  async function estornar(r: MalaEstoqueRegistro) {
    const material = produtos.find(p => p.produto_id === r.produto_id)
    const delta = r.tipo === 'entrada' ? -r.quantidade : r.quantidade
    if (material && r.tipo === 'entrada' && arred(material.quantidade_atual + delta) < 0) {
      alert(`Não dá para estornar esta entrada: o saldo atual (${formatarQtd(material.quantidade_atual)}) ficaria negativo.`)
      return
    }
    const desc = `${r.tipo === 'entrada' ? 'entrada' : 'saída'} de ${formatarQtd(r.quantidade)} ${r.produto?.unidade ?? ''} de "${r.produto?.nome ?? 'material'}" (${fmtData(r.data)})`
    if (!confirm(`Estornar a ${desc}?\n\nA movimentação é apagada e o saldo da mala ${material ? 'é corrigido' : 'não é alterado (material não está mais na mala)'}.`)) return
    setProcessando(r.id)
    const sb = createClient()
    if (material) {
      const { error: errSaldo } = await ajustarSaldo(sb, material.id, delta, { tabela: 'mala_estoque_produtos' })
      if (errSaldo) { setProcessando(null); alert(mensagemErro(errSaldo, 'Erro ao estornar')); return }
    }
    const { error: errDel } = await sb.from('mala_estoque_registros').delete().eq('id', r.id)
    if (errDel && material) {
      // Não apagou: devolve o saldo como estava
      const { error: errVolta } = await ajustarSaldo(sb, material.id, -delta, { tabela: 'mala_estoque_produtos' })
      if (errVolta) console.error('Erro ao reverter saldo do estorno', errVolta)
    }
    setProcessando(null)
    if (errDel) { alert(mensagemErro(errDel, 'Erro ao estornar')); return }
    load()
  }

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
              <div key={p.id} className={`flex items-center justify-between gap-1 text-xs rounded-lg pl-3 pr-1 py-1 ${critico ? 'bg-amber-50' : 'bg-[#F8FAFC]'}`}>
                <span className="text-[#374151] font-medium truncate">
                  {p.produto?.nome}
                  {p.quantidade_minima > 0 && <span className="font-normal text-[#94A3B8]"> · mín. {formatarQtd(p.quantidade_minima)}</span>}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  {critico && <span className="px-1.5 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700">Crítico</span>}
                  <span className="font-semibold text-[#0F172A] mr-1">{formatarQtd(p.quantidade_atual)} {p.produto?.unidade}</span>
                  <button onClick={() => setEditandoMaterial(p)} aria-label={`Editar mínimo de ${p.produto?.nome ?? 'material'}`} title="Editar quantidade mínima"
                    className="p-2 rounded-lg text-[#94A3B8] hover:text-[#4F7CFF] hover:bg-white">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => removerMaterial(p)} disabled={processando === p.id} aria-label={`Remover ${p.produto?.nome ?? 'material'} da mala`} title="Remover da mala"
                    className="p-2 rounded-lg text-[#94A3B8] hover:text-red-500 hover:bg-white disabled:opacity-40">
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      )}

      {registros.length > 0 && (
        <div className="mt-3 space-y-0.5">
          {registros.map(r => (
            <div key={r.id} className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
              {r.tipo === 'entrada'
                ? <ArrowDownCircle size={12} className="text-green-500 shrink-0" />
                : <ArrowUpCircle size={12} className="text-red-500 shrink-0" />}
              <span className="truncate">{r.produto?.nome} · {r.responsavel ?? '—'} · {fmtData(r.data)}</span>
              <span className={`ml-auto font-semibold ${r.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                {r.tipo === 'entrada' ? '+' : '-'}{formatarQtd(r.quantidade)}
              </span>
              <button onClick={() => estornar(r)} disabled={processando === r.id} aria-label="Estornar movimentação" title="Estornar movimentação"
                className="p-2 -my-1 rounded-lg text-[#CBD5E1] hover:text-[#4F7CFF] hover:bg-[#F1F5F9] shrink-0 disabled:opacity-40">
                {processando === r.id ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdicionar && (
        <ModalAdicionarMaterialMala malaId={malaId} estoqueId={estoqueId} jaRastreados={produtos.map(p => p.produto_id)}
          onClose={() => setShowAdicionar(false)} onSaved={() => { setShowAdicionar(false); load() }} />
      )}
      {editandoMaterial && (
        <ModalAdicionarMaterialMala malaId={malaId} estoqueId={estoqueId} jaRastreados={[]} material={editandoMaterial}
          onClose={() => setEditandoMaterial(null)} onSaved={() => { setEditandoMaterial(null); load() }} />
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
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [erroCarga, setErroCarga] = useState('')
  const [defeitoEditando, setDefeitoEditando] = useState<FerramentaDefeito | null>(null)
  const [avisoContrato, setAvisoContrato] = useState(false)
  const { lightboxUrl, openLightbox, closeLightbox } = usePhotoLightbox()

  async function load() {
    setLoading(true)
    setErroCarga('')
    const supabase = createClient()
    const [{ data: f, error: errF }, { data: hist }, { data: defs }] = await Promise.all([
      supabase.from('ferramentas').select('*, mala:mala_id(id, nome, codigo_interno, responsavel_atual:funcionarios(id, nome)), responsavel_atual:funcionarios(id, nome)').eq('id', currentId).single(),
      supabase.from('ferramenta_emprestimo_itens').select('*, emprestimo:ferramenta_emprestimos(*, funcionario:funcionarios(id, nome))').eq('ferramenta_id', currentId).order('created_at', { ascending: false }),
      supabase.from('ferramenta_defeitos').select('*').eq('ferramenta_id', currentId).order('data', { ascending: false }),
    ])
    if (errF || !f) {
      setErroCarga(mensagemErro(errF, 'Erro ao carregar'))
      setLoading(false)
      return
    }
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
    if (!ferramenta || processando) return
    const abertos = defeitos.filter(d => !d.resolvido)
    const volta = modoPatrimonio ? 'o item volta a "Em operação"' : 'a ferramenta volta a ficar disponível'
    const msg = abertos.length > 1
      ? `Concluir a manutenção? Os ${abertos.length} defeitos em aberto serão marcados como resolvidos e ${volta}.`
      : `Concluir a manutenção? O defeito é marcado como resolvido e ${volta}.`
    if (!confirm(msg)) return
    setProcessando(true)
    const supabase = createClient()
    if (abertos.length > 0) {
      const { error } = await supabase.from('ferramenta_defeitos').update({ resolvido: true, data_resolucao: hojeLocal() })
        .in('id', abertos.map(d => d.id))
      if (error) { setProcessando(false); alert(mensagemErro(error, 'Erro ao concluir manutenção')); return }
    }
    const { error: errSt } = await supabase.from('ferramentas').update({ status: 'disponivel' }).eq('id', ferramenta.id)
    setProcessando(false)
    if (errSt) alert(mensagemErro(errSt, 'Defeitos resolvidos, mas o status não foi atualizado'))
    load(); onChanged()
  }

  async function darBaixa() {
    if (!ferramenta || processando) return
    const nome = `"${ferramenta.nome}"${ferramenta.codigo_interno ? ` (${ferramenta.codigo_interno})` : ''}`
    if (!confirm(`Dar baixa em ${nome}?\n\n${modoPatrimonio ? 'O item fica como "Fora de uso"' : 'A ferramenta fica como "Baixada"'}, sai do patrimônio ativo e não pode mais ser emprestada. Dá para reativar depois, se precisar.`)) return
    setProcessando(true)
    const { error } = await createClient().from('ferramentas').update({ status: 'baixada' }).eq('id', ferramenta.id)
    setProcessando(false)
    if (error) { alert(mensagemErro(error, 'Erro ao dar baixa')); return }
    load(); onChanged()
  }

  async function reativar() {
    if (!ferramenta || processando) return
    if (!confirm(`Reativar "${ferramenta.nome}"? ${modoPatrimonio ? 'O item volta a "Em operação"' : 'A ferramenta volta a ficar disponível'} e a contar no patrimônio ativo.`)) return
    setProcessando(true)
    const { error } = await createClient().from('ferramentas').update({ status: 'disponivel' }).eq('id', ferramenta.id).eq('status', 'baixada')
    setProcessando(false)
    if (error) { alert(mensagemErro(error, 'Erro ao reativar')); return }
    load(); onChanged()
  }

  // Cadastro feito por engano. Com histórico de empréstimo, o caminho é dar baixa.
  async function excluirFerramenta() {
    if (!ferramenta || processando) return
    if (historicoEmprestimos.length > 0) {
      alert('Este item tem empréstimos registrados e não pode ser excluído (o histórico precisa ser mantido). Use "Dar baixa".')
      return
    }
    if (ferramenta.eh_mala && conteudoMala.length > 0) {
      alert(`Esta mala tem ${conteudoMala.length} ${conteudoMala.length === 1 ? 'item' : 'itens'} dentro. Torne-os avulsos antes de excluir a mala.`)
      return
    }
    const extras = [
      defeitos.length > 0 ? `${defeitos.length} defeito(s)` : '',
      ferramenta.eh_mala ? 'os materiais de uso e movimentações da mala' : 'os dados técnicos',
    ].filter(Boolean).join(', ')
    if (!confirm(`Excluir "${ferramenta.nome}"${ferramenta.codigo_interno ? ` (${ferramenta.codigo_interno})` : ''} definitivamente?\n\nTambém serão apagados: ${extras}. Use isto só para cadastro feito por engano — para tirar de uso, prefira "Dar baixa".`)) return
    setProcessando(true)
    const { error } = await createClient().from('ferramentas').delete().eq('id', ferramenta.id)
    setProcessando(false)
    if (error) {
      alert(error.code === '23503'
        ? 'Este item tem registros vinculados (empréstimos) e não pode ser excluído. Use "Dar baixa".'
        : mensagemErro(error, 'Erro ao excluir'))
      return
    }
    onChanged()
    if (voltarPara) { setCurrentId(voltarPara); setVoltarPara(null) } else onClose()
  }

  async function excluirDefeito(d: FerramentaDefeito) {
    if (!ferramenta || processando) return
    const ultimoAberto = !d.resolvido && ferramenta.status === 'em_manutencao' && defeitos.filter(x => !x.resolvido).length === 1
    if (!confirm(`Excluir o defeito "${d.descricao}" (${fmtData(d.data)})?${ultimoAberto ? `\n\nEra o único defeito em aberto: ${modoPatrimonio ? 'o item volta a "Em operação"' : 'a ferramenta volta a ficar disponível'}.` : ''}`)) return
    setProcessando(true)
    const supabase = createClient()
    const { error } = await supabase.from('ferramenta_defeitos').delete().eq('id', d.id)
    if (error) { setProcessando(false); alert(mensagemErro(error, 'Erro ao excluir defeito')); return }
    if (ultimoAberto) {
      const { error: errSt } = await supabase.from('ferramentas').update({ status: 'disponivel' }).eq('id', ferramenta.id)
      if (errSt) alert(mensagemErro(errSt, 'Defeito excluído, mas o status não foi atualizado'))
    }
    setProcessando(false)
    load(); onChanged()
  }

  function toggleSelecionado(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function removerSelecionadosDaMala() {
    if (selecionados.size === 0) return
    if (!confirm(`Tornar ${selecionados.size} ${selecionados.size === 1 ? 'item avulso' : 'itens avulsos'}, removendo da mala?`)) return
    setProcessando(true)
    const supabase = createClient()
    const { error } = await supabase.from('ferramentas').update({ mala_id: null }).in('id', Array.from(selecionados))
    setProcessando(false)
    if (error) { alert(mensagemErro(error, 'Erro ao remover da mala')); return }
    setSelecionados(new Set())
    load(); onChanged()
  }

  const url = typeof window !== 'undefined' && ferramenta ? `${window.location.origin}/pub/ferramenta/${ferramenta.id}` : ''
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(url)}`

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[calc(100dvh-env(safe-area-inset-top))] overflow-y-auto mt-auto sm:mt-0">
        {erroCarga ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 p-6 text-center">
            <p className="text-sm text-red-600">{erroCarga}</p>
            <div className="flex gap-2">
              <button onClick={load} className="text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] px-3 py-1.5 rounded-lg">Tentar de novo</button>
              <button onClick={onClose} className="text-sm text-[#64748B] hover:bg-[#F1F5F9] px-3 py-1.5 rounded-lg">Fechar</button>
            </div>
          </div>
        ) : loading || !ferramenta ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={24} className="animate-spin text-[#4F7CFF]" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                {voltarPara && (
                  <button onClick={voltar} className="p-2 -m-2 rounded-lg text-[#94A3B8] hover:text-[#4F7CFF] transition-colors" title="Voltar para a mala" aria-label="Voltar para a mala">
                    <ChevronLeft size={16} />
                  </button>
                )}
                <h2 className="font-syne font-semibold text-[#0F172A]">{ferramenta.nome}</h2>
                {ferramenta.codigo_interno && <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">{ferramenta.codigo_interno}</span>}
                <button onClick={() => setShowEditar(true)} className="p-2 -m-1 rounded-lg text-[#94A3B8] hover:text-[#4F7CFF] transition-colors" title={modoPatrimonio ? 'Editar item' : 'Editar ferramenta'} aria-label={modoPatrimonio ? 'Editar item' : 'Editar ferramenta'}>
                  <Pencil size={14} />
                </button>
              </div>
              <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -m-2 rounded-lg hover:bg-[#F1F5F9]"><X size={16} className="text-[#64748B]" /></button>
            </div>

            <div className="p-4 md:p-6 space-y-5">
              {avisoContrato && ferramenta.eh_mala && (
                <div className="flex items-center justify-between gap-2 text-xs text-[#374151] bg-[#EEF2FF] px-3 py-2 rounded-lg">
                  <span>Responsável salvo. O navegador bloqueou a nova aba.</span>
                  <a href={`/print/mala/${ferramenta.id}`} target="_blank" rel="noopener noreferrer" onClick={() => setAvisoContrato(false)}
                    className="font-medium text-[#4F7CFF] hover:underline whitespace-nowrap">Abrir contrato</a>
                </div>
              )}
              {ferramenta.mala_id && ferramenta.mala && (
                <button onClick={() => abrirFilho(ferramenta.mala!.id)}
                  className="w-full text-left flex items-center gap-2 text-xs text-[#4F7CFF] bg-[#EEF2FF] px-3 py-2 rounded-lg hover:bg-[#E0E7FF] transition-colors">
                  <Briefcase size={13} /> Faz parte da mala <strong>{ferramenta.mala.nome}</strong>{ferramenta.mala.codigo_interno ? ` (${ferramenta.mala.codigo_interno})` : ''}
                </button>
              )}

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {ferramenta.foto_url
                    ? <Image
                        src={ferramenta.foto_url}
                        alt=""
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-xl object-cover border border-[#E2E8F0] cursor-zoom-in"
                        onClick={() => openLightbox(ferramenta.foto_url!)}
                      />
                    : <div className="w-16 h-16 rounded-xl bg-[#F1F5F9] flex items-center justify-center text-[#94A3B8]">
                        {ferramenta.eh_mala ? <Briefcase size={22} /> : modoPatrimonio ? <Building2 size={22} /> : <Wrench size={22} />}
                      </div>}
                  {ferramenta.foto_url_2 && (
                    <Image
                      src={ferramenta.foto_url_2}
                      alt=""
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-xl object-cover border border-[#E2E8F0] cursor-zoom-in"
                      onClick={() => openLightbox(ferramenta.foto_url_2!)}
                    />
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

              {ferramenta.manual_url && (
                <a href={ferramenta.manual_url} target="_blank" rel="noopener noreferrer"
                  className="w-full flex items-center gap-2 text-sm text-[#4F7CFF] bg-[#EEF2FF] px-3 py-2 rounded-lg hover:bg-[#E0E7FF] transition-colors">
                  <FileText size={15} /> {ferramenta.manual_nome || 'Ver manual de instruções (PDF)'}
                </a>
              )}

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
                    {processando ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Concluir manutenção
                  </button>
                )}
                {!ferramenta.eh_mala && (ferramenta.status === 'disponivel' || ferramenta.status === 'em_manutencao') && (
                  <button onClick={darBaixa} disabled={processando}
                    className="flex items-center gap-1.5 text-xs text-[#64748B] border border-[#E2E8F0] px-3 py-1.5 rounded-xl hover:bg-[#F1F5F9] transition-colors ml-auto">
                    <Ban size={13} /> Dar baixa
                  </button>
                )}
                {!ferramenta.eh_mala && ferramenta.status === 'baixada' && (
                  <button onClick={reativar} disabled={processando}
                    className="flex items-center gap-1.5 text-xs text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl hover:bg-emerald-50 transition-colors ml-auto">
                    <RotateCcw size={13} /> Reativar
                  </button>
                )}
                {ferramenta.status !== 'emprestada' && historicoEmprestimos.length === 0 && (
                  <button onClick={excluirFerramenta} disabled={processando}
                    className="flex items-center gap-1.5 text-xs text-red-600 border border-red-100 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors">
                    <Trash2 size={13} /> Excluir
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
                    <>
                      <div className="flex items-center justify-between mb-1.5 px-0.5">
                        <label className="flex items-center gap-1.5 text-[11px] text-[#64748B] cursor-pointer select-none">
                          <input type="checkbox"
                            checked={itensFiltrados.length > 0 && itensFiltrados.every(item => selecionados.has(item.id))}
                            onChange={e => {
                              setSelecionados(prev => {
                                const next = new Set(prev)
                                if (e.target.checked) itensFiltrados.forEach(item => next.add(item.id))
                                else itensFiltrados.forEach(item => next.delete(item.id))
                                return next
                              })
                            }} />
                          Selecionar todos
                        </label>
                        {selecionados.size > 0 && (
                          <button onClick={removerSelecionadosDaMala} disabled={processando}
                            className="flex items-center gap-1 text-[11px] font-medium text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors">
                            {processando ? <Loader2 size={11} className="animate-spin" /> : <Package size={11} />}
                            Tornar avulsas ({selecionados.size})
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {itensFiltrados.map(item => (
                          <div key={item.id}
                            className="w-full flex items-center gap-2 text-xs bg-[#F8FAFC] hover:bg-[#F1F5F9] rounded-lg px-3 py-2 transition-colors">
                            <input type="checkbox" checked={selecionados.has(item.id)}
                              onChange={() => toggleSelecionado(item.id)} onClick={e => e.stopPropagation()} />
                            <button onClick={() => abrirFilho(item.id)}
                              className="flex-1 flex items-center justify-between text-left min-w-0">
                              <span className="text-[#374151] font-medium truncate">{item.nome}{item.codigo_interno ? ` · ${item.codigo_interno}` : ''}</span>
                              {item.status === 'disponivel' ? (
                                <span className="shrink-0 ml-2 px-1.5 py-0.5 rounded-full font-semibold bg-[#EEF2FF] text-[#4F7CFF]">Na mala</span>
                              ) : (
                                <span className={`shrink-0 ml-2 px-1.5 py-0.5 rounded-full font-semibold ${STATUS_COLOR[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
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
                      <div key={d.id} className="text-xs bg-[#F8FAFC] rounded-lg pl-3 pr-1 py-1.5 flex items-center gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[#374151] font-medium">{d.descricao}</span>
                            <span className={`shrink-0 ${d.resolvido ? 'text-emerald-600' : 'text-red-600'}`}>{d.resolvido ? 'Resolvido' : 'Em aberto'}</span>
                          </div>
                          <span className="text-[#94A3B8]">{fmtData(d.data)}{d.custo ? ` · ${moeda(d.custo)}` : ''}{d.resolvido && d.data_resolucao ? ` · resolvido em ${fmtData(d.data_resolucao)}` : ''}</span>
                        </div>
                        <button onClick={() => setDefeitoEditando(d)} aria-label="Editar defeito" title="Editar defeito"
                          className="p-2 rounded-lg text-[#94A3B8] hover:text-[#4F7CFF] hover:bg-white shrink-0">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => excluirDefeito(d)} disabled={processando} aria-label="Excluir defeito" title="Excluir defeito"
                          className="p-2 rounded-lg text-[#94A3B8] hover:text-red-500 hover:bg-white shrink-0 disabled:opacity-40">
                          <Trash2 size={13} />
                        </button>
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
      {defeitoEditando && ferramenta && (
        <ModalDefeito ferramentaId={ferramenta.id} defeito={defeitoEditando} onClose={() => setDefeitoEditando(null)} onSaved={() => { setDefeitoEditando(null); load(); onChanged() }} />
      )}
      {showEditar && ferramenta && (
        <ModalEditarFerramenta ferramenta={ferramenta} modoPatrimonio={modoPatrimonio} onClose={() => setShowEditar(false)} onSaved={() => { setShowEditar(false); load(); onChanged() }} />
      )}
      {showAtribuir && ferramenta && (
        <ModalAtribuirMala ferramentaId={ferramenta.id} responsavelAtualId={ferramenta.responsavel_atual_id}
          urlContrato={`/print/mala/${ferramenta.id}`}
          onClose={() => setShowAtribuir(false)}
          onSaved={aberto => { setShowAtribuir(false); setAvisoContrato(!aberto); load(); onChanged() }} />
      )}
      {showNovoItemMala && ferramenta && (
        <ModalNovaFerramenta estoqueId={ferramenta.estoque_id} malaIdPadrao={ferramenta.id}
          onClose={() => setShowNovoItemMala(false)}
          onCreated={() => { setShowNovoItemMala(false); load(); onChanged() }} />
      )}
      <PhotoLightbox url={lightboxUrl} onClose={closeLightbox} />
    </div>
  )
}
