'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, CheckSquare, Square, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Ferramenta } from '@/lib/types'

export default function ModalNovoEmprestimo({ ferramentasDisponiveis, onClose, onCreated }: {
  ferramentasDisponiveis: Ferramenta[]; onClose: () => void; onCreated: () => void
}) {
  const [funcionarios, setFuncionarios] = useState<{ id: string; nome: string }[]>([])
  const [obras, setObras] = useState<{ id: string; titulo: string }[]>([])
  const [funcionarioId, setFuncionarioId] = useState('')
  const [obraId, setObraId] = useState('')
  const [dataPrevista, setDataPrevista] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: fs }, { data: obs }] = await Promise.all([
        supabase.from('funcionarios').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('obras').select('id, titulo, status').in('status', ['Em Andamento', 'Aprovada', 'Em Orçamento']).order('titulo'),
      ])
      setFuncionarios(fs ?? [])
      setObras(obs ?? [])
    }
    load()
  }, [])

  function toggle(id: string) {
    setSelecionadas(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!funcionarioId) { setError('Selecione o funcionário responsável.'); return }
    if (selecionadas.size === 0) { setError('Selecione ao menos uma ferramenta.'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { data: emprestimo, error: empErr } = await supabase.from('ferramenta_emprestimos').insert({
      funcionario_id: funcionarioId,
      obra_id: obraId || null,
      data_prevista_devolucao: dataPrevista || null,
      observacoes: observacoes.trim() || null,
    }).select().single()

    if (empErr || !emprestimo) { setError(empErr?.message ?? 'Erro ao criar empréstimo.'); setLoading(false); return }

    const ids = Array.from(selecionadas)
    const { error: itensErr } = await supabase.from('ferramenta_emprestimo_itens').insert(
      ids.map(ferramenta_id => ({ emprestimo_id: emprestimo.id, ferramenta_id }))
    )
    if (itensErr) { setError(itensErr.message); setLoading(false); return }

    await supabase.from('ferramentas').update({ status: 'emprestada' }).in('id', ids)

    setLoading(false)
    window.open(`/print/emprestimo/${emprestimo.id}`, '_blank')
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[calc(100dvh-env(safe-area-inset-top))] overflow-y-auto mt-auto sm:mt-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">Novo Empréstimo</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Funcionário responsável *</label>
            <select required className="field" value={funcionarioId} onChange={e => setFuncionarioId(e.target.value)}>
              <option value="">Selecione...</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Obra (opcional)</label>
              <select className="field" value={obraId} onChange={e => setObraId(e.target.value)}>
                <option value="">Nenhuma</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Devolução prevista</label>
              <input type="date" className="field" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Observações</label>
            <input className="field" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">
              Ferramentas * <span className="text-[#94A3B8] font-normal">({selecionadas.size} selecionada{selecionadas.size !== 1 ? 's' : ''})</span>
            </label>
            <div className="border border-[#E2E8F0] rounded-xl divide-y divide-[#F1F5F9] max-h-56 overflow-y-auto">
              {ferramentasDisponiveis.length === 0 ? (
                <p className="text-sm text-[#94A3B8] px-3 py-4 text-center">Nenhuma ferramenta disponível.</p>
              ) : ferramentasDisponiveis.map(f => {
                const sel = selecionadas.has(f.id)
                return (
                  <button type="button" key={f.id} onClick={() => toggle(f.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${sel ? 'bg-[#F5F7FF]' : 'hover:bg-[#F8FAFC]'}`}>
                    {sel ? <CheckSquare size={16} className="text-[#4F7CFF] shrink-0" /> : <Square size={16} className="text-[#94A3B8] shrink-0" />}
                    {f.foto_url
                      ? <img src={f.foto_url} alt="" className="w-8 h-8 rounded-lg object-cover border border-[#E2E8F0]" />
                      : <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-[#94A3B8]"><Wrench size={14} /></div>}
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">{f.nome}</p>
                      {(f.marca || f.modelo) && <p className="text-xs text-[#64748B]">{[f.marca, f.modelo].filter(Boolean).join(' · ')}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <p className="text-xs text-[#94A3B8]">Ao salvar, o contrato de empréstimo será aberto em nova aba para impressão e assinatura física.</p>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : 'Criar Empréstimo'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
