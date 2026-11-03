'use client'

import { useRef, useState } from 'react'
import { Camera, CheckCircle2, Eye, Loader2, Sparkles, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mensagemErro } from '@/lib/erros'
import { formatarCompetencia, formatarData, hojeLocal } from '@/lib/datas'
import { formatarMoeda, parseNumeroBR } from '@/lib/numero'
import { pontuarComprovante, situacao, type ComprovanteLido, type Lancamento } from '@/lib/cartao'
import { ACEITA_COMPROVANTE, abrirArquivo, enviarArquivo, lerComprovante, removerArquivoSeSobrou } from './comum'

interface Item {
  nome: string
  path: string | null
  lido: ComprovanteLido | null
  estado: 'enviando' | 'pronto' | 'erro'
  destino: string            // id do gasto, 'novo' ou 'descartar'
  valorNovo: string
  descricao: string
}

// Envia vários comprovantes de uma vez (fotos do celular, PDFs, prints). A IA
// lê cada um e sugere a linha da fatura que bate pelo valor e pela data.
export default function ModalComprovantes({ competencia, lancamentos, onClose, onSaved }: {
  competencia: string
  lancamentos: Lancamento[]
  onClose: () => void
  onSaved: () => void
}) {
  const [itens, setItens] = useState<Item[]>([])
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const atualizar = (i: number, v: Partial<Item>) => setItens(lista => lista.map((it, j) => j === i ? { ...it, ...v } : it))

  async function adicionar(lista: FileList | null) {
    const arquivos = Array.from(lista ?? [])
    if (inputRef.current) inputRef.current.value = ''
    if (arquivos.length === 0) return
    const inicio = itens.length
    setItens(l => [...l, ...arquivos.map(f => ({ nome: f.name, path: null, lido: null, estado: 'enviando' as const, destino: 'novo', valorNovo: '', descricao: '' }))])
    await Promise.all(arquivos.map(async (f, k) => {
      const i = inicio + k
      try {
        const { path, arquivo } = await enviarArquivo(f, competencia)
        const lido = await lerComprovante(arquivo)
        setItens(lista => {
          // Sugere a linha que mais combina e que nenhum outro arquivo já pegou
          const pegos = new Set(lista.filter((it, j) => j !== i).map(it => it.destino))
          const melhor = lido && lancamentos
            .filter(l => !pegos.has(l.id) && l.valor > 0)
            .map(l => ({ l, p: pontuarComprovante(lido, l) + (situacao(l) === 'pendente' ? 15 : 0) }))
            .filter(x => x.p >= 50)
            .sort((a, b) => b.p - a.p)[0]
          return lista.map((it, j) => j !== i ? it : {
            ...it, path, lido, estado: 'pronto',
            destino: melhor ? melhor.l.id : 'novo',
            valorNovo: lido?.valor ? String(lido.valor).replace('.', ',') : '',
            descricao: lido?.descricao ?? '',
          })
        })
      } catch {
        atualizar(i, { estado: 'erro', destino: 'descartar' })
      }
    }))
  }

  async function descartarTudo() {
    for (const it of itens) if (it.path) await removerArquivoSeSobrou(it.path)
  }

  async function fechar() {
    if (itens.some(it => it.path) && !confirm('Descartar os comprovantes enviados sem salvar?')) return
    await descartarTudo()
    onClose()
  }

  async function salvar() {
    const novosSemValor = itens.filter(it => it.estado === 'pronto' && it.destino === 'novo' && !(parseNumeroBR(it.valorNovo) > 0))
    if (novosSemValor.length > 0) { alert('Informe o valor dos gastos novos.'); return }
    setSaving(true)
    const sb = createClient()
    try {
      for (const it of itens) {
        if (!it.path) continue
        if (it.destino === 'descartar') { await removerArquivoSeSobrou(it.path); continue }
        let id = it.destino
        if (id === 'novo') {
          const { data, error } = await sb.from('cartao_lancamentos').insert({
            competencia, data: it.lido?.data ?? hojeLocal(),
            estabelecimento: it.lido?.estabelecimento || it.descricao || 'Sem nome',
            valor: parseNumeroBR(it.valorNovo), descricao: it.descricao.trim() || null, na_fatura: false,
          }).select('id').single()
          if (error || !data) throw error
          id = data.id
        } else {
          const l = lancamentos.find(x => x.id === id)
          const mudar: Record<string, unknown> = {}
          if (l?.dispensa_comprovante) mudar.dispensa_comprovante = null
          if (!l?.descricao && it.descricao.trim()) mudar.descricao = it.descricao.trim()
          if (Object.keys(mudar).length > 0) {
            const { error } = await sb.from('cartao_lancamentos').update(mudar).eq('id', id)
            if (error) throw error
          }
        }
        const { error } = await sb.from('cartao_comprovantes').insert({ lancamento_id: id, path: it.path, nome: it.nome })
        if (error) throw error
      }
    } catch (err) {
      setSaving(false)
      alert(mensagemErro(err as Error, 'Parte dos comprovantes não foi salva. Confira a lista'))
      onSaved()
      return
    }
    setSaving(false)
    onSaved()
  }

  const opcoes = [...lancamentos].filter(l => l.valor > 0).sort((a, b) =>
    (situacao(a) === 'pendente' ? 0 : 1) - (situacao(b) === 'pendente' ? 0 : 1) || a.data.localeCompare(b.data))
  const enviando = itens.some(it => it.estado === 'enviando')

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">Enviar comprovantes · {formatarCompetencia(competencia)}</h2>
          <button onClick={fechar} aria-label="Fechar" title="Fechar" className="p-2 -mr-2"><X size={16} className="text-[#64748B]" /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          <input ref={inputRef} type="file" accept={ACEITA_COMPROVANTE} multiple className="hidden" onChange={e => adicionar(e.target.files)} />
          <button onClick={() => inputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-1.5 py-6 border-2 border-dashed border-[#CBD5E1] rounded-2xl text-[#4F7CFF] hover:bg-[#F8FAFC]">
            <Camera size={22} />
            <span className="text-sm font-medium">{itens.length ? 'Adicionar mais' : 'Tirar foto ou escolher arquivos'}</span>
            <span className="text-xs text-[#94A3B8]">Cupom, nota, recibo ou print do pedido. Pode mandar vários de uma vez.</span>
          </button>

          {itens.map((it, i) => (
            <div key={i} className="border border-[#E2E8F0] rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-2">
                {it.estado === 'enviando'
                  ? <Loader2 size={16} className="animate-spin text-[#4F7CFF] mt-0.5 shrink-0" />
                  : it.estado === 'erro'
                    ? <X size={16} className="text-red-500 mt-0.5 shrink-0" />
                    : <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#0F172A] truncate">{it.nome}</p>
                  {it.estado === 'enviando' && <p className="text-xs text-[#64748B] flex items-center gap-1"><Sparkles size={11} /> Enviando e lendo…</p>}
                  {it.estado === 'erro' && <p className="text-xs text-red-600">Não foi possível enviar este arquivo.</p>}
                  {it.estado === 'pronto' && (
                    <p className="text-xs text-[#64748B]">
                      {it.lido
                        ? [it.lido.estabelecimento, it.lido.data && formatarData(it.lido.data), it.lido.valor != null && formatarMoeda(it.lido.valor)].filter(Boolean).join(' · ')
                        : 'Não consegui ler. Escolha o gasto abaixo.'}
                    </p>
                  )}
                </div>
                {it.path && (
                  <button onClick={() => abrirArquivo(it.path!)} aria-label="Ver arquivo" title="Ver" className="p-1.5 rounded hover:bg-[#F1F5F9]"><Eye size={14} className="text-[#64748B]" /></button>
                )}
              </div>

              {it.estado === 'pronto' && (
                <>
                  <select className="field" value={it.destino} onChange={e => atualizar(i, { destino: e.target.value })} aria-label="Gasto do comprovante">
                    <option value="novo">➕ Gasto novo (ainda não está na fatura)</option>
                    {opcoes.map(l => (
                      <option key={l.id} value={l.id}>
                        {situacao(l) === 'pendente' ? '' : '✓ '}{formatarData(l.data).slice(0, 5)} · {l.estabelecimento}{l.parcela ? ` (${l.parcela})` : ''} · {formatarMoeda(l.valor)}
                      </option>
                    ))}
                    <option value="descartar">Descartar este arquivo</option>
                  </select>
                  {it.destino !== 'descartar' && (
                    <div className="flex gap-2">
                      <input className="field flex-1" value={it.descricao} onChange={e => atualizar(i, { descricao: e.target.value })} placeholder="O que foi comprado" />
                      {it.destino === 'novo' && (
                        <input className="field w-28" inputMode="decimal" value={it.valorNovo} onChange={e => atualizar(i, { valorNovo: e.target.value })} placeholder="Valor" aria-label="Valor" />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {itens.length > 0 && (
          <div className="px-6 py-4 border-t border-[#E2E8F0] flex gap-3">
            <button onClick={fechar} className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9]">Cancelar</button>
            <button onClick={salvar} disabled={saving || enviando}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
              {(saving || enviando) && <Loader2 size={15} className="animate-spin" />}
              {saving ? 'Salvando…' : enviando ? 'Lendo…' : 'Salvar comprovantes'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
