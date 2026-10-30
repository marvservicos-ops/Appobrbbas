'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Plus, Upload, Package, Thermometer, Droplets, Shield, Sparkles, Shirt, Wrench, Building2, Hammer, Trash2, X, Loader2, ChevronDown, ChevronUp, Pencil, CheckSquare, Square, Camera, Search, AlertTriangle, ScanLine, Undo2, ClipboardList, Scale, BarChart3, ClipboardCheck } from 'lucide-react'
import BarcodeScannerModal from '@/components/BarcodeScannerModal'
import { createClient } from '@/lib/supabase/client'
import { converterSeForHeic } from '@/lib/utils/heic'
import { sanitizarNomeArquivo } from '@/lib/utils/nomeArquivo'
import { Estoque, EstoqueCampo, EstoqueProduto, EstoqueProdutoCategoria, EstoqueRegistro } from '@/lib/types'
import { ajustarSaldo, controlaSaldo } from '@/lib/estoque/saldo'
import { formatarData, hojeLocal } from '@/lib/datas'
import { arred, numeroOuPadrao, parseNumeroBR } from '@/lib/numero'
import { mensagemErro } from '@/lib/erros'
import ModalSobraMista from '@/components/ModalSobraMista'
import { CampoPesoPeca, PesoParaQuantidade } from '@/components/PesoBalanca'
import Link from 'next/link'
import FerramentasPanel from './ferramentas/FerramentasPanel'
import ModalEditarRegistro from './ModalEditarRegistro'
import { acharCustoVinculado, geraCustoAdministrativo } from './registroVinculos'
import { PhotoLightbox, usePhotoLightbox } from '@/components/PhotoLightbox'

const ICONE_MAP: Record<string, React.ReactNode> = {
  shield: <Shield size={18} />, sparkles: <Sparkles size={18} />,
  thermometer: <Thermometer size={18} />, shirt: <Shirt size={18} />,
  droplets: <Droplets size={18} />, package: <Package size={18} />,
  wrench: <Wrench size={18} />, building2: <Building2 size={18} />, hammer: <Hammer size={18} />,
}
const ICONES = ['package', 'shield', 'sparkles', 'thermometer', 'shirt', 'droplets', 'wrench', 'building2', 'hammer']
const ICONES_ATIVO = ['wrench', 'building2', 'hammer']
const CORES = ['#4F7CFF', '#F59E0B', '#2DD4BF', '#8B5CF6', '#06B6D4', '#EF4444', '#10B981', '#F97316']

type Tab = 'registros' | 'produtos' | 'configurar'

const PAGINA_REGISTROS = 200

function destinoLabel(reg: EstoqueRegistro): string {
  if (reg.tipo === 'entrada') return '—'
  if (reg.destino_tipo === 'obra' && reg.obra?.titulo) return `Obra: ${reg.obra.titulo}`
  if (reg.destino_tipo === 'manutencao' && reg.manutencao) {
    const nomeCliente = reg.manutencao.empresa?.apelido || reg.manutencao.empresa?.razao_social
    return `Manutenção: ${reg.manutencao.numero_contrato ?? ''}${nomeCliente ? ` — ${nomeCliente}` : ''}`.trim()
  }
  if (reg.destino_tipo === 'uso_interno') return 'Uso interno'
  if (reg.funcionario?.nome) return `Funcionário: ${reg.funcionario.nome}`
  return '—'
}

export default function EstoqueDetalhe() {
  const { estoqueId } = useParams<{ estoqueId: string }>()
  const [estoque, setEstoque] = useState<Estoque | null>(null)
  const [campos, setCampos] = useState<EstoqueCampo[]>([])
  const [produtos, setProdutos] = useState<EstoqueProduto[]>([])
  const [categorias, setCategorias] = useState<EstoqueProdutoCategoria[]>([])
  const [filtroCategoria, setFiltroCategoria] = useState<string>('')
  const [showInventario, setShowInventario] = useState(false)
  const [showSobraMista, setShowSobraMista] = useState(false)
  const [registros, setRegistros] = useState<EstoqueRegistro[]>([])
  const [tab, setTab] = useState<Tab>('registros')
  const [loading, setLoading] = useState(true)
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [showEdit, setShowEdit] = useState(false)
  const [editandoProduto, setEditandoProduto] = useState<EstoqueProduto | null>(null)
  const [devolvendoRegistro, setDevolvendoRegistro] = useState<EstoqueRegistro | null>(null)
  const [detalheRegistro, setDetalheRegistro] = useState<EstoqueRegistro | null>(null)
  const [destacado, setDestacado] = useState<string | null>(null)
  const { lightboxUrl, openLightbox, closeLightbox } = usePhotoLightbox()

  // Seleção em lote
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [excluindoLote, setExcluindoLote] = useState(false)

  // Busca e filtros
  const [buscaProduto, setBuscaProduto] = useState('')
  const [showScannerBusca, setShowScannerBusca] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')

  // Registros vêm do banco em páginas (o Supabase devolve no máx. 1000 linhas por consulta);
  // filtros e ordenação vão na consulta para valerem sobre todos os registros, não só os carregados.
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erroRegistros, setErroRegistros] = useState('')
  const [editandoRegistro, setEditandoRegistro] = useState<EstoqueRegistro | null>(null)
  const consultaRegistros = useRef(0)

  async function load() {
    const supabase = createClient()
    const [{ data: est }, { data: cam }, { data: prod }, { data: cats }] = await Promise.all([
      supabase.from('estoques').select('*').eq('id', estoqueId).single(),
      supabase.from('estoque_campos').select('*').eq('estoque_id', estoqueId).order('ordem'),
      supabase.from('estoque_produtos').select('*').eq('estoque_id', estoqueId).eq('ativo', true).order('nome'),
      supabase.from('estoque_produto_categorias').select('*').eq('estoque_id', estoqueId).order('ordem').order('nome'),
    ])
    setEstoque(est)
    setCampos(cam ?? [])
    setProdutos(prod ?? [])
    setCategorias(cats ?? [])
    setLoading(false)
  }

  async function carregarRegistros(reset: boolean) {
    const supabase = createClient()
    const de = reset ? 0 : registros.length
    const asc = sortDir === 'asc'
    let q = supabase.from('estoque_registros')
      .select('*, valores:estoque_registro_valores(*), obra:obras(titulo), funcionario:funcionarios(nome), manutencao:contratos_manutencao(numero_contrato, empresa:empresas(razao_social, apelido))', { count: 'exact' })
      .eq('estoque_id', estoqueId)
    if (filtroTipo !== 'todos') q = q.eq('tipo', filtroTipo)
    if (filtroDataInicio) q = q.gte('data', filtroDataInicio)
    if (filtroDataFim) q = q.lte('data', filtroDataFim)
    const n = ++consultaRegistros.current
    if (!reset) setCarregandoMais(true)
    const { data, count, error } = await q.order('data', { ascending: asc }).order('created_at', { ascending: asc }).range(de, de + PAGINA_REGISTROS - 1)
    if (n !== consultaRegistros.current) return // filtro mudou enquanto carregava
    setCarregandoMais(false)
    if (error) { setErroRegistros(mensagemErro(error, 'Erro ao carregar os registros')); return }
    setErroRegistros('')
    setRegistros(prev => reset ? (data ?? []) : [...prev, ...(data ?? [])])
    setTotalRegistros(count ?? 0)
    if (reset) setSelecionados(new Set())
  }

  function recarregar() { load(); carregarRegistros(true) }

  useEffect(() => { load() }, [estoqueId])
  useEffect(() => { carregarRegistros(true) }, [estoqueId, filtroTipo, filtroDataInicio, filtroDataFim, sortDir])

  // Exclui registros devolvendo o saldo e apagando o que foi lançado junto
  // (devoluções da saída, entrada no estoque da manutenção, custo administrativo).
  async function excluirRegistros(alvo: EstoqueRegistro[]): Promise<boolean> {
    if (!estoque || alvo.length === 0) return false
    const supabase = createClient()
    const ids = alvo.map(r => r.id)

    // Devoluções ligadas às saídas (podem não estar entre os registros carregados)
    const { data: devs, error: errDev } = await supabase.from('estoque_registros')
      .select('id, estoque_id, produto_id, produto_nome, tipo, quantidade, unidade, data, responsavel, destino_tipo, valor_total, registro_origem_id, created_at')
      .in('registro_origem_id', ids)
    if (errDev) { alert(mensagemErro(errDev, 'Erro ao preparar a exclusão')); return false }
    const extras = ((devs ?? []) as EstoqueRegistro[]).filter(d => !ids.includes(d.id))
    const todos = [...alvo, ...extras]
    const todosIds = todos.map(r => r.id)

    const { data: manutRegs, error: errMan } = await supabase.from('manutencao_estoque_registros')
      .select('id, contrato_id, produto_id, quantidade').in('origem_estoque_registro_id', todosIds)
    if (errMan) { alert(mensagemErro(errMan, 'Erro ao preparar a exclusão')); return false }

    const custos: string[] = []
    const custosNaoAchados: string[] = []
    for (const r of todos.filter(r => geraCustoAdministrativo(r, estoque))) {
      const { id } = await acharCustoVinculado(supabase, r)
      if (id) custos.push(id)
      else custosNaoAchados.push(`${r.produto_nome} (${formatarData(r.data)})`)
    }

    // Saldo a devolver por produto: saída excluída volta (+), entrada excluída sai (−).
    // Saída de produto sem controle de saldo não mexe no saldo (ela não baixou um valor conhecido).
    const prodPorId = new Map(produtos.map(p => [p.id, p]))
    const deltas = new Map<string, { nome: string; unidade: string; delta: number }>()
    const semControle = new Set<string>()
    for (const r of todos) {
      if (!r.produto_id) continue
      const p = prodPorId.get(r.produto_id)
      if (r.tipo === 'saida' && p && !controlaSaldo(p)) { semControle.add(r.produto_nome); continue }
      const atual = deltas.get(r.produto_id) ?? { nome: p?.nome ?? r.produto_nome, unidade: p?.unidade ?? r.unidade ?? '', delta: 0 }
      atual.delta = arred(atual.delta + (r.tipo === 'saida' ? r.quantidade : -r.quantidade))
      deltas.set(r.produto_id, atual)
    }

    const msg: string[] = [alvo.length === 1
      ? `Excluir o registro de ${alvo[0].tipo === 'saida' ? 'saída' : 'entrada'} "${alvo[0].produto_nome}" (${alvo[0].quantidade} ${alvo[0].unidade ?? ''}) de ${formatarData(alvo[0].data)}?`
      : `Excluir ${alvo.length} registros selecionados?`]
    const comDelta = Array.from(deltas.values()).filter(d => d.delta !== 0)
    if (comDelta.length > 0) {
      msg.push('\nO saldo será corrigido:')
      comDelta.slice(0, 6).forEach(d => msg.push(`• ${d.nome}: ${d.delta > 0 ? '+' : ''}${d.delta} ${d.unidade}`))
      if (comDelta.length > 6) msg.push(`• e mais ${comDelta.length - 6} produto(s)`)
    }
    if (semControle.size > 0) msg.push(`\nSem controle de saldo (o saldo não muda): ${Array.from(semControle).join(', ')}.`)
    if (extras.length > 0) msg.push(`\nTambém será(ão) excluída(s) ${extras.length} devolução(ões) ligada(s) a esta(s) saída(s).`)
    if ((manutRegs ?? []).length > 0) msg.push('\nA entrada no estoque do contrato de manutenção também será desfeita.')
    if (custos.length > 0) msg.push(`\nO custo administrativo gerado por esta saída também será excluído (${custos.length}).`)
    if (custosNaoAchados.length > 0) msg.push(`\nAtenção: não foi possível identificar com segurança o custo administrativo de ${custosNaoAchados.join(', ')}. Confira e exclua manualmente em Administrativo.`)
    if (todos.some(r => r.tipo === 'entrada' && r.produto_id)) msg.push('\nO custo médio (CMP) do produto não é recalculado.')
    if (!confirm(msg.join('\n'))) return false

    const { error } = await supabase.from('estoque_registros').delete().in('id', todosIds)
    if (error) { alert(mensagemErro(error, 'Erro ao excluir')); return false }

    const falhas: string[] = []
    for (const [pid, d] of Array.from(deltas.entries())) {
      if (d.delta === 0) continue
      const p = prodPorId.get(pid)
      const { error: errSaldo } = await ajustarSaldo(supabase, pid, d.delta, { pisoZero: p ? !controlaSaldo(p) : false })
      if (errSaldo) falhas.push(`saldo de ${d.nome} (${mensagemErro(errSaldo)})`)
    }
    for (const m of manutRegs ?? []) {
      const { data: mp, error: errMp } = await supabase.from('manutencao_estoque_produtos')
        .select('id').eq('contrato_id', m.contrato_id).eq('produto_id', m.produto_id).maybeSingle()
      const errAj = errMp ?? (mp ? (await ajustarSaldo(supabase, mp.id, -Number(m.quantidade), { tabela: 'manutencao_estoque_produtos' })).error : null)
      if (errAj) falhas.push(`saldo no contrato de manutenção (${mensagemErro(errAj)})`)
    }
    if ((manutRegs ?? []).length > 0) {
      const { error: errDel } = await supabase.from('manutencao_estoque_registros').delete().in('id', (manutRegs ?? []).map(m => m.id))
      if (errDel) falhas.push(`lançamento no estoque da manutenção (${mensagemErro(errDel)})`)
    }
    if (custos.length > 0) {
      const { error: errCusto } = await supabase.from('custos_administrativos').delete().in('id', custos)
      if (errCusto) falhas.push(`custo administrativo (${mensagemErro(errCusto)})`)
    }
    if (falhas.length > 0) alert(`Registro excluído, mas não foi possível corrigir:\n• ${falhas.join('\n• ')}\n\nConfira e ajuste manualmente.`)

    setRegistros(r => r.filter(x => !todosIds.includes(x.id)))
    setTotalRegistros(t => Math.max(0, t - todosIds.length))
    setSelecionados(s => { const next = new Set(s); todosIds.forEach(id => next.delete(id)); return next })
    load() // saldos atualizados
    return true
  }

  async function excluirRegistro(reg: EstoqueRegistro) {
    if (await excluirRegistros([reg])) setDetalheRegistro(null)
  }

  async function excluirSelecionados() {
    if (selecionados.size === 0) return
    setExcluindoLote(true)
    await excluirRegistros(registros.filter(r => selecionados.has(r.id)))
    setExcluindoLote(false)
  }

  async function excluirProduto(p: EstoqueProduto) {
    if (!confirm(`Desativar o produto "${p.nome}"? Ele some da lista, mas os registros continuam.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('estoque_produtos').update({ ativo: false }).eq('id', p.id)
    if (error) { alert(mensagemErro(error, 'Erro ao desativar o produto')); return }
    setProdutos(prev => prev.filter(x => x.id !== p.id))
  }

  function toggleSelecionado(id: string) {
    setSelecionados(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTodos() {
    if (selecionados.size === registrosOrdenados.length) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(registrosOrdenados.map(r => r.id)))
    }
  }

  // Já vêm filtrados e ordenados do banco (carregarRegistros)
  const registrosOrdenados = registros

  const produtosFiltrados = produtos.filter(p => {
    if (filtroCategoria === '__sem__' ? p.categoria_id : filtroCategoria && p.categoria_id !== filtroCategoria) return false
    if (!buscaProduto.trim()) return true
    const q = buscaProduto.toLowerCase()
    return p.nome.toLowerCase().includes(q)
      || (p.codigo ?? '').toLowerCase().includes(q)
      || ((p as any).codigo_barras ?? '').toLowerCase().includes(q)
  })

  const produtosAbaixoMinimo = produtos.filter(p => controlaSaldo(p) && p.quantidade_atual <= p.quantidade_minima && p.quantidade_minima > 0)
  const categoriaPorId = new Map(categorias.map(c => [c.id, c]))
  const temSobraMista = produtos.some(p => p.sobra_mista)

  const todosSelec = registrosOrdenados.length > 0 && selecionados.size === registrosOrdenados.length

  // Quanto já foi devolvido de cada saída, entre os registros carregados (só para a lista;
  // o modal de devolução consulta o banco)
  const devolvidoMap = new Map<string, number>()
  for (const r of registros) {
    if (r.registro_origem_id) {
      devolvidoMap.set(r.registro_origem_id, (devolvidoMap.get(r.registro_origem_id) ?? 0) + r.quantidade)
    }
  }
  const registrosPorId = new Map(registros.map(r => [r.id, r]))

  function irParaOrigem(id: string) {
    setTab('registros')
    setFiltroTipo('todos')
    setTimeout(() => {
      const el = document.getElementById(`reg-${id}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setDestacado(id)
      setTimeout(() => setDestacado(d => d === id ? null : d), 2000)
    }, 50)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 size={28} className="animate-spin text-[#4F7CFF]" />
    </div>
  )

  if (!estoque) return (
    <div className="p-8 text-center text-[#64748B]">Estoque não encontrado.</div>
  )

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 md:gap-4 mb-5">
        <Link href="/estoque" className="w-9 h-9 rounded-xl border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors">
          <ArrowLeft size={16} className="text-[#64748B]" />
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: estoque.cor }}>
            {ICONE_MAP[estoque.icone] ?? <Package size={18} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-syne font-bold text-xl text-[#0F172A]">{estoque.nome}</h1>
              <button onClick={() => setShowEdit(true)} aria-label="Editar estoque" title="Editar estoque" className="p-2 -m-1 text-[#94A3B8] hover:text-[#4F7CFF] transition-colors">
                <Pencil size={14} />
              </button>
            </div>
            {estoque.descricao && <p className="text-xs text-[#64748B]">{estoque.descricao}</p>}
          </div>
        </div>
        {!ICONES_ATIVO.includes(estoque.icone) && (
          <div className="flex items-center gap-2 shrink-0">
            {estoque.icone === 'shirt' && (
              <Link href="/estoque/necessidade-compra"
                className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] transition-colors">
                <ClipboardList size={14} /> Necessidade de Compra
              </Link>
            )}
            {temSobraMista && (
              <button onClick={() => setShowSobraMista(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] transition-colors">
                <Scale size={14} /> Sobra por peso
              </button>
            )}
            {categorias.length > 0 && (
              <Link href="/estoque/consumo-obras"
                className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] transition-colors">
                <BarChart3 size={14} /> Consumo por obra
              </Link>
            )}
            <Link href={`/estoque/${estoqueId}/importar`}
              className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] transition-colors">
              <Upload size={14} /> Importar CSV
            </Link>
            <Link href={`/estoque/${estoqueId}/registrar`} className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2">
              <Plus size={14} /> <span className="hidden sm:inline">Novo </span>Registro
            </Link>
          </div>
        )}
      </div>

      {ICONES_ATIVO.includes(estoque.icone) ? (
        <FerramentasPanel estoqueId={estoqueId} modoPatrimonio={estoque.icone === 'building2'} />
      ) : (
      <>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#F1F5F9] p-1 rounded-xl w-fit">
        {(['registros', 'produtos', 'configurar'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-all ${tab === t ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#374151]'}`}>
            {t === 'registros' ? `Registros (${totalRegistros})` : t === 'produtos' ? `Produtos (${produtos.length})` : 'Configurar'}
          </button>
        ))}
      </div>

      {/* Tab: Registros */}
      {tab === 'registros' && (
        <div className="space-y-3">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 bg-[#F1F5F9] p-1 rounded-lg">
              {(['todos', 'entrada', 'saida'] as const).map(t => (
                <button key={t} onClick={() => setFiltroTipo(t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filtroTipo === t ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#374151]'}`}>
                  {t === 'todos' ? 'Todos' : t === 'entrada' ? 'Entradas' : 'Saídas'}
                </button>
              ))}
            </div>
            <input type="date" className="field text-sm py-1.5 w-auto" value={filtroDataInicio}
              onChange={e => setFiltroDataInicio(e.target.value)} title="Data inicial" />
            <span className="text-[#94A3B8] text-xs">até</span>
            <input type="date" className="field text-sm py-1.5 w-auto" value={filtroDataFim}
              onChange={e => setFiltroDataFim(e.target.value)} title="Data final" />
            {(filtroTipo !== 'todos' || filtroDataInicio || filtroDataFim) && (
              <button onClick={() => { setFiltroTipo('todos'); setFiltroDataInicio(''); setFiltroDataFim('') }}
                className="text-xs text-[#64748B] hover:text-red-500 flex items-center gap-1">
                <X size={12} /> Limpar
              </button>
            )}
          </div>

          {/* Barra de ação em lote */}
          {selecionados.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-[#EEF2FF] rounded-xl border border-[#C7D2FE]">
              <span className="text-sm font-medium text-[#4F7CFF]">{selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''}</span>
              <button onClick={excluirSelecionados} disabled={excluindoLote}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors ml-auto">
                {excluindoLote ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Excluir selecionados
              </button>
              <button onClick={() => setSelecionados(new Set())} aria-label="Limpar seleção" title="Limpar seleção" className="p-2 text-[#64748B] hover:text-[#374151]">
                <X size={16} />
              </button>
            </div>
          )}

          {erroRegistros && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{erroRegistros}</p>}

          <div className="card p-0 overflow-hidden">
            {registros.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center">
                  <Package size={24} className="text-[#94A3B8]" />
                </div>
                {filtroTipo !== 'todos' || filtroDataInicio || filtroDataFim ? (
                  <p className="font-medium text-[#374151]">Nenhum registro neste filtro</p>
                ) : (<>
                  <p className="font-medium text-[#374151]">Nenhum registro ainda</p>
                  <p className="text-sm text-[#94A3B8]">Clique em &quot;Novo Registro&quot; para começar</p>
                </>)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="px-4 py-3 w-8">
                        <button onClick={toggleTodos} className="text-[#94A3B8] hover:text-[#4F7CFF] transition-colors">
                          {todosSelec ? <CheckSquare size={16} className="text-[#4F7CFF]" /> : <Square size={16} />}
                        </button>
                      </th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">
                        <button className="flex items-center gap-1" onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
                          Data {sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                        </button>
                      </th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Tipo</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Produto</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Qtd</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Destino</th>
                      {campos.map(c => (
                        <th key={c.id} className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">{c.nome}</th>
                      ))}
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Responsável</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Assinatura</th>
                      <th className="px-4 py-3 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {registrosOrdenados.map(reg => {
                      const selec = selecionados.has(reg.id)
                      const devolvido = reg.tipo === 'saida' ? (devolvidoMap.get(reg.id) ?? 0) : 0
                      const origem = reg.registro_origem_id ? registrosPorId.get(reg.registro_origem_id) : null
                      return (
                        <tr key={reg.id} id={`reg-${reg.id}`}
                          className={`border-b border-[#F1F5F9] transition-colors group cursor-pointer ${destacado === reg.id ? 'bg-amber-50' : selec ? 'bg-[#F5F7FF]' : 'hover:bg-[#F8FAFC]'}`}
                          onClick={() => setDetalheRegistro(reg)}>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <button onClick={() => toggleSelecionado(reg.id)} className="text-[#94A3B8] hover:text-[#4F7CFF] transition-colors">
                              {selec ? <CheckSquare size={16} className="text-[#4F7CFF]" /> : <Square size={16} />}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#374151] whitespace-nowrap">
                            {formatarData(reg.data)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${reg.tipo === 'saida' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                              {reg.tipo === 'saida' ? 'Saída' : 'Entrada'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-[#0F172A]">
                            {reg.produto_nome}
                            {devolvido > 0 && (
                              <div className="text-[10px] font-semibold text-amber-700 mt-0.5">
                                ↩ {devolvido} de {reg.quantidade} devolvido
                              </div>
                            )}
                            {origem && (
                              <button onClick={e => { e.stopPropagation(); irParaOrigem(origem.id) }}
                                className="block text-[10px] font-medium text-[#4F7CFF] hover:underline mt-0.5">
                                ↪ devolução de {origem.responsavel} ({formatarData(origem.data)})
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#374151]">{reg.quantidade} {reg.unidade ?? ''}</td>
                          <td className="px-4 py-3 text-sm text-[#374151]">{destinoLabel(reg)}</td>
                          {campos.map(c => {
                            const val = reg.valores?.find(v => v.campo_id === c.id)
                            return <td key={c.id} className="px-4 py-3 text-sm text-[#374151]">{val?.valor ?? '—'}</td>
                          })}
                          <td className="px-4 py-3 text-sm text-[#374151]">{reg.responsavel}</td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            {reg.assinatura_url
                              ? <div className="relative h-8 w-24 border border-[#E2E8F0] rounded"><Image src={reg.assinatura_url} alt="assinatura" fill sizes="96px" className="object-contain" /></div>
                              : <span className="text-xs text-[#94A3B8]">—</span>}
                          </td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity">
                              {reg.tipo === 'saida' && devolvido < reg.quantidade && (
                                <button
                                  onClick={() => setDevolvendoRegistro(reg)}
                                  title="Registrar devolução" aria-label="Registrar devolução"
                                  className="p-2 text-[#94A3B8] hover:text-amber-500"
                                >
                                  <Undo2 size={14} />
                                </button>
                              )}
                              <button onClick={() => setEditandoRegistro(reg)} title="Editar registro" aria-label="Editar registro"
                                className="p-2 text-[#94A3B8] hover:text-[#4F7CFF]">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => excluirRegistro(reg)} title="Excluir registro" aria-label="Excluir registro"
                                className="p-2 text-[#94A3B8] hover:text-red-500">
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
          {registros.length > 0 && (
            <div className="flex flex-col items-center gap-1.5 py-1">
              <p className="text-xs text-[#94A3B8]">Mostrando {registros.length} de {totalRegistros}</p>
              {registros.length < totalRegistros && (
                <button onClick={() => carregarRegistros(false)} disabled={carregandoMais}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#4F7CFF] border border-[#C7D2FE] rounded-lg hover:bg-[#EEF2FF] disabled:opacity-60">
                  {carregandoMais && <Loader2 size={14} className="animate-spin" />}
                  {carregandoMais ? 'Carregando…' : 'Carregar mais'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Produtos */}
      {tab === 'produtos' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <AddProdutoInline estoqueId={estoqueId} estoqueIcone={estoque?.icone ?? ''} categorias={categorias} onAdded={load} />
            {produtos.length > 0 && (
              <button onClick={() => setShowInventario(true)}
                className="flex items-center gap-2 text-sm font-medium text-[#64748B] hover:bg-[#F1F5F9] px-3 py-2 rounded-lg transition-colors">
                <ClipboardCheck size={14} /> Lançar inventário
              </button>
            )}
          </div>

          {/* Alerta de estoque mínimo */}
          {produtosAbaixoMinimo.length > 0 && (
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">{produtosAbaixoMinimo.length} produto{produtosAbaixoMinimo.length > 1 ? 's' : ''} abaixo do estoque mínimo</p>
                <p className="text-xs text-amber-700 mt-0.5">{produtosAbaixoMinimo.map(p => p.nome).join(', ')}</p>
              </div>
            </div>
          )}

          {/* Filtro por categoria */}
          {categorias.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[{ id: '', nome: 'Todas', cor: '#0F172A' }, ...categorias, { id: '__sem__', nome: 'Sem categoria', cor: '#94A3B8' }].map(c => (
                <button key={c.id} onClick={() => setFiltroCategoria(c.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${filtroCategoria === c.id ? 'text-white border-transparent' : 'text-[#64748B] border-[#E2E8F0] hover:bg-[#F1F5F9]'}`}
                  style={filtroCategoria === c.id ? { backgroundColor: c.cor } : undefined}>
                  {c.nome}
                </button>
              ))}
            </div>
          )}

          {/* Busca */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                className="field pl-9 text-sm"
                placeholder="Buscar por nome, código ou código de barras..."
                value={buscaProduto}
                onChange={e => setBuscaProduto(e.target.value)}
              />
              {buscaProduto && (
                <button onClick={() => setBuscaProduto('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#374151]">
                  <X size={14} />
                </button>
              )}
            </div>
            <button onClick={() => setShowScannerBusca(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-[#E2E8F0] rounded-lg hover:bg-[#EEF2FF] hover:border-[#4F7CFF] text-[#64748B] hover:text-[#4F7CFF] transition-colors text-sm">
              <ScanLine size={15} /> <span className="hidden sm:inline">Escanear</span>
            </button>
          </div>

          {showScannerBusca && (
            <BarcodeScannerModal
              onScanned={code => { setBuscaProduto(code); setShowScannerBusca(false) }}
              onClose={() => setShowScannerBusca(false)}
            />
          )}

          <div className="card p-0 overflow-hidden">
            {produtos.length === 0 ? (
              <div className="py-12 text-center text-[#94A3B8] text-sm">Nenhum produto cadastrado.</div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="py-12 text-center text-[#94A3B8] text-sm">Nenhum produto encontrado{buscaProduto ? <> para &quot;{buscaProduto}&quot;</> : ' nesta categoria'}.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-3 py-3 w-10 hidden sm:table-cell" />
                    <th className="text-left text-xs font-semibold text-[#64748B] px-3 py-3">Produto</th>
                    {categorias.length > 0 && <th className="hidden md:table-cell text-left text-xs font-semibold text-[#64748B] px-3 py-3">Categoria</th>}
                    <th className="hidden md:table-cell text-left text-xs font-semibold text-[#64748B] px-3 py-3">Código</th>
                    <th className="hidden sm:table-cell text-left text-xs font-semibold text-[#64748B] px-3 py-3">Tam.</th>
                    <th className="hidden sm:table-cell text-left text-xs font-semibold text-[#64748B] px-3 py-3">Unidade</th>
                    <th className="text-left text-xs font-semibold text-[#64748B] px-3 py-3">Qtd</th>
                    <th className="hidden sm:table-cell text-left text-xs font-semibold text-[#64748B] px-3 py-3">Mín.</th>
                    <th className="hidden md:table-cell text-left text-xs font-semibold text-[#64748B] px-3 py-3">Preço (CMP)</th>
                    <th className="px-3 py-3 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {produtosFiltrados.map(p => {
                    const controlado = controlaSaldo(p)
                    const abaixoMin = controlado && p.quantidade_minima > 0 && p.quantidade_atual <= p.quantidade_minima
                    const negativo = controlado && p.quantidade_atual < 0
                    const cat = p.categoria_id ? categoriaPorId.get(p.categoria_id) : null
                    return (
                      <tr key={p.id} className={`border-b border-[#F1F5F9] group transition-colors ${negativo ? 'bg-red-50 hover:bg-red-100' : abaixoMin ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-[#F8FAFC]'}`}>
                        <td className="px-3 py-2 hidden sm:table-cell">
                          {p.foto_url
                            ? <Image
                                src={p.foto_url}
                                alt=""
                                width={36}
                                height={36}
                                className="w-9 h-9 rounded-lg object-cover border border-[#E2E8F0] cursor-zoom-in"
                                onClick={() => openLightbox(p.foto_url!)}
                              />
                            : <div className="w-9 h-9 rounded-lg bg-[#F1F5F9] flex items-center justify-center"><Package size={14} className="text-[#CBD5E1]" /></div>
                          }
                        </td>
                        <td className="px-3 py-3 text-sm font-medium text-[#0F172A]">
                          <div className="flex items-center gap-2">
                            {p.nome}
                            {p.sobra_mista && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#F1F5F9] text-[#475569] rounded-full">Sobra mista</span>}
                            {negativo && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">Negativo</span>}
                            {!negativo && abaixoMin && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">Crítico</span>}
                          </div>
                        </td>
                        {categorias.length > 0 && (
                          <td className="hidden md:table-cell px-3 py-3">
                            {cat
                              ? <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: cat.cor }}>{cat.nome}</span>
                              : <span className="text-xs text-[#CBD5E1]">—</span>}
                          </td>
                        )}
                        <td className="hidden md:table-cell px-3 py-3 text-sm text-[#64748B]">{p.codigo ?? '—'}</td>
                        <td className="hidden sm:table-cell px-3 py-3 text-sm text-[#64748B]">{p.tamanho ?? '—'}</td>
                        <td className="hidden sm:table-cell px-3 py-3 text-sm text-[#64748B]">{p.unidade}</td>
                        <td className={`px-3 py-3 text-sm font-semibold ${negativo ? 'text-red-600' : abaixoMin ? 'text-amber-700' : 'text-[#374151]'}`}>
                          {p.quantidade_atual}
                          {!controlado && (
                            <span className="block text-[10px] font-medium text-[#94A3B8]" title="Saldo não controlado: a saída não exige saldo. O número é só o que voltou de obra.">
                              sem controle
                            </span>
                          )}
                        </td>
                        <td className="hidden sm:table-cell px-3 py-3 text-sm text-[#374151]">{p.quantidade_minima}</td>
                        <td className="hidden md:table-cell px-3 py-3 text-sm text-[#374151]">
                          {p.preco_unitario ? p.preco_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditandoProduto(p)} title="Editar produto" aria-label="Editar produto" className="p-2 text-[#94A3B8] hover:text-[#4F7CFF]">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => excluirProduto(p)} title="Desativar produto" aria-label="Desativar produto" className="p-2 text-[#94A3B8] hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: Configurar */}
      {tab === 'configurar' && (
        <div className="space-y-4">
          <ConfigurarCampos estoqueId={estoqueId} campos={campos} onUpdated={load} />
          <ConfigurarCategorias estoqueId={estoqueId} categorias={categorias} onUpdated={load} />
        </div>
      )}
      </>
      )}

      {/* Modal devolução */}
      {devolvendoRegistro && (
        <ModalDevolucao
          registro={devolvendoRegistro}
          produtos={produtos}
          onClose={() => setDevolvendoRegistro(null)}
          onSaved={() => { setDevolvendoRegistro(null); recarregar() }}
        />
      )}

      {/* Modal detalhe do registro */}
      {detalheRegistro && (
        <ModalDetalheRegistro
          registro={detalheRegistro}
          campos={campos}
          estoqueIcone={estoque?.icone ?? ''}
          podeDevolver={detalheRegistro.tipo === 'saida' && (devolvidoMap.get(detalheRegistro.id) ?? 0) < detalheRegistro.quantidade}
          onDevolver={() => { setDevolvendoRegistro(detalheRegistro); setDetalheRegistro(null) }}
          onEditar={() => { setEditandoRegistro(detalheRegistro); setDetalheRegistro(null) }}
          onExcluir={() => excluirRegistro(detalheRegistro)}
          onClose={() => setDetalheRegistro(null)}
        />
      )}

      {/* Modal editar registro */}
      {editandoRegistro && estoque && (
        <ModalEditarRegistro
          registro={editandoRegistro}
          estoque={estoque}
          produtos={produtos}
          onClose={() => setEditandoRegistro(null)}
          onSaved={() => { setEditandoRegistro(null); recarregar() }}
        />
      )}

      {showInventario && (
        <ModalInventario
          produtos={produtos}
          categorias={categorias}
          onClose={() => setShowInventario(false)}
          onSaved={() => { setShowInventario(false); load() }}
        />
      )}

      {showSobraMista && (
        <ModalSobraMista
          produtosSobra={produtos.filter(p => p.sobra_mista)}
          onClose={() => setShowSobraMista(false)}
          onSaved={() => { setShowSobraMista(false); load() }}
        />
      )}

      {/* Modal editar produto */}
      {editandoProduto && (
        <ModalEditarProduto
          produto={editandoProduto}
          categorias={categorias}
          estoqueIcone={estoque?.icone ?? ''}
          onClose={() => setEditandoProduto(null)}
          onSaved={() => { setEditandoProduto(null); load() }}
        />
      )}

      {/* Modal editar estoque */}
      {showEdit && estoque && (
        <ModalEditarEstoque
          estoque={estoque}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load() }}
        />
      )}

      <PhotoLightbox url={lightboxUrl} onClose={closeLightbox} />
    </div>
  )
}

// ── Modal editar produto ──────────────────────────────
function ModalEditarProduto({ produto, categorias, estoqueIcone, onClose, onSaved }: { produto: EstoqueProduto; categorias: EstoqueProdutoCategoria[]; estoqueIcone: string; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(produto.nome)
  const [codigo, setCodigo] = useState(produto.codigo ?? '')
  const [codigoBarras, setCodigoBarras] = useState(produto.codigo_barras ?? '')
  const [tamanho, setTamanho] = useState(produto.tamanho ?? '')
  const [unidade, setUnidade] = useState(produto.unidade)
  const [qtdAtual, setQtdAtual] = useState(String(produto.quantidade_atual))
  const [qtdMin, setQtdMin] = useState(String(produto.quantidade_minima))
  const [precoUnitario, setPrecoUnitario] = useState(produto.preco_unitario ? String(produto.preco_unitario) : '')
  const [fotoUrl, setFotoUrl] = useState(produto.foto_url ?? '')
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [motivoAjuste, setMotivoAjuste] = useState('')
  const [categoriaId, setCategoriaId] = useState(produto.categoria_id ?? '')
  const [controla, setControla] = useState(controlaSaldo(produto))
  const [sobraMista, setSobraMista] = useState(!!produto.sobra_mista)
  const [pesoPeca, setPesoPeca] = useState(produto.peso_unitario_g ? String(produto.peso_unitario_g) : '')
  const qtdOriginal = produto.quantidade_atual
  const ligandoControle = controla && !controlaSaldo(produto)

  async function uploadFoto(fileOriginal: File) {
    setUploadingFoto(true)
    try {
      const file = await converterSeForHeic(fileOriginal)
      const supabase = createClient()
      const path = `produtos/${produto.id}/${Date.now()}_${sanitizarNomeArquivo(file.name)}`
      const { error } = await supabase.storage.from('estoque').upload(path, file, { upsert: true })
      if (error) { alert(mensagemErro(error, 'Erro ao enviar a foto')); return }
      const { data } = supabase.storage.from('estoque').getPublicUrl(path)
      setFotoUrl(data.publicUrl)
    } catch (err) {
      alert(mensagemErro(err as Error, 'Erro ao enviar a foto'))
    } finally {
      setUploadingFoto(false)
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setLoading(true)
    const supabase = createClient()
    const novaQtd = numeroOuPadrao(qtdAtual, 0)
    const qtdMudou = novaQtd !== produto.quantidade_atual
    const { error } = await supabase.from('estoque_produtos').update({
      nome: nome.trim(),
      codigo: codigo.trim() || null,
      codigo_barras: codigoBarras.trim() || null,
      tamanho: tamanho.trim() || null,
      unidade: unidade.trim() || 'un',
      // Só regrava o saldo se foi alterado aqui — senão sobrescreveria movimentações feitas enquanto o modal estava aberto
      ...(qtdMudou ? { quantidade_atual: novaQtd } : {}),
      quantidade_minima: numeroOuPadrao(qtdMin, 0),
      preco_unitario: precoUnitario ? numeroOuPadrao(precoUnitario, 0) : null,
      foto_url: fotoUrl || null,
      categoria_id: categoriaId || null,
      controla_saldo: controla,
      sobra_mista: sobraMista,
      // Só manda o peso quando mexido — assim salvar continua funcionando antes da migração do campo
      ...(numeroOuPadrao(pesoPeca, 0) !== (produto.peso_unitario_g ?? 0) ? { peso_unitario_g: numeroOuPadrao(pesoPeca, 0) || null } : {}),
    }).eq('id', produto.id)
    if (error) { setLoading(false); alert(mensagemErro(error, 'Erro ao salvar o produto')); return }

    // Log de auditoria quando a quantidade muda manualmente
    if (qtdMudou || ligandoControle) {
      const { error: errLog } = await supabase.from('estoque_logs').insert({
        produto_id: produto.id,
        estoque_id: produto.estoque_id,
        tipo: 'ajuste_manual',
        quantidade_anterior: produto.quantidade_atual,
        quantidade_nova: novaQtd,
        motivo: motivoAjuste || (ligandoControle ? 'Inventário inicial' : 'Ajuste manual via edição de produto'),
      }).select()
      if (errLog) alert(mensagemErro(errLog, 'Produto salvo, mas o histórico do ajuste não foi gravado'))
    }

    setLoading(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">Editar Produto</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={salvar} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome *</label>
            <input required className="field" value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">{estoqueIcone === 'shield' ? 'Código / Nº CA' : 'Informações Adicionais'}</label>
              <input className="field" value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Unidade</label>
              <input className="field" value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="un" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Tamanho</label>
              <input className="field" value={tamanho} onChange={e => setTamanho(e.target.value)} placeholder="Ex: M, 38..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Categoria</label>
              <select className="field" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
                <option value="">Sem categoria</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>
          <ControleSaldoOpcoes controla={controla} setControla={setControla} sobraMista={sobraMista} setSobraMista={setSobraMista} />
          {!sobraMista && <CampoPesoPeca value={pesoPeca} onChange={setPesoPeca} />}
          {ligandoControle && (
            <p className="text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-lg">
              Informe em <strong>Qtd Atual</strong> a quantidade contada no inventário. A partir de agora a saída passa a exigir saldo.
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Código de Barras / QR Code</label>
            <div className="flex gap-2">
              <input className="field font-mono flex-1" value={codigoBarras} onChange={e => setCodigoBarras(e.target.value)}
                placeholder="Escaneie ou digite manualmente" />
              <button type="button" onClick={() => setShowScanner(true)}
                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border border-[#E2E8F0] hover:bg-[#EEF2FF] hover:border-[#4F7CFF] transition-colors text-[#64748B] hover:text-[#4F7CFF]"
                title="Escanear com câmera">
                <Camera size={18} />
              </button>
            </div>
          </div>
          {showScanner && (
            <BarcodeScannerModal
              onScanned={code => { setCodigoBarras(code); setShowScanner(false) }}
              onClose={() => setShowScanner(false)}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Qtd Atual</label>
              <input type="number" step="any" inputMode="decimal" className="field" value={qtdAtual} onChange={e => setQtdAtual(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Qtd Mínima</label>
              <input type="number" step="any" inputMode="decimal" className="field" value={qtdMin} onChange={e => setQtdMin(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">{sobraMista ? 'Preço por kg (R$)' : 'Preço Unitário (R$) — CMP'}</label>
            <input type="number" step="0.0001" min="0" inputMode="decimal" className="field" placeholder="0,00"
              value={precoUnitario} onChange={e => setPrecoUnitario(e.target.value)} />
            <p className="text-xs text-[#94A3B8] mt-1">
              {sobraMista
                ? 'Valor médio do kg de fixação misturada. É o crédito que a obra recebe por kg de sobra devolvida.'
                : controla
                  ? 'Custo médio ponderado atual. Será recalculado automaticamente em novas entradas.'
                  : 'Preço de referência: é o custo lançado na obra a cada saída. Atualize quando o preço de compra mudar.'}
            </p>
          </div>
          {(parseFloat(qtdAtual) !== qtdOriginal || ligandoControle) && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                Motivo do ajuste <span className="text-[#94A3B8] font-normal">(de {qtdOriginal} → {qtdAtual || 0})</span>
              </label>
              <input className="field" placeholder={ligandoControle ? 'Inventário inicial' : 'Ex: Ajuste após inventário físico'}
                value={motivoAjuste} onChange={e => setMotivoAjuste(e.target.value)} />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Foto do Produto</label>
            <div className="flex items-center gap-3">
              {fotoUrl
                ? <Image src={fotoUrl} alt="foto" width={64} height={64} className="w-16 h-16 rounded-lg object-cover border border-[#E2E8F0]" />
                : <div className="w-16 h-16 rounded-lg bg-[#F1F5F9] flex items-center justify-center border border-dashed border-[#CBD5E1]">
                    <Package size={20} className="text-[#94A3B8]" />
                  </div>
              }
              <label className="flex-1 cursor-pointer flex items-center gap-2 px-3 py-2 border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] text-sm text-[#64748B] transition-colors">
                {uploadingFoto ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploadingFoto ? 'Enviando...' : fotoUrl ? 'Trocar foto' : 'Adicionar foto'}
                <input type="file" accept="image/*,.heic,.heif" className="hidden" disabled={uploadingFoto}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFoto(f) }} />
              </label>
              {fotoUrl && (
                <button type="button" onClick={() => setFotoUrl('')} aria-label="Remover foto" title="Remover foto" className="p-2 text-[#94A3B8] hover:text-red-500 transition-colors">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal devolução ───────────────────────────────────
function ModalDevolucao({ registro, produtos, onClose, onSaved }: {
  registro: EstoqueRegistro; produtos: EstoqueProduto[]
  onClose: () => void; onSaved: () => void
}) {
  const [qtd, setQtd] = useState('')
  const [responsavel, setResponsavel] = useState(registro.responsavel)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Quanto já voltou desta saída: consulta o banco (a lista pode não ter todos os registros carregados)
  const [jaDevolvido, setJaDevolvido] = useState<number | null>(null)

  useEffect(() => {
    createClient().from('estoque_registros').select('quantidade').eq('registro_origem_id', registro.id)
      .then(({ data, error }) => {
        if (error) { setError(mensagemErro(error, 'Erro ao consultar devoluções anteriores')); return }
        setJaDevolvido(arred((data ?? []).reduce((s, r) => s + Number(r.quantidade), 0)))
      })
  }, [registro.id])

  const produto = produtos.find(p => p.id === registro.produto_id)
  const qtdNum = numeroOuPadrao(qtd, 0)
  const precoAtual = produto?.preco_unitario || registro.preco_unitario_custo || 0
  const valorCredito = qtdNum * precoAtual
  const restante = arred(registro.quantidade - (jaDevolvido ?? 0))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (jaDevolvido === null) return
    if (!qtdNum || qtdNum <= 0) { setError('Informe a quantidade a devolver.'); return }
    if (qtdNum > restante) {
      setError(`Não pode devolver mais do que o saldo ainda não devolvido (${restante} ${registro.unidade ?? ''}).`)
      return
    }
    setSaving(true)
    setError('')
    const supabase = createClient()

    // Novo registro de entrada representando a devolução, ligado à saída original
    const { error: regErr } = await supabase.from('estoque_registros').insert({
      estoque_id: registro.estoque_id,
      produto_id: registro.produto_id ?? null,
      produto_nome: registro.produto_nome,
      tipo: 'entrada',
      quantidade: qtdNum,
      unidade: registro.unidade ?? 'un',
      responsavel: responsavel.trim(),
      data: hojeLocal(),
      obra_id: registro.obra_id ?? null,
      preco_unitario_custo: precoAtual || null,
      valor_total: valorCredito || null,
      registro_origem_id: registro.id,
      observacoes: `Devolução de saída de ${formatarData(registro.data)}`,
    })

    if (regErr) { setError(mensagemErro(regErr, 'Erro ao registrar a devolução')); setSaving(false); return }

    // Atualiza estoque (soma no banco) e CMP do produto
    if (produto) {
      const { saldo, error: errSaldo } = await ajustarSaldo(supabase, produto.id, qtdNum, { pisoZero: !controlaSaldo(produto) })
      if (errSaldo) {
        // A devolução já foi gravada: não deixa tentar de novo (duplicaria)
        alert(mensagemErro(errSaldo, 'Devolução registrada, mas o saldo do produto não foi atualizado. Ajuste o saldo em Produtos'))
        setSaving(false); onSaved(); return
      }
      if (precoAtual > 0 && controlaSaldo(produto) && saldo !== null) {
        // Recalcula CMP incluindo o retorno
        const anterior = saldo - qtdNum
        const cmpAtual = produto.preco_unitario || 0
        const novoCMP = anterior > 0 && saldo > 0
          ? (anterior * cmpAtual + qtdNum * precoAtual) / saldo
          : precoAtual
        const { error: errCmp } = await supabase.from('estoque_produtos').update({ preco_unitario: novoCMP }).eq('id', produto.id)
        if (errCmp) alert(mensagemErro(errCmp, 'Devolução registrada, mas o custo médio não foi atualizado'))
      }
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[420px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div>
            <h3 className="font-syne font-semibold text-[#0F172A]">Registrar Devolução</h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">{registro.produto_nome}</p>
          </div>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Info da saída original */}
          <div className="bg-[#FFF7ED] border border-orange-100 rounded-lg px-3 py-2.5 text-xs text-orange-800 space-y-1">
            <p>Saída original: <strong>{registro.quantidade} {registro.unidade ?? ''}</strong> em {formatarData(registro.data)}</p>
            {jaDevolvido === null && <p>Consultando devoluções anteriores…</p>}
            {jaDevolvido !== null && jaDevolvido > 0 && <p>Já devolvido: <strong>{jaDevolvido} {registro.unidade ?? ''}</strong> · saldo restante: <strong>{restante} {registro.unidade ?? ''}</strong></p>}
            {precoAtual > 0 && <p>Preço atual do item (CMP): <strong>{precoAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              Quantidade a devolver * <span className="text-[#94A3B8] font-normal">(máx. {restante} {registro.unidade ?? ''})</span>
            </label>
            <input
              type="number" step="any" min="0" max={restante} inputMode="decimal"
              className="field" placeholder="0" autoFocus
              value={qtd} onChange={e => setQtd(e.target.value)}
            />
            {!!produto?.peso_unitario_g && <div className="mt-2"><PesoParaQuantidade pesoUnitarioG={produto.peso_unitario_g} unidade={registro.unidade} onQuantidade={setQtd} /></div>}
            {qtdNum > 0 && precoAtual > 0 && (
              <p className="text-xs text-emerald-600 mt-1">
                Crédito à obra: {valorCredito.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Responsável *</label>
            <input required className="field" value={responsavel} onChange={e => setResponsavel(e.target.value)} />
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg">Cancelar</button>
            <button type="submit" disabled={saving || jaDevolvido === null} className="btn-primary text-sm">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
              {saving ? 'Registrando...' : 'Confirmar Devolução'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal editar estoque ──────────────────────────────
function ModalEditarEstoque({ estoque, onClose, onSaved }: { estoque: Estoque; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(estoque.nome)
  const [descricao, setDescricao] = useState(estoque.descricao ?? '')
  const [cor, setCor] = useState(estoque.cor)
  const [icone, setIcone] = useState(estoque.icone)
  const [ativo, setAtivo] = useState(estoque.ativo !== false)
  const [loading, setLoading] = useState(false)

  const ICONE_MAP_FULL: Record<string, React.ReactNode> = {
    shield: <Shield size={20} />, sparkles: <Sparkles size={20} />,
    thermometer: <Thermometer size={20} />, shirt: <Shirt size={20} />,
    droplets: <Droplets size={20} />, package: <Package size={20} />,
    wrench: <Wrench size={20} />, building2: <Building2 size={20} />, hammer: <Hammer size={20} />,
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('estoques').update({ nome, descricao: descricao || null, cor, icone, ...(estoque.ativo !== undefined ? { ativo } : {}) }).eq('id', estoque.id)
    setLoading(false)
    if (error) { alert(mensagemErro(error, 'Erro ao salvar o estoque')); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">Editar Estoque</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={salvar} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome *</label>
            <input required className="field" value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Descrição</label>
            <input className="field" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Ícone</label>
            <div className="flex gap-2 flex-wrap">
              {ICONES.map(ic => (
                <button key={ic} type="button" onClick={() => setIcone(ic)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 transition-colors ${icone === ic ? 'border-[#4F7CFF] bg-[#EEF2FF]' : 'border-[#E2E8F0]'}`}
                  style={{ color: icone === ic ? '#4F7CFF' : '#64748B' }}>
                  {ICONE_MAP_FULL[ic]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {CORES.map(c => (
                <button key={c} type="button" onClick={() => setCor(c)}
                  className={`w-8 h-8 rounded-full border-4 transition-all ${cor === c ? 'border-white ring-2 ring-offset-1 ring-[#4F7CFF] scale-110' : 'border-white'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {estoque.ativo !== undefined && (
            <label className="flex items-center gap-2 text-sm text-[#374151] cursor-pointer">
              <input type="checkbox" className="rounded" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
              Estoque ativo <span className="text-xs text-[#94A3B8]">(desativado some da lista, sem apagar nada)</span>
            </label>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Adicionar produto inline ──────────────────────────
function AddProdutoInline({ estoqueId, estoqueIcone, categorias, onAdded }: { estoqueId: string; estoqueIcone: string; categorias: EstoqueProdutoCategoria[]; onAdded: () => void }) {
  const [show, setShow] = useState(false)
  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')
  const [codigoBarras, setCodigoBarras] = useState('')
  const [tamanho, setTamanho] = useState('')
  const [unidade, setUnidade] = useState('un')
  const [qtdMin, setQtdMin] = useState('0')
  const [qtdInicial, setQtdInicial] = useState('')
  const [preco, setPreco] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [controla, setControla] = useState(true)
  const [sobraMista, setSobraMista] = useState(false)
  const [pesoPeca, setPesoPeca] = useState('')
  const [loading, setLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  async function salvar() {
    if (!nome.trim()) return
    setLoading(true)
    const supabase = createClient()
    const qtd = numeroOuPadrao(qtdInicial, 0)
    const { data: novo, error } = await supabase.from('estoque_produtos').insert({
      estoque_id: estoqueId, nome: nome.trim(),
      codigo: codigo || null,
      codigo_barras: codigoBarras || null,
      tamanho: tamanho.trim() || null,
      unidade, quantidade_minima: numeroOuPadrao(qtdMin, 0),
      quantidade_atual: qtd,
      preco_unitario: preco ? numeroOuPadrao(preco, 0) : null,
      categoria_id: categoriaId || null,
      controla_saldo: controla,
      sobra_mista: sobraMista,
      ...(!sobraMista && numeroOuPadrao(pesoPeca, 0) > 0 ? { peso_unitario_g: numeroOuPadrao(pesoPeca, 0) } : {}),
    }).select('id').single()
    if (error) { setLoading(false); alert(mensagemErro(error, 'Erro ao cadastrar o produto')); return }
    if (novo && qtd !== 0) {
      const { error: errLog } = await supabase.from('estoque_logs').insert({
        produto_id: novo.id, estoque_id: estoqueId, tipo: 'ajuste_manual',
        quantidade_anterior: 0, quantidade_nova: qtd, motivo: 'Inventário inicial',
      })
      if (errLog) alert(mensagemErro(errLog, 'Produto cadastrado, mas o histórico do inventário inicial não foi gravado'))
    }
    setNome(''); setCodigo(''); setCodigoBarras(''); setTamanho(''); setUnidade('un'); setQtdMin('0')
    setQtdInicial(''); setPreco(''); setSobraMista(false); setPesoPeca('')
    setShow(false); setLoading(false)
    onAdded()
  }

  if (!show) return (
    <button onClick={() => setShow(true)} className="flex items-center gap-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] px-3 py-2 rounded-lg transition-colors">
      <Plus size={14} /> Adicionar produto
    </button>
  )

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-[#64748B] mb-1">Nome *</label>
          <input autoFocus className="field text-sm" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do produto" />
        </div>
        <div className="w-32">
          <label className="block text-xs font-medium text-[#64748B] mb-1">{estoqueIcone === 'shield' ? 'Código / Nº CA' : 'Inf. Adicionais'}</label>
          <input className="field text-sm" value={codigo} onChange={e => setCodigo(e.target.value)} placeholder={estoqueIcone === 'shield' ? 'Ex: CA-12345' : 'Opcional'} />
        </div>
        <div className="w-24">
          <label className="block text-xs font-medium text-[#64748B] mb-1">Tamanho</label>
          <input className="field text-sm" value={tamanho} onChange={e => setTamanho(e.target.value)} placeholder="M, 38..." />
        </div>
        <div className="w-24">
          <label className="block text-xs font-medium text-[#64748B] mb-1">Unidade</label>
          <input className="field text-sm" value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="un" />
        </div>
        <div className="w-24">
          <label className="block text-xs font-medium text-[#64748B] mb-1">Qtd Mín.</label>
          <input type="number" step="any" inputMode="decimal" className="field text-sm" value={qtdMin} onChange={e => setQtdMin(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        {categorias.length > 0 && (
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-[#64748B] mb-1">Categoria</label>
            <select className="field text-sm" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
              <option value="">Sem categoria</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        )}
        <div className="w-32">
          <label className="block text-xs font-medium text-[#64748B] mb-1">{sobraMista ? 'R$ por kg' : 'Preço unit. (R$)'}</label>
          <input type="number" step="0.0001" min="0" inputMode="decimal" className="field text-sm" value={preco} onChange={e => setPreco(e.target.value)} placeholder="0,00" />
        </div>
        {controla && (
          <div className="w-32">
            <label className="block text-xs font-medium text-[#64748B] mb-1">Qtd contada</label>
            <input type="number" step="any" inputMode="decimal" className="field text-sm" value={qtdInicial} onChange={e => setQtdInicial(e.target.value)} placeholder="0" />
          </div>
        )}
      </div>
      <ControleSaldoOpcoes controla={controla} setControla={setControla} sobraMista={sobraMista} setSobraMista={setSobraMista} />
      {!sobraMista && (
        <div className="max-w-xs">
          <CampoPesoPeca compacto value={pesoPeca} onChange={setPesoPeca} />
        </div>
      )}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-[#64748B] mb-1">Código de Barras / QR Code</label>
          <div className="flex gap-2">
            <input className="field text-sm font-mono flex-1" value={codigoBarras} onChange={e => setCodigoBarras(e.target.value)} placeholder="Escaneie ou digite manualmente" />
            <button type="button" onClick={() => setShowScanner(true)}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border border-[#E2E8F0] hover:bg-[#EEF2FF] hover:border-[#4F7CFF] transition-colors text-[#64748B] hover:text-[#4F7CFF]"
              title="Escanear com câmera">
              <Camera size={16} />
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={salvar} disabled={loading} className="btn-primary text-sm py-2">{loading ? 'Salvando…' : 'Salvar'}</button>
          <button onClick={() => setShow(false)} aria-label="Fechar" title="Fechar" className="px-3 py-2 text-sm text-[#64748B] hover:bg-[#F1F5F9] rounded-lg"><X size={14} /></button>
        </div>
      </div>
      {showScanner && (
        <BarcodeScannerModal
          onScanned={code => { setCodigoBarras(code); setShowScanner(false) }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  )
}

// ── Configurar campos customizados ────────────────────
const TIPO_CAMPO_LABEL: Record<string, string> = { text: 'texto', number: 'número', date: 'data', unit: 'unidade de medida' }

function ConfigurarCampos({ estoqueId, campos, onUpdated }: { estoqueId: string; campos: EstoqueCampo[]; onUpdated: () => void }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editando, setEditando] = useState<EstoqueCampo | null>(null)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<'text' | 'number' | 'date' | 'unit'>('text')
  const [obrigatorio, setObrigatorio] = useState(false)
  const [loading, setLoading] = useState(false)

  function abrirEdicao(c: EstoqueCampo) {
    setEditando(c); setNome(c.nome); setTipo(c.tipo); setObrigatorio(c.obrigatorio); setShowAdd(true)
  }
  function fecharForm() {
    setNome(''); setTipo('text'); setObrigatorio(false); setEditando(null); setShowAdd(false)
  }

  async function salvarCampo() {
    if (!nome.trim()) return
    setLoading(true)
    const supabase = createClient()
    const { error } = editando
      ? await supabase.from('estoque_campos').update({ nome: nome.trim(), tipo, obrigatorio }).eq('id', editando.id)
      : await supabase.from('estoque_campos').insert({
          estoque_id: estoqueId, nome: nome.trim(), tipo, obrigatorio, ordem: campos.length,
        })
    setLoading(false)
    if (error) { alert(mensagemErro(error, 'Erro ao salvar o campo')); return }
    fecharForm()
    onUpdated()
  }

  async function excluirCampo(c: EstoqueCampo) {
    if (!confirm(`Excluir o campo "${c.nome}"? Os dados já registrados nele serão perdidos.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('estoque_campos').delete().eq('id', c.id)
    if (error) { alert(mensagemErro(error, 'Erro ao excluir o campo')); return }
    onUpdated()
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div className="card">
        <h3 className="font-syne font-semibold text-[#0F172A] mb-1">Campos customizados</h3>
        <p className="text-xs text-[#64748B] mb-4">Campos extras que aparecem em cada registro deste estoque. Data, Produto, Qtd, Responsável e Assinatura são sempre incluídos.</p>
        <div className="space-y-2">
          {campos.length === 0 && <p className="text-sm text-[#94A3B8]">Nenhum campo extra configurado.</p>}
          {campos.map(c => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
              <div>
                <span className="text-sm font-medium text-[#374151]">{c.nome}</span>
                <span className="ml-2 text-xs text-[#94A3B8]">{TIPO_CAMPO_LABEL[c.tipo] ?? c.tipo}{c.obrigatorio ? ' · obrigatório' : ''}</span>
              </div>
              <div className="flex items-center">
                <button onClick={() => abrirEdicao(c)} aria-label={`Editar campo ${c.nome}`} title="Editar campo" className="p-2 text-[#94A3B8] hover:text-[#4F7CFF] transition-colors">
                  <Pencil size={14} />
                </button>
                <button onClick={() => excluirCampo(c)} aria-label={`Excluir campo ${c.nome}`} title="Excluir campo" className="p-2 text-[#94A3B8] hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        {showAdd ? (
          <div className="mt-4 pt-4 border-t border-[#E2E8F0] space-y-3">
            {editando && <p className="text-xs font-semibold text-[#4F7CFF]">Editando campo &quot;{editando.nome}&quot;</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Nome *</label>
                <input autoFocus className="field text-sm" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Nº CA" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Tipo</label>
                <select className="field text-sm" value={tipo} onChange={e => setTipo(e.target.value as typeof tipo)}>
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="date">Data</option>
                  <option value="unit">Unidade de medida</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-[#374151] cursor-pointer">
              <input type="checkbox" checked={obrigatorio} onChange={e => setObrigatorio(e.target.checked)} className="rounded" />
              Campo obrigatório
            </label>
            <div className="flex gap-2">
              <button onClick={salvarCampo} disabled={loading} className="btn-primary text-sm py-2">{loading ? 'Salvando…' : editando ? 'Salvar' : 'Adicionar'}</button>
              <button onClick={fecharForm} className="px-3 py-2 text-sm text-[#64748B] hover:bg-[#F1F5F9] rounded-lg">Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} className="mt-4 flex items-center gap-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] px-3 py-2 rounded-lg transition-colors w-full justify-center border border-dashed border-[#4F7CFF]">
            <Plus size={14} /> Adicionar campo
          </button>
        )}
      </div>
    </div>
  )
}

// ── Modal detalhe do registro ──────────────────────────
function ModalDetalheRegistro({ registro, campos, estoqueIcone, podeDevolver, onDevolver, onEditar, onExcluir, onClose }: {
  registro: EstoqueRegistro; campos: EstoqueCampo[]; estoqueIcone: string
  podeDevolver: boolean; onDevolver: () => void; onEditar: () => void; onExcluir: () => void; onClose: () => void
}) {
  const campoPorId = new Map(campos.map(c => [c.id, c.nome]))
  const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const podeImprimir = (estoqueIcone === 'shield' || estoqueIcone === 'shirt') && registro.tipo === 'saida'
  const linkImprimir = registro.lote_id ? `/print/epi-lote/${registro.lote_id}` : `/print/epi/${registro.id}`

  const linhas: { label: string; valor: React.ReactNode }[] = [
    { label: 'Data', valor: formatarData(registro.data) },
    { label: 'Tipo', valor: registro.tipo === 'saida' ? 'Saída' : 'Entrada' },
    { label: 'Produto', valor: registro.produto_nome },
    { label: 'Quantidade', valor: `${registro.quantidade} ${registro.unidade ?? ''}` },
    { label: 'Destino', valor: destinoLabel(registro) },
    { label: 'Responsável', valor: registro.responsavel },
  ]
  if (registro.preco_unitario_custo) linhas.push({ label: 'Preço unitário (CMP)', valor: moeda(registro.preco_unitario_custo) })
  if (registro.valor_total) linhas.push({ label: 'Valor total', valor: moeda(registro.valor_total) })
  if (registro.observacoes) linhas.push({ label: 'Observações', valor: registro.observacoes })

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-syne font-semibold text-[#0F172A]">Detalhe do Registro</h3>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-5 space-y-3">
          {linhas.map(l => (
            <div key={l.label} className="flex items-start justify-between gap-4 text-sm">
              <span className="text-[#64748B] shrink-0">{l.label}</span>
              <span className="text-[#0F172A] font-medium text-right">{l.valor}</span>
            </div>
          ))}
          {registro.valores && registro.valores.length > 0 && (
            <div className="pt-2 border-t border-[#F1F5F9] space-y-2">
              {registro.valores.map(v => (
                <div key={v.id} className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-[#64748B] shrink-0">{campoPorId.get(v.campo_id) ?? 'Campo'}</span>
                  <span className="text-[#0F172A] font-medium text-right">{v.valor}</span>
                </div>
              ))}
            </div>
          )}
          {registro.assinatura_url && (
            <div className="pt-3 border-t border-[#F1F5F9]">
              <p className="text-xs text-[#64748B] mb-1.5">Assinatura</p>
              <div className="relative h-16 w-48"><Image src={registro.assinatura_url} alt="assinatura" fill sizes="192px" className="object-contain border border-[#E2E8F0] rounded-lg" /></div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-[#F1F5F9]">
          <button onClick={onExcluir}
            className="mr-auto flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={14} /> Excluir
          </button>
          {podeDevolver && (
            <button onClick={onDevolver}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors">
              <Undo2 size={14} /> Devolver
            </button>
          )}
          <button onClick={onEditar}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#4F7CFF] border border-[#C7D2FE] rounded-lg hover:bg-[#EEF2FF] transition-colors">
            <Pencil size={14} /> Editar
          </button>
          {podeImprimir && (
            <a href={linkImprimir} target="_blank" rel="noreferrer"
              className="px-4 py-2 text-sm font-medium text-[#4F7CFF] border border-[#4F7CFF] rounded-lg hover:bg-[#EEF2FF] transition-colors">
              Ver termo/contrato
            </a>
          )}
          <button onClick={onClose} className="btn-primary">Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ── Opções de controle de saldo (novo/editar produto) ─
function ControleSaldoOpcoes({ controla, setControla, sobraMista, setSobraMista }: {
  controla: boolean; setControla: (v: boolean) => void; sobraMista: boolean; setSobraMista: (v: boolean) => void
}) {
  return (
    <div className="space-y-2 px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
      <label className="flex items-start gap-2 text-sm text-[#374151] cursor-pointer">
        <input type="checkbox" className="rounded mt-0.5" checked={controla}
          onChange={e => { setControla(e.target.checked); if (e.target.checked) setSobraMista(false) }} />
        <span>
          Controlar saldo
          <span className="block text-xs text-[#94A3B8]">
            {controla
              ? 'Item contado: a saída exige saldo e o estoque mostra quanto há no galpão.'
              : 'Item não contado (ex.: parafuso): a saída para a obra é livre e lança o custo pelo preço de referência. O saldo mostra só o que voltou de obra.'}
          </span>
        </span>
      </label>
      {!controla && (
        <label className="flex items-start gap-2 text-sm text-[#374151] cursor-pointer">
          <input type="checkbox" className="rounded mt-0.5" checked={sobraMista} onChange={e => setSobraMista(e.target.checked)} />
          <span>
            Item de sobra mista (kg)
            <span className="block text-xs text-[#94A3B8]">Recebe a sobra misturada que volta da obra, pesada na balança e creditada pelo R$/kg.</span>
          </span>
        </label>
      )}
    </div>
  )
}

// ── Inventário: contar vários produtos de uma vez ─────
function ModalInventario({ produtos, categorias, onClose, onSaved }: {
  produtos: EstoqueProduto[]; categorias: EstoqueProdutoCategoria[]; onClose: () => void; onSaved: () => void
}) {
  const [contagem, setContagem] = useState<Record<string, string>>({})
  const [categoriaId, setCategoriaId] = useState('')
  const [busca, setBusca] = useState('')
  const [motivo, setMotivo] = useState('Inventário')
  const [saving, setSaving] = useState(false)

  const lista = produtos.filter(p => !p.sobra_mista)
    .filter(p => !categoriaId || p.categoria_id === categoriaId)
    .filter(p => !busca.trim() || p.nome.toLowerCase().includes(busca.toLowerCase()))
  const preenchidos = produtos.filter(p => (contagem[p.id] ?? '').trim() !== '' && !isNaN(parseNumeroBR(contagem[p.id])))

  async function salvar() {
    if (preenchidos.length === 0) return
    setSaving(true)
    const supabase = createClient()
    const falhas: string[] = []
    for (const p of preenchidos) {
      // Inventário é contagem absoluta: grava o valor contado
      const nova = parseNumeroBR(contagem[p.id])
      const { error } = await supabase.from('estoque_produtos').update({ quantidade_atual: nova, controla_saldo: true }).eq('id', p.id)
      if (error) { falhas.push(`${p.nome}: ${mensagemErro(error)}`); continue }
      const { error: errLog } = await supabase.from('estoque_logs').insert({
        produto_id: p.id, estoque_id: p.estoque_id, tipo: 'ajuste_manual',
        quantidade_anterior: p.quantidade_atual, quantidade_nova: nova,
        motivo: controlaSaldo(p) ? (motivo.trim() || 'Inventário') : 'Inventário inicial',
      })
      if (errLog) console.error('Inventário: histórico não gravado', p.nome, errLog)
      // Já gravado: sai da contagem para um novo "Salvar" não repetir
      setContagem(c => { const n = { ...c }; delete n[p.id]; return n })
    }
    setSaving(false)
    if (falhas.length > 0) {
      alert(`${preenchidos.length - falhas.length} item(ns) salvo(s). Não foi possível salvar:\n• ${falhas.join('\n• ')}\n\nOs itens que falharam continuam preenchidos para tentar de novo.`)
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div>
            <h3 className="font-syne font-semibold text-[#0F172A]">Lançar inventário</h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">Preencha só o que foi contado. Itens contados passam a ter o saldo controlado.</p>
          </div>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-[#F1F5F9]">
          <input className="field text-sm flex-1 min-w-[160px]" placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} />
          {categorias.length > 0 && (
            <select className="field text-sm w-auto" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
              <option value="">Todas as categorias</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}
        </div>
        <div className="overflow-y-auto flex-1">
          <table className="w-full">
            <thead className="sticky top-0 bg-[#F8FAFC]">
              <tr className="border-b border-[#E2E8F0]">
                <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2">Produto</th>
                <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2">No sistema</th>
                <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2 w-36">Contado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(p => {
                const val = contagem[p.id] ?? ''
                const dif = val.trim() !== '' ? arred(parseNumeroBR(val) - p.quantidade_atual) : 0
                return (
                  <tr key={p.id} className="border-b border-[#F1F5F9]">
                    <td className="px-4 py-2 text-sm text-[#0F172A]">
                      {p.nome}
                      {!controlaSaldo(p) && <span className="ml-2 text-[10px] text-[#94A3B8]">sem controle</span>}
                    </td>
                    <td className="px-4 py-2 text-sm text-[#64748B]">{p.quantidade_atual} {p.unidade}</td>
                    <td className="px-4 py-2">
                      <input type="text" inputMode="decimal" className="field text-sm py-1.5" value={val}
                        onChange={e => setContagem(c => ({ ...c, [p.id]: e.target.value }))} />
                      {val.trim() !== '' && dif !== 0 && controlaSaldo(p) && (
                        <p className={`text-[10px] mt-0.5 ${dif < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{dif > 0 ? '+' : ''}{dif} {p.unidade}</p>
                      )}
                    </td>
                  </tr>
                )
              })}
              {lista.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-[#94A3B8]">Nenhum produto encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-[#E2E8F0]">
          <input className="field text-sm flex-1 min-w-[160px]" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo (ex.: Inventário mensal)" />
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg">Cancelar</button>
            <button onClick={salvar} disabled={saving || preenchidos.length === 0} className="btn-primary text-sm flex items-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={14} />}
              {saving ? 'Salvando…' : `Salvar ${preenchidos.length > 0 ? `${preenchidos.length} item(ns)` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Categorias de produto ─────────────────────────────
function ConfigurarCategorias({ estoqueId, categorias, onUpdated }: { estoqueId: string; categorias: EstoqueProdutoCategoria[]; onUpdated: () => void }) {
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(CORES[0])
  const [editando, setEditando] = useState<EstoqueProdutoCategoria | null>(null)
  const [saving, setSaving] = useState(false)

  async function salvar() {
    if (!nome.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { error } = editando
      ? await supabase.from('estoque_produto_categorias').update({ nome: nome.trim(), cor }).eq('id', editando.id)
      : await supabase.from('estoque_produto_categorias').insert({ estoque_id: estoqueId, nome: nome.trim(), cor, ordem: categorias.length + 1 })
    if (error) { setSaving(false); alert(mensagemErro(error, 'Erro ao salvar a categoria')); return }
    setNome(''); setCor(CORES[0]); setEditando(null); setSaving(false)
    onUpdated()
  }

  async function excluir(c: EstoqueProdutoCategoria) {
    if (!confirm(`Excluir a categoria "${c.nome}"? Os produtos dela ficam sem categoria.`)) return
    const { error } = await createClient().from('estoque_produto_categorias').delete().eq('id', c.id)
    if (error) { alert(mensagemErro(error, 'Erro ao excluir a categoria')); return }
    onUpdated()
  }

  return (
    <div className="card max-w-lg">
      <h3 className="font-syne font-semibold text-[#0F172A] mb-1">Categorias de produto</h3>
      <p className="text-xs text-[#64748B] mb-4">Agrupam os produtos na lista e o custo de material na obra (ex.: quanto a obra gastou de Fixação).</p>
      <div className="space-y-2">
        {categorias.length === 0 && <p className="text-sm text-[#94A3B8]">Nenhuma categoria criada.</p>}
        {categorias.map(c => (
          <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.cor }} />
              <span className="text-sm font-medium text-[#374151]">{c.nome}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setEditando(c); setNome(c.nome); setCor(c.cor) }} aria-label={`Editar categoria ${c.nome}`} title="Editar categoria" className="p-2 text-[#94A3B8] hover:text-[#4F7CFF]"><Pencil size={14} /></button>
              <button onClick={() => excluir(c)} aria-label={`Excluir categoria ${c.nome}`} title="Excluir categoria" className="p-2 text-[#94A3B8] hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-[#E2E8F0] space-y-3">
        <input className="field text-sm" value={nome} onChange={e => setNome(e.target.value)} placeholder={editando ? 'Nome da categoria' : 'Nova categoria (ex.: Fixação)'} />
        <div className="flex gap-2 flex-wrap">
          {CORES.map(c => (
            <button key={c} type="button" onClick={() => setCor(c)}
              className={`w-7 h-7 rounded-full border-4 transition-all ${cor === c ? 'border-white ring-2 ring-offset-1 ring-[#4F7CFF] scale-110' : 'border-white'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={salvar} disabled={saving || !nome.trim()} className="btn-primary text-sm py-2">{saving ? 'Salvando…' : editando ? 'Salvar' : 'Adicionar'}</button>
          {editando && (
            <button onClick={() => { setEditando(null); setNome(''); setCor(CORES[0]) }} className="px-3 py-2 text-sm text-[#64748B] hover:bg-[#F1F5F9] rounded-lg">Cancelar</button>
          )}
        </div>
      </div>
    </div>
  )
}
