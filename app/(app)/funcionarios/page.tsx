'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import { Plus, Pencil, X, Loader2, Users, DollarSign, CheckCircle2, XCircle, Clock, Calculator, TrendingUp, Heart, Trash2, LayoutGrid } from 'lucide-react'
import { useAccess } from '@/lib/useAccess'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const fmt2 = (v: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

interface OutroBeneficio {
  id: string
  descricao: string
  valor: number
}

interface Funcionario {
  id: string
  nome: string
  cargo: string | null
  funcao: string | null
  cpf: string | null
  telefone: string | null
  email: string | null
  responsavel_entrega: boolean
  salario_bruto: number | null
  horas_dia: number | null
  dias_mes: number | null
  custo_diario: number | null
  ativo: boolean
  created_at: string
  data_admissao: string | null
  acordo_rescisorio: boolean
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

function calcMulta(f: Funcionario): number {
  if (f.acordo_rescisorio || !f.data_admissao || !f.salario_bruto) return 0
  const admissao = new Date(f.data_admissao + 'T12:00:00')
  const meses = Math.max(0, (new Date().getFullYear() - admissao.getFullYear()) * 12 + new Date().getMonth() - admissao.getMonth())
  const fgtsPct = (f.fgts_pct ?? 8) / 100
  const fgtsAcumulado = f.salario_bruto * fgtsPct * meses
  return fgtsAcumulado * 0.40
}

interface RegraExtra {
  chave: string
  descricao: string
  valor: { percentual: number }
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

function gerarId() { return Math.random().toString(36).slice(2, 10) }

function ModalFuncionario({ funcionario, regras, onClose, onSaved }: {
  funcionario: Funcionario | null
  regras: RegraExtra[]
  onClose: () => void
  onSaved: () => void
}) {
  const [nome, setNome] = useState(funcionario?.nome ?? '')
  const [cargo, setCargo] = useState(funcionario?.cargo ?? '')
  const [funcao, setFuncao] = useState(funcionario?.funcao ?? '')
  const [cpf, setCpf] = useState(funcionario?.cpf ?? '')
  const [telefone, setTelefone] = useState(funcionario?.telefone ?? '')
  const [email, setEmail] = useState(funcionario?.email ?? '')
  const [responsavelEntrega, setResponsavelEntrega] = useState(funcionario?.responsavel_entrega ?? false)
  const [dataAdmissao, setDataAdmissao] = useState(funcionario?.data_admissao ?? '')
  const [acordoRescisorio, setAcordoRescisorio] = useState(funcionario?.acordo_rescisorio ?? false)
  const [salarioBruto, setSalarioBruto] = useState(funcionario?.salario_bruto ? String(funcionario.salario_bruto) : '')
  const [diasMes, setDiasMes] = useState(funcionario?.dias_mes ? String(funcionario.dias_mes) : '30')
  const [horasMes, setHorasMes] = useState(funcionario?.horas_dia ? String(funcionario.horas_dia) : '220')
  const [ativo, setAtivo] = useState(funcionario?.ativo ?? true)
  const [fgtsPct, setFgtsPct] = useState(String(funcionario?.fgts_pct ?? 8))
  const [inssPatronalPct, setInssPatronalPct] = useState(String(funcionario?.inss_patronal_pct ?? 0))
  const [provisao13Pct, setProvisao13Pct] = useState(String(funcionario?.provisao_13_pct ?? 8.33))
  const [provisaoFeriasPct, setProvisaoFeriasPct] = useState(String(funcionario?.provisao_ferias_pct ?? 11.11))
  const [provisaoMultaPct, setProvisaoMultaPct] = useState(String(funcionario?.provisao_multa_pct ?? 3.2))
  const [valeRefeicao, setValeRefeicao] = useState(funcionario?.vale_refeicao ? String(funcionario.vale_refeicao) : '')
  const [valeTransporte, setValeTransporte] = useState(funcionario?.vale_transporte ? String(funcionario.vale_transporte) : '')
  const [vtDescontoPct, setVtDescontoPct] = useState(String(funcionario?.vt_desconto_pct ?? 6))
  const [planoSaude, setPlanoSaude] = useState(funcionario?.plano_saude ? String(funcionario.plano_saude) : '')
  const [outrosBeneficios, setOutrosBeneficios] = useState<OutroBeneficio[]>(
    Array.isArray(funcionario?.outros_beneficios) ? funcionario.outros_beneficios : []
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

  function addOutro() {
    setOutrosBeneficios(prev => [...prev, { id: gerarId(), descricao: '', valor: 0 }])
  }
  function removeOutro(id: string) {
    setOutrosBeneficios(prev => prev.filter(o => o.id !== id))
  }
  function updateOutro(id: string, key: 'descricao' | 'valor', val: string) {
    setOutrosBeneficios(prev => prev.map(o => o.id === id ? { ...o, [key]: key === 'valor' ? parseFloat(val) || 0 : val } : o))
  }

  async function salvar() {
    if (!nome.trim()) return
    setSaving(true)
    setError('')
    const supabase = createClient()
    const payload = {
      nome: nome.trim(),
      cargo: cargo.trim() || null,
      funcao: funcao.trim() || null,
      cpf: cpf.trim() || null,
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      responsavel_entrega: responsavelEntrega,
      data_admissao: dataAdmissao || null,
      acordo_rescisorio: acordoRescisorio,
      salario_bruto: salNum || null,
      horas_dia: horasNum,
      dias_mes: diasNum,
      custo_diario: custoDia || null,
      ativo,
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
        ? outrosBeneficios.filter(o => o.descricao.trim())
        : null,
    }
    const { error: err } = funcionario
      ? await supabase.from('funcionarios').update(payload).eq('id', funcionario.id)
      : await supabase.from('funcionarios').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  const encargosRows = [
    { label: 'FGTS', hint: '8% padrão', val: fgtsPct, set: setFgtsPct },
    { label: 'INSS Patronal', hint: '0% Simples / 20% Lucro Presumido', val: inssPatronalPct, set: setInssPatronalPct },
    { label: '13º Salário', hint: '8,33% (= 1/12 do salário)', val: provisao13Pct, set: setProvisao13Pct },
    { label: 'Férias + Abono 1/3', hint: '11,11% (= 4/3 ÷ 12)', val: provisaoFeriasPct, set: setProvisaoFeriasPct },
    { label: 'Provisão Multa FGTS', hint: '3,2% (= 40% × 8%)', val: provisaoMultaPct, set: setProvisaoMultaPct },
  ]

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="font-syne font-semibold text-[#0F172A]">{funcionario ? 'Editar Funcionário' : 'Novo Funcionário'}</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-5">

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Nome *</label>
              <input className="field" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Cargo</label>
                <input className="field" value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex: Técnico HVAC, Auxiliar..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Função</label>
                <input className="field" value={funcao} onChange={e => setFuncao(e.target.value)} placeholder="Ex: Instalador, Motorista..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">CPF</label>
                <input className="field" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Telefone</label>
                <input className="field" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">E-mail</label>
              <input type="email" className="field" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Data de Admissão</label>
                <input type="date" className="field" value={dataAdmissao} onChange={e => setDataAdmissao(e.target.value)} />
              </div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <button type="button" onClick={() => setAcordoRescisorio(v => !v)}
                    className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${acordoRescisorio ? 'bg-[#4F7CFF]' : 'bg-[#CBD5E1]'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${acordoRescisorio ? 'left-4' : 'left-0.5'}`} />
                  </button>
                  <span className="text-xs font-medium text-[#374151]">Acordo rescisório pago</span>
                </label>
              </div>
            </div>
          </div>

          {/* Remuneração */}
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
                  <input className="field" type="number" min="1" max="31" step="1" value={diasMes} onChange={e => setDiasMes(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">Horas/mês <span className="text-[#94A3B8] font-normal">(CLT 44h = 220)</span></label>
                  <input className="field" type="number" min="1" max="400" step="1" value={horasMes} onChange={e => setHorasMes(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Encargos Trabalhistas */}
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

          {/* Benefícios */}
          <div className="border-t border-[#E2E8F0] pt-4">
            <p className="text-xs font-semibold text-[#374151] mb-3 flex items-center gap-1.5"><Heart size={13} /> Benefícios Mensais</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Vale Refeição / Alimentação</label>
                <input className="field" type="number" min="0" step="0.01" value={valeRefeicao}
                  onChange={e => setValeRefeicao(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Vale Transporte <span className="text-[#94A3B8] font-normal">(valor bruto mensal)</span></label>
                <div className="flex gap-2">
                  <input className="field flex-1" type="number" min="0" step="0.01" value={valeTransporte}
                    onChange={e => setValeTransporte(e.target.value)} placeholder="0,00" />
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
                <input className="field" type="number" min="0" step="0.01" value={planoSaude}
                  onChange={e => setPlanoSaude(e.target.value)} placeholder="0,00" />
              </div>
              {outrosBeneficios.map(o => (
                <div key={o.id} className="flex items-center gap-2">
                  <input className="field flex-1 text-sm" placeholder="Descrição do benefício"
                    value={o.descricao} onChange={e => updateOutro(o.id, 'descricao', e.target.value)} />
                  <input className="field w-28 text-sm" type="number" min="0" step="0.01" placeholder="Valor"
                    value={o.valor || ''} onChange={e => updateOutro(o.id, 'valor', e.target.value)} />
                  <button type="button" onClick={() => removeOutro(o.id)}
                    className="p-1.5 text-[#94A3B8] hover:text-red-500 transition-colors shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addOutro}
                className="text-xs text-[#4F7CFF] hover:text-[#3d6ae0] flex items-center gap-1 transition-colors">
                <Plus size={12} /> Adicionar outro benefício
              </button>
            </div>
          </div>

          {/* Preview custo real */}
          {salNum > 0 && (
            <div className="bg-[#F0F4FF] border border-[#C7D2FE] rounded-xl p-4">
              <p className="text-xs font-semibold text-[#4F7CFF] flex items-center gap-1.5 mb-3"><Calculator size={12} /> Custo Real Calculado</p>
              <div className="space-y-1.5 text-xs mb-3">
                <div className="flex justify-between text-[#64748B]">
                  <span>Salário bruto</span>
                  <span className="font-medium text-[#374151]">{moeda(salNum)}</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Encargos ({fmt2(encargosPctNum)}%)</span>
                  <span className="font-medium text-[#374151]">{moeda(encargosNum)}</span>
                </div>
                {(beneficiosFixoNum + outrosNum) > 0 && (
                  <div className="flex justify-between text-[#64748B]">
                    <span>Benefícios</span>
                    <span className="font-medium text-[#374151]">{moeda(beneficiosFixoNum + outrosNum)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[#C7D2FE] pt-1.5 font-bold text-sm text-[#0F172A]">
                  <span>Custo Total Mensal</span>
                  <span>{moeda(custoTotalMensal)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[#64748B]">Custo/dia</p>
                  <p className="font-syne font-bold text-[#0F172A]">{moeda(custoDia)}</p>
                  <p className="text-[11px] text-[#94A3B8]">÷ {diasNum} dias</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B]">Custo/hora</p>
                  <p className="font-syne font-bold text-[#0F172A]">{moeda(custoHora)}</p>
                  <p className="text-[11px] text-[#94A3B8]">÷ {horasNum}h</p>
                </div>
              </div>
              {regras.length > 0 && (
                <div className="border-t border-[#C7D2FE] pt-3 mt-3">
                  <p className="text-xs text-[#64748B] mb-2">Hora com adicional (sobre custo/hora real):</p>
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
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setAtivo(a => !a)}
                className={`w-10 h-6 rounded-full transition-colors relative ${ativo ? 'bg-[#4F7CFF]' : 'bg-[#CBD5E1]'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${ativo ? 'left-4' : 'left-0.5'}`} />
              </button>
              <span className="text-sm text-[#374151]">{ativo ? 'Ativo' : 'Inativo'}</span>
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button type="button" onClick={() => setResponsavelEntrega(v => !v)}
              className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${responsavelEntrega ? 'bg-[#4F7CFF]' : 'bg-[#CBD5E1]'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${responsavelEntrega ? 'left-4' : 'left-0.5'}`} />
            </button>
            <span className="text-sm text-[#374151]">Habilitado a entregar itens de estoque (aparece como opção de responsável na saída de EPI, uniforme etc.)</span>
          </label>

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
