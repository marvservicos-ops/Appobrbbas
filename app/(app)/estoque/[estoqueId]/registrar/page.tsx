'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Eraser, Check, Loader2, Camera, ScanLine, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Estoque, EstoqueCampo, EstoqueProduto } from '@/lib/types'
import Link from 'next/link'
import BarcodeScannerModal from '@/components/BarcodeScannerModal'

export default function RegistrarPage() {
  const { estoqueId } = useParams<{ estoqueId: string }>()
  const router = useRouter()
  const [estoque, setEstoque] = useState<Estoque | null>(null)
  const [campos, setCampos] = useState<EstoqueCampo[]>([])
  const [produtos, setProdutos] = useState<EstoqueProduto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Campos do form
  const [tipo, setTipo] = useState<'saida' | 'entrada'>('saida')
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

  // Canvas signature
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: est }, { data: cam }, { data: prod }, { data: obrasData }] = await Promise.all([
        supabase.from('estoques').select('*').eq('id', estoqueId).single(),
        supabase.from('estoque_campos').select('*').eq('estoque_id', estoqueId).order('ordem'),
        supabase.from('estoque_produtos').select('*').eq('estoque_id', estoqueId).eq('ativo', true).order('nome'),
        supabase.from('obras').select('id, titulo, status').in('status', ['Em andamento', 'Paralisada']).order('titulo'),
      ])
      setEstoque(est)
      setCampos(cam ?? [])
      setProdutos(prod ?? [])
      setObras(obrasData ?? [])
      setLoading(false)
    }
    load()
  }, [estoqueId])

  // Atualiza unidade e auto-preenche campos quando produto muda
  useEffect(() => {
    const prod = produtos.find(p => p.id === produtoId)
    if (prod) {
      setUnidade(prod.unidade)
      setProdutoNome(prod.nome)
      // Auto-preenche campos customizados com o código do produto (ex: Nº CA)
      if (prod.codigo && campos.length > 0) {
        const campoCA = campos.find(c => {
          const n = c.nome.toLowerCase().replace(/\s/g, '')
          return n === 'ca' || n === 'nºca' || n === 'noca' || n.includes('nºca') || n.includes('numeroca')
        })
        if (campoCA) {
          setValoresCampos(v => ({ ...v, [campoCA.id]: prod.codigo! }))
        }
      }
    }
  }, [produtoId, produtos, campos])

  function handleScanned(code: string) {
    setShowScanner(false)
    // Busca produto pelo codigo_barras ou codigo
    const found = produtos.find(p =>
      (p as any).codigo_barras === code || p.codigo === code
    )
    if (found) {
      setProdutoId(found.id)
      setProdutoNome(found.nome)
      setScanMsg(`✓ Produto encontrado: ${found.nome}`)
    } else {
      setProdutoId('__outro__')
      setProdutoNome(code)
      setScanMsg(`Produto não cadastrado. Código: ${code}`)
    }
    setTimeout(() => setScanMsg(''), 4000)
  }

  // ── Canvas signature handlers ─────────────────────────
  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    isDrawing.current = true
    lastPos.current = getPos(e)
    setTemAssinatura(true)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!isDrawing.current) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#0F172A'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
  }

  function stopDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    isDrawing.current = false
  }

  function limparCanvas() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setTemAssinatura(false)
  }
  // ─────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!produtoNome.trim()) { setError('Informe o produto.'); return }
    if (!quantidade || parseFloat(quantidade) <= 0) { setError('Informe a quantidade.'); return }
    if (!responsavel.trim()) { setError('Informe o responsável.'); return }

    // Bloqueio de estoque negativo
    if (tipo === 'saida' && produtoId && produtoId !== '__outro__') {
      const prod = produtos.find(p => p.id === produtoId)
      if (prod && prod.quantidade_atual - parseFloat(quantidade) < 0) {
        setError(`Saldo insuficiente! Estoque atual: ${prod.quantidade_atual} ${prod.unidade}. Você está tentando dar saída de ${quantidade} ${prod.unidade}.`)
        setSaving(false)
        return
      }
    }

    setSaving(true)
    setError('')
    const supabase = createClient()

    // Upload assinatura se houver
    let assinatura_url: string | null = null
    if (temAssinatura && canvasRef.current) {
      const canvas = canvasRef.current
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
      if (blob) {
        const path = `${estoqueId}/${Date.now()}.png`
        const { error: upErr } = await supabase.storage.from('assinaturas').upload(path, blob)
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('assinaturas').getPublicUrl(path)
          assinatura_url = urlData.publicUrl
        }
      }
    }

    // Inserir registro
    const { data: reg, error: regErr } = await supabase.from('estoque_registros').insert({
      estoque_id: estoqueId,
      produto_id: produtoId || null,
      produto_nome: produtoNome.trim(),
      tipo,
      quantidade: parseFloat(quantidade),
      unidade,
      responsavel: responsavel.trim(),
      assinatura_url,
      data,
      observacoes: observacoes || null,
      obra_id: obraId || null,
    }).select().single()

    if (regErr) { setError(regErr.message); setSaving(false); return }

    // Inserir valores de campos customizados
    const valores = campos
      .filter(c => valoresCampos[c.id]?.trim())
      .map(c => ({ registro_id: reg.id, campo_id: c.id, valor: valoresCampos[c.id].trim() }))

    if (valores.length > 0) {
      await supabase.from('estoque_registro_valores').insert(valores)
    }

    // Atualizar quantidade do produto
    if (produtoId) {
      const prod = produtos.find(p => p.id === produtoId)
      if (prod) {
        const delta = tipo === 'entrada' ? parseFloat(quantidade) : -parseFloat(quantidade)
        await supabase.from('estoque_produtos').update({ quantidade_atual: prod.quantidade_atual + delta }).eq('id', produtoId)
      }
    }

    router.push(`/estoque/${estoqueId}`)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 size={28} className="animate-spin text-[#4F7CFF]" />
    </div>
  )

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/estoque/${estoqueId}`} className="w-9 h-9 rounded-xl border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors">
          <ArrowLeft size={16} className="text-[#64748B]" />
        </Link>
        <div>
          <h1 className="font-syne font-bold text-xl text-[#0F172A]">Novo Registro</h1>
          <p className="text-xs text-[#64748B]">{estoque?.nome}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Tipo entrada/saída */}
        <div className="flex gap-3">
          {(['saida', 'entrada'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTipo(t)}
              className={`flex-1 py-3 rounded-xl font-medium text-sm border-2 transition-all ${tipo === t
                ? t === 'saida' ? 'border-red-400 bg-red-50 text-red-600' : 'border-green-400 bg-green-50 text-green-600'
                : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'}`}>
              {t === 'saida' ? '↑ Saída' : '↓ Entrada'}
            </button>
          ))}
        </div>

        {/* Data */}
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Data *</label>
          <input type="date" required className="field" value={data} onChange={e => setData(e.target.value)} />
        </div>

        {/* Produto */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-[#374151]">Produto *</label>
            <button type="button" onClick={() => setShowScanner(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] px-2.5 py-1.5 rounded-lg transition-colors border border-[#C7D2FE]">
              <ScanLine size={13} /> Escanear código
            </button>
          </div>
          {scanMsg && (
            <p className={`text-xs px-3 py-2 rounded-lg mb-2 ${scanMsg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
              {scanMsg}
            </p>
          )}
          {produtos.length > 0 ? (
            <select className="field" value={produtoId} onChange={e => setProdutoId(e.target.value)}>
              <option value="">Selecionar produto cadastrado...</option>
              {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}{p.codigo ? ` (${p.codigo})` : ''}</option>)}
              <option value="__outro__">Outro (digitar manualmente)</option>
            </select>
          ) : null}
          {(produtoId === '__outro__' || produtos.length === 0) && (
            <input className="field mt-2" value={produtoNome} onChange={e => setProdutoNome(e.target.value)}
              placeholder="Nome do produto" required={!produtoId || produtoId === '__outro__'} />
          )}
        </div>

        {showScanner && (
          <BarcodeScannerModal onScanned={handleScanned} onClose={() => setShowScanner(false)} />
        )}

        {/* Aviso de saldo ao selecionar produto */}
        {produtoId && produtoId !== '__outro__' && (() => {
          const prod = produtos.find(p => p.id === produtoId)
          if (!prod) return null
          const qtd = parseFloat(quantidade) || 0
          const saldoApos = tipo === 'saida' ? prod.quantidade_atual - qtd : prod.quantidade_atual + qtd
          if (tipo === 'saida' && saldoApos < 0) {
            return (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span><strong>Saldo insuficiente!</strong> Estoque atual: {prod.quantidade_atual} {prod.unidade}. Não é possível dar saída de {qtd} {prod.unidade}.</span>
              </div>
            )
          }
          if (tipo === 'saida' && prod.quantidade_atual <= prod.quantidade_minima) {
            return (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>Este produto está no estoque mínimo ({prod.quantidade_atual} {prod.unidade}). Considere reabastecer.</span>
              </div>
            )
          }
          return null
        })()}

        {/* Quantidade e Unidade */}
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

        {/* Campos customizados */}
        {campos.map(c => (
          <div key={c.id}>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              {c.nome} {c.obrigatorio && <span className="text-red-400">*</span>}
            </label>
            <input
              type={c.tipo === 'number' ? 'number' : c.tipo === 'date' ? 'date' : 'text'}
              className="field"
              required={c.obrigatorio}
              value={valoresCampos[c.id] ?? ''}
              onChange={e => setValoresCampos(v => ({ ...v, [c.id]: e.target.value }))}
              placeholder={c.tipo === 'unit' ? 'Ex: kg, m², L...' : ''}
            />
          </div>
        ))}

        {/* Responsável */}
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome do responsável *</label>
          <input required className="field" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome completo" />
        </div>

        {/* Destino / Obra */}
        {tipo === 'saida' && obras.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Destino / Obra (Centro de Custo)</label>
            <select className="field" value={obraId} onChange={e => setObraId(e.target.value)}>
              <option value="">Sem vínculo com obra</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
            </select>
          </div>
        )}

        {/* Assinatura */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-[#374151]">Assinatura</label>
            {temAssinatura && (
              <button type="button" onClick={limparCanvas} className="flex items-center gap-1 text-xs text-[#64748B] hover:text-red-500 transition-colors">
                <Eraser size={12} /> Limpar
              </button>
            )}
          </div>
          <div className="border-2 border-[#E2E8F0] rounded-xl overflow-hidden bg-white touch-none"
            style={{ cursor: 'crosshair' }}>
            <canvas
              ref={canvasRef}
              width={600}
              height={160}
              className="w-full"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
          </div>
          <p className="text-xs text-[#94A3B8] mt-1">
            {temAssinatura ? '✓ Assinatura registrada' : 'Assine acima com o mouse ou dedo (celular)'}
          </p>
        </div>

        {/* Observações */}
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Observações</label>
          <textarea className="field resize-none" rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" />
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Link href={`/estoque/${estoqueId}`}
            className="flex-1 py-3 text-center text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-colors">
            Cancelar
          </Link>
          <button type="submit" disabled={saving}
            className="flex-1 btn-primary flex items-center justify-center gap-2 py-3">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? 'Salvando...' : 'Salvar Registro'}
          </button>
        </div>
      </form>
    </div>
  )
}
