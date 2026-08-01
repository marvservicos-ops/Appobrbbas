'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Printer, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type EmprestimoRow = {
  id: string
  data_emprestimo: string
  data_prevista_devolucao?: string | null
  funcionario?: { nome: string } | null
  obra?: { titulo: string } | null
  itens: { id: string; data_devolucao?: string | null; ferramenta?: { nome: string } | null }[]
}

const fmtData = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

export default function ModalEmprestimos({ estoqueId, onClose }: { estoqueId: string; onClose: () => void }) {
  const [emprestimos, setEmprestimos] = useState<EmprestimoRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: itens } = await supabase
        .from('ferramenta_emprestimo_itens')
        .select('id, data_devolucao, ferramenta:ferramentas!inner(nome, estoque_id), emprestimo:ferramenta_emprestimos(id, data_emprestimo, data_prevista_devolucao, funcionario:funcionarios(nome), obra:obras(titulo))')
        .eq('ferramenta.estoque_id', estoqueId)
        .order('created_at', { ascending: false })

      const map = new Map<string, EmprestimoRow>()
      for (const it of (itens ?? []) as any[]) {
        const emp = it.emprestimo
        if (!emp) continue
        if (!map.has(emp.id)) {
          map.set(emp.id, {
            id: emp.id,
            data_emprestimo: emp.data_emprestimo,
            data_prevista_devolucao: emp.data_prevista_devolucao,
            funcionario: emp.funcionario,
            obra: emp.obra,
            itens: [],
          })
        }
        map.get(emp.id)!.itens.push({ id: it.id, data_devolucao: it.data_devolucao, ferramenta: it.ferramenta })
      }
      setEmprestimos(Array.from(map.values()).sort((a, b) => b.data_emprestimo.localeCompare(a.data_emprestimo)))
      setLoading(false)
    }
    load()
  }, [estoqueId])

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-2xl max-h-[calc(100dvh-env(safe-area-inset-top))] overflow-y-auto mt-auto sm:mt-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">Contratos de Empréstimo</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>

        <div className="p-4 md:p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-[#4F7CFF]" /></div>
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
                const aberto = emp.itens.some(i => !i.data_devolucao)
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
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${aberto ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {aberto ? 'Em aberto' : 'Devolvido'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {emp.itens.map(it => (
                        <span key={it.id} className={`text-xs px-2 py-0.5 rounded-full ${it.data_devolucao ? 'bg-[#F1F5F9] text-[#64748B]' : 'bg-[#EEF2FF] text-[#4F7CFF]'}`}>
                          {it.ferramenta?.nome ?? '—'}
                        </span>
                      ))}
                    </div>
                    <a href={`/print/emprestimo/${emp.id}`} target="_blank" rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] px-2 py-1 rounded-lg transition-colors">
                      <Printer size={13} /> Ver / Reimprimir contrato
                    </a>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
