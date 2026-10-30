'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, Wand2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import FornecedorSelect from '@/components/FornecedorSelect'
import { mensagemErro } from '@/lib/erros'
import { hojeLocal, somarDias } from '@/lib/datas'
import { formatarMoeda, parseNumeroBR } from '@/lib/numero'
import type { Fornecedor } from '@/lib/fornecedores'
import { STATUS_CONTA, type StatusConta } from './tipos'

interface ParcelaForm {
  id?: string
  vencimento: string
  valor: string
  status: StatusConta
}

const valorCampo = (n: number) => n.toFixed(2).replace('.', ',')

// Lança ou edita uma NF de compra e seus boletos (parcelas).
// A situação de cada parcela (conferida, paga...) é mantida ao editar.
export default function ModalNota({ notaId, fornecedores, onFornecedorCriado, onClose, onSaved }: {
  notaId: string | null
  fornecedores: Fornecedor[]
  onFornecedorCriado: (f: Fornecedor) => void
  onClose: () => void
  onSaved: () => void
}) {
  const [carregando, setCarregando] = useState(Boolean(notaId))
  const [obras, setObras] = useState<{ id: string; titulo: string }[]>([])
  const [fornecedorId, setFornecedorId] = useState('')
  const [numeroNf, setNumeroNf] = useState('')
  const [dataEmissao, setDataEmissao] = useState('')
  const [dataEntrada, setDataEntrada] = useState(hojeLocal())
  const [obraId, setObraId] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [observacao, setObservacao] = useState('')
  const [parcelas, setParcelas] = useState<ParcelaForm[]>([{ vencimento: '', valor: '', status: 'pendente' }])
  const [removidas, setRemovidas] = useState<string[]>([])
  const [gerador, setGerador] = useState<{ qtd: string; primeiro: string; intervalo: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.from('obras').select('id, titulo').order('titulo').then(({ data }) => setObras(data ?? []))
    if (!notaId) return
    Promise.all([
      sb.from('notas_compra').select('*').eq('id', notaId).single(),
      sb.from('contas_pagar').select('id, data_vencimento, valor, status').eq('nota_id', notaId).order('parcela').order('data_vencimento'),
    ]).then(([{ data: nota, error }, { data: contas, error: errContas }]) => {
      if (error || errContas || !nota) { alert(mensagemErro(error ?? errContas, 'Erro ao carregar a nota')); onClose(); return }
      setFornecedorId(nota.fornecedor_id)
      setNumeroNf(nota.numero_nf ?? '')
      setDataEmissao(nota.data_emissao ?? '')
      setDataEntrada(nota.data_entrada)
      setObraId(nota.obra_id ?? '')
      setValorTotal(valorCampo(Number(nota.valor_total)))
      setObservacao(nota.observacao ?? '')
      setParcelas((contas ?? []).map(c => ({ id: c.id, vencimento: c.data_vencimento, valor: valorCampo(Number(c.valor)), status: c.status })))
      setCarregando(false)
    })
  }, [notaId]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalNum = parseNumeroBR(valorTotal)
  const somaParcelas = parcelas.reduce((s, p) => s + (parseNumeroBR(p.valor) || 0), 0)
  const diferenca = (Number.isNaN(totalNum) ? 0 : totalNum) - somaParcelas

  function mudarTotal(v: string) {
    setValorTotal(v)
    // Nota nova com uma parcela só: a parcela acompanha o total
    if (!notaId && parcelas.length === 1 && !parcelas[0].id) {
      setParcelas([{ ...parcelas[0], valor: v }])
    }
  }

  function mudarParcela(i: number, campo: 'vencimento' | 'valor', v: string) {
    setParcelas(ps => ps.map((p, j) => j === i ? { ...p, [campo]: v } : p))
  }

  function removerParcela(i: number) {
    const p = parcelas[i]
    if (p.id && p.status !== 'pendente' && !confirm(`Esta parcela está "${STATUS_CONTA[p.status].label}". Remover mesmo assim?`)) return
    if (p.id) setRemovidas(r => [...r, p.id!])
    setParcelas(ps => ps.filter((_, j) => j !== i))
  }

  function gerarParcelas() {
    if (!gerador) return
    const qtd = Math.max(1, Math.min(60, parseInt(gerador.qtd) || 1))
    const intervalo = parseInt(gerador.intervalo) || 30
    if (!gerador.primeiro) { alert('Informe o 1º vencimento.'); return }
    if (Number.isNaN(totalNum) || totalNum <= 0) { alert('Informe o valor total da nota primeiro.'); return }
    if (parcelas.some(p => p.id && p.status !== 'pendente') && !confirm('Já há parcelas conferidas ou pagas. Substituir todas?')) return
    const base = Math.floor((totalNum / qtd) * 100) / 100
    const novas: ParcelaForm[] = Array.from({ length: qtd }, (_, i) => ({
      vencimento: somarDias(gerador.primeiro, i * intervalo),
      // a última parcela absorve os centavos da divisão
      valor: valorCampo(i === qtd - 1 ? Math.round((totalNum - base * (qtd - 1)) * 100) / 100 : base),
      status: 'pendente',
    }))
    setRemovidas(r => [...r, ...parcelas.filter(p => p.id).map(p => p.id!)])
    setParcelas(novas)
    setGerador(null)
  }

  async function salvar() {
    if (!fornecedorId) { alert('Escolha o fornecedor.'); return }
    if (Number.isNaN(totalNum) || totalNum <= 0) { alert('Informe o valor total da nota.'); return }
    if (parcelas.length === 0) { alert('Adicione pelo menos um boleto/parcela.'); return }
    const incompleta = parcelas.findIndex(p => { const v = parseNumeroBR(p.valor); return !p.vencimento || Number.isNaN(v) || v <= 0 })
    if (incompleta >= 0) { alert(`Preencha vencimento e valor da parcela ${incompleta + 1}.`); return }
    if (Math.abs(diferenca) >= 0.01 &&
      !confirm(`A soma das parcelas (${formatarMoeda(somaParcelas)}) é diferente do valor da nota (${formatarMoeda(totalNum)}). Salvar assim?`)) return

    setSaving(true)
    const sb = createClient()
    const payloadNota = {
      fornecedor_id: fornecedorId,
      numero_nf: numeroNf.trim() || null,
      data_emissao: dataEmissao || null,
      data_entrada: dataEntrada || hojeLocal(),
      obra_id: obraId || null,
      valor_total: totalNum,
      observacao: observacao.trim() || null,
    }
    const { data: nota, error } = notaId
      ? await sb.from('notas_compra').update(payloadNota).eq('id', notaId).select('id').single()
      : await sb.from('notas_compra').insert(payloadNota).select('id').single()
    if (error || !nota) { setSaving(false); alert(mensagemErro(error, 'Erro ao salvar a nota')); return }

    const erros: { message: string }[] = []
    if (removidas.length) {
      const { error: e } = await sb.from('contas_pagar').delete().in('id', removidas)
      if (e) erros.push(e)
    }
    const linhas = parcelas.map((p, i) => ({
      id: p.id,
      dados: { nota_id: nota.id, fornecedor_id: fornecedorId, parcela: i + 1, data_vencimento: p.vencimento, valor: parseNumeroBR(p.valor) },
    }))
    for (const l of linhas.filter(l => l.id)) {
      const { error: e } = await sb.from('contas_pagar').update(l.dados).eq('id', l.id!)
      if (e) erros.push(e)
    }
    const novas = linhas.filter(l => !l.id).map(l => l.dados)
    if (novas.length) {
      const { error: e } = await sb.from('contas_pagar').insert(novas)
      if (e) erros.push(e)
    }
    setSaving(false)
    if (erros.length) { alert(mensagemErro(erros[0], 'A nota foi salva, mas houve erro nas parcelas')); return }
    onSaved()
  }

  async function excluirNota() {
    if (!notaId) return
    if (!confirm('Excluir esta nota e todos os boletos dela?')) return
    const { error } = await createClient().from('notas_compra').delete().eq('id', notaId)
    if (error) { alert(mensagemErro(error, 'Erro ao excluir a nota')); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="font-syne font-semibold text-[#0F172A]">{notaId ? 'Editar nota fiscal' : 'Lançar nota fiscal'}</h2>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -mr-2"><X size={16} className="text-[#64748B]" /></button>
        </div>
        {carregando ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#4F7CFF]" /></div>
        ) : (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Fornecedor *</label>
              <FornecedorSelect fornecedores={fornecedores} value={fornecedorId} onChange={setFornecedorId} onCriado={onFornecedorCriado} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Nº da NF</label>
                <input className="field" value={numeroNf} onChange={e => setNumeroNf(e.target.value)} placeholder="Ex: 86191" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Emissão</label>
                <input type="date" className="field" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Entrada *</label>
                <input type="date" className="field" value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Valor total da nota (R$) *</label>
                <input className="field" inputMode="decimal" value={valorTotal} onChange={e => mudarTotal(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Obra (centro de custo)</label>
                <select className="field" value={obraId} onChange={e => setObraId(e.target.value)}>
                  <option value="">— Sem obra —</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                </select>
              </div>
            </div>

            {/* Parcelas */}
            <div className="border border-[#E2E8F0] rounded-xl">
              <div className="flex items-center justify-between px-3 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] rounded-t-xl">
                <p className="text-xs font-semibold text-[#374151]">Boletos / parcelas</p>
                <button type="button" onClick={() => setGerador(g => g ? null : { qtd: '3', primeiro: parcelas[0]?.vencimento || '', intervalo: '30' })}
                  className="text-xs font-medium text-[#4F7CFF] flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#EEF2FF]">
                  <Wand2 size={12} /> Dividir em parcelas
                </button>
              </div>

              {gerador && (
                <div className="px-3 py-3 border-b border-[#E2E8F0] bg-[#EEF2FF]/50 grid grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="block text-[11px] text-[#64748B] mb-1">Parcelas</label>
                    <input className="field" inputMode="numeric" value={gerador.qtd} onChange={e => setGerador({ ...gerador, qtd: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#64748B] mb-1">1º vencimento</label>
                    <input type="date" className="field" value={gerador.primeiro} onChange={e => setGerador({ ...gerador, primeiro: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#64748B] mb-1">A cada (dias)</label>
                    <input className="field" inputMode="numeric" value={gerador.intervalo} onChange={e => setGerador({ ...gerador, intervalo: e.target.value })} />
                  </div>
                  <button type="button" onClick={gerarParcelas} className="col-span-3 btn-primary text-sm py-2">Gerar parcelas</button>
                </div>
              )}

              <div className="divide-y divide-[#F1F5F9]">
                {parcelas.map((p, i) => (
                  <div key={p.id ?? `nova-${i}`} className="flex items-center gap-2 px-3 py-2">
                    <span className="text-xs font-semibold text-[#94A3B8] w-5 shrink-0">{i + 1}</span>
                    <input type="date" aria-label={`Vencimento da parcela ${i + 1}`} className="field flex-1 min-w-0" value={p.vencimento} onChange={e => mudarParcela(i, 'vencimento', e.target.value)} />
                    <input aria-label={`Valor da parcela ${i + 1}`} className="field w-28 shrink-0" inputMode="decimal" value={p.valor} onChange={e => mudarParcela(i, 'valor', e.target.value)} placeholder="0,00" />
                    {p.status !== 'pendente' && (
                      <span className={`hidden sm:inline text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_CONTA[p.status].classe}`}>{STATUS_CONTA[p.status].label}</span>
                    )}
                    <button type="button" onClick={() => removerParcela(i)} aria-label={`Remover parcela ${i + 1}`} title="Remover parcela"
                      className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50 shrink-0">
                      <Trash2 size={13} className="text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-3 py-2 border-t border-[#E2E8F0]">
                <button type="button" onClick={() => setParcelas(ps => [...ps, { vencimento: '', valor: '', status: 'pendente' }])}
                  className="text-xs font-medium text-[#4F7CFF] flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#EEF2FF]">
                  <Plus size={12} /> Parcela
                </button>
                <p className={`text-xs ${Math.abs(diferenca) >= 0.01 ? 'text-amber-600 font-medium' : 'text-[#64748B]'}`}>
                  Soma {formatarMoeda(somaParcelas)}
                  {Math.abs(diferenca) >= 0.01 && ` · ${diferenca > 0 ? 'faltam' : 'passam'} ${formatarMoeda(Math.abs(diferenca))}`}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Observação</label>
              <input className="field" value={observacao} onChange={e => setObservacao(e.target.value)} />
            </div>

            <div className="flex gap-3 pt-1">
              {notaId && (
                <button onClick={excluirNota} aria-label="Excluir nota" title="Excluir nota" className="w-11 flex items-center justify-center border border-red-100 rounded-xl hover:bg-red-50">
                  <Trash2 size={15} className="text-red-400" />
                </button>
              )}
              <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9]">Cancelar</button>
              <button onClick={salvar} disabled={saving}
                className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
                {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
