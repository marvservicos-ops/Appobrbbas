'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, CircleDollarSign, FileText, Loader2, Pencil, Plus, ReceiptText, Save, Trash2, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Obra, ObraMedicao } from '@/lib/types'

type EtapaDraft = { nome: string; percentual: number; data_prevista: string }

interface ObraAditivo {
  id: string; obra_id: string; descricao: string; valor: number
  data?: string; observacoes?: string; created_at: string
}

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const dataBR = (v?: string) => v ? new Date(v + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
const pct = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'

const STATUS = {
  planejada: { label: 'Planejada', cls: 'bg-slate-100 text-slate-700' },
  faturada:  { label: 'Faturada',  cls: 'bg-blue-50 text-blue-700' },
  recebida:  { label: 'Recebida',  cls: 'bg-emerald-50 text-emerald-700' },
  atrasada:  { label: 'Atrasada',  cls: 'bg-amber-50 text-amber-700' },
  cancelada: { label: 'Cancelada', cls: 'bg-red-50 text-red-600' },
} as const

// ─── Modal editar medição (nome / percentual / previsão) ──────────────────────
function ModalEditarMedicao({ medicao, onClose, onSaved }: {
  medicao: ObraMedicao; onClose: () => void
  onSaved: (c: Partial<ObraMedicao>) => void
}) {
  const [nome, setNome] = useState(medicao.nome)
  const [percentual, setPercentual] = useState(String(medicao.percentual))
  const [dataPrevista, setDataPrevista] = useState(medicao.data_prevista ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const changes: Partial<ObraMedicao> = { nome: nome.trim(), percentual: Number(percentual), data_prevista: dataPrevista || undefined }
    const { error } = await createClient().from('obra_medicoes').update(changes).eq('id', medicao.id)
    setSaving(false)
    if (error) { alert(error.message); return }
    onSaved(changes); onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[420px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-syne font-semibold text-[#0F172A]">Editar Etapa {medicao.ordem}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9]"><X size={15} className="text-[#64748B]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome da etapa</label>
            <input className="field" value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Percentual (%)</label>
              <input type="number" step="0.001" min="0" max="100" className="field" value={percentual} onChange={e => setPercentual(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Previsão</label>
              <input type="date" className="field" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal nova medição (base ou aditivo) ─────────────────────────────────────
function ModalNovaMedicao({ obraId, valorBase, aditivoId, aditivoNome, aditivoValor, proximaOrdem, onClose, onSaved }: {
  obraId: string; valorBase: number
  aditivoId?: string; aditivoNome?: string; aditivoValor?: number
  proximaOrdem: number; onClose: () => void; onSaved: () => void
}) {
  const isAditivo = !!aditivoId
  const [nome, setNome] = useState(isAditivo ? `Medição – ${aditivoNome}` : '')
  const [percentual, setPercentual] = useState('')
  const [dataPrevista, setDataPrevista] = useState('')
  const [saving, setSaving] = useState(false)

  const valorPrevisto = isAditivo
    ? (aditivoValor ?? 0) * Number(percentual || 0) / 100
    : valorBase * Number(percentual || 0) / 100

  async function handleSave() {
    if (!nome.trim() || !percentual) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      obra_id: obraId,
      aditivo_id: aditivoId ?? null,
      ordem: proximaOrdem,
      nome: nome.trim(),
      percentual: Number(percentual),
      valor_previsto: valorPrevisto,
      data_prevista: dataPrevista || null,
      status: 'planejada',
      created_by: user?.id,
    }
    const { error } = await supabase.from('obra_medicoes').insert(payload)
    setSaving(false)
    if (error) { alert(error.message); return }
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[440px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div>
            <h3 className="font-syne font-semibold text-[#0F172A]">Nova Medição</h3>
            {isAditivo && <p className="text-xs text-amber-600 mt-0.5">Aditivo: {aditivoNome} · {moeda(aditivoValor ?? 0)}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9]"><X size={15} className="text-[#64748B]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome da medição *</label>
            <input className="field" placeholder="Ex: 1ª medição do aditivo" value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Percentual (%)</label>
              <input type="number" step="0.001" min="0" max="100" className="field" placeholder="0" value={percentual} onChange={e => setPercentual(e.target.value)} />
              {percentual && <p className="text-xs text-[#64748B] mt-1">= {moeda(valorPrevisto)}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Previsão</label>
              <input type="date" className="field" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !nome.trim() || !percentual} className="btn-primary text-sm disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal aditivo ────────────────────────────────────────────────────────────
function ModalAditivo({ obraId, aditivo, onClose, onSaved }: {
  obraId: string; aditivo?: ObraAditivo; onClose: () => void; onSaved: () => void
}) {
  const editing = !!aditivo
  const [descricao, setDescricao] = useState(aditivo?.descricao ?? '')
  const [valor, setValor] = useState(aditivo ? String(aditivo.valor) : '')
  const [data, setData] = useState(aditivo?.data ?? '')
  const [observacoes, setObservacoes] = useState(aditivo?.observacoes ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!descricao.trim() || !valor) return
    setSaving(true)
    const payload = { obra_id: obraId, descricao: descricao.trim(), valor: Number(valor), data: data || null, observacoes: observacoes.trim() || null }
    const { error } = editing
      ? await createClient().from('obra_aditivos').update(payload).eq('id', aditivo!.id)
      : await createClient().from('obra_aditivos').insert(payload)
    setSaving(false)
    if (error) { alert(error.message); return }
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[440px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-syne font-semibold text-[#0F172A]">{editing ? 'Editar' : 'Novo'} Aditivo de Obra</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9]"><X size={15} className="text-[#64748B]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Descrição *</label>
            <input className="field" placeholder="Ex: Serviços adicionais de instalação" value={descricao} onChange={e => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Valor (R$) *</label>
              <input type="number" step="0.01" min="0" className="field" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Data</label>
              <input type="date" className="field" value={data} onChange={e => setData(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Observações</label>
            <textarea className="field resize-none" rows={2} placeholder="Detalhes do aditivo..." value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !descricao.trim() || !valor} className="btn-primary text-sm disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card de medição ──────────────────────────────────────────────────────────
function CardMedicao({ m, isAditivo, aditivoNome, uploading, onEditar, onExcluir, onAtualizar, onAnexarNF, onAbrirNF, onRemoverNF }: {
  m: ObraMedicao; isAditivo: boolean; aditivoNome?: string; uploading: string | null
  onEditar: () => void; onExcluir: () => void
  onAtualizar: (changes: Partial<ObraMedicao>) => void
  onAnexarNF: (file: File) => void; onAbrirNF: () => void; onRemoverNF: () => void
}) {
  const status = STATUS[m.status]
  const borderColor = isAditivo ? 'border-l-4 border-l-amber-400' : ''
  const badgeAditivo = isAditivo ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Aditivo{aditivoNome ? `: ${aditivoNome}` : ''}</span> : null

  return (
    <article className={`card ${borderColor}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold ${isAditivo ? 'text-amber-600' : 'text-[#4F7CFF]'}`}>ETAPA {m.ordem}</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
            {badgeAditivo}
          </div>
          <h3 className="font-syne font-semibold text-[#0F172A] mt-1">{m.nome}</h3>
          <p className="text-sm text-[#64748B] mt-0.5">{pct(Number(m.percentual))} · {moeda(Number(m.valor_previsto))} · previsão {dataBR(m.data_prevista)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEditar} className={`w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#EEF2FF] ${isAditivo ? 'text-amber-500' : 'text-[#4F7CFF]'}`}><Pencil size={14} /></button>
          <button onClick={onExcluir} className="w-9 h-9 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="text-xs text-[#64748B]">Situação
          <select className="field mt-1" value={m.status} onChange={e => onAtualizar({ status: e.target.value as ObraMedicao['status'] })}>
            {Object.entries(STATUS).map(([id, x]) => <option key={id} value={id}>{x.label}</option>)}
          </select>
        </label>
        <label className="text-xs text-[#64748B]">Data de emissão
          <input type="date" className="field mt-1" value={m.data_emissao ?? ''} onChange={e => onAtualizar({ data_emissao: e.target.value || undefined })} />
        </label>
        <label className="text-xs text-[#64748B]">Vencimento
          <input type="date" className="field mt-1" value={m.data_vencimento ?? ''} onChange={e => onAtualizar({ data_vencimento: e.target.value || undefined })} />
        </label>
        <label className="text-xs text-[#64748B]">Data do pagamento
          <input type="date" className="field mt-1" value={m.data_pagamento ?? ''} onChange={e => onAtualizar({ data_pagamento: e.target.value || undefined })} />
        </label>
        <label className="text-xs text-[#64748B]">Valor faturado
          <input type="number" step="0.01" className="field mt-1" value={m.valor_faturado ?? ''}
            onBlur={e => onAtualizar({ valor_faturado: Number(e.target.value) || undefined })}
            onChange={e => onAtualizar({ valor_faturado: Number(e.target.value) })} />
        </label>
        <label className="text-xs text-[#64748B]">Valor recebido
          <input type="number" step="0.01" className="field mt-1" value={m.valor_recebido ?? ''}
            onBlur={e => onAtualizar({ valor_recebido: Number(e.target.value) || undefined })}
            onChange={e => onAtualizar({ valor_recebido: Number(e.target.value) })} />
        </label>
        <label className="text-xs text-[#64748B]">Número da NF
          <input className="field mt-1" value={m.numero_nf ?? ''}
            onBlur={e => onAtualizar({ numero_nf: e.target.value || undefined })}
            onChange={e => onAtualizar({ numero_nf: e.target.value })} />
        </label>
        <div className="min-w-0 text-xs text-[#64748B]">
          Nota fiscal
          <div className="mt-1 flex min-w-0 gap-2">
            <label className="btn-secondary min-w-0 flex-1 cursor-pointer overflow-hidden px-3">
              {uploading === m.id ? <Loader2 size={14} className="shrink-0 animate-spin" /> : <Upload size={14} className="shrink-0" />}
              <span className="block min-w-0 flex-1 truncate text-left">{m.nf_nome || 'Anexar NF'}</span>
              <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onAnexarNF(f); e.target.value = '' }} />
            </label>
            {m.nf_path && (
              <>
                <button onClick={onAbrirNF} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-[#EEF2FF] text-[#4F7CFF] hover:bg-[#DBEAFE]"><FileText size={16} /></button>
                <button disabled={uploading === m.id} onClick={onRemoverNF} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50"><Trash2 size={16} /></button>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ObraPagamentos({ obraId }: { obraId: string }) {
  const [obra, setObra] = useState<Obra | null>(null)
  const [medicoes, setMedicoes] = useState<ObraMedicao[]>([])
  const [aditivos, setAditivos] = useState<ObraAditivo[]>([])
  const [valorContrato, setValorContrato] = useState(0)
  const [contratoInput, setContratoInput] = useState('')
  const [drafts, setDrafts] = useState<EtapaDraft[]>([
    { nome: '1ª medição', percentual: 50, data_prevista: '' },
    { nome: '2ª medição', percentual: 50, data_prevista: '' },
  ])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [editandoMedicao, setEditandoMedicao] = useState<ObraMedicao | null>(null)
  const [showModalAditivo, setShowModalAditivo] = useState(false)
  const [editandoAditivo, setEditandoAditivo] = useState<ObraAditivo | null>(null)
  // Nova medição: null = fechado, undefined = base, ObraAditivo = vinculada ao aditivo
  const [novaMedicaoAditivo, setNovaMedicaoAditivo] = useState<ObraAditivo | null | undefined>(undefined)
  const [showNovaMedicao, setShowNovaMedicao] = useState(false)

  async function load() {
    const supabase = createClient()
    const [{ data: obraData }, { data: medicaoData }, { data: financeiro }, { data: aditivoData }] = await Promise.all([
      supabase.from('obras').select('*').eq('id', obraId).single(),
      supabase.from('obra_medicoes').select('*').eq('obra_id', obraId).order('ordem'),
      supabase.from('obra_financeiro').select('valor_contrato').eq('obra_id', obraId).maybeSingle(),
      supabase.from('obra_aditivos').select('*').eq('obra_id', obraId).order('created_at'),
    ])
    setObra(obraData as Obra)
    setMedicoes((medicaoData ?? []) as ObraMedicao[])
    setAditivos((aditivoData ?? []) as ObraAditivo[])
    const vc = Number(financeiro?.valor_contrato || 0)
    setValorContrato(vc)
    setContratoInput(vc > 0 ? String(vc) : '')
    setLoading(false)
  }
  useEffect(() => { load() }, [obraId])

  const totalAditivos = aditivos.reduce((s, a) => s + Number(a.valor), 0)
  const valorTotal = valorContrato + totalAditivos

  const totalPercentual = drafts.reduce((s, x) => s + Number(x.percentual || 0), 0)

  const resumo = useMemo(() => {
    const ativas = medicoes.filter(x => x.status !== 'cancelada')
    // Medições BASE (sem aditivo) — são as únicas que devem somar 100%
    const ativasBase = ativas.filter(x => !x.aditivo_id)
    const faturado = ativas.reduce((s, x) => s + Number(x.valor_faturado || 0), 0)
    const recebido = ativas.reduce((s, x) => s + Number(x.valor_recebido || 0), 0)
    const percentualFaturado = ativas.filter(x => x.status === 'faturada' || x.status === 'recebida').reduce((s, x) => s + Number(x.percentual), 0)
    const somaPercentuais = ativasBase.reduce((s, x) => s + Number(x.percentual), 0)
    return { faturado, recebido, saldo: Math.max(0, valorTotal - faturado), percentualFaturado, somaPercentuais }
  }, [medicoes, valorTotal])

  // % não fecha em 100?
  const percentualDesequilibrado = medicoes.length > 0 && Math.abs(resumo.somaPercentuais - 100) > 0.01

  const proximaOrdem = Math.max(0, ...medicoes.map(m => m.ordem)) + 1

  async function salvarContrato() {
    const novoValor = Number(contratoInput)
    if (!novoValor || novoValor <= 0) { setError('Informe um valor de contrato válido.'); return }
    setSaving(true); setError('')
    const supabase = createClient()
    const { error: contractError } = await supabase.from('obra_financeiro').upsert({ obra_id: obraId, valor_contrato: novoValor, updated_at: new Date().toISOString() })
    if (contractError) { setError(contractError.message); setSaving(false); return }
    // Só recalcula medições BASE (sem aditivo_id) — aditivos têm seu próprio valor
    const medicoesBase = medicoes.filter(m => !m.aditivo_id)
    if (medicoesBase.length > 0) {
      await Promise.all(medicoesBase.map(m => {
        if (m.status === 'planejada') {
          return supabase.from('obra_medicoes').update({ valor_previsto: novoValor * Number(m.percentual) / 100 }).eq('id', m.id)
        } else {
          const valorRef = Number(m.valor_faturado || m.valor_previsto || 0)
          return supabase.from('obra_medicoes').update({ percentual: novoValor > 0 ? valorRef / novoValor * 100 : Number(m.percentual) }).eq('id', m.id)
        }
      }))
    }
    setValorContrato(novoValor); await load(); setSaving(false)
  }

  async function criarPlano() {
    setError('')
    if (!valorContrato) { setError('Defina o valor do contrato antes de criar o plano.'); return }
    if (drafts.some(x => !x.nome.trim() || x.percentual <= 0)) { setError('Preencha nome e percentual em todas as etapas.'); return }
    if (Math.abs(totalPercentual - 100) > 0.001) { setError('A soma das etapas precisa ser exatamente 100%.'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const payload = drafts.map((x, i) => ({
      obra_id: obraId, aditivo_id: null, ordem: i + 1, nome: x.nome.trim(), percentual: x.percentual,
      valor_previsto: valorContrato * x.percentual / 100, data_prevista: x.data_prevista || null, created_by: user?.id,
    }))
    const { error: insertError } = await supabase.from('obra_medicoes').insert(payload)
    if (insertError) setError(insertError.message); else await load()
    setSaving(false)
  }

  async function atualizar(m: ObraMedicao, changes: Partial<ObraMedicao>) {
    const { error: updateError } = await createClient().from('obra_medicoes').update(changes).eq('id', m.id)
    if (updateError) { alert(updateError.message); return }
    setMedicoes(list => list.map(x => x.id === m.id ? { ...x, ...changes } : x))
  }

  async function excluir(m: ObraMedicao) {
    if (!confirm(`Excluir a etapa "${m.nome}"?`)) return
    const supabase = createClient()
    if (m.nf_path) await supabase.storage.from('notas-fiscais-emitidas').remove([m.nf_path])
    const { error: deleteError } = await supabase.from('obra_medicoes').delete().eq('id', m.id)
    if (deleteError) alert(deleteError.message); else setMedicoes(list => list.filter(x => x.id !== m.id))
  }

  async function excluirAditivo(a: ObraAditivo) {
    if (!confirm(`Excluir o aditivo "${a.descricao}"? As medições vinculadas também serão excluídas.`)) return
    const { error } = await createClient().from('obra_aditivos').delete().eq('id', a.id)
    if (error) { alert(error.message); return }
    setAditivos(list => list.filter(x => x.id !== a.id))
    setMedicoes(list => list.filter(x => x.aditivo_id !== a.id))
  }

  async function anexarNF(m: ObraMedicao, file: File) {
    setUploading(m.id)
    const supabase = createClient()
    const path = `${obraId}/${m.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    if (m.nf_path) await supabase.storage.from('notas-fiscais-emitidas').remove([m.nf_path])
    const { error } = await supabase.storage.from('notas-fiscais-emitidas').upload(path, file)
    if (error) alert(error.message); else await atualizar(m, { nf_path: path, nf_nome: file.name })
    setUploading(null)
  }

  async function abrirNF(m: ObraMedicao) {
    if (!m.nf_path) return
    const { data, error } = await createClient().storage.from('notas-fiscais-emitidas').createSignedUrl(m.nf_path, 60)
    if (error) alert(error.message); else window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function removerNF(m: ObraMedicao) {
    if (!m.nf_path || !confirm('Remover o anexo?')) return
    setUploading(m.id)
    const supabase = createClient()
    await supabase.storage.from('notas-fiscais-emitidas').remove([m.nf_path])
    await supabase.from('obra_medicoes').update({ nf_path: null, nf_nome: null }).eq('id', m.id)
    setMedicoes(list => list.map(x => x.id === m.id ? { ...x, nf_path: undefined, nf_nome: undefined } : x))
    setUploading(null)
  }

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-[#4F7CFF]" /></div>
  if (!obra) return <div className="p-6">Obra não encontrada.</div>

  const cards = [
    { label: 'Contrato', value: valorTotal, icon: CircleDollarSign, tone: 'bg-slate-100 text-slate-700' },
    { label: 'Faturado', value: resumo.faturado, icon: ReceiptText, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Recebido', value: resumo.recebido, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Saldo a faturar', value: resumo.saldo, icon: CalendarDays, tone: 'bg-amber-50 text-amber-700' },
  ]

  // Separar medições normais e de aditivo
  const medicoesPorAditivo = (aditivoId: string) => medicoes.filter(m => m.aditivo_id === aditivoId)
  const medicoesBase = medicoes.filter(m => !m.aditivo_id)

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#0F172A] min-h-11">
        <ArrowLeft size={16} /> Voltar para a obra
      </Link>
      <div className="mt-2 mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4F7CFF]">Financeiro da obra</p>
        <h1 className="font-syne text-xl md:text-3xl font-bold text-[#0F172A] mt-1">Plano de medições</h1>
        <p className="text-sm text-[#64748B] mt-1 line-clamp-2">{obra.titulo}</p>
      </div>

      {/* Valor do contrato */}
      <section className="card mb-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <label className="text-sm font-medium text-[#374151] flex-1">
            Valor base do contrato
            <input type="number" min="0" step="0.01" className="field mt-1.5" placeholder="0,00" value={contratoInput} onChange={e => setContratoInput(e.target.value)} />
          </label>
          <button onClick={salvarContrato} disabled={saving} className="btn-primary sm:w-auto">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar valor
          </button>
        </div>
        {medicoes.length > 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
            Ao alterar: medições <strong>planejadas</strong> têm o valor recalculado; <strong>faturadas/recebidas</strong> mantêm o valor, apenas o % é ajustado.
          </p>
        )}
        {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-3">{error}</p>}
      </section>

      {/* Aditivos */}
      <section className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-syne font-semibold text-[#0F172A] text-sm">Aditivos de Contrato</h2>
            {aditivos.length > 0 && <p className="text-xs text-[#64748B] mt-0.5">Total: <strong className="text-amber-600">{moeda(totalAditivos)}</strong></p>}
          </div>
          <button onClick={() => { setEditandoAditivo(null); setShowModalAditivo(true) }} className="btn-secondary text-xs px-3 py-1.5">
            <Plus size={13} /> Novo aditivo
          </button>
        </div>

        {aditivos.length === 0 ? (
          <p className="text-sm text-[#94A3B8] text-center py-3">Nenhum aditivo registrado</p>
        ) : (
          <div className="space-y-3">
            {aditivos.map(a => {
              const medicoesDoAditivo = medicoesPorAditivo(a.id)
              return (
                <div key={a.id} className="border border-amber-200 bg-amber-50/40 rounded-xl p-3">
                  {/* Cabeçalho do aditivo */}
                  <div className="flex items-start justify-between gap-3 group">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#0F172A] text-sm">{a.descricao}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-sm font-bold text-amber-600">{moeda(Number(a.valor))}</span>
                        {a.data && <span className="text-xs text-[#64748B]">{dataBR(a.data)}</span>}
                        {a.observacoes && <span className="text-xs text-[#64748B]">{a.observacoes}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditandoAditivo(a); setShowModalAditivo(true) }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-100 text-amber-600"><Pencil size={13} /></button>
                      <button onClick={() => excluirAditivo(a)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={13} /></button>
                    </div>
                  </div>

                  {/* Medições do aditivo */}
                  {medicoesDoAditivo.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {medicoesDoAditivo.map(m => (
                        <div key={m.id} className="bg-white border border-amber-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-[#0F172A]">{m.nome}</p>
                            <p className="text-xs text-[#64748B]">{pct(Number(m.percentual))} · {moeda(Number(m.valor_previsto))} · <span className={`font-semibold ${STATUS[m.status].cls.split(' ')[1]}`}>{STATUS[m.status].label}</span></p>
                          </div>
                          <button onClick={() => setEditandoMedicao(m)} className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg hover:bg-[#EEF2FF] text-amber-500"><Pencil size={12} /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Botão adicionar medição ao aditivo */}
                  <button
                    onClick={() => { setNovaMedicaoAditivo(a); setShowNovaMedicao(true) }}
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-amber-600 hover:bg-amber-100 py-1.5 rounded-lg transition-colors border border-dashed border-amber-300"
                  >
                    <Plus size={13} /> Adicionar medição a este aditivo
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="card p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tone}`}><Icon size={17} /></div>
            <p className="text-xs text-[#64748B] mt-3">{label}</p>
            <p className="font-syne text-base md:text-xl font-bold text-[#0F172A] mt-0.5">{moeda(value)}</p>
          </div>
        ))}
      </div>

      {/* Medições */}
      {!medicoes.length ? (
        <section className="card">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
            <div><h2 className="font-syne font-semibold text-[#0F172A]">Defina as etapas</h2><p className="text-sm text-[#64748B] mt-1">A soma dos percentuais deve fechar em 100%.</p></div>
            <div className={`text-sm font-bold px-3 py-2 rounded-lg ${Math.abs(totalPercentual - 100) < .001 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{totalPercentual.toLocaleString('pt-BR')}%</div>
          </div>
          <div className="space-y-3">
            {drafts.map((d, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[48px_1fr_130px_160px_44px] items-end gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="hidden sm:flex h-11 items-center justify-center rounded-lg bg-white border border-[#E2E8F0] text-sm font-bold text-[#64748B]">{i + 1}</div>
                <label className="text-xs text-[#64748B]">Nome da etapa<input className="field mt-1" value={d.nome} onChange={e => setDrafts(list => list.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} /></label>
                <label className="text-xs text-[#64748B]">Percentual<input type="number" min="0.001" max="100" step="0.001" className="field mt-1" value={d.percentual} onChange={e => setDrafts(list => list.map((x, j) => j === i ? { ...x, percentual: Number(e.target.value) } : x))} /></label>
                <label className="text-xs text-[#64748B]">Previsão<input type="date" className="field mt-1" value={d.data_prevista} onChange={e => setDrafts(list => list.map((x, j) => j === i ? { ...x, data_prevista: e.target.value } : x))} /></label>
                <button disabled={drafts.length === 1} onClick={() => setDrafts(list => list.filter((_, j) => j !== i))} className="w-11 h-11 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-30"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <button onClick={() => setDrafts(list => [...list, { nome: `${list.length + 1}ª medição`, percentual: 0, data_prevista: '' }])} className="btn-secondary"><Plus size={15} /> Adicionar etapa</button>
            <button onClick={criarPlano} disabled={saving} className="btn-primary sm:ml-auto">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar plano</button>
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-syne font-semibold text-[#0F172A]">Etapas da medição</h2>
              <p className="text-xs text-[#64748B] mt-0.5">{pct(resumo.percentualFaturado)} do contrato faturado · soma total: <strong className={percentualDesequilibrado ? 'text-red-500' : 'text-emerald-600'}>{pct(resumo.somaPercentuais)}</strong></p>
            </div>
            <button onClick={() => { setNovaMedicaoAditivo(null); setShowNovaMedicao(true) }} className="btn-secondary text-xs px-3 py-1.5 shrink-0">
              <Plus size={13} /> Nova medição
            </button>
          </div>

          {/* Aviso percentual desequilibrado */}
          {percentualDesequilibrado && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Percentuais não somam 100%</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  A soma atual é <strong>{pct(resumo.somaPercentuais)}</strong>. Ajuste as medições planejadas ou adicione uma nova medição para cobrir o restante ({pct(100 - resumo.somaPercentuais)}).
                </p>
              </div>
            </div>
          )}

          {/* Medições base */}
          {medicoesBase.map(m => (
            <CardMedicao key={m.id} m={m} isAditivo={false}
              uploading={uploading}
              onEditar={() => setEditandoMedicao(m)}
              onExcluir={() => excluir(m)}
              onAtualizar={changes => atualizar(m, changes)}
              onAnexarNF={file => anexarNF(m, file)}
              onAbrirNF={() => abrirNF(m)}
              onRemoverNF={() => removerNF(m)}
            />
          ))}

          {/* Medições de aditivo (agrupadas abaixo) */}
          {aditivos.map(a => {
            const meds = medicoesPorAditivo(a.id)
            return meds.map(m => (
              <CardMedicao key={m.id} m={m} isAditivo aditivoNome={a.descricao}
                uploading={uploading}
                onEditar={() => setEditandoMedicao(m)}
                onExcluir={() => excluir(m)}
                onAtualizar={changes => atualizar(m, changes)}
                onAnexarNF={file => anexarNF(m, file)}
                onAbrirNF={() => abrirNF(m)}
                onRemoverNF={() => removerNF(m)}
              />
            ))
          })}
        </section>
      )}

      {/* Modais */}
      {editandoMedicao && (
        <ModalEditarMedicao
          medicao={editandoMedicao}
          onClose={() => setEditandoMedicao(null)}
          onSaved={changes => { setMedicoes(list => list.map(x => x.id === editandoMedicao.id ? { ...x, ...changes } : x)); setEditandoMedicao(null) }}
        />
      )}
      {showNovaMedicao && (
        <ModalNovaMedicao
          obraId={obraId}
          valorBase={valorContrato}
          aditivoId={novaMedicaoAditivo?.id}
          aditivoNome={novaMedicaoAditivo?.descricao}
          aditivoValor={novaMedicaoAditivo ? Number(novaMedicaoAditivo.valor) : undefined}
          proximaOrdem={proximaOrdem}
          onClose={() => { setShowNovaMedicao(false); setNovaMedicaoAditivo(undefined) }}
          onSaved={() => load()}
        />
      )}
      {showModalAditivo && (
        <ModalAditivo
          obraId={obraId}
          aditivo={editandoAditivo ?? undefined}
          onClose={() => { setShowModalAditivo(false); setEditandoAditivo(null) }}
          onSaved={() => load()}
        />
      )}
    </div>
  )
}
