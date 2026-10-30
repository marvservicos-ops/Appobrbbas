'use client'

import { useState } from 'react'
import { FileText, Loader2, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import FornecedorSelect from '@/components/FornecedorSelect'
import { mensagemErro } from '@/lib/erros'
import { hojeLocal } from '@/lib/datas'
import { parseNumeroBR } from '@/lib/numero'
import type { Fornecedor } from '@/lib/fornecedores'
import { MOTIVOS_DIVERGENCIA, STATUS_CONTA, STATUS_ORDEM, type Conta, type StatusConta } from './tipos'

// Edita um boleto/parcela. Sem `conta`, lança um boleto avulso; com
// `doDda`, é o boleto que apareceu no DDA sem registro (entra Divergente).
export default function ModalConta({ conta, doDda, fornecedores, onFornecedorCriado, onEditarNota, onClose, onSaved }: {
  conta: Conta | null
  doDda?: boolean
  fornecedores: Fornecedor[]
  onFornecedorCriado: (f: Fornecedor) => void
  onEditarNota: (notaId: string) => void
  onClose: () => void
  onSaved: () => void
}) {
  const [fornecedorId, setFornecedorId] = useState(conta?.fornecedor_id ?? '')
  const [descricao, setDescricao] = useState(conta?.descricao ?? '')
  const [vencimento, setVencimento] = useState(conta?.data_vencimento ?? '')
  const [valor, setValor] = useState(conta ? String(conta.valor) : '')
  const [status, setStatus] = useState<StatusConta>(conta?.status ?? (doDda ? 'divergente' : 'pendente'))
  const [motivo, setMotivo] = useState(conta?.motivo_divergencia ?? (doDda ? 'Boleto no DDA sem registro no sistema' : ''))
  const [dataPagamento, setDataPagamento] = useState(conta?.data_pagamento ?? hojeLocal())
  const [observacao, setObservacao] = useState(conta?.observacao ?? '')
  const [saving, setSaving] = useState(false)

  const daNota = Boolean(conta?.nota_id)
  const titulo = conta ? 'Editar conta' : doDda ? 'Boleto do DDA sem registro' : 'Novo boleto avulso'

  async function salvar() {
    const valorNum = parseNumeroBR(valor)
    if (!fornecedorId) { alert('Escolha o fornecedor.'); return }
    if (!vencimento) { alert('Informe o vencimento.'); return }
    if (Number.isNaN(valorNum) || valorNum <= 0) { alert('Informe um valor válido.'); return }
    if (status === 'divergente' && !motivo.trim()) { alert('Diga o que não bate com o DDA.'); return }
    setSaving(true)
    const payload = {
      fornecedor_id: fornecedorId,
      descricao: descricao.trim() || null,
      data_vencimento: vencimento,
      valor: valorNum,
      status,
      motivo_divergencia: status === 'divergente' ? motivo.trim() : (conta?.motivo_divergencia ?? null),
      data_pagamento: status === 'pago' ? (dataPagamento || hojeLocal()) : null,
      observacao: observacao.trim() || null,
    }
    const sb = createClient()
    const { error } = conta
      ? await sb.from('contas_pagar').update(payload).eq('id', conta.id)
      : await sb.from('contas_pagar').insert(payload)
    setSaving(false)
    if (error) { alert(mensagemErro(error, 'Erro ao salvar a conta')); return }
    onSaved()
  }

  async function excluir() {
    if (!conta) return
    const aviso = daNota
      ? 'Excluir esta parcela? A nota continua lançada, só sem esta parcela.'
      : 'Excluir este boleto?'
    if (!confirm(aviso)) return
    const { error } = await createClient().from('contas_pagar').delete().eq('id', conta.id)
    if (error) { alert(mensagemErro(error, 'Erro ao excluir a conta')); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="font-syne font-semibold text-[#0F172A]">{titulo}</h2>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -mr-2"><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-4">
          {daNota && conta?.nota_id && (
            <button type="button" onClick={() => onEditarNota(conta.nota_id!)}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#EEF2FF] text-sm text-[#4F7CFF] font-medium hover:bg-[#E0E7FF]">
              <FileText size={15} />
              Parcela da {conta.nota?.numero_nf ? `NF ${conta.nota.numero_nf}` : 'nota'} — editar a nota inteira
            </button>
          )}

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Fornecedor *</label>
            <FornecedorSelect fornecedores={fornecedores} value={fornecedorId} onChange={setFornecedorId}
              onCriado={onFornecedorCriado} disabled={daNota} />
            {daNota && <p className="text-[11px] text-[#94A3B8] mt-1">O fornecedor de uma parcela muda pela nota.</p>}
          </div>

          {!daNota && (
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Descrição</label>
              <input className="field" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: boleto de frete, nº do documento..." />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Vencimento *</label>
              <input type="date" className="field" value={vencimento} onChange={e => setVencimento(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Valor (R$) *</label>
              <input className="field" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Situação</label>
            <select className="field" value={status} onChange={e => setStatus(e.target.value as StatusConta)}>
              {STATUS_ORDEM.map(s => <option key={s} value={s}>{STATUS_CONTA[s].label}</option>)}
            </select>
          </div>

          {status === 'divergente' && (
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">O que não bate? *</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {MOTIVOS_DIVERGENCIA.map(m => (
                  <button key={m} type="button" onClick={() => setMotivo(m)}
                    className={`px-2.5 py-1 rounded-lg text-xs ${motivo === m ? 'bg-red-500 text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}>
                    {m}
                  </button>
                ))}
              </div>
              <input className="field" value={motivo} onChange={e => setMotivo(e.target.value)} />
            </div>
          )}

          {status === 'pago' && (
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Data do pagamento</label>
              <input type="date" className="field" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Observação</label>
            <input className="field" value={observacao} onChange={e => setObservacao(e.target.value)} />
          </div>

          <div className="flex gap-3 pt-1">
            {conta && (
              <button onClick={excluir} aria-label="Excluir" title="Excluir" className="w-11 flex items-center justify-center border border-red-100 rounded-xl hover:bg-red-50">
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
      </div>
    </div>
  )
}
