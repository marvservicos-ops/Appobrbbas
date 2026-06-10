'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, Bell, MapPin, FileText, PlusCircle, BarChart2, Upload, X, Wrench, Calendar, User, Hash, DollarSign, Clock, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Obra, CronogramaEtapa, Documento, CategoriaDoc, StatusEtapa } from '@/lib/types'
import StatusChip from '@/components/StatusChip'
import Link from 'next/link'

type Tab = 'visao-geral' | 'documentos' | 'cronograma'

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

export default function ObraDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('visao-geral')
  const [obra, setObra] = useState<Obra | null>(null)
  const [etapas, setEtapas] = useState<CronogramaEtapa[]>([])
  const [docs, setDocs] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState<string>('Todas')

  // Modals
  const [showNovaEtapa, setShowNovaEtapa] = useState(false)
  const [showAddDoc, setShowAddDoc] = useState(false)

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const [obraRes, etapasRes, docsRes] = await Promise.all([
      supabase.from('obras').select('*, cliente:clientes(*)').eq('id', id).single(),
      supabase.from('cronograma_etapas').select('*').eq('obra_id', id).order('ordem'),
      supabase.from('documentos').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
    ])
    if (obraRes.data) setObra(obraRes.data as Obra)
    if (etapasRes.data) setEtapas(etapasRes.data as CronogramaEtapa[])
    if (docsRes.data) setDocs(docsRes.data as Documento[])
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
  const filteredDocs = filterCat === 'Todas' ? docs : docs.filter(d => d.categoria === filterCat)
  const totalFinanceiro = docs.filter(d => d.categoria === 'Financeiro').reduce((s, d) => s + (d.valor || 0), 0)
  const totalTecnico = docs.filter(d => d.categoria === 'Técnico').reduce((s, d) => s + (d.valor || 0), 0)

  return (
    <div className="flex flex-col h-full min-h-screen">
      {/* Topbar */}
      <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center px-6 gap-4 sticky top-0 z-10">
        <button onClick={() => router.push('/obras')} className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#0F172A] transition-colors">
          <ArrowLeft size={16} />
        </button>
        <h1 className="font-syne font-semibold text-[#0F172A] text-base truncate">{obra.titulo}</h1>

        <div className="ml-auto flex items-center gap-3">
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
        <div className="flex gap-0">
          {(['visao-geral', 'documentos', 'cronograma'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-[#4F7CFF] text-[#4F7CFF]'
                  : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {t === 'visao-geral' ? 'Visão Geral' : t === 'documentos' ? 'Documentos' : 'Cronograma'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        {/* ===== VISÃO GERAL ===== */}
        {tab === 'visao-geral' && (
          <div className="grid grid-cols-3 gap-6">
            {/* Left: Info */}
            <div className="col-span-2 space-y-4">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-syne font-semibold text-[#0F172A]">Informações do Projeto</h2>
                  <StatusChip status={obra.status} />
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
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
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-syne text-xl font-bold text-[#0F172A]">Repositório de Documentos</h2>
                <p className="text-sm text-[#64748B] mt-0.5">Gerencie certificados, notas fiscais e especificações técnicas</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={filterCat}
                  onChange={e => setFilterCat(e.target.value)}
                  className="field w-auto"
                >
                  <option value="Todas">Todas Categorias</option>
                  <option value="Financeiro">Financeiro</option>
                  <option value="Técnico">Técnico</option>
                  <option value="Jurídico">Jurídico</option>
                  <option value="Outros">Outros</option>
                </select>
                <button onClick={() => setShowAddDoc(true)} className="btn-primary">
                  <Upload size={16} />
                  Adicionar Documento
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="card p-0 overflow-hidden mb-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Nome</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Categoria</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">NF</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Fornecedor</th>
                    <th className="text-right text-xs font-semibold text-[#64748B] px-4 py-3">Valor</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Data</th>
                    <th className="text-center text-xs font-semibold text-[#64748B] px-4 py-3">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-sm text-[#94A3B8]">
                        Nenhum documento encontrado.{' '}
                        <button onClick={() => setShowAddDoc(true)} className="text-[#4F7CFF] hover:underline">Adicionar documento</button>
                      </td>
                    </tr>
                  ) : filteredDocs.map(doc => {
                    const cat = categoriaConfig[doc.categoria] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
                    return (
                      <tr key={doc.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-[#F1F5F9] rounded-lg flex items-center justify-center">
                              <FileText size={14} className="text-[#64748B]" />
                            </div>
                            <span className="text-sm text-[#0F172A] font-medium">{doc.nome}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cat.bg} ${cat.text}`}>{doc.categoria}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#64748B]">{doc.numero_nf || '—'}</td>
                        <td className="px-4 py-3 text-sm text-[#64748B]">{doc.fornecedor || '—'}</td>
                        <td className="px-4 py-3 text-sm text-[#0F172A] font-medium text-right">{formatCurrency(doc.valor)}</td>
                        <td className="px-4 py-3 text-sm text-[#64748B]">{formatDate(doc.data_documento)}</td>
                        <td className="px-4 py-3 text-center">
                          {doc.arquivo_url ? (
                            <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#4F7CFF] hover:underline flex items-center gap-1 justify-center">
                              <ExternalLink size={12} /> Abrir
                            </a>
                          ) : <span className="text-xs text-[#CBD5E1]">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="px-4 py-3 text-xs text-[#64748B] border-t border-[#F1F5F9]">
                Mostrando {filteredDocs.length} de {docs.length} documentos
              </div>
            </div>

            {/* Bottom cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="card">
                <h3 className="font-syne font-semibold text-sm text-[#0F172A] mb-4">Distribuição de Custos</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-[#374151]">Financeiro</span>
                      <span className="text-[#4F7CFF] font-semibold">{formatCurrency(totalFinanceiro)}</span>
                    </div>
                    <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-2 bg-[#4F7CFF] rounded-full" style={{ width: totalFinanceiro + totalTecnico > 0 ? `${(totalFinanceiro/(totalFinanceiro+totalTecnico))*100}%` : '0%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-[#374151]">Técnico/Serviços</span>
                      <span className="text-[#2DD4BF] font-semibold">{formatCurrency(totalTecnico)}</span>
                    </div>
                    <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-2 bg-[#2DD4BF] rounded-full" style={{ width: totalFinanceiro + totalTecnico > 0 ? `${(totalTecnico/(totalFinanceiro+totalTecnico))*100}%` : '0%' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="card bg-gradient-to-br from-[#0F172A] to-[#1E3A5F] text-white border-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-syne font-semibold text-sm">Análise Industrial</h3>
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">IA</span>
                </div>
                <p className="text-xs text-white/60 mb-4">Sistema de detecção inteligente de pendências técnicas</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-2xl font-bold font-syne">
                      {docs.filter(d => !d.arquivo_url).length}
                    </div>
                    <div className="text-xs text-white/60 mt-0.5">Documentos Pendentes</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-2xl font-bold font-syne text-[#2DD4BF]">
                      {endDate ? `${endDate.getDate()} ${endDate.toLocaleString('pt-BR', { month: 'short' })}` : '—'}
                    </div>
                    <div className="text-xs text-white/60 mt-0.5">Próxima Revisão</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== CRONOGRAMA ===== */}
        {tab === 'cronograma' && (
          <div className="grid grid-cols-3 gap-6">
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
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-syne font-semibold text-[#0F172A]">Cronograma de Execução</h2>
                <button onClick={() => setShowNovaEtapa(true)} className="btn-primary text-sm">
                  <PlusCircle size={16} />
                  Nova Etapa
                </button>
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

function ModalAddDoc({ obraId, onClose, onCreated }: { obraId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ nome: '', categoria: 'Financeiro' as CategoriaDoc, numero_nf: '', fornecedor: '', valor: '', data_documento: '' })
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    let arquivo_url = null
    let arquivo_path = null

    if (file) {
      const path = `${obraId}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('documentos').upload(path, file)
      if (uploadError) { setError(uploadError.message); setLoading(false); return }
      arquivo_path = path
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path)
      arquivo_url = urlData.publicUrl
    }

    const { error: insertError } = await supabase.from('documentos').insert({
      obra_id: obraId,
      nome: form.nome,
      categoria: form.categoria,
      numero_nf: form.numero_nf || null,
      fornecedor: form.fornecedor || null,
      valor: form.valor ? parseFloat(form.valor) : null,
      data_documento: form.data_documento || null,
      arquivo_url,
      arquivo_path,
    })
    if (insertError) { setError(insertError.message); setLoading(false); return }
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">Adicionar Documento</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome do Documento *</label>
            <input required className="field" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Nota Fiscal Tubulações" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Categoria</label>
              <select className="field" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value as CategoriaDoc }))}>
                <option value="Financeiro">Financeiro</option>
                <option value="Técnico">Técnico</option>
                <option value="Jurídico">Jurídico</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Nº NF</label>
              <input className="field" value={form.numero_nf} onChange={e => setForm(f => ({ ...f, numero_nf: e.target.value }))} placeholder="0000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Fornecedor</label>
              <input className="field" value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} placeholder="Nome do fornecedor" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Valor (R$)</label>
              <input type="number" className="field" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Data do Documento</label>
            <input type="date" className="field" value={form.data_documento} onChange={e => setForm(f => ({ ...f, data_documento: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Arquivo (opcional)</label>
            <input
              type="file"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-[#64748B] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-[#E2E8F0] file:text-xs file:font-medium file:text-[#374151] file:bg-[#F8FAFC] hover:file:bg-[#F1F5F9] cursor-pointer"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : 'Salvar Documento'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
