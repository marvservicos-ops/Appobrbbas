'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { X, CheckSquare, Square, Wrench, Search, Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Ferramenta } from '@/lib/types'
import { mensagemErro } from '@/lib/erros'
import { abrirAbaVazia } from './devolucao'

// Dados de um empréstimo já criado, para o modo edição (não mexe nas ferramentas)
export type EmprestimoEditavel = {
  id: string
  funcionario_id: string
  funcionario?: { nome: string } | null
  obra_id?: string | null
  obra?: { titulo: string } | null
  data_prevista_devolucao?: string | null
  observacoes?: string | null
}

export default function ModalNovoEmprestimo({ ferramentasDisponiveis, emprestimo, onClose, onCreated }: {
  ferramentasDisponiveis: Ferramenta[]; emprestimo?: EmprestimoEditavel; onClose: () => void; onCreated: () => void
}) {
  const editando = !!emprestimo
  const [funcionarios, setFuncionarios] = useState<{ id: string; nome: string }[]>([])
  const [obras, setObras] = useState<{ id: string; titulo: string }[]>([])
  const [funcionarioId, setFuncionarioId] = useState(emprestimo?.funcionario_id ?? '')
  const [obraId, setObraId] = useState(emprestimo?.obra_id ?? '')
  const [dataPrevista, setDataPrevista] = useState(emprestimo?.data_prevista_devolucao ?? '')
  const [observacoes, setObservacoes] = useState(emprestimo?.observacoes ?? '')
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Contrato criado mas a aba foi bloqueada pelo navegador: mostra o link
  const [contratoUrl, setContratoUrl] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: fs }, { data: obs }] = await Promise.all([
        supabase.from('funcionarios').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('obras').select('id, titulo, status').in('status', ['Em Andamento', 'Aprovada', 'Em Orçamento']).order('titulo'),
      ])
      const listaF = fs ?? []
      const listaO = obs ?? []
      // Na edição, mantém selecionáveis o funcionário/obra atuais mesmo se inativos/encerrados
      if (emprestimo?.funcionario_id && !listaF.some(f => f.id === emprestimo.funcionario_id)) {
        listaF.unshift({ id: emprestimo.funcionario_id, nome: emprestimo.funcionario?.nome ?? 'Funcionário atual' })
      }
      if (emprestimo?.obra_id && !listaO.some(o => o.id === emprestimo.obra_id)) {
        listaO.unshift({ id: emprestimo.obra_id, titulo: emprestimo.obra?.titulo ?? 'Obra atual', status: '' })
      }
      setFuncionarios(listaF)
      setObras(listaO)
    }
    load()
  }, [emprestimo])

  const ferramentasFiltradas = ferramentasDisponiveis.filter(f => {
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return f.nome.toLowerCase().includes(q) || (f.codigo_interno ?? '').toLowerCase().includes(q)
  })

  function toggle(id: string) {
    setSelecionadas(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (!funcionarioId) { setError('Selecione o funcionário responsável.'); return }
    const supabase = createClient()

    if (editando) {
      setLoading(true)
      setError('')
      const { error: updErr } = await supabase.from('ferramenta_emprestimos').update({
        funcionario_id: funcionarioId,
        obra_id: obraId || null,
        data_prevista_devolucao: dataPrevista || null,
        observacoes: observacoes.trim() || null,
      }).eq('id', emprestimo!.id)
      setLoading(false)
      if (updErr) { setError(mensagemErro(updErr, 'Erro ao salvar empréstimo')); return }
      onCreated()
      return
    }

    if (selecionadas.size === 0) { setError('Selecione ao menos uma ferramenta.'); return }
    // Abre a aba do contrato ainda no clique (no iPhone, window.open depois de await é bloqueado)
    const aba = abrirAbaVazia()
    setLoading(true)
    setError('')
    const ids = Array.from(selecionadas)
    const falhar = (msg: string) => { try { aba?.close() } catch {}; setError(msg); setLoading(false) }

    // 1) Reserva as ferramentas: só muda quem ainda está disponível. Se outra pessoa
    //    emprestou alguma nesse meio-tempo, ela não volta no select.
    const { data: reservadas, error: resErr } = await supabase.from('ferramentas')
      .update({ status: 'emprestada' }).in('id', ids).eq('status', 'disponivel').select('id')
    if (resErr) { falhar(mensagemErro(resErr, 'Erro ao criar empréstimo')); return }
    const idsReservados = (reservadas ?? []).map(r => r.id as string)
    const liberar = async () => {
      if (idsReservados.length === 0) return
      const { error: libErr } = await supabase.from('ferramentas').update({ status: 'disponivel' }).in('id', idsReservados).eq('status', 'emprestada')
      if (libErr) console.error('Erro ao liberar ferramentas reservadas', libErr)
    }
    if (idsReservados.length < ids.length) {
      await liberar()
      const indisponiveis = ferramentasDisponiveis.filter(f => ids.includes(f.id) && !idsReservados.includes(f.id))
        .map(f => f.codigo_interno ? `${f.nome} (${f.codigo_interno})` : f.nome)
      falhar(`Empréstimo não criado: ${indisponiveis.join(', ') || 'algumas ferramentas'} já não ${indisponiveis.length === 1 ? 'está disponível' : 'estão disponíveis'} (emprestada ou alterada por outra pessoa). Feche e abra de novo para atualizar a lista.`)
      return
    }

    // 2) Cabeçalho do contrato
    const { data: novo, error: empErr } = await supabase.from('ferramenta_emprestimos').insert({
      funcionario_id: funcionarioId,
      obra_id: obraId || null,
      data_prevista_devolucao: dataPrevista || null,
      observacoes: observacoes.trim() || null,
    }).select().single()
    if (empErr || !novo) { await liberar(); falhar(mensagemErro(empErr, 'Erro ao criar empréstimo')); return }

    // 3) Itens; se falhar, desfaz o cabeçalho e a reserva
    const { error: itensErr } = await supabase.from('ferramenta_emprestimo_itens').insert(
      ids.map(ferramenta_id => ({ emprestimo_id: novo.id, ferramenta_id }))
    )
    if (itensErr) {
      const { error: delErr } = await supabase.from('ferramenta_emprestimos').delete().eq('id', novo.id)
      if (delErr) console.error('Erro ao apagar empréstimo incompleto', delErr)
      await liberar()
      falhar(mensagemErro(itensErr, 'Erro ao criar empréstimo'))
      return
    }

    setLoading(false)
    const url = `/print/emprestimo/${novo.id}`
    if (aba && !aba.closed) {
      aba.location.href = url
      onCreated()
    } else {
      setContratoUrl(url)
    }
  }

  if (contratoUrl) return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center space-y-4">
        <h2 className="font-syne font-semibold text-[#0F172A]">Empréstimo criado</h2>
        <p className="text-sm text-[#64748B]">O navegador bloqueou a nova aba. Abra o contrato para imprimir e assinar.</p>
        <a href={contratoUrl} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex items-center justify-center gap-1.5 w-full">
          <Printer size={14} /> Abrir contrato
        </a>
        <button onClick={onCreated} className="text-sm text-[#64748B] hover:text-[#0F172A]">Concluir</button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[calc(100dvh-env(safe-area-inset-top))] overflow-y-auto mt-auto sm:mt-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">{editando ? 'Editar Empréstimo' : 'Novo Empréstimo'}</h2>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -m-2 rounded-lg hover:bg-[#F1F5F9]"><X size={16} className="text-[#64748B]" /></button>
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
          {!editando && (
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">
              Ferramentas * <span className="text-[#94A3B8] font-normal">({selecionadas.size} selecionada{selecionadas.size !== 1 ? 's' : ''})</span>
            </label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input className="field pl-8 text-sm" placeholder="Buscar por nome ou código..."
                value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <div className="border border-[#E2E8F0] rounded-xl divide-y divide-[#F1F5F9] max-h-56 overflow-y-auto">
              {ferramentasDisponiveis.length === 0 ? (
                <p className="text-sm text-[#94A3B8] px-3 py-4 text-center">Nenhuma ferramenta disponível.</p>
              ) : ferramentasFiltradas.length === 0 ? (
                <p className="text-sm text-[#94A3B8] px-3 py-4 text-center">Nenhuma ferramenta encontrada para &quot;{busca}&quot;.</p>
              ) : ferramentasFiltradas.map(f => {
                const sel = selecionadas.has(f.id)
                return (
                  <button type="button" key={f.id} onClick={() => toggle(f.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${sel ? 'bg-[#F5F7FF]' : 'hover:bg-[#F8FAFC]'}`}>
                    {sel ? <CheckSquare size={16} className="text-[#4F7CFF] shrink-0" /> : <Square size={16} className="text-[#94A3B8] shrink-0" />}
                    {f.foto_url
                      ? <Image src={f.foto_url} alt="" width={32} height={32} className="w-8 h-8 rounded-lg object-cover border border-[#E2E8F0]" />
                      : <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-[#94A3B8]"><Wrench size={14} /></div>}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-[#0F172A]">{f.nome}</p>
                        {f.codigo_interno && <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">{f.codigo_interno}</span>}
                      </div>
                      {(f.marca || f.modelo) && <p className="text-xs text-[#64748B]">{[f.marca, f.modelo].filter(Boolean).join(' · ')}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          {!editando && <p className="text-xs text-[#94A3B8]">Ao salvar, o contrato de empréstimo será aberto em nova aba para impressão e assinatura física.</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando…' : editando ? 'Salvar' : 'Criar Empréstimo'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
