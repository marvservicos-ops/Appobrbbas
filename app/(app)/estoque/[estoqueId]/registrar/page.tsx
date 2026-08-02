'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Eraser, Check, Loader2, Camera, ScanLine, AlertTriangle, FileText, Upload, Plus, Trash2, X, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Estoque, EstoqueCampo, EstoqueProduto } from '@/lib/types'
import Link from 'next/link'
import BarcodeScannerModal from '@/components/BarcodeScannerModal'

// ── Tipos ─────────────────────────────────────────────
type ItemNF = { produtoId: string; produtoNome: string; quantidade: string; unidade: string; precoUnitario: string; valorTotal: string }
const ITEM_VAZIO = (): ItemNF => ({ produtoId: '', produtoNome: '', quantidade: '1', unidade: 'UN', precoUnitario: '', valorTotal: '' })

type NfItem = { codigo: string; descricao: string; quantidade: number; valorUnitario: number; valorTotal: number; unidade: string }
type NfData = { emitente?: string; nfNumero?: string; dataEmissao?: string; valorTotal?: number; produtos?: NfItem[] }

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

  // Estado do formulário único (saída e novo-registro)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [produtoNome, setProdutoNome] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [unidade, setUnidade] = useState('un')
  const [responsavel, setResponsavel] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [observacoes, setObservacoes] = useState('')
  const [valoresCampos, setValoresCampos] = useState<Record<string, string>>({})
  const [temAssinatura, setTemAssinatura] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [obraId, setObraId] = useState('')
  const [obras, setObras] = useState<{ id: string; titulo: string }[]>([])
  const [funcionarioId, setFuncionarioId] = useState('')
  const [funcionarios, setFuncionarios] = useState<{ id: string; nome: string }[]>([])
  const [destinoTipo, setDestinoTipo] = useState<'obra' | 'funcionario' | 'uso_interno'>('obra')
  const [precoEntrada, setPrecoEntrada] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: est }, { data: cam }, { data: prod }, { data: obrasData }, { data: funcsData }] = await Promise.all([
        supabase.from('estoques').select('*').eq('id', estoqueId).single(),
        supabase.from('estoque_campos').select('*').eq('estoque_id', estoqueId).order('ordem'),
        supabase.from('estoque_produtos').select('*').eq('estoque_id', estoqueId).eq('ativo', true).order('nome'),
        supabase.from('obras').select('id, titulo, status').in('status', ['Em Andamento', 'Aprovada', 'Em Orçamento']).order('titulo'),
        supabase.from('funcionarios').select('id, nome').order('nome'),
      ])
      setEstoque(est)
      setCampos(cam ?? [])
      setProdutos(prod ?? [])
      setObras(obrasData ?? [])
      setFuncionarios(funcsData ?? [])
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
    if (!produtoNome.trim()) { setError('Informe o produto.'); return }
    if (!quantidade || parseFloat(quantidade) <= 0) { setError('Informe a quantidade.'); return }
    if (!responsavel.trim()) { setError('Informe o responsável.'); return }
    if (tipo === 'saida' && produtoId && produtoId !== '__outro__') {
      const prod = produtos.find(p => p.id === produtoId)
      if (prod && prod.quantidade_atual - parseFloat(quantidade) < 0) {
        setError(`Saldo insuficiente! Estoque atual: ${prod.quantidade_atual} ${prod.unidade}.`); return
      }
    }
    if (tipo === 'saida') {
      const icone = estoque?.icone
      const needsFuncionario = icone === 'shield' || icone === 'shirt'
      const isLimpeza = icone === 'sparkles'
      if (needsFuncionario && !funcionarioId) { setError('Selecione o funcionário de destino.'); return }
      if (isLimpeza && destinoTipo === 'obra' && !obraId) { setError('Selecione a obra de destino.'); return }
      if (isLimpeza && destinoTipo === 'funcionario' && !funcionarioId) { setError('Selecione o funcionário de destino.'); return }
      if (!needsFuncionario && !isLimpeza && !obraId) { setError('Selecione a obra de destino.'); return }
    }
    if (tipo === 'entrada' && !precoEntrada) { setError('Informe o preço unitário desta entrada.'); return }

    setSaving(true); setError('')
    const supabase = createClient()

    let assinatura_url: string | null = null
    if (temAssinatura && canvasRef.current) {
      const blob = await new Promise<Blob | null>(res => canvasRef.current!.toBlob(res, 'image/png'))
      if (blob) {
        const path = `${estoqueId}/${Date.now()}.png`
        const { error: upErr } = await supabase.storage.from('assinaturas').upload(path, blob)
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('assinaturas').getPublicUrl(path)
          assinatura_url = urlData.publicUrl
        }
      }
    }

    const qtd = parseFloat(quantidade)
    const prod = produtos.find(p => p.id === produtoId)
    const cmpAtual = prod?.preco_unitario || 0
    const precoEntradaNum = parseFloat(precoEntrada) || 0
    const preco_unitario_custo = tipo === 'entrada' ? precoEntradaNum : cmpAtual
    const valor_total = qtd * preco_unitario_custo

    const { data: reg, error: regErr } = await supabase.from('estoque_registros').insert({
      estoque_id: estoqueId, produto_id: produtoId || null, produto_nome: produtoNome.trim(),
      tipo, quantidade: qtd, unidade, responsavel: responsavel.trim(), assinatura_url, data,
      observacoes: observacoes || null, obra_id: obraId || null, funcionario_id: funcionarioId || null,
      destino_tipo: tipo === 'saida' ? destinoTipo : null,
      preco_unitario_custo: preco_unitario_custo || null, valor_total: valor_total || null,
    }).select().single()

    if (regErr) { setError(regErr.message); setSaving(false); return }

    const isCAField = (c: EstoqueCampo) => { const n = c.nome.toLowerCase().replace(/\s/g, ''); return n === 'ca' || n === 'nºca' || n === 'noca' || n.includes('nºca') || n.includes('numeroca') }
    const valores = campos
      .map(c => {
        const v = valoresCampos[c.id]?.trim() || (isCAField(c) && prod?.codigo ? prod.codigo : '')
        return v ? { registro_id: reg.id, campo_id: c.id, valor: v } : null
      })
      .filter(Boolean) as { registro_id: string; campo_id: string; valor: string }[]
    if (valores.length > 0) await supabase.from('estoque_registro_valores').insert(valores)

    if (produtoId && prod) {
      const delta = tipo === 'entrada' ? qtd : -qtd
      const novaQtd = prod.quantidade_atual + delta
      const prodUpdate: Record<string, unknown> = { quantidade_atual: novaQtd }
      if (tipo === 'entrada' && precoEntradaNum > 0) {
        const novoCMP = prod.quantidade_atual > 0
          ? (prod.quantidade_atual * cmpAtual + qtd * precoEntradaNum) / novaQtd
          : precoEntradaNum
        prodUpdate.preco_unitario = novoCMP
      }
      await supabase.from('estoque_produtos').update(prodUpdate).eq('id', produtoId)
    }

    // Saída de material de limpeza para uso interno vira gasto administrativo do mês
    if (tipo === 'saida' && estoque?.icone === 'sparkles' && destinoTipo === 'uso_interno' && valor_total > 0) {
      let { data: categoria } = await supabase.from('categorias_administrativas').select('id').eq('nome', 'Material de Limpeza').maybeSingle()
      if (!categoria) {
        const { data: novaCategoria } = await supabase.from('categorias_administrativas')
          .insert({ nome: 'Material de Limpeza', icone: 'Sparkles', cor: '#2DD4BF' })
          .select('id').single()
        categoria = novaCategoria
      }
      if (categoria) {
        await supabase.from('custos_administrativos').insert({
          descricao: `${produtoNome.trim()} (${qtd} ${unidade})`,
          categoria_id: categoria.id,
          valor: valor_total,
          data,
          recorrencia: 'unico',
          ativo: true,
          observacao: 'Gerado automaticamente a partir de saída de estoque (uso interno).',
        })
      }
    }

    router.push(`/estoque/${estoqueId}`)
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
      {tipo === 'saida' && (
        <FormSaida
          produtos={produtos} campos={campos} obras={obras} funcionarios={funcionarios}
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
          showScanner={showScanner} setShowScanner={setShowScanner}
          scanMsg={scanMsg} handleScanned={handleScanned}
          saving={saving} error={error}
          onSubmit={handleSubmit}
          estoqueId={estoqueId}
          estoqueIcone={estoque?.icone ?? ''}
          produtoCodigo={produtos.find(p => p.id === produtoId)?.codigo ?? ''}
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
              <p className="text-xs text-[#94A3B8] mt-0.5">Faça upload do PDF da nota e importe os itens automaticamente</p>
            </div>
            <input type="file" accept=".pdf" className="hidden" disabled={importandoNF} onChange={handleImportarNF} />
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
          onSaved={() => { setShowLancarNF(false); router.push(`/estoque/${estoqueId}`) }}
        />
      )}

      {/* Modal Importar NF (revisão) */}
      {parsedNF && (
        <ModalImportNF
          estoqueId={estoqueId}
          produtos={produtos}
          nf={parsedNF}
          onClose={() => setParsedNF(null)}
          onSaved={() => { setParsedNF(null); router.push(`/estoque/${estoqueId}`) }}
        />
      )}
    </div>
  )
}

// ── FormSaida ─────────────────────────────────────────
function FormSaida({ produtos, campos, obras, funcionarios, produtoId, setProdutoId, produtoNome, setProdutoNome,
  quantidade, setQuantidade, unidade, setUnidade, responsavel, setResponsavel, data, setData,
  observacoes, setObservacoes, valoresCampos, setValoresCampos, temAssinatura, canvasRef,
  startDraw, draw, stopDraw, limparCanvas, obraId, setObraId, funcionarioId, setFuncionarioId,
  destinoTipo, setDestinoTipo, showScanner, setShowScanner,
  scanMsg, handleScanned, saving, error, onSubmit, estoqueId, estoqueIcone, produtoCodigo }: any) {
  const isEpiOuUniforme = estoqueIcone === 'shield' || estoqueIcone === 'shirt'
  const isLimpeza = estoqueIcone === 'sparkles'
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
      </div>

      {showScanner && <BarcodeScannerModal onScanned={handleScanned} onClose={() => setShowScanner(false)} />}

      {produtoId && produtoId !== '__outro__' && (() => {
        const prod = produtos.find((p: EstoqueProduto) => p.id === produtoId)
        if (!prod) return null
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
          <input type="number" min="0" step="any" required className="field" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Unidade</label>
          <input className="field" value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="un" />
        </div>
      </div>

      {(() => {
        const prod = produtos.find((p: EstoqueProduto) => p.id === produtoId)
        if (!prod?.preco_unitario) return null
        const total = (parseFloat(quantidade) || 0) * prod.preco_unitario
        return (
          <div className="px-3 py-2.5 bg-[#FFF7ED] border border-orange-100 rounded-lg">
            <p className="text-xs font-medium text-orange-700">Custo desta saída (CMP)</p>
            <p className="text-sm font-semibold text-orange-800 mt-0.5">
              {prod.preco_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / un
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
        <input required className="field" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome completo" />
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
      ) : isLimpeza ? (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-[#374151]">Destino *</label>
          <div className="grid grid-cols-3 gap-2">
            {(['obra', 'funcionario', 'uso_interno'] as const).map(d => (
              <button key={d} type="button"
                onClick={() => setDestinoTipo(d)}
                className={`py-2 rounded-lg text-xs font-medium border-2 transition-all ${destinoTipo === d ? 'border-[#4F7CFF] bg-[#EEF2FF] text-[#4F7CFF]' : 'border-[#E2E8F0] text-[#64748B]'}`}>
                {d === 'obra' ? 'Obra' : d === 'funcionario' ? 'Funcionário' : 'Uso Interno'}
              </button>
            ))}
          </div>
          {destinoTipo === 'obra' && (
            <select className="field" value={obraId} onChange={e => setObraId(e.target.value)} required>
              <option value="">Selecione a obra...</option>
              {obras.map((o: any) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
            </select>
          )}
          {destinoTipo === 'funcionario' && (
            <select className="field" value={funcionarioId} onChange={e => setFuncionarioId(e.target.value)} required>
              <option value="">Selecione o funcionário...</option>
              {funcionarios.map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Obra de Destino *</label>
          <select className="field" value={obraId} onChange={e => setObraId(e.target.value)} required>
            <option value="">Selecione a obra...</option>
            {obras.map((o: any) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
          </select>
          {!obraId && <p className="text-xs text-amber-500 mt-1">Saídas devem estar vinculadas a uma obra.</p>}
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
          <input type="number" min="0" step="any" required className="field" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Unidade</label>
          <input className="field" value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="un" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#374151] mb-1.5">Preço Unitário (R$) *</label>
        <input type="number" step="0.01" min="0.01" required className="field" placeholder="0,00"
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
  estoqueId: string; produtos: EstoqueProduto[]; onClose: () => void; onSaved: () => void
}) {
  const [nfNumero, setNfNumero] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
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

    for (const it of itensValidos) {
      const prod = produtos.find(p => p.id === it.produtoId)
      const qtd = parseFloat(it.quantidade)
      const precoNum = parseFloat(it.precoUnitario)
      const valorTotal = parseFloat(it.valorTotal) || qtd * precoNum

      await supabase.from('estoque_registros').insert({
        estoque_id: estoqueId,
        produto_id: it.produtoId || null,
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

      if (prod) {
        const novaQtd = prod.quantidade_atual + qtd
        const cmpAtual = prod.preco_unitario || 0
        const novoCMP = prod.quantidade_atual > 0
          ? (prod.quantidade_atual * cmpAtual + qtd * precoNum) / novaQtd
          : precoNum
        await supabase.from('estoque_produtos').update({ quantidade_atual: novaQtd, preco_unitario: novoCMP }).eq('id', prod.id)
        prod.quantidade_atual = novaQtd
        prod.preco_unitario = novoCMP
      }
    }

    setSaving(false)
    onSaved()
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
                        className="p-1 text-[#94A3B8] hover:text-red-500 transition-colors">
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
                      <input type="number" min="0" step="any" className="field text-sm" value={it.quantidade}
                        onChange={e => updateItem(i, 'quantidade', e.target.value)} placeholder="0" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs text-[#64748B] mb-1">Un.</label>
                      <input className="field text-sm" value={it.unidade}
                        onChange={e => updateItem(i, 'unidade', e.target.value)} placeholder="UN" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs text-[#64748B] mb-1">Preço Un. *</label>
                      <input type="number" step="0.01" min="0" className="field text-sm" value={it.precoUnitario}
                        onChange={e => updateItem(i, 'precoUnitario', e.target.value)} placeholder="0,00" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs text-[#64748B] mb-1">Total</label>
                      <input type="number" step="0.01" min="0" className="field text-sm bg-[#F8FAFC]" value={it.valorTotal}
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
function ModalImportNF({ estoqueId, produtos, nf, onClose, onSaved }: {
  estoqueId: string; produtos: EstoqueProduto[]
  nf: NfData; onClose: () => void; onSaved: () => void
}) {
  const itens = nf.produtos ?? []
  const [selecionados, setSelecionados] = useState<Record<number, boolean>>(
    Object.fromEntries(itens.map((_, i) => [i, true]))
  )
  const [responsavel, setResponsavel] = useState('')
  const [data, setData] = useState(nf.dataEmissao?.split('T')[0] ?? new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const allSelected = Object.values(selecionados).every(Boolean)
  const countSelecionados = Object.values(selecionados).filter(Boolean).length

  async function importar() {
    if (!responsavel.trim()) { setError('Informe o responsável.'); return }
    if (countSelecionados === 0) { setError('Selecione ao menos um item.'); return }
    setSaving(true); setError('')
    const supabase = createClient()
    const obs = nf.nfNumero ? `NF: ${nf.nfNumero}${nf.emitente ? ` · ${nf.emitente}` : ''}` : null

    const selecionadosList = itens.filter((_, i) => selecionados[i])

    for (const p of selecionadosList) {
      const prodMatch = produtos.find(pr =>
        pr.nome.toLowerCase().includes(p.descricao.toLowerCase().slice(0, 10)) ||
        p.descricao.toLowerCase().includes(pr.nome.toLowerCase().slice(0, 10))
      )

      await supabase.from('estoque_registros').insert({
        estoque_id: estoqueId,
        produto_id: prodMatch?.id ?? null,
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

      if (prodMatch) {
        const novaQtd = prodMatch.quantidade_atual + p.quantidade
        const cmpAtual = prodMatch.preco_unitario || 0
        const novoCMP = prodMatch.quantidade_atual > 0
          ? (prodMatch.quantidade_atual * cmpAtual + p.quantidade * p.valorUnitario) / novaQtd
          : p.valorUnitario
        await supabase.from('estoque_produtos').update({ quantidade_atual: novaQtd, preco_unitario: novoCMP }).eq('id', prodMatch.id)
        prodMatch.quantidade_atual = novaQtd
        prodMatch.preco_unitario = novoCMP
      }
    }

    setSaving(false)
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
            {nf.dataEmissao && <div><span className="text-[#94A3B8] text-xs">Data emissão</span><p className="font-medium text-[#0F172A]">{new Date(nf.dataEmissao).toLocaleDateString('pt-BR')}</p></div>}
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
                  const prodMatch = produtos.find(pr =>
                    pr.nome.toLowerCase().includes(p.descricao.toLowerCase().slice(0, 10)) ||
                    p.descricao.toLowerCase().includes(pr.nome.toLowerCase().slice(0, 10))
                  )
                  return (
                    <label key={i} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selecionados[i] ? 'border-[#4F7CFF] bg-[#EEF2FF]' : 'border-[#E2E8F0] bg-white'}`}>
                      <input type="checkbox" className="mt-0.5 accent-[#4F7CFF]" checked={!!selecionados[i]}
                        onChange={e => setSelecionados(s => ({ ...s, [i]: e.target.checked }))} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0F172A] leading-tight">{p.descricao}</p>
                        <p className="text-xs text-[#64748B] mt-0.5">
                          {p.quantidade} {p.unidade} · {moeda(p.valorUnitario)}/un · <span className="font-semibold text-[#374151]">{moeda(p.valorTotal)}</span>
                        </p>
                        {prodMatch && <p className="text-xs text-emerald-600 mt-0.5">↳ Vinculado a: {prodMatch.nome}</p>}
                      </div>
                    </label>
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
