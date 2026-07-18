'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, CheckCircle2, CircleDollarSign, FileText, Loader2, Plus, ReceiptText, Save, Trash2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Obra, ObraMedicao } from '@/lib/types'

type EtapaDraft = { nome: string; percentual: number; data_prevista: string }
const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const dataBR = (v?: string) => v ? new Date(v + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

const STATUS = {
  planejada: { label: 'Planejada', cls: 'bg-slate-100 text-slate-700' },
  faturada: { label: 'Faturada', cls: 'bg-blue-50 text-blue-700' },
  recebida: { label: 'Recebida', cls: 'bg-emerald-50 text-emerald-700' },
  atrasada: { label: 'Atrasada', cls: 'bg-amber-50 text-amber-700' },
  cancelada: { label: 'Cancelada', cls: 'bg-red-50 text-red-600' },
} as const

export default function ObraPagamentos({ obraId }: { obraId: string }) {
  const [obra, setObra] = useState<Obra | null>(null)
  const [medicoes, setMedicoes] = useState<ObraMedicao[]>([])
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

  async function load() {
    const supabase = createClient()
    const [{ data: obraData }, { data: medicaoData }, { data: financeiro }] = await Promise.all([
      supabase.from('obras').select('*').eq('id', obraId).single(),
      supabase.from('obra_medicoes').select('*').eq('obra_id', obraId).order('ordem'),
      supabase.from('obra_financeiro').select('valor_contrato').eq('obra_id', obraId).maybeSingle(),
    ])
    setObra(obraData as Obra)
    setMedicoes((medicaoData ?? []) as ObraMedicao[])
    setValorContrato(Number(financeiro?.valor_contrato || 0))
    setContratoInput(financeiro?.valor_contrato ? String(financeiro.valor_contrato) : '')
    setLoading(false)
  }
  useEffect(() => { load() }, [obraId])

  const totalPercentual = drafts.reduce((s, x) => s + Number(x.percentual || 0), 0)
  const resumo = useMemo(() => {
    const ativas = medicoes.filter(x => x.status !== 'cancelada')
    const planejado = ativas.reduce((s, x) => s + Number(x.valor_previsto || 0), 0)
    const faturado = ativas.reduce((s, x) => s + Number(x.valor_faturado || 0), 0)
    const recebido = ativas.reduce((s, x) => s + Number(x.valor_recebido || 0), 0)
    const percentualFaturado = ativas.filter(x => x.status === 'faturada' || x.status === 'recebida').reduce((s, x) => s + Number(x.percentual), 0)
    return { planejado, faturado, recebido, aberto: Math.max(0, faturado - recebido), saldo: Math.max(0, valorContrato - faturado), percentualFaturado }
  }, [medicoes, valorContrato])

  async function salvarContrato() {
    const valor = Number(contratoInput)
    if (!valor || valor <= 0) { setError('Informe um valor de contrato válido.'); return }
    setSaving(true)
    const supabase = createClient()
    const { error: contractError } = await supabase.from('obra_financeiro').upsert({ obra_id: obraId, valor_contrato: valor, updated_at: new Date().toISOString() })
    if (contractError) setError(contractError.message); else setValorContrato(valor)
    setSaving(false)
  }

  async function criarPlano() {
    setError('')
    if (!valorContrato) { setError('Defina o valor do contrato nesta área financeira antes de criar o plano.'); return }
    if (drafts.some(x => !x.nome.trim() || x.percentual <= 0)) { setError('Preencha o nome e um percentual válido em todas as etapas.'); return }
    if (Math.abs(totalPercentual - 100) > 0.001) { setError('A soma das etapas precisa ser exatamente 100%.'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const payload = drafts.map((x, i) => ({
      obra_id: obraId, ordem: i + 1, nome: x.nome.trim(), percentual: x.percentual,
      valor_previsto: valorContrato * x.percentual / 100,
      data_prevista: x.data_prevista || null, created_by: user?.id,
    }))
    const { error: insertError } = await supabase.from('obra_medicoes').insert(payload)
    if (insertError) setError(insertError.message)
    else await load()
    setSaving(false)
  }

  async function atualizar(m: ObraMedicao, changes: Partial<ObraMedicao>) {
    const supabase = createClient()
    const { error: updateError } = await supabase.from('obra_medicoes').update(changes).eq('id', m.id)
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

  async function anexarNF(m: ObraMedicao, file: File) {
    setUploading(m.id)
    const supabase = createClient()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${obraId}/${m.id}/${Date.now()}-${safeName}`
    if (m.nf_path) await supabase.storage.from('notas-fiscais-emitidas').remove([m.nf_path])
    const { error: uploadError } = await supabase.storage.from('notas-fiscais-emitidas').upload(path, file)
    if (uploadError) alert(uploadError.message)
    else await atualizar(m, { nf_path: path, nf_nome: file.name })
    setUploading(null)
  }

  async function abrirNF(m: ObraMedicao) {
    if (!m.nf_path) return
    const supabase = createClient()
    const { data, error: signedError } = await supabase.storage.from('notas-fiscais-emitidas').createSignedUrl(m.nf_path, 60)
    if (signedError) alert(signedError.message); else window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function removerNF(m: ObraMedicao) {
    if (!m.nf_path || !confirm(`Remover o anexo "${m.nf_nome || 'Nota fiscal'}"?`)) return
    setUploading(m.id)
    const supabase = createClient()
    const { error: storageError } = await supabase.storage.from('notas-fiscais-emitidas').remove([m.nf_path])
    if (storageError) { alert(storageError.message); setUploading(null); return }
    const { error: updateError } = await supabase.from('obra_medicoes').update({ nf_path: null, nf_nome: null }).eq('id', m.id)
    if (updateError) alert(updateError.message)
    else setMedicoes(list => list.map(x => x.id === m.id ? { ...x, nf_path: undefined, nf_nome: undefined } : x))
    setUploading(null)
  }

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-[#4F7CFF]" /></div>
  if (!obra) return <div className="p-6">Obra não encontrada.</div>

  const cards = [
    { label: 'Contrato', value: valorContrato, icon: CircleDollarSign, tone: 'bg-slate-100 text-slate-700' },
    { label: 'Faturado', value: resumo.faturado, icon: ReceiptText, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Recebido', value: resumo.recebido, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Saldo a faturar', value: resumo.saldo, icon: CalendarDays, tone: 'bg-amber-50 text-amber-700' },
  ]

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#0F172A] min-h-11"><ArrowLeft size={16} /> Voltar para a obra</Link>
      <div className="mt-2 mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4F7CFF]">Financeiro da obra</p>
        <h1 className="font-syne text-xl md:text-3xl font-bold text-[#0F172A] mt-1">Plano de medições</h1>
        <p className="text-sm text-[#64748B] mt-1 line-clamp-2">{obra.titulo}</p>
      </div>

      <section className="card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <label className="text-sm font-medium text-[#374151] flex-1">Valor do contrato
            <input type="number" min="0" step="0.01" className="field mt-1.5" placeholder="0,00" value={contratoInput} onChange={e => setContratoInput(e.target.value)} />
          </label>
          <button onClick={salvarContrato} disabled={saving || Boolean(medicoes.length)} className="btn-primary sm:w-auto">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar valor</button>
        </div>
        {medicoes.length > 0 && <p className="text-xs text-[#64748B] mt-2">O valor fica bloqueado após a criação do plano para preservar os cálculos das etapas.</p>}
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {cards.map(({ label, value, icon: Icon, tone }) => <div key={label} className="card p-4"><div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tone}`}><Icon size={17} /></div><p className="text-xs text-[#64748B] mt-3">{label}</p><p className="font-syne text-base md:text-xl font-bold text-[#0F172A] mt-0.5">{moeda(value)}</p></div>)}
      </div>

      {!medicoes.length ? (
        <section className="card">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5"><div><h2 className="font-syne font-semibold text-[#0F172A]">Defina as etapas</h2><p className="text-sm text-[#64748B] mt-1">A soma dos percentuais deve fechar em 100%.</p></div><div className={`text-sm font-bold px-3 py-2 rounded-lg ${Math.abs(totalPercentual - 100) < .001 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{totalPercentual.toLocaleString('pt-BR')}%</div></div>
          <div className="space-y-3">
            {drafts.map((d, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[48px_1fr_130px_160px_44px] items-end gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="hidden sm:flex h-11 items-center justify-center rounded-lg bg-white border border-[#E2E8F0] text-sm font-bold text-[#64748B]">{i + 1}</div>
                <label className="text-xs text-[#64748B]">Nome da etapa<input className="field mt-1" value={d.nome} onChange={e => setDrafts(list => list.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} /></label>
                <label className="text-xs text-[#64748B]">Percentual<input type="number" min="0.001" max="100" step="0.001" className="field mt-1" value={d.percentual} onChange={e => setDrafts(list => list.map((x, j) => j === i ? { ...x, percentual: Number(e.target.value) } : x))} /></label>
                <label className="text-xs text-[#64748B]">Previsão<input type="date" className="field mt-1" value={d.data_prevista} onChange={e => setDrafts(list => list.map((x, j) => j === i ? { ...x, data_prevista: e.target.value } : x))} /></label>
                <button aria-label="Remover etapa" disabled={drafts.length === 1} onClick={() => setDrafts(list => list.filter((_, j) => j !== i))} className="w-11 h-11 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-30"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          {error && <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</p>}
          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <button onClick={() => setDrafts(list => [...list, { nome: `${list.length + 1}ª medição`, percentual: 0, data_prevista: '' }])} className="btn-secondary"><Plus size={15} /> Adicionar etapa</button>
            <button onClick={criarPlano} disabled={saving} className="btn-primary sm:ml-auto">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar plano</button>
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-syne font-semibold text-[#0F172A]">Etapas da medição</h2><p className="text-xs text-[#64748B] mt-0.5">{resumo.percentualFaturado.toLocaleString('pt-BR')}% do contrato faturado</p></div></div>
          {medicoes.map(m => {
            const status = STATUS[m.status]
            return (
              <article key={m.id} className="card">
                <div className="flex items-start justify-between gap-3 mb-4"><div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-bold text-[#4F7CFF]">ETAPA {m.ordem}</span><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span></div><h3 className="font-syne font-semibold text-[#0F172A] mt-1">{m.nome}</h3><p className="text-sm text-[#64748B] mt-1">{Number(m.percentual).toLocaleString('pt-BR')}% · {moeda(Number(m.valor_previsto))} · previsão {dataBR(m.data_prevista)}</p></div><button aria-label="Excluir etapa" onClick={() => excluir(m)} className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={15} /></button></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="text-xs text-[#64748B]">Situação<select className="field mt-1" value={m.status} onChange={e => atualizar(m, { status: e.target.value as ObraMedicao['status'] })}>{Object.entries(STATUS).map(([id, x]) => <option key={id} value={id}>{x.label}</option>)}</select></label>
                  <label className="text-xs text-[#64748B]">Data de emissão<input type="date" className="field mt-1" value={m.data_emissao ?? ''} onChange={e => atualizar(m, { data_emissao: e.target.value || undefined })} /></label>
                  <label className="text-xs text-[#64748B]">Vencimento<input type="date" className="field mt-1" value={m.data_vencimento ?? ''} onChange={e => atualizar(m, { data_vencimento: e.target.value || undefined })} /></label>
                  <label className="text-xs text-[#64748B]">Data do pagamento<input type="date" className="field mt-1" value={m.data_pagamento ?? ''} onChange={e => atualizar(m, { data_pagamento: e.target.value || undefined })} /></label>
                  <label className="text-xs text-[#64748B]">Valor faturado<input type="number" step="0.01" className="field mt-1" value={m.valor_faturado ?? ''} onBlur={e => atualizar(m, { valor_faturado: Number(e.target.value) || undefined })} onChange={e => setMedicoes(list => list.map(x => x.id === m.id ? { ...x, valor_faturado: Number(e.target.value) } : x))} /></label>
                  <label className="text-xs text-[#64748B]">Valor recebido<input type="number" step="0.01" className="field mt-1" value={m.valor_recebido ?? ''} onBlur={e => atualizar(m, { valor_recebido: Number(e.target.value) || undefined })} onChange={e => setMedicoes(list => list.map(x => x.id === m.id ? { ...x, valor_recebido: Number(e.target.value) } : x))} /></label>
                  <label className="text-xs text-[#64748B]">Número da NF<input className="field mt-1" value={m.numero_nf ?? ''} onBlur={e => atualizar(m, { numero_nf: e.target.value || undefined })} onChange={e => setMedicoes(list => list.map(x => x.id === m.id ? { ...x, numero_nf: e.target.value } : x))} /></label>
                  <div className="min-w-0 text-xs text-[#64748B]">
                    Nota fiscal
                    <div className="mt-1 flex min-w-0 gap-2">
                      <label title={m.nf_nome || 'Anexar nota fiscal'} className="btn-secondary min-w-0 flex-1 cursor-pointer overflow-hidden px-3">
                        {uploading === m.id ? <Loader2 size={14} className="shrink-0 animate-spin" /> : <Upload size={14} className="shrink-0" />}
                        <span className="block min-w-0 flex-1 truncate text-left">{m.nf_nome || 'Anexar NF'}</span>
                        <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) anexarNF(m, f); e.target.value = '' }} />
                      </label>
                      {m.nf_path && (
                        <>
                          <button type="button" onClick={() => abrirNF(m)} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-[#EEF2FF] text-[#4F7CFF] hover:bg-[#DBEAFE]" aria-label={`Abrir ${m.nf_nome || 'nota fiscal'}`} title="Abrir nota fiscal">
                            <FileText size={16} />
                          </button>
                          <button type="button" disabled={uploading === m.id} onClick={() => removerNF(m)} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50" aria-label={`Remover ${m.nf_nome || 'nota fiscal'}`} title="Remover anexo">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
