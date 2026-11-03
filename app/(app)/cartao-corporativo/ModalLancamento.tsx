'use client'

import { useRef, useState } from 'react'
import { Eye, FileText, Loader2, Paperclip, Sparkles, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mensagemErro } from '@/lib/erros'
import { hojeLocal } from '@/lib/datas'
import { parseNumeroBR } from '@/lib/numero'
import { MOTIVOS_DISPENSA, type Comprovante, type Lancamento } from '@/lib/cartao'
import { prepararImagem } from '@/lib/utils/imagem'
import {
  ACEITA_COMPROVANTE, CamposDestino, abrirArquivo, enviarArquivo, lerComprovante, removerArquivoSeSobrou,
  type CategoriaOpcao, type ObraOpcao,
} from './comum'

// Cria ou edita um gasto do cartão, com os comprovantes. Arquivos novos e
// removidos só valem ao salvar.
export default function ModalLancamento({ lancamento, competencia, obras, categorias, bloqueado, onClose, onSaved }: {
  lancamento: Lancamento | null
  competencia: string
  obras: ObraOpcao[]
  categorias: CategoriaOpcao[]
  bloqueado: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const l = lancamento
  const [comp, setComp] = useState(l?.competencia ?? competencia)
  const [data, setData] = useState(l?.data ?? hojeLocal())
  const [estabelecimento, setEstabelecimento] = useState(l?.estabelecimento ?? '')
  const [valor, setValor] = useState(l ? String(l.valor).replace('.', ',') : '')
  const [parcela, setParcela] = useState(l?.parcela ?? '')
  const [descricao, setDescricao] = useState(l?.descricao ?? '')
  const [destino, setDestino] = useState<Lancamento['destino']>(l?.destino ?? null)
  const [obraId, setObraId] = useState(l?.obra_id ?? null)
  const [categoriaId, setCategoriaId] = useState(l?.categoria_id ?? null)
  const [dispensa, setDispensa] = useState(l?.dispensa_comprovante ?? '')
  const [semComprovante, setSemComprovante] = useState(Boolean(l?.dispensa_comprovante))
  const [observacao, setObservacao] = useState(l?.observacao ?? '')
  const [existentes, setExistentes] = useState<Comprovante[]>(l?.comprovantes ?? [])
  const [removidos, setRemovidos] = useState<Comprovante[]>([])
  const [novos, setNovos] = useState<File[]>([])
  const [lendo, setLendo] = useState(false)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const totalArquivos = existentes.length + novos.length

  async function adicionarArquivos(lista: FileList | null) {
    const arquivos = Array.from(lista ?? [])
    if (inputRef.current) inputRef.current.value = ''
    if (arquivos.length === 0) return
    const preparados = await Promise.all(arquivos.map(f => prepararImagem(f)))
    setNovos(n => [...n, ...preparados])
    setSemComprovante(false)
    // Preenche o que estiver vazio com o que a IA ler do primeiro arquivo
    if (descricao.trim() && estabelecimento.trim() && valor.trim()) return
    setLendo(true)
    const lido = await lerComprovante(preparados[0])
    setLendo(false)
    if (!lido) return
    if (!descricao.trim() && lido.descricao) setDescricao(lido.descricao)
    if (!l) {
      if (!estabelecimento.trim() && lido.estabelecimento) setEstabelecimento(lido.estabelecimento)
      if (!valor.trim() && lido.valor) setValor(String(lido.valor).replace('.', ','))
      if (lido.data) setData(lido.data)
    }
  }

  async function salvar() {
    const valorNum = parseNumeroBR(valor)
    if (!estabelecimento.trim()) { alert('Informe o estabelecimento.'); return }
    if (!data) { alert('Informe a data da compra.'); return }
    if (Number.isNaN(valorNum) || valorNum === 0) { alert('Informe um valor válido.'); return }
    if (!/^\d{4}-\d{2}$/.test(comp)) { alert('Informe o mês da fatura.'); return }
    if (semComprovante && !dispensa.trim()) { alert('Diga por que este gasto não tem comprovante.'); return }
    setSaving(true)
    const sb = createClient()
    const payload = {
      competencia: comp,
      data,
      estabelecimento: estabelecimento.trim(),
      valor: valorNum,
      parcela: parcela.trim() || null,
      descricao: descricao.trim() || null,
      destino,
      obra_id: destino === 'obra' ? obraId : null,
      categoria_id: destino === 'empresa' ? categoriaId : null,
      dispensa_comprovante: semComprovante && totalArquivos === 0 ? dispensa.trim() : null,
      observacao: observacao.trim() || null,
    }
    const res = l
      ? await sb.from('cartao_lancamentos').update(payload).eq('id', l.id).select('id').single()
      : await sb.from('cartao_lancamentos').insert(payload).select('id').single()
    if (res.error || !res.data) { setSaving(false); alert(mensagemErro(res.error, 'Erro ao salvar o gasto')); return }
    const id = res.data.id as string

    try {
      for (const f of novos) {
        const { path, nome } = await enviarArquivo(f, comp)
        const { error } = await sb.from('cartao_comprovantes').insert({ lancamento_id: id, path, nome })
        if (error) { await removerArquivoSeSobrou(path); throw error }
      }
      for (const c of removidos) {
        const { error } = await sb.from('cartao_comprovantes').delete().eq('id', c.id)
        if (error) throw error
        await removerArquivoSeSobrou(c.path)
      }
    } catch (err) {
      setSaving(false)
      alert(mensagemErro(err as Error, 'O gasto foi salvo, mas houve erro com os comprovantes'))
      onSaved()
      return
    }
    setSaving(false)
    onSaved()
  }

  async function excluir() {
    if (!l) return
    if (!confirm('Excluir este gasto e os comprovantes dele?')) return
    const sb = createClient()
    const { error } = await sb.from('cartao_lancamentos').delete().eq('id', l.id)
    if (error) { alert(mensagemErro(error, 'Erro ao excluir o gasto')); return }
    for (const c of l.comprovantes) await removerArquivoSeSobrou(c.path)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="font-syne font-semibold text-[#0F172A]">{l ? 'Gasto do cartão' : 'Novo gasto do cartão'}</h2>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -mr-2"><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-4">
          {bloqueado && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Este mês está fechado. Reabra o mês para alterar os gastos.
            </p>
          )}
          {!l && (
            <p className="text-xs text-[#64748B] bg-[#F8FAFC] rounded-lg px-3 py-2">
              Lance aqui o gasto que a fatura ainda não trouxe. Quando importar a fatura, ele é reconhecido e não duplica.
            </p>
          )}

          {/* Comprovantes */}
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Comprovantes</label>
            <div className="space-y-1.5">
              {existentes.map(c => (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                  <FileText size={14} className="text-[#4F7CFF] shrink-0" />
                  <span className="text-sm text-[#374151] truncate flex-1">{c.nome ?? 'Comprovante'}</span>
                  <button type="button" onClick={() => abrirArquivo(c.path)} aria-label="Ver comprovante" title="Ver" className="p-1.5 rounded hover:bg-white"><Eye size={14} className="text-[#64748B]" /></button>
                  {!bloqueado && (
                    <button type="button" onClick={() => { setExistentes(e => e.filter(x => x.id !== c.id)); setRemovidos(r => [...r, c]) }}
                      aria-label="Remover comprovante" title="Remover" className="p-1.5 rounded hover:bg-red-50"><Trash2 size={14} className="text-red-400" /></button>
                  )}
                </div>
              ))}
              {novos.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
                  <Paperclip size={14} className="text-emerald-600 shrink-0" />
                  <span className="text-sm text-[#374151] truncate flex-1">{f.name}</span>
                  <span className="text-[10px] font-semibold text-emerald-700">novo</span>
                  <button type="button" onClick={() => setNovos(n => n.filter((_, j) => j !== i))}
                    aria-label="Tirar arquivo" title="Tirar" className="p-1.5 rounded hover:bg-white"><X size={14} className="text-[#64748B]" /></button>
                </div>
              ))}
            </div>
            {!bloqueado && (
              <>
                <input ref={inputRef} type="file" accept={ACEITA_COMPROVANTE} multiple className="hidden" onChange={e => adicionarArquivos(e.target.files)} />
                <button type="button" onClick={() => inputRef.current?.click()}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[#CBD5E1] rounded-xl text-sm text-[#4F7CFF] font-medium hover:bg-[#F8FAFC]">
                  <Paperclip size={15} /> Anexar foto, PDF ou print
                </button>
              </>
            )}
            {lendo && <p className="text-xs text-[#64748B] mt-1.5 flex items-center gap-1.5"><Sparkles size={12} className="text-[#4F7CFF]" /> Lendo o comprovante…</p>}

            {totalArquivos === 0 && (
              <label className="flex items-center gap-2 mt-3 text-sm text-[#374151]">
                <input type="checkbox" checked={semComprovante} disabled={bloqueado} onChange={e => setSemComprovante(e.target.checked)} />
                Não tem comprovante (anuidade, IOF, tarifa…)
              </label>
            )}
            {semComprovante && totalArquivos === 0 && (
              <div className="mt-2">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {MOTIVOS_DISPENSA.map(m => (
                    <button key={m} type="button" onClick={() => setDispensa(m)} disabled={bloqueado}
                      className={`px-2.5 py-1 rounded-lg text-xs ${dispensa === m ? 'bg-[#4F7CFF] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}>
                      {m}
                    </button>
                  ))}
                </div>
                <input className="field" value={dispensa} disabled={bloqueado} onChange={e => setDispensa(e.target.value)} placeholder="Motivo" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">O que foi comprado</label>
            <input className="field" value={descricao} disabled={bloqueado} onChange={e => setDescricao(e.target.value)} placeholder="Ex: diesel do caminhão, parafusos para a obra X" />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Para onde vai o custo</label>
            <CamposDestino destino={destino} obraId={obraId} categoriaId={categoriaId} obras={obras} categorias={categorias}
              onChange={v => { if (bloqueado) return; setDestino(v.destino); setObraId(v.obra_id); setCategoriaId(v.categoria_id) }} />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Estabelecimento (como vem na fatura) *</label>
            <input className="field" value={estabelecimento} disabled={bloqueado} onChange={e => setEstabelecimento(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Data da compra *</label>
              <input type="date" className="field" value={data} disabled={bloqueado} onChange={e => setData(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Valor (R$) *</label>
              <input className="field" inputMode="decimal" value={valor} disabled={bloqueado} onChange={e => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Parcela</label>
              <input className="field" value={parcela} disabled={bloqueado} onChange={e => setParcela(e.target.value)} placeholder="Ex: 2/5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Mês da fatura *</label>
              <input type="month" className="field" value={comp} disabled={bloqueado} onChange={e => setComp(e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] text-[#94A3B8] -mt-2">Estorno ou crédito: valor negativo.</p>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Observação</label>
            <input className="field" value={observacao} disabled={bloqueado} onChange={e => setObservacao(e.target.value)} />
          </div>

          <div className="flex gap-3 pt-1">
            {l && !bloqueado && (
              <button onClick={excluir} aria-label="Excluir" title="Excluir" className="w-11 flex items-center justify-center border border-red-100 rounded-xl hover:bg-red-50">
                <Trash2 size={15} className="text-red-400" />
              </button>
            )}
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9]">
              {bloqueado ? 'Fechar' : 'Cancelar'}
            </button>
            {!bloqueado && (
              <button onClick={salvar} disabled={saving || lendo}
                className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
                {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
