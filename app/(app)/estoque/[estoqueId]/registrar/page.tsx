'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Eraser, Check, Loader2, Camera, ScanLine, AlertTriangle, FileText, Upload, Plus, Trash2, X, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Estoque, EstoqueCampo, EstoqueProduto, EstoqueProdutoCategoria } from '@/lib/types'
import { ajustarSaldo, controlaSaldo } from '@/lib/estoque/saldo'
import { hojeLocal, parseData } from '@/lib/datas'
import { arred, numeroOuPadrao, parseNumeroBR } from '@/lib/numero'
import { mensagemErro } from '@/lib/erros'
import Link from 'next/link'
import { lancarCustoAdministrativo, reporEstoqueManutencao } from '../registroVinculos'
import BarcodeScannerModal from '@/components/BarcodeScannerModal'
import { PesoParaQuantidade } from '@/components/PesoBalanca'
import FormSaidaEpiLote from './FormSaidaEpiLote'
import FormSaidaLoteLimpeza from './FormSaidaLoteLimpeza'
import FormSaidaLoteMateriais from './FormSaidaLoteMateriais'
import ModalNotaCompra from '@/components/ModalNotaCompra'
import { useAccess } from '@/lib/useAccess'
import type { Fornecedor } from '@/lib/fornecedores'
import type { NotaLida } from '@/lib/contasPagar'

// ── Tipos ─────────────────────────────────────────────
type ItemNF = { produtoId: string; produtoNome: string; quantidade: string; unidade: string; precoUnitario: string; valorTotal: string }
const ITEM_VAZIO = (): ItemNF => ({ produtoId: '', produtoNome: '', quantidade: '1', unidade: 'UN', precoUnitario: '', valorTotal: '' })

type NfItem = { codigo: string; descricao: string; quantidade: number; valorUnitario: number; valorTotal: number; unidade: string }
type NfData = NotaLida & { produtos?: NfItem[] }

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── Page principal ────────────────────────────────────
export default function RegistrarPage() {
  const { estoqueId } = useParams<{ estoqueId: string }>()
  const router = useRouter()
  const [estoque, setEstoque] = useState<Estoque | null>(null)
  const [campos, setCampos] = useState<EstoqueCampo[]>([])
  const [produtos, setProdutos] = useState<EstoqueProduto[]>([])
  const [loading, setLoading] = useState(true)

  // Tipo e modo de entrada
  const [tipo, setTipo] = useState<'saida' | 'entrada'>('saida')
  const [entradaModo, setEntradaModo] = useState<'escolha' | 'novo-registro'>('escolha')

  // Modais
  const [showLancarNF, setShowLancarNF] = useState(false)
  const [importandoNF, setImportandoNF] = useState(false)
  const [parsedNF, setParsedNF] = useState<NfData | null>(null)
  // Depois da entrada da NF, oferece lançar os boletos em Contas a pagar
  const { can } = useAccess()
  const [notaParaContas, setNotaParaContas] = useState<NotaLida | null>(null)
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])

  // Estado do formulário único (saída e novo-registro)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [produtoNome, setProdutoNome] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [unidade, setUnidade] = useState('un')
  const [responsavel, setResponsavel] = useState('')
  const [data, setData] = useState(hojeLocal())
  const [observacoes, setObservacoes] = useState('')
  const [valoresCampos, setValoresCampos] = useState<Record<string, string>>({})
  const [temAssinatura, setTemAssinatura] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [obraId, setObraId] = useState('')
  const [obras, setObras] = useState<{ id: string; titulo: string }[]>([])
  const [funcionarioId, setFuncionarioId] = useState('')
  const [funcionarios, setFuncionarios] = useState<{ id: string; nome: string; responsavel_entrega?: boolean }[]>([])
  const [destinoTipo, setDestinoTipo] = useState<'obra' | 'manutencao' | 'uso_interno'>('obra')
  const [manutencaoId, setManutencaoId] = useState('')
  const [manutencoes, setManutencoes] = useState<{ id: string; numero_contrato: string | null; empresa?: { razao_social: string; apelido?: string } | null }[]>([])
  const [precoEntrada, setPrecoEntrada] = useState('')
  const [categorias, setCategorias] = useState<EstoqueProdutoCategoria[]>([])
  // Cadastro rápido quando a saída é de um produto que ainda não está no catálogo
  const [novoCadastrar, setNovoCadastrar] = useState(true)
  const [novoPreco, setNovoPreco] = useState('')
  const [novoCategoriaId, setNovoCategoriaId] = useState('')

  // Produto cadastrado na hora numa tentativa anterior (não recria se o registro falhar e for reenviado)
  const produtoCriado = useRef<{ nome: string; prod: EstoqueProduto } | null>(null)
  const [termoUrl, setTermoUrl] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: est }, { data: cam }, { data: prod }, { data: obrasData }, { data: funcsData }, { data: manutData }, { data: cats }] = await Promise.all([
        supabase.from('estoques').select('*').eq('id', estoqueId).single(),
        supabase.from('estoque_campos').select('*').eq('estoque_id', estoqueId).order('ordem'),
        supabase.from('estoque_produtos').select('*').eq('estoque_id', estoqueId).eq('ativo', true).order('nome'),
        supabase.from('obras').select('id, titulo, status').in('status', ['Em Andamento', 'Aprovada', 'Em Orçamento']).order('titulo'),
        supabase.from('funcionarios').select('id, nome, responsavel_entrega').eq('ativo', true).order('nome'),
        supabase.from('contratos_manutencao').select('id, numero_contrato, empresa:empresas(razao_social, apelido)').eq('ativo', true),
        supabase.from('estoque_produto_categorias').select('*').eq('estoque_id', estoqueId).order('ordem').order('nome'),
      ])
      setCategorias(cats ?? [])
      setEstoque(est)
      setCampos(cam ?? [])
      setProdutos(prod ?? [])
      setObras(obrasData ?? [])
      setFuncionarios(funcsData ?? [])
      setManutencoes((manutData ?? []) as any)
      setLoading(false)
    }
    load()
  }, [estoqueId])

  useEffect(() => {
    if (tipo === 'entrada') {
      const prod = produtos.find(p => p.id === produtoId)
      if (prod?.preco_unitario) setPrecoEntrada(String(prod.preco_unitario))
    }
  }, [produtoId, tipo, produtos])

  useEffect(() => {
    const prod = produtos.find(p => p.id === produtoId)
    if (prod) {
      setUnidade(prod.unidade)
      setProdutoNome(prod.nome)
      if (prod.codigo && campos.length > 0) {
        const campoCA = campos.find(c => {
          const n = c.nome.toLowerCase().replace(/\s/g, '')
          return n === 'ca' || n === 'nºca' || n === 'noca' || n.includes('nºca') || n.includes('numeroca')
        })
        if (campoCA) setValoresCampos(v => ({ ...v, [campoCA.id]: prod.codigo! }))
      }
    }
  }, [produtoId, produtos, campos])

  function handleScanned(code: string) {
    setShowScanner(false)
    const found = produtos.find(p => (p as any).codigo_barras === code || p.codigo === code)
    if (found) {
      setProdutoId(found.id); setProdutoNome(found.nome)
      setScanMsg(`✓ Produto encontrado: ${found.nome}`)
    } else {
      setProdutoId('__outro__'); setProdutoNome(code)
      setScanMsg(`Produto não cadastrado. Código: ${code}`)
    }
    setTimeout(() => setScanMsg(''), 4000)
  }

  // Canvas
  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }
  function startDraw(e: React.MouseEvent | React.TouchEvent) { e.preventDefault(); isDrawing.current = true; lastPos.current = getPos(e); setTemAssinatura(true) }
  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault(); if (!isDrawing.current) return
    const canvas = canvasRef.current!; const ctx = canvas.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#0F172A'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke()
    lastPos.current = pos
  }
  function stopDraw(e: React.MouseEvent | React.TouchEvent) { e.preventDefault(); isDrawing.current = false }
  function limparCanvas() { const canvas = canvasRef.current!; canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height); setTemAssinatura(false) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const icone = estoque?.icone
    const needsFuncionario = icone === 'shield' || icone === 'shirt'
    const isLimpeza = icone === 'sparkles'
    const isCopa = estoque?.nome === 'Copa/Escritório'
    const isDestinoMultiplo = !needsFuncionario && !isLimpeza && !isCopa
    if (!produtoNome.trim()) { setError('Informe o produto.'); return }
    if (!(numeroOuPadrao(quantidade, 0) > 0)) { setError('Informe a quantidade.'); return }
    if (!responsavel.trim()) { setError('Informe o responsável.'); return }
    if (tipo === 'saida' && produtoId && produtoId !== '__outro__') {
      const prod = produtos.find(p => p.id === produtoId)
      if (prod && controlaSaldo(prod) && prod.quantidade_atual - numeroOuPadrao(quantidade, 0) < 0) {
        setError(`Saldo insuficiente! Estoque atual: ${prod.quantidade_atual} ${prod.unidade}.`); return
      }
    }
    if (tipo === 'saida') {
      if (needsFuncionario && !funcionarioId) { setError('Selecione o funcionário de destino.'); return }
      if (isLimpeza && destinoTipo === 'obra' && !obraId) { setError('Selecione a obra de destino.'); return }
      if (isLimpeza && destinoTipo === 'manutencao' && !manutencaoId) { setError('Selecione o contrato de manutenção de destino.'); return }
      if (isLimpeza && destinoTipo === 'manutencao' && (!produtoId || produtoId === '__outro__')) { setError('Para destino Manutenção, selecione um produto do catálogo.'); return }
      if (isDestinoMultiplo && !funcionarioId) { setError('Selecione o funcionário de destino.'); return }
      if (isDestinoMultiplo && destinoTipo === 'obra' && !obraId) { setError('Selecione a obra de destino.'); return }
      if (isDestinoMultiplo && destinoTipo === 'manutencao' && !manutencaoId) { setError('Selecione o contrato de manutenção de destino.'); return }
      if (isDestinoMultiplo && destinoTipo === 'manutencao' && (!produtoId || produtoId === '__outro__')) { setError('Para destino Manutenção, selecione um produto do catálogo.'); return }
    }
    if (tipo === 'entrada' && !precoEntrada) { setError('Informe o preço unitário desta entrada.'); return }

    setSaving(true); setError('')
    const supabase = createClient()
    // Termo de EPI: a aba precisa abrir no clique (depois de await o iPhone bloqueia o pop-up)
    const abaTermo = tipo === 'saida' && needsFuncionario ? window.open('', '_blank') : null

    let assinatura_url: string | null = null
    if (temAssinatura && canvasRef.current) {
      const blob = await new Promise<Blob | null>(res => canvasRef.current!.toBlob(res, 'image/png'))
      if (blob) {
        const path = `${estoqueId}/${Date.now()}.png`
        const { error: upErr } = await supabase.storage.from('assinaturas').upload(path, blob)
        if (upErr) { abaTermo?.close(); setError(mensagemErro(upErr, 'Não foi possível enviar a assinatura')); setSaving(false); return }
        const { data: urlData } = supabase.storage.from('assinaturas').getPublicUrl(path)
        assinatura_url = urlData.publicUrl
      }
    }

    const qtd = numeroOuPadrao(quantidade, 0)
    let prod = produtos.find(p => p.id === produtoId)
    let produtoIdFinal = produtoId && produtoId !== '__outro__' ? produtoId : ''
    const produtoNovo = !produtoIdFinal
    const isEpiSaida = estoque?.icone === 'shield' || estoque?.icone === 'shirt'

    // Saída de item fora do catálogo: cadastra na hora, sem controle de saldo, com o preço informado
    if (tipo === 'saida' && produtoNovo && novoCadastrar && !isEpiSaida) {
      if (produtoCriado.current && produtoCriado.current.nome === produtoNome.trim()) {
        prod = produtoCriado.current.prod
      } else {
        const { data: novo, error: novoErr } = await supabase.from('estoque_produtos').insert({
          estoque_id: estoqueId, nome: produtoNome.trim(), unidade: unidade || 'un',
          quantidade_atual: 0, quantidade_minima: 0,
          preco_unitario: numeroOuPadrao(novoPreco, 0) || null,
          categoria_id: novoCategoriaId || null,
          controla_saldo: false,
        }).select().single()
        if (novoErr) { abaTermo?.close(); setError(mensagemErro(novoErr, 'Não foi possível cadastrar o produto')); setSaving(false); return }
        prod = novo as EstoqueProduto
        produtoCriado.current = { nome: produtoNome.trim(), prod }
      }
      produtoIdFinal = prod.id
    }
    const cmpAtual = prod?.preco_unitario || (tipo === 'saida' && produtoNovo ? numeroOuPadrao(novoPreco, 0) : 0)
    const precoEntradaNum = numeroOuPadrao(precoEntrada, 0)
    const preco_unitario_custo = tipo === 'entrada' ? precoEntradaNum : cmpAtual
    const valor_total = qtd * preco_unitario_custo
    const destinoFinal = isCopa ? 'uso_interno' : destinoTipo
    // Estoques com abas de destino (obra/manutenção/uso interno) só devem gravar o id do destino
    // efetivamente escolhido — senão um id de uma aba anterior "gruda" no registro e contamina
    // relatórios que filtram por obra_id (ex.: financeiro da obra).
    const hasMultiDestino = tipo === 'saida' && (isDestinoMultiplo || (isLimpeza && !isCopa))
    const obraIdFinal = isCopa ? null : hasMultiDestino ? (destinoFinal === 'obra' ? (obraId || null) : null) : (obraId || null)
    const funcionarioIdFinal = funcionarioId || null
    const manutencaoIdFinal = hasMultiDestino && destinoFinal === 'manutencao' ? (manutencaoId || null) : null

    const { data: reg, error: regErr } = await supabase.from('estoque_registros').insert({
      estoque_id: estoqueId, produto_id: produtoIdFinal || null, produto_nome: produtoNome.trim(),
      tipo, quantidade: qtd, unidade, responsavel: responsavel.trim(), assinatura_url, data,
      observacoes: observacoes || null, obra_id: obraIdFinal, funcionario_id: funcionarioIdFinal,
      manutencao_id: manutencaoIdFinal,
      destino_tipo: tipo === 'saida' ? destinoFinal : null,
      preco_unitario_custo: preco_unitario_custo || null, valor_total: valor_total || null,
    }).select().single()

    if (regErr) { abaTermo?.close(); setError(mensagemErro(regErr, 'Erro ao salvar o registro')); setSaving(false); return }

    // Daqui em diante o registro já existe: falhas viram aviso (reenviar duplicaria o registro)
    const avisos: string[] = []
    const isCAField = (c: EstoqueCampo) => { const n = c.nome.toLowerCase().replace(/\s/g, ''); return n === 'ca' || n === 'nºca' || n === 'noca' || n.includes('nºca') || n.includes('numeroca') }
    const valores = campos
      .map(c => {
        const v = valoresCampos[c.id]?.trim() || (isCAField(c) && prod?.codigo ? prod.codigo : '')
        return v ? { registro_id: reg.id, campo_id: c.id, valor: v } : null
      })
      .filter(Boolean) as { registro_id: string; campo_id: string; valor: string }[]
    if (valores.length > 0) {
      const { error: errVal } = await supabase.from('estoque_registro_valores').insert(valores)
      if (errVal) avisos.push(`campos extras (${mensagemErro(errVal)})`)
    }

    if (produtoIdFinal && prod) {
      const delta = tipo === 'entrada' ? qtd : -qtd
      const { saldo, error: errSaldo } = await ajustarSaldo(supabase, produtoIdFinal, delta, { pisoZero: !controlaSaldo(prod) })
      if (errSaldo) avisos.push(`saldo do produto (${mensagemErro(errSaldo)})`)
      else if (saldo !== null) {
        const anterior = arred(saldo - delta)
        if (tipo === 'entrada' && precoEntradaNum > 0) {
          const novoCMP = anterior > 0 && saldo > 0
            ? (anterior * cmpAtual + qtd * precoEntradaNum) / saldo
            : precoEntradaNum
          const { error: errCmp } = await supabase.from('estoque_produtos').update({ preco_unitario: novoCMP }).eq('id', produtoIdFinal)
          if (errCmp) avisos.push(`custo médio do produto (${mensagemErro(errCmp)})`)
        }

        if (tipo === 'saida' && controlaSaldo(prod) && prod.quantidade_minima > 0) {
          fetch('/api/estoque/alerta-critico', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              produtoNome: prod.nome, estoqueNome: estoque?.nome ?? '',
              quantidadeAnterior: anterior, quantidadeNova: saldo,
              quantidadeMinima: prod.quantidade_minima, unidade: prod.unidade,
            }),
          }).catch(() => {})
        }
      }
    }

    // Saída com destino Manutenção repõe o estoque local do contrato
    if (hasMultiDestino && destinoFinal === 'manutencao' && manutencaoId && produtoIdFinal) {
      const errMan = await reporEstoqueManutencao(supabase, {
        contratoId: manutencaoId, produtoId: produtoIdFinal, qtd, responsavel: responsavel.trim(), data, registroId: reg.id,
      })
      if (errMan) avisos.push(`estoque do contrato de manutenção (${mensagemErro(errMan)})`)
    }

    // Saída de material de limpeza para uso interno vira gasto administrativo do mês
    if (tipo === 'saida' && estoque?.icone === 'sparkles' && destinoTipo === 'uso_interno' && valor_total > 0) {
      const { error: errCusto } = await lancarCustoAdministrativo(supabase, {
        categoria: { nome: 'Material de Limpeza', icone: 'Sparkles', cor: '#2DD4BF' },
        descricao: `${produtoNome.trim()} (${qtd} ${unidade})`, valor: valor_total, data,
        observacao: 'Gerado automaticamente a partir de saída de estoque (uso interno).', registroId: reg.id,
      })
      if (errCusto) avisos.push(`custo administrativo (${mensagemErro(errCusto)})`)
    }

    // Saída de item da Copa/Escritório vira gasto administrativo do mês, na categoria Café ou Escritório
    if (tipo === 'saida' && isCopa && valor_total > 0) {
      const nomeCategoria = /caf[eé]/i.test(produtoNome) ? 'Café' : 'Escritório'
      const { error: errCusto } = await lancarCustoAdministrativo(supabase, {
        categoria: { nome: nomeCategoria, icone: nomeCategoria === 'Café' ? 'Coffee' : 'Building2', cor: nomeCategoria === 'Café' ? '#92400E' : '#64748B' },
        descricao: `${produtoNome.trim()} (${qtd} ${unidade})`, valor: valor_total, data,
        observacao: 'Gerado automaticamente a partir de saída de estoque (Copa/Escritório).', registroId: reg.id,
      })
      if (errCusto) avisos.push(`custo administrativo (${mensagemErro(errCusto)})`)
    }

    produtoCriado.current = null
    if (avisos.length > 0) alert(`Registro salvo, mas não foi possível atualizar:\n• ${avisos.join('\n• ')}\n\nConfira e ajuste manualmente.`)

    // Saída de EPI/uniforme gera termo de responsabilidade pra imprimir e o funcionário assinar
    if (tipo === 'saida' && needsFuncionario) {
      const url = `/print/epi/${reg.id}`
      if (abaTermo) abaTermo.location.href = url
      else { setSaving(false); setTermoUrl(url); return } // pop-up bloqueado: mostra o link
    }

    router.push(`/estoque/${estoqueId}`)
  }

  async function seguirParaContas(nota: NotaLida) {
    if (!can('contas_pagar')) { router.push(`/estoque/${estoqueId}`); return }
    const { data } = await createClient().from('fornecedores').select('*').order('nome')
    setFornecedores((data ?? []) as Fornecedor[])
    setNotaParaContas(nota)
  }

  async function handleImportarNF(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setImportandoNF(true)
    try {
      const fd = new FormData(); fd.append('file', f)
      const res = await fetch('/api/parse-nfe', { method: 'POST', body: fd })
      const parsed = await res.json()
      if (res.ok && parsed && (parsed.emitente || parsed.valorTotal)) {
        setParsedNF(parsed)
      } else {
        alert(parsed?.error ?? 'Não foi possível extrair dados desta NF.')
      }
    } catch (err) { alert('Erro: ' + String(err)) }
    setImportandoNF(false)
    e.target.value = ''
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 size={28} className="animate-spin text-[#4F7CFF]" />
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => {
            if (entradaModo === 'novo-registro') { setEntradaModo('escolha'); return }
            router.push(`/estoque/${estoqueId}`)
          }}
          className="w-9 h-9 rounded-xl border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors"
        >
          <ArrowLeft size={16} className="text-[#64748B]" />
        </button>
        <div>
          <h1 className="font-syne font-bold text-xl text-[#0F172A]">Novo Registro</h1>
          <p className="text-xs text-[#64748B]">{estoque?.nome}</p>
        </div>
      </div>

      {termoUrl && (
        <div className="mb-6 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 space-y-2">
          <p className="font-medium">Saída registrada.</p>
          <div className="flex flex-wrap gap-2">
            <a href={termoUrl} target="_blank" rel="noreferrer" className="btn-primary text-sm">Abrir termo</a>
            <Link href={`/estoque/${estoqueId}`} className="px-4 py-2 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg bg-white">Voltar ao estoque</Link>
          </div>
        </div>
      )}

      {/* Toggle Entrada/Saída */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {(['saida', 'entrada'] as const).map(t => (
          <button key={t} type="button"
            onClick={() => { setTipo(t); if (t === 'entrada') setEntradaModo('escolha') }}
            className={`py-3 rounded-xl font-medium text-sm border-2 transition-all ${tipo === t
              ? t === 'saida' ? 'border-red-400 bg-red-50 text-red-600' : 'border-green-400 bg-green-50 text-green-600'
              : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'}`}>
            {t === 'saida' ? '↑ Saída' : '↓ Entrada'}
          </button>
        ))}
      </div>

      {/* ── SAÍDA ── */}
      {tipo === 'saida' && (estoque?.icone === 'shield' || estoque?.icone === 'shirt') ? (
        <FormSaidaEpiLote estoqueId={estoqueId} estoqueNome={estoque?.nome ?? ''} produtos={produtos} campos={campos} funcionarios={funcionarios} responsaveis={funcionarios.filter(f => f.responsavel_entrega)} />
      ) : tipo === 'saida' && estoque?.icone === 'sparkles' ? (
        <FormSaidaLoteLimpeza estoqueId={estoqueId} estoqueNome={estoque?.nome ?? ''} produtos={produtos} campos={campos} obras={obras} manutencoes={manutencoes} responsaveis={funcionarios.filter(f => f.responsavel_entrega)} />
      ) : tipo === 'saida' && estoque?.nome !== 'Copa/Escritório' ? (
        <FormSaidaLoteMateriais estoqueId={estoqueId} estoqueNome={estoque?.nome ?? ''} produtos={produtos} categorias={categorias} obras={obras} funcionarios={funcionarios} manutencoes={manutencoes} responsaveis={funcionarios.filter(f => f.responsavel_entrega)} />
      ) : tipo === 'saida' && (
        <FormSaida
          produtos={produtos} campos={campos} obras={obras} funcionarios={funcionarios} manutencoes={manutencoes}
          responsaveis={funcionarios.filter(f => f.responsavel_entrega)}
          produtoId={produtoId} setProdutoId={setProdutoId}
          produtoNome={produtoNome} setProdutoNome={setProdutoNome}
          quantidade={quantidade} setQuantidade={setQuantidade}
          unidade={unidade} setUnidade={setUnidade}
          responsavel={responsavel} setResponsavel={setResponsavel}
          data={data} setData={setData}
          observacoes={observacoes} setObservacoes={setObservacoes}
          valoresCampos={valoresCampos} setValoresCampos={setValoresCampos}
          temAssinatura={temAssinatura} canvasRef={canvasRef}
          startDraw={startDraw} draw={draw} stopDraw={stopDraw} limparCanvas={limparCanvas}
          obraId={obraId} setObraId={setObraId}
          funcionarioId={funcionarioId} setFuncionarioId={setFuncionarioId}
          destinoTipo={destinoTipo} setDestinoTipo={setDestinoTipo}
          manutencaoId={manutencaoId} setManutencaoId={setManutencaoId}
          showScanner={showScanner} setShowScanner={setShowScanner}
          scanMsg={scanMsg} handleScanned={handleScanned}
          saving={saving} error={error}
          onSubmit={handleSubmit}
          estoqueId={estoqueId}
          estoqueIcone={estoque?.icone ?? ''}
          estoqueNome={estoque?.nome ?? ''}
          produtoCodigo={produtos.find(p => p.id === produtoId)?.codigo ?? ''}
          categorias={categorias}
          novoCadastrar={novoCadastrar} setNovoCadastrar={setNovoCadastrar}
          novoPreco={novoPreco} setNovoPreco={setNovoPreco}
          novoCategoriaId={novoCategoriaId} setNovoCategoriaId={setNovoCategoriaId}
        />
      )}

      {/* ── ENTRADA: tela de escolha ── */}
      {tipo === 'entrada' && entradaModo === 'escolha' && (
        <div className="space-y-4">
          <p className="text-sm text-[#64748B] mb-2">Como deseja registrar a entrada?</p>

          {/* Lançar NF */}
          <button onClick={() => setShowLancarNF(true)}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-[#E2E8F0] hover:border-[#4F7CFF] hover:bg-[#F8FAFF] transition-all text-left group">
            <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] group-hover:bg-[#EEF2FF] flex items-center justify-center transition-colors">
              <FileText size={18} className="text-[#64748B] group-hover:text-[#4F7CFF]" />
            </div>
            <div>
              <p className="font-syne font-semibold text-sm text-[#0F172A]">Lançar NF</p>
              <p className="text-xs text-[#94A3B8] mt-0.5">Adicionar vários itens de uma nota fiscal manualmente</p>
            </div>
          </button>

          {/* Importar NF */}
          <label className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 border-[#4F7CFF] hover:bg-[#EEF2FF] transition-all text-left cursor-pointer group ${importandoNF ? 'opacity-60 pointer-events-none' : ''}`}>
            <div className="w-10 h-10 rounded-lg bg-[#EEF2FF] flex items-center justify-center">
              {importandoNF
                ? <Loader2 size={18} className="text-[#4F7CFF] animate-spin" />
                : <Upload size={18} className="text-[#4F7CFF]" />}
            </div>
            <div>
              <p className="font-syne font-semibold text-sm text-[#4F7CFF]">{importandoNF ? 'Lendo NF...' : 'Importar NF'}</p>
              <p className="text-xs text-[#94A3B8] mt-0.5">Faça upload do PDF ou do XML da nota e importe os itens automaticamente</p>
            </div>
            <input type="file" accept=".pdf,.xml,application/pdf,text/xml,application/xml" className="hidden" disabled={importandoNF} onChange={handleImportarNF} />
          </label>

          {/* Novo Registro (item único) */}
          <button onClick={() => setEntradaModo('novo-registro')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-[#E2E8F0] hover:border-[#10B981] hover:bg-[#F0FDF4] transition-all text-left group">
            <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] group-hover:bg-[#D1FAE5] flex items-center justify-center transition-colors">
              <Plus size={18} className="text-[#64748B] group-hover:text-[#10B981]" />
            </div>
            <div>
              <p className="font-syne font-semibold text-sm text-[#0F172A]">Novo Registro</p>
              <p className="text-xs text-[#94A3B8] mt-0.5">Registrar a entrada de um único item com preço e quantidade</p>
            </div>
          </button>
        </div>
      )}

      {/* ── ENTRADA: Novo Registro (item único) ── */}
      {tipo === 'entrada' && entradaModo === 'novo-registro' && (
        <FormEntradaUnica
          produtos={produtos} campos={campos}
          produtoId={produtoId} setProdutoId={setProdutoId}
          produtoNome={produtoNome} setProdutoNome={setProdutoNome}
          quantidade={quantidade} setQuantidade={setQuantidade}
          unidade={unidade} setUnidade={setUnidade}
          responsavel={responsavel} setResponsavel={setResponsavel}
          data={data} setData={setData}
          observacoes={observacoes} setObservacoes={setObservacoes}
          valoresCampos={valoresCampos} setValoresCampos={setValoresCampos}
          temAssinatura={temAssinatura} canvasRef={canvasRef}
          startDraw={startDraw} draw={draw} stopDraw={stopDraw} limparCanvas={limparCanvas}
          showScanner={showScanner} setShowScanner={setShowScanner}
          scanMsg={scanMsg} handleScanned={handleScanned}
          precoEntrada={precoEntrada} setPrecoEntrada={setPrecoEntrada}
          saving={saving} error={error}
          onSubmit={handleSubmit}
          estoqueId={estoqueId}
        />
      )}

      {/* Modal Lançar NF */}
      {showLancarNF && (
        <ModalLancarNF
          estoqueId={estoqueId}
          produtos={produtos}
          onClose={() => setShowLancarNF(false)}
          onSaved={nota => { setShowLancarNF(false); seguirParaContas(nota) }}
        />
      )}

      {/* Modal Importar NF (revisão) */}
      {parsedNF && (
        <ModalImportNF
          estoqueId={estoqueId}
          produtos={produtos}
          nf={parsedNF}
          onClose={() => setParsedNF(null)}
          onSaved={() => { const nota = parsedNF; setParsedNF(null); seguirParaContas(nota) }}
        />
      )}

      {/* Boletos da NF em Contas a pagar */}
      {notaParaContas && (
        <ModalNotaCompra notaId={null} inicial={notaParaContas} fornecedores={fornecedores}
          aviso="Entrada no estoque registrada. Agora lance os boletos desta nota em Contas a pagar."
          rotuloCancelar="Pular"
          onFornecedorCriado={f => setFornecedores(fs => fs.some(x => x.id === f.id) ? fs : [...fs, f])}
          onClose={() => router.push(`/estoque/${estoqueId}`)}
          onSaved={() => router.push(`/estoque/${estoqueId}`)} />
      )}
    </div>
  )
}

// ── FormSaida ─────────────────────────────────────────
function FormSaida({ produtos, campos, obras, funcionarios, responsaveis, manutencoes, produtoId, setProdutoId, produtoNome, setProdutoNome,
  quantidade, setQuantidade, unidade, setUnidade, responsavel, setResponsavel, data, setData,
  observacoes, setObservacoes, valoresCampos, setValoresCampos, temAssinatura, canvasRef,
  startDraw, draw, stopDraw, limparCanvas, obraId, setObraId, funcionarioId, setFuncionarioId,
  destinoTipo, setDestinoTipo, manutencaoId, setManutencaoId, showScanner, setShowScanner,
  scanMsg, handleScanned, saving, error, onSubmit, estoqueId, estoqueIcone, estoqueNome, produtoCodigo,
  categorias, novoCadastrar, setNovoCadastrar, novoPreco, setNovoPreco, novoCategoriaId, setNovoCategoriaId }: any) {
  const isEpiOuUniforme = estoqueIcone === 'shield' || estoqueIcone === 'shirt'
  const isLimpeza = estoqueIcone === 'sparkles'
  const isCopa = estoqueNome === 'Copa/Escritório'
  const [respModoLivre, setRespModoLivre] = useState(false)
  const isCA = (campo: any) => {
    const n = (campo.nome as string).toLowerCase().replace(/\s/g, '')
    return n === 'ca' || n === 'nºca' || n === 'noca' || n.includes('nºca') || n.includes('numeroca')
  }
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-[#374151] mb-1.5">Data *</label>
        <input type="date" required className="field" value={data} onChange={e => setData(e.target.value)} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-[#374151]">Produto *</label>
          <button type="button" onClick={() => setShowScanner(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] px-2.5 py-1.5 rounded-lg transition-colors border border-[#C7D2FE]">
            <ScanLine size={13} /> Escanear código
          </button>
        </div>
        {scanMsg && <p className={`text-xs px-3 py-2 rounded-lg mb-2 ${scanMsg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{scanMsg}</p>}
        {produtos.length > 0 && (
          <select className="field" value={produtoId} onChange={e => setProdutoId(e.target.value)}>
            <option value="">Selecionar produto...</option>
            {produtos.map((p: EstoqueProduto) => <option key={p.id} value={p.id}>{p.nome}{p.codigo ? ` (${p.codigo})` : ''}</option>)}
            <option value="__outro__">Outro (digitar manualmente)</option>
          </select>
        )}
        {(produtoId === '__outro__' || produtos.length === 0) && (
          <input className="field mt-2" value={produtoNome} onChange={e => setProdutoNome(e.target.value)} placeholder="Nome do produto" />
        )}
        {(produtoId === '__outro__' || produtos.length === 0) && !isEpiOuUniforme && (
          <div className="mt-2 px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-2">
            <label className="flex items-center gap-2 text-sm text-[#374151] cursor-pointer">
              <input type="checkbox" className="rounded" checked={novoCadastrar} onChange={e => setNovoCadastrar(e.target.checked)} />
              Cadastrar no catálogo (sem controle de saldo)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Preço unitário (R$)</label>
                <input type="number" step="0.0001" min="0" inputMode="decimal" className="field text-sm" value={novoPreco} onChange={e => setNovoPreco(e.target.value)} placeholder="0,00" />
              </div>
              {novoCadastrar && categorias?.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Categoria</label>
                  <select className="field text-sm" value={novoCategoriaId} onChange={e => setNovoCategoriaId(e.target.value)}>
                    <option value="">Sem categoria</option>
                    {categorias.map((c: EstoqueProdutoCategoria) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              )}
            </div>
            <p className="text-xs text-[#94A3B8]">O preço vira o custo desta saída na obra{novoCadastrar ? ' e fica como preço de referência do produto' : ''}.</p>
          </div>
        )}
      </div>

      {showScanner && <BarcodeScannerModal onScanned={handleScanned} onClose={() => setShowScanner(false)} />}

      {produtoId && produtoId !== '__outro__' && (() => {
        const prod = produtos.find((p: EstoqueProduto) => p.id === produtoId)
        if (!prod) return null
        if (!controlaSaldo(prod)) return (
          <div className="px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#64748B]">
            Produto sem controle de saldo: a saída é livre e o custo vai pelo preço de referência.
            {prod.quantidade_atual > 0 && <> Há {prod.quantidade_atual} {prod.unidade} que voltaram de obra; a saída desconta deles primeiro.</>}
            {!prod.preco_unitario && <span className="block text-amber-700 mt-1">Este produto está sem preço: a saída vai sem custo. Defina o preço em Produtos.</span>}
          </div>
        )
        const qtd = parseFloat(quantidade) || 0
        const saldoApos = prod.quantidade_atual - qtd
        if (saldoApos < 0) return (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span><strong>Saldo insuficiente!</strong> Estoque atual: {prod.quantidade_atual} {prod.unidade}.</span>
          </div>
        )
        if (prod.quantidade_atual <= prod.quantidade_minima) return (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>Este produto está no estoque mínimo ({prod.quantidade_atual} {prod.unidade}).</span>
          </div>
        )
        return null
      })()}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Quantidade *</label>
          <input type="number" min="0" step="any" inputMode="decimal" required className="field" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Unidade</label>
          <input className="field" value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="un" />
        </div>
      </div>
      {(() => {
        const prod = produtos.find((p: EstoqueProduto) => p.id === produtoId)
        return prod?.peso_unitario_g
          ? <PesoParaQuantidade key={prod.id} pesoUnitarioG={prod.peso_unitario_g} unidade={prod.unidade} onQuantidade={setQuantidade} />
          : null
      })()}

      {(() => {
        const prod = produtos.find((p: EstoqueProduto) => p.id === produtoId)
        const preco = prod?.preco_unitario || (!prod ? parseFloat(novoPreco) || 0 : 0)
        if (!preco) return null
        const total = (parseFloat(quantidade) || 0) * preco
        return (
          <div className="px-3 py-2.5 bg-[#FFF7ED] border border-orange-100 rounded-lg">
            <p className="text-xs font-medium text-orange-700">Custo desta saída{prod && controlaSaldo(prod) ? ' (CMP)' : ''}</p>
            <p className="text-sm font-semibold text-orange-800 mt-0.5">
              {preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / {prod?.unidade || unidade || 'un'}
              {quantidade && <span> · Total: {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
            </p>
          </div>
        )
      })()}

      {campos.filter((c: EstoqueCampo) => !isCA(c)).map((c: EstoqueCampo) => (
        <div key={c.id}>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">{c.nome} {c.obrigatorio && <span className="text-red-400">*</span>}</label>
          <input type={c.tipo === 'number' ? 'number' : c.tipo === 'date' ? 'date' : 'text'} className="field" required={c.obrigatorio}
            value={valoresCampos[c.id] ?? ''} onChange={e => setValoresCampos((v: any) => ({ ...v, [c.id]: e.target.value }))} />
        </div>
      ))}

      <div>
        <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome do responsável *</label>
        {responsaveis && responsaveis.length > 0 && !respModoLivre ? (
          <select className="field" value={responsavel} required
            onChange={e => { if (e.target.value === '__outro__') { setRespModoLivre(true); setResponsavel('') } else setResponsavel(e.target.value) }}>
            <option value="">Selecione...</option>
            {responsaveis.map((f: any) => <option key={f.id} value={f.nome}>{f.nome}</option>)}
            <option value="__outro__">Outro (digitar manualmente)</option>
          </select>
        ) : (
          <div className="flex gap-2">
            <input required className="field flex-1" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome completo" />
            {responsaveis && responsaveis.length > 0 && (
              <button type="button" onClick={() => { setRespModoLivre(false); setResponsavel('') }}
                className="text-xs text-[#4F7CFF] shrink-0 px-2 hover:underline">Lista</button>
            )}
          </div>
        )}
      </div>

      {/* Destino dinâmico por categoria */}
      {isEpiOuUniforme ? (
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Funcionário de Destino *</label>
          <select className="field" value={funcionarioId} onChange={e => setFuncionarioId(e.target.value)} required>
            <option value="">Selecione o funcionário...</option>
            {funcionarios.map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>
      ) : isCopa ? (
        <div className="px-3 py-2.5 bg-[#F0FDFA] border border-teal-100 rounded-lg text-sm text-teal-700">
          Esta saída será lançada automaticamente como custo administrativo do mês (Café ou Escritório).
        </div>
      ) : isLimpeza ? (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-[#374151]">Destino *</label>
          <div className="grid grid-cols-3 gap-2">
            {(['obra', 'manutencao', 'uso_interno'] as const).map(d => (
              <button key={d} type="button"
                onClick={() => setDestinoTipo(d)}
                className={`py-2 rounded-lg text-xs font-medium border-2 transition-all ${destinoTipo === d ? 'border-[#4F7CFF] bg-[#EEF2FF] text-[#4F7CFF]' : 'border-[#E2E8F0] text-[#64748B]'}`}>
                {d === 'obra' ? 'Obra' : d === 'manutencao' ? 'Manutenção' : 'Uso Interno'}
              </button>
            ))}
          </div>
          {destinoTipo === 'obra' && (
            <select className="field" value={obraId} onChange={e => setObraId(e.target.value)} required>
              <option value="">Selecione a obra...</option>
              {obras.map((o: any) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
            </select>
          )}
          {destinoTipo === 'manutencao' && (
            <select className="field" value={manutencaoId} onChange={e => setManutencaoId(e.target.value)} required>
              <option value="">Selecione o contrato de manutenção...</option>
              {manutencoes.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {(m.empresa?.apelido || m.empresa?.razao_social || 'Sem empresa')}{m.numero_contrato ? ` · ${m.numero_contrato}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Funcionário de Destino *</label>
            <select className="field" value={funcionarioId} onChange={e => setFuncionarioId(e.target.value)} required>
              <option value="">Selecione o funcionário...</option>
              {funcionarios.map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-[#374151]">Destino *</label>
            <div className="grid grid-cols-3 gap-2">
              {(['obra', 'uso_interno', 'manutencao'] as const).map(d => (
                <button key={d} type="button"
                  onClick={() => setDestinoTipo(d)}
                  className={`py-2 rounded-lg text-xs font-medium border-2 transition-all ${destinoTipo === d ? 'border-[#4F7CFF] bg-[#EEF2FF] text-[#4F7CFF]' : 'border-[#E2E8F0] text-[#64748B]'}`}>
                  {d === 'obra' ? 'Obra' : d === 'manutencao' ? 'Manutenção' : 'Uso Interno'}
                </button>
              ))}
            </div>
            {destinoTipo === 'obra' && (
              <select className="field" value={obraId} onChange={e => setObraId(e.target.value)} required>
                <option value="">Selecione a obra...</option>
                {obras.map((o: any) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
              </select>
            )}
            {destinoTipo === 'manutencao' && (
              <select className="field" value={manutencaoId} onChange={e => setManutencaoId(e.target.value)} required>
                <option value="">Selecione o contrato de manutenção...</option>
                {manutencoes.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {(m.empresa?.apelido || m.empresa?.razao_social || 'Sem empresa')}{m.numero_contrato ? ` · ${m.numero_contrato}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-[#374151]">Assinatura</label>
          {temAssinatura && (
            <button type="button" onClick={limparCanvas} className="flex items-center gap-1 text-xs text-[#64748B] hover:text-red-500 transition-colors">
              <Eraser size={12} /> Limpar
            </button>
          )}
        </div>
        <div className="border-2 border-[#E2E8F0] rounded-xl overflow-hidden bg-white touch-none" style={{ cursor: 'crosshair' }}>
          <canvas ref={canvasRef} width={600} height={160} className="w-full"
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
        </div>
        <p className="text-xs text-[#94A3B8] mt-1">{temAssinatura ? '✓ Assinatura registrada' : 'Assine acima com o mouse ou dedo'}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#374151] mb-1.5">Observações</label>
        <textarea className="field resize-none" rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" />
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Link href={`/estoque/${estoqueId}`} className="flex-1 py-3 text-center text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-colors">
          Cancelar
        </Link>
        <button type="submit" disabled={saving} className="flex-1 btn-primary flex items-center justify-center gap-2 py-3">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {saving ? 'Salvando...' : 'Salvar Registro'}
        </button>
      </div>
    </form>
  )
}

// ── FormEntradaUnica ──────────────────────────────────
function FormEntradaUnica({ produtos, campos, produtoId, setProdutoId, produtoNome, setProdutoNome,
  quantidade, setQuantidade, unidade, setUnidade, responsavel, setResponsavel, data, setData,
  observacoes, setObservacoes, valoresCampos, setValoresCampos, temAssinatura, canvasRef,
  startDraw, draw, stopDraw, limparCanvas, showScanner, setShowScanner, scanMsg, handleScanned,
  precoEntrada, setPrecoEntrada, saving, error, onSubmit, estoqueId }: any) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-[#374151] mb-1.5">Data *</label>
        <input type="date" required className="field" value={data} onChange={e => setData(e.target.value)} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-[#374151]">Produto *</label>
          <button type="button" onClick={() => setShowScanner(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] px-2.5 py-1.5 rounded-lg transition-colors border border-[#C7D2FE]">
            <ScanLine size={13} /> Escanear código
          </button>
        </div>
        {scanMsg && <p className={`text-xs px-3 py-2 rounded-lg mb-2 ${scanMsg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{scanMsg}</p>}
        {produtos.length > 0 && (
          <select className="field" value={produtoId} onChange={e => setProdutoId(e.target.value)}>
            <option value="">Selecionar produto...</option>
            {produtos.map((p: EstoqueProduto) => <option key={p.id} value={p.id}>{p.nome}{p.codigo ? ` (${p.codigo})` : ''}</option>)}
            <option value="__outro__">Outro (digitar manualmente)</option>
          </select>
        )}
        {(produtoId === '__outro__' || produtos.length === 0) && (
          <input className="field mt-2" value={produtoNome} onChange={e => setProdutoNome(e.target.value)} placeholder="Nome do produto" />
        )}
      </div>

      {showScanner && <BarcodeScannerModal onScanned={handleScanned} onClose={() => setShowScanner(false)} />}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Quantidade *</label>
          <input type="number" min="0" step="any" inputMode="decimal" required className="field" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Unidade</label>
          <input className="field" value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="un" />
        </div>
      </div>
      {(() => {
        const prod = produtos.find((p: EstoqueProduto) => p.id === produtoId)
        return prod?.peso_unitario_g
          ? <PesoParaQuantidade key={prod.id} pesoUnitarioG={prod.peso_unitario_g} unidade={prod.unidade} onQuantidade={setQuantidade} />
          : null
      })()}

      <div>
        <label className="block text-sm font-medium text-[#374151] mb-1.5">Preço Unitário (R$) *</label>
        <input type="number" step="any" min="0.01" inputMode="decimal" required className="field" placeholder="0,00"
          value={precoEntrada} onChange={e => setPrecoEntrada(e.target.value)} />
        {quantidade && precoEntrada && (
          <p className="text-xs text-emerald-600 mt-1">
            Total desta entrada: R$ {(parseFloat(quantidade) * parseFloat(precoEntrada)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>

      {campos.map((c: EstoqueCampo) => (
        <div key={c.id}>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">{c.nome} {c.obrigatorio && <span className="text-red-400">*</span>}</label>
          <input type={c.tipo === 'number' ? 'number' : c.tipo === 'date' ? 'date' : 'text'} className="field" required={c.obrigatorio}
            value={valoresCampos[c.id] ?? ''} onChange={e => setValoresCampos((v: any) => ({ ...v, [c.id]: e.target.value }))} />
        </div>
      ))}

      <div>
        <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome do responsável *</label>
        <input required className="field" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome completo" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-[#374151]">Assinatura</label>
          {temAssinatura && (
            <button type="button" onClick={limparCanvas} className="flex items-center gap-1 text-xs text-[#64748B] hover:text-red-500 transition-colors">
              <Eraser size={12} /> Limpar
            </button>
          )}
        </div>
        <div className="border-2 border-[#E2E8F0] rounded-xl overflow-hidden bg-white touch-none" style={{ cursor: 'crosshair' }}>
          <canvas ref={canvasRef} width={600} height={160} className="w-full"
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
        </div>
        <p className="text-xs text-[#94A3B8] mt-1">{temAssinatura ? '✓ Assinatura registrada' : 'Assine acima com o mouse ou dedo'}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#374151] mb-1.5">Observações</label>
        <textarea className="field resize-none" rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" />
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Link href={`/estoque/${estoqueId}`} className="flex-1 py-3 text-center text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-colors">
          Cancelar
        </Link>
        <button type="submit" disabled={saving} className="flex-1 btn-primary flex items-center justify-center gap-2 py-3">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {saving ? 'Salvando...' : 'Salvar Registro'}
        </button>
      </div>
    </form>
  )
}

// ── Modal Lançar NF (multi-item entrada) ─────────────
function ModalLancarNF({ estoqueId, produtos, onClose, onSaved }: {
  estoqueId: string; produtos: EstoqueProduto[]; onClose: () => void; onSaved: (nota: NotaLida) => void
}) {
  const [nfNumero, setNfNumero] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [data, setData] = useState(hojeLocal())
  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState<ItemNF[]>([ITEM_VAZIO()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateItem(i: number, field: keyof ItemNF, value: string) {
    setItens(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      if (field === 'produtoId') {
        const prod = produtos.find(p => p.id === value)
        if (prod) {
          next[i].produtoNome = prod.nome
          next[i].unidade = prod.unidade
          if (prod.preco_unitario) next[i].precoUnitario = String(prod.preco_unitario)
        }
      }
      if (field === 'quantidade' || field === 'precoUnitario') {
        const qty = parseFloat(field === 'quantidade' ? value : next[i].quantidade)
        const vu = parseFloat(field === 'precoUnitario' ? value : next[i].precoUnitario)
        if (!isNaN(qty) && !isNaN(vu)) next[i].valorTotal = (qty * vu).toFixed(2)
      }
      return next
    })
  }

  const totalNF = itens.reduce((s, it) => s + (parseFloat(it.valorTotal) || 0), 0)
  const itensValidos = itens.filter(it => (it.produtoId || it.produtoNome.trim()) && parseFloat(it.quantidade) > 0 && parseFloat(it.precoUnitario) > 0)

  async function salvar() {
    if (!responsavel.trim()) { setError('Informe o responsável.'); return }
    if (itensValidos.length === 0) { setError('Adicione pelo menos um item com produto, quantidade e preço.'); return }
    setSaving(true); setError('')
    const supabase = createClient()
    const obs = [nfNumero.trim() ? `NF: ${nfNumero.trim()}` : '', fornecedor.trim() ? `Fornecedor: ${fornecedor.trim()}` : '', observacoes.trim()].filter(Boolean).join(' | ') || null

    // Itens não são gravados numa transação: o que já foi gravado sai da lista, para um reenvio não duplicar
    const gravados = new Set<ItemNF>()
    const avisos: string[] = []
    // Saldo/CMP correntes por produto (o mesmo produto pode aparecer em mais de um item)
    const cmpCorrente = new Map<string, number>()
    let falha: { item: ItemNF; msg: string } | null = null

    for (const it of itensValidos) {
      const produtoIdOk = it.produtoId && it.produtoId !== '__outro__' ? it.produtoId : null
      const prod = produtoIdOk ? produtos.find(p => p.id === produtoIdOk) : undefined
      const qtd = parseNumeroBR(it.quantidade)
      const precoNum = parseNumeroBR(it.precoUnitario)
      const valorTotal = numeroOuPadrao(it.valorTotal, 0) || qtd * precoNum

      const { error: errReg } = await supabase.from('estoque_registros').insert({
        estoque_id: estoqueId,
        produto_id: produtoIdOk,
        produto_nome: it.produtoNome.trim() || prod?.nome || '',
        tipo: 'entrada',
        quantidade: qtd,
        unidade: it.unidade || 'UN',
        responsavel: responsavel.trim(),
        data,
        preco_unitario_custo: precoNum,
        valor_total: valorTotal,
        observacoes: obs,
      })
      if (errReg) { falha = { item: it, msg: mensagemErro(errReg) }; break }
      gravados.add(it)

      if (prod) {
        const { saldo, error: errSaldo } = await ajustarSaldo(supabase, prod.id, qtd, { pisoZero: !controlaSaldo(prod) })
        if (errSaldo || saldo === null) { avisos.push(`saldo de ${prod.nome} (${mensagemErro(errSaldo)})`); continue }
        const anterior = arred(saldo - qtd)
        const cmpAtual = cmpCorrente.get(prod.id) ?? (prod.preco_unitario || 0)
        const novoCMP = anterior > 0 && saldo > 0
          ? (anterior * cmpAtual + qtd * precoNum) / saldo
          : precoNum
        const { error: errCmp } = await supabase.from('estoque_produtos').update({ preco_unitario: novoCMP }).eq('id', prod.id)
        if (errCmp) avisos.push(`custo médio de ${prod.nome} (${mensagemErro(errCmp)})`)
        else cmpCorrente.set(prod.id, novoCMP)
      }
    }

    setSaving(false)
    if (avisos.length > 0) alert(`Itens gravados, mas não foi possível atualizar:\n• ${avisos.join('\n• ')}\n\nConfira em Produtos.`)
    if (falha) {
      const nomeFalha = falha.item.produtoNome.trim() || produtos.find(p => p.id === falha!.item.produtoId)?.nome || 'item'
      setItens(prev => prev.filter(it => !gravados.has(it)))
      setError(`${gravados.size} item(ns) gravado(s) e retirado(s) da lista. Falhou em "${nomeFalha}": ${falha.msg} Os itens que faltam continuam na lista — toque em Salvar de novo para enviar só eles.`)
      return
    }
    onSaved({ emitente: fornecedor.trim() || null, nfNumero: nfNumero.trim() || null, valorTotal: totalNF })
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="font-syne font-semibold text-[#0F172A]">Lançar NF — Entrada de Estoque</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Cabeçalho NF */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Nº da NF</label>
              <input className="field" value={nfNumero} onChange={e => setNfNumero(e.target.value)} placeholder="Ex: 001234" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Fornecedor</label>
              <input className="field" value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Data da entrada *</label>
              <input type="date" required className="field" value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Responsável *</label>
              <input className="field" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Quem recebeu os materiais" />
            </div>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-[#374151]">Itens da NF</label>
              {totalNF > 0 && <span className="text-sm font-bold text-[#4F7CFF]">Total: {moeda(totalNF)}</span>}
            </div>

            <div className="space-y-3">
              {itens.map((it, i) => (
                <div key={i} className="border border-[#E2E8F0] rounded-xl p-3 space-y-2 bg-[#FAFAFA]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#94A3B8]">Item {i + 1}</span>
                    {itens.length > 1 && (
                      <button type="button" onClick={() => setItens(p => p.filter((_, idx) => idx !== i))}
                        aria-label={`Remover item ${i + 1}`} title="Remover item"
                        className="p-2 text-[#94A3B8] hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-[#64748B] mb-1">Produto *</label>
                    <select className="field text-sm" value={it.produtoId}
                      onChange={e => updateItem(i, 'produtoId', e.target.value)}>
                      <option value="">Selecionar produto cadastrado...</option>
                      {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      <option value="__outro__">Outro (digitar)</option>
                    </select>
                    {(it.produtoId === '__outro__' || (!it.produtoId && it.produtoNome)) && (
                      <input className="field text-sm mt-1.5" value={it.produtoNome}
                        onChange={e => updateItem(i, 'produtoNome', e.target.value)} placeholder="Nome do produto" />
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-1">
                      <label className="block text-xs text-[#64748B] mb-1">Qtd *</label>
                      <input type="number" min="0" step="any" inputMode="decimal" className="field text-sm" value={it.quantidade}
                        onChange={e => updateItem(i, 'quantidade', e.target.value)} placeholder="0" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs text-[#64748B] mb-1">Un.</label>
                      <input className="field text-sm" value={it.unidade}
                        onChange={e => updateItem(i, 'unidade', e.target.value)} placeholder="UN" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs text-[#64748B] mb-1">Preço Un. *</label>
                      <input type="number" step="any" min="0" inputMode="decimal" className="field text-sm" value={it.precoUnitario}
                        onChange={e => updateItem(i, 'precoUnitario', e.target.value)} placeholder="0,00" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs text-[#64748B] mb-1">Total</label>
                      <input type="number" step="any" min="0" inputMode="decimal" className="field text-sm bg-[#F8FAFC]" value={it.valorTotal}
                        onChange={e => updateItem(i, 'valorTotal', e.target.value)} placeholder="0,00" />
                    </div>
                  </div>

                  {it.produtoId && it.produtoId !== '__outro__' && (() => {
                    const prod = produtos.find(p => p.id === it.produtoId)
                    if (!prod || !it.precoUnitario) return null
                    const qty = parseFloat(it.quantidade) || 0
                    const preco = parseFloat(it.precoUnitario)
                    const novaQtd = prod.quantidade_atual + qty
                    const novoCMP = prod.quantidade_atual > 0
                      ? (prod.quantidade_atual * (prod.preco_unitario || 0) + qty * preco) / novaQtd
                      : preco
                    return (
                      <p className="text-xs text-emerald-600">
                        Novo CMP: {moeda(novoCMP)} · Saldo após entrada: {novaQtd} {prod.unidade}
                      </p>
                    )
                  })()}
                </div>
              ))}
            </div>

            <button type="button" onClick={() => setItens(p => [...p, ITEM_VAZIO()])}
              className="mt-3 w-full py-2.5 rounded-xl border-2 border-dashed border-[#E2E8F0] text-sm text-[#64748B] hover:border-[#4F7CFF] hover:text-[#4F7CFF] transition-colors flex items-center justify-center gap-2">
              <Plus size={14} /> Adicionar item
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Observações</label>
            <textarea className="field resize-none text-sm" rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" />
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9]">Cancelar</button>
            <button onClick={salvar} disabled={saving}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {saving ? 'Salvando...' : `Salvar ${itensValidos.length} ite${itensValidos.length === 1 ? 'm' : 'ns'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal Importar NF (revisão pós-parse) ─────────────
const normalizarNome = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Palpite de produto do catálogo para um item da NF: nome igual, código igual, ou
// nomes com quase todas as palavras em comum ("CIMENTO CP II" NÃO casa com "CIMENTO CP V").
function palpiteProduto(item: NfItem, produtos: EstoqueProduto[]): string {
  const desc = normalizarNome(item.descricao)
  const igual = produtos.find(p => normalizarNome(p.nome) === desc)
  if (igual) return igual.id
  if (item.codigo) {
    const porCodigo = produtos.find(p => p.codigo && p.codigo.trim() === item.codigo.trim())
    if (porCodigo) return porCodigo.id
  }
  const palavras = new Set(desc.split(' ').filter(Boolean))
  let melhor = { id: '', score: 0 }
  for (const p of produtos) {
    const outras = new Set(normalizarNome(p.nome).split(' ').filter(Boolean))
    const comuns = Array.from(palavras).filter(w => outras.has(w)).length
    const uniao = new Set([...Array.from(palavras), ...Array.from(outras)]).size
    const score = uniao ? comuns / uniao : 0
    if (score > melhor.score) melhor = { id: p.id, score }
  }
  return melhor.score >= 0.75 ? melhor.id : ''
}

const VINCULO_NENHUM = ''
const VINCULO_NOVO = '__novo__'

function ModalImportNF({ estoqueId, produtos, nf, onClose, onSaved }: {
  estoqueId: string; produtos: EstoqueProduto[]
  nf: NfData; onClose: () => void; onSaved: () => void
}) {
  const itens = nf.produtos ?? []
  const [selecionados, setSelecionados] = useState<Record<number, boolean>>(
    Object.fromEntries(itens.map((_, i) => [i, true]))
  )
  // Produto do catálogo de cada item: id, '' = não vincular (só registra) ou '__novo__' = criar produto
  const [vinculos, setVinculos] = useState<Record<number, string>>(
    () => Object.fromEntries(itens.map((p, i) => [i, palpiteProduto(p, produtos)]))
  )
  const [responsavel, setResponsavel] = useState('')
  const [data, setData] = useState(nf.dataEmissao?.split('T')[0] ?? hojeLocal())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Produto criado numa tentativa anterior (não recria no reenvio)
  const criados = useRef<Record<number, EstoqueProduto>>({})

  const allSelected = Object.values(selecionados).every(Boolean)
  const countSelecionados = Object.values(selecionados).filter(Boolean).length

  async function importar() {
    if (!responsavel.trim()) { setError('Informe o responsável.'); return }
    if (countSelecionados === 0) { setError('Selecione ao menos um item.'); return }
    setSaving(true); setError('')
    const supabase = createClient()
    const obs = nf.nfNumero ? `NF: ${nf.nfNumero}${nf.emitente ? ` · ${nf.emitente}` : ''}` : null

    const indices = itens.map((_, i) => i).filter(i => selecionados[i])
    const gravados: number[] = []
    const avisos: string[] = []
    const cmpCorrente = new Map<string, number>()
    let falha: { i: number; msg: string } | null = null

    for (const i of indices) {
      const p = itens[i]
      const vinculo = vinculos[i] ?? VINCULO_NENHUM
      let prod: EstoqueProduto | undefined = vinculo && vinculo !== VINCULO_NOVO ? produtos.find(pr => pr.id === vinculo) : undefined

      if (vinculo === VINCULO_NOVO) {
        prod = criados.current[i]
        if (!prod) {
          const { data: novo, error: errNovo } = await supabase.from('estoque_produtos').insert({
            estoque_id: estoqueId, nome: p.descricao.trim(), unidade: p.unidade || 'un',
            quantidade_atual: 0, quantidade_minima: 0, preco_unitario: p.valorUnitario || null,
          }).select().single()
          if (errNovo) { falha = { i, msg: mensagemErro(errNovo, 'ao cadastrar o produto') }; break }
          prod = novo as EstoqueProduto
          criados.current[i] = prod
        }
      }

      const { error: errReg } = await supabase.from('estoque_registros').insert({
        estoque_id: estoqueId,
        produto_id: prod?.id ?? null,
        produto_nome: p.descricao,
        tipo: 'entrada',
        quantidade: p.quantidade,
        unidade: p.unidade || 'UN',
        responsavel: responsavel.trim(),
        data,
        preco_unitario_custo: p.valorUnitario,
        valor_total: p.valorTotal,
        observacoes: obs,
      })
      if (errReg) { falha = { i, msg: mensagemErro(errReg) }; break }
      gravados.push(i)

      // Só mexe em saldo/custo do produto escolhido na revisão
      if (prod) {
        const { saldo, error: errSaldo } = await ajustarSaldo(supabase, prod.id, p.quantidade, { pisoZero: !controlaSaldo(prod) })
        if (errSaldo || saldo === null) { avisos.push(`saldo de ${prod.nome} (${mensagemErro(errSaldo)})`); continue }
        const anterior = arred(saldo - p.quantidade)
        const cmpAtual = cmpCorrente.get(prod.id) ?? (prod.preco_unitario || 0)
        const novoCMP = anterior > 0 && saldo > 0
          ? (anterior * cmpAtual + p.quantidade * p.valorUnitario) / saldo
          : p.valorUnitario
        const { error: errCmp } = await supabase.from('estoque_produtos').update({ preco_unitario: novoCMP }).eq('id', prod.id)
        if (errCmp) avisos.push(`custo médio de ${prod.nome} (${mensagemErro(errCmp)})`)
        else cmpCorrente.set(prod.id, novoCMP)
      }
    }

    setSaving(false)
    if (avisos.length > 0) alert(`Itens importados, mas não foi possível atualizar:\n• ${avisos.join('\n• ')}\n\nConfira em Produtos.`)
    if (falha) {
      // O que já foi gravado sai da seleção, para o reenvio não duplicar
      setSelecionados(sel => { const n = { ...sel }; gravados.forEach(i => { n[i] = false }); return n })
      setError(`${gravados.length} item(ns) importado(s) e desmarcado(s). Falhou em "${itens[falha.i].descricao}": ${falha.msg} Toque em Importar de novo para enviar só os que faltam.`)
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-syne font-semibold text-[#0F172A]">Importar itens da NF</h2>
            {nf.nfNumero && <p className="text-xs text-[#64748B] mt-0.5">{nf.nfNumero}{nf.emitente ? ` · ${nf.emitente}` : ''}</p>}
          </div>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Resumo NF */}
          <div className="bg-[#F8FAFC] rounded-xl p-3 text-sm grid grid-cols-2 gap-2">
            {nf.emitente && <div><span className="text-[#94A3B8] text-xs">Fornecedor</span><p className="font-medium text-[#0F172A] truncate">{nf.emitente}</p></div>}
            {nf.dataEmissao && <div><span className="text-[#94A3B8] text-xs">Data emissão</span><p className="font-medium text-[#0F172A]">{parseData(nf.dataEmissao).toLocaleDateString('pt-BR')}</p></div>}
            {nf.valorTotal && <div><span className="text-[#94A3B8] text-xs">Valor total NF</span><p className="font-semibold text-[#4F7CFF]">{moeda(nf.valorTotal)}</p></div>}
            {nf.nfNumero && <div><span className="text-[#94A3B8] text-xs">Número</span><p className="font-medium text-[#0F172A]">{nf.nfNumero}</p></div>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Data entrada *</label>
              <input type="date" className="field" value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Responsável *</label>
              <input className="field" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Quem recebeu" />
            </div>
          </div>

          {itens.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[#64748B]">Selecione os itens para importar</label>
                <button type="button" className="text-xs text-[#4F7CFF] font-medium"
                  onClick={() => setSelecionados(Object.fromEntries(itens.map((_, i) => [i, !allSelected])))}>
                  {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>
              <div className="space-y-2">
                {itens.map((p, i) => {
                  const vinculo = vinculos[i] ?? VINCULO_NENHUM
                  return (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all ${selecionados[i] ? 'border-[#4F7CFF] bg-[#EEF2FF]' : 'border-[#E2E8F0] bg-white'}`}>
                      <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#4F7CFF]" checked={!!selecionados[i]} aria-label={`Importar ${p.descricao}`}
                        onChange={e => setSelecionados(s => ({ ...s, [i]: e.target.checked }))} />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div>
                          <p className="text-sm font-medium text-[#0F172A] leading-tight">{p.descricao}</p>
                          <p className="text-xs text-[#64748B] mt-0.5">
                            {p.quantidade} {p.unidade} · {moeda(p.valorUnitario)}/un · <span className="font-semibold text-[#374151]">{moeda(p.valorTotal)}</span>
                          </p>
                        </div>
                        <select className="field text-xs py-1.5" value={vinculo} disabled={!selecionados[i]}
                          onChange={e => setVinculos(v => ({ ...v, [i]: e.target.value }))}>
                          <option value={VINCULO_NENHUM}>Não vincular (só registra a entrada, sem mexer em saldo)</option>
                          <option value={VINCULO_NOVO}>+ Criar produto novo &quot;{p.descricao}&quot;</option>
                          {produtos.map(pr => <option key={pr.id} value={pr.id}>{pr.nome}{pr.codigo ? ` (${pr.codigo})` : ''}</option>)}
                        </select>
                        {vinculo && vinculo !== VINCULO_NOVO && (
                          <p className="text-[11px] text-emerald-700">Soma {p.quantidade} ao saldo e recalcula o custo médio deste produto.</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-[#64748B]">
              Nenhum item de produto detectado nesta NF.<br />Os dados gerais foram extraídos.
            </div>
          )}

          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9]">Cancelar</button>
            <button onClick={importar} disabled={saving || countSelecionados === 0}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {saving ? 'Importando...' : `Importar ${countSelecionados} ite${countSelecionados === 1 ? 'm' : 'ns'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
