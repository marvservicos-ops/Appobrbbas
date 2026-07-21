'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import { Plus, Pencil, X, Loader2, Users, DollarSign, CheckCircle2, XCircle } from 'lucide-react'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

interface Funcionario {
  id: string
  nome: string
  cargo: string | null
  custo_diario: number | null
  ativo: boolean
  created_at: string
}

function ModalFuncionario({ funcionario, onClose, onSaved }: {
  funcionario: Funcionario | null
  onClose: () => void
  onSaved: () => void
}) {
  const [nome, setNome] = useState(funcionario?.nome ?? '')
  const [cargo, setCargo] = useState(funcionario?.cargo ?? '')
  const [custoDiario, setCustoDiario] = useState(funcionario?.custo_diario ? String(funcionario.custo_diario) : '')
  const [ativo, setAtivo] = useState(funcionario?.ativo ?? true)
  const [saving, setSaving] = useState(false)

  async function salvar() {
    if (!nome.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      nome: nome.trim(),
      cargo: cargo.trim() || null,
      custo_diario: parseFloat(custoDiario) || null,
      ativo,
    }
    if (funcionario) {
      await supabase.from('funcionarios').update(payload).eq('id', funcionario.id)
    } else {
      await supabase.from('funcionarios').insert(payload)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">{funcionario ? 'Editar Funcionário' : 'Novo Funcionário'}</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Nome *</label>
            <input className="field" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Cargo</label>
            <input className="field" value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex: Técnico HVAC, Auxiliar..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Custo por dia (R$)</label>
            <input className="field" type="number" min="0" step="0.01" value={custoDiario}
              onChange={e => setCustoDiario(e.target.value)} placeholder="0,00" />
          </div>
          {funcionario && (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setAtivo(a => !a)}
                className={`w-10 h-6 rounded-full transition-colors relative ${ativo ? 'bg-[#4F7CFF]' : 'bg-[#CBD5E1]'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${ativo ? 'left-4' : 'left-0.5'}`} />
              </button>
              <span className="text-sm text-[#374151]">{ativo ? 'Ativo' : 'Inativo'}</span>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-colors">
              Cancelar
            </button>
            <button onClick={salvar} disabled={saving || !nome.trim()}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FuncionariosPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Funcionario | null>(null)
  const [filtro, setFiltro] = useState<'todos' | 'ativos' | 'inativos'>('ativos')

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('funcionarios').select('*').order('nome')
    if (data) setFuncionarios(data as Funcionario[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const lista = funcionarios.filter(f =>
    filtro === 'todos' ? true : filtro === 'ativos' ? f.ativo : !f.ativo
  )
  const ativos = funcionarios.filter(f => f.ativo)
  const custoMensal = ativos.reduce((s, f) => s + (f.custo_diario ?? 0) * 22, 0)

  return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="p-4 md:p-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-syne text-xl md:text-2xl font-bold text-[#0F172A]">Funcionários</h1>
            <p className="text-xs md:text-sm text-[#64748B] mt-0.5">Cadastro de equipe e custo de mão de obra</p>
          </div>
          <button onClick={() => { setEditando(null); setShowModal(true) }}
            className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Novo
          </button>
        </div>

        {/* Cards resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="card p-4 border-l-4 border-l-[#4F7CFF]">
            <div className="flex items-center gap-2 mb-1">
              <Users size={14} className="text-[#4F7CFF]" />
              <p className="text-xs text-[#64748B] font-medium">Funcionários Ativos</p>
            </div>
            <p className="font-syne font-bold text-2xl text-[#0F172A]">{ativos.length}</p>
          </div>
          <div className="card p-4 border-l-4 border-l-emerald-400">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={14} className="text-emerald-500" />
              <p className="text-xs text-[#64748B] font-medium">Custo/Mês Estimado</p>
            </div>
            <p className="font-syne font-bold text-xl text-[#0F172A]">{moeda(custoMensal)}</p>
            <p className="text-xs text-[#94A3B8] mt-0.5">base 22 dias úteis</p>
          </div>
          <div className="card p-4 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={14} className="text-[#64748B]" />
              <p className="text-xs text-[#64748B] font-medium">Custo/Dia Total</p>
            </div>
            <p className="font-syne font-bold text-2xl text-[#0F172A]">{moeda(ativos.reduce((s, f) => s + (f.custo_diario ?? 0), 0))}</p>
          </div>
        </div>

        {/* Filtro */}
        <div className="flex gap-2 mb-4">
          {(['ativos', 'inativos', 'todos'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtro === f ? 'bg-[#4F7CFF] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}>
              {f === 'ativos' ? 'Ativos' : f === 'inativos' ? 'Inativos' : 'Todos'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-[#4F7CFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : lista.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 text-center">
            <Users size={32} className="text-[#CBD5E1] mb-3" />
            <p className="text-sm font-medium text-[#374151]">Nenhum funcionário cadastrado</p>
            <button onClick={() => { setEditando(null); setShowModal(true) }}
              className="btn-primary mt-4 text-sm"><Plus size={14} /> Adicionar</button>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Nome</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden sm:table-cell">Cargo</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Custo/Dia</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {lista.map(f => (
                  <tr key={f.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors group">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-[#0F172A]">{f.nome}</p>
                      <p className="text-xs text-[#94A3B8] sm:hidden">{f.cargo ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#64748B] hidden sm:table-cell">{f.cargo ?? '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[#374151]">
                      {f.custo_diario ? moeda(f.custo_diario) : '—'}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${f.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F1F5F9] text-[#94A3B8]'}`}>
                        {f.ativo ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                        {f.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setEditando(f); setShowModal(true) }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#4F7CFF]">
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ModalFuncionario
          funcionario={editando}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
