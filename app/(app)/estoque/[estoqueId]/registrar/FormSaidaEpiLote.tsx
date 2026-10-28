'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Eraser, AlertTriangle, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EstoqueCampo, EstoqueProduto } from '@/lib/types'
import { ajustarSaldo, controlaSaldo } from '@/lib/estoque/saldo'
import { hojeLocal } from '@/lib/datas'
import { arred, numeroOuPadrao } from '@/lib/numero'
import { mensagemErro } from '@/lib/erros'

interface ItemCarrinho {
  key: string
  produtoId: string
  produtoNome: string
  quantidade: string
  unidade: string
  valoresCampos: Record<string, string>
}

const isCAField = (c: EstoqueCampo) => {
  const n = c.nome.toLowerCase().replace(/\s/g, '')
  return n === 'ca' || n === 'nºca' || n === 'noca' || n.includes('nºca') || n.includes('numeroca')
}

export default function FormSaidaEpiLote({ estoqueId, estoqueNome, produtos: produtosIniciais, campos, funcionarios, responsaveis }: {
  estoqueId: string
  estoqueNome: string
  produtos: EstoqueProduto[]
  campos: EstoqueCampo[]
  funcionarios: { id: string; nome: string }[]
  responsaveis: { id: string; nome: string }[]
}) {
  const router = useRouter()
  const [respModoLivre, setRespModoLivre] = useState(false)

  const [funcionarioId, setFuncionarioId] = useState('')
  const [data, setData] = useState(hojeLocal())
  // Cópia local: o saldo é atualizado com o que o banco devolve, sem mexer nas props
  const [produtos, setProdutos] = useState<EstoqueProduto[]>(produtosIniciais)
  // Pop-up do termo bloqueado (iPhone): mostra o link em vez de sair da tela
  const [termoUrl, setTermoUrl] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState<ItemCarrinho[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Item em edição
  const [produtoId, setProdutoId] = useState('')
  const [produtoNome, setProdutoNome] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [valoresCampos, setValoresCampos] = useState<Record<string, string>>({})

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const [temAssinatura, setTemAssinatura] = useState(false)
  // Reenvio depois de falha parcial: mesmo lote (um termo só) e mesma assinatura já enviada
  const loteRef = useRef<string | null>(null)
  const assinaturaRef = useRef<string | null>(null)

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }
  function startDraw(e: React.MouseEvent | React.TouchEvent) { e.preventDefault(); isDrawing.current = true; lastPos.current = getPos(e); setTemAssinatura(true); assinaturaRef.current = null }
  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault(); if (!isDrawing.current) return
    const canvas = canvasRef.current!; const ctx = canvas.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#0F172A'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke()
    lastPos.current = pos
  }
  function stopDraw(e: React.MouseEvent | React.TouchEvent) { e.preventDefault(); isDrawing.current = false }
  function limparCanvas() { const canvas = canvasRef.current!; canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height); setTemAssinatura(false); assinaturaRef.current = null }

  function selecionarProduto(id: string) {
    setProdutoId(id)
    const prod = produtos.find(p => p.id === id)
    if (prod) {
      setProdutoNome(prod.nome)
      if (prod.codigo && campos.length > 0) {
        const campoCA = campos.find(isCAField)
        if (campoCA) setValoresCampos(v => ({ ...v, [campoCA.id]: prod.codigo! }))
      }
    } else {
      setProdutoNome('')
    }
  }

  function adicionarItem() {
    setError('')
    if (!produtoId || (produtoId === '__outro__' && !produtoNome.trim())) { setError('Selecione o produto.'); return }
    const qtd = numeroOuPadrao(quantidade, 0)
    if (!qtd || qtd <= 0) { setError('Informe a quantidade.'); return }
    if (produtoId !== '__outro__') {
      const prod = produtos.find(p => p.id === produtoId)
      const jaNoCarrinho = itens.filter(i => i.produtoId === produtoId).reduce((s, i) => s + parseFloat(i.quantidade), 0)
      if (prod && controlaSaldo(prod) && prod.quantidade_atual - jaNoCarrinho - qtd < 0) {
        setError(`Saldo insuficiente! Estoque atual: ${prod.quantidade_atual} ${prod.unidade}.`); return
      }
    }
    const prod = produtos.find(p => p.id === produtoId)
    setItens(prev => [...prev, {
      key: `${Date.now()}-${Math.random()}`,
      produtoId, produtoNome: produtoId === '__outro__' ? produtoNome.trim() : prod?.nome ?? produtoNome,
      quantidade: String(qtd), unidade: prod?.unidade ?? 'un',
      valoresCampos,
    }])
    setProdutoId(''); setProdutoNome(''); setQuantidade('1'); setValoresCampos({})
  }

  function removerItem(key: string) {
    setItens(prev => prev.filter(i => i.key !== key))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!funcionarioId) { setError('Selecione o funcionário de destino.'); return }
    if (!responsavel.trim()) { setError('Informe o responsável pela entrega.'); return }
    if (itens.length === 0) { setError('Adicione pelo menos um item ao lote.'); return }

    setSaving(true)
    const supabase = createClient()
    // Abre a aba do termo já no toque: depois de await o iPhone bloqueia o pop-up
    const abaTermo = window.open('', '_blank')
    abaTermo?.document.write('<p style="font-family:sans-serif;padding:16px">Gerando termo…</p>')
    const parar = (msg: string) => { abaTermo?.close(); setError(msg); setSaving(false) }

    let assinatura_url: string | null = assinaturaRef.current
    if (!assinatura_url && temAssinatura && canvasRef.current) {
      const blob = await new Promise<Blob | null>(res => canvasRef.current!.toBlob(res, 'image/png'))
      if (blob) {
        const path = `${estoqueId}/${Date.now()}.png`
        const { error: upErr } = await supabase.storage.from('assinaturas').upload(path, blob)
        if (upErr) { parar(mensagemErro(upErr, 'Não foi possível enviar a assinatura')); return }
        const { data: urlData } = supabase.storage.from('assinaturas').getPublicUrl(path)
        assinatura_url = urlData.publicUrl
        assinaturaRef.current = assinatura_url
      }
    }

    const loteId = loteRef.current ??= crypto.randomUUID()
    // Itens não são gravados numa transação: o que já foi gravado sai do carrinho, para um reenvio não duplicar
    const gravados = new Set<string>()
    const avisos: string[] = []
    let falha: { item: ItemCarrinho; msg: string } | null = null

    for (const item of itens) {
      const qtd = parseFloat(item.quantidade)
      const { data: reg, error: regErr } = await supabase.from('estoque_registros').insert({
        estoque_id: estoqueId, produto_id: item.produtoId === '__outro__' ? null : item.produtoId,
        produto_nome: item.produtoNome, tipo: 'saida', quantidade: qtd, unidade: item.unidade,
        responsavel: responsavel.trim(), assinatura_url, data, observacoes: observacoes || null,
        funcionario_id: funcionarioId, destino_tipo: null, lote_id: loteId,
      }).select().single()

      if (regErr) { falha = { item, msg: mensagemErro(regErr) }; break }
      gravados.add(item.key)

      const valores = campos
        .map(c => {
          const v = item.valoresCampos[c.id]?.trim()
          return v ? { registro_id: reg.id, campo_id: c.id, valor: v } : null
        })
        .filter(Boolean) as { registro_id: string; campo_id: string; valor: string }[]
      if (valores.length > 0) {
        const { error: errVal } = await supabase.from('estoque_registro_valores').insert(valores)
        if (errVal) avisos.push(`campos extras de ${item.produtoNome} (${mensagemErro(errVal)})`)
      }

      if (item.produtoId !== '__outro__') {
        const prod = produtos.find(p => p.id === item.produtoId)
        if (prod) {
          const { saldo, error: errSaldo } = await ajustarSaldo(supabase, item.produtoId, -qtd, { pisoZero: !controlaSaldo(prod) })
          if (errSaldo || saldo === null) avisos.push(`saldo de ${item.produtoNome} (${mensagemErro(errSaldo)})`)
          else {
            setProdutos(prev => prev.map(p => p.id === prod.id ? { ...p, quantidade_atual: saldo } : p))
            if (controlaSaldo(prod) && prod.quantidade_minima > 0) {
              fetch('/api/estoque/alerta-critico', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  produtoNome: prod.nome, estoqueNome,
                  quantidadeAnterior: arred(saldo + qtd), quantidadeNova: saldo,
                  quantidadeMinima: prod.quantidade_minima, unidade: prod.unidade,
                }),
              }).catch(() => {})
            }
          }
        }
      }
    }

    setSaving(false)
    if (avisos.length > 0) alert(`Entrega registrada, mas não foi possível atualizar:\n• ${avisos.join('\n• ')}\n\nConfira e ajuste manualmente.`)
    if (falha) {
      abaTermo?.close()
      setItens(prev => prev.filter(i => !gravados.has(i.key)))
      setError(`${gravados.size} item(ns) gravado(s) e retirado(s) da lista. Falhou em "${falha.item.produtoNome}": ${falha.msg} Os itens que faltam continuam na lista — toque em Registrar de novo para enviar só eles (o termo sai num só).`)
      return
    }
    const url = `/print/epi-lote/${loteId}`
    if (abaTermo) {
      abaTermo.location.href = url
      router.push(`/estoque/${estoqueId}`)
    } else {
      setTermoUrl(url)
    }
  }

  if (termoUrl) return (
    <div className="px-4 py-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 space-y-3">
      <p className="font-medium">Entrega registrada. Abra o termo de responsabilidade para imprimir e o funcionário assinar.</p>
      <div className="flex flex-wrap gap-2">
        <a href={termoUrl} target="_blank" rel="noreferrer" className="btn-primary text-sm">Abrir termo</a>
        <button type="button" onClick={() => router.push(`/estoque/${estoqueId}`)}
          className="px-4 py-2 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg bg-white">Voltar ao estoque</button>
      </div>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Data *</label>
          <input type="date" required className="field" value={data} onChange={e => setData(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Funcionário de Destino *</label>
          <select className="field" value={funcionarioId} onChange={e => setFuncionarioId(e.target.value)} required>
            <option value="">Selecione...</option>
            {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome do responsável pela entrega *</label>
        {responsaveis.length > 0 && !respModoLivre ? (
          <select className="field" value={responsavel} required
            onChange={e => { if (e.target.value === '__outro__') { setRespModoLivre(true); setResponsavel('') } else setResponsavel(e.target.value) }}>
            <option value="">Selecione...</option>
            {responsaveis.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
            <option value="__outro__">Outro (digitar manualmente)</option>
          </select>
        ) : (
          <div className="flex gap-2">
            <input required className="field flex-1" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome completo" />
            {responsaveis.length > 0 && (
              <button type="button" onClick={() => { setRespModoLivre(false); setResponsavel('') }}
                className="text-xs text-[#4F7CFF] shrink-0 px-2 hover:underline">Lista</button>
            )}
          </div>
        )}
      </div>

      {/* Carrinho de itens */}
      <div className="border border-[#E2E8F0] rounded-xl p-4 space-y-3 bg-[#F8FAFC]">
        <p className="text-sm font-medium text-[#374151]">Itens do lote</p>

        {itens.length > 0 && (
          <div className="space-y-1.5">
            {itens.map(item => (
              <div key={item.key} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-[#E2E8F0]">
                <span className="text-[#0F172A] font-medium">{item.produtoNome} <span className="text-[#94A3B8] font-normal">· {item.quantidade} {item.unidade}</span></span>
                <button type="button" onClick={() => removerItem(item.key)} aria-label={`Remover ${item.produtoNome}`} title="Remover item" className="p-2 -m-1 text-[#94A3B8] hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Produto</label>
            {produtos.length > 0 ? (
              <select className="field text-sm" value={produtoId} onChange={e => selecionarProduto(e.target.value)}>
                <option value="">Selecionar produto...</option>
                {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}{p.codigo ? ` (${p.codigo})` : ''}</option>)}
                <option value="__outro__">Outro (digitar manualmente)</option>
              </select>
            ) : (
              <input className="field text-sm" value={produtoNome} onChange={e => setProdutoNome(e.target.value)} placeholder="Nome do produto" />
            )}
            {produtoId === '__outro__' && (
              <input className="field text-sm mt-2" value={produtoNome} onChange={e => setProdutoNome(e.target.value)} placeholder="Nome do produto" />
            )}
          </div>
          <div className="w-20">
            <label className="block text-xs font-medium text-[#64748B] mb-1">Qtd</label>
            <input type="number" min="0" step="any" inputMode="decimal" className="field text-sm" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
          </div>
        </div>

        {campos.filter(c => !isCAField(c)).map(c => (
          <div key={c.id}>
            <label className="block text-xs font-medium text-[#64748B] mb-1">{c.nome}</label>
            <input className="field text-sm" value={valoresCampos[c.id] ?? ''} onChange={e => setValoresCampos(v => ({ ...v, [c.id]: e.target.value }))} />
          </div>
        ))}
        {campos.filter(isCAField).map(c => (
          <div key={c.id}>
            <label className="block text-xs font-medium text-[#64748B] mb-1">{c.nome}</label>
            <input className="field text-sm" value={valoresCampos[c.id] ?? ''} onChange={e => setValoresCampos(v => ({ ...v, [c.id]: e.target.value }))} />
          </div>
        ))}

        <button type="button" onClick={adicionarItem}
          className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-[#4F7CFF] border border-[#C7D2FE] rounded-lg py-2 hover:bg-[#EEF2FF] transition-colors">
          <Plus size={14} /> Adicionar item ao lote
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#374151] mb-1.5">Observações</label>
        <input className="field" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-[#374151]">Assinatura</label>
          {temAssinatura && (
            <button type="button" onClick={limparCanvas} className="flex items-center gap-1 text-xs text-[#64748B] hover:text-red-500">
              <Eraser size={12} /> Limpar
            </button>
          )}
        </div>
        <div className="border-2 border-dashed border-[#E2E8F0] rounded-xl overflow-hidden bg-white touch-none">
          <canvas ref={canvasRef} width={600} height={160} className="w-full touch-none"
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
        </div>
        <p className="text-xs text-[#94A3B8] mt-1">{temAssinatura ? '✓ Assinatura registrada' : 'Assine acima com o mouse ou dedo'}</p>
      </div>

      {itens.length === 0 && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>Adicione ao menos um item antes de registrar a entrega.</span>
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}

      <button type="submit" disabled={saving || itens.length === 0}
        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
        <Shield size={16} /> {saving ? 'Registrando...' : `Registrar entrega (${itens.length} ${itens.length === 1 ? 'item' : 'itens'})`}
      </button>
    </form>
  )
}
