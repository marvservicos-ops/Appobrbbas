'use client'

import { useState } from 'react'
import { X, Loader2, Hammer } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ModalDefeito({ ferramentaId, onClose, onSaved }: {
  ferramentaId: string; onClose: () => void; onSaved: () => void
}) {
  const [descricao, setDescricao] = useState('')
  const [custo, setCusto] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!descricao.trim()) { setError('Descreva o defeito.'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()

    const { error: defErr } = await supabase.from('ferramenta_defeitos').insert({
      ferramenta_id: ferramentaId,
      descricao: descricao.trim(),
      custo: custo ? parseFloat(custo) : null,
    })
    if (defErr) { setError(defErr.message); setSaving(false); return }

    const { error: ferrErr } = await supabase.from('ferramentas').update({ status: 'em_manutencao' }).eq('id', ferramentaId)
    if (ferrErr) { setError(ferrErr.message); setSaving(false); return }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[420px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-syne font-semibold text-[#0F172A]">Registrar Defeito</h3>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Descrição do defeito *</label>
            <input required autoFocus className="field" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Motor não liga" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Custo estimado (R$)</label>
            <input type="number" step="0.01" min="0" className="field" placeholder="0,00" value={custo} onChange={e => setCusto(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Hammer size={14} />}
              {saving ? 'Registrando...' : 'Registrar Defeito'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
