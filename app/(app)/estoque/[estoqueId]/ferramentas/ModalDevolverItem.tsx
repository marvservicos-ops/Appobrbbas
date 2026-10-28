'use client'

import { useState } from 'react'
import { X, Loader2, Undo2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { FerramentaEmprestimoItem } from '@/lib/types'
import { devolverItens } from './devolucao'

export default function ModalDevolverItem({ item, onClose, onSaved }: {
  item: FerramentaEmprestimoItem; onClose: () => void; onSaved: () => void
}) {
  const [observacoes, setObservacoes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const erro = await devolverItens(createClient(), [{ id: item.id, ferramenta_id: item.ferramenta_id }], observacoes)
    if (erro) { setError(erro); setSaving(false); return }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[420px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-syne font-semibold text-[#0F172A]">Registrar Devolução</h3>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -m-2 rounded-lg hover:bg-[#F1F5F9]"><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Observações</label>
            <input className="field" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" />
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
              {saving ? 'Registrando…' : 'Confirmar Devolução'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
