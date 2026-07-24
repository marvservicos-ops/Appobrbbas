'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import { ArrowLeft, Pencil, X, Loader2, CheckCircle2, XCircle, DollarSign, Clock, Package, Shield, Shirt, Calendar, User, Hash } from 'lucide-react'
import { useAccess } from '@/lib/useAccess'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

interface Funcionario {
  id: string
  nome: string
  cargo: string | null
  salario_bruto: number | null
  horas_dia: number | null
  dias_mes: number | null
  custo_diario: number | null
  ativo: boolean
}

interface RegistroItem {
  id: string
  data: string
  produto_nome: string
  quantidade: number
  unidade: string
  responsavel: string
  observacoes: string | null
  estoque_nome: string
  estoque_icone: string
  estoque_cor: string
  ca_valor: string | null
}

const ICONE_LABEL: Record<string, string> = {
  shield: 'EPI',
  shirt: 'Uniforme',
  sparkles: 'Limpeza',
  thermometer: 'Refrigeração',
  droplets: 'Hidráulica',
}

export default function CentralFuncionarioPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { isAdmin, loading: accessLoading } = useAccess()
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null)
  const [registros, setRegistros] = useState<RegistroItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstoque, setFiltroEstoque] = useState('')
  const [showEdit, setShowEdit] = useState(false)

  useEffect(() => {
    if (!accessLoading && !isAdmin) router.replace('/obras')
  }, [isAdmin, accessLoading, router])

  async function load() {
    const supabase = createClient()
    const [{ data: func }, { data: regs }] = await Promise.all([
      supabase.from('funcionarios').select('*').eq('id', id).single(),
      supabase.from('estoque_registros')
        .select(`
          id, data, produto_nome, quantidade, unidade, responsavel, observacoes,
          estoque:estoque_id(nome, icone, cor),
          valores:estoque_registro_valores(valor, campo:campo_id(nome))
        `)
        .eq('funcionario_id', id)
        .eq('tipo', 'saida')
        .order('data', { ascending: false }),
    ])

    setFuncionario(func)

    const items: RegistroItem[] = (regs ?? []).map((r: any) => {
      const caValor = r.valores?.find((v: any) => {
        const n = (v.campo?.nome ?? '').toLowerCase().replace(/\s/g, '')
        return n === 'ca' || n === 'nºca' || n === 'noca' || n.includes('nºca')
      })?.valor ?? null
      return {
        id: r.id,
        data: r.data,
        produto_nome: r.produto_nome,
        quantidade: r.quantidade,
        unidade: r.unidade,
        responsavel: r.responsavel,
        observacoes: r.observacoes,
        estoque_nome: r.estoque?.nome ?? '—',
        estoque_icone: r.estoque?.icone ?? '',
        estoque_cor: r.estoque?.cor ?? '#94A3B8',
        ca_valor: caValor,
      }
    })
    setRegistros(items)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const custoDia = funcionario?.salario_bruto && funcionario?.dias_mes
    ? funcionario.salario_bruto / funcionario.dias_mes : 0
  const custoHora = funcionario?.salario_bruto && funcionario?.horas_dia
    ? funcionario.salario_bruto / funcionario.horas_dia : 0

  const estoques = Array.from(new Set(registros.map(r => r.estoque_nome)))
  const listaFiltrada = filtroEstoque ? registros.filter(r => r.estoque_nome === filtroEstoque) : registros

  if (loading) return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="flex items-center justify-center flex-1">
        <Loader2 size={28} className="animate-spin text-[#4F7CFF]" />
      </div>
    </div>
  )

  if (!funcionario) return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="flex items-center justify-center flex-1">
        <p className="text-[#64748B]">Funcionário não encontrado.</p>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="p-4 md:p-6 flex-1 overflow-y-auto max-w-3xl w-full mx-auto">

        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <button onClick={() => router.push('/funcionarios')}
            className="w-9 h-9 rounded-xl border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors shrink-0 mt-0.5">
            <ArrowLeft size={16} className="text-[#64748B]" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-syne font-bold text-xl text-[#0F172A]">{funcionario.nome}</h1>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${funcionario.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F1F5F9] text-[#94A3B8]'}`}>
                {funcionario.ativo ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                {funcionario.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            {funcionario.cargo && <p className="text-sm text-[#64748B] mt-0.5">{funcionario.cargo}</p>}
          </div>
          <button onClick={() => setShowEdit(true)}
            className="w-9 h-9 rounded-xl border border-[#E2E8F0] flex items-center justify-center hover:bg-[#EEF2FF] hover:border-[#4F7CFF] hover:text-[#4F7CFF] transition-colors text-[#64748B] shrink-0 mt-0.5">
            <Pencil size={14} />
          </button>
        </div>

        {/* Cards de custo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign size={12} className="text-[#4F7CFF]" />
              <p className="text-xs text-[#64748B]">Salário Bruto</p>
            </div>
            <p className="font-syne font-bold text-[#0F172A]">{funcionario.salario_bruto ? moeda(funcionario.salario_bruto) : '—'}</p>
          </div>
          <div className="card p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={12} className="text-[#64748B]" />
              <p className="text-xs text-[#64748B]">Custo/Dia</p>
            </div>
            <p className="font-syne font-bold text-[#0F172A]">{custoDia > 0 ? moeda(custoDia) : '—'}</p>
          </div>
          <div className="card p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={12} className="text-[#64748B]" />
              <p className="text-xs text-[#64748B]">Custo/Hora</p>
            </div>
            <p className="font-syne font-bold text-[#0F172A]">{custoHora > 0 ? moeda(custoHora) : '—'}</p>
          </div>
          <div className="card p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Package size={12} className="text-[#64748B]" />
              <p className="text-xs text-[#64748B]">Itens Recebidos</p>
            </div>
            <p className="font-syne font-bold text-[#0F172A]">{registros.length}</p>
          </div>
        </div>

        {/* Histórico de itens */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-syne font-semibold text-[#0F172A]">Histórico de Recebimentos</h2>
          {estoques.length > 1 && (
            <div className="flex gap-2 flex-wrap justify-end">
              <button onClick={() => setFiltroEstoque('')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${!filtroEstoque ? 'bg-[#4F7CFF] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}>
                Todos
              </button>
              {estoques.map(e => (
                <button key={e} onClick={() => setFiltroEstoque(e)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filtroEstoque === e ? 'bg-[#4F7CFF] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}>
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {listaFiltrada.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-14 text-center">
            <Package size={28} className="text-[#CBD5E1] mb-3" />
            <p className="text-sm font-medium text-[#374151]">Nenhum item registrado</p>
            <p className="text-xs text-[#94A3B8] mt-1">Os itens de estoque entregues a este funcionário aparecerão aqui.</p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Data</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Produto</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden sm:table-cell">Categoria</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden md:table-cell">CA</th>
                  <th className="text-right text-xs font-semibold text-[#64748B] px-4 py-3">Qtd</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map(r => (
                  <tr key={r.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3 text-sm text-[#64748B] whitespace-nowrap">{fmtData(r.data)}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-[#0F172A]">{r.produto_nome}</p>
                      {r.observacoes && <p className="text-xs text-[#94A3B8] mt-0.5">{r.observacoes}</p>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: r.estoque_cor + '20', color: r.estoque_cor }}>
                        {r.estoque_nome}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {r.ca_valor
                        ? <span className="text-xs font-mono bg-[#F1F5F9] px-2 py-0.5 rounded">{r.ca_valor}</span>
                        : <span className="text-xs text-[#CBD5E1]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-[#374151] text-right whitespace-nowrap">
                      {r.quantidade} {r.unidade}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEdit && (
        <ModalEditarFuncionario
          funcionario={funcionario}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load() }}
        />
      )}
    </div>
  )
}

function ModalEditarFuncionario({ funcionario, onClose, onSaved }: {
  funcionario: Funcionario
  onClose: () => void
  onSaved: () => void
}) {
  const [nome, setNome] = useState(funcionario.nome)
  const [cargo, setCargo] = useState(funcionario.cargo ?? '')
  const [salarioBruto, setSalarioBruto] = useState(funcionario.salario_bruto ? String(funcionario.salario_bruto) : '')
  const [diasMes, setDiasMes] = useState(funcionario.dias_mes ? String(funcionario.dias_mes) : '30')
  const [horasMes, setHorasMes] = useState(funcionario.horas_dia ? String(funcionario.horas_dia) : '220')
  const [ativo, setAtivo] = useState(funcionario.ativo)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function salvar() {
    if (!nome.trim()) return
    setSaving(true)
    const supabase = createClient()
    const diasNum = parseFloat(diasMes) || 30
    const horasNum = parseFloat(horasMes) || 220
    const salNum = parseFloat(salarioBruto) || 0
    const { error: err } = await supabase.from('funcionarios').update({
      nome: nome.trim(), cargo: cargo.trim() || null,
      salario_bruto: salNum || null, horas_dia: horasNum, dias_mes: diasNum,
      custo_diario: diasNum > 0 ? salNum / diasNum : null, ativo,
    }).eq('id', funcionario.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
          <h2 className="font-syne font-semibold text-[#0F172A]">Editar Funcionário</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Nome *</label>
            <input className="field" value={nome} onChange={e => setNome(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Cargo</label>
            <input className="field" value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex: Técnico HVAC" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Salário Bruto (R$)</label>
            <input className="field" type="number" min="0" step="0.01" value={salarioBruto} onChange={e => setSalarioBruto(e.target.value)} placeholder="0,00" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Dias/mês</label>
              <input className="field" type="number" value={diasMes} onChange={e => setDiasMes(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Horas/mês</label>
              <input className="field" type="number" value={horasMes} onChange={e => setHorasMes(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setAtivo(a => !a)}
              className={`w-10 h-6 rounded-full transition-colors relative ${ativo ? 'bg-[#4F7CFF]' : 'bg-[#CBD5E1]'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${ativo ? 'left-4' : 'left-0.5'}`} />
            </button>
            <span className="text-sm text-[#374151]">{ativo ? 'Ativo' : 'Inativo'}</span>
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9]">Cancelar</button>
            <button onClick={salvar} disabled={saving || !nome.trim()} className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
