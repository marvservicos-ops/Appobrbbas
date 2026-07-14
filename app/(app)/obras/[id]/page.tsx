'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Search, Bell, MapPin, FileText, PlusCircle, BarChart2, Upload, X, Wrench, Calendar, User, Hash, DollarSign, Clock, CheckCircle2, AlertTriangle, ExternalLink, FolderOpen, Folder, Plus, Trash2, ChevronDown, ChevronRight, FileSpreadsheet, Loader2, Settings, ShoppingCart, Pencil, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Obra, CronogramaEtapa, Documento, CategoriaDoc, StatusEtapa, DocPasta, RDO } from '@/lib/types'
import StatusChip from '@/components/StatusChip'
import Link from 'next/link'

type Tab = 'visao-geral' | 'documentos' | 'cronograma' | 'relatorios' | 'materiais'

interface ObraMaterial {
  id: string
  obra_id: string
  descricao: string
  tipo_compra: 'interna' | 'cliente'
  fornecedor?: string
  comprador?: string
  data_compra?: string
  data_prevista_chegada?: string
  data_chegada?: string
  local_chegada?: string
  destino?: string
  quantidade?: number
  unidade?: string
  valor_unitario?: number
  valor_total?: number
  status: 'pendente' | 'orcado' | 'comprado' | 'em_transito' | 'recebido' | 'instalado'
  nota_fiscal_url?: string
  nota_fiscal_path?: string
  observacoes?: string
  created_at: string
}

// ── PDF.js client-side helpers ─────────────────────────────────────
declare global { interface Window { pdfjsLib: any } }

async function extrairTextoPDF(file: File): Promise<string> {
  if (!window.pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      s.onload = () => resolve(); s.onerror = reject
      document.head.appendChild(s)
    })
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  }
  const buf = await file.arrayBuffer()
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // Group items by Y coordinate to reconstruct visual lines
    const lineMap = new Map<number, string[]>()
    for (const item of content.items as { str: string; transform: number[] }[]) {
      const y = Math.round(item.transform[5])
      if (!lineMap.has(y)) lineMap.set(y, [])
      lineMap.get(y)!.push(item.str)
    }
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a)
    for (const y of sortedYs) {
      const line = lineMap.get(y)!.join(' ').trim()
      if (line) text += line + '\n'
    }
  }
  return text
}

function parseBRDate(s: string): string | null {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}
function parseBRNum(s: string): number | null {
  const n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}

function parseDANFE(text: string) {
  // Texto completo sem quebras para regex cross-line
  const flat = text.replace(/\n/g, ' ').replace(/\s+/g, ' ')
  const linhas = text.split('\n')

  // Emitente: o nome aparece no cabeçalho de recebimento "Recebemos de X, os produtos"
  let emitente: string | undefined
  const recebM = flat.match(/Recebemos de\s+(.+?),\s*os produtos/i)
  if (recebM) emitente = recebM[1].trim()

  // NF número
  const nfM = flat.match(/N[°oº]\s*([\d.]{6,})/i)
  const nfNumero = nfM ? `NF ${nfM[1]}` : undefined

  // Data de emissão — a primeira data DD/MM/YYYY após "emissão"
  const dataM = flat.match(/emiss[ãa]o[^0-9]{0,30}(\d{2}\/\d{2}\/\d{4})/i)
    ?? flat.match(/(\d{2}\/\d{2}\/\d{4})/)
  const dataEmissao = dataM ? parseBRDate(dataM[1]) ?? undefined : undefined

  // Valor total: procura "VALOR TOTAL DA NOTA" e pega o último número na sequência
  // Ex: "...VALOR DO IPI VALOR TOTAL DA NOTA 0,00 0,00 0,00 0,00 1,43 2.385,43"
  let valorTotal: number | undefined
  const vtM = flat.match(/VALOR TOTAL DA NOTA\s+([\d.,\s]+)/i)
  if (vtM) {
    const nums = vtM[1].match(/[\d.]+,\d{2}/g)
    if (nums) valorTotal = parseBRNum(nums[nums.length - 1]) ?? undefined
  }
  // Fallback: "R$ X.XXX,XX" na linha de fatura
  if (!valorTotal) {
    const m = flat.match(/R\$\s*([\d.]+,\d{2})/)
    if (m) valorTotal = parseBRNum(m[1]) ?? undefined
  }

  // Produtos: extrai só a seção entre "DADOS DO PRODUTO" e "DADOS ADICIONAIS"
  const produtos: { descricao: string; quantidade: number; valorUnitario: number; valorTotal: number; unidade: string }[] = []
  const secM = flat.match(/DADOS DO PRODUTO\/SERVI[ÇC]O\s+(.+?)(?:DADOS ADICIONAIS|CONTINUAÇÃO|TRANSPORTADOR)/i)
  const secao = secM ? secM[1] : flat

  // \b garante que \d{3,4} seja um número isolado (não parte de "1501072501")
  const prodRe = /\b(\d{3,4})\b\s+([\w\s\/\-\.()ÃÇÁÉÍÓÚãçáéíóú]+?)\s+(\d{8})\s+\d{3}\s+\d{4}\s+(UN|PC|KG|MT?|CX|RL|JG|L\b|KIT)\s+([\d,]+)\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/gi
  let m: RegExpExecArray | null
  while ((m = prodRe.exec(secao)) !== null) {
    const descricao = m[2].trim().replace(/\s+/g, ' ')
    // Filtra cabeçalhos da tabela e duplicatas
    if (descricao.length > 3 && !/NCM|CÓDIGO|DESCRI[ÇC]|PRODUTO\/SERVI/i.test(descricao) && !produtos.find(p => p.descricao === descricao)) {
      produtos.push({
        descricao,
        unidade: m[4].toUpperCase(),
        quantidade: parseBRNum(m[5]) ?? 1,
        valorUnitario: parseBRNum(m[6]) ?? 0,
        valorTotal: parseBRNum(m[7]) ?? 0,
      })
    }
  }

  const descricao = produtos.length === 1 ? produtos[0].descricao
    : produtos.length > 1 ? `${produtos[0].descricao} (+${produtos.length - 1} itens)` : undefined

  return { emitente, nfNumero, dataEmissao, valorTotal, produtos, descricao }
}

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
  const [materiais, setMateriais] = useState<ObraMaterial[]>([])
  const [criandoRdo, setCriandoRdo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showNovoMaterial, setShowNovoMaterial] = useState(false)
  const [editandoMaterial, setEditandoMaterial] = useState<ObraMaterial | null>(null)
  const [importandoNF, setImportandoNF] = useState(false)
  const [showImportNF, setShowImportNF] = useState(false)
  const [showNFManual, setShowNFManual] = useState(false)
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
    const [obraRes, etapasRes, docsRes, pastasRes, rdosRes, materiaisRes] = await Promise.all([
      supabase.from('obras').select('*, cliente:clientes(*)').eq('id', id).single(),
      supabase.from('cronograma_etapas').select('*').eq('obra_id', id).order('ordem'),
      supabase.from('documentos').select('*').eq('obra_id', id).order('pasta').order('created_at', { ascending: false }),
      supabase.from('doc_pastas').select('*').eq('obra_id', id).order('ordem'),
      supabase.from('rdos').select('*').eq('obra_id', id).order('numero', { ascending: false }),
      supabase.from('obra_materiais').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
    ])
    if (obraRes.data) setObra(obraRes.data as Obra)
    if (etapasRes.data) setEtapas(etapasRes.data as CronogramaEtapa[])
    if (docsRes.data) setDocs(docsRes.data as Documento[])
    if (pastasRes.data) setPastas(pastasRes.data as DocPasta[])
    if (rdosRes.data) setRdos(rdosRes.data as RDO[])
    if (materiaisRes.data) setMateriais(materiaisRes.data as ObraMaterial[])
    setLoading(false)
  }

  async function alterarStatusObra(novoStatus: string) {
    const supabase = createClient()
    await supabase.from('obras').update({ status: novoStatus }).eq('id', id)
    setObra(prev => prev ? { ...prev, status: novoStatus as Obra['status'] } : prev)
  }

  async function excluirMaterial(materialId: string) {
    if (!confirm('Excluir este material?')) return
    const supabase = createClient()
    await supabase.from('obra_materiais').delete().eq('id', materialId)
    setMateriais(prev => prev.filter(m => m.id !== materialId))
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

  async function excluirRdo(rdoId: string) {
    if (!confirm('Excluir este RDO? Todos os dados (clima, mão de obra, fotos, assinaturas) serão apagados permanentemente.')) return
    const supabase = createClient()
    await supabase.from('rdos').delete().eq('id', rdoId)
    setRdos(prev => prev.filter(r => r.id !== rdoId))
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
          {(['visao-geral', 'relatorios', 'materiais', 'documentos', 'cronograma'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-[#4F7CFF] text-[#4F7CFF]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'}`}>
              {t === 'visao-geral' ? 'Visão Geral'
                : t === 'documentos' ? 'Documentos'
                : t === 'cronograma' ? 'Cronograma'
                : t === 'relatorios' ? `Relatórios (${rdos.length})`
                : `Materiais (${materiais.length})`}
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
                  <select
                    value={obra.status}
                    onChange={e => alterarStatusObra(e.target.value)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border-0 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-[#4F7CFF]/30
                      bg-transparent
                      [&[data-s='Em Orçamento']]:bg-slate-100 [&[data-s='Em Orçamento']]:text-slate-600
                      [&[data-s='Aprovada']]:bg-violet-50 [&[data-s='Aprovada']]:text-violet-700
                      [&[data-s='Em Andamento']]:bg-blue-50 [&[data-s='Em Andamento']]:text-blue-700
                      [&[data-s='Concluída']]:bg-emerald-50 [&[data-s='Concluída']]:text-emerald-700"
                    style={{
                      backgroundColor:
                        obra.status === 'Em Orçamento' ? '#f1f5f9' :
                        obra.status === 'Aprovada' ? '#f5f3ff' :
                        obra.status === 'Em Andamento' ? '#eff6ff' :
                        '#f0fdf4',
                      color:
                        obra.status === 'Em Orçamento' ? '#475569' :
                        obra.status === 'Aprovada' ? '#6d28d9' :
                        obra.status === 'Em Andamento' ? '#1d4ed8' :
                        '#065f46',
                    }}
                  >
                    {(['Em Orçamento', 'Aprovada', 'Em Andamento', 'Concluída'] as const).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
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
              <div className="flex items-center gap-2">
                <Link href={`/obras/${id}/modelos`}
                  className="flex items-center gap-1.5 text-sm px-3 py-2 border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] text-[#64748B] transition-colors">
                  <Settings size={14} /> <span className="hidden sm:inline">Personalizar</span>
                </Link>
                <button onClick={criarNovoRdo} disabled={criandoRdo}
                  className="btn-primary text-sm flex items-center gap-2">
                  {criandoRdo ? <Loader2 size={15} className="animate-spin" /> : <PlusCircle size={15} />}
                  Novo RDO
                </button>
              </div>
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
                              <button onClick={() => excluirRdo(rdo.id)}
                                className="text-[#94A3B8] hover:text-red-500 p-1 rounded transition-colors" title="Excluir RDO">
                                <Trash2 size={14} />
                              </button>
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

        {/* ===== MATERIAIS ===== */}
        {tab === 'materiais' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-syne font-semibold text-[#0F172A]">Materiais da Obra</h2>
                <p className="text-xs text-[#64748B] mt-0.5">Controle de compras, chegada e destino dos materiais</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowNFManual(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-[#E2E8F0] text-[#64748B] text-sm font-medium hover:bg-[#F8FAFC] transition-colors">
                  <FileText size={15} /> Lançar NF
                </button>
                <label className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-xl border-2 border-[#4F7CFF] text-[#4F7CFF] text-sm font-medium hover:bg-[#EEF2FF] transition-colors ${importandoNF ? 'opacity-60 pointer-events-none' : ''}`}>
                  {importandoNF ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  {importandoNF ? 'Lendo NF...' : 'Importar NF'}
                  <input type="file" accept=".pdf" className="hidden" disabled={importandoNF}
                    onChange={async e => {
                      const f = e.target.files?.[0]; if (!f) return
                      setImportandoNF(true)
                      try {
                        const fd = new FormData(); fd.append('file', f)
                        const res = await fetch('/api/parse-nfe', { method: 'POST', body: fd })
                        const parsed = await res.json()
                        if (res.ok && parsed && (parsed.emitente || parsed.valorTotal)) {
                          sessionStorage.setItem('nf_import', JSON.stringify({ ...parsed, fileName: f.name }))
                          setShowImportNF(true)
                        } else {
                          alert(parsed?.error ?? 'Não foi possível extrair dados desta NF.')
                        }
                      } catch (err) { alert('Erro: ' + String(err)) }
                      setImportandoNF(false)
                      e.target.value = ''
                    }} />
                </label>
                <button onClick={() => { setShowNovoMaterial(true); setEditandoMaterial(null) }}
                  className="btn-primary text-sm flex items-center gap-2">
                  <PlusCircle size={15} /> Novo Material
                </button>
              </div>
            </div>

            {/* Sumário rápido */}
            {materiais.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Total', val: materiais.length, color: 'text-[#0F172A]', bg: 'bg-[#F1F5F9]' },
                  { label: 'Pendente/Orçado', val: materiais.filter(m => m.status === 'pendente' || m.status === 'orcado').length, color: 'text-slate-600', bg: 'bg-slate-100' },
                  { label: 'Comprado/Trânsito', val: materiais.filter(m => m.status === 'comprado' || m.status === 'em_transito').length, color: 'text-blue-700', bg: 'bg-blue-50' },
                  { label: 'Recebido/Instalado', val: materiais.filter(m => m.status === 'recebido' || m.status === 'instalado').length, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                ].map(s => (
                  <div key={s.label} className={`card py-3 text-center ${s.bg}`}>
                    <div className={`text-2xl font-syne font-bold ${s.color}`}>{s.val}</div>
                    <div className="text-xs text-[#64748B] mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {materiais.length === 0 ? (
              <div className="card text-center py-16">
                <ShoppingCart size={36} className="text-[#CBD5E1] mx-auto mb-3" />
                <p className="font-medium text-[#374151]">Nenhum material cadastrado</p>
                <p className="text-sm text-[#94A3B8] mt-1 mb-4">Registre compras de materiais para esta obra</p>
                <button onClick={() => setShowNovoMaterial(true)} className="btn-primary mx-auto text-sm">
                  <PlusCircle size={14} /> Adicionar primeiro material
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {materiais.map(m => <MaterialCard key={m.id} material={m} onEdit={() => { setEditandoMaterial(m); setShowNovoMaterial(true) }} onDelete={() => excluirMaterial(m.id)} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Material */}
      {showNovoMaterial && (
        <ModalMaterial
          obraId={id}
          material={editandoMaterial}
          onClose={() => { setShowNovoMaterial(false); setEditandoMaterial(null) }}
          onSaved={() => { setShowNovoMaterial(false); setEditandoMaterial(null); load() }}
        />
      )}

      {/* Modal NF Manual */}
      {showNFManual && (
        <ModalNFManual
          obraId={id}
          onClose={() => setShowNFManual(false)}
          onSaved={() => { setShowNFManual(false); load() }}
        />
      )}

      {/* Modal Importar NF */}
      {showImportNF && (
        <ModalImportNF
          obraId={id}
          onClose={() => setShowImportNF(false)}
          onSaved={() => { setShowImportNF(false); load() }}
        />
      )}

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

// ── STATUS CONFIG MATERIAL ────────────────────────────
const STATUS_MATERIAL: Record<string, { label: string; cls: string }> = {
  pendente:    { label: 'Pendente',    cls: 'bg-slate-100 text-slate-600' },
  orcado:      { label: 'Orçado',      cls: 'bg-amber-50 text-amber-700' },
  comprado:    { label: 'Comprado',    cls: 'bg-orange-50 text-orange-700' },
  em_transito: { label: 'Em trânsito', cls: 'bg-blue-50 text-blue-700' },
  recebido:    { label: 'Recebido',    cls: 'bg-teal-50 text-teal-700' },
  instalado:   { label: 'Instalado',   cls: 'bg-emerald-50 text-emerald-700' },
}

// ── MaterialCard ──────────────────────────────────────
function MaterialCard({ material: m, onEdit, onDelete }: { material: ObraMaterial; onEdit: () => void; onDelete: () => void }) {
  const st = STATUS_MATERIAL[m.status] ?? STATUS_MATERIAL.pendente
  const fmt = (d?: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
  const fmtMoeda = (v?: number) => v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : null

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${m.tipo_compra === 'cliente' ? 'bg-purple-50' : 'bg-blue-50'}`}>
            <ShoppingCart size={15} className={m.tipo_compra === 'cliente' ? 'text-purple-600' : 'text-blue-600'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-syne font-semibold text-[#0F172A] text-sm">{m.descricao}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.tipo_compra === 'cliente' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                {m.tipo_compra === 'cliente' ? 'Compra Cliente' : 'Compra Interna'}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
            </div>
            {m.fornecedor && <p className="text-xs text-[#64748B] mt-0.5">Fornecedor: {m.fornecedor}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onEdit} className="text-[#94A3B8] hover:text-[#4F7CFF] p-1.5 rounded hover:bg-[#EEF2FF] transition-colors"><Pencil size={13} /></button>
          <button onClick={onDelete} className="text-[#94A3B8] hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
        {m.comprador && <div><span className="text-[#94A3B8] block">Comprador</span><span className="font-medium text-[#374151]">{m.comprador}</span></div>}
        {m.data_compra && <div><span className="text-[#94A3B8] block">Data compra</span><span className="font-medium text-[#374151]">{fmt(m.data_compra)}</span></div>}
        {m.data_prevista_chegada && <div><span className="text-[#94A3B8] block">Prev. chegada</span><span className="font-medium text-[#374151]">{fmt(m.data_prevista_chegada)}</span></div>}
        {m.data_chegada && <div><span className="text-[#94A3B8] block">Chegada real</span><span className="font-medium text-emerald-700">{fmt(m.data_chegada)}</span></div>}
        {m.local_chegada && <div><span className="text-[#94A3B8] block">Local chegada</span><span className="font-medium text-[#374151]">{m.local_chegada}</span></div>}
        {m.destino && <div><span className="text-[#94A3B8] block">Destino</span><span className="font-medium text-[#374151]">{m.destino}</span></div>}
        {m.quantidade != null && <div><span className="text-[#94A3B8] block">Quantidade</span><span className="font-medium text-[#374151]">{m.quantidade} {m.unidade ?? ''}</span></div>}
        {m.valor_total != null && <div><span className="text-[#94A3B8] block">Valor total</span><span className="font-medium text-[#374151]">{fmtMoeda(m.valor_total)}</span></div>}
      </div>

      {(m.observacoes || m.nota_fiscal_url) && (
        <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex items-center gap-3 flex-wrap">
          {m.nota_fiscal_url && (
            <a href={m.nota_fiscal_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-[#4F7CFF] hover:text-[#3D6AE8] bg-[#EEF2FF] px-2.5 py-1 rounded-lg transition-colors">
              <FileText size={12} /> Ver Nota Fiscal
            </a>
          )}
          {m.observacoes && <p className="text-xs text-[#64748B] flex-1">{m.observacoes}</p>}
        </div>
      )}
    </div>
  )
}

// ── ModalMaterial ─────────────────────────────────────
function ModalMaterial({ obraId, material, onClose, onSaved }: {
  obraId: string; material: ObraMaterial | null; onClose: () => void; onSaved: () => void
}) {
  const [descricao, setDescricao] = useState(material?.descricao ?? '')
  const [tipCompra, setTipCompra] = useState<'interna' | 'cliente'>(material?.tipo_compra ?? 'interna')
  const [fornecedor, setFornecedor] = useState(material?.fornecedor ?? '')
  const [comprador, setComprador] = useState(material?.comprador ?? '')
  const [dataCompra, setDataCompra] = useState(material?.data_compra ?? '')
  const [dataPrevista, setDataPrevista] = useState(material?.data_prevista_chegada ?? '')
  const [dataChegada, setDataChegada] = useState(material?.data_chegada ?? '')
  const [localChegada, setLocalChegada] = useState(material?.local_chegada ?? '')
  const [destino, setDestino] = useState(material?.destino ?? '')
  const [quantidade, setQuantidade] = useState(material?.quantidade != null ? String(material.quantidade) : '')
  const [unidade, setUnidade] = useState(material?.unidade ?? 'un')
  const [valorUnitario, setValorUnitario] = useState(material?.valor_unitario != null ? String(material.valor_unitario) : '')
  const [valorTotal, setValorTotal] = useState(material?.valor_total != null ? String(material.valor_total) : '')
  const [status, setStatus] = useState<ObraMaterial['status']>(material?.status ?? 'pendente')
  const [observacoes, setObservacoes] = useState(material?.observacoes ?? '')
  const [nfUrl, setNfUrl] = useState(material?.nota_fiscal_url ?? '')
  const [nfPath, setNfPath] = useState(material?.nota_fiscal_path ?? '')
  const [uploadingNf, setUploadingNf] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nfDados, setNfDados] = useState<{ emitente?: string; nfNumero?: string; dataEmissao?: string; valorTotal?: number; produtos?: { descricao: string; quantidade: number; valorUnitario: number; valorTotal: number; unidade: string }[] } | null>(null)

  async function uploadNF(file: File) {
    setUploadingNf(true)
    const supabase = createClient()
    const path = `nf/${obraId}/${Date.now()}_${file.name}`

    // Parse NFe PDF in parallel with upload (only PDFs)
    const parsePromise = file.type === 'application/pdf' ? (async () => {
      try {
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch('/api/parse-nfe', { method: 'POST', body: fd })
        if (res.ok) return await res.json()
      } catch { /* ignore */ }
      return null
    })() : Promise.resolve(null)

    const [, parsed] = await Promise.all([
      supabase.storage.from('documentos').upload(path, file, { upsert: true }),
      parsePromise,
    ])

    const { data } = supabase.storage.from('documentos').getPublicUrl(path)
    setNfUrl(data.publicUrl)
    setNfPath(path)

    if (parsed && (parsed.emitente || parsed.valorTotal)) {
      setNfDados(parsed)
      // Auto-fill fields that are still empty
      if (parsed.emitente && !fornecedor) setFornecedor(parsed.emitente)
      if (parsed.dataEmissao && !dataCompra) setDataCompra(parsed.dataEmissao)
      if (parsed.valorTotal && !valorTotal) setValorTotal(String(parsed.valorTotal))
      if (parsed.descricao && !descricao) setDescricao(parsed.descricao)
    }

    setUploadingNf(false)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!descricao.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      obra_id: obraId,
      descricao: descricao.trim(),
      tipo_compra: tipCompra,
      fornecedor: fornecedor.trim() || null,
      comprador: comprador.trim() || null,
      data_compra: dataCompra || null,
      data_prevista_chegada: dataPrevista || null,
      data_chegada: dataChegada || null,
      local_chegada: localChegada.trim() || null,
      destino: destino.trim() || null,
      quantidade: quantidade ? parseFloat(quantidade) : null,
      unidade: unidade.trim() || null,
      valor_unitario: valorUnitario ? parseFloat(valorUnitario) : null,
      valor_total: valorTotal ? parseFloat(valorTotal) : null,
      status,
      nota_fiscal_url: nfUrl || null,
      nota_fiscal_path: nfPath || null,
      observacoes: observacoes.trim() || null,
    }
    if (material?.id) {
      await supabase.from('obra_materiais').update(payload).eq('id', material.id)
    } else {
      await supabase.from('obra_materiais').insert(payload)
    }
    setSaving(false)
    onSaved()
  }

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label className="block text-xs font-medium text-[#64748B] mb-1">{label}</label>{children}</div>
  )

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="font-syne font-semibold text-[#0F172A]">{material ? 'Editar Material' : 'Novo Material'}</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>

        <form onSubmit={salvar} className="p-6 space-y-4">
          {/* Tipo de compra */}
          <div className="flex gap-3">
            {(['interna', 'cliente'] as const).map(t => (
              <button key={t} type="button" onClick={() => setTipCompra(t)}
                className={`flex-1 py-2.5 rounded-xl font-medium text-sm border-2 transition-all ${tipCompra === t
                  ? t === 'interna' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-purple-400 bg-purple-50 text-purple-700'
                  : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'}`}>
                {t === 'interna' ? '🏢 Compra Interna' : '👤 Compra Cliente'}
              </button>
            ))}
          </div>

          {/* Status */}
          <F label="Status">
            <div className="flex gap-2 flex-wrap">
              {(Object.entries(STATUS_MATERIAL) as [ObraMaterial['status'], { label: string; cls: string }][]).map(([key, cfg]) => (
                <button key={key} type="button" onClick={() => setStatus(key)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border-2 transition-all ${status === key ? cfg.cls + ' border-current' : 'border-[#E2E8F0] text-[#64748B]'}`}>
                  {cfg.label}
                </button>
              ))}
            </div>
          </F>

          {/* Descrição */}
          <F label="Descrição do material *">
            <input required className="field" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Tubo de cobre 1/2 pol" />
          </F>

          <div className="grid grid-cols-2 gap-3">
            <F label="Fornecedor">
              <input className="field" value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Nome da empresa" />
            </F>
            <F label="Comprador">
              <input className="field" value={comprador} onChange={e => setComprador(e.target.value)} placeholder="Nome de quem comprou" />
            </F>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <F label="Data da compra">
              <input type="date" className="field" value={dataCompra} onChange={e => setDataCompra(e.target.value)} />
            </F>
            <F label="Prev. chegada">
              <input type="date" className="field" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)} />
            </F>
            <F label="Data chegada real">
              <input type="date" className="field" value={dataChegada} onChange={e => setDataChegada(e.target.value)} />
            </F>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <F label="Local de chegada">
              <input className="field" value={localChegada} onChange={e => setLocalChegada(e.target.value)} placeholder="Ex: Almoxarifado MARV" />
            </F>
            <F label="Destino / Para onde foi">
              <input className="field" value={destino} onChange={e => setDestino(e.target.value)} placeholder="Ex: Obra Projac" />
            </F>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <F label="Quantidade">
              <input type="number" step="any" min="0" className="field" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" />
            </F>
            <F label="Unidade">
              <input className="field" value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="un" />
            </F>
            <F label="Valor unitário (R$)">
              <input type="number" step="any" min="0" className="field" value={valorUnitario}
                onChange={e => {
                  setValorUnitario(e.target.value)
                  if (quantidade && e.target.value) setValorTotal(String((parseFloat(quantidade) * parseFloat(e.target.value)).toFixed(2)))
                }} placeholder="0,00" />
            </F>
          </div>

          <F label="Valor total (R$)">
            <input type="number" step="any" min="0" className="field" value={valorTotal} onChange={e => setValorTotal(e.target.value)} placeholder="Calculado automaticamente ou preencha manualmente" />
          </F>

          {/* Nota Fiscal */}
          <F label="Nota Fiscal (PDF ou imagem)">
            <div className="flex items-center gap-3 flex-wrap">
              {nfUrl && (
                <a href={nfUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-[#4F7CFF] bg-[#EEF2FF] px-3 py-2 rounded-lg">
                  <FileText size={13} /> Ver NF anexada
                </a>
              )}
              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] text-sm text-[#64748B] transition-colors">
                {uploadingNf ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploadingNf ? 'Lendo NF...' : nfUrl ? 'Trocar NF' : 'Anexar NF'}
                <input type="file" accept="image/*,.pdf" className="hidden" disabled={uploadingNf}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadNF(f) }} />
              </label>
              {nfUrl && <button type="button" onClick={() => { setNfUrl(''); setNfPath(''); setNfDados(null) }} className="text-[#94A3B8] hover:text-red-500"><X size={14} /></button>}
            </div>
            {nfDados && (
              <div className="mt-2 bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-800">
                <div className="flex items-center gap-1.5 font-semibold mb-1.5">
                  <CheckCircle2 size={13} className="text-green-600" /> Dados detectados na NF e preenchidos automaticamente
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-green-700">
                  {nfDados.emitente && <span><b>Fornecedor:</b> {nfDados.emitente}</span>}
                  {nfDados.nfNumero && <span><b>NF:</b> {nfDados.nfNumero}</span>}
                  {nfDados.dataEmissao && <span><b>Data:</b> {formatDate(nfDados.dataEmissao)}</span>}
                  {nfDados.valorTotal && <span><b>Total:</b> {formatCurrency(nfDados.valorTotal)}</span>}
                  {nfDados.produtos && nfDados.produtos.length > 0 && (
                    <span className="col-span-2"><b>Itens:</b> {nfDados.produtos.length} produto(s) na NF</span>
                  )}
                </div>
              </div>
            )}
          </F>

          <F label="Observações">
            <textarea className="field resize-none" rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Informações adicionais..." />
          </F>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {saving ? 'Salvando...' : material ? 'Salvar alterações' : 'Adicionar material'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── ModalImportNF ─────────────────────────────────────
function ModalImportNF({ obraId, onClose, onSaved }: {
  obraId: string; onClose: () => void; onSaved: () => void
}) {
  type NfItem = { codigo: string; descricao: string; quantidade: number; valorUnitario: number; valorTotal: number; unidade: string }
  type NfData = { emitente?: string; nfNumero?: string; dataEmissao?: string; valorTotal?: number; produtos?: NfItem[]; descricao?: string }

  const raw = typeof window !== 'undefined' ? sessionStorage.getItem('nf_import') : null
  const nf: NfData = raw ? JSON.parse(raw) : {}

  const [selecionados, setSelecionados] = useState<Record<number, boolean>>(
    Object.fromEntries((nf.produtos ?? []).map((_, i) => [i, true]))
  )
  const [tipCompra, setTipCompra] = useState<'interna' | 'cliente'>('interna')
  const [comprador, setComprador] = useState('')
  const [saving, setSaving] = useState(false)

  const itens = nf.produtos ?? []
  const allSelected = Object.values(selecionados).every(Boolean)

  async function importar() {
    const supabase = createClient()
    setSaving(true)
    const payload = itens
      .filter((_, i) => selecionados[i])
      .map(p => ({
        obra_id: obraId,
        descricao: p.descricao,
        tipo_compra: tipCompra,
        fornecedor: nf.emitente ?? null,
        comprador: comprador.trim() || null,
        data_compra: nf.dataEmissao ?? null,
        quantidade: p.quantidade,
        unidade: p.unidade,
        valor_unitario: p.valorUnitario,
        valor_total: p.valorTotal,
        status: 'pendente' as const,
        observacoes: nf.nfNumero ? `NF: ${nf.nfNumero}` : null,
      }))
    if (payload.length > 0) await supabase.from('obra_materiais').insert(payload)
    sessionStorage.removeItem('nf_import')
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-syne font-semibold text-[#0F172A]">Importar itens da NF</h2>
            {nf.nfNumero && <p className="text-xs text-[#64748B] mt-0.5">{nf.nfNumero} · {nf.emitente}</p>}
          </div>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Resumo NF */}
          <div className="bg-[#F8FAFC] rounded-xl p-4 text-sm grid grid-cols-2 gap-2">
            {nf.emitente && <div><span className="text-[#64748B] text-xs">Fornecedor</span><p className="font-medium text-[#0F172A] truncate">{nf.emitente}</p></div>}
            {nf.dataEmissao && <div><span className="text-[#64748B] text-xs">Data de emissão</span><p className="font-medium text-[#0F172A]">{formatDate(nf.dataEmissao)}</p></div>}
            {nf.valorTotal && <div><span className="text-[#64748B] text-xs">Valor total NF</span><p className="font-semibold text-[#4F7CFF]">{formatCurrency(nf.valorTotal)}</p></div>}
            {nf.nfNumero && <div><span className="text-[#64748B] text-xs">Número</span><p className="font-medium text-[#0F172A]">{nf.nfNumero}</p></div>}
          </div>

          {/* Tipo de compra */}
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Tipo de compra</label>
            <div className="flex gap-3">
              {(['interna', 'cliente'] as const).map(t => (
                <button key={t} type="button" onClick={() => setTipCompra(t)}
                  className={`flex-1 py-2.5 rounded-xl font-medium text-sm border-2 transition-all ${tipCompra === t
                    ? t === 'interna' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-purple-400 bg-purple-50 text-purple-700'
                    : 'border-[#E2E8F0] text-[#64748B]'}`}>
                  {t === 'interna' ? '🏢 Compra Interna' : '👤 Compra Cliente'}
                </button>
              ))}
            </div>
          </div>

          {/* Comprador */}
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Quem comprou</label>
            <input className="field" value={comprador} onChange={e => setComprador(e.target.value)} placeholder="Nome de quem fez a compra" />
          </div>

          {/* Itens da NF */}
          {itens.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[#64748B]">Selecione os itens para importar</label>
                <button type="button" className="text-xs text-[#4F7CFF] font-medium"
                  onClick={() => setSelecionados(Object.fromEntries(itens.map((_, i) => [i, !allSelected])))}>
                  {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>
              <div className="space-y-2">
                {itens.map((p, i) => (
                  <label key={i} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selecionados[i] ? 'border-[#4F7CFF] bg-[#EEF2FF]' : 'border-[#E2E8F0] bg-white'}`}>
                    <input type="checkbox" className="mt-0.5 accent-[#4F7CFF]" checked={!!selecionados[i]}
                      onChange={e => setSelecionados(s => ({ ...s, [i]: e.target.checked }))} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F172A] leading-tight">{p.descricao}</p>
                      <p className="text-xs text-[#64748B] mt-0.5">{p.quantidade} {p.unidade} · {formatCurrency(p.valorUnitario)}/un · <span className="font-semibold text-[#374151]">{formatCurrency(p.valorTotal)}</span></p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {itens.length === 0 && (
            <div className="text-center py-6 text-sm text-[#64748B]">
              Nenhum item de produto detectado nesta NF.<br />
              Os dados gerais (fornecedor, valor, data) foram extraídos.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-colors">
              Cancelar
            </button>
            <button onClick={importar} disabled={saving || Object.values(selecionados).every(v => !v)}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {saving ? 'Importando...' : `Importar ${Object.values(selecionados).filter(Boolean).length} ite${Object.values(selecionados).filter(Boolean).length === 1 ? 'm' : 'ns'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── ModalNFManual ─────────────────────────────────────
type ItemNF = { descricao: string; quantidade: string; unidade: string; valorUnitario: string; valorTotal: string }
const ITEM_VAZIO = (): ItemNF => ({ descricao: '', quantidade: '1', unidade: 'UN', valorUnitario: '', valorTotal: '' })

function ModalNFManual({ obraId, onClose, onSaved }: {
  obraId: string; onClose: () => void; onSaved: () => void
}) {
  const [tipCompra, setTipCompra] = useState<'interna' | 'cliente'>('interna')
  const [fornecedor, setFornecedor] = useState('')
  const [comprador, setComprador] = useState('')
  const [nfNumero, setNfNumero] = useState('')
  const [dataCompra, setDataCompra] = useState('')
  const [itens, setItens] = useState<ItemNF[]>([ITEM_VAZIO()])
  const [saving, setSaving] = useState(false)

  function updateItem(i: number, field: keyof ItemNF, value: string) {
    setItens(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      // Auto-calc valor total
      if (field === 'quantidade' || field === 'valorUnitario') {
        const qty = parseFloat(field === 'quantidade' ? value : next[i].quantidade)
        const vu = parseFloat(field === 'valorUnitario' ? value : next[i].valorUnitario)
        if (!isNaN(qty) && !isNaN(vu)) next[i].valorTotal = (qty * vu).toFixed(2)
      }
      return next
    })
  }

  function addItem() { setItens(prev => [...prev, ITEM_VAZIO()]) }
  function removeItem(i: number) { setItens(prev => prev.filter((_, idx) => idx !== i)) }

  async function salvar() {
    const validos = itens.filter(it => it.descricao.trim())
    if (validos.length === 0) return
    setSaving(true)
    const supabase = createClient()
    const obs = nfNumero.trim() ? `NF: ${nfNumero.trim()}` : null
    const payload = validos.map(it => ({
      obra_id: obraId,
      descricao: it.descricao.trim(),
      tipo_compra: tipCompra,
      fornecedor: fornecedor.trim() || null,
      comprador: comprador.trim() || null,
      data_compra: dataCompra || null,
      quantidade: parseFloat(it.quantidade) || null,
      unidade: it.unidade.trim() || null,
      valor_unitario: parseFloat(it.valorUnitario) || null,
      valor_total: parseFloat(it.valorTotal) || null,
      status: 'pendente' as const,
      observacoes: obs,
    }))
    await supabase.from('obra_materiais').insert(payload)
    setSaving(false)
    onSaved()
  }

  const F = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
    <div className={className}><label className="block text-xs font-medium text-[#64748B] mb-1">{label}</label>{children}</div>
  )

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="font-syne font-semibold text-[#0F172A]">Lançar NF Manual</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Tipo */}
          <div className="flex gap-3">
            {(['interna', 'cliente'] as const).map(t => (
              <button key={t} type="button" onClick={() => setTipCompra(t)}
                className={`flex-1 py-2.5 rounded-xl font-medium text-sm border-2 transition-all ${tipCompra === t
                  ? t === 'interna' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-purple-400 bg-purple-50 text-purple-700'
                  : 'border-[#E2E8F0] text-[#64748B]'}`}>
                {t === 'interna' ? '🏢 Compra Interna' : '👤 Compra Cliente'}
              </button>
            ))}
          </div>

          {/* Cabeçalho da NF */}
          <div className="grid grid-cols-2 gap-3">
            <F label="Número da NF">
              <input className="field" value={nfNumero} onChange={e => setNfNumero(e.target.value)} placeholder="Ex: 000.086.191" />
            </F>
            <F label="Data da compra">
              <input type="date" className="field" value={dataCompra} onChange={e => setDataCompra(e.target.value)} />
            </F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Fornecedor">
              <input className="field" value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Nome da empresa" />
            </F>
            <F label="Quem comprou">
              <input className="field" value={comprador} onChange={e => setComprador(e.target.value)} placeholder="Nome" />
            </F>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-[#64748B]">Itens da NF</label>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 text-xs font-medium text-[#4F7CFF] hover:text-blue-700">
                <Plus size={13} /> Adicionar item
              </button>
            </div>

            <div className="space-y-2">
              {itens.map((item, i) => (
                <div key={i} className="border border-[#E2E8F0] rounded-xl p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <input className="field text-sm" value={item.descricao}
                        onChange={e => updateItem(i, 'descricao', e.target.value)}
                        placeholder={`Item ${i + 1} — descrição do material`} />
                    </div>
                    {itens.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="mt-1 text-[#94A3B8] hover:text-red-500 shrink-0">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-xs text-[#94A3B8] mb-0.5 block">Qtd</label>
                      <input type="number" min="0" step="any" className="field text-sm" value={item.quantidade}
                        onChange={e => updateItem(i, 'quantidade', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-[#94A3B8] mb-0.5 block">Unidade</label>
                      <input className="field text-sm" value={item.unidade}
                        onChange={e => updateItem(i, 'unidade', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-[#94A3B8] mb-0.5 block">Vl. unit.</label>
                      <input type="number" min="0" step="any" className="field text-sm" value={item.valorUnitario}
                        onChange={e => updateItem(i, 'valorUnitario', e.target.value)} placeholder="0,00" />
                    </div>
                    <div>
                      <label className="text-xs text-[#94A3B8] mb-0.5 block">Total</label>
                      <input type="number" min="0" step="any" className="field text-sm" value={item.valorTotal}
                        onChange={e => updateItem(i, 'valorTotal', e.target.value)} placeholder="0,00" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-colors">
              Cancelar
            </button>
            <button onClick={salvar} disabled={saving || itens.every(it => !it.descricao.trim())}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {saving ? 'Salvando...' : `Salvar ${itens.filter(it => it.descricao.trim()).length} ite${itens.filter(it => it.descricao.trim()).length === 1 ? 'm' : 'ns'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
