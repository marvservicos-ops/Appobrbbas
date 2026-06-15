'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Search, Bell, MapPin, FileText, PlusCircle, BarChart2, Upload, X, Wrench, Calendar, User, Hash, DollarSign, Clock, CheckCircle2, AlertTriangle, ExternalLink, FolderOpen, Folder, Plus, Trash2, ChevronDown, ChevronRight, FileSpreadsheet, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Obra, CronogramaEtapa, Documento, CategoriaDoc, StatusEtapa, DocPasta, RDO } from '@/lib/types'
import StatusChip from '@/components/StatusChip'
import Link from 'next/link'

type Tab = 'visao-geral' | 'documentos' | 'cronograma' | 'relatorios'

function formatDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

function formatCurrency(v?: number | null) {
  if (!v) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

const categoriaConfig: Record<CategoriaDoc, { bg: string; text: string }> = {
  Financeiro: { bg: 'bg-blue-50', text: 'text-blue-700' },
  Técnico: { bg: 'bg-teal-50', text: 'text-teal-700' },
  Jurídico: { bg: 'bg-purple-50', text: 'text-purple-700' },
  Outros: { bg: 'bg-gray-100', text: 'text-gray-600' },
}

export default function ObraDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('visao-geral')
  const [obra, setObra] = useState<Obra | null>(null)
  const [etapas, setEtapas] = useState<CronogramaEtapa[]>([])
  const [docs, setDocs] = useState<Documento[]>([])
  const [pastas, setPastas] = useState<DocPasta[]>([])
  const [rdos, setRdos] = useState<RDO[]>([])
  const [criandoRdo, setCriandoRdo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pastaAtiva, setPastaAtiva] = useState<string>('__todas__')
  const [pastasAbertas, setPastasAbertas] = useState<Record<string, boolean>>({})

  // Modals
  const [showNovaEtapa, setShowNovaEtapa] = useState(false)
  const [showAddDoc, setShowAddDoc] = useState(false)
  const [showNovaPasta, setShowNovaPasta] = useState(false)
  const [pastaParaDoc, setPastaParaDoc] = useState<string>('Geral')
  const [importandoExcel, setImportandoExcel] = useState(false)

  async function importarExcelCronograma(file: File) {
    setImportandoExcel(true)
    try {
      const { read, utils } = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = read(buffer)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = utils.sheet_to_json(ws, { defval: '' })

      const supabase = createClient()
      const etapasParaInserir = rows
        .filter(r => r['Etapa'] || r['Nome'] || r['Titulo'] || r['título'] || r['etapa'])
        .map((r, i) => {
          const titulo = r['Etapa'] || r['Nome'] || r['Titulo'] || r['título'] || r['etapa'] || `Etapa ${i + 1}`
          const responsavel = r['Responsável'] || r['Responsavel'] || r['responsavel'] || ''
          const parseDate = (v: any) => {
            if (!v) return null
            if (typeof v === 'number') {
              // Excel serial date
              const d = new Date(Math.round((v - 25569) * 86400 * 1000))
              return d.toISOString().split('T')[0]
            }
            const s = String(v).trim()
            if (!s) return null
            const parts = s.split(/[/\-.]/)
            if (parts.length === 3) {
              // dd/mm/yyyy
              if (parts[0].length <= 2) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
              return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`
            }
            return null
          }
          return {
            obra_id: id,
            titulo: String(titulo).trim(),
            responsavel: responsavel ? String(responsavel).trim() : null,
            data_inicio: parseDate(r['Início'] || r['Inicio'] || r['Data Início'] || r['Data Inicio'] || r['inicio']),
            data_fim: parseDate(r['Fim'] || r['Término'] || r['Termino'] || r['Data Fim'] || r['fim']),
            progresso: parseInt(r['Progresso'] || r['%'] || '0') || 0,
            status: 'Pendente' as const,
            ordem: etapas.length + i + 1,
          }
        })

      if (etapasParaInserir.length > 0) {
        await supabase.from('cronograma_etapas').insert(etapasParaInserir)
        await load()
        alert(`${etapasParaInserir.length} etapas importadas com sucesso!`)
      } else {
        alert('Nenhuma etapa encontrada. Verifique se o arquivo tem a coluna "Etapa" ou "Nome".')
      }
    } catch (e) {
      alert('Erro ao ler o arquivo Excel.')
    }
    setImportandoExcel(false)
  }

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const [obraRes, etapasRes, docsRes, pastasRes, rdosRes] = await Promise.all([
      supabase.from('obras').select('*, cliente:clientes(*)').eq('id', id).single(),
      supabase.from('cronograma_etapas').select('*').eq('obra_id', id).order('ordem'),
      supabase.from('documentos').select('*').eq('obra_id', id).order('pasta').order('created_at', { ascending: false }),
      supabase.from('doc_pastas').select('*').eq('obra_id', id).order('ordem'),
      supabase.from('rdos').select('*').eq('obra_id', id).order('numero', { ascending: false }),
    ])
    if (obraRes.data) setObra(obraRes.data as Obra)
    if (etapasRes.data) setEtapas(etapasRes.data as CronogramaEtapa[])
    if (docsRes.data) setDocs(docsRes.data as Documento[])
    if (pastasRes.data) setPastas(pastasRes.data as DocPasta[])
    if (rdosRes.data) setRdos(rdosRes.data as RDO[])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [id])

  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-screen">
      <div className="w-8 h-8 border-2 border-[#4F7CFF] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!obra) return (
    <div className="flex flex-col items-center justify-center h-full min-h-screen gap-4">
      <p className="text-[#64748B]">Obra não encontrada.</p>
      <Link href="/obras" className="btn-primary">Voltar</Link>
    </div>
  )

  // Calc time
  const today = new Date()
  const startDate = obra.data_inicio ? new Date(obra.data_inicio) : null
  const endDate = obra.previsao_termino ? new Date(obra.previsao_termino) : null
  const diasDecorridos = startDate ? Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / 86400000)) : 0
  const diasRestantes = endDate ? Math.max(0, Math.floor((endDate.getTime() - today.getTime()) / 86400000)) : 0
  const prazoOk = endDate ? today <= endDate : true

  // Cronograma stats
  const atrasadas = etapas.filter(e => e.status === 'Atrasada').length
  const totalEtapas = etapas.length
  const progressoGeral = totalEtapas > 0 ? Math.round(etapas.reduce((s, e) => s + e.progresso, 0) / totalEtapas) : 0

  // Docs
  const todasPastasNomes = ['Geral', ...pastas.map(p => p.nome), ...Array.from(new Set(docs.map(d => d.pasta || 'Geral').filter(p => p !== 'Geral' && !pastas.find(pp => pp.nome === p))))]
  const docsFiltrados = pastaAtiva === '__todas__' ? docs : docs.filter(d => (d.pasta || 'Geral') === pastaAtiva)
  const totalFinanceiro = docs.filter(d => d.categoria === 'Financeiro').reduce((s, d) => s + (d.valor || 0), 0)
  const totalTecnico = docs.filter(d => d.categoria === 'Técnico').reduce((s, d) => s + (d.valor || 0), 0)

  function togglePasta(nome: string) {
    setPastasAbertas(prev => ({ ...prev, [nome]: !prev[nome] }))
  }

  async function excluirDoc(docId: string, arquivoPath?: string) {
    if (!confirm('Excluir este documento?')) return
    const supabase = createClient()
    if (arquivoPath) await supabase.storage.from('documentos').remove([arquivoPath])
    await supabase.from('documentos').delete().eq('id', docId)
    load()
  }

  async function criarPasta(nome: string) {
    const supabase = createClient()
    await supabase.from('doc_pastas').insert({ obra_id: id, nome, ordem: pastas.length })
    load()
  }

  async function criarNovoRdo() {
    setCriandoRdo(true)
    const supabase = createClient()
    const proximoNumero = rdos.length > 0 ? Math.max(...rdos.map(r => r.numero)) + 1 : 1
    const { data: rdo } = await supabase.from('rdos').insert({
      obra_id: id, numero: proximoNumero, data: new Date().toISOString().split('T')[0], status: 'preenchendo',
    }).select().single()
    if (rdo) {
      await supabase.from('rdo_clima').insert([
        { rdo_id: rdo.id, periodo: 'manha', ativo: true, tempo: 'claro', condicao: 'praticavel' },
        { rdo_id: rdo.id, periodo: 'tarde', ativo: true, tempo: 'claro', condicao: 'praticavel' },
        { rdo_id: rdo.id, periodo: 'noite', ativo: false },
      ])
      router.push(`/obras/${id}/rdo/${rdo.id}`)
    }
    setCriandoRdo(false)
  }

  async function excluirPasta(pastaId: string, nomePasta: string) {
    if (!confirm(`Excluir a pasta "${nomePasta}"? Os documentos dentro dela serão movidos para Geral.`)) return
    const supabase = createClient()
    await supabase.from('documentos').update({ pasta: 'Geral' }).eq('obra_id', id).eq('pasta', nomePasta)
    await supabase.from('doc_pastas').delete().eq('id', pastaId)
    if (pastaAtiva === nomePasta) setPastaAtiva('__todas__')
    load()
  }

  return (
    <div className="flex flex-col h-full min-h-screen">
      {/* Topbar */}
      <header className="h-14 bg-white border-b border-[#E2E8F0] flex items-center px-3 md:px-6 gap-3 sticky top-14 md:top-0 z-10">
        <button onClick={() => router.push('/obras')} className="shrink-0 flex items-center gap-2 text-sm text-[#64748B] hover:text-[#0F172A] transition-colors">
          <ArrowLeft size={16} />
        </button>
        <h1 className="font-syne font-semibold text-[#0F172A] text-sm md:text-base truncate flex-1 min-w-0">{obra.titulo}</h1>
        <div className="ml-auto hidden md:flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input placeholder="Buscar..." className="pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm w-52 focus:outline-none focus:border-[#4F7CFF] transition-colors" />
          </div>
          <button className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9]">
            <Bell size={18} className="text-[#64748B]" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#4F7CFF] rounded-full" />
          </button>
          <div className="w-8 h-8 rounded-full bg-[#4F7CFF] text-white text-xs font-semibold flex items-center justify-center">MG</div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-[#E2E8F0] px-6">
        <div className="flex gap-0 overflow-x-auto">
          {(['visao-geral', 'relatorios', 'documentos', 'cronograma'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-[#4F7CFF] text-[#4F7CFF]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'}`}>
              {t === 'visao-geral' ? 'Visão Geral' : t === 'documentos' ? 'Documentos' : t === 'cronograma' ? 'Cronograma' : `Relatórios (${rdos.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 md:p-6">
        {/* ===== VISÃO GERAL ===== */}
        {tab === 'visao-geral' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Info */}
            <div className="lg:col-span-2 space-y-4">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-syne font-semibold text-[#0F172A]">Informações do Projeto</h2>
                  <StatusChip status={obra.status} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                  <InfoRow icon={<Wrench size={14} />} label="Tipo de Serviço" value={obra.tipo_servico} />
                  <InfoRow icon={<User size={14} />} label="Responsável Técnico" value={obra.engenheiro_responsavel} />
                  <InfoRow icon={<Calendar size={14} />} label="Início" value={formatDate(obra.data_inicio)} />
                  <InfoRow icon={<Hash size={14} />} label="Contrato" value={obra.numero_contrato} />
                  <InfoRow icon={<MapPin size={14} />} label="Endereço" value={obra.endereco} className="col-span-2" />
                  <InfoRow icon={<DollarSign size={14} />} label="Valor do Contrato" value={formatCurrency(obra.valor_estimado)} highlight />
                  <InfoRow icon={<Calendar size={14} />} label="Previsão Término" value={formatDate(obra.previsao_termino)} />
                </div>
              </div>

              {/* Map placeholder */}
              <div className="card p-0 overflow-hidden h-48">
                <div className="w-full h-full bg-[#F1F5F9] flex flex-col items-center justify-center gap-2">
                  <MapPin size={24} className="text-[#94A3B8]" />
                  <p className="text-sm text-[#94A3B8]">{obra.endereco || 'Localização da Obra'}</p>
                </div>
              </div>
            </div>

            {/* Right: Time + Actions */}
            <div className="space-y-4">
              {/* Tempo decorrido */}
              <div className="card">
                <h3 className="font-syne font-semibold text-sm text-[#0F172A] mb-4">Tempo Decorrido</h3>
                <div className="flex gap-4 mb-4">
                  <div className="flex-1 text-center p-3 bg-[#F8FAFC] rounded-lg">
                    <div className="font-syne text-2xl font-bold text-[#0F172A]">{diasDecorridos}</div>
                    <div className="text-xs text-[#64748B] mt-0.5">Dias Passados</div>
                  </div>
                  <div className="flex-1 text-center p-3 bg-[#F8FAFC] rounded-lg">
                    <div className="font-syne text-2xl font-bold text-[#4F7CFF]">{diasRestantes}</div>
                    <div className="text-xs text-[#64748B] mt-0.5">Dias Restantes</div>
                  </div>
                </div>

                <div className={`flex items-center gap-2 p-2.5 rounded-lg mb-2 ${prazoOk ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  {prazoOk
                    ? <CheckCircle2 size={14} className="text-emerald-500" />
                    : <AlertTriangle size={14} className="text-red-500" />
                  }
                  <span className={`text-xs font-medium ${prazoOk ? 'text-emerald-700' : 'text-red-700'}`}>
                    Status do Prazo: {prazoOk ? 'Cronograma em dia' : 'Prazo vencido'}
                  </span>
                </div>

                {endDate && (
                  <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-lg">
                    <Clock size={14} className="text-amber-500" />
                    <span className="text-xs font-medium text-amber-700">
                      Próxima Entrega: {formatDate(obra.previsao_termino)}
                    </span>
                  </div>
                )}
              </div>

              {/* Ações rápidas */}
              <div className="card">
                <h3 className="font-syne font-semibold text-sm text-[#0F172A] mb-3">Ações Rápidas</h3>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button onClick={() => setTab('documentos')} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#F8FAFC] hover:bg-[#EEF2FF] hover:text-[#4F7CFF] transition-colors text-[#64748B]">
                    <FileText size={18} />
                    <span className="text-xs font-medium">Documentos</span>
                  </button>
                  <button onClick={() => { setTab('cronograma'); setShowNovaEtapa(true) }} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#F8FAFC] hover:bg-[#EEF2FF] hover:text-[#4F7CFF] transition-colors text-[#64748B]">
                    <PlusCircle size={18} />
                    <span className="text-xs font-medium">Nova Etapa</span>
                  </button>
                </div>
                <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#4F7CFF] hover:bg-[#3D68F0] text-white text-sm font-semibold rounded-lg transition-colors">
                  <BarChart2 size={16} />
                  Gerar Relatório Geral
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== DOCUMENTOS ===== */}
        {tab === 'documentos' && (
          <div className="flex gap-6">
            {/* Sidebar de pastas */}
            <div className="w-56 shrink-0">
              <div className="card p-3">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Pastas</span>
                  <button onClick={() => setShowNovaPasta(true)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#EEF2FF] transition-colors" title="Nova pasta">
                    <Plus size={14} className="text-[#4F7CFF]" />
                  </button>
                </div>

                {/* Todas */}
                <button
                  onClick={() => setPastaAtiva('__todas__')}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors mb-0.5 ${pastaAtiva === '__todas__' ? 'bg-[#EEF2FF] text-[#4F7CFF] font-medium' : 'text-[#374151] hover:bg-[#F1F5F9]'}`}
                >
                  <FolderOpen size={15} />
                  <span className="flex-1 text-left">Todos</span>
                  <span className="text-xs text-[#94A3B8]">{docs.length}</span>
                </button>

                {/* Pastas dinâmicas */}
                {todasPastasNomes.map(nomePasta => {
                  const qtd = docs.filter(d => (d.pasta || 'Geral') === nomePasta).length
                  const pastaObj = pastas.find(p => p.nome === nomePasta)
                  const ativa = pastaAtiva === nomePasta
                  return (
                    <div key={nomePasta} className="group relative">
                      <button
                        onClick={() => setPastaAtiva(nomePasta)}
                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors mb-0.5 ${ativa ? 'bg-[#EEF2FF] text-[#4F7CFF] font-medium' : 'text-[#374151] hover:bg-[#F1F5F9]'}`}
                      >
                        <Folder size={15} className={ativa ? 'text-[#4F7CFF]' : 'text-[#94A3B8]'} />
                        <span className="flex-1 text-left truncate">{nomePasta}</span>
                        <span className="text-xs text-[#94A3B8]">{qtd}</span>
                      </button>
                      {pastaObj && (
                        <button
                          onClick={() => excluirPasta(pastaObj.id, nomePasta)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
                        >
                          <Trash2 size={11} className="text-red-400" />
                        </button>
                      )}
                    </div>
                  )
                })}

                {/* Nova pasta inline */}
                {showNovaPasta && (
                  <NovaPastaInline
                    onConfirm={nome => { criarPasta(nome); setShowNovaPasta(false) }}
                    onCancel={() => setShowNovaPasta(false)}
                  />
                )}
              </div>

              {/* Custos */}
              <div className="card mt-4">
                <h3 className="font-syne font-semibold text-xs text-[#0F172A] mb-3">Distribuição de Custos</h3>
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#374151]">Financeiro</span>
                      <span className="text-[#4F7CFF] font-semibold">{formatCurrency(totalFinanceiro) !== '—' ? formatCurrency(totalFinanceiro) : 'R$ 0'}</span>
                    </div>
                    <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-1.5 bg-[#4F7CFF] rounded-full" style={{ width: totalFinanceiro + totalTecnico > 0 ? `${(totalFinanceiro / (totalFinanceiro + totalTecnico)) * 100}%` : '0%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#374151]">Técnico</span>
                      <span className="text-[#2DD4BF] font-semibold">{formatCurrency(totalTecnico) !== '—' ? formatCurrency(totalTecnico) : 'R$ 0'}</span>
                    </div>
                    <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-1.5 bg-[#2DD4BF] rounded-full" style={{ width: totalFinanceiro + totalTecnico > 0 ? `${(totalTecnico / (totalFinanceiro + totalTecnico)) * 100}%` : '0%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Área principal */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-syne text-lg font-bold text-[#0F172A]">
                    {pastaAtiva === '__todas__' ? 'Todos os Documentos' : pastaAtiva}
                  </h2>
                  <p className="text-xs text-[#64748B]">{docsFiltrados.length} documento{docsFiltrados.length !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={() => { setPastaParaDoc(pastaAtiva === '__todas__' ? 'Geral' : pastaAtiva); setShowAddDoc(true) }}
                  className="btn-primary"
                >
                  <Upload size={16} /> Adicionar Documentos
                </button>
              </div>

              {/* Visualização por pasta (modo todas) ou lista */}
              {pastaAtiva === '__todas__' ? (
                <div className="space-y-4">
                  {todasPastasNomes.map(nomePasta => {
                    const docsNaPasta = docs.filter(d => (d.pasta || 'Geral') === nomePasta)
                    if (docsNaPasta.length === 0) return null
                    const aberta = pastasAbertas[nomePasta] !== false
                    return (
                      <div key={nomePasta} className="card p-0 overflow-hidden">
                        <button
                          onClick={() => togglePasta(nomePasta)}
                          className="w-full flex items-center gap-3 px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors"
                        >
                          {aberta ? <ChevronDown size={15} className="text-[#64748B]" /> : <ChevronRight size={15} className="text-[#64748B]" />}
                          <FolderOpen size={16} className="text-[#4F7CFF]" />
                          <span className="font-syne font-semibold text-sm text-[#0F172A]">{nomePasta}</span>
                          <span className="text-xs text-[#94A3B8] ml-auto">{docsNaPasta.length} arquivo{docsNaPasta.length !== 1 ? 's' : ''}</span>
                        </button>
                        {aberta && <DocTable docs={docsNaPasta} onDelete={excluirDoc} />}
                      </div>
                    )
                  })}
                  {docs.length === 0 && (
                    <div className="card text-center py-12">
                      <FolderOpen size={32} className="text-[#CBD5E1] mx-auto mb-3" />
                      <p className="text-sm text-[#94A3B8] mb-3">Nenhum documento cadastrado ainda.</p>
                      <button onClick={() => setShowAddDoc(true)} className="btn-primary mx-auto">
                        <Upload size={15} /> Adicionar primeiro documento
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="card p-0 overflow-hidden">
                  <DocTable docs={docsFiltrados} onDelete={excluirDoc} />
                  {docsFiltrados.length === 0 && (
                    <div className="text-center py-10">
                      <p className="text-sm text-[#94A3B8] mb-3">Nenhum documento nesta pasta.</p>
                      <button onClick={() => { setPastaParaDoc(pastaAtiva); setShowAddDoc(true) }} className="btn-primary mx-auto">
                        <Upload size={15} /> Adicionar documento aqui
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== CRONOGRAMA ===== */}
        {tab === 'cronograma' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left */}
            <div className="space-y-4">
              <div className="card">
                <h3 className="font-syne font-semibold text-sm text-[#0F172A] mb-4">Status Geral</h3>
                <div className="text-center mb-4">
                  <div className="font-syne text-5xl font-bold text-[#4F7CFF]">{progressoGeral}%</div>
                  <div className="text-xs text-[#64748B] mt-1">Concluído</div>
                </div>
                <div className="h-2 bg-[#F1F5F9] rounded-full mb-4 overflow-hidden">
                  <div className="h-2 bg-[#4F7CFF] rounded-full transition-all" style={{ width: `${progressoGeral}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#F8FAFC] rounded-lg p-3 text-center">
                    <div className="font-syne text-xl font-bold text-[#0F172A]">{totalEtapas}</div>
                    <div className="text-xs text-[#64748B]">Etapas</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <div className="font-syne text-xl font-bold text-red-600">{atrasadas}</div>
                    <div className="text-xs text-red-500">Atrasadas</div>
                  </div>
                </div>
              </div>

              <div className="card p-0 overflow-hidden">
                <div className="w-full h-44 bg-[#F1F5F9] flex flex-col items-center justify-center gap-2">
                  <MapPin size={24} className="text-[#94A3B8]" />
                  <p className="text-sm text-[#94A3B8]">Localização</p>
                  {obra.endereco && <p className="text-xs text-[#CBD5E1] px-4 text-center">{obra.endereco}</p>}
                </div>
              </div>
            </div>

            {/* Right: Etapas */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-syne font-semibold text-[#0F172A]">Cronograma de Execução</h2>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] transition-colors cursor-pointer">
                    {importandoExcel ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                    <span className="hidden sm:inline">Importar Excel</span>
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={importandoExcel}
                      onChange={e => { const f = e.target.files?.[0]; if (f) importarExcelCronograma(f); e.target.value = '' }} />
                  </label>
                  <button onClick={() => setShowNovaEtapa(true)} className="btn-primary text-sm">
                    <PlusCircle size={16} />
                    <span className="hidden sm:inline">Nova </span>Etapa
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {etapas.length === 0 ? (
                  <div className="card text-center py-12">
                    <p className="text-[#94A3B8] text-sm mb-3">Nenhuma etapa cadastrada ainda.</p>
                    <button onClick={() => setShowNovaEtapa(true)} className="btn-primary mx-auto">
                      <PlusCircle size={16} /> Adicionar primeira etapa
                    </button>
                  </div>
                ) : etapas.map((etapa, idx) => (
                  <EtapaCard key={etapa.id} etapa={etapa} index={idx} obraId={id} onUpdated={load} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== RELATÓRIOS ===== */}
        {tab === 'relatorios' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-syne font-semibold text-[#0F172A]">Relatórios Diários de Obra</h2>
                <p className="text-xs text-[#64748B] mt-0.5">RDO — registre o que aconteceu em cada dia de obra</p>
              </div>
              <button onClick={criarNovoRdo} disabled={criandoRdo}
                className="btn-primary text-sm flex items-center gap-2">
                {criandoRdo ? <Loader2 size={15} className="animate-spin" /> : <PlusCircle size={15} />}
                Novo RDO
              </button>
            </div>

            {rdos.length === 0 ? (
              <div className="card text-center py-16">
                <FileText size={36} className="text-[#CBD5E1] mx-auto mb-3" />
                <p className="font-medium text-[#374151]">Nenhum relatório ainda</p>
                <p className="text-sm text-[#94A3B8] mt-1 mb-4">Crie o primeiro RDO para registrar as atividades do dia</p>
                <button onClick={criarNovoRdo} disabled={criandoRdo} className="btn-primary mx-auto text-sm">
                  <PlusCircle size={14} /> Criar primeiro RDO
                </button>
              </div>
            ) : (
              <div className="card p-0 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Nº</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Data</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Status</th>
                      <th className="px-4 py-3 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {rdos.map(rdo => {
                      const statusCor = rdo.status === 'aprovado' ? 'bg-emerald-50 text-emerald-700' : rdo.status === 'revisando' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                      const statusLabel = rdo.status === 'aprovado' ? 'Aprovado' : rdo.status === 'revisando' ? 'Revisando' : 'Preenchendo'
                      return (
                        <tr key={rdo.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                          <td className="px-4 py-3 text-sm font-bold text-[#0F172A]">#{rdo.numero}</td>
                          <td className="px-4 py-3 text-sm text-[#374151]">
                            {new Date(rdo.data + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusCor}`}>{statusLabel}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 justify-end">
                              <Link href={`/print/rdo/${rdo.id}`} target="_blank"
                                className="text-xs text-[#64748B] hover:text-[#4F7CFF] px-2 py-1 rounded border border-[#E2E8F0] hover:border-[#4F7CFF] transition-colors">
                                PDF
                              </Link>
                              <Link href={`/obras/${id}/rdo/${rdo.id}`}
                                className="text-xs font-medium text-white bg-[#4F7CFF] hover:bg-[#3D6AE8] px-3 py-1 rounded transition-colors">
                                Abrir
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Nova Etapa */}
      {showNovaEtapa && (
        <ModalNovaEtapa
          obraId={id}
          ordem={etapas.length + 1}
          onClose={() => setShowNovaEtapa(false)}
          onCreated={() => { setShowNovaEtapa(false); load() }}
        />
      )}

      {/* Modal Add Doc */}
      {showAddDoc && (
        <ModalAddDoc
          obraId={id}
          pastaInicial={pastaParaDoc}
          pastasDisponiveis={todasPastasNomes}
          onClose={() => setShowAddDoc(false)}
          onCreated={() => { setShowAddDoc(false); load() }}
        />
      )}
    </div>
  )
}

// ---- Sub components ----

function InfoRow({ icon, label, value, highlight, className }: { icon: React.ReactNode; label: string; value?: string | null; highlight?: boolean; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 text-xs text-[#64748B] mb-0.5">
        <span className="text-[#94A3B8]">{icon}</span>
        {label}
      </div>
      <div className={`text-sm font-medium ${highlight ? 'text-[#4F7CFF] text-base font-semibold' : 'text-[#0F172A]'}`}>
        {value || '—'}
      </div>
    </div>
  )
}

function EtapaCard({ etapa, index, onUpdated }: { etapa: CronogramaEtapa; index: number; obraId?: string; onUpdated: () => void }) {
  const [progress, setProgress] = useState(etapa.progresso)
  const [saving, setSaving] = useState(false)

  async function updateProgress(val: number) {
    setProgress(val)
    setSaving(true)
    const supabase = createClient()
    const newStatus: StatusEtapa = val === 100 ? 'Concluída' : val > 0 ? 'Em Andamento' : 'Pendente'
    await supabase.from('cronograma_etapas').update({ progresso: val, status: newStatus }).eq('id', etapa.id)
    setSaving(false)
    onUpdated()
  }

  return (
    <div className="card">
      <div className="flex items-start gap-4">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          etapa.status === 'Concluída' ? 'bg-emerald-100 text-emerald-700' :
          etapa.status === 'Em Andamento' ? 'bg-blue-100 text-blue-700' :
          etapa.status === 'Atrasada' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-500'
        }`}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-syne font-semibold text-sm text-[#0F172A]">{etapa.titulo}</h4>
            <StatusChip status={etapa.status} />
          </div>
          <div className="flex items-center gap-4 text-xs text-[#64748B] mb-3">
            {etapa.responsavel && <span className="flex items-center gap-1"><User size={11} />{etapa.responsavel}</span>}
            {etapa.data_inicio && etapa.data_fim && (
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {new Date(etapa.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')} – {new Date(etapa.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={e => setProgress(Number(e.target.value))}
              onMouseUp={e => updateProgress(Number((e.target as HTMLInputElement).value))}
              onTouchEnd={e => updateProgress(Number((e.target as HTMLInputElement).value))}
              className="flex-1 accent-[#4F7CFF] h-1.5"
            />
            <span className={`text-xs font-semibold w-10 text-right ${saving ? 'text-[#94A3B8]' : 'text-[#4F7CFF]'}`}>{progress}%</span>
          </div>
          {etapa.arquivo_nome && (
            <a href={etapa.arquivo_url || '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-[#4F7CFF] hover:underline">
              <FileText size={11} /> {etapa.arquivo_nome}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function ModalNovaEtapa({ obraId, ordem, onClose, onCreated }: { obraId: string; ordem: number; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ titulo: '', responsavel: '', data_inicio: '', data_fim: '' })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.from('cronograma_etapas').insert({
      obra_id: obraId,
      titulo: form.titulo,
      responsavel: form.responsavel || null,
      data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null,
      progresso: 0,
      status: 'Pendente',
      ordem,
    })
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">Nova Etapa</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Título da Etapa *</label>
            <input required className="field" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Instalação de fancoils" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Responsável</label>
            <input className="field" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Nome do responsável" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Data Início</label>
              <input type="date" className="field" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Data Fim</label>
              <input type="date" className="field" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : 'Salvar Etapa'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalAddDoc({ obraId, pastaInicial, pastasDisponiveis, onClose, onCreated }: {
  obraId: string; pastaInicial: string; pastasDisponiveis: string[]; onClose: () => void; onCreated: () => void
}) {
  const [pasta, setPasta] = useState(pastaInicial)
  const [categoria, setCategoria] = useState<CategoriaDoc>('Financeiro')
  const [fornecedor, setFornecedor] = useState('')
  const [dataDoc, setDataDoc] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [error, setError] = useState('')

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) setFiles(Array.from(e.target.files))
  }

  function removeFile(idx: number) {
    setFiles(f => f.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (files.length === 0) { setError('Selecione ao menos um arquivo.'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setProgresso(Math.round(((i) / files.length) * 100))
      const path = `${obraId}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('documentos').upload(path, file)
      if (uploadError) { setError(uploadError.message); setLoading(false); return }
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path)
      await supabase.from('documentos').insert({
        obra_id: obraId,
        nome: file.name.replace(/\.[^/.]+$/, ''),
        categoria,
        pasta,
        fornecedor: fornecedor || null,
        data_documento: dataDoc || null,
        arquivo_url: urlData.publicUrl,
        arquivo_path: path,
      })
    }
    setProgresso(100)
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">Adicionar Documentos</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Drop zone */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Arquivos *</label>
            <label className="flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed border-[#E2E8F0] rounded-xl cursor-pointer hover:border-[#4F7CFF] hover:bg-[#F8FAFF] transition-colors">
              <Upload size={24} className="text-[#94A3B8]" />
              <div className="text-center">
                <p className="text-sm font-medium text-[#374151]">Clique para selecionar</p>
                <p className="text-xs text-[#94A3B8]">PDF, DOC, XLS, imagens — múltiplos arquivos permitidos</p>
              </div>
              <input type="file" multiple className="hidden" onChange={handleFiles} />
            </label>
            {/* Lista de arquivos selecionados */}
            {files.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                    <FileText size={14} className="text-[#4F7CFF] shrink-0" />
                    <span className="text-xs text-[#374151] flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-[#94A3B8] shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                    <button type="button" onClick={() => removeFile(idx)} className="text-[#94A3B8] hover:text-red-400">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <p className="text-xs text-[#64748B] pl-1">{files.length} arquivo{files.length !== 1 ? 's' : ''} selecionado{files.length !== 1 ? 's' : ''}</p>
              </div>
            )}
          </div>

          {/* Pasta de destino */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Pasta de destino</label>
              <select className="field" value={pasta} onChange={e => setPasta(e.target.value)}>
                {pastasDisponiveis.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Categoria</label>
              <select className="field" value={categoria} onChange={e => setCategoria(e.target.value as CategoriaDoc)}>
                <option value="Financeiro">Financeiro</option>
                <option value="Técnico">Técnico</option>
                <option value="Jurídico">Jurídico</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Fornecedor</label>
              <input className="field" value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Data do Documento</label>
              <input type="date" className="field" value={dataDoc} onChange={e => setDataDoc(e.target.value)} />
            </div>
          </div>

          {loading && (
            <div>
              <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                <div className="h-2 bg-[#4F7CFF] rounded-full transition-all" style={{ width: `${progresso}%` }} />
              </div>
              <p className="text-xs text-[#64748B] mt-1">Enviando arquivos... {progresso}%</p>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? `Enviando ${progresso}%...` : `Enviar ${files.length > 0 ? files.length + ' arquivo' + (files.length !== 1 ? 's' : '') : 'Arquivos'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Tabela de documentos reutilizável
function DocTable({ docs, onDelete }: { docs: Documento[]; onDelete: (id: string, path?: string) => void }) {
  const categoriaConfig: Record<string, { bg: string; text: string }> = {
    Financeiro: { bg: 'bg-blue-50', text: 'text-blue-700' },
    Técnico: { bg: 'bg-teal-50', text: 'text-teal-700' },
    Jurídico: { bg: 'bg-purple-50', text: 'text-purple-700' },
    Outros: { bg: 'bg-gray-100', text: 'text-gray-600' },
  }
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Nome</th>
          <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Categoria</th>
          <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Fornecedor</th>
          <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Data</th>
          <th className="text-center text-xs font-semibold text-[#64748B] px-4 py-2.5">Ações</th>
        </tr>
      </thead>
      <tbody>
        {docs.map(doc => {
          const cat = categoriaConfig[doc.categoria] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
          return (
            <tr key={doc.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors group">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-[#F1F5F9] rounded-lg flex items-center justify-center shrink-0">
                    <FileText size={13} className="text-[#64748B]" />
                  </div>
                  <span className="text-sm text-[#0F172A] font-medium">{doc.nome}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cat.bg} ${cat.text}`}>{doc.categoria}</span>
              </td>
              <td className="px-4 py-3 text-sm text-[#64748B]">{doc.fornecedor || '—'}</td>
              <td className="px-4 py-3 text-sm text-[#64748B]">{doc.data_documento ? new Date(doc.data_documento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-center gap-2">
                  {doc.arquivo_url && (
                    <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#4F7CFF] hover:underline flex items-center gap-1">
                      <ExternalLink size={12} /> Abrir
                    </a>
                  )}
                  <button
                    onClick={() => onDelete(doc.id, doc.arquivo_path)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[#94A3B8] hover:text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// Input inline de nova pasta
function NovaPastaInline({ onConfirm, onCancel }: { onConfirm: (nome: string) => void; onCancel: () => void }) {
  const [nome, setNome] = useState('')
  return (
    <div className="mt-2 flex items-center gap-1">
      <Folder size={14} className="text-[#94A3B8] shrink-0" />
      <input
        autoFocus
        className="flex-1 text-sm px-2 py-1 border border-[#4F7CFF] rounded-lg focus:outline-none"
        placeholder="Nome da pasta"
        value={nome}
        onChange={e => setNome(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && nome.trim()) onConfirm(nome.trim()); if (e.key === 'Escape') onCancel() }}
      />
      <button type="button" onClick={() => nome.trim() && onConfirm(nome.trim())} className="text-[#4F7CFF] hover:text-[#3D68F0]"><CheckCircle2 size={16} /></button>
      <button type="button" onClick={onCancel} className="text-[#94A3B8] hover:text-[#64748B]"><X size={14} /></button>
    </div>
  )
}
