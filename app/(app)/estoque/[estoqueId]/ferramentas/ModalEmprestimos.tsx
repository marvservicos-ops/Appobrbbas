'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Printer, FileText, Pencil, Undo2, Ban, CheckSquare, Square } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mensagemErro } from '@/lib/erros'
import ModalNovoEmprestimo from './ModalNovoEmprestimo'
import { devolverItens } from './devolucao'

type EmprestimoRow = {
  id: string
  data_emprestimo: string
  data_prevista_devolucao?: string | null
  funcionario_id: string
  obra_id?: string | null
  observacoes?: string | null
  funcionario?: { nome: string } | null
  obra?: { titulo: string } | null
  itens: { id: string; ferramenta_id: string; data_devolucao?: string | null; ferramenta?: { nome: string } | null }[]
}

const fmtData = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

export default function ModalEmprestimos({ estoqueId, onClose, onChanged }: { estoqueId: string; onClose: () => void; onChanged?: () => void }) {
  const [emprestimos, setEmprestimos] = useState<EmprestimoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [erroCarga, setErroCarga] = useState('')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [processando, setProcessando] = useState<string | null>(null)
  const [editando, setEditando] = useState<EmprestimoRow | null>(null)

  async function load() {
    const supabase = createClient()
    const { data: itens, error } = await supabase
      .from('ferramenta_emprestimo_itens')
      .select('id, ferramenta_id, data_devolucao, ferramenta:ferramentas!inner(nome, estoque_id), emprestimo:ferramenta_emprestimos(id, data_emprestimo, data_prevista_devolucao, funcionario_id, obra_id, observacoes, funcionario:funcionarios(nome), obra:obras(titulo))')
      .eq('ferramenta.estoque_id', estoqueId)
      .order('created_at', { ascending: false })
    if (error) {
      setErroCarga(mensagemErro(error, 'Erro ao carregar empréstimos'))
      setLoading(false)
      return
    }
    setErroCarga('')

    const map = new Map<string, EmprestimoRow>()
    for (const it of (itens ?? []) as any[]) {
      const emp = it.emprestimo
      if (!emp) continue
      if (!map.has(emp.id)) {
        map.set(emp.id, {
          id: emp.id,
          data_emprestimo: emp.data_emprestimo,
          data_prevista_devolucao: emp.data_prevista_devolucao,
          funcionario_id: emp.funcionario_id,
          obra_id: emp.obra_id,
          observacoes: emp.observacoes,
          funcionario: emp.funcionario,
          obra: emp.obra,
          itens: [],
        })
      }
      map.get(emp.id)!.itens.push({ id: it.id, ferramenta_id: it.ferramenta_id, data_devolucao: it.data_devolucao, ferramenta: it.ferramenta })
    }
    setEmprestimos(Array.from(map.values()).sort((a, b) => b.data_emprestimo.localeCompare(a.data_emprestimo)))
    setLoading(false)
  }

  useEffect(() => { load() }, [estoqueId])

  function toggle(itemId: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId)
      return next
    })
  }

  async function devolver(emp: EmprestimoRow, somenteSelecionados: boolean) {
    const abertos = emp.itens.filter(i => !i.data_devolucao)
    const alvo = somenteSelecionados ? abertos.filter(i => selecionados.has(i.id)) : abertos
    if (alvo.length === 0) return
    const nomes = alvo.map(i => i.ferramenta?.nome ?? '—').join(', ')
    if (!confirm(`Registrar a devolução de ${alvo.length} ${alvo.length === 1 ? 'ferramenta' : 'ferramentas'} de ${emp.funcionario?.nome ?? 'funcionário'}?\n\n${nomes}`)) return
    setProcessando(emp.id)
    const erro = await devolverItens(createClient(), alvo)
    setProcessando(null)
    if (erro) { alert(erro); return }
    setSelecionados(prev => { const next = new Set(prev); alvo.forEach(i => next.delete(i.id)); return next })
    await load()
    onChanged?.()
  }

  // Empréstimo lançado por engano: apaga o contrato e volta as ferramentas para disponível
  async function cancelar(emp: EmprestimoRow) {
    if (emp.itens.some(i => i.data_devolucao)) {
      alert('Este empréstimo já tem devoluções registradas e não pode ser cancelado. Use "Devolver todos" para encerrá-lo.')
      return
    }
    if (!confirm(`Cancelar o empréstimo de ${emp.funcionario?.nome ?? 'funcionário'} (${fmtData(emp.data_emprestimo)})?\n\nO contrato será apagado e ${emp.itens.length === 1 ? 'a ferramenta volta' : `as ${emp.itens.length} ferramentas voltam`} para disponível. Use isto só para empréstimo lançado por engano.`)) return
    setProcessando(emp.id)
    const supabase = createClient()
    const { error: delErr } = await supabase.from('ferramenta_emprestimos').delete().eq('id', emp.id)
    if (delErr) { setProcessando(null); alert(mensagemErro(delErr, 'Erro ao cancelar empréstimo')); return }
    const { error: stErr } = await supabase.from('ferramentas').update({ status: 'disponivel' })
      .in('id', emp.itens.map(i => i.ferramenta_id)).eq('status', 'emprestada')
    setProcessando(null)
    if (stErr) alert(mensagemErro(stErr, 'Empréstimo cancelado, mas o status das ferramentas não foi atualizado'))
    await load()
    onChanged?.()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-2xl max-h-[calc(100dvh-env(safe-area-inset-top))] overflow-y-auto mt-auto sm:mt-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">Contratos de Empréstimo</h2>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -m-2 rounded-lg hover:bg-[#F1F5F9]"><X size={16} className="text-[#64748B]" /></button>
        </div>

        <div className="p-4 md:p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-[#4F7CFF]" /></div>
          ) : erroCarga ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <p className="text-sm text-red-600">{erroCarga}</p>
              <button onClick={() => { setLoading(true); load() }} className="text-sm font-medium text-[#4F7CFF] hover:underline">Tentar de novo</button>
            </div>
          ) : emprestimos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center">
                <FileText size={24} className="text-[#94A3B8]" />
              </div>
              <p className="font-medium text-[#374151]">Nenhum empréstimo registrado ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {emprestimos.map(emp => {
                const abertos = emp.itens.filter(i => !i.data_devolucao)
                const aberto = abertos.length > 0
                const qtdSel = abertos.filter(i => selecionados.has(i.id)).length
                const ocupado = processando === emp.id
                return (
                  <div key={emp.id} className="border border-[#E2E8F0] rounded-xl px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#0F172A]">{emp.funcionario?.nome ?? '—'}</p>
                        <p className="text-xs text-[#64748B] mt-0.5">
                          {fmtData(emp.data_emprestimo)}
                          {emp.data_prevista_devolucao && ` · devolução prevista ${fmtData(emp.data_prevista_devolucao)}`}
                          {emp.obra?.titulo && ` · ${emp.obra.titulo}`}
                        </p>
                        {emp.observacoes && <p className="text-xs text-[#94A3B8] mt-0.5">{emp.observacoes}</p>}
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${aberto ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {aberto ? 'Em aberto' : 'Devolvido'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {emp.itens.map(it => it.data_devolucao || abertos.length < 2 ? (
                        <span key={it.id} className={`text-xs px-2 py-0.5 rounded-full ${it.data_devolucao ? 'bg-[#F1F5F9] text-[#64748B]' : 'bg-[#EEF2FF] text-[#4F7CFF]'}`}
                          title={it.data_devolucao ? `Devolvida em ${fmtData(it.data_devolucao)}` : 'Em aberto'}>
                          {it.ferramenta?.nome ?? '—'}
                        </span>
                      ) : (
                        // Em aberto com várias: toque para escolher quais devolver
                        <button key={it.id} type="button" onClick={() => toggle(it.id)} disabled={ocupado}
                          aria-pressed={selecionados.has(it.id)}
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${selecionados.has(it.id) ? 'bg-[#4F7CFF] border-[#4F7CFF] text-white' : 'bg-[#EEF2FF] border-[#C7D2FE] text-[#4F7CFF]'}`}>
                          {selecionados.has(it.id) ? <CheckSquare size={12} /> : <Square size={12} />}
                          {it.ferramenta?.nome ?? '—'}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <a href={`/print/emprestimo/${emp.id}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] px-2 py-1.5 rounded-lg transition-colors">
                        <Printer size={13} /> Ver / Reimprimir contrato
                      </a>
                      <button onClick={() => setEditando(emp)} disabled={ocupado}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:bg-[#F1F5F9] px-2 py-1.5 rounded-lg transition-colors">
                        <Pencil size={13} /> Editar
                      </button>
                      {aberto && qtdSel > 0 && (
                        <button onClick={() => devolver(emp, true)} disabled={ocupado}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 border border-amber-200 hover:bg-amber-50 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                          {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} Devolver selecionadas ({qtdSel})
                        </button>
                      )}
                      {aberto && (
                        <button onClick={() => devolver(emp, false)} disabled={ocupado}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 border border-amber-200 hover:bg-amber-50 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                          {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} {abertos.length === 1 ? 'Devolver' : `Devolver todas (${abertos.length})`}
                        </button>
                      )}
                      {emp.itens.every(i => !i.data_devolucao) && (
                        <button onClick={() => cancelar(emp)} disabled={ocupado}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors ml-auto disabled:opacity-50">
                          <Ban size={13} /> Cancelar empréstimo
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {editando && (
        <ModalNovoEmprestimo ferramentasDisponiveis={[]} emprestimo={editando}
          onClose={() => setEditando(null)}
          onCreated={() => { setEditando(null); load(); onChanged?.() }} />
      )}
    </div>
  )
}
