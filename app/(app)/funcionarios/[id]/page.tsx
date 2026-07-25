'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import { ArrowLeft, Pencil, X, Loader2, CheckCircle2, XCircle, DollarSign, Clock, Package, TrendingUp, Heart, Plus, Trash2 } from 'lucide-react'
import { useAccess } from '@/lib/useAccess'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const fmt2 = (v: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

interface OutroBeneficio {
  id: string
  descricao: string
  valor: number
}

interface Funcionario {
  id: string
  nome: string
  cargo: string | null
  salario_bruto: number | null
  horas_dia: number | null
  dias_mes: number | null
  custo_diario: number | null
  ativo: boolean
  fgts_pct: number | null
  inss_patronal_pct: number | null
  provisao_13_pct: number | null
  provisao_ferias_pct: number | null
  provisao_multa_pct: number | null
  vale_refeicao: number | null
  vale_transporte: number | null
  vt_desconto_pct: number | null
  plano_saude: number | null
  outros_beneficios: OutroBeneficio[] | null
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

function calculos(f: Funcionario) {
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

function gerarId() { return Math.random().toString(36).slice(2, 10) }

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

  const { custoTotalMensal, encargos, beneficioFixo, outrosTotal, custoDia, custoHora, encargosPct } = calculos(funcionario)
  const salario = funcionario.salario_bruto ?? 0
  const temEncargosOuBeneficios = encargos > 0 || (beneficioFixo + outrosTotal) > 0

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="card p-3 border-l-4 border-l-[#4F7CFF]">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign size={12} className="text-[#4F7CFF]" />
              <p className="text-xs text-[#64748B]">Custo Total/Mês</p>
            </div>
            <p className="font-syne font-bold text-[#0F172A]">{custoTotalMensal > 0 ? moeda(custoTotalMensal) : '—'}</p>
            {temEncargosOuBeneficios && salario > 0 && (
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Sal. {moeda(salario)}</p>
            )}
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

        {/* Breakdown de custos */}
        {salario > 0 && (
          <div className="card p-4 mb-6">
            <p className="text-xs font-semibold text-[#374151] mb-3">Composição do Custo Mensal</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-[#64748B] text-xs">Salário Bruto</span>
                <span className="font-medium text-[#374151]">{moeda(salario)}</span>
              </div>
              {encargos > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[#64748B] text-xs flex items-center gap-1">
                    <TrendingUp size={10} /> Encargos Trabalhistas ({fmt2(encargosPct)}%)
                  </span>
                  <span className="font-medium text-[#374151]">{moeda(encargos)}</span>
                </div>
              )}
              {beneficioFixo > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[#64748B] text-xs flex items-center gap-1">
                    <Heart size={10} /> Benefícios fixos
                  </span>
                  <span className="font-medium text-[#374151]">{moeda(beneficioFixo)}</span>
                </div>
              )}
              {outrosTotal > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[#64748B] text-xs">Outros benefícios</span>
                  <span className="font-medium text-[#374151]">{moeda(outrosTotal)}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-t border-[#E2E8F0] pt-2 font-bold">
                <span className="text-xs text-[#0F172A]">Custo Total Mensal</span>
                <span className="text-[#4F7CFF]">{moeda(custoTotalMensal)}</span>
              </div>
            </div>

            {/* Detalhes encargos */}
            {encargos > 0 && (
              <div className="mt-3 pt-3 border-t border-[#F1F5F9]">
                <p className="text-[11px] text-[#94A3B8] mb-2 uppercase tracking-wide font-medium">Detalhes dos encargos</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {[
                    { label: 'FGTS', pct: funcionario.fgts_pct ?? 8 },
                    { label: 'INSS Patronal', pct: funcionario.inss_patronal_pct ?? 0 },
                    { label: '13º Salário', pct: funcionario.provisao_13_pct ?? 8.33 },
                    { label: 'Férias + Abono', pct: funcionario.provisao_ferias_pct ?? 11.11 },
                    { label: 'Multa FGTS', pct: funcionario.provisao_multa_pct ?? 3.2 },
                  ].filter(e => e.pct > 0).map(e => (
                    <div key={e.label} className="flex justify-between text-[11px]">
                      <span className="text-[#94A3B8]">{e.label} ({fmt2(e.pct)}%)</span>
                      <span className="text-[#64748B] font-medium">{moeda(salario * e.pct / 100)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detalhes benefícios */}
            {(beneficioFixo + outrosTotal) > 0 && (
              <div className="mt-3 pt-3 border-t border-[#F1F5F9]">
                <p className="text-[11px] text-[#94A3B8] mb-2 uppercase tracking-wide font-medium">Detalhes dos benefícios</p>
                <div className="space-y-1">
                  {funcionario.vale_refeicao ? (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#94A3B8]">Vale Refeição/Alimentação</span>
                      <span className="text-[#64748B] font-medium">{moeda(funcionario.vale_refeicao)}</span>
                    </div>
                  ) : null}
                  {funcionario.vale_transporte ? (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#94A3B8]">
                        Vale Transporte{vtDesconto > 0 ? ` (bruto ${moeda(vtBruto)} − desc. ${moeda(vtDesconto)})` : ''}
                      </span>
                      <span className="text-[#64748B] font-medium">{moeda(vtCustoEmpresa)}</span>
                    </div>
                  ) : null}
                  {funcionario.plano_saude ? (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#94A3B8]">Plano de Saúde</span>
                      <span className="text-[#64748B] font-medium">{moeda(funcionario.plano_saude)}</span>
                    </div>
                  ) : null}
                  {(funcionario.outros_beneficios ?? []).map(o => (
                    <div key={o.id} className="flex justify-between text-[11px]">
                      <span className="text-[#94A3B8]">{o.descricao}</span>
                      <span className="text-[#64748B] font-medium">{moeda(o.valor)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
  const [fgtsPct, setFgtsPct] = useState(String(funcionario.fgts_pct ?? 8))
  const [inssPatronalPct, setInssPatronalPct] = useState(String(funcionario.inss_patronal_pct ?? 0))
  const [provisao13Pct, setProvisao13Pct] = useState(String(funcionario.provisao_13_pct ?? 8.33))
  const [provisaoFeriasPct, setProvisaoFeriasPct] = useState(String(funcionario.provisao_ferias_pct ?? 11.11))
  const [provisaoMultaPct, setProvisaoMultaPct] = useState(String(funcionario.provisao_multa_pct ?? 3.2))
  const [valeRefeicao, setValeRefeicao] = useState(funcionario.vale_refeicao ? String(funcionario.vale_refeicao) : '')
  const [valeTransporte, setValeTransporte] = useState(funcionario.vale_transporte ? String(funcionario.vale_transporte) : '')
  const [vtDescontoPct, setVtDescontoPct] = useState(String(funcionario.vt_desconto_pct ?? 6))
  const [planoSaude, setPlanoSaude] = useState(funcionario.plano_saude ? String(funcionario.plano_saude) : '')
  const [outrosBeneficios, setOutrosBeneficios] = useState<OutroBeneficio[]>(
    Array.isArray(funcionario.outros_beneficios) ? funcionario.outros_beneficios : []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const salNum = parseFloat(salarioBruto) || 0
  const diasNum = parseFloat(diasMes) || 30
  const horasNum = parseFloat(horasMes) || 220
  const encargosPctNum = (parseFloat(fgtsPct) || 0) + (parseFloat(inssPatronalPct) || 0) + (parseFloat(provisao13Pct) || 0) + (parseFloat(provisaoFeriasPct) || 0) + (parseFloat(provisaoMultaPct) || 0)
  const encargosNum = salNum * encargosPctNum / 100
  const vtBrutoNum = parseFloat(valeTransporte) || 0
  const vtDescontoNum = Math.min(vtBrutoNum, salNum * ((parseFloat(vtDescontoPct) || 0) / 100))
  const vtCustoEmpresaNum = Math.max(0, vtBrutoNum - vtDescontoNum)
  const beneficiosFixoNum = (parseFloat(valeRefeicao) || 0) + vtCustoEmpresaNum + (parseFloat(planoSaude) || 0)
  const outrosNum = outrosBeneficios.reduce((s, o) => s + (o.valor || 0), 0)
  const custoTotalMensal = salNum + encargosNum + beneficiosFixoNum + outrosNum
  const custoDia = diasNum > 0 ? custoTotalMensal / diasNum : 0
  const custoHora = horasNum > 0 ? custoTotalMensal / horasNum : 0

  function addOutro() { setOutrosBeneficios(prev => [...prev, { id: gerarId(), descricao: '', valor: 0 }]) }
  function removeOutro(id: string) { setOutrosBeneficios(prev => prev.filter(o => o.id !== id)) }
  function updateOutro(id: string, key: 'descricao' | 'valor', val: string) {
    setOutrosBeneficios(prev => prev.map(o => o.id === id ? { ...o, [key]: key === 'valor' ? parseFloat(val) || 0 : val } : o))
  }

  async function salvar() {
    if (!nome.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('funcionarios').update({
      nome: nome.trim(), cargo: cargo.trim() || null,
      salario_bruto: salNum || null, horas_dia: horasNum, dias_mes: diasNum,
      custo_diario: custoDia || null, ativo,
      fgts_pct: parseFloat(fgtsPct) || 8,
      inss_patronal_pct: parseFloat(inssPatronalPct) || 0,
      provisao_13_pct: parseFloat(provisao13Pct) || 8.33,
      provisao_ferias_pct: parseFloat(provisaoFeriasPct) || 11.11,
      provisao_multa_pct: parseFloat(provisaoMultaPct) || 3.2,
      vale_refeicao: parseFloat(valeRefeicao) || null,
      vale_transporte: parseFloat(valeTransporte) || null,
      vt_desconto_pct: parseFloat(vtDescontoPct) ?? 6,
      plano_saude: parseFloat(planoSaude) || null,
      outros_beneficios: outrosBeneficios.filter(o => o.descricao.trim()).length > 0
        ? outrosBeneficios.filter(o => o.descricao.trim()) : null,
    }).eq('id', funcionario.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  const encargosRows = [
    { label: 'FGTS', hint: '8% padrão', val: fgtsPct, set: setFgtsPct },
    { label: 'INSS Patronal', hint: '0% Simples / 20% Lucro Presumido', val: inssPatronalPct, set: setInssPatronalPct },
    { label: '13º Salário', hint: '8,33% (= 1/12)', val: provisao13Pct, set: setProvisao13Pct },
    { label: 'Férias + Abono 1/3', hint: '11,11%', val: provisaoFeriasPct, set: setProvisaoFeriasPct },
    { label: 'Provisão Multa FGTS', hint: '3,2% (= 40% × 8%)', val: provisaoMultaPct, set: setProvisaoMultaPct },
  ]

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="font-syne font-semibold text-[#0F172A]">Editar Funcionário</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-5">

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Nome *</label>
              <input className="field" value={nome} onChange={e => setNome(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Cargo</label>
              <input className="field" value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex: Técnico HVAC" />
            </div>
          </div>

          <div className="border-t border-[#E2E8F0] pt-4">
            <p className="text-xs font-semibold text-[#374151] mb-3 flex items-center gap-1.5"><DollarSign size={13} /> Remuneração</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Salário Mensal Bruto (R$)</label>
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
            </div>
          </div>

          <div className="border-t border-[#E2E8F0] pt-4">
            <div className="mb-3">
              <p className="text-xs font-semibold text-[#374151] flex items-center gap-1.5"><TrendingUp size={13} /> Encargos Trabalhistas</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">% sobre o salário, provisionados mensalmente</p>
            </div>
            <div className="space-y-2.5">
              {encargosRows.map(({ label, hint, val, set }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#374151]">{label}</p>
                    <p className="text-[11px] text-[#94A3B8]">{hint}</p>
                  </div>
                  <div className="relative w-24 shrink-0">
                    <input className="field text-right pr-6 py-1.5 text-sm" type="number" min="0" max="100" step="0.01"
                      value={val} onChange={e => set(e.target.value)} />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8]">%</span>
                  </div>
                </div>
              ))}
            </div>
            {salNum > 0 && (
              <div className="mt-3 flex justify-between text-xs text-[#64748B] bg-[#F8FAFC] rounded-lg px-3 py-2 border border-[#E2E8F0]">
                <span>Total encargos ({fmt2(encargosPctNum)}%)</span>
                <span className="font-semibold text-[#0F172A]">{moeda(encargosNum)}/mês</span>
              </div>
            )}
          </div>

          <div className="border-t border-[#E2E8F0] pt-4">
            <p className="text-xs font-semibold text-[#374151] mb-3 flex items-center gap-1.5"><Heart size={13} /> Benefícios Mensais</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Vale Refeição / Alimentação</label>
                <input className="field" type="number" min="0" step="0.01" value={valeRefeicao} onChange={e => setValeRefeicao(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Vale Transporte <span className="text-[#94A3B8] font-normal">(valor bruto mensal)</span></label>
                <div className="flex gap-2">
                  <input className="field flex-1" type="number" min="0" step="0.01" value={valeTransporte} onChange={e => setValeTransporte(e.target.value)} placeholder="0,00" />
                  <div className="relative w-28 shrink-0">
                    <input className="field text-right pr-8" type="number" min="0" max="6" step="0.1"
                      value={vtDescontoPct} onChange={e => setVtDescontoPct(e.target.value)} title="Desconto do funcionário (máx. 6% CLT)" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8]">% desc.</span>
                  </div>
                </div>
                {vtBrutoNum > 0 && (
                  <div className="mt-1.5 text-[11px] text-[#94A3B8] flex gap-3">
                    <span>Desconto folha: <span className="text-red-400 font-medium">−{moeda(vtDescontoNum)}</span></span>
                    <span>Custo empresa: <span className="text-emerald-600 font-medium">{moeda(vtCustoEmpresaNum)}</span></span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Plano de Saúde</label>
                <input className="field" type="number" min="0" step="0.01" value={planoSaude} onChange={e => setPlanoSaude(e.target.value)} placeholder="0,00" />
              </div>
              {outrosBeneficios.map(o => (
                <div key={o.id} className="flex items-center gap-2">
                  <input className="field flex-1 text-sm" placeholder="Descrição" value={o.descricao} onChange={e => updateOutro(o.id, 'descricao', e.target.value)} />
                  <input className="field w-28 text-sm" type="number" min="0" step="0.01" placeholder="Valor" value={o.valor || ''} onChange={e => updateOutro(o.id, 'valor', e.target.value)} />
                  <button type="button" onClick={() => removeOutro(o.id)} className="p-1.5 text-[#94A3B8] hover:text-red-500 transition-colors shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addOutro} className="text-xs text-[#4F7CFF] hover:text-[#3d6ae0] flex items-center gap-1 transition-colors">
                <Plus size={12} /> Adicionar outro benefício
              </button>
            </div>
          </div>

          {salNum > 0 && (
            <div className="bg-[#F0F4FF] border border-[#C7D2FE] rounded-xl p-4">
              <p className="text-xs font-semibold text-[#4F7CFF] mb-2">Custo Total Mensal</p>
              <div className="space-y-1 text-xs mb-3">
                <div className="flex justify-between text-[#64748B]"><span>Salário bruto</span><span className="font-medium text-[#374151]">{moeda(salNum)}</span></div>
                <div className="flex justify-between text-[#64748B]"><span>Encargos ({fmt2(encargosPctNum)}%)</span><span className="font-medium text-[#374151]">{moeda(encargosNum)}</span></div>
                {(beneficiosFixoNum + outrosNum) > 0 && <div className="flex justify-between text-[#64748B]"><span>Benefícios</span><span className="font-medium text-[#374151]">{moeda(beneficiosFixoNum + outrosNum)}</span></div>}
                <div className="flex justify-between border-t border-[#C7D2FE] pt-1.5 font-bold text-sm text-[#0F172A]"><span>Total</span><span>{moeda(custoTotalMensal)}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-[#64748B]">Custo/dia</p><p className="font-syne font-bold text-[#0F172A]">{moeda(custoDia)}</p></div>
                <div><p className="text-xs text-[#64748B]">Custo/hora</p><p className="font-syne font-bold text-[#0F172A]">{moeda(custoHora)}</p></div>
              </div>
            </div>
          )}

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
