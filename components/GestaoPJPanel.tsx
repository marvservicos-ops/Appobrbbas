'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Calendar, DollarSign, Clock, ChevronDown, ChevronUp, Loader2, Pencil, Trash2, RefreshCw } from 'lucide-react'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const dataBR = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const hoje = () => new Date().toISOString().split('T')[0]

interface Contrato {
  id: string
  numero_contrato: string | null
  data_inicio: string
  data_fim: string
  valor_mensal: number
  dias_ferias_acumulados: number
  observacao: string | null
  arquivo_url: string | null
}

interface Ferias {
  id: string
  contrato_id: string
  data_inicio: string
  data_fim: string
  dias: number
  valor_pago: number | null
  observacao: string | null
}

interface Pagamento {
  id: string
  contrato_id: string | null
  tipo: 'salario' | 'decimo_terceiro' | 'ferias_pagas' | 'hora_extra' | 'outro'
  competencia: string
  valor: number
  horas_extras: number | null
  observacao: string | null
  comprovante_url: string | null
  nota_fiscal_url: string | null
  nota_fiscal_urls: string[] | null
}

const tipoLabel: Record<Pagamento['tipo'], string> = {
  salario: 'Salário',
  decimo_terceiro: '13º Salário',
  ferias_pagas: 'Férias Pagas',
  hora_extra: 'Hora Extra',
  outro: 'Outro',
}

const tipoColor: Record<Pagamento['tipo'], string> = {
  salario: 'bg-blue-50 text-blue-700',
  decimo_terceiro: 'bg-purple-50 text-purple-700',
  ferias_pagas: 'bg-green-50 text-green-700',
  hora_extra: 'bg-amber-50 text-amber-700',
  outro: 'bg-gray-100 text-gray-600',
}

export default function GestaoPJPanel() {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [ferias, setFerias] = useState<Ferias[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [tab, setTab] = useState<'overview' | 'contratos' | 'ferias' | 'pagamentos'>('overview')
  const [showAddContrato, setShowAddContrato] = useState(false)
  const [editandoContrato, setEditandoContrato] = useState<Contrato | null>(null)
  const [showAddFerias, setShowAddFerias] = useState(false)
  const [editandoFerias, setEditandoFerias] = useState<Ferias | null>(null)
  const [showAddPagamento, setShowAddPagamento] = useState(false)
  const [editandoPagamento, setEditandoPagamento] = useState<Pagamento | null>(null)
  const [uploadingComprovante, setUploadingComprovante] = useState(false)
  const [uploadingNF, setUploadingNF] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedContrato, setExpandedContrato] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  // Forms
  const [fContrato, setFContrato] = useState({ numero_contrato: '', data_inicio: '', data_fim: '', valor_mensal: '', dias_ferias_acumulados: '15', observacao: '', arquivo_url: '' })
  const [fFerias, setFFerias] = useState({ contrato_id: '', data_inicio: '', data_fim: '', valor_pago: '', observacao: '' })
  const [fPagamento, setFPagamento] = useState({ contrato_id: '', tipo: 'salario' as Pagamento['tipo'], competencia: '', valor: '', horas_extras: '', observacao: '', comprovante_url: '', nota_fiscal_urls: [] as string[] })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const sb = createClient()
    const [{ data: c, error: eC }, { data: f, error: eF }, { data: p, error: eP }] = await Promise.all([
      sb.from('pj_contratos').select('*').order('data_inicio', { ascending: false }),
      sb.from('pj_ferias').select('*').order('data_inicio', { ascending: false }),
      sb.from('pj_pagamentos').select('*').order('competencia', { ascending: false }),
    ])
    const erroCarregamento = eC || eF || eP
    if (erroCarregamento) setErro(`Falha ao carregar dados: ${erroCarregamento.message}`)
    setContratos((c ?? []) as Contrato[])
    setFerias((f ?? []) as Ferias[])
    setPagamentos((p ?? []) as Pagamento[])
    setLoading(false)
  }

  // Computed
  const contratoAtivo = contratos.find(c => c.data_inicio <= hoje() && c.data_fim >= hoje())
  const totalDiasAcumulados = contratos.reduce((s, c) => s + c.dias_ferias_acumulados, 0)
  const totalDiasUsados = ferias.reduce((s, f) => s + f.dias, 0)
  const saldoFerias = totalDiasAcumulados - totalDiasUsados
  const proximaRenovacao = contratoAtivo
    ? new Date(new Date(contratoAtivo.data_fim + 'T12:00:00').getTime() + 1).toISOString().split('T')[0]
    : null
  const diasParaRenovacao = contratoAtivo
    ? Math.ceil((new Date(contratoAtivo.data_fim + 'T12:00:00').getTime() - new Date().getTime()) / 86400000)
    : null

  const totalPago = pagamentos.reduce((s, p) => s + p.valor, 0)
  const totalHorasExtras = pagamentos.filter(p => p.tipo === 'hora_extra').reduce((s, p) => s + (p.horas_extras ?? 0), 0)

  // Dias de férias do form
  function calcDiasFerias(ini: string, fim: string) {
    if (!ini || !fim) return 0
    const d1 = new Date(ini + 'T12:00:00')
    const d2 = new Date(fim + 'T12:00:00')
    return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1)
  }

  function abrirEditarContrato(c: Contrato) {
    setFContrato({
      numero_contrato: c.numero_contrato ?? '',
      data_inicio: c.data_inicio,
      data_fim: c.data_fim,
      valor_mensal: String(c.valor_mensal),
      dias_ferias_acumulados: String(c.dias_ferias_acumulados),
      observacao: c.observacao ?? '',
      arquivo_url: c.arquivo_url ?? '',
    })
    setEditandoContrato(c)
    setShowAddContrato(true)
  }

  async function salvarContrato() {
    if (!fContrato.data_inicio || !fContrato.data_fim || !fContrato.valor_mensal) return
    setSaving(true)
    setErro('')
    const sb = createClient()
    const payload = {
      numero_contrato: fContrato.numero_contrato || null,
      data_inicio: fContrato.data_inicio,
      data_fim: fContrato.data_fim,
      valor_mensal: parseFloat(fContrato.valor_mensal),
      dias_ferias_acumulados: parseInt(fContrato.dias_ferias_acumulados) || 15,
      observacao: fContrato.observacao || null,
      arquivo_url: fContrato.arquivo_url || null,
    }
    const { error } = editandoContrato
      ? await sb.from('pj_contratos').update(payload).eq('id', editandoContrato.id)
      : await sb.from('pj_contratos').insert(payload)
    setSaving(false)
    if (error) { setErro(`Falha ao salvar contrato: ${error.message}`); return }
    setFContrato({ numero_contrato: '', data_inicio: '', data_fim: '', valor_mensal: '', dias_ferias_acumulados: '15', observacao: '', arquivo_url: '' })
    setEditandoContrato(null)
    setShowAddContrato(false)
    load()
  }

  function abrirEditarFerias(f: Ferias) {
    setFFerias({
      contrato_id: f.contrato_id ?? '',
      data_inicio: f.data_inicio,
      data_fim: f.data_fim,
      valor_pago: f.valor_pago != null ? String(f.valor_pago) : '',
      observacao: f.observacao ?? '',
    })
    setEditandoFerias(f)
    setShowAddFerias(true)
  }

  function abrirEditarPagamento(p: Pagamento) {
    setFPagamento({
      contrato_id: p.contrato_id ?? '',
      tipo: p.tipo,
      competencia: p.competencia,
      valor: String(p.valor),
      horas_extras: p.horas_extras != null ? String(p.horas_extras) : '',
      observacao: p.observacao ?? '',
      comprovante_url: p.comprovante_url ?? '',
      nota_fiscal_urls: p.nota_fiscal_urls ?? (p.nota_fiscal_url ? [p.nota_fiscal_url] : []),
    })
    setEditandoPagamento(p)
    setShowAddPagamento(true)
  }

  async function uploadArquivo(file: File, bucket: string, folder: string): Promise<string | null> {
    setUploadingComprovante(true)
    const sb = createClient()
    const ext = file.name.split('.').pop()
    const path = `${folder}/${Date.now()}.${ext}`
    const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: true })
    if (error) { setUploadingComprovante(false); setErro(`Falha ao enviar arquivo: ${error.message}`); return null }
    const { data } = sb.storage.from(bucket).getPublicUrl(path)
    setUploadingComprovante(false)
    return data.publicUrl
  }

  async function uploadNFs(files: FileList) {
    setUploadingNF(true)
    const sb = createClient()
    const urls: string[] = []
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `notas-fiscais/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error } = await sb.storage.from('marv-pj').upload(path, file, { upsert: true })
      if (error) { setErro(`Falha ao enviar "${file.name}": ${error.message}`); continue }
      const { data } = sb.storage.from('marv-pj').getPublicUrl(path)
      urls.push(data.publicUrl)
    }
    if (urls.length > 0) setFPagamento(p => ({ ...p, nota_fiscal_urls: [...p.nota_fiscal_urls, ...urls] }))
    setUploadingNF(false)
  }

  async function salvarFerias() {
    if (!fFerias.data_inicio || !fFerias.data_fim) return
    setSaving(true)
    setErro('')
    const dias = calcDiasFerias(fFerias.data_inicio, fFerias.data_fim)
    const sb = createClient()
    const payload = {
      contrato_id: fFerias.contrato_id || null,
      data_inicio: fFerias.data_inicio,
      data_fim: fFerias.data_fim,
      dias,
      valor_pago: fFerias.valor_pago ? parseFloat(fFerias.valor_pago) : null,
      observacao: fFerias.observacao || null,
    }
    const { error } = editandoFerias
      ? await sb.from('pj_ferias').update(payload).eq('id', editandoFerias.id)
      : await sb.from('pj_ferias').insert(payload)
    setSaving(false)
    if (error) { setErro(`Falha ao salvar férias: ${error.message}`); return }
    setFFerias({ contrato_id: '', data_inicio: '', data_fim: '', valor_pago: '', observacao: '' })
    setEditandoFerias(null)
    setShowAddFerias(false)
    load()
  }

  async function salvarPagamento() {
    if (!fPagamento.competencia || !fPagamento.valor) return
    setSaving(true)
    setErro('')
    const sb = createClient()
    const payload = {
      contrato_id: fPagamento.contrato_id || null,
      tipo: fPagamento.tipo,
      competencia: fPagamento.competencia,
      valor: parseFloat(fPagamento.valor),
      horas_extras: fPagamento.horas_extras ? parseFloat(fPagamento.horas_extras) : null,
      observacao: fPagamento.observacao || null,
      comprovante_url: fPagamento.comprovante_url || null,
      nota_fiscal_url: fPagamento.nota_fiscal_urls[0] || null,
      nota_fiscal_urls: fPagamento.nota_fiscal_urls.length > 0 ? fPagamento.nota_fiscal_urls : null,
    }
    const { error } = editandoPagamento
      ? await sb.from('pj_pagamentos').update(payload).eq('id', editandoPagamento.id)
      : await sb.from('pj_pagamentos').insert(payload)
    setSaving(false)
    if (error) { setErro(`Falha ao salvar pagamento: ${error.message}`); return }
    setFPagamento({ contrato_id: '', tipo: 'salario', competencia: '', valor: '', horas_extras: '', observacao: '', comprovante_url: '', nota_fiscal_urls: [] })
    setEditandoPagamento(null)
    setShowAddPagamento(false)
    load()
  }

  async function deletarFerias(id: string) {
    if (!confirm('Remover este registro de férias?')) return
    const sb = createClient()
    const { error } = await sb.from('pj_ferias').delete().eq('id', id)
    if (error) { setErro(`Falha ao remover: ${error.message}`); return }
    load()
  }

  async function deletarPagamento(id: string) {
    if (!confirm('Remover este pagamento?')) return
    const sb = createClient()
    const { error } = await sb.from('pj_pagamentos').delete().eq('id', id)
    if (error) { setErro(`Falha ao remover: ${error.message}`); return }
    load()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-[#4F7CFF]" />
    </div>
  )

  const tabs = [
    { key: 'overview', label: 'Resumo' },
    { key: 'contratos', label: 'Contratos' },
    { key: 'ferias', label: 'Férias' },
    { key: 'pagamentos', label: 'Pagamentos' },
  ] as const

  return (
    <div className="flex flex-col">
      {/* Sub-abas */}
      <div className="flex gap-1 border-b border-[#E2E8F0] mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t.key ? 'border-[#4F7CFF] text-[#4F7CFF]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'}`}>
            {t.label}
          </button>
        ))}
        <button onClick={load} className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] transition-colors self-center">
          <RefreshCw size={13} className="text-[#94A3B8]" />
        </button>
      </div>

      {erro && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-3 mb-4">
          <span className="flex-1">{erro}</span>
          <button onClick={() => setErro('')} className="text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button>
        </div>
      )}

      <div className="pb-6">

        {/* ── OVERVIEW ─────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                <p className="text-[10px] text-[#94A3B8] font-medium uppercase tracking-wide mb-1">Saldo de Férias</p>
                <p className={`text-2xl font-bold ${saldoFerias < 5 ? 'text-red-500' : saldoFerias < 10 ? 'text-amber-500' : 'text-[#10B981]'}`}>{saldoFerias}d</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">{totalDiasAcumulados}d acum. · {totalDiasUsados}d usados</p>
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                <p className="text-[10px] text-[#94A3B8] font-medium uppercase tracking-wide mb-1">Salário Atual</p>
                <p className="text-2xl font-bold text-[#0F172A]">{contratoAtivo ? moeda(contratoAtivo.valor_mensal) : '—'}</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">por mês</p>
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                <p className="text-[10px] text-[#94A3B8] font-medium uppercase tracking-wide mb-1">Renovação em</p>
                <p className={`text-2xl font-bold ${diasParaRenovacao !== null && diasParaRenovacao <= 30 ? 'text-amber-500' : 'text-[#0F172A]'}`}>
                  {diasParaRenovacao !== null ? `${diasParaRenovacao}d` : '—'}
                </p>
                <p className="text-xs text-[#94A3B8] mt-0.5">{contratoAtivo ? dataBR(contratoAtivo.data_fim) : 'Sem contrato ativo'}</p>
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                <p className="text-[10px] text-[#94A3B8] font-medium uppercase tracking-wide mb-1">Total Pago</p>
                <p className="text-2xl font-bold text-[#4F7CFF]">{moeda(totalPago)}</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">{pagamentos.length} lançamentos</p>
              </div>
            </div>

            {/* Contrato ativo */}
            {contratoAtivo && (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-3">Contrato Ativo</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><p className="text-[#94A3B8] text-xs mb-0.5">Início</p><p className="font-medium">{dataBR(contratoAtivo.data_inicio)}</p></div>
                  <div><p className="text-[#94A3B8] text-xs mb-0.5">Vencimento</p><p className="font-medium">{dataBR(contratoAtivo.data_fim)}</p></div>
                  <div><p className="text-[#94A3B8] text-xs mb-0.5">Valor mensal</p><p className="font-medium text-[#4F7CFF]">{moeda(contratoAtivo.valor_mensal)}</p></div>
                  <div><p className="text-[#94A3B8] text-xs mb-0.5">Férias no ciclo</p><p className="font-medium">{contratoAtivo.dias_ferias_acumulados} dias</p></div>
                </div>
                {contratoAtivo.observacao && <p className="text-xs text-[#64748B] mt-3 pt-3 border-t border-[#F1F5F9]">{contratoAtivo.observacao}</p>}
              </div>
            )}

            {/* Alertas */}
            {diasParaRenovacao !== null && diasParaRenovacao <= 30 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                  <Calendar size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Contrato vence em {diasParaRenovacao} dias</p>
                  <p className="text-xs text-amber-600 mt-0.5">Renovação prevista para {contratoAtivo ? dataBR(contratoAtivo.data_fim) : ''}. Não esqueça de registrar o novo ciclo.</p>
                </div>
              </div>
            )}

            {/* Últimos pagamentos */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
                <h3 className="text-sm font-semibold text-[#0F172A]">Últimos Pagamentos</h3>
                <button onClick={() => setTab('pagamentos')} className="text-xs text-[#4F7CFF] hover:underline">Ver todos</button>
              </div>
              {pagamentos.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3 border-b border-[#F8FAFC] last:border-0">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tipoColor[p.tipo]}`}>{tipoLabel[p.tipo]}</span>
                  <span className="text-xs text-[#64748B]">{p.competencia}</span>
                  <span className="ml-auto text-sm font-semibold text-[#0F172A]">{moeda(p.valor)}</span>
                </div>
              ))}
              {pagamentos.length === 0 && <p className="text-sm text-[#94A3B8] text-center py-8">Nenhum pagamento registrado</p>}
            </div>

            {/* Horas extras resumo */}
            {totalHorasExtras > 0 && (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-2">Horas Extras</h3>
                <p className="text-3xl font-bold text-amber-600">{totalHorasExtras}h</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">total registrado</p>
              </div>
            )}
          </div>
        )}

        {/* ── CONTRATOS ─────────────────────────────────── */}
        {tab === 'contratos' && (
          <div className="space-y-4">
            <button onClick={() => { setEditandoContrato(null); setFContrato({ numero_contrato: '', data_inicio: '', data_fim: '', valor_mensal: '', dias_ferias_acumulados: '15', observacao: '', arquivo_url: '' }); setShowAddContrato(true) }}
              className="w-full flex items-center gap-2 justify-center py-3 border-2 border-dashed border-[#E2E8F0] rounded-xl text-sm text-[#64748B] hover:border-[#4F7CFF] hover:text-[#4F7CFF] transition-colors">
              <Plus size={16} /> Novo Contrato
            </button>

            {showAddContrato && (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-[#0F172A]">{editandoContrato ? 'Editar Contrato' : 'Novo Contrato'}</h3>
                  <button onClick={() => { setShowAddContrato(false); setEditandoContrato(null) }}><X size={16} className="text-[#94A3B8]" /></button>
                </div>
                <div>
                  <label className="text-xs text-[#64748B] font-medium block mb-1">Número do contrato</label>
                  <input type="text" placeholder="Ex: CT-001/2025" value={fContrato.numero_contrato} onChange={e => setFContrato(p => ({ ...p, numero_contrato: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#64748B] font-medium block mb-1">Início *</label>
                    <input type="date" value={fContrato.data_inicio} onChange={e => setFContrato(p => ({ ...p, data_inicio: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF]" />
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] font-medium block mb-1">Fim *</label>
                    <input type="date" value={fContrato.data_fim} onChange={e => setFContrato(p => ({ ...p, data_fim: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF]" />
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] font-medium block mb-1">Valor mensal (R$) *</label>
                    <input type="number" step="0.01" placeholder="0,00" value={fContrato.valor_mensal} onChange={e => setFContrato(p => ({ ...p, valor_mensal: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF]" />
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] font-medium block mb-1">Dias de férias acumulados</label>
                    <input type="number" placeholder="15" value={fContrato.dias_ferias_acumulados} onChange={e => setFContrato(p => ({ ...p, dias_ferias_acumulados: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF]" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#64748B] font-medium block mb-1">Observação</label>
                  <input type="text" placeholder="Ex: Renovação com reajuste de 10%" value={fContrato.observacao} onChange={e => setFContrato(p => ({ ...p, observacao: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF]" />
                </div>
                <div>
                  <label className="text-xs text-[#64748B] font-medium block mb-1">Arquivo do contrato (PDF/DOCX)</label>
                  {fContrato.arquivo_url
                    ? <div className="flex items-center gap-2">
                        <a href={fContrato.arquivo_url} target="_blank" rel="noreferrer" className="text-xs text-[#4F7CFF] underline truncate flex-1">Ver contrato</a>
                        <button onClick={() => setFContrato(p => ({ ...p, arquivo_url: '' }))} className="text-[#94A3B8] hover:text-red-400"><X size={12} /></button>
                      </div>
                    : <label className={`flex items-center gap-2 px-3 py-2 border border-dashed border-[#E2E8F0] rounded-lg text-xs text-[#64748B] cursor-pointer hover:border-[#4F7CFF] ${uploadingComprovante ? 'opacity-50' : ''}`}>
                        <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" disabled={uploadingComprovante}
                          onChange={async e => { const f = e.target.files?.[0]; if (f) { const url = await uploadArquivo(f, 'marv-pj', 'contratos'); if (url) setFContrato(p => ({ ...p, arquivo_url: url })) } }} />
                        {uploadingComprovante ? 'Enviando...' : 'Selecionar arquivo'}
                      </label>}
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => { setShowAddContrato(false); setEditandoContrato(null) }} className="px-4 py-2 text-sm text-[#64748B] hover:bg-[#F1F5F9] rounded-lg transition-colors">Cancelar</button>
                  <button onClick={salvarContrato} disabled={saving || uploadingComprovante}
                    className="px-4 py-2 text-sm font-medium bg-[#4F7CFF] text-white rounded-lg hover:bg-[#3D6AEE] disabled:opacity-50 transition-colors">
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}

            {contratos.map(c => {
              const isAtivo = c.data_inicio <= hoje() && c.data_fim >= hoje()
              const isExpanded = expandedContrato === c.id
              const feriasContrato = ferias.filter(f => f.contrato_id === c.id)
              const pgContrato = pagamentos.filter(p => p.contrato_id === c.id)
              const diasUsados = feriasContrato.reduce((s, f) => s + f.dias, 0)
              return (
                <div key={c.id} className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                  <div className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#F8FAFC] transition-colors">
                    <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => setExpandedContrato(isExpanded ? null : c.id)}>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isAtivo ? 'bg-[#10B981]' : 'bg-[#CBD5E1]'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {c.numero_contrato && <span className="text-[10px] font-mono font-semibold bg-[#F1F5F9] text-[#475569] px-2 py-0.5 rounded">{c.numero_contrato}</span>}
                          <span className="text-sm font-semibold text-[#0F172A]">{dataBR(c.data_inicio)} → {dataBR(c.data_fim)}</span>
                          {isAtivo && <span className="text-[10px] font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Ativo</span>}
                        </div>
                        <p className="text-xs text-[#64748B] mt-0.5">{moeda(c.valor_mensal)}/mês · {c.dias_ferias_acumulados}d férias · {diasUsados}d usados</p>
                      </div>
                      {isExpanded ? <ChevronUp size={16} className="text-[#94A3B8] shrink-0" /> : <ChevronDown size={16} className="text-[#94A3B8] shrink-0" />}
                    </button>
                    <button onClick={e => { e.stopPropagation(); abrirEditarContrato(c) }}
                      className="p-1.5 text-[#94A3B8] hover:text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors shrink-0">
                      <Pencil size={14} />
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-[#F1F5F9] pt-4 space-y-4">
                      {(c.observacao || c.arquivo_url) && (
                        <div className="flex items-center gap-3">
                          {c.observacao && <p className="text-xs text-[#64748B] flex-1">{c.observacao}</p>}
                          {c.arquivo_url && <a href={c.arquivo_url} target="_blank" rel="noreferrer" className="text-xs text-[#4F7CFF] underline shrink-0">Ver contrato</a>}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-[#F8FAFC] rounded-lg p-3">
                          <p className="text-xs text-[#94A3B8] mb-1">Saldo férias neste ciclo</p>
                          <p className="font-bold text-[#0F172A]">{c.dias_ferias_acumulados - diasUsados}d restantes</p>
                        </div>
                        <div className="bg-[#F8FAFC] rounded-lg p-3">
                          <p className="text-xs text-[#94A3B8] mb-1">Pagamentos no ciclo</p>
                          <p className="font-bold text-[#0F172A]">{moeda(pgContrato.reduce((s, p) => s + p.valor, 0))}</p>
                        </div>
                      </div>
                      {feriasContrato.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-[#64748B] mb-2">Férias neste ciclo</p>
                          {feriasContrato.map(f => (
                            <div key={f.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-[#F1F5F9] last:border-0">
                              <span className="text-[#0F172A]">{dataBR(f.data_inicio)} → {dataBR(f.data_fim)}</span>
                              <span className="text-[#94A3B8]">({f.dias}d)</span>
                              {f.valor_pago && <span className="text-green-600">{moeda(f.valor_pago)}</span>}
                              <button onClick={() => deletarFerias(f.id)} className="ml-auto w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-[#CBD5E1] hover:text-[#EF4444] transition-colors">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {contratos.length === 0 && <p className="text-sm text-[#94A3B8] text-center py-12">Nenhum contrato registrado</p>}
          </div>
        )}

        {/* ── FÉRIAS ─────────────────────────────────── */}
        {tab === 'ferias' && (
          <div className="space-y-4">
            {/* Banco de férias summary */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#0F172A] mb-3">Banco de Férias</h3>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#4F7CFF]">{totalDiasAcumulados}</p>
                  <p className="text-xs text-[#94A3B8]">acumulados</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#EF4444]">{totalDiasUsados}</p>
                  <p className="text-xs text-[#94A3B8]">usados</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${saldoFerias < 5 ? 'text-red-500' : saldoFerias < 10 ? 'text-amber-500' : 'text-[#10B981]'}`}>{saldoFerias}</p>
                  <p className="text-xs text-[#94A3B8]">saldo</p>
                </div>
              </div>
              <div className="h-2 bg-[#F1F5F9] rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-[#EF4444] rounded-full transition-all" style={{ width: `${totalDiasAcumulados > 0 ? Math.min(100, (totalDiasUsados / totalDiasAcumulados) * 100) : 0}%` }} />
              </div>
              <p className="text-xs text-[#94A3B8] mt-1">{totalDiasAcumulados > 0 ? ((totalDiasUsados / totalDiasAcumulados) * 100).toFixed(0) : 0}% do banco utilizado</p>
            </div>

            <button onClick={() => { setEditandoFerias(null); setFFerias({ contrato_id: '', data_inicio: '', data_fim: '', valor_pago: '', observacao: '' }); setShowAddFerias(true) }}
              className="w-full flex items-center gap-2 justify-center py-3 border-2 border-dashed border-[#E2E8F0] rounded-xl text-sm text-[#64748B] hover:border-[#4F7CFF] hover:text-[#4F7CFF] transition-colors">
              <Plus size={16} /> Registrar Férias
            </button>

            {showAddFerias && (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-[#0F172A]">{editandoFerias ? 'Editar Férias' : 'Registrar Férias'}</h3>
                  <button onClick={() => { setShowAddFerias(false); setEditandoFerias(null) }}><X size={16} className="text-[#94A3B8]" /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#64748B] font-medium block mb-1">Início *</label>
                    <input type="date" value={fFerias.data_inicio} onChange={e => setFFerias(p => ({ ...p, data_inicio: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF]" />
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] font-medium block mb-1">Fim *</label>
                    <input type="date" value={fFerias.data_fim} onChange={e => setFFerias(p => ({ ...p, data_fim: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF]" />
                  </div>
                </div>
                {fFerias.data_inicio && fFerias.data_fim && (
                  <p className="text-sm font-medium text-[#4F7CFF]">{calcDiasFerias(fFerias.data_inicio, fFerias.data_fim)} dias</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#64748B] font-medium block mb-1">Contrato referência</label>
                    <select value={fFerias.contrato_id} onChange={e => setFFerias(p => ({ ...p, contrato_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF]">
                      <option value="">Nenhum</option>
                      {contratos.map(c => <option key={c.id} value={c.id}>{dataBR(c.data_inicio)} → {dataBR(c.data_fim)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] font-medium block mb-1">Valor pago (R$)</label>
                    <input type="number" step="0.01" placeholder="Opcional" value={fFerias.valor_pago} onChange={e => setFFerias(p => ({ ...p, valor_pago: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF]" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#64748B] font-medium block mb-1">Observação</label>
                  <input type="text" placeholder="Ex: Férias de dezembro/2024" value={fFerias.observacao} onChange={e => setFFerias(p => ({ ...p, observacao: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF]" />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => { setShowAddFerias(false); setEditandoFerias(null) }} className="px-4 py-2 text-sm text-[#64748B] hover:bg-[#F1F5F9] rounded-lg transition-colors">Cancelar</button>
                  <button onClick={salvarFerias} disabled={saving}
                    className="px-4 py-2 text-sm font-medium bg-[#4F7CFF] text-white rounded-lg hover:bg-[#3D6AEE] disabled:opacity-50 transition-colors">
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white border border-[#E2E8F0] rounded-xl divide-y divide-[#F8FAFC]">
              {ferias.map(f => (
                <div key={f.id} className="flex items-center gap-3 px-5 py-4">
                  <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                    <Calendar size={14} className="text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A]">{dataBR(f.data_inicio)} → {dataBR(f.data_fim)}</p>
                    <p className="text-xs text-[#94A3B8]">{f.dias} dias{f.valor_pago ? ` · ${moeda(f.valor_pago)}` : ''}{f.observacao ? ` · ${f.observacao}` : ''}</p>
                  </div>
                  <button onClick={() => abrirEditarFerias(f)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#EEF2FF] text-[#CBD5E1] hover:text-[#4F7CFF] transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => deletarFerias(f.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-[#CBD5E1] hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {ferias.length === 0 && <p className="text-sm text-[#94A3B8] text-center py-12">Nenhum registro de férias</p>}
            </div>
          </div>
        )}

        {/* ── PAGAMENTOS ─────────────────────────────────── */}
        {tab === 'pagamentos' && (
          <div className="space-y-4">
            {/* Resumo por tipo */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(['salario', 'decimo_terceiro', 'ferias_pagas', 'hora_extra', 'outro'] as Pagamento['tipo'][]).map(tipo => {
                const total = pagamentos.filter(p => p.tipo === tipo).reduce((s, p) => s + p.valor, 0)
                if (total === 0) return null
                return (
                  <div key={tipo} className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tipoColor[tipo]}`}>{tipoLabel[tipo]}</span>
                    <p className="text-lg font-bold text-[#0F172A] mt-2">{moeda(total)}</p>
                  </div>
                )
              })}
            </div>

            <button onClick={() => { setEditandoPagamento(null); setFPagamento({ contrato_id: '', tipo: 'salario', competencia: '', valor: '', horas_extras: '', observacao: '', comprovante_url: '', nota_fiscal_url: '' }); setShowAddPagamento(true) }}
              className="w-full flex items-center gap-2 justify-center py-3 border-2 border-dashed border-[#E2E8F0] rounded-xl text-sm text-[#64748B] hover:border-[#4F7CFF] hover:text-[#4F7CFF] transition-colors">
              <Plus size={16} /> Registrar Pagamento
            </button>

            {showAddPagamento && (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-[#0F172A]">{editandoPagamento ? 'Editar Pagamento' : 'Registrar Pagamento'}</h3>
                  <button onClick={() => { setShowAddPagamento(false); setEditandoPagamento(null) }}><X size={16} className="text-[#94A3B8]" /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#64748B] font-medium block mb-1">Tipo *</label>
                    <select value={fPagamento.tipo} onChange={e => setFPagamento(p => ({ ...p, tipo: e.target.value as Pagamento['tipo'] }))}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF]">
                      {Object.entries(tipoLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] font-medium block mb-1">Competência *</label>
                    <input type="month" value={fPagamento.competencia} onChange={e => setFPagamento(p => ({ ...p, competencia: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF]" />
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] font-medium block mb-1">Valor (R$) *</label>
                    <input type="number" step="0.01" placeholder="0,00" value={fPagamento.valor} onChange={e => setFPagamento(p => ({ ...p, valor: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF]" />
                  </div>
                  {fPagamento.tipo === 'hora_extra' && (
                    <div>
                      <label className="text-xs text-[#64748B] font-medium block mb-1">Horas extras</label>
                      <input type="number" step="0.5" placeholder="0" value={fPagamento.horas_extras} onChange={e => setFPagamento(p => ({ ...p, horas_extras: e.target.value }))}
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF]" />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#64748B] font-medium block mb-1">Contrato referência</label>
                    <select value={fPagamento.contrato_id} onChange={e => setFPagamento(p => ({ ...p, contrato_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF]">
                      <option value="">Nenhum</option>
                      {contratos.map(c => <option key={c.id} value={c.id}>{dataBR(c.data_inicio)} → {dataBR(c.data_fim)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] font-medium block mb-1">Observação</label>
                    <input type="text" placeholder="Opcional" value={fPagamento.observacao} onChange={e => setFPagamento(p => ({ ...p, observacao: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#64748B] font-medium block mb-1">Comprovante de pagamento</label>
                    {fPagamento.comprovante_url
                      ? <div className="flex items-center gap-2">
                          <a href={fPagamento.comprovante_url} target="_blank" rel="noreferrer" className="text-xs text-[#4F7CFF] underline truncate flex-1">Ver arquivo</a>
                          <button onClick={() => setFPagamento(p => ({ ...p, comprovante_url: '' }))} className="text-[#94A3B8] hover:text-red-400"><X size={12} /></button>
                        </div>
                      : <label className={`flex items-center gap-2 px-3 py-2 border border-dashed border-[#E2E8F0] rounded-lg text-xs text-[#64748B] cursor-pointer hover:border-[#4F7CFF] ${uploadingComprovante ? 'opacity-50' : ''}`}>
                          <input type="file" className="hidden" disabled={uploadingComprovante}
                            onChange={async e => { const f = e.target.files?.[0]; if (f) { const url = await uploadArquivo(f, 'marv-pj', 'comprovantes'); if (url) setFPagamento(p => ({ ...p, comprovante_url: url })) } }} />
                          {uploadingComprovante ? 'Enviando...' : 'Selecionar arquivo'}
                        </label>}
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] font-medium block mb-1">
                      Nota{fPagamento.nota_fiscal_urls.length !== 1 ? 's' : ''} Fiscal{fPagamento.nota_fiscal_urls.length !== 1 ? 'is' : ''} (HTML/XLSX/PDF)
                    </label>
                    <div className="space-y-1.5">
                      {fPagamento.nota_fiscal_urls.map((url, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <a href={url} target="_blank" rel="noreferrer" className="text-xs text-[#4F7CFF] underline truncate flex-1">NF {i + 1}</a>
                          <button onClick={() => setFPagamento(p => ({ ...p, nota_fiscal_urls: p.nota_fiscal_urls.filter((_, idx) => idx !== i) }))}
                            className="text-[#94A3B8] hover:text-red-400"><X size={12} /></button>
                        </div>
                      ))}
                      <label className={`flex items-center gap-2 px-3 py-2 border border-dashed border-[#E2E8F0] rounded-lg text-xs text-[#64748B] cursor-pointer hover:border-[#4F7CFF] ${uploadingNF ? 'opacity-50' : ''}`}>
                        <input type="file" accept=".html,.htm,.xlsx,.xls,.pdf,.jpg,.jpeg,.png" multiple className="hidden" disabled={uploadingNF}
                          onChange={async e => { const files = e.target.files; if (files && files.length > 0) { await uploadNFs(files); e.target.value = '' } }} />
                        {uploadingNF ? 'Enviando...' : 'Adicionar NF (pode selecionar várias)'}
                      </label>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => { setShowAddPagamento(false); setEditandoPagamento(null) }} className="px-4 py-2 text-sm text-[#64748B] hover:bg-[#F1F5F9] rounded-lg transition-colors">Cancelar</button>
                  <button onClick={salvarPagamento} disabled={saving || uploadingComprovante}
                    className="px-4 py-2 text-sm font-medium bg-[#4F7CFF] text-white rounded-lg hover:bg-[#3D6AEE] disabled:opacity-50 transition-colors">
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white border border-[#E2E8F0] rounded-xl divide-y divide-[#F8FAFC]">
              {pagamentos.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${p.tipo === 'hora_extra' ? 'bg-amber-50' : p.tipo === 'salario' ? 'bg-blue-50' : 'bg-purple-50'}`}>
                    <DollarSign size={14} className={p.tipo === 'hora_extra' ? 'text-amber-600' : p.tipo === 'salario' ? 'text-blue-600' : 'text-purple-600'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${tipoColor[p.tipo]}`}>{tipoLabel[p.tipo]}</span>
                      <span className="text-xs text-[#64748B]">{p.competencia}</span>
                      {p.horas_extras && <span className="text-xs text-amber-600">{p.horas_extras}h</span>}
                      {p.comprovante_url && <a href={p.comprovante_url} target="_blank" rel="noreferrer" className="text-[10px] text-[#4F7CFF] underline">Comprovante</a>}
                      {(p.nota_fiscal_urls ?? (p.nota_fiscal_url ? [p.nota_fiscal_url] : [])).map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" className="text-[10px] text-[#4F7CFF] underline">NF{(p.nota_fiscal_urls?.length ?? 1) > 1 ? ` ${i + 1}` : ''}</a>
                      ))}
                    </div>
                    {p.observacao && <p className="text-xs text-[#94A3B8] mt-0.5 truncate">{p.observacao}</p>}
                  </div>
                  <p className="text-sm font-semibold text-[#0F172A] shrink-0">{moeda(p.valor)}</p>
                  <button onClick={() => abrirEditarPagamento(p)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#EEF2FF] text-[#CBD5E1] hover:text-[#4F7CFF] transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => deletarPagamento(p.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-[#CBD5E1] hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {pagamentos.length === 0 && <p className="text-sm text-[#94A3B8] text-center py-12">Nenhum pagamento registrado</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
