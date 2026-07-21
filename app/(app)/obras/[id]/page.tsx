'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Search, Bell, MapPin, FileText, PlusCircle, BarChart2, Upload, X, Wrench, Calendar, User, Hash, Clock, CheckCircle2, AlertTriangle, ExternalLink, FolderOpen, Folder, Plus, Trash2, ChevronDown, ChevronRight, FileSpreadsheet, Loader2, Settings, ShoppingCart, Pencil, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Obra, CronogramaEtapa, Documento, CategoriaDoc, StatusEtapa, DocPasta, RDO } from '@/lib/types'
import StatusChip from '@/components/StatusChip'
import Link from 'next/link'
import { useAccess } from '@/lib/useAccess'

type Tab = 'visao-geral' | 'documentos' | 'cronograma' | 'relatorios' | 'materiais' | 'equipe'

interface Funcionario {
  id: string
  nome: string
  cargo: string | null
  custo_diario: number | null
}

interface ObraFuncionario {
  id: string
  obra_id: string
  funcionario_id: string
  funcionario?: Funcionario
  dias_trabalhados: number
  custo_diario_epoca: number
  custo_total: number
  data_inicio?: string | null
  data_fim?: string | null
  observacoes?: string | null
}

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
  preco_venda_unitario?: number
  valor_venda_total?: number
  numero_oc?: string
  status: 'pendente' | 'orcado' | 'comprado' | 'em_transito' | 'recebido' | 'instalado'
  nota_fiscal_url?: string
  nota_fiscal_path?: string
  nf_pagamento_url?: string
  nf_pagamento_path?: string
  custos_extras?: { descricao: string; valor: number }[] | null
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
  const { can } = useAccess()
  const [obra, setObra] = useState<Obra | null>(null)
  const [etapas, setEtapas] = useState<CronogramaEtapa[]>([])
  const [docs, setDocs] = useState<Documento[]>([])
  const [pastas, setPastas] = useState<DocPasta[]>([])
  const [rdos, setRdos] = useState<RDO[]>([])
  const [materiais, setMateriais] = useState<ObraMaterial[]>([])
  const [equipe, setEquipe] = useState<ObraFuncionario[]>([])
  const [criandoRdo, setCriandoRdo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showNovoMaterial, setShowNovoMaterial] = useState(false)
  const [editandoMaterial, setEditandoMaterial] = useState<ObraMaterial | null>(null)
  const [importandoNF, setImportandoNF] = useState(false)
  const [showImportNF, setShowImportNF] = useState(false)
  const [showNFManual, setShowNFManual] = useState(false)
  const [editandoOrcamento, setEditandoOrcamento] = useState<ObraMaterial[] | null>(null)
  const [pastaAtiva, setPastaAtiva] = useState<string>('__todas__')
  const [pastasAbertas, setPastasAbertas] = useState<Record<string, boolean>>({})

  // Modals
  const [showNovaEtapa, setShowNovaEtapa] = useState(false)
  const [editandoEtapa, setEditandoEtapa] = useState<CronogramaEtapa | null>(null)
  const [showAddDoc, setShowAddDoc] = useState(false)
  const [showNovaPasta, setShowNovaPasta] = useState(false)
  const [criandoSubpastaEm, setCriandoSubpastaEm] = useState<string | null>(null)
  const [pastaParaDoc, setPastaParaDoc] = useState<string | null>(null)
  const [importandoExcel, setImportandoExcel] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  async function importarExcelCronograma(file: File) {
    setImportandoExcel(true)
    try {
      const { read, utils } = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = read(buffer)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = utils.sheet_to_json(ws, { defval: '' })

      const supabase = createClient()
      const parseDate = (v: any) => {
        if (!v) return null
        if (typeof v === 'number') {
          const d = new Date(Math.round((v - 25569) * 86400 * 1000))
          return d.toISOString().split('T')[0]
        }
        const s = String(v).trim()
        if (!s) return null
        const parts = s.split(/[/\-.]/)
        if (parts.length === 3) {
          if (parts[0].length <= 2) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
          return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`
        }
        return null
      }
      const etapasParaInserir = rows
        .filter(r => r['Etapa'] || r['Nome'] || r['Titulo'] || r['título'] || r['etapa'])
        .map((r, i) => {
          const titulo = r['Etapa'] || r['Nome'] || r['Titulo'] || r['título'] || r['etapa'] || `Etapa ${i + 1}`
          const responsavel = r['Responsável'] || r['Responsavel'] || r['responsavel'] || ''
          const cor = r['Cor'] || r['cor'] || r['Color'] || ''
          const numeroItem = r['Item'] || r['Número'] || r['Numero'] || r['numero_item'] || r['WBS'] || ''
          return {
            obra_id: id,
            titulo: String(titulo).trim(),
            numero_item: numeroItem ? String(numeroItem).trim() : null,
            responsavel: responsavel ? String(responsavel).trim() : null,
            data_inicio: parseDate(r['Início'] || r['Inicio'] || r['Data Início'] || r['Data Inicio'] || r['inicio']),
            data_fim: parseDate(r['Fim'] || r['Término'] || r['Termino'] || r['Data Fim'] || r['fim']),
            progresso: parseInt(r['Progresso'] || r['%'] || '0') || 0,
            status: 'Pendente' as const,
            cor: cor ? String(cor).trim() : '#4F7CFF',
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

  async function excluirEtapa(etapaId: string) {
    if (!confirm('Excluir esta etapa?')) return
    const supabase = createClient()
    await supabase.from('cronograma_etapas').delete().eq('id', etapaId)
    load()
  }

  async function excluirEtapas(ids: string[]) {
    const supabase = createClient()
    await supabase.from('cronograma_etapas').delete().in('id', ids)
    load()
  }

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const [obraRes, etapasRes, docsRes, pastasRes, rdosRes, materiaisRes, equipeRes] = await Promise.all([
      supabase.from('obras').select('*').eq('id', id).single(),
      supabase.from('cronograma_etapas').select('*').eq('obra_id', id).order('ordem'),
      supabase.from('documentos').select('*').eq('obra_id', id).order('pasta').order('created_at', { ascending: false }),
      supabase.from('doc_pastas').select('*').eq('obra_id', id).order('ordem'),
      supabase.from('rdos').select('*').eq('obra_id', id).order('numero', { ascending: false }),
      supabase.from('obra_materiais').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
      supabase.from('obra_funcionarios').select('*, funcionario:funcionarios(id, nome, cargo, custo_diario)').eq('obra_id', id).order('created_at', { ascending: false }),
    ])
    if (obraRes.data) setObra(obraRes.data as Obra)
    if (etapasRes.data) setEtapas(etapasRes.data as CronogramaEtapa[])
    if (docsRes.data) setDocs(docsRes.data as Documento[])
    if (pastasRes.data) setPastas(pastasRes.data as DocPasta[])
    if (rdosRes.data) setRdos(rdosRes.data as RDO[])
    if (materiaisRes.data) setMateriais(materiaisRes.data as ObraMaterial[])
    if (equipeRes.data) setEquipe(equipeRes.data as ObraFuncionario[])
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

  // Docs — hierarquia de pastas
  // Resolve o pasta_id de um doc (suporta legado: campo pasta guardado como nome ou como id)
  function resolveDocPastaId(doc: Documento): string | null {
    if (!doc.pasta) return null
    if (pastas.find(p => p.id === doc.pasta)) return doc.pasta
    const byName = pastas.find(p => p.nome === doc.pasta)
    return byName ? byName.id : null
  }

  const rootPastas = pastas.filter(p => !p.parent_id)
  const childrenOf = (parentId: string) => pastas.filter(p => p.parent_id === parentId)
  // Todos os ids descendentes de uma pasta (para selecionar subpastas ao filtrar)
  function descendantIds(pastaId: string): string[] {
    const children = childrenOf(pastaId)
    return [pastaId, ...children.flatMap(c => descendantIds(c.id))]
  }

  const docsFiltrados = pastaAtiva === '__todas__'
    ? docs
    : docs.filter(d => {
        const pid = resolveDocPastaId(d)
        return descendantIds(pastaAtiva).includes(pid ?? '')
      })

  function togglePasta(pastaId: string) {
    setPastasAbertas(prev => ({ ...prev, [pastaId]: !prev[pastaId] }))
  }

  async function excluirDoc(docId: string, arquivoPath?: string) {
    if (!confirm('Excluir este documento?')) return
    const supabase = createClient()
    if (arquivoPath) await supabase.storage.from('documentos').remove([arquivoPath])
    await supabase.from('documentos').delete().eq('id', docId)
    load()
  }

  async function criarPasta(nome: string, parentId?: string | null) {
    const supabase = createClient()
    await supabase.from('doc_pastas').insert({ obra_id: id, nome, ordem: pastas.length, parent_id: parentId || null })
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
    const filhos = childrenOf(pastaId)
    const msg = filhos.length > 0
      ? `Excluir a pasta "${nomePasta}" e suas ${filhos.length} subpasta(s)? Os documentos serão desvinculados.`
      : `Excluir a pasta "${nomePasta}"? Os documentos dentro dela serão desvinculados.`
    if (!confirm(msg)) return
    const supabase = createClient()
    // Desvincular docs desta pasta e subpastas
    const todosIds = descendantIds(pastaId)
    for (const pid of todosIds) {
      await supabase.from('documentos').update({ pasta: null }).eq('obra_id', id).eq('pasta', pid)
      // legado: pasta guardada como nome
      const p = pastas.find(pp => pp.id === pid)
      if (p) await supabase.from('documentos').update({ pasta: null }).eq('obra_id', id).eq('pasta', p.nome)
    }
    await supabase.from('doc_pastas').delete().eq('id', pastaId)
    if (descendantIds(pastaId).includes(pastaAtiva)) setPastaAtiva('__todas__')
    load()
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-7.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:min-h-full min-w-0 overflow-x-hidden">
      {/* Topbar */}
      <header className="min-h-14 bg-white border-b border-[#E2E8F0] flex items-start md:items-center px-3 md:px-6 py-3 md:py-0 gap-3 relative md:sticky md:top-0 z-10">
        <button aria-label="Voltar para obras" onClick={() => router.push('/obras')} className="w-8 h-8 -ml-1 shrink-0 flex items-center justify-center text-sm text-[#64748B] hover:text-[#0F172A] transition-colors">
          <ArrowLeft size={16} />
        </button>
        <h1 className="font-syne font-semibold text-[#0F172A] text-sm md:text-base leading-5 line-clamp-2 md:truncate flex-1 min-w-0 pt-1.5 md:pt-0">{obra.titulo}</h1>
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
      <div className="bg-white border-b border-[#E2E8F0] px-2 md:px-6 min-w-0">
        <div className="flex gap-0 overflow-x-auto overscroll-x-contain scrollbar-none">
          {(['visao-geral', 'relatorios', 'materiais', 'equipe', 'documentos', 'cronograma'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 md:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${tab === t ? 'border-[#4F7CFF] text-[#4F7CFF]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'}`}>
              {t === 'visao-geral' ? 'Visão Geral'
                : t === 'documentos' ? 'Documentos'
                : t === 'cronograma' ? 'Cronograma'
                : t === 'relatorios' ? `Relatórios (${rdos.length})`
                : t === 'equipe' ? `Equipe (${equipe.length})`
                : `Materiais (${materiais.length})`}
            </button>
          ))}
          {can('financeiro') && (
            <Link href={`/obras/${id}/financeiro`} className="px-3 md:px-4 py-3 text-sm font-medium border-b-2 border-transparent text-[#64748B] hover:text-[#0F172A] whitespace-nowrap shrink-0">
              Financeiro
            </Link>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 p-3 md:p-6">
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
                  <InfoRow icon={<Hash size={14} />} label="Contrato" value={obra.numero_contrato} />
                  <InfoRow icon={<Calendar size={14} />} label="Aprovação do Contrato" value={formatDate(obra.data_aprovacao_contrato)} />
                  <InfoRow icon={<Calendar size={14} />} label="Início" value={formatDate(obra.data_inicio)} />
                  <InfoRow icon={<Calendar size={14} />} label="Previsão Término" value={formatDate(obra.previsao_termino)} />
                  <InfoRow icon={<MapPin size={14} />} label="Endereço" value={obra.endereco} />
                  {obra.pavimento && <InfoRow icon={<MapPin size={14} />} label="Pavimento" value={obra.pavimento} />}
                </div>

                {/* Contatos do Projeto */}
                {(obra.gestor_id || obra.comprador_id) && (
                  <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
                    <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">Contatos do Projeto</p>
                    <GestorCompradorCards obraId={obra.id} gestorId={obra.gestor_id} compradorId={obra.comprador_id} />
                  </div>
                )}
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
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 min-w-0">
            {/* Sidebar de pastas */}
            <div className="w-full lg:w-56 shrink-0">
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
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors mb-0.5 ${pastaAtiva === '__todas__' ? 'bg-[#EEF2FF] text-[#4F7CFF] font-medium' : 'text-[#374151] hover:bg-[#F1F5F9]'}`}
                >
                  <FolderOpen size={14} />
                  <span className="flex-1 text-left">Todos</span>
                  <span className="text-xs text-[#94A3B8]">{docs.length}</span>
                </button>

                {/* Árvore de pastas */}
                {rootPastas.map(pasta => {
                  const filhos = childrenOf(pasta.id)
                  const qtd = docs.filter(d => descendantIds(pasta.id).includes(resolveDocPastaId(d) ?? '')).length
                  const ativa = pastaAtiva === pasta.id
                  const expandida = pastasAbertas[pasta.id] !== false // aberta por padrão
                  const temFilhos = filhos.length > 0

                  return (
                    <div key={pasta.id}>
                      {/* Pasta raiz */}
                      <div className="group/pasta relative flex items-center">
                        {temFilhos && (
                          <button onClick={() => togglePasta(pasta.id)} className="shrink-0 w-4 h-6 flex items-center justify-center text-[#94A3B8] hover:text-[#64748B]">
                            {expandida ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          </button>
                        )}
                        <button
                          onClick={() => setPastaAtiva(pasta.id)}
                          className={`flex-1 flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg text-sm transition-colors ${!temFilhos ? 'ml-4' : ''} ${ativa ? 'bg-[#EEF2FF] text-[#4F7CFF] font-medium' : 'text-[#374151] hover:bg-[#F1F5F9]'}`}
                        >
                          <Folder size={14} className={ativa ? 'text-[#4F7CFF]' : 'text-[#94A3B8]'} />
                          <span className="flex-1 text-left truncate text-xs">{pasta.nome}</span>
                          <span className="text-[10px] text-[#94A3B8]">{qtd}</span>
                        </button>
                        {/* Ações hover: add subpasta + excluir */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden group-hover/pasta:flex items-center gap-0.5 bg-white pl-1">
                          <button
                            title="Nova subpasta"
                            onClick={() => { setCriandoSubpastaEm(pasta.id); setPastasAbertas(p => ({ ...p, [pasta.id]: true })) }}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#4F7CFF]">
                            <Plus size={11} />
                          </button>
                          <button
                            title="Excluir pasta"
                            onClick={() => excluirPasta(pasta.id, pasta.nome)}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 text-[#94A3B8] hover:text-red-400">
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>

                      {/* Subpastas */}
                      {expandida && (
                        <div className="ml-4 border-l border-[#F1F5F9] pl-1.5 mt-0.5 space-y-0.5">
                          {filhos.map(sub => {
                            const subQtd = docs.filter(d => resolveDocPastaId(d) === sub.id).length
                            const subAtiva = pastaAtiva === sub.id
                            return (
                              <div key={sub.id} className="group/sub relative flex items-center">
                                <button
                                  onClick={() => setPastaAtiva(sub.id)}
                                  className={`flex-1 flex items-center gap-1.5 px-1.5 py-1 rounded-lg text-xs transition-colors ${subAtiva ? 'bg-[#EEF2FF] text-[#4F7CFF] font-medium' : 'text-[#374151] hover:bg-[#F1F5F9]'}`}
                                >
                                  <Folder size={12} className={subAtiva ? 'text-[#4F7CFF]' : 'text-[#94A3B8]'} />
                                  <span className="flex-1 text-left truncate">{sub.nome}</span>
                                  <span className="text-[10px] text-[#94A3B8]">{subQtd}</span>
                                </button>
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden group-hover/sub:flex items-center bg-white pl-0.5">
                                  <button
                                    title="Excluir subpasta"
                                    onClick={() => excluirPasta(sub.id, sub.nome)}
                                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 text-[#94A3B8] hover:text-red-400">
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              </div>
                            )
                          })}

                          {/* Input inline de nova subpasta */}
                          {criandoSubpastaEm === pasta.id && (
                            <NovaPastaInline
                              onConfirm={nome => { criarPasta(nome, pasta.id); setCriandoSubpastaEm(null) }}
                              onCancel={() => setCriandoSubpastaEm(null)}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Nova pasta raiz inline */}
                {showNovaPasta && (
                  <NovaPastaInline
                    onConfirm={nome => { criarPasta(nome); setShowNovaPasta(false) }}
                    onCancel={() => setShowNovaPasta(false)}
                  />
                )}
              </div>

            </div>

            {/* Área principal */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h2 className="font-syne text-lg font-bold text-[#0F172A] break-words">
                    {pastaAtiva === '__todas__' ? 'Todos os Documentos' : (() => {
                      const p = pastas.find(pp => pp.id === pastaAtiva)
                      if (!p) return 'Documentos'
                      const pai = p.parent_id ? pastas.find(pp => pp.id === p.parent_id) : null
                      return pai ? `${pai.nome} / ${p.nome}` : p.nome
                    })()}
                  </h2>
                  <p className="text-xs text-[#64748B]">{docsFiltrados.length} documento{docsFiltrados.length !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={() => { setPastaParaDoc(pastaAtiva === '__todas__' ? null : pastaAtiva); setShowAddDoc(true) }}
                  className="btn-primary w-full sm:w-auto shrink-0"
                >
                  <Upload size={16} /> Adicionar Documentos
                </button>
              </div>

              {/* Visualização por pasta (modo todas) ou lista */}
              {pastaAtiva === '__todas__' ? (
                <div className="space-y-4">
                  {rootPastas.map(pasta => {
                    // Docs diretos nesta pasta (não nos filhos)
                    const docsNaPasta = docs.filter(d => resolveDocPastaId(d) === pasta.id)
                    const filhos = childrenOf(pasta.id)
                    const totalPasta = docs.filter(d => descendantIds(pasta.id).includes(resolveDocPastaId(d) ?? '')).length
                    if (totalPasta === 0 && filhos.length === 0) return null
                    const aberta = pastasAbertas[pasta.id] !== false
                    return (
                      <div key={pasta.id} className="card p-0 overflow-hidden">
                        <button
                          onClick={() => togglePasta(pasta.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors"
                        >
                          {aberta ? <ChevronDown size={15} className="text-[#64748B]" /> : <ChevronRight size={15} className="text-[#64748B]" />}
                          <FolderOpen size={16} className="text-[#4F7CFF]" />
                          <span className="font-syne font-semibold text-sm text-[#0F172A]">{pasta.nome}</span>
                          <span className="text-xs text-[#94A3B8] ml-auto">{totalPasta} arquivo{totalPasta !== 1 ? 's' : ''}</span>
                        </button>
                        {aberta && (
                          <>
                            {docsNaPasta.length > 0 && <DocTable docs={docsNaPasta} onDelete={excluirDoc} />}
                            {filhos.map(sub => {
                              const docsSub = docs.filter(d => resolveDocPastaId(d) === sub.id)
                              if (docsSub.length === 0) return null
                              const subAberta = pastasAbertas[sub.id] !== false
                              return (
                                <div key={sub.id} className="border-t border-[#F1F5F9]">
                                  <button
                                    onClick={() => togglePasta(sub.id)}
                                    className="w-full flex items-center gap-2 px-6 py-2 bg-[#FAFBFF] hover:bg-[#F1F5F9] transition-colors"
                                  >
                                    {subAberta ? <ChevronDown size={13} className="text-[#94A3B8]" /> : <ChevronRight size={13} className="text-[#94A3B8]" />}
                                    <Folder size={13} className="text-[#94A3B8]" />
                                    <span className="text-xs font-medium text-[#374151]">{sub.nome}</span>
                                    <span className="text-[10px] text-[#94A3B8] ml-auto">{docsSub.length} arquivo{docsSub.length !== 1 ? 's' : ''}</span>
                                  </button>
                                  {subAberta && <DocTable docs={docsSub} onDelete={excluirDoc} />}
                                </div>
                              )
                            })}
                          </>
                        )}
                      </div>
                    )
                  })}
                  {/* Docs sem pasta */}
                  {(() => {
                    const semPasta = docs.filter(d => !resolveDocPastaId(d))
                    if (semPasta.length === 0) return null
                    const aberta = pastasAbertas['__sem_pasta__'] !== false
                    return (
                      <div className="card p-0 overflow-hidden">
                        <button onClick={() => togglePasta('__sem_pasta__')}
                          className="w-full flex items-center gap-3 px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors">
                          {aberta ? <ChevronDown size={15} className="text-[#64748B]" /> : <ChevronRight size={15} className="text-[#64748B]" />}
                          <FolderOpen size={16} className="text-[#94A3B8]" />
                          <span className="font-syne font-semibold text-sm text-[#64748B]">Sem pasta</span>
                          <span className="text-xs text-[#94A3B8] ml-auto">{semPasta.length} arquivo{semPasta.length !== 1 ? 's' : ''}</span>
                        </button>
                        {aberta && <DocTable docs={semPasta} onDelete={excluirDoc} />}
                      </div>
                    )
                  })()}
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
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-[#0F172A]">Cronograma de Execução</h2>
                <p className="text-xs text-[#64748B] mt-0.5">{totalEtapas} etapa{totalEtapas !== 1 ? 's' : ''} · {progressoGeral}% concluído{atrasadas > 0 ? ` · ${atrasadas} atrasada${atrasadas !== 1 ? 's' : ''}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] transition-colors cursor-pointer">
                  {importandoExcel ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                  <span className="hidden sm:inline">Importar Excel</span>
                </button>
                <button onClick={() => { setEditandoEtapa(null); setShowNovaEtapa(true) }} className="btn-primary text-sm">
                  <PlusCircle size={15} /> Nova Etapa
                </button>
              </div>
            </div>

            {etapas.length === 0 ? (
              <div className="card text-center py-16">
                <Calendar size={36} className="text-[#CBD5E1] mx-auto mb-3" />
                <p className="font-medium text-[#374151]">Nenhuma etapa cadastrada</p>
                <p className="text-sm text-[#94A3B8] mt-1 mb-4">Adicione etapas manualmente ou importe uma planilha Excel</p>
                <button onClick={() => setShowNovaEtapa(true)} className="btn-primary mx-auto text-sm">
                  <PlusCircle size={14} /> Adicionar primeira etapa
                </button>
              </div>
            ) : (
              <GanttView
                etapas={etapas}
                onEdit={e => { setEditandoEtapa(e); setShowNovaEtapa(true) }}
                onDelete={excluirEtapa}
                onDeleteMany={excluirEtapas}
                onProgressUpdate={load}
              />
            )}
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
              <div className="card p-0 overflow-x-auto">
                <table className="w-full min-w-[680px]">
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
            <div className="mb-5">
              <div className="mb-4">
                <h2 className="font-syne text-xl font-bold text-[#0F172A]">Materiais da Obra</h2>
                <p className="text-sm text-[#64748B] mt-1">Controle de compras, chegada e destino dos materiais</p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
                <button onClick={() => setShowNFManual(true)}
                  className="min-h-12 flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2 rounded-xl border-2 border-[#E2E8F0] text-[#64748B] text-xs sm:text-sm font-medium hover:bg-[#F8FAFC] transition-colors">
                  <FileText size={15} className="shrink-0" /> <span>Lançar Orçamento</span>
                </button>
                <label className={`min-h-12 flex items-center justify-center gap-1.5 cursor-pointer px-2 sm:px-4 py-2 rounded-xl border-2 border-[#4F7CFF] text-[#4F7CFF] text-xs sm:text-sm font-medium hover:bg-[#EEF2FF] transition-colors ${importandoNF ? 'opacity-60 pointer-events-none' : ''}`}>
                  {importandoNF ? <Loader2 size={15} className="animate-spin shrink-0" /> : <Upload size={15} className="shrink-0" />}
                  <span>{importandoNF ? 'Importando...' : 'Importar Orçamento'}</span>
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
                  className="btn-primary min-h-12 text-xs sm:text-sm flex items-center gap-1.5 px-2 sm:px-4">
                  <PlusCircle size={15} className="shrink-0" /> <span>Novo Material</span>
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
              <MateriaisLista
                materiais={materiais}
                onEdit={m => { setEditandoMaterial(m); setShowNovoMaterial(true) }}
                onDelete={m => excluirMaterial(m.id)}
                onEditGrupo={itens => setEditandoOrcamento(itens)}
              />
            )}
          </div>
        )}

        {/* ===== EQUIPE ===== */}
        {tab === 'equipe' && (
          <AbaEquipe obraId={id} equipe={equipe} onRefresh={load} />
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

      {/* Modal Editar Orçamento (grupo) */}
      {editandoOrcamento && (
        <ModalEditarOrcamento
          obraId={id}
          itens={editandoOrcamento}
          onClose={() => setEditandoOrcamento(null)}
          onSaved={() => { setEditandoOrcamento(null); load() }}
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

      {/* Modal Importar Excel */}
      {showImportModal && (
        <ModalImportacaoExcel
          importando={importandoExcel}
          onClose={() => setShowImportModal(false)}
          onImport={file => { setShowImportModal(false); importarExcelCronograma(file) }}
        />
      )}

      {/* Modal Etapa */}
      {showNovaEtapa && (
        <ModalEtapa
          obraId={id}
          ordem={etapas.length + 1}
          etapa={editandoEtapa}
          onClose={() => { setShowNovaEtapa(false); setEditandoEtapa(null) }}
          onSaved={() => { setShowNovaEtapa(false); setEditandoEtapa(null); load() }}
        />
      )}

      {/* Modal Add Doc */}
      {showAddDoc && (
        <ModalAddDoc
          obraId={id}
          pastaInicialId={pastaParaDoc}
          pastas={pastas}
          onClose={() => setShowAddDoc(false)}
          onCreated={() => { setShowAddDoc(false); load() }}
        />
      )}
    </div>
  )
}

// ---- Sub components ----

function GestorCompradorCards({ obraId, gestorId, compradorId }: { obraId: string; gestorId?: string | null; compradorId?: string | null }) {
  const [gestor, setGestor] = useState<{ nome: string; telefone?: string; email?: string; empresa?: { apelido?: string; razao_social: string } } | null>(null)
  const [comprador, setComprador] = useState<{ nome: string; telefone?: string; email?: string; empresa?: { apelido?: string; razao_social: string } } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    if (gestorId) {
      supabase.from('clientes').select('nome,telefone,email,empresa:empresas(razao_social,apelido)').eq('id', gestorId).single()
        .then(({ data }) => { if (data) setGestor(data as unknown as typeof gestor) })
    }
    if (compradorId) {
      supabase.from('clientes').select('nome,telefone,email,empresa:empresas(razao_social,apelido)').eq('id', compradorId).single()
        .then(({ data }) => { if (data) setComprador(data as unknown as typeof comprador) })
    }
  }, [gestorId, compradorId])

  function Card({ pessoa, titulo }: { pessoa: typeof gestor; titulo: string }) {
    if (!pessoa) return null
    const empresaNome = pessoa.empresa ? (pessoa.empresa.apelido || pessoa.empresa.razao_social) : null
    return (
      <div className="flex-1 min-w-[160px] p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-1">
        <p className="text-xs text-[#94A3B8] font-medium mb-1">{titulo}</p>
        <p className="font-semibold text-[#0F172A] text-sm">{pessoa.nome}</p>
        {empresaNome && <p className="text-xs text-[#64748B] flex items-center gap-1"><span>🏢</span>{empresaNome}</p>}
        {pessoa.telefone && <p className="text-xs text-[#64748B] flex items-center gap-1"><span>📞</span>{pessoa.telefone}</p>}
        {pessoa.email && <p className="text-xs text-[#64748B] flex items-center gap-1"><span>✉️</span>{pessoa.email}</p>}
      </div>
    )
  }

  return (
    <div className="flex gap-3 flex-wrap">
      {gestorId && <Card pessoa={gestor} titulo="Gestor Responsável" />}
      {compradorId && <Card pessoa={comprador} titulo="Comprador" />}
    </div>
  )
}

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


function ModalImportacaoExcel({ importando, onClose, onImport }: {
  importando: boolean
  onClose: () => void
  onImport: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const colunas = [
    { col: 'Item', tipo: 'Texto', obrig: false, ex: '1, 1.1, 2, 2.1', desc: 'Número WBS (grupo / subitem)' },
    { col: 'Etapa', tipo: 'Texto', obrig: true,  ex: 'Instalação de fancoils', desc: 'Título da etapa' },
    { col: 'Responsável', tipo: 'Texto', obrig: false, ex: 'João Silva', desc: 'Nome do responsável' },
    { col: 'Início', tipo: 'Data', obrig: false, ex: '01/07/2025', desc: 'Data de início (dd/mm/aaaa)' },
    { col: 'Fim', tipo: 'Data', obrig: false, ex: '15/07/2025', desc: 'Data de término (dd/mm/aaaa)' },
    { col: 'Progresso', tipo: 'Número', obrig: false, ex: '50', desc: 'Percentual concluído (0–100)' },
    { col: 'Cor', tipo: 'Texto', obrig: false, ex: '#4F7CFF', desc: 'Cor hex para o Gantt (opcional)' },
  ]

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center">
              <FileSpreadsheet size={16} className="text-[#4F7CFF]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#0F172A] text-sm">Importar Cronograma via Excel</h2>
              <p className="text-[11px] text-[#64748B]">Monte sua planilha seguindo a estrutura abaixo</p>
            </div>
          </div>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Estrutura da planilha */}
          <div>
            <h3 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide mb-3">Colunas da planilha</h3>
            <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <th className="text-left px-3 py-2.5 font-semibold text-[#64748B]">Coluna</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-[#64748B]">Tipo</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-[#64748B] hidden sm:table-cell">Obrigatório</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-[#64748B] hidden md:table-cell">Exemplo</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-[#64748B]">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {colunas.map((c, i) => (
                    <tr key={c.col} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFF]'}>
                      <td className="px-3 py-2.5">
                        <span className="font-mono font-semibold text-[#4F7CFF] bg-[#EEF2FF] px-1.5 py-0.5 rounded">{c.col}</span>
                      </td>
                      <td className="px-3 py-2.5 text-[#64748B]">{c.tipo}</td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        {c.obrig
                          ? <span className="text-red-500 font-semibold">Sim</span>
                          : <span className="text-[#94A3B8]">Não</span>}
                      </td>
                      <td className="px-3 py-2.5 text-[#64748B] font-mono hidden md:table-cell">{c.ex}</td>
                      <td className="px-3 py-2.5 text-[#64748B]">{c.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Exemplo visual */}
          <div>
            <h3 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide mb-3">Exemplo de planilha</h3>
            <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl">
              <table className="text-[11px] font-mono whitespace-nowrap">
                <thead>
                  <tr className="bg-[#4F7CFF] text-white">
                    {['Item','Etapa','Responsável','Início','Fim','Progresso','Cor'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#F1F5F9]">
                  {[
                    ['1','Fundação e Estrutura','Carlos','01/07/2025','31/07/2025','100','#10B981'],
                    ['1.1','Escavação','Carlos','01/07/2025','10/07/2025','100','#10B981'],
                    ['1.2','Concretagem','Maria','11/07/2025','31/07/2025','100','#10B981'],
                    ['2','Instalações HVAC','João','01/08/2025','30/09/2025','40','#4F7CFF'],
                    ['2.1','Instalação de dutos','João','01/08/2025','20/08/2025','80','#4F7CFF'],
                    ['2.2','Fancoils e UTAs','Pedro','21/08/2025','30/09/2025','10','#4F7CFF'],
                  ].map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? '' : 'bg-[#FAFBFF]'}>
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-1.5 text-[#374151]">
                          {j === 6 ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded-full" style={{ background: cell }} />
                              {cell}
                            </span>
                          ) : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dicas */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
            <p className="text-xs font-semibold text-amber-800">Dicas importantes</p>
            <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
              <li>A primeira linha deve ser o cabeçalho com os nomes das colunas exatamente como mostrado.</li>
              <li>Datas no formato <strong>dd/mm/aaaa</strong> ou datas nativas do Excel (ambos são aceitos).</li>
              <li>Linhas com coluna <strong>Item</strong> sem ponto (ex: <code>1</code>, <code>2</code>) são tratadas como <strong>grupos</strong> no Gantt.</li>
              <li>A coluna <strong>Cor</strong> é opcional — se omitida, será usada a cor padrão azul.</li>
              <li>Formatos aceitos: <strong>.xlsx</strong>, <strong>.xls</strong> e <strong>.csv</strong>.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-between shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#64748B] hover:bg-[#F1F5F9] rounded-lg transition-colors">
            Cancelar
          </button>
          <label className={`btn-primary cursor-pointer ${importando ? 'opacity-60 pointer-events-none' : ''}`}>
            {importando ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            {importando ? 'Importando...' : 'Selecionar arquivo e importar'}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
              ref={inputRef}
              onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} />
          </label>
        </div>
      </div>
    </div>
  )
}

function ModalEtapa({ obraId, ordem, etapa, onClose, onSaved }: {
  obraId: string; ordem: number; etapa: CronogramaEtapa | null; onClose: () => void; onSaved: () => void
}) {
  const editing = !!etapa
  const [titulo, setTitulo] = useState(etapa?.titulo ?? '')
  const [numeroItem, setNumeroItem] = useState(etapa?.numero_item ?? '')
  const [responsavel, setResponsavel] = useState(etapa?.responsavel ?? '')
  const [dataInicio, setDataInicio] = useState(etapa?.data_inicio ?? '')
  const [dataFim, setDataFim] = useState(etapa?.data_fim ?? '')
  const [progresso, setProgresso] = useState(etapa?.progresso ?? 0)
  const [status, setStatus] = useState<StatusEtapa>(etapa?.status ?? 'Pendente')
  const [cor, setCor] = useState(etapa?.cor ?? '#4F7CFF')
  const [loading, setLoading] = useState(false)

  const STATUS_OPS: StatusEtapa[] = ['Pendente', 'Em Andamento', 'Concluída', 'Atrasada']
  const STATUS_CLS: Record<StatusEtapa, string> = {
    'Pendente': 'bg-slate-100 text-slate-600',
    'Em Andamento': 'bg-blue-50 text-blue-700',
    'Concluída': 'bg-emerald-50 text-emerald-700',
    'Atrasada': 'bg-red-50 text-red-600',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return
    setLoading(true)
    const supabase = createClient()
    const payload = {
      obra_id: obraId,
      titulo: titulo.trim(),
      numero_item: numeroItem.trim() || null,
      responsavel: responsavel.trim() || null,
      data_inicio: dataInicio || null,
      data_fim: dataFim || null,
      progresso,
      status,
      cor,
      ordem: etapa?.ordem ?? ordem,
    }
    if (editing) {
      await supabase.from('cronograma_etapas').update(payload).eq('id', etapa!.id)
    } else {
      await supabase.from('cronograma_etapas').insert(payload)
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-semibold text-[#0F172A]">{editing ? 'Editar Etapa' : 'Nova Etapa'}</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Item</label>
              <input className="field font-mono" value={numeroItem} onChange={e => setNumeroItem(e.target.value)} placeholder="1.1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Título *</label>
              <input required className="field" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Instalação de fancoils" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Responsável</label>
              <input className="field" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Status</label>
              <select className="field" value={status} onChange={e => setStatus(e.target.value as StatusEtapa)}>
                {STATUS_OPS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Data Início</label>
              <input type="date" className="field" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Data Fim</label>
              <input type="date" className="field" value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Progresso — {progresso}%</label>
            <input type="range" min={0} max={100} step={5} value={progresso}
              onChange={e => {
                const v = Number(e.target.value)
                setProgresso(v)
                if (v === 100) setStatus('Concluída')
                else if (v > 0) setStatus('Em Andamento')
                else setStatus('Pendente')
              }}
              className="w-full accent-[#4F7CFF] h-1.5" />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-2">Cor no Gantt</label>
            <div className="flex gap-2 flex-wrap">
              {GANTT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setCor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{
                    background: c,
                    borderColor: cor === c ? '#0F172A' : 'transparent',
                    boxShadow: cor === c ? '0 0 0 2px white, 0 0 0 4px ' + c : 'none',
                  }}
                />
              ))}
              <div className="flex items-center gap-1.5 ml-1">
                <span className="text-xs text-[#94A3B8]">ou</span>
                <input type="color" value={cor} onChange={e => setCor(e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border border-[#E2E8F0]" title="Cor personalizada" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-[#E2E8F0]">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Adicionar Etapa'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalAddDoc({ obraId, pastaInicialId, pastas, onClose, onCreated }: {
  obraId: string; pastaInicialId: string | null; pastas: DocPasta[]; onClose: () => void; onCreated: () => void
}) {
  const [pastaId, setPastaId] = useState<string>(pastaInicialId ?? '')
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
        pasta: pastaId || null,
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
              <select className="field" value={pastaId} onChange={e => setPastaId(e.target.value)}>
                <option value="">— Sem pasta —</option>
                {pastas.filter(p => !p.parent_id).map(p => (
                  <optgroup key={p.id} label={p.nome}>
                    <option value={p.id}>{p.nome}</option>
                    {pastas.filter(s => s.parent_id === p.id).map(s => (
                      <option key={s.id} value={s.id}>{'  ↳ ' + s.nome}</option>
                    ))}
                  </optgroup>
                ))}
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
function getExtInfo(nome: string, url?: string): { ext: string; bg: string; text: string } {
  const src = url || nome
  const ext = (src.split('.').pop() || '').toLowerCase().split('?')[0]
  const map: Record<string, { bg: string; text: string }> = {
    pdf:  { bg: 'bg-red-50',    text: 'text-red-600' },
    dwg:  { bg: 'bg-orange-50', text: 'text-orange-600' },
    dxf:  { bg: 'bg-orange-50', text: 'text-orange-600' },
    xlsx: { bg: 'bg-emerald-50',text: 'text-emerald-700' },
    xls:  { bg: 'bg-emerald-50',text: 'text-emerald-700' },
    csv:  { bg: 'bg-emerald-50',text: 'text-emerald-700' },
    docx: { bg: 'bg-blue-50',   text: 'text-blue-700' },
    doc:  { bg: 'bg-blue-50',   text: 'text-blue-700' },
    pptx: { bg: 'bg-amber-50',  text: 'text-amber-700' },
    ppt:  { bg: 'bg-amber-50',  text: 'text-amber-700' },
    jpg:  { bg: 'bg-purple-50', text: 'text-purple-700' },
    jpeg: { bg: 'bg-purple-50', text: 'text-purple-700' },
    png:  { bg: 'bg-purple-50', text: 'text-purple-700' },
    zip:  { bg: 'bg-slate-100', text: 'text-slate-600' },
    rar:  { bg: 'bg-slate-100', text: 'text-slate-600' },
  }
  return { ext: ext || '—', ...(map[ext] ?? { bg: 'bg-gray-100', text: 'text-gray-500' }) }
}

function DocTable({ docs, onDelete }: { docs: Documento[]; onDelete: (id: string, path?: string) => void }) {
  const categoriaConfig: Record<string, { bg: string; text: string }> = {
    Financeiro: { bg: 'bg-blue-50', text: 'text-blue-700' },
    Técnico: { bg: 'bg-teal-50', text: 'text-teal-700' },
    Jurídico: { bg: 'bg-purple-50', text: 'text-purple-700' },
    Outros: { bg: 'bg-gray-100', text: 'text-gray-600' },
  }
  return (
    <>
      <div className="divide-y divide-[#E2E8F0] md:hidden">
        {docs.map(doc => {
          const cat = categoriaConfig[doc.categoria] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
          const fmt = getExtInfo(doc.nome, doc.arquivo_url)
          return (
            <article key={doc.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#F1F5F9] rounded-xl flex items-center justify-center shrink-0">
                  <FileText size={17} className="text-[#64748B]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm text-[#0F172A] font-semibold leading-5 break-words">{doc.nome}</h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${fmt.bg} ${fmt.text} uppercase tracking-wide`}>{fmt.ext}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cat.bg} ${cat.text}`}>{doc.categoria}</span>
                  </div>
                  {(doc.fornecedor || doc.data_documento) && (
                    <p className="text-xs text-[#64748B] mt-2">
                      {[doc.fornecedor, doc.data_documento ? new Date(doc.data_documento + 'T00:00:00').toLocaleDateString('pt-BR') : null].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pl-[52px]">
                {doc.arquivo_url && (
                  <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer" className="min-h-10 flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#EEF2FF] text-xs font-semibold text-[#4F7CFF]">
                    <ExternalLink size={13} /> Abrir documento
                  </a>
                )}
                <button
                  type="button"
                  aria-label={`Excluir ${doc.nome}`}
                  onClick={() => onDelete(doc.id, doc.arquivo_path)}
                  className="w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-lg border border-red-100 text-red-500"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          )
        })}
      </div>

      <table className="hidden md:table w-full">
      <thead>
        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Nome</th>
          <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Formato</th>
          <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Categoria</th>
          <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Fornecedor</th>
          <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Data</th>
          <th className="text-center text-xs font-semibold text-[#64748B] px-4 py-2.5">Ações</th>
        </tr>
      </thead>
      <tbody>
        {docs.map(doc => {
          const cat = categoriaConfig[doc.categoria] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
          const fmt = getExtInfo(doc.nome, doc.arquivo_url)
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
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${fmt.bg} ${fmt.text} uppercase tracking-wide`}>{fmt.ext}</span>
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
    </>
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

// ── MateriaisLista ────────────────────────────────────
function MateriaisLista({ materiais, onEdit, onDelete, onEditGrupo }: {
  materiais: ObraMaterial[]
  onEdit: (m: ObraMaterial) => void
  onDelete: (m: ObraMaterial) => void
  onEditGrupo: (itens: ObraMaterial[]) => void
}) {
  // Separar materiais com orçamento (agrupados) dos avulsos
  const comOrc = materiais.filter(m => m.nota_fiscal_url)
  const semOrc = materiais.filter(m => !m.nota_fiscal_url)

  // Agrupar por nota_fiscal_url (url do orçamento)
  const grupos = new Map<string, ObraMaterial[]>()
  for (const m of comOrc) {
    const key = m.nota_fiscal_url!
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(m)
  }

  return (
    <div className="space-y-3">
      {Array.from(grupos.entries()).map(([url, itens]) => (
        <OrcamentoCard key={url} itens={itens} orcamentoUrl={url} onEdit={onEdit} onDelete={onDelete} onEditGrupo={onEditGrupo} />
      ))}
      {semOrc.map(m => (
        <MaterialCard key={m.id} material={m} onEdit={() => onEdit(m)} onDelete={() => onDelete(m)} />
      ))}
    </div>
  )
}

// ── OrcamentoCard ─────────────────────────────────────
function OrcamentoCard({ itens, orcamentoUrl, onEdit, onDelete, onEditGrupo }: {
  itens: ObraMaterial[]
  orcamentoUrl: string
  onEdit: (m: ObraMaterial) => void
  onDelete: (m: ObraMaterial) => void
  onEditGrupo: (itens: ObraMaterial[]) => void
}) {
  const [aberto, setAberto] = useState(true)
  const fmt = (d?: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
  const fmtMoeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const ref = itens[0]
  const totalItens = itens.reduce((s, m) => s + (m.valor_total ?? 0), 0)
  const custosExtras = (ref.custos_extras ?? []) as { descricao: string; valor: number }[]
  const totalExtras = custosExtras.reduce((s, c) => s + c.valor, 0)
  const totalOrc = totalItens + totalExtras
  const orcNumero = ref.observacoes?.match(/NF:\s*([^\s|]+)/)?.[1]
  const nfPagamentoUrl = itens.find(m => m.nf_pagamento_url)?.nf_pagamento_url

  return (
    <div className="card p-0 overflow-hidden">
      {/* Cabeçalho do Orçamento */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-4 sm:py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${ref.tipo_compra === 'cliente' ? 'bg-purple-50' : 'bg-blue-50'}`}>
            <FileText size={15} className={ref.tipo_compra === 'cliente' ? 'text-purple-600' : 'text-blue-600'} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-syne font-semibold text-sm text-[#0F172A]">
                {orcNumero ? `Orçamento ${orcNumero}` : 'Orçamento'}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ref.tipo_compra === 'cliente' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                {ref.tipo_compra === 'cliente' ? 'Compra Cliente' : 'Compra Interna'}
              </span>
              <span className="text-[10px] text-[#94A3B8]">{itens.length} ite{itens.length === 1 ? 'm' : 'ns'}</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-[#64748B] flex-wrap">
              {ref.fornecedor && <span>{ref.fornecedor}</span>}
              {ref.data_compra && <span>· {fmt(ref.data_compra)}</span>}
              {ref.comprador && <span>· {ref.comprador}</span>}
              {ref.numero_oc && <span>· OC: {ref.numero_oc}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 sm:ml-3 pl-11 sm:pl-0">
          <span className="font-syne font-bold text-sm text-[#0F172A] mr-auto sm:mr-1">{fmtMoeda(totalOrc)}</span>
          <a href={orcamentoUrl} target="_blank" rel="noopener noreferrer"
            className="min-h-9 flex items-center gap-1 text-xs font-medium text-[#4F7CFF] bg-[#EEF2FF] px-3 py-1 rounded-lg hover:bg-[#dce8ff] transition-colors">
            <ExternalLink size={11} /> Ver Orçamento
          </a>
          {nfPagamentoUrl && (
            <a href={nfPagamentoUrl} target="_blank" rel="noopener noreferrer"
              className="min-h-9 flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg hover:bg-emerald-100 transition-colors">
              <ExternalLink size={11} /> Ver NF
            </a>
          )}
          <button aria-label="Editar orçamento" onClick={() => onEditGrupo(itens)} className="w-9 h-9 flex items-center justify-center text-[#94A3B8] hover:text-[#4F7CFF] transition-colors">
            <Pencil size={15} />
          </button>
          <button aria-label={aberto ? 'Recolher itens' : 'Mostrar itens'} onClick={() => setAberto(a => !a)} className="w-9 h-9 flex items-center justify-center text-[#94A3B8] hover:text-[#4F7CFF] transition-colors">
            {aberto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      {/* Tabela de itens */}
      {aberto && (
        <>
          <div className="divide-y divide-[#E2E8F0] md:hidden">
            {itens.map(m => {
              const st = STATUS_MATERIAL[m.status] ?? STATUS_MATERIAL.pendente
              return (
                <article key={m.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold leading-5 text-[#0F172A] break-words">{m.descricao}</h3>
                      <span className={`inline-flex mt-2 text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button aria-label={`Editar ${m.descricao}`} onClick={() => onEdit(m)} className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#EEF2FF] text-[#4F7CFF]"><Pencil size={14} /></button>
                      <button aria-label={`Excluir ${m.descricao}`} onClick={() => onDelete(m)} className="w-10 h-10 flex items-center justify-center rounded-lg bg-red-50 text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4 text-xs">
                    <div><span className="block text-[#94A3B8]">Quantidade</span><span className="font-medium text-[#374151]">{m.quantidade != null ? `${m.quantidade} ${m.unidade ?? ''}` : '—'}</span></div>
                    <div><span className="block text-[#94A3B8]">Valor unitário</span><span className="font-medium text-[#374151]">{m.valor_unitario != null ? fmtMoeda(m.valor_unitario) : '—'}</span></div>
                    <div><span className="block text-[#94A3B8]">Valor total</span><span className="font-semibold text-[#0F172A]">{m.valor_total != null ? fmtMoeda(m.valor_total) : '—'}</span></div>
                    <div><span className="block text-[#94A3B8]">Chegada</span><span className="font-medium text-[#374151]">{m.data_chegada ? fmt(m.data_chegada) : m.data_prevista_chegada ? `Prev. ${fmt(m.data_prevista_chegada)}` : '—'}</span></div>
                  </div>
                </article>
              )
            })}
          </div>
          <table className="hidden md:table w-full">
          <thead>
            <tr className="border-b border-[#F1F5F9]">
              <th className="text-left text-xs font-semibold text-[#94A3B8] px-4 py-2">Descrição</th>
              <th className="text-left text-xs font-semibold text-[#94A3B8] px-3 py-2">Status</th>
              <th className="text-left text-xs font-semibold text-[#94A3B8] px-3 py-2">Qtd</th>
              <th className="text-left text-xs font-semibold text-[#94A3B8] px-3 py-2">Vl. Unit.</th>
              <th className="text-left text-xs font-semibold text-[#94A3B8] px-3 py-2">Total</th>
              <th className="text-left text-xs font-semibold text-[#94A3B8] px-3 py-2">Chegada</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {itens.map(m => {
              const st = STATUS_MATERIAL[m.status] ?? STATUS_MATERIAL.pendente
              return (
                <tr key={m.id} className="border-b border-[#F8FAFC] hover:bg-[#F8FAFC] transition-colors group">
                  <td className="px-4 py-2.5 text-sm font-medium text-[#0F172A] max-w-xs">{m.descricao}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-[#374151]">{m.quantidade != null ? `${m.quantidade} ${m.unidade ?? ''}` : '—'}</td>
                  <td className="px-3 py-2.5 text-sm text-[#374151]">{m.valor_unitario != null ? fmtMoeda(m.valor_unitario) : '—'}</td>
                  <td className="px-3 py-2.5 text-sm font-medium text-[#0F172A]">{m.valor_total != null ? fmtMoeda(m.valor_total) : '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-[#64748B]">{m.data_chegada ? fmt(m.data_chegada) : m.data_prevista_chegada ? `prev. ${fmt(m.data_prevista_chegada)}` : '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEdit(m)} className="text-[#94A3B8] hover:text-[#4F7CFF] p-1 rounded hover:bg-[#EEF2FF] transition-colors"><Pencil size={12} /></button>
                      <button onClick={() => onDelete(m)} className="text-[#94A3B8] hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {(custosExtras.length > 0) && (
            <tfoot>
              {custosExtras.map((c, i) => (
                <tr key={i} className="border-t border-[#F1F5F9] bg-[#FAFAFA]">
                  <td colSpan={4} className="px-4 py-2 text-xs text-[#64748B] italic">{c.descricao}</td>
                  <td className="px-3 py-2 text-xs font-medium text-[#64748B]">{fmtMoeda(c.valor)}</td>
                  <td colSpan={2} />
                </tr>
              ))}
              <tr className="border-t-2 border-[#E2E8F0] bg-[#F8FAFC]">
                <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-[#374151]">Total com extras</td>
                <td className="px-3 py-2.5 text-sm font-bold text-[#0F172A]">{fmtMoeda(totalOrc)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
          </table>
        </>
      )}
    </div>
  )
}

// ── GanttView ─────────────────────────────────────────
const GANTT_COLORS = [
  '#4F7CFF','#10B981','#F59E0B','#EF4444','#8B5CF6',
  '#06B6D4','#F97316','#EC4899','#6B7280','#0F172A',
]

function GanttView({ etapas, onEdit, onDelete, onDeleteMany, onProgressUpdate }: {
  etapas: CronogramaEtapa[]
  onEdit: (e: CronogramaEtapa) => void
  onDelete: (id: string) => void
  onDeleteMany: (ids: string[]) => void
  onProgressUpdate: () => void
}) {
  const [dayW, setDayW] = useState(22)
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())

  function toggleSel(id: string) {
    setSelecionadas(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  function toggleAll() {
    setSelecionadas(prev => prev.size === etapas.length ? new Set() : new Set(etapas.map(e => e.id)))
  }
  function excluirSelecionadas() {
    if (!confirm(`Excluir ${selecionadas.size} etapa${selecionadas.size > 1 ? 's' : ''} selecionada${selecionadas.size > 1 ? 's' : ''}?`)) return
    onDeleteMany(Array.from(selecionadas))
    setSelecionadas(new Set())
  }

  const fmt = (d?: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'
  const fmtFull = (d?: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

  const withDates = etapas.filter(e => e.data_inicio && e.data_fim)
  const hasGantt = withDates.length > 0

  let minDate = new Date(), maxDate = new Date()
  let totalDays = 30
  let months: Date[] = []

  if (hasGantt) {
    minDate = new Date(Math.min(...withDates.map(e => new Date(e.data_inicio! + 'T00:00:00').getTime())))
    maxDate = new Date(Math.max(...withDates.map(e => new Date(e.data_fim! + 'T00:00:00').getTime())))
    minDate.setDate(minDate.getDate() - 3)
    maxDate.setDate(maxDate.getDate() + 7)
    totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000) + 1
    const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
    while (cur <= maxDate) { months.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1) }
  }

  const today = new Date()
  const todayLeft = hasGantt ? Math.floor((today.getTime() - minDate.getTime()) / 86400000) * dayW : -1

  function barStyle(e: CronogramaEtapa) {
    if (!e.data_inicio || !e.data_fim) return null
    const s = new Date(e.data_inicio + 'T00:00:00')
    const en = new Date(e.data_fim + 'T00:00:00')
    const left = Math.floor((s.getTime() - minDate.getTime()) / 86400000) * dayW
    const w = Math.max(dayW, Math.ceil((en.getTime() - s.getTime()) / 86400000) * dayW)
    return { left, width: w }
  }

  function monthWidth(m: Date) {
    const y = m.getFullYear(), mo = m.getMonth()
    const start = new Date(Math.max(minDate.getTime(), new Date(y, mo, 1).getTime()))
    const end = new Date(Math.min(maxDate.getTime(), new Date(y, mo + 1, 0).getTime()))
    return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1) * dayW
  }

  // Determinar se uma linha é grupo (numero_item sem ponto, ex: "1", "2") ou subitem ("1.1", "1.2")
  function isGroup(e: CronogramaEtapa) {
    if (!e.numero_item) return false
    return !e.numero_item.includes('.')
  }

  const CHK_W = 36
  const ITEM_W = 56
  const LEFT_W = CHK_W + ITEM_W + 220 + 100 + 80 + 70 + 48 + 56
  const ROW_H = 38

  return (
    <div className="card p-0 overflow-hidden">
      {/* Zoom toolbar */}
      {hasGantt && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[#E2E8F0] bg-[#FAFBFF]">
          <span className="text-[11px] text-[#64748B] font-medium">Zoom do Gantt</span>
          <button onClick={() => setDayW(d => Math.max(8, d - 4))}
            className="w-6 h-6 flex items-center justify-center rounded border border-[#E2E8F0] hover:bg-[#EEF2FF] text-[#64748B] hover:text-[#4F7CFF] text-sm font-bold transition-colors">−</button>
          <input type="range" min={8} max={48} step={2} value={dayW}
            onChange={e => setDayW(Number(e.target.value))}
            className="w-28 accent-[#4F7CFF] h-1" />
          <button onClick={() => setDayW(d => Math.min(48, d + 4))}
            className="w-6 h-6 flex items-center justify-center rounded border border-[#E2E8F0] hover:bg-[#EEF2FF] text-[#64748B] hover:text-[#4F7CFF] text-sm font-bold transition-colors">+</button>
          <span className="text-[10px] text-[#94A3B8]">{dayW}px/dia</span>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-4 h-px bg-red-400" />
            <span className="text-[10px] text-[#94A3B8]">Hoje — {today.toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
      )}

      {/* Barra de seleção múltipla */}
      {selecionadas.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#EEF2FF] border-b border-[#C7D2FE]">
          <span className="text-sm font-medium text-[#4F7CFF]">{selecionadas.size} etapa{selecionadas.size > 1 ? 's' : ''} selecionada{selecionadas.size > 1 ? 's' : ''}</span>
          <button onClick={excluirSelecionadas}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors">
            <Trash2 size={12} /> Excluir selecionadas
          </button>
          <button onClick={() => setSelecionadas(new Set())}
            className="ml-auto text-xs text-[#64748B] hover:text-[#0F172A] transition-colors">
            Cancelar seleção
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <div style={{ minWidth: LEFT_W + (hasGantt ? totalDays * dayW : 0) }}>

          {/* ── Header linha 1: colunas esq + meses ── */}
          <div className="flex border-b border-[#E2E8F0] bg-[#F8FAFC]" style={{ height: 28 }}>
            <div className="shrink-0 flex items-center border-r border-[#E2E8F0]" style={{ width: LEFT_W }}>
              <div className="flex items-center justify-center shrink-0" style={{ width: CHK_W }}>
                <input type="checkbox"
                  checked={selecionadas.size === etapas.length && etapas.length > 0}
                  ref={el => { if (el) el.indeterminate = selecionadas.size > 0 && selecionadas.size < etapas.length }}
                  onChange={toggleAll}
                  className="w-3.5 h-3.5 accent-[#4F7CFF] cursor-pointer" />
              </div>
              <span className="text-[11px] font-semibold text-[#64748B] px-2 shrink-0" style={{ width: ITEM_W }}>Item</span>
              <span className="text-[11px] font-semibold text-[#64748B] px-2" style={{ width: 220 }}>Etapa</span>
              <span className="text-[11px] font-semibold text-[#64748B] px-2" style={{ width: 100 }}>Responsável</span>
              <span className="text-[11px] font-semibold text-[#64748B] px-2" style={{ width: 80 }}>Início</span>
              <span className="text-[11px] font-semibold text-[#64748B] px-2" style={{ width: 70 }}>Fim</span>
              <span className="text-[11px] font-semibold text-[#64748B] px-2 text-center" style={{ width: 48 }}>%</span>
              <span style={{ width: 56 }} />
            </div>
            {hasGantt && (
              <div className="flex" style={{ width: totalDays * dayW }}>
                {months.map((m, i) => {
                  const w = monthWidth(m)
                  if (w <= 0) return null
                  return (
                    <div key={i} className="border-r border-[#E2E8F0] flex items-center justify-center shrink-0 bg-[#F1F5F9]" style={{ width: w }}>
                      <span className="text-[11px] font-bold text-[#475569]">
                        {m.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Header linha 2: dias ── */}
          {hasGantt && (
            <div className="flex border-b border-[#E2E8F0] bg-[#F8FAFC]" style={{ height: 22 }}>
              <div className="shrink-0 border-r border-[#E2E8F0]" style={{ width: LEFT_W }} />
              <div className="flex relative" style={{ width: totalDays * dayW }}>
                {Array.from({ length: totalDays }, (_, i) => {
                  const d = new Date(minDate.getTime() + i * 86400000)
                  const dom = d.getDate()
                  const dow = d.getDay() // 0=dom, 6=sab
                  const isWeekend = dow === 0 || dow === 6
                  const isToday = d.toDateString() === today.toDateString()
                  const showLabel = dayW >= 14 || dom === 1 || dom === 5 || dom === 10 || dom === 15 || dom === 20 || dom === 25
                  return (
                    <div key={i}
                      className={`shrink-0 flex items-center justify-center border-r border-[#F1F5F9] ${isWeekend ? 'bg-[#F8FAFC]' : ''} ${isToday ? 'bg-[#EEF2FF]' : ''}`}
                      style={{ width: dayW }}>
                      {showLabel && (
                        <span className={`text-[9px] font-medium select-none ${isToday ? 'text-[#4F7CFF] font-bold' : isWeekend ? 'text-[#CBD5E1]' : 'text-[#94A3B8]'}`}>
                          {dom}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Rows ── */}
          {etapas.map(etapa => {
            const bar = hasGantt ? barStyle(etapa) : null
            const cor = etapa.cor || '#4F7CFF'
            const grupo = isGroup(etapa)
            const subitem = !!etapa.numero_item && etapa.numero_item.includes('.')
            const st = etapa.status === 'Concluída' ? 'bg-emerald-50 text-emerald-700'
              : etapa.status === 'Em Andamento' ? 'bg-blue-50 text-blue-700'
              : etapa.status === 'Atrasada' ? 'bg-red-50 text-red-600'
              : 'bg-slate-100 text-slate-600'

            return (
              <div key={etapa.id}
                className={`flex border-b group transition-colors ${grupo ? 'bg-[#F8FAFC] hover:bg-[#F1F5F9]' : 'hover:bg-[#FAFBFF]'}`}
                style={{ height: grupo ? ROW_H + 4 : ROW_H, borderColor: grupo ? '#E2E8F0' : '#F1F5F9' }}>

                {/* Left cells */}
                <div className="shrink-0 flex items-center border-r border-[#E2E8F0]" style={{ width: LEFT_W }}>
                  {/* Checkbox */}
                  <div className="flex items-center justify-center shrink-0" style={{ width: CHK_W }}>
                    <input type="checkbox"
                      checked={selecionadas.has(etapa.id)}
                      onChange={() => toggleSel(etapa.id)}
                      className="w-3.5 h-3.5 accent-[#4F7CFF] cursor-pointer" />
                  </div>
                  {/* Item número + cor dot */}
                  <div className="flex items-center gap-1.5 px-2 shrink-0" style={{ width: ITEM_W }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cor }} />
                    <span className={`text-[11px] font-mono shrink-0 ${grupo ? 'font-bold text-[#0F172A]' : 'text-[#64748B]'}`}>
                      {etapa.numero_item || ''}
                    </span>
                  </div>
                  {/* Title */}
                  <div className="flex items-center gap-1.5 px-2 min-w-0" style={{ width: 220 }}>
                    <span className={`text-xs truncate ${grupo ? 'font-bold text-[#0F172A]' : subitem ? 'text-[#374151] pl-2' : 'font-medium text-[#0F172A]'}`}>
                      {etapa.titulo}
                    </span>
                    {!grupo && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${st}`}>{etapa.status}</span>
                    )}
                    {grupo && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${st}`}>{etapa.status}</span>
                    )}
                  </div>
                  <span className="text-xs text-[#64748B] px-2 truncate" style={{ width: 100 }}>{etapa.responsavel || '—'}</span>
                  <span className="text-xs text-[#64748B] px-2" style={{ width: 80 }}>{fmt(etapa.data_inicio)}</span>
                  <span className="text-xs text-[#64748B] px-2" style={{ width: 70 }}>{fmt(etapa.data_fim)}</span>
                  <span className={`text-xs font-semibold px-2 text-center ${grupo ? 'text-[#0F172A]' : 'text-[#4F7CFF]'}`} style={{ width: 48 }}>{etapa.progresso}%</span>
                  <div className="flex items-center gap-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ width: 56 }}>
                    <button onClick={() => onEdit(etapa)} className="p-1 rounded hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#4F7CFF] transition-colors"><Pencil size={12} /></button>
                    <button onClick={() => onDelete(etapa.id)} className="p-1 rounded hover:bg-red-50 text-[#94A3B8] hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                  </div>
                </div>

                {/* Gantt area */}
                {hasGantt && (
                  <div className="relative" style={{ width: totalDays * dayW }}>
                    {todayLeft >= 0 && todayLeft <= totalDays * dayW && (
                      <div className="absolute top-0 bottom-0 w-px bg-red-400 z-10 opacity-60" style={{ left: todayLeft }} />
                    )}
                    {bar && (
                      <div className="absolute rounded-md overflow-hidden"
                        style={{
                          left: bar.left + 2, width: bar.width - 4,
                          top: grupo ? 10 : 8, height: (grupo ? ROW_H + 4 : ROW_H) - (grupo ? 20 : 16),
                          background: cor + (grupo ? '25' : '22'),
                          border: `${grupo ? 2 : 1.5}px solid ${cor}${grupo ? '' : 'AA'}`,
                        }}
                        title={`${etapa.titulo}: ${fmtFull(etapa.data_inicio)} – ${fmtFull(etapa.data_fim)} (${etapa.progresso}%)`}
                      >
                        <div className="h-full rounded-md" style={{ width: `${etapa.progresso}%`, background: cor + (grupo ? 'AA' : '88') }} />
                        {bar.width > 60 && (
                          <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold truncate" style={{ color: cor }}>
                            {etapa.progresso > 0 ? `${etapa.progresso}%` : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
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
        {m.valor_total != null && <div><span className="text-[#94A3B8] block">Custo total</span><span className="font-medium text-red-600">{fmtMoeda(m.valor_total)}</span></div>}
        {m.valor_venda_total != null && <div><span className="text-[#94A3B8] block">Venda total</span><span className="font-medium text-emerald-600">{fmtMoeda(m.valor_venda_total)}</span></div>}
        {m.numero_oc && <div><span className="text-[#94A3B8] block">OC</span><span className="font-medium text-[#374151]">{m.numero_oc}</span></div>}
      </div>

      {m.valor_total != null && m.valor_venda_total != null && (
        <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
          <span className="text-xs text-[#64748B]">Margem</span>
          <div className="flex items-center gap-2">
            {(() => {
              const margem = m.valor_venda_total - m.valor_total
              const pct = m.valor_total > 0 ? (margem / m.valor_total * 100).toFixed(1) : null
              return (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${margem >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {fmtMoeda(margem)} {pct ? `(${pct}%)` : ''}
                </span>
              )
            })()}
          </div>
        </div>
      )}

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

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><label className="block text-xs font-medium text-[#64748B] mb-1">{label}</label>{children}</div>
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
  const [precoVendaUnitario, setPrecoVendaUnitario] = useState(material?.preco_venda_unitario != null ? String(material.preco_venda_unitario) : '')
  const [valorVendaTotal, setValorVendaTotal] = useState(material?.valor_venda_total != null ? String(material.valor_venda_total) : '')
  const [numeroOC, setNumeroOC] = useState(material?.numero_oc ?? '')
  const [status, setStatus] = useState<ObraMaterial['status']>(material?.status ?? 'pendente')
  const [observacoes, setObservacoes] = useState(material?.observacoes ?? '')
  const [nfUrl, setNfUrl] = useState(material?.nota_fiscal_url ?? '')
  const [nfPath, setNfPath] = useState(material?.nota_fiscal_path ?? '')
  const [nfPagamentoUrl, setNfPagamentoUrl] = useState(material?.nf_pagamento_url ?? '')
  const [nfPagamentoPath, setNfPagamentoPath] = useState(material?.nf_pagamento_path ?? '')
  const [uploadingNf, setUploadingNf] = useState(false)
  const [uploadingNfPag, setUploadingNfPag] = useState(false)
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

  async function uploadNfPagamento(file: File) {
    setUploadingNfPag(true)
    const supabase = createClient()
    const path = `nf-pagamento/${obraId}/${Date.now()}_${file.name}`
    await supabase.storage.from('documentos').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('documentos').getPublicUrl(path)
    setNfPagamentoUrl(data.publicUrl)
    setNfPagamentoPath(path)
    setUploadingNfPag(false)
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
      preco_venda_unitario: precoVendaUnitario ? parseFloat(precoVendaUnitario) : null,
      valor_venda_total: valorVendaTotal ? parseFloat(valorVendaTotal) : null,
      numero_oc: numeroOC.trim() || null,
      status,
      nota_fiscal_url: nfUrl || null,
      nota_fiscal_path: nfPath || null,
      nf_pagamento_url: nfPagamentoUrl || null,
      nf_pagamento_path: nfPagamentoPath || null,
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

          <F label="Valor total de custo (R$)">
            <input type="number" step="any" min="0" className="field" value={valorTotal} onChange={e => setValorTotal(e.target.value)} placeholder="Calculado automaticamente ou preencha manualmente" />
          </F>

          {/* Preço de venda (OC do cliente) */}
          {tipCompra === 'interna' && (
            <div className="border border-purple-100 bg-purple-50/50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-purple-700">Preço de Venda — OC do Cliente</p>
              <F label="Nº da OC">
                <input className="field" value={numeroOC} onChange={e => setNumeroOC(e.target.value)} placeholder="Ex: OC-2024-0042" />
              </F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Preço venda unitário (R$)">
                  <input type="number" step="any" min="0" className="field" value={precoVendaUnitario}
                    onChange={e => {
                      setPrecoVendaUnitario(e.target.value)
                      if (quantidade && e.target.value) setValorVendaTotal(String((parseFloat(quantidade) * parseFloat(e.target.value)).toFixed(2)))
                    }} placeholder="0,00" />
                </F>
                <F label="Total de venda (R$)">
                  <input type="number" step="any" min="0" className="field" value={valorVendaTotal} onChange={e => setValorVendaTotal(e.target.value)} placeholder="0,00" />
                </F>
              </div>
              {valorTotal && valorVendaTotal && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-600">Margem estimada:</span>
                  <span className={`font-bold ${parseFloat(valorVendaTotal) - parseFloat(valorTotal) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {(parseFloat(valorVendaTotal) - parseFloat(valorTotal)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    {' '}({valorTotal && valorVendaTotal && parseFloat(valorTotal) > 0
                      ? (((parseFloat(valorVendaTotal) - parseFloat(valorTotal)) / parseFloat(valorTotal)) * 100).toFixed(1) + '%'
                      : '—'})
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Orçamento */}
          <F label="Orçamento (PDF ou imagem)">
            <div className="flex items-center gap-3 flex-wrap">
              {nfUrl && (
                <a href={nfUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-[#4F7CFF] bg-[#EEF2FF] px-3 py-2 rounded-lg">
                  <FileText size={13} /> Ver Orçamento
                </a>
              )}
              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] text-sm text-[#64748B] transition-colors">
                {uploadingNf ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploadingNf ? 'Carregando...' : nfUrl ? 'Trocar Orçamento' : 'Anexar Orçamento'}
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

          {/* NF de Pagamento */}
          <F label="NF de Pagamento (opcional)">
            <div className="flex items-center gap-3 flex-wrap">
              {nfPagamentoUrl && (
                <a href={nfPagamentoUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-[#059669] bg-[#ECFDF5] px-3 py-2 rounded-lg">
                  <FileText size={13} /> Ver NF
                </a>
              )}
              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] text-sm text-[#64748B] transition-colors">
                {uploadingNfPag ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploadingNfPag ? 'Carregando...' : nfPagamentoUrl ? 'Trocar NF' : 'Anexar NF'}
                <input type="file" accept="image/*,.pdf" className="hidden" disabled={uploadingNfPag}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadNfPagamento(f) }} />
              </label>
              {nfPagamentoUrl && <button type="button" onClick={() => { setNfPagamentoUrl(''); setNfPagamentoPath('') }} className="text-[#94A3B8] hover:text-red-500"><X size={14} /></button>}
            </div>
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
            <h2 className="font-syne font-semibold text-[#0F172A]">Importar Orçamento</h2>
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

// ── ModalEditarOrcamento ──────────────────────────────
function ModalEditarOrcamento({ obraId, itens, onClose, onSaved }: {
  obraId: string
  itens: ObraMaterial[]
  onClose: () => void
  onSaved: () => void
}) {
  const ref = itens[0]
  const orcNumero = ref.observacoes?.match(/NF:\s*([^\s|]+)/)?.[1] ?? ''
  const obsExtra = ref.observacoes?.replace(/NF:\s*[^\s|]+\s*\|?\s*/, '').trim() ?? ''

  const [tipCompra, setTipCompra] = useState<'interna' | 'cliente'>(ref.tipo_compra ?? 'interna')
  const [fornecedor, setFornecedor] = useState(ref.fornecedor ?? '')
  const [comprador, setComprador] = useState(ref.comprador ?? '')
  const [dataCompra, setDataCompra] = useState(ref.data_compra ?? '')
  const [numeroOC, setNumeroOC] = useState(ref.numero_oc ?? '')
  const [nfNumero, setNfNumero] = useState(orcNumero)
  const [observacoes, setObservacoes] = useState(obsExtra)
  const [nfUrl, setNfUrl] = useState(ref.nota_fiscal_url ?? '')
  const [nfPath, setNfPath] = useState(ref.nota_fiscal_path ?? '')
  const [nfPagamentoUrl, setNfPagamentoUrl] = useState(itens.find(m => m.nf_pagamento_url)?.nf_pagamento_url ?? '')
  const [nfPagamentoPath, setNfPagamentoPath] = useState(itens.find(m => m.nf_pagamento_path)?.nf_pagamento_path ?? '')
  const [custosExtras, setCustosExtras] = useState<{ descricao: string; valor: string }[]>(
    () => (ref.custos_extras as { descricao: string; valor: number }[] | null)?.map(c => ({ descricao: c.descricao, valor: String(c.valor) })) ?? []
  )
  const [uploadingNf, setUploadingNf] = useState(false)
  const [uploadingNfPag, setUploadingNfPag] = useState(false)
  const [saving, setSaving] = useState(false)

  function addExtra() { setCustosExtras(p => [...p, { descricao: '', valor: '' }]) }
  function removeExtra(i: number) { setCustosExtras(p => p.filter((_, idx) => idx !== i)) }
  function updateExtra(i: number, field: 'descricao' | 'valor', v: string) {
    setCustosExtras(p => p.map((c, idx) => idx === i ? { ...c, [field]: v } : c))
  }

  async function uploadOrc(file: File) {
    setUploadingNf(true)
    const supabase = createClient()
    const path = `nf/${obraId}/${Date.now()}_${file.name}`
    await supabase.storage.from('documentos').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('documentos').getPublicUrl(path)
    setNfUrl(data.publicUrl); setNfPath(path)
    setUploadingNf(false)
  }

  async function uploadNfPag(file: File) {
    setUploadingNfPag(true)
    const supabase = createClient()
    const path = `nf-pagamento/${obraId}/${Date.now()}_${file.name}`
    await supabase.storage.from('documentos').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('documentos').getPublicUrl(path)
    setNfPagamentoUrl(data.publicUrl); setNfPagamentoPath(path)
    setUploadingNfPag(false)
  }

  async function salvar() {
    setSaving(true)
    const supabase = createClient()
    const obs = [nfNumero.trim() ? `NF: ${nfNumero.trim()}` : '', observacoes.trim()].filter(Boolean).join(' | ') || null
    const ids = itens.map(m => m.id)
    const extrasValidos = custosExtras.filter(c => c.descricao.trim() && parseFloat(c.valor) > 0)
    await supabase.from('obra_materiais').update({
      tipo_compra: tipCompra,
      fornecedor: fornecedor.trim() || null,
      comprador: comprador.trim() || null,
      data_compra: dataCompra || null,
      numero_oc: tipCompra === 'interna' && numeroOC.trim() ? numeroOC.trim() : null,
      nota_fiscal_url: nfUrl || null,
      nota_fiscal_path: nfPath || null,
      nf_pagamento_url: nfPagamentoUrl || null,
      nf_pagamento_path: nfPagamentoPath || null,
      observacoes: obs,
      custos_extras: extrasValidos.length > 0 ? extrasValidos.map(c => ({ descricao: c.descricao.trim(), valor: parseFloat(c.valor) })) : null,
    }).in('id', ids)
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="font-syne font-semibold text-[#0F172A]">Editar Orçamento</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Tipo de compra */}
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

          <div className="grid grid-cols-2 gap-3">
            <F label="Número do Orçamento">
              <input className="field" value={nfNumero} onChange={e => setNfNumero(e.target.value)} placeholder="Ex: 000.086.191" />
            </F>
            <F label="Data da compra">
              <input type="date" className="field" value={dataCompra} onChange={e => setDataCompra(e.target.value)} />
            </F>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <F label="Fornecedor">
              <input className="field" value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" />
            </F>
            <F label="Comprador">
              <input className="field" value={comprador} onChange={e => setComprador(e.target.value)} placeholder="Quem comprou" />
            </F>
          </div>

          {tipCompra === 'interna' && (
            <F label="Nº OC (Ordem de Compra do cliente)">
              <input className="field" value={numeroOC} onChange={e => setNumeroOC(e.target.value)} placeholder="Ex: OC-2024-001" />
            </F>
          )}

          <F label="Observações">
            <textarea className="field resize-none" rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Informações adicionais..." />
          </F>

          {/* Orçamento */}
          <F label="Orçamento (PDF ou imagem)">
            <div className="flex items-center gap-3 flex-wrap">
              {nfUrl && (
                <a href={nfUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-[#4F7CFF] bg-[#EEF2FF] px-3 py-2 rounded-lg">
                  <FileText size={13} /> Ver Orçamento
                </a>
              )}
              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] text-sm text-[#64748B] transition-colors">
                {uploadingNf ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploadingNf ? 'Carregando...' : nfUrl ? 'Trocar Orçamento' : 'Anexar Orçamento'}
                <input type="file" accept="image/*,.pdf" className="hidden" disabled={uploadingNf}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadOrc(f) }} />
              </label>
              {nfUrl && <button type="button" onClick={() => { setNfUrl(''); setNfPath('') }} className="text-[#94A3B8] hover:text-red-500"><X size={14} /></button>}
            </div>
          </F>

          {/* NF de Pagamento */}
          <F label="NF de Pagamento (opcional)">
            <div className="flex items-center gap-3 flex-wrap">
              {nfPagamentoUrl && (
                <a href={nfPagamentoUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-[#059669] bg-[#ECFDF5] px-3 py-2 rounded-lg">
                  <FileText size={13} /> Ver NF
                </a>
              )}
              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] text-sm text-[#64748B] transition-colors">
                {uploadingNfPag ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploadingNfPag ? 'Carregando...' : nfPagamentoUrl ? 'Trocar NF' : 'Anexar NF'}
                <input type="file" accept="image/*,.pdf" className="hidden" disabled={uploadingNfPag}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadNfPag(f) }} />
              </label>
              {nfPagamentoUrl && <button type="button" onClick={() => { setNfPagamentoUrl(''); setNfPagamentoPath('') }} className="text-[#94A3B8] hover:text-red-500"><X size={14} /></button>}
            </div>
          </F>

          {/* Custos Extras */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#374151]">Custos Extras (frete, impostos, etc.)</span>
              <button type="button" onClick={addExtra}
                className="flex items-center gap-1 text-xs text-[#4F7CFF] hover:text-blue-700 font-medium">
                <PlusCircle size={13} /> Adicionar
              </button>
            </div>
            {custosExtras.length === 0 ? (
              <p className="text-xs text-[#94A3B8]">Nenhum custo extra cadastrado.</p>
            ) : (
              <div className="space-y-2">
                {custosExtras.map((c, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input className="field flex-1 text-sm" placeholder="Descrição (ex: Frete, ICMS)" value={c.descricao}
                      onChange={e => updateExtra(i, 'descricao', e.target.value)} />
                    <input className="field w-32 text-sm" placeholder="R$ 0,00" type="number" min="0" step="0.01" value={c.valor}
                      onChange={e => updateExtra(i, 'valor', e.target.value)} />
                    <button type="button" onClick={() => removeExtra(i)} className="text-[#94A3B8] hover:text-red-500 shrink-0"><X size={14} /></button>
                  </div>
                ))}
                <div className="flex justify-end pt-1">
                  <span className="text-xs font-semibold text-[#374151]">
                    Total extras: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      custosExtras.reduce((s, c) => s + (parseFloat(c.valor) || 0), 0)
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-[#94A3B8] bg-[#F8FAFC] rounded-lg px-3 py-2">
            Estes campos serão aplicados a todos os {itens.length} ite{itens.length === 1 ? 'm' : 'ns'} deste orçamento. Para editar descrição, quantidade e valores de cada item, use o lápis individual.
          </p>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-colors">
              Cancelar
            </button>
            <button onClick={salvar} disabled={saving}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5">
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── ModalNFManual ─────────────────────────────────────
type ItemNF = { descricao: string; quantidade: string; unidade: string; valorUnitario: string; valorTotal: string; precoVendaUnitario: string; valorVendaTotal: string }
const ITEM_VAZIO = (): ItemNF => ({ descricao: '', quantidade: '1', unidade: 'UN', valorUnitario: '', valorTotal: '', precoVendaUnitario: '', valorVendaTotal: '' })

function ModalNFManual({ obraId, onClose, onSaved }: {
  obraId: string; onClose: () => void; onSaved: () => void
}) {
  const [tipCompra, setTipCompra] = useState<'interna' | 'cliente'>('interna')
  const [statusPadrao, setStatusPadrao] = useState<ObraMaterial['status']>('comprado')
  const [nfNumero, setNfNumero] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [comprador, setComprador] = useState('')
  const [dataCompra, setDataCompra] = useState('')
  const [dataPrevista, setDataPrevista] = useState('')
  const [dataChegada, setDataChegada] = useState('')
  const [localChegada, setLocalChegada] = useState('')
  const [destino, setDestino] = useState('')
  const [numeroOC, setNumeroOC] = useState('')
  const [nfUrl, setNfUrl] = useState('')
  const [nfPath, setNfPath] = useState('')
  const [uploadingNf, setUploadingNf] = useState(false)
  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState<ItemNF[]>([ITEM_VAZIO()])
  const [custosExtrasNF, setCustosExtrasNF] = useState<{ descricao: string; valor: string }[]>([])
  const [saving, setSaving] = useState(false)

  function addExtraNF() { setCustosExtrasNF(p => [...p, { descricao: '', valor: '' }]) }
  function removeExtraNF(i: number) { setCustosExtrasNF(p => p.filter((_, idx) => idx !== i)) }
  function updateExtraNF(i: number, field: 'descricao' | 'valor', v: string) {
    setCustosExtrasNF(p => p.map((c, idx) => idx === i ? { ...c, [field]: v } : c))
  }

  async function uploadNF(file: File) {
    setUploadingNf(true)
    const supabase = createClient()
    const path = `nf/${obraId}/${Date.now()}_${file.name}`
    await supabase.storage.from('documentos').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('documentos').getPublicUrl(path)
    setNfUrl(data.publicUrl)
    setNfPath(path)
    setUploadingNf(false)
  }

  function updateItem(i: number, field: keyof ItemNF, value: string) {
    setItens(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      if (field === 'quantidade' || field === 'valorUnitario') {
        const qty = parseFloat(field === 'quantidade' ? value : next[i].quantidade)
        const vu = parseFloat(field === 'valorUnitario' ? value : next[i].valorUnitario)
        if (!isNaN(qty) && !isNaN(vu)) next[i].valorTotal = (qty * vu).toFixed(2)
      }
      if (field === 'quantidade' || field === 'precoVendaUnitario') {
        const qty = parseFloat(field === 'quantidade' ? value : next[i].quantidade)
        const pv = parseFloat(field === 'precoVendaUnitario' ? value : next[i].precoVendaUnitario)
        if (!isNaN(qty) && !isNaN(pv)) next[i].valorVendaTotal = (qty * pv).toFixed(2)
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
    const obs = [nfNumero.trim() ? `NF: ${nfNumero.trim()}` : '', observacoes.trim()].filter(Boolean).join(' | ') || null
    const payload = validos.map(it => ({
      obra_id: obraId,
      descricao: it.descricao.trim(),
      tipo_compra: tipCompra,
      fornecedor: fornecedor.trim() || null,
      comprador: comprador.trim() || null,
      data_compra: dataCompra || null,
      data_prevista_chegada: dataPrevista || null,
      data_chegada: dataChegada || null,
      local_chegada: localChegada.trim() || null,
      destino: destino.trim() || null,
      quantidade: parseFloat(it.quantidade) || null,
      unidade: it.unidade.trim() || null,
      valor_unitario: parseFloat(it.valorUnitario) || null,
      valor_total: parseFloat(it.valorTotal) || null,
      preco_venda_unitario: parseFloat(it.precoVendaUnitario) || null,
      valor_venda_total: parseFloat(it.valorVendaTotal) || null,
      numero_oc: tipCompra === 'interna' && numeroOC.trim() ? numeroOC.trim() : null,
      status: statusPadrao,
      nota_fiscal_url: nfUrl || null,
      nota_fiscal_path: nfPath || null,
      observacoes: obs,
      custos_extras: custosExtrasNF.filter(c => c.descricao.trim() && parseFloat(c.valor) > 0)
        .map(c => ({ descricao: c.descricao.trim(), valor: parseFloat(c.valor) })),
    }))
    await supabase.from('obra_materiais').insert(payload)
    setSaving(false)
    onSaved()
  }


  const itensValidos = itens.filter(it => it.descricao.trim()).length

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="font-syne font-semibold text-[#0F172A]">Lançar Orçamento</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Tipo de compra */}
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

          {/* Status padrão para todos os itens */}
          <F label="Status dos itens">
            <div className="flex gap-2 flex-wrap">
              {(Object.entries(STATUS_MATERIAL) as [ObraMaterial['status'], { label: string; cls: string }][]).map(([key, cfg]) => (
                <button key={key} type="button" onClick={() => setStatusPadrao(key)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border-2 transition-all ${statusPadrao === key ? cfg.cls + ' border-current' : 'border-[#E2E8F0] text-[#64748B]'}`}>
                  {cfg.label}
                </button>
              ))}
            </div>
          </F>

          {/* Cabeçalho da NF */}
          <div className="grid grid-cols-2 gap-3">
            <F label="Número da NF">
              <input className="field" value={nfNumero} onChange={e => setNfNumero(e.target.value)} placeholder="Ex: 000.086.191" />
            </F>
            <F label="Data da compra">
              <input type="date" className="field" value={dataCompra} onChange={e => setDataCompra(e.target.value)} />
            </F>
          </div>

          {tipCompra === 'interna' && (
            <F label="Nº da OC do cliente">
              <input className="field" value={numeroOC} onChange={e => setNumeroOC(e.target.value)} placeholder="Ex: OC-2024-0042" />
            </F>
          )}

          <div className="grid grid-cols-2 gap-3">
            <F label="Fornecedor">
              <input className="field" value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Nome da empresa" />
            </F>
            <F label="Quem comprou">
              <input className="field" value={comprador} onChange={e => setComprador(e.target.value)} placeholder="Nome" />
            </F>
          </div>

          {/* Logística */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                      <label className="text-xs text-[#94A3B8] mb-0.5 block">Custo unit.</label>
                      <input type="number" min="0" step="any" className="field text-sm" value={item.valorUnitario}
                        onChange={e => updateItem(i, 'valorUnitario', e.target.value)} placeholder="0,00" />
                    </div>
                    <div>
                      <label className="text-xs text-[#94A3B8] mb-0.5 block">Total custo</label>
                      <input type="number" min="0" step="any" className="field text-sm" value={item.valorTotal}
                        onChange={e => updateItem(i, 'valorTotal', e.target.value)} placeholder="0,00" />
                    </div>
                  </div>
                  {tipCompra === 'interna' && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-purple-100">
                      <div>
                        <label className="text-xs text-purple-500 mb-0.5 block">Venda unit. (OC)</label>
                        <input type="number" min="0" step="any" className="field text-sm border-purple-200 focus:border-purple-400" value={item.precoVendaUnitario}
                          onChange={e => updateItem(i, 'precoVendaUnitario', e.target.value)} placeholder="0,00" />
                      </div>
                      <div>
                        <label className="text-xs text-purple-500 mb-0.5 block">Total venda</label>
                        <input type="number" min="0" step="any" className="field text-sm border-purple-200 focus:border-purple-400" value={item.valorVendaTotal}
                          onChange={e => updateItem(i, 'valorVendaTotal', e.target.value)} placeholder="0,00" />
                      </div>
                      {item.valorTotal && item.valorVendaTotal && (
                        <p className="col-span-2 text-xs text-purple-600">
                          Margem: {((parseFloat(item.valorVendaTotal) - parseFloat(item.valorTotal)) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Orçamento anexo */}
          <F label="Orçamento (PDF ou imagem)">
            <div className="flex items-center gap-3 flex-wrap">
              {nfUrl && (
                <a href={nfUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-[#4F7CFF] bg-[#EEF2FF] px-3 py-2 rounded-lg">
                  <FileText size={13} /> Ver Orçamento
                </a>
              )}
              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] text-sm text-[#64748B] transition-colors">
                {uploadingNf ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploadingNf ? 'Carregando...' : nfUrl ? 'Trocar Orçamento' : 'Anexar Orçamento'}
                <input type="file" accept="image/*,.pdf" className="hidden" disabled={uploadingNf}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadNF(f) }} />
              </label>
              {nfUrl && <button type="button" onClick={() => { setNfUrl(''); setNfPath('') }} className="text-[#94A3B8] hover:text-red-500"><X size={14} /></button>}
            </div>
          </F>

          {/* Custos Extras */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#374151]">Custos Extras (frete, impostos, etc.)</span>
              <button type="button" onClick={addExtraNF}
                className="flex items-center gap-1 text-xs text-[#4F7CFF] hover:text-blue-700 font-medium">
                <PlusCircle size={13} /> Adicionar
              </button>
            </div>
            {custosExtrasNF.length > 0 && (
              <div className="space-y-2">
                {custosExtrasNF.map((c, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input className="field flex-1 text-sm" placeholder="Descrição (ex: Frete, ICMS)" value={c.descricao}
                      onChange={e => updateExtraNF(i, 'descricao', e.target.value)} />
                    <input className="field w-32 text-sm" placeholder="R$ 0,00" type="number" min="0" step="0.01" value={c.valor}
                      onChange={e => updateExtraNF(i, 'valor', e.target.value)} />
                    <button type="button" onClick={() => removeExtraNF(i)} className="text-[#94A3B8] hover:text-red-500 shrink-0"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Observações */}
          <F label="Observações">
            <textarea className="field resize-none" rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Informações adicionais..." />
          </F>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-colors">
              Cancelar
            </button>
            <button onClick={salvar} disabled={saving || itensValidos === 0}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {saving ? 'Salvando...' : `Salvar ${itensValidos} ite${itensValidos === 1 ? 'm' : 'ns'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── AbaEquipe ────────────────────────────────────────
function AbaEquipe({ obraId, equipe, onRefresh }: {
  obraId: string
  equipe: ObraFuncionario[]
  onRefresh: () => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<ObraFuncionario | null>(null)

  const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
  const totalMaoDeObra = equipe.reduce((s, e) => s + (e.custo_total ?? 0), 0)

  async function remover(id: string) {
    if (!confirm('Remover alocação?')) return
    const supabase = createClient()
    await supabase.from('obra_funcionarios').delete().eq('id', id)
    onRefresh()
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-syne text-lg font-bold text-[#0F172A]">Equipe da Obra</h2>
          <p className="text-sm text-[#64748B] mt-0.5">Mão de obra alocada e custo por funcionário</p>
        </div>
        <button onClick={() => { setEditando(null); setShowModal(true) }}
          className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={14} /> Alocar
        </button>
      </div>

      {/* Card total */}
      {equipe.length > 0 && (
        <div className="card p-4 border-l-4 border-l-violet-400 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#64748B] font-medium">Custo Total Mão de Obra</p>
            <p className="font-syne font-bold text-2xl text-[#0F172A]">{moeda(totalMaoDeObra)}</p>
          </div>
          <p className="text-xs text-[#94A3B8]">{equipe.length} alocaç{equipe.length === 1 ? 'ão' : 'ões'}</p>
        </div>
      )}

      {equipe.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Package size={28} className="text-[#CBD5E1] mb-3" />
          <p className="text-sm font-medium text-[#374151]">Nenhum funcionário alocado</p>
          <p className="text-xs text-[#94A3B8] mt-1 mb-4">Aloque funcionários e registre os dias trabalhados</p>
          <button onClick={() => { setEditando(null); setShowModal(true) }} className="btn-primary text-sm">
            <Plus size={14} /> Alocar Funcionário
          </button>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Funcionário</th>
                <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden sm:table-cell">Cargo</th>
                <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Dias</th>
                <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden sm:table-cell">Custo/Dia</th>
                <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Total</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody>
              {equipe.map(e => (
                <tr key={e.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors group">
                  <td className="px-4 py-3 text-sm font-medium text-[#0F172A]">{e.funcionario?.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-[#64748B] hidden sm:table-cell">{e.funcionario?.cargo ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-[#374151]">{e.dias_trabalhados}d</td>
                  <td className="px-4 py-3 text-sm text-[#374151] hidden sm:table-cell">{moeda(e.custo_diario_epoca)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-violet-700">{moeda(e.custo_total)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditando(e); setShowModal(true) }}
                        className="p-1.5 rounded hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#4F7CFF]"><Pencil size={13} /></button>
                      <button onClick={() => remover(e.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-[#94A3B8] hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#F8FAFC] border-t-2 border-[#E2E8F0]">
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-[#374151]">Total mão de obra</td>
                <td className="px-4 py-3 text-sm font-bold text-violet-700">{moeda(totalMaoDeObra)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {showModal && (
        <ModalAlocarFuncionario
          obraId={obraId}
          alocacao={editando}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); onRefresh() }}
        />
      )}
    </div>
  )
}

// ── ModalAlocarFuncionario ────────────────────────────
function ModalAlocarFuncionario({ obraId, alocacao, onClose, onSaved }: {
  obraId: string
  alocacao: ObraFuncionario | null
  onClose: () => void
  onSaved: () => void
}) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [funcionarioId, setFuncionarioId] = useState(alocacao?.funcionario_id ?? '')
  const [dias, setDias] = useState(alocacao ? String(alocacao.dias_trabalhados) : '')
  const [custoDia, setCustoDia] = useState(alocacao ? String(alocacao.custo_diario_epoca) : '')
  const [dataInicio, setDataInicio] = useState(alocacao?.data_inicio ?? '')
  const [dataFim, setDataFim] = useState(alocacao?.data_fim ?? '')
  const [observacoes, setObservacoes] = useState(alocacao?.observacoes ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    createClient().from('funcionarios').select('id, nome, cargo, custo_diario').eq('ativo', true).order('nome')
      .then(({ data }) => { if (data) setFuncionarios(data as Funcionario[]) })
  }, [])

  function onSelectFuncionario(id: string) {
    setFuncionarioId(id)
    const f = funcionarios.find(f => f.id === id)
    if (f?.custo_diario && !custoDia) setCustoDia(String(f.custo_diario))
  }

  const preview = (parseFloat(dias) || 0) * (parseFloat(custoDia) || 0)
  const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  async function salvar() {
    if (!funcionarioId || !dias || !custoDia) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      obra_id: obraId,
      funcionario_id: funcionarioId,
      dias_trabalhados: parseFloat(dias),
      custo_diario_epoca: parseFloat(custoDia),
      data_inicio: dataInicio || null,
      data_fim: dataFim || null,
      observacoes: observacoes.trim() || null,
    }
    if (alocacao) {
      await supabase.from('obra_funcionarios').update(payload).eq('id', alocacao.id)
    } else {
      await supabase.from('obra_funcionarios').insert(payload)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
          <h2 className="font-syne font-semibold text-[#0F172A]">{alocacao ? 'Editar Alocação' : 'Alocar Funcionário'}</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Funcionário *</label>
            <select className="field" value={funcionarioId} onChange={e => onSelectFuncionario(e.target.value)} disabled={!!alocacao}>
              <option value="">Selecionar...</option>
              {funcionarios.map(f => (
                <option key={f.id} value={f.id}>{f.nome}{f.cargo ? ` — ${f.cargo}` : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Dias trabalhados *</label>
              <input className="field" type="number" min="0.5" step="0.5" value={dias}
                onChange={e => setDias(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Custo/dia (R$) *</label>
              <input className="field" type="number" min="0" step="0.01" value={custoDia}
                onChange={e => setCustoDia(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          {preview > 0 && (
            <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2.5 text-sm">
              <span className="text-violet-600 font-medium">Custo total: </span>
              <span className="font-syne font-bold text-violet-700">{moeda(preview)}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Data início</label>
              <input type="date" className="field" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Data fim</label>
              <input type="date" className="field" value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Observações</label>
            <textarea className="field resize-none" rows={2} value={observacoes}
              onChange={e => setObservacoes(e.target.value)} placeholder="Ex: Instalação de dutos, 3º andar..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-colors">
              Cancelar
            </button>
            <button onClick={salvar} disabled={saving || !funcionarioId || !dias || !custoDia}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
