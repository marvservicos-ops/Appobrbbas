'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ModalAtribuirMala({ ferramentaId, responsavelAtualId, onClose, onSaved }: {
  ferramentaId: string; responsavelAtualId?: string | null; onClose: () => void; onSaved: () => void
}) {
  const [funcionarios, setFuncionarios] = useState<{ id: string; nome: string }[]>([])
  const [funcionarioId, setFuncionarioId] = useState(responsavelAtualId ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('funcionarios').select('id, nome').eq('ativo', true).order('nome')
      setFuncionarios(data ?? [])
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('ferramentas').update({
      responsavel_atual_id: funcionarioId || null,
    }).eq('id', ferramentaId)
    if (err) { setError(err.message); setLoading(false); return }
    setLoading(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[420px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-syne font-semibold text-[#0F172A]">Responsável pela Mala</h3>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Funcionário responsável</label>
            <select className="field" value={funcionarioId} onChange={e => setFuncionarioId(e.target.value)}>
              <option value="">Sem responsável</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <p className="text-xs text-[#94A3B8] mt-1">A mala fica sob posse deste funcionário até ser reatribuída. Não gera contrato de empréstimo.</p>
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary text-sm">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
