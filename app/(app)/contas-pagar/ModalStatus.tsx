'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mensagemErro } from '@/lib/erros'
import { hojeLocal } from '@/lib/datas'
import { MOTIVOS_DIVERGENCIA, type Conta } from '@/lib/contasPagar'

// Marcar como Divergente (pede o motivo) ou Pago (pede a data)
export default function ModalStatus({ conta, para, onClose, onSaved }: {
  conta: Conta
  para: 'divergente' | 'pago'
  onClose: () => void
  onSaved: () => void
}) {
  const [motivo, setMotivo] = useState(conta.motivo_divergencia ?? '')
  const [dataPagamento, setDataPagamento] = useState(conta.data_pagamento ?? hojeLocal())
  const [saving, setSaving] = useState(false)

  async function salvar() {
    if (para === 'divergente' && !motivo.trim()) return
    setSaving(true)
    const payload = para === 'divergente'
      ? { status: 'divergente', motivo_divergencia: motivo.trim() }
      : { status: 'pago', data_pagamento: dataPagamento || hojeLocal() }
    const { error } = await createClient().from('contas_pagar').update(payload).eq('id', conta.id)
    setSaving(false)
    if (error) { alert(mensagemErro(error, 'Erro ao atualizar a conta')); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">{para === 'divergente' ? 'Marcar como divergente' : 'Marcar como pago'}</h2>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -mr-2"><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-4">
          {para === 'divergente' ? (
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
              <textarea className="field min-h-[80px]" value={motivo} onChange={e => setMotivo(e.target.value)}
                placeholder="Ex: DDA mostra R$ 1.250,00 e a nota R$ 1.205,00" autoFocus />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Data do pagamento</label>
              <input type="date" className="field" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} />
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9]">Cancelar</button>
            <button onClick={salvar} disabled={saving || (para === 'divergente' && !motivo.trim())}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {saving ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
