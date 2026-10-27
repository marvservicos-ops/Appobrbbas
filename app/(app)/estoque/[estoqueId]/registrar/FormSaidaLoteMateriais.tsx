'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Eraser, AlertTriangle, Check, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EstoqueProduto, EstoqueProdutoCategoria } from '@/lib/types'
import { controlaSaldo, saldoAposSaida } from '@/lib/estoque/saldo'

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const normalizar = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

interface ItemCarrinho {
  key: string
  produtoId: string // '' = produto novo, digitado
  produtoNome: string
  quantidade: number
  unidade: string
  preco: number
  // produto novo: cadastrar no catálogo (sem controle de saldo) com esta categoria
  cadastrar: boolean
  categoriaId: string
}

type DestinoTipo = 'obra' | 'manutencao' | 'uso_interno'

// Saída de vários materiais de uma vez (separação de material para a obra): uma assinatura, um lote
export default function FormSaidaLoteMateriais({ estoqueId, estoqueNome, produtos, categorias, obras, funcionarios, manutencoes, responsaveis }: {
  estoqueId: string
  estoqueNome: string
  produtos: EstoqueProduto[]
  categorias: EstoqueProdutoCategoria[]
  obras: { id: string; titulo: string }[]
  funcionarios: { id: string; nome: string }[]
  manutencoes: { id: string; numero_contrato: string | null; empresa?: { razao_social: string; apelido?: string | null } | null }[]
  responsaveis: { id: string; nome: string }[]
}) {
  const router = useRouter()
  const [respModoLivre, setRespModoLivre] = useState(false)

  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [responsavel, setResponsavel] = useState('')
  const [funcionarioId, setFuncionarioId] = useState('')
  const [destinoTipo, setDestinoTipo] = useState<DestinoTipo>('obra')
  const [obraId, setObraId] = useState('')
  const [manutencaoId, setManutencaoId] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState<ItemCarrinho[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Item em edição
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const qtdRef = useRef<HTMLInputElement>(null)
  const [produtoId, setProdutoId] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [novoUnidade, setNovoUnidade] = useState('un')
  const [novoPreco, setNovoPreco] = useState('')
  const [novoCategoriaId, setNovoCategoriaId] = useState('')
  const [novoCadastrar, setNovoCadastrar] = useState(true)
  const [quantidade, setQuantidade] = useState('1')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const [temAssinatura, setTemAssinatura] = useState(false)

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

  // Sugestões da busca: todas as palavras digitadas, sem diferenciar acento nem maiúscula
  // ("disco 7" acha "Disco de corte 7\"", "hidraulica" acha "Hidráulica")
  const palavras = normalizar(busca).split(/\s+/).filter(Boolean)
  const categoriaPorId = new Map(categorias.map(c => [c.id, c]))
  const sugestoes = produtos
    .filter(p => !p.sobra_mista)
    .filter(p => {
      const texto = normalizar(`${p.nome} ${p.codigo ?? ''} ${p.categoria_id ? categoriaPorId.get(p.categoria_id)?.nome ?? '' : ''}`)
      return palavras.every(w => texto.includes(w))
    })
    .slice(0, 60)

  const prodSel = produtos.find(p => p.id === produtoId)
  const ehNovo = produtoId === '__outro__'

  function escolher(p: EstoqueProduto) {
    setProdutoId(p.id); setBusca(p.nome); setAberto(false)
    setTimeout(() => qtdRef.current?.select(), 0)
  }
  function escolherNovo() {
    setProdutoId('__outro__'); setNovoNome(busca.trim()); setAberto(false)
  }
  const jaNoCarrinho = (id: string) => itens.filter(i => i.produtoId === id).reduce((s, i) => s + i.quantidade, 0)

  function adicionarItem() {
    setError('')
    const qtd = parseFloat(quantidade)
    if (!produtoId) { setError('Selecione o produto.'); return }
    if (ehNovo && !novoNome.trim()) { setError('Informe o nome do produto.'); return }
    if (!qtd || qtd <= 0) { setError('Informe a quantidade.'); return }
    if (destinoTipo === 'manutencao' && ehNovo) { setError('Para destino Manutenção, selecione um produto do catálogo.'); return }
    if (prodSel && controlaSaldo(prodSel) && prodSel.quantidade_atual - jaNoCarrinho(prodSel.id) - qtd < 0) {
      setError(`Saldo insuficiente de ${prodSel.nome}: ${prodSel.quantidade_atual - jaNoCarrinho(prodSel.id)} ${prodSel.unidade} disponível.`); return
    }
    setItens(prev => [...prev, {
      key: `${Date.now()}-${Math.random()}`,
      produtoId: ehNovo ? '' : produtoId,
      produtoNome: ehNovo ? novoNome.trim() : prodSel!.nome,
      quantidade: qtd,
      unidade: ehNovo ? (novoUnidade.trim() || 'un') : prodSel!.unidade,
      preco: ehNovo ? parseFloat(novoPreco) || 0 : prodSel!.preco_unitario || 0,
      cadastrar: ehNovo && novoCadastrar,
      categoriaId: ehNovo ? novoCategoriaId : '',
    }])
    setProdutoId(''); setBusca(''); setQuantidade('1')
    setNovoNome(''); setNovoUnidade('un'); setNovoPreco(''); setNovoCategoriaId('')
  }

  const totalLote = itens.reduce((s, i) => s + i.quantidade * i.preco, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!responsavel.trim()) { setError('Informe o responsável.'); return }
    if (!funcionarioId) { setError('Selecione quem está levando o material.'); return }
    if (destinoTipo === 'obra' && !obraId) { setError('Selecione a obra de destino.'); return }
    if (destinoTipo === 'manutencao' && !manutencaoId) { setError('Selecione o contrato de manutenção de destino.'); return }
    if (itens.length === 0) { setError('Adicione pelo menos um item.'); return }

    setSaving(true)
    const supabase = createClient()

    let assinatura_url: string | null = null
    if (temAssinatura && canvasRef.current) {
      const blob = await new Promise<Blob | null>(res => canvasRef.current!.toBlob(res, 'image/png'))
      if (blob) {
        const path = `${estoqueId}/${Date.now()}.png`
        const { error: upErr } = await supabase.storage.from('assinaturas').upload(path, blob)
        if (!upErr) assinatura_url = supabase.storage.from('assinaturas').getPublicUrl(path).data.publicUrl
      }
    }

    const loteId = crypto.randomUUID()
    // Saldo corrente por produto, já que o mesmo item pode aparecer mais de uma vez no lote
    const saldo = new Map(produtos.map(p => [p.id, p.quantidade_atual]))

    for (const item of itens) {
      let prodId = item.produtoId
      if (!prodId && item.cadastrar) {
        const { data: novo, error: novoErr } = await supabase.from('estoque_produtos').insert({
          estoque_id: estoqueId, nome: item.produtoNome, unidade: item.unidade,
          quantidade_atual: 0, quantidade_minima: 0, preco_unitario: item.preco || null,
          categoria_id: item.categoriaId || null, controla_saldo: false,
        }).select('id').single()
        if (novoErr) { setError(`${item.produtoNome}: ${novoErr.message}`); setSaving(false); return }
        prodId = novo.id
        saldo.set(prodId, 0)
      }

      const { data: reg, error: regErr } = await supabase.from('estoque_registros').insert({
        estoque_id: estoqueId, produto_id: prodId || null, produto_nome: item.produtoNome,
        tipo: 'saida', quantidade: item.quantidade, unidade: item.unidade,
        responsavel: responsavel.trim(), assinatura_url, data, observacoes: observacoes || null,
        funcionario_id: funcionarioId,
        obra_id: destinoTipo === 'obra' ? obraId : null,
        manutencao_id: destinoTipo === 'manutencao' ? manutencaoId : null,
        destino_tipo: destinoTipo, lote_id: loteId,
        preco_unitario_custo: item.preco || null, valor_total: item.quantidade * item.preco || null,
      }).select('id').single()
      if (regErr) { setError(`${item.produtoNome}: ${regErr.message}`); setSaving(false); return }

      const prod = produtos.find(p => p.id === prodId)
      if (prodId) {
        const anterior = saldo.get(prodId) ?? 0
        const nova = saldoAposSaida({ controla_saldo: prod ? prod.controla_saldo : false, quantidade_atual: anterior }, item.quantidade)
        saldo.set(prodId, nova)
        await supabase.from('estoque_produtos').update({ quantidade_atual: nova }).eq('id', prodId)

        if (prod && controlaSaldo(prod) && prod.quantidade_minima > 0) {
          fetch('/api/estoque/alerta-critico', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              produtoNome: prod.nome, estoqueNome,
              quantidadeAnterior: anterior, quantidadeNova: nova,
              quantidadeMinima: prod.quantidade_minima, unidade: prod.unidade,
            }),
          }).catch(() => {})
        }
      }

      // Destino Manutenção repõe o estoque local do contrato
      if (destinoTipo === 'manutencao' && manutencaoId && prodId) {
        const { data: existente } = await supabase.from('manutencao_estoque_produtos')
          .select('id, quantidade_atual').eq('contrato_id', manutencaoId).eq('produto_id', prodId).maybeSingle()
        if (existente) {
          await supabase.from('manutencao_estoque_produtos').update({ quantidade_atual: existente.quantidade_atual + item.quantidade }).eq('id', existente.id)
        } else {
          await supabase.from('manutencao_estoque_produtos').insert({ contrato_id: manutencaoId, produto_id: prodId, quantidade_atual: item.quantidade })
        }
        await supabase.from('manutencao_estoque_registros').insert({
          contrato_id: manutencaoId, produto_id: prodId, tipo: 'entrada', quantidade: item.quantidade,
          responsavel: responsavel.trim(), data, origem_estoque_registro_id: reg.id,
        })
      }
    }

    setSaving(false)
    router.push(`/estoque/${estoqueId}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Data *</label>
          <input type="date" required className="field" value={data} onChange={e => setData(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Responsável pela saída *</label>
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
      </div>

      <div>
        <label className="block text-sm font-medium text-[#374151] mb-1.5">Quem está levando *</label>
        <select className="field" value={funcionarioId} onChange={e => setFuncionarioId(e.target.value)} required>
          <option value="">Selecione o funcionário...</option>
          {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-[#374151]">Destino *</label>
        <div className="grid grid-cols-3 gap-2">
          {(['obra', 'uso_interno', 'manutencao'] as const).map(d => (
            <button key={d} type="button" onClick={() => setDestinoTipo(d)}
              className={`py-2 rounded-lg text-xs font-medium border-2 transition-all ${destinoTipo === d ? 'border-[#4F7CFF] bg-[#EEF2FF] text-[#4F7CFF]' : 'border-[#E2E8F0] text-[#64748B]'}`}>
              {d === 'obra' ? 'Obra' : d === 'manutencao' ? 'Manutenção' : 'Uso Interno'}
            </button>
          ))}
        </div>
        {destinoTipo === 'obra' && (
          <select className="field" value={obraId} onChange={e => setObraId(e.target.value)} required>
            <option value="">Selecione a obra...</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
          </select>
        )}
        {destinoTipo === 'manutencao' && (
          <select className="field" value={manutencaoId} onChange={e => setManutencaoId(e.target.value)} required>
            <option value="">Selecione o contrato de manutenção...</option>
            {manutencoes.map(m => (
              <option key={m.id} value={m.id}>
                {(m.empresa?.apelido || m.empresa?.razao_social || 'Sem empresa')}{m.numero_contrato ? ` · ${m.numero_contrato}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Itens */}
      <div className="border border-[#E2E8F0] rounded-xl p-4 space-y-3 bg-[#F8FAFC]">
        <p className="text-sm font-medium text-[#374151]">Itens da saída</p>

        {itens.length > 0 && (
          <div className="space-y-1.5">
            {itens.map(item => (
              <div key={item.key} className="flex items-center justify-between gap-2 text-xs bg-white rounded-lg px-3 py-2 border border-[#E2E8F0]">
                <span className="text-[#0F172A] font-medium min-w-0">
                  {item.produtoNome} <span className="text-[#94A3B8] font-normal">· {item.quantidade} {item.unidade}</span>
                  {!item.produtoId && <span className="ml-1 text-[10px] text-[#4F7CFF]">{item.cadastrar ? 'novo no catálogo' : 'avulso'}</span>}
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-[#64748B]">{item.preco ? moeda(item.quantidade * item.preco) : 'sem preço'}</span>
                  <button type="button" onClick={() => setItens(prev => prev.filter(i => i.key !== item.key))} className="text-[#94A3B8] hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
            ))}
            <div className="flex justify-between text-xs font-semibold text-[#374151] px-3 pt-1">
              <span>{itens.length} {itens.length === 1 ? 'item' : 'itens'}</span>
              <span>Custo do lote: {moeda(totalLote)}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <div className="relative">
            <label className="block text-xs font-medium text-[#64748B] mb-1">Produto</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input className={`field text-sm pl-8 ${prodSel ? 'border-[#4F7CFF] bg-[#F5F7FF] font-medium' : ''}`}
                value={busca} placeholder="Digite o nome do produto..."
                onFocus={() => setAberto(true)}
                onBlur={() => setTimeout(() => setAberto(false), 150)}
                onChange={e => { setBusca(e.target.value); setProdutoId(''); setAberto(true) }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (sugestoes[0] && palavras.length > 0) escolher(sugestoes[0])
                  }
                  if (e.key === 'Escape') setAberto(false)
                }} />
              {busca && (
                <button type="button" onClick={() => { setBusca(''); setProdutoId(''); setAberto(true) }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#374151]">
                  <X size={14} />
                </button>
              )}
            </div>
            {aberto && !prodSel && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-lg max-h-72 overflow-y-auto">
                {sugestoes.map(p => {
                  const cat = p.categoria_id ? categoriaPorId.get(p.categoria_id) : null
                  const disponivel = p.quantidade_atual - jaNoCarrinho(p.id)
                  return (
                    <button key={p.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => escolher(p)}
                      className="w-full text-left px-3 py-2 hover:bg-[#F5F7FF] border-b border-[#F1F5F9] last:border-b-0">
                      <span className="block text-sm text-[#0F172A]">{p.nome}</span>
                      <span className="flex flex-wrap items-center gap-2 text-[11px] text-[#64748B] mt-0.5">
                        {cat && <span className="px-1.5 rounded-full text-white" style={{ backgroundColor: cat.cor }}>{cat.nome}</span>}
                        {controlaSaldo(p)
                          ? <span className={disponivel <= 0 ? 'text-red-600 font-medium' : ''}>saldo {disponivel} {p.unidade}</span>
                          : <span>sem controle de saldo</span>}
                        {p.preco_unitario ? <span>{moeda(p.preco_unitario)}/{p.unidade}</span> : <span className="text-amber-700">sem preço</span>}
                      </span>
                    </button>
                  )
                })}
                {sugestoes.length === 0 && (
                  <p className="px-3 py-2 text-sm text-[#94A3B8]">Nenhum produto com &quot;{busca}&quot;.</p>
                )}
                {destinoTipo !== 'manutencao' && (
                  <button type="button" onMouseDown={e => e.preventDefault()} onClick={escolherNovo}
                    className="w-full text-left px-3 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] border-t border-[#E2E8F0] flex items-center gap-1.5">
                    <Plus size={13} /> {busca.trim() ? <>Não está na lista: cadastrar &quot;{busca.trim()}&quot;</> : 'Produto não cadastrado'}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="w-24">
            <label className="block text-xs font-medium text-[#64748B] mb-1">Qtd{prodSel ? ` (${prodSel.unidade})` : ''}</label>
            <input ref={qtdRef} type="number" min="0" step="any" className="field text-sm" value={quantidade} onChange={e => setQuantidade(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarItem() } }} />
          </div>
        </div>

        {prodSel && !prodSel.preco_unitario && (
          <p className="text-xs text-amber-700">Este produto está sem preço: vai sem custo para a obra. Defina o preço em Produtos.</p>
        )}

        {ehNovo && (
          <div className="space-y-2 p-3 bg-white border border-[#E2E8F0] rounded-lg">
            <div className="grid grid-cols-[1fr_5rem] gap-2">
              <input className="field text-sm" value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder={busca || 'Nome do produto'} autoFocus />
              <input className="field text-sm" value={novoUnidade} onChange={e => setNovoUnidade(e.target.value)} placeholder="un" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" step="0.0001" min="0" className="field text-sm" value={novoPreco} onChange={e => setNovoPreco(e.target.value)} placeholder="Preço unit. (R$)" />
              {novoCadastrar && categorias.length > 0 && (
                <select className="field text-sm" value={novoCategoriaId} onChange={e => setNovoCategoriaId(e.target.value)}>
                  <option value="">Sem categoria</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs text-[#374151] cursor-pointer">
              <input type="checkbox" className="rounded" checked={novoCadastrar} onChange={e => setNovoCadastrar(e.target.checked)} />
              Cadastrar no catálogo (sem controle de saldo)
            </label>
          </div>
        )}

        <button type="button" onClick={adicionarItem}
          className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-[#4F7CFF] border border-[#C7D2FE] rounded-lg py-2 hover:bg-[#EEF2FF] transition-colors">
          <Plus size={14} /> Adicionar item
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#374151] mb-1.5">Observações</label>
        <input className="field" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-[#374151]">Assinatura de quem leva</label>
          {temAssinatura && (
            <button type="button" onClick={limparCanvas} className="flex items-center gap-1 text-xs text-[#64748B] hover:text-red-500">
              <Eraser size={12} /> Limpar
            </button>
          )}
        </div>
        <div className="border-2 border-dashed border-[#E2E8F0] rounded-xl overflow-hidden bg-white touch-none">
          <canvas ref={canvasRef} width={600} height={160} className="w-full"
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
        </div>
        <p className="text-xs text-[#94A3B8] mt-1">{temAssinatura ? '✓ Assinatura registrada' : 'Assine acima com o mouse ou dedo'}</p>
      </div>

      {itens.length === 0 && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>Adicione ao menos um item antes de registrar a saída.</span>
        </div>
      )}
      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <button type="submit" disabled={saving || itens.length === 0}
        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
        <Check size={16} /> {saving ? 'Registrando...' : `Registrar saída (${itens.length} ${itens.length === 1 ? 'item' : 'itens'} · ${moeda(totalLote)})`}
      </button>
    </form>
  )
}
