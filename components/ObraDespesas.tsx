'use client'

// Despesas diversas (estacionamento, pedágio, combustível...) de uma obra
// ou de um contrato de manutenção. Aba aberta a todo usuário: o funcionário
// lança do celular, com foto do comprovante. Na obra, o total entra no
// Centro de Custos (Financeiro).

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CreditCard, Eye, FileText, Loader2, Paperclip, Pencil, Plus, Receipt, Sparkles, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAccess } from '@/lib/useAccess'
import { hojeLocal, formatarData } from '@/lib/datas'
import { mensagemErro } from '@/lib/erros'
import { sanitizarNomeArquivo } from '@/lib/utils/nomeArquivo'
import { prepararImagem } from '@/lib/utils/imagem'
import { semTabelaCartao as semTabela } from '@/lib/cartao'
import { BUCKET_DESPESAS, CATEGORIAS_DESPESA, FORMAS_PAGAMENTO, rotuloForma, type DespesaObra } from '@/lib/despesasObra'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const ACEITA = 'image/*,application/pdf,.heic,.heif'

async function abrirComprovante(path: string) {
  // Abre a aba antes do await: Safari bloqueia window.open depois de uma espera
  const aba = window.open('', '_blank')
  const { data, error } = await createClient().storage.from(BUCKET_DESPESAS).createSignedUrl(path, 300)
  if (error || !data) { aba?.close(); alert('Não foi possível abrir o comprovante.'); return }
  if (aba) aba.location.href = data.signedUrl
  else window.location.href = data.signedUrl
}

// Despesa é de uma obra OU de um contrato de manutenção
type Alvo = { obraId: string; contratoId?: never } | { contratoId: string; obraId?: never }

// Coluna, id e prefixo dos arquivos de cada tipo de alvo
function dadosAlvo(a: Alvo) {
  return a.obraId
    ? { coluna: 'obra_id', id: a.obraId, pasta: a.obraId }
    : { coluna: 'contrato_manutencao_id', id: a.contratoId!, pasta: `manutencao/${a.contratoId}` }
}

export default function ObraDespesas(alvo: Alvo) {
  const { coluna, id: alvoId } = dadosAlvo(alvo)
  const ehObra = Boolean(alvo.obraId)
  const [despesas, setDespesas] = useState<DespesaObra[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [faltaTabela, setFaltaTabela] = useState(false)
  const [editando, setEditando] = useState<DespesaObra | 'nova' | null>(null)
  const [mes, setMes] = useState<string>('todos')

  async function carregar() {
    setErro('')
    const { data, error } = await createClient().from('obra_despesas').select('*')
      .eq(coluna, alvoId).order('data', { ascending: false }).order('created_at', { ascending: false })
    if (error) {
      // Tabela (ou a coluna da manutenção) ainda não criada: falta a migração
      if (semTabela(error) || error.code === '42703') setFaltaTabela(true)
      else setErro(mensagemErro(error, 'Não foi possível carregar as despesas'))
    } else {
      setDespesas((data ?? []) as DespesaObra[])
    }
    setLoading(false)
  }
  useEffect(() => { carregar() }, [alvoId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function excluir(d: DespesaObra) {
    if (!confirm(`Excluir a despesa "${d.descricao || d.categoria}" de ${moeda(d.valor)}?`)) return
    const sb = createClient()
    const { error } = await sb.from('obra_despesas').delete().eq('id', d.id)
    if (error) { alert(mensagemErro(error, 'Não foi possível excluir')); return }
    if (d.comprovante_path) await sb.storage.from(BUCKET_DESPESAS).remove([d.comprovante_path])
    carregar()
  }

  const meses = Array.from(new Set(despesas.map(d => d.data.slice(0, 7)))).sort().reverse()
  const visiveis = mes === 'todos' ? despesas : despesas.filter(d => d.data.startsWith(mes))
  const total = visiveis.reduce((s, d) => s + Number(d.valor || 0), 0)
  const porCategoria = new Map<string, number>()
  for (const d of visiveis) porCategoria.set(d.categoria, (porCategoria.get(d.categoria) ?? 0) + Number(d.valor || 0))
  const reembolsoPendente = visiveis.filter(d => d.forma_pagamento === 'reembolso').reduce((s, d) => s + Number(d.valor || 0), 0)

  return (
    <div>
      <div className="mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="font-syne text-xl font-bold text-[#0F172A]">{ehObra ? 'Despesas da Obra' : 'Despesas da Manutenção'}</h2>
          <p className="text-sm text-[#64748B] mt-1">Estacionamento, pedágio, combustível, alimentação e outros gastos do dia a dia</p>
        </div>
        {!faltaTabela && (
          <button onClick={() => setEditando('nova')} className="btn-primary min-h-12 flex items-center justify-center gap-2 px-4">
            <Plus size={16} /> Lançar despesa
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 size={20} className="animate-spin text-[#4F7CFF]" /></div>
      ) : faltaTabela ? (
        <div className="card text-center py-10">
          <AlertTriangle size={22} className="mx-auto text-amber-500 mb-2" />
          <p className="text-sm text-[#374151]">As despesas da obra ainda não foram ativadas no banco.</p>
          <p className="text-xs text-[#94A3B8] mt-1">Peça ao administrador para rodar a migração <code>{ehObra ? '2026_11_06_obra_despesas.sql' : '2026_11_09_despesas_manutencao.sql'}</code>.</p>
        </div>
      ) : erro ? (
        <div className="card text-center py-10">
          <AlertTriangle size={22} className="mx-auto text-red-500 mb-2" />
          <p className="text-sm text-[#374151] mb-4">{erro}</p>
          <button onClick={() => { setLoading(true); carregar() }} className="btn-primary text-sm px-4 py-2 mx-auto">Tentar de novo</button>
        </div>
      ) : (
        <>
          <p className="text-xs text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 mb-4 flex items-start gap-2">
            <CreditCard size={14} className="shrink-0 mt-0.5 text-orange-500" />
            Pagou no cartão corporativo? Não lance aqui — o gasto entra pelo Cartão corporativo, senão conta duas vezes.
          </p>

          {despesas.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="card p-4 border-l-4 border-l-rose-400 col-span-2 sm:col-span-1">
                <p className="text-xs text-[#64748B] font-medium mb-1">Total {mes === 'todos' ? (ehObra ? 'da obra' : 'do contrato') : 'do mês'}</p>
                <p className="font-syne font-bold text-lg text-[#0F172A]">{moeda(total)}</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">{visiveis.length} lançamento{visiveis.length === 1 ? '' : 's'}</p>
              </div>
              {reembolsoPendente > 0 && (
                <div className="card p-4 border-l-4 border-l-amber-400 col-span-2 sm:col-span-1">
                  <p className="text-xs text-[#64748B] font-medium mb-1">Pago do próprio bolso</p>
                  <p className="font-syne font-bold text-lg text-amber-700">{moeda(reembolsoPendente)}</p>
                  <p className="text-xs text-[#94A3B8] mt-0.5">a reembolsar</p>
                </div>
              )}
              <div className="card p-4 col-span-2 flex flex-wrap gap-1.5 content-start">
                {Array.from(porCategoria.entries()).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                  <span key={c} className="px-2.5 py-1 rounded-lg bg-[#F1F5F9] text-xs text-[#374151]">{c} <strong>{moeda(v)}</strong></span>
                ))}
              </div>
            </div>
          )}

          {meses.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none mb-3">
              {['todos', ...meses].map(m => (
                <button key={m} onClick={() => setMes(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${mes === m ? 'bg-[#4F7CFF] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}>
                  {m === 'todos' ? 'Todos' : new Date(m + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                </button>
              ))}
            </div>
          )}

          {visiveis.length === 0 ? (
            <div className="card text-center py-12">
              <Receipt size={26} className="mx-auto text-[#CBD5E1] mb-2" />
              <p className="text-sm text-[#64748B]">Nenhuma despesa lançada {ehObra ? 'nesta obra' : 'neste contrato'}.</p>
            </div>
          ) : (
            <div className="card p-0 divide-y divide-[#F1F5F9] overflow-hidden">
              {visiveis.map(d => (
                <div key={d.id} className="px-4 py-3 flex items-start gap-3">
                  <button onClick={() => setEditando(d)} className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-medium text-[#0F172A] truncate">
                      {d.categoria}{d.descricao ? <span className="text-[#64748B] font-normal"> · {d.descricao}</span> : null}
                    </p>
                    <p className="text-xs text-[#94A3B8] flex flex-wrap items-center gap-x-1.5">
                      <span>{formatarData(d.data)}</span>
                      <span>· {rotuloForma(d.forma_pagamento)}{d.pago_por ? ` (${d.pago_por})` : ''}</span>
                      {d.comprovante_path
                        ? <span className="inline-flex items-center gap-0.5 text-emerald-600"><Paperclip size={10} /> comprovante</span>
                        : <span className="text-amber-600">sem comprovante</span>}
                    </p>
                  </button>
                  <span className="text-sm font-semibold text-rose-700 shrink-0 pt-0.5">{moeda(d.valor)}</span>
                  <div className="flex shrink-0 -my-1">
                    {d.comprovante_path && (
                      <button onClick={() => abrirComprovante(d.comprovante_path!)} aria-label="Ver comprovante" title="Ver comprovante" className="p-2 rounded hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#4F7CFF]"><Eye size={15} /></button>
                    )}
                    <button onClick={() => setEditando(d)} aria-label="Editar despesa" title="Editar" className="p-2 rounded hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#4F7CFF]"><Pencil size={15} /></button>
                    <button onClick={() => excluir(d)} aria-label="Excluir despesa" title="Excluir" className="p-2 rounded hover:bg-red-50 text-[#94A3B8] hover:text-red-500"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editando && (
        <ModalDespesa alvo={alvo} despesa={editando === 'nova' ? null : editando}
          onClose={() => setEditando(null)} onSaved={() => { setEditando(null); carregar() }} />
      )}
    </div>
  )
}

function ModalDespesa({ alvo, despesa, onClose, onSaved }: {
  alvo: Alvo; despesa: DespesaObra | null; onClose: () => void; onSaved: () => void
}) {
  const d = despesa
  const { profile } = useAccess()
  const [data, setData] = useState(d?.data ?? hojeLocal())
  const [categoria, setCategoria] = useState(d?.categoria ?? 'Estacionamento')
  const [descricao, setDescricao] = useState(d?.descricao ?? '')
  const [valor, setValor] = useState(d ? String(d.valor) : '')
  const [forma, setForma] = useState(d?.forma_pagamento ?? 'pix')
  const [pagoPor, setPagoPor] = useState(d?.pago_por ?? '')
  const [observacao, setObservacao] = useState(d?.observacao ?? '')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [tirarComprovante, setTirarComprovante] = useState(false)
  const [lendo, setLendo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Quem lança costuma ser quem pagou
  useEffect(() => {
    if (!d && !pagoPor && profile?.nome) setPagoPor(profile.nome)
  }, [profile]) // eslint-disable-line react-hooks/exhaustive-deps

  async function escolherArquivo(f: File | null | undefined) {
    if (!f) return
    setArquivo(f); setTirarComprovante(false)
    // Lê data e valor do comprovante para preencher o que está vazio
    setLendo(true)
    try {
      const fd = new FormData()
      fd.append('file', await prepararImagem(f))
      const res = await fetch('/api/cartao/ler-comprovante', { method: 'POST', body: fd })
      if (res.ok) {
        const lido = await res.json() as { data?: string | null; valor?: number | null; descricao?: string | null; estabelecimento?: string | null }
        if (lido.valor && !valor) setValor(String(lido.valor))
        if (lido.data && !d) setData(lido.data)
        if (!descricao && (lido.estabelecimento || lido.descricao)) setDescricao(lido.estabelecimento || lido.descricao || '')
      }
    } catch { /* leitura automática é só ajuda */ }
    setLendo(false)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(valor.replace(',', '.'))
    if (!(v > 0)) { alert('Informe o valor da despesa.'); return }
    if (forma === 'reembolso' && !pagoPor.trim()) { alert('Informe quem pagou, para o reembolso.'); return }
    setSalvando(true)
    const sb = createClient()
    let novoPath: string | null = null
    try {
      if (arquivo) {
        const preparado = await prepararImagem(arquivo)
        novoPath = `${dadosAlvo(alvo).pasta}/${crypto.randomUUID()}-${sanitizarNomeArquivo(preparado.name)}`
        const { error } = await sb.storage.from(BUCKET_DESPESAS).upload(novoPath, preparado, { contentType: preparado.type || undefined })
        if (error) throw error
      }
      const manterAntigo = !arquivo && !tirarComprovante
      const payload = {
        [dadosAlvo(alvo).coluna]: dadosAlvo(alvo).id,
        data,
        categoria,
        descricao: descricao.trim() || null,
        valor: v,
        forma_pagamento: forma,
        pago_por: pagoPor.trim() || null,
        observacao: observacao.trim() || null,
        comprovante_path: novoPath ?? (manterAntigo ? d?.comprovante_path ?? null : null),
        comprovante_nome: novoPath ? arquivo!.name : (manterAntigo ? d?.comprovante_nome ?? null : null),
        ...(d ? {} : { criado_por_nome: profile?.nome ?? null }),
      }
      const { error } = d
        ? await sb.from('obra_despesas').update(payload).eq('id', d.id)
        : await sb.from('obra_despesas').insert(payload)
      if (error) throw error
      // Comprovante antigo trocado ou tirado: apaga o arquivo
      if (d?.comprovante_path && (novoPath || tirarComprovante)) await sb.storage.from(BUCKET_DESPESAS).remove([d.comprovante_path])
      onSaved()
    } catch (err) {
      if (novoPath) await sb.storage.from(BUCKET_DESPESAS).remove([novoPath])
      alert(mensagemErro(err as Error, 'Não foi possível salvar a despesa'))
      setSalvando(false)
    }
  }

  const temAntigo = Boolean(d?.comprovante_path) && !tirarComprovante && !arquivo

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <form onSubmit={salvar} className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="font-syne font-semibold text-[#0F172A]">{d ? 'Editar despesa' : 'Nova despesa'}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -mr-2"><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Comprovante primeiro: a foto já preenche valor e data */}
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Comprovante</label>
            {temAntigo && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <FileText size={14} className="text-[#4F7CFF] shrink-0" />
                <span className="text-sm text-[#374151] truncate flex-1">{d!.comprovante_nome ?? 'Comprovante'}</span>
                <button type="button" onClick={() => abrirComprovante(d!.comprovante_path!)} aria-label="Ver comprovante" title="Ver" className="p-1.5 rounded hover:bg-white"><Eye size={14} className="text-[#64748B]" /></button>
                <button type="button" onClick={() => setTirarComprovante(true)} aria-label="Remover comprovante" title="Remover" className="p-1.5 rounded hover:bg-red-50"><Trash2 size={14} className="text-red-400" /></button>
              </div>
            )}
            {arquivo && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
                <Paperclip size={14} className="text-emerald-600 shrink-0" />
                <span className="text-sm text-[#374151] truncate flex-1">{arquivo.name}</span>
                <button type="button" onClick={() => setArquivo(null)} aria-label="Tirar arquivo" title="Tirar" className="p-1.5 rounded hover:bg-white"><X size={14} className="text-[#64748B]" /></button>
              </div>
            )}
            <input ref={inputRef} type="file" accept={ACEITA} className="hidden" onChange={e => { escolherArquivo(e.target.files?.[0]); e.target.value = '' }} />
            {!temAntigo && !arquivo && (
              <button type="button" onClick={() => inputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-[#CBD5E1] rounded-xl text-sm text-[#4F7CFF] font-medium hover:bg-[#F8FAFC]">
                <Paperclip size={15} /> Foto do ticket, recibo ou nota
              </button>
            )}
            {temAntigo && (
              <button type="button" onClick={() => inputRef.current?.click()} className="mt-1.5 text-xs text-[#4F7CFF] font-medium">Trocar comprovante</button>
            )}
            {lendo && <p className="text-xs text-[#64748B] mt-1.5 flex items-center gap-1.5"><Sparkles size={12} className="text-[#4F7CFF]" /> Lendo o comprovante…</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Tipo *</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIAS_DESPESA.map(c => (
                <button key={c} type="button" onClick={() => setCategoria(c)}
                  className={`px-3 py-2 rounded-lg text-sm ${categoria === c ? 'bg-[#4F7CFF] text-white' : 'bg-[#F1F5F9] text-[#374151] hover:bg-[#E2E8F0]'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Valor (R$) *</label>
              <input required type="text" inputMode="decimal" className="field" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Data *</label>
              <input required type="date" className="field" value={data} onChange={e => setData(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Descrição</label>
            <input className="field" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: estacionamento do shopping, 4 horas" />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Como foi pago *</label>
            <div className="flex flex-wrap gap-1.5">
              {FORMAS_PAGAMENTO.map(f => (
                <button key={f.valor} type="button" onClick={() => setForma(f.valor)}
                  className={`px-3 py-2 rounded-lg text-sm ${forma === f.valor ? 'bg-[#4F7CFF] text-white' : 'bg-[#F1F5F9] text-[#374151] hover:bg-[#E2E8F0]'}`}>
                  {f.rotulo}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Quem pagou{forma === 'reembolso' ? ' *' : ''}</label>
            <input className="field" value={pagoPor} onChange={e => setPagoPor(e.target.value)} placeholder="Nome" />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Observação</label>
            <textarea className="field min-h-[64px]" value={observacao} onChange={e => setObservacao(e.target.value)} />
          </div>

          {d?.criado_por_nome && <p className="text-xs text-[#94A3B8]">Lançado por {d.criado_por_nome}</p>}
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-[#E2E8F0] sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className="flex-1 min-h-12 rounded-xl border border-[#E2E8F0] text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC]">Cancelar</button>
          <button type="submit" disabled={salvando || lendo} className="btn-primary flex-1 min-h-12 flex items-center justify-center gap-2 disabled:opacity-60">
            {salvando && <Loader2 size={15} className="animate-spin" />} {d ? 'Salvar' : 'Lançar'}
          </button>
        </div>
      </form>
    </div>
  )
}
