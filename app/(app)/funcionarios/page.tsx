'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import { Plus, Pencil, Users, DollarSign, CheckCircle2, XCircle, Clock, TrendingUp, LayoutGrid, Shirt, FileSignature } from 'lucide-react'
import { useAccess } from '@/lib/useAccess'
import ModalFuncionario, { type Funcionario, type RegraExtra } from './ModalFuncionario'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

function calcMulta(f: Funcionario): number {
  if (f.acordo_rescisorio || !f.data_admissao || !f.salario_bruto) return 0
  const admissao = new Date(f.data_admissao + 'T12:00:00')
  const meses = Math.max(0, (new Date().getFullYear() - admissao.getFullYear()) * 12 + new Date().getMonth() - admissao.getMonth())
  const fgtsPct = (f.fgts_pct ?? 8) / 100
  const fgtsAcumulado = f.salario_bruto * fgtsPct * meses
  return fgtsAcumulado * 0.40
}

function calculos(f: Pick<Funcionario, 'salario_bruto' | 'horas_dia' | 'dias_mes' | 'fgts_pct' | 'inss_patronal_pct' | 'provisao_13_pct' | 'provisao_ferias_pct' | 'provisao_multa_pct' | 'vale_refeicao' | 'vale_transporte' | 'vt_desconto_pct' | 'plano_saude' | 'outros_beneficios'>) {
  const salario = f.salario_bruto ?? 0
  const dias = f.dias_mes ?? 30
  const horasMes = f.horas_dia ?? 220
  const encargosPct = (f.fgts_pct ?? 8) + (f.inss_patronal_pct ?? 0) + (f.provisao_13_pct ?? 8.33) + (f.provisao_ferias_pct ?? 11.11) + (f.provisao_multa_pct ?? 3.2)
  const encargos = salario * encargosPct / 100
  const vtBruto = f.vale_transporte ?? 0
  const vtDesconto = Math.min(vtBruto, salario * ((f.vt_desconto_pct ?? 6) / 100))
  const vtCustoEmpresa = Math.max(0, vtBruto - vtDesconto)
  const beneficioFixo = (f.vale_refeicao ?? 0) + vtCustoEmpresa + (f.plano_saude ?? 0)
  const outrosTotal = (f.outros_beneficios ?? []).reduce((s, o) => s + (o.valor ?? 0), 0)
  const custoTotalMensal = salario + encargos + beneficioFixo + outrosTotal
  const custoDia = dias > 0 ? custoTotalMensal / dias : 0
  const custoHora = horasMes > 0 ? custoTotalMensal / horasMes : 0
  return { custoTotalMensal, encargos, beneficioFixo, outrosTotal, custoDia, custoHora, encargosPct, vtBruto, vtDesconto, vtCustoEmpresa }
}

export default function FuncionariosPage() {
  const router = useRouter()
  const { isAdmin, loading: accessLoading } = useAccess()
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [regras, setRegras] = useState<RegraExtra[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!accessLoading && !isAdmin) router.replace('/obras')
  }, [isAdmin, accessLoading, router])
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
  const custoTotalMensal = ativos.reduce((s, f) => s + calculos(f).custoTotalMensal, 0)
  const totalMulta = ativos.reduce((s, f) => s + calcMulta(f), 0)
  const semAdmissao = ativos.filter(f => !f.data_admissao && !f.acordo_rescisorio).length

  return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="p-4 md:p-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-syne text-xl md:text-2xl font-bold text-[#0F172A]">Funcionários</h1>
            <p className="text-xs md:text-sm text-[#64748B] mt-0.5">Cadastro de equipe e custo de mão de obra</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/funcionarios/alocacao')}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] transition-colors font-medium">
              <LayoutGrid size={15} /> Quadro
            </button>
            <button onClick={() => router.push('/funcionarios/uniformes')}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] transition-colors font-medium">
              <Shirt size={15} /> Uniformes
            </button>
            <button onClick={() => router.push('/funcionarios/documentos')}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] transition-colors font-medium">
              <FileSignature size={15} /> Documentos
            </button>
            <button onClick={() => { setEditando(null); setShowModal(true) }}
              className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={15} /> Novo
            </button>
          </div>
        </div>

        {/* Cards resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
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
              <p className="text-xs text-[#64748B] font-medium">Custo Mensal Real</p>
            </div>
            <p className="font-syne font-bold text-xl text-[#0F172A]">{moeda(custoTotalMensal)}</p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">c/ encargos e benefícios</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-[#64748B]" />
              <p className="text-xs text-[#64748B] font-medium">Custo/Dia Médio</p>
            </div>
            <p className="font-syne font-bold text-2xl text-[#0F172A]">
              {ativos.length > 0 ? moeda(ativos.reduce((s, f) => s + calculos(f).custoDia, 0) / ativos.length) : '—'}
            </p>
          </div>
          <div className="card p-4 border-l-4 border-l-red-400">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-red-500" />
              <p className="text-xs text-[#64748B] font-medium">Provisão Rescisória</p>
            </div>
            <p className="font-syne font-bold text-xl text-[#0F172A]">{totalMulta > 0 ? moeda(totalMulta) : '—'}</p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              {semAdmissao > 0 ? `${semAdmissao} sem data de admissão` : 'multa 40% FGTS acumulado'}
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
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Custo Total/Mês</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden md:table-cell">Custo/Dia</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden lg:table-cell">Custo/Hora</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {lista.map(f => {
                  const { custoTotalMensal: ctm, custoDia, custoHora } = calculos(f)
                  return (
                    <tr key={f.id} onClick={() => router.push(`/funcionarios/${f.id}`)} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors group cursor-pointer">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-[#0F172A]">{f.nome}</p>
                        <p className="text-xs text-[#94A3B8] sm:hidden">{f.cargo ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#64748B] hidden sm:table-cell">{f.cargo ?? '—'}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-[#374151]">{ctm > 0 ? moeda(ctm) : '—'}</p>
                        {f.salario_bruto && ctm > f.salario_bruto && (
                          <p className="text-[11px] text-[#94A3B8]">Sal. {moeda(f.salario_bruto)}</p>
                        )}
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
                        <button onClick={e => { e.stopPropagation(); setEditando(f); setShowModal(true) }}
                          aria-label={`Editar ${f.nome}`} title="Editar"
                          className="opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity p-2 rounded-md hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#4F7CFF]">
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
          suportaVinculo={funcionarios.some(f => 'tipo_vinculo' in f)}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
