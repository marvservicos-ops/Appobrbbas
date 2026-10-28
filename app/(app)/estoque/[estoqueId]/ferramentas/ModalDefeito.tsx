'use client'

import { useState } from 'react'
import { X, Loader2, Hammer } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { FerramentaDefeito } from '@/lib/types'
import { mensagemErro } from '@/lib/erros'
import { parseNumeroBR } from '@/lib/numero'

// Sem `defeito`: registra um novo e põe a ferramenta em manutenção.
// Com `defeito`: edita descrição/custo de um já registrado.
export default function ModalDefeito({ ferramentaId, defeito, onClose, onSaved }: {
  ferramentaId: string; defeito?: FerramentaDefeito; onClose: () => void; onSaved: () => void
}) {
  const editando = !!defeito
  const [descricao, setDescricao] = useState(defeito?.descricao ?? '')
  const [custo, setCusto] = useState(defeito?.custo != null ? String(defeito.custo).replace('.', ',') : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!descricao.trim()) { setError('Descreva o defeito.'); return }
    const custoNum = custo.trim() ? parseNumeroBR(custo) : null
    if (custoNum != null && (Number.isNaN(custoNum) || custoNum < 0)) { setError('Custo inválido.'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()

    if (editando) {
      const { error: updErr } = await supabase.from('ferramenta_defeitos').update({
        descricao: descricao.trim(),
        custo: custoNum,
      }).eq('id', defeito!.id)
      if (updErr) { setError(mensagemErro(updErr, 'Erro ao salvar defeito')); setSaving(false); return }
      setSaving(false)
      onSaved()
      return
    }

    const { error: defErr } = await supabase.from('ferramenta_defeitos').insert({
      ferramenta_id: ferramentaId,
      descricao: descricao.trim(),
      custo: custoNum,
    })
    if (defErr) { setError(mensagemErro(defErr, 'Erro ao registrar defeito')); setSaving(false); return }

    const { error: ferrErr } = await supabase.from('ferramentas').update({ status: 'em_manutencao' }).eq('id', ferramentaId)
    if (ferrErr) { setError(mensagemErro(ferrErr, 'Defeito registrado, mas a ferramenta não foi marcada em manutenção')); setSaving(false); return }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[420px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-syne font-semibold text-[#0F172A]">{editando ? 'Editar Defeito' : 'Registrar Defeito'}</h3>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -m-2 rounded-lg hover:bg-[#F1F5F9]"><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Descrição do defeito *</label>
            <input required autoFocus className="field" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Motor não liga" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Custo estimado (R$)</label>
            <input type="text" inputMode="decimal" className="field" placeholder="0,00" value={custo} onChange={e => setCusto(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Hammer size={14} />}
              {saving ? (editando ? 'Salvando…' : 'Registrando…') : (editando ? 'Salvar' : 'Registrar Defeito')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
