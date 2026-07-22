'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import { Plus, Pencil, X, Loader2, Users, DollarSign, CheckCircle2, XCircle, Clock, Calculator } from 'lucide-react'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const fmt2 = (v: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

interface Funcionario {
  id: string
  nome: string
  cargo: string | null
  salario_bruto: number | null
  horas_dia: number | null
  dias_mes: number | null
  custo_diario: number | null
  ativo: boolean
  created_at: string
}

interface RegraExtra {
  chave: string
  descricao: string
  valor: { percentual: number }
}

function calculos(f: Pick<Funcionario, 'salario_bruto' | 'horas_dia' | 'dias_mes'>) {
  const salario = f.salario_bruto ?? 0
  const dias = f.dias_mes ?? 30
  const horasMes = f.horas_dia ?? 220  // horas_dia stores total monthly hours
  const custoDia = dias > 0 ? salario / dias : 0
  const custoHora = horasMes > 0 ? salario / horasMes : 0
  return { custoDia, custoHora }
}

function ModalFuncionario({ funcionario, regras, onClose, onSaved }: {
  funcionario: Funcionario | null
  regras: RegraExtra[]
  onClose: () => void
  onSaved: () => void
}) {
  const [nome, setNome] = useState(funcionario?.nome ?? '')
  const [cargo, setCargo] = useState(funcionario?.cargo ?? '')
  const [salarioBruto, setSalarioBruto] = useState(funcionario?.salario_bruto ? String(funcionario.salario_bruto) : '')
  // CLT: mês comercial 30 dias, 220 horas/mês para 44h semanais
  const [diasMes, setDiasMes] = useState(funcionario?.dias_mes ? String(funcionario.dias_mes) : '30')
  const [horasMes, setHorasMes] = useState(funcionario?.horas_dia ? String(funcionario.horas_dia) : '220')
  const [ativo, setAtivo] = useState(funcionario?.ativo ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const salNum = parseFloat(salarioBruto) || 0
  const diasNum = parseFloat(diasMes) || 30
  const horasNum = parseFloat(horasMes) || 220
  // Custo/dia = salário ÷ 30 (mês comercial CLT)
  const custoDia = diasNum > 0 ? salNum / diasNum : 0
  // Custo/hora = salário ÷ 220 (horas mensais CLT 44h/sem)
  const custoHora = horasNum > 0 ? salNum / horasNum : 0

  async function salvar() {
    if (!nome.trim()) return
    setSaving(true)
    setError('')
    const supabase = createClient()
    const payload = {
      nome: nome.trim(),
      cargo: cargo.trim() || null,
      salario_bruto: parseFloat(salarioBruto) || null,
      horas_dia: horasNum,   // armazenamos total horas/mês neste campo
      dias_mes: diasNum,
      custo_diario: custoDia || null,
      ativo,
    }
    const { error: err } = funcionario
      ? await supabase.from('funcionarios').update(payload).eq('id', funcionario.id)
      : await supabase.from('funcionarios').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
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

          <div className="border-t border-[#E2E8F0] pt-4">
            <p className="text-xs font-semibold text-[#374151] mb-3 flex items-center gap-1.5"><DollarSign size={13} /> Remuneração</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Salário Mensal Bruto (R$)</label>
                <input className="field" type="number" min="0" step="0.01" value={salarioBruto}
                  onChange={e => setSalarioBruto(e.target.value)} placeholder="0,00" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">Dias/mês <span className="text-[#94A3B8] font-normal">(CLT = 30)</span></label>
                  <input className="field" type="number" min="1" max="31" step="1" value={diasMes}
                    onChange={e => setDiasMes(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">Horas/mês <span className="text-[#94A3B8] font-normal">(CLT 44h = 220)</span></label>
                  <input className="field" type="number" min="1" max="400" step="1" value={horasMes}
                    onChange={e => setHorasMes(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Preview de cálculos */}
          {salNum > 0 && (
            <div className="bg-[#F0F4FF] border border-[#C7D2FE] rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-[#4F7CFF] flex items-center gap-1.5"><Calculator size={12} /> Custo calculado</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[#64748B]">Por dia</p>
                  <p className="font-syne font-bold text-[#0F172A]">{moeda(custoDia)}</p>
                  <p className="text-xs text-[#94A3B8]">{moeda(salNum)} ÷ {diasNum} dias</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B]">Por hora</p>
                  <p className="font-syne font-bold text-[#0F172A]">{moeda(custoHora)}</p>
                  <p className="text-xs text-[#94A3B8]">{moeda(salNum)} ÷ {horasNum}h</p>
                </div>
              </div>

              {regras.length > 0 && (
                <div className="border-t border-[#C7D2FE] pt-3 mt-2">
                  <p className="text-xs text-[#64748B] mb-2">Hora com adicional:</p>
                  <div className="space-y-1">
                    {regras.map(r => (
                      <div key={r.chave} className="flex justify-between text-xs">
                        <span className="text-[#374151]">{r.descricao} (+{r.valor.percentual}%)</span>
                        <span className="font-semibold text-[#0F172A]">{moeda(custoHora * (1 + r.valor.percentual / 100))}/h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {funcionario && (
            <div className="flex items-center gap-3 pt-1">
              <button type="button" onClick={() => setAtivo(a => !a)}
                className={`w-10 h-6 rounded-full transition-colors relative ${ativo ? 'bg-[#4F7CFF]' : 'bg-[#CBD5E1]'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${ativo ? 'left-4' : 'left-0.5'}`} />
              </button>
              <span className="text-sm text-[#374151]">{ativo ? 'Ativo' : 'Inativo'}</span>
            </div>
          )}

          {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

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
  const [regras, setRegras] = useState<RegraExtra[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Funcionario | null>(null)
  const [filtro, setFiltro] = useState<'ativos' | 'inativos' | 'todos'>('ativos')

  async function load() {
    const supabase = createClient()
    const [{ data: funcs }, { data: cfg }] = await Promise.all([
      supabase.from('funcionarios').select('*').order('nome'),
      supabase.from('configuracoes_empresa').select('chave, descricao, valor').like('chave', 'adicional_%'),
    ])
    if (funcs) setFuncionarios(funcs as Funcionario[])
    if (cfg) setRegras(cfg as RegraExtra[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const lista = funcionarios.filter(f =>
    filtro === 'todos' ? true : filtro === 'ativos' ? f.ativo : !f.ativo
  )
  const ativos = funcionarios.filter(f => f.ativo)
  const folhaMensal = ativos.reduce((s, f) => s + (f.salario_bruto ?? 0), 0)

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
              <p className="text-xs text-[#64748B] font-medium">Folha Mensal Bruta</p>
            </div>
            <p className="font-syne font-bold text-xl text-[#0F172A]">{moeda(folhaMensal)}</p>
          </div>
          <div className="card p-4 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-[#64748B]" />
              <p className="text-xs text-[#64748B] font-medium">Custo/Dia Médio</p>
            </div>
            <p className="font-syne font-bold text-2xl text-[#0F172A]">
              {ativos.length > 0 ? moeda(ativos.reduce((s, f) => s + calculos(f).custoDia, 0) / ativos.length) : '—'}
            </p>
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
              className="btn-primary mt-4 text-sm flex items-center gap-2"><Plus size={14} /> Adicionar</button>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Nome</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden sm:table-cell">Cargo</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Salário Bruto</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden md:table-cell">Custo/Dia</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden lg:table-cell">Custo/Hora</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {lista.map(f => {
                  const { custoDia, custoHora } = calculos(f)
                  return (
                    <tr key={f.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors group">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-[#0F172A]">{f.nome}</p>
                        <p className="text-xs text-[#94A3B8] sm:hidden">{f.cargo ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#64748B] hidden sm:table-cell">{f.cargo ?? '—'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-[#374151]">
                        {f.salario_bruto ? moeda(f.salario_bruto) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#374151] hidden md:table-cell">
                        {custoDia > 0 ? moeda(custoDia) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#374151] hidden lg:table-cell">
                        {custoHora > 0 ? moeda(custoHora) : '—'}
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
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ModalFuncionario
          funcionario={editando}
          regras={regras}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
