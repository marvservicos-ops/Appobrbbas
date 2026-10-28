'use client'

// Formulário completo do funcionário (novo e edição) — usado na lista
// (/funcionarios) e no detalhe (/funcionarios/[id]).

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Loader2, DollarSign, CheckCircle2, Calculator, TrendingUp, Heart, Trash2, Shirt } from 'lucide-react'
import { UniformeCamposFuncionario, carregarTamanhosFuncionario, salvarTamanhosFuncionario, type TamanhosPorPeca } from '@/components/UniformeCamposFuncionario'
import { mensagemErro } from '@/lib/erros'
import { numeroOuPadrao } from '@/lib/numero'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const fmt2 = (v: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

export interface OutroBeneficio {
  id: string
  descricao: string
  valor: number
}

export interface Funcionario {
  id: string
  nome: string
  cargo: string | null
  funcao: string | null
  cpf: string | null
  telefone: string | null
  email: string | null
  responsavel_entrega: boolean
  categoria_uniforme_id: string | null
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
  // Só existe depois de rodar supabase/migrations/2026_10_28_funcionarios_pj.sql
  tipo_vinculo?: string | null
}

// PJ pela coluna tipo_vinculo; enquanto a coluna não existe (ou está vazia),
// cai na regra antiga pelo nome do prestador PJ atual.
export function ehPJ(f: Pick<Funcionario, 'nome'> & { tipo_vinculo?: string | null }): boolean {
  if (f.tipo_vinculo != null && f.tipo_vinculo !== '') return f.tipo_vinculo === 'pj'
  const n = f.nome.toLowerCase()
  return n.includes('joão victor') || n.includes('joao victor')
}

export interface RegraExtra {
  chave: string
  descricao: string
  valor: { percentual: number }
}

function gerarId() { return Math.random().toString(36).slice(2, 10) }

export default function ModalFuncionario({ funcionario, regras, suportaVinculo = false, onClose, onSaved }: {
  funcionario: Funcionario | null
  regras: RegraExtra[]
  // true quando a coluna funcionarios.tipo_vinculo já existe no banco
  suportaVinculo?: boolean
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
  const [categoriaUniformeId, setCategoriaUniformeId] = useState(funcionario?.categoria_uniforme_id ?? '')
  const [tamanhosPecas, setTamanhosPecas] = useState<TamanhosPorPeca>({})
  // 'carregando' bloqueia o Salvar; 'erro' = não regravar a lista inteira de tamanhos
  const [tamanhosStatus, setTamanhosStatus] = useState<'carregando' | 'ok' | 'erro'>(funcionario ? 'carregando' : 'ok')
  const [tamanhosErro, setTamanhosErro] = useState('')
  const [tamanhosAlterados, setTamanhosAlterados] = useState(false)
  const [tipoVinculo, setTipoVinculo] = useState(funcionario?.tipo_vinculo || (funcionario && ehPJ(funcionario) ? 'pj' : 'clt'))
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

  const funcionarioId = funcionario?.id
  useEffect(() => {
    if (!funcionarioId) return
    let ativo = true
    carregarTamanhosFuncionario(funcionarioId).then(({ tamanhos, error }) => {
      if (!ativo) return
      if (error) { setTamanhosStatus('erro'); setTamanhosErro(error); return }
      // mantém o que o usuário já digitou enquanto carregava
      setTamanhosPecas(prev => ({ ...tamanhos, ...prev }))
      setTamanhosStatus('ok')
    })
    return () => { ativo = false }
  }, [funcionarioId])

  function setTamanho(pecaId: string, key: 'tamanho' | 'quantidade', value: string) {
    setTamanhosAlterados(true)
    setTamanhosPecas(prev => ({ ...prev, [pecaId]: { tamanho: prev[pecaId]?.tamanho ?? '', quantidade: prev[pecaId]?.quantidade ?? '1', [key]: value } }))
  }

  const salNum = parseFloat(salarioBruto) || 0
  const diasNum = parseFloat(diasMes) || 30
  const horasNum = parseFloat(horasMes) || 220
  // Mesmos padrões usados ao salvar (campo vazio = padrão; 0 é aceito)
  const encargosPctNum = numeroOuPadrao(fgtsPct, 8) + numeroOuPadrao(inssPatronalPct, 0) + numeroOuPadrao(provisao13Pct, 8.33) + numeroOuPadrao(provisaoFeriasPct, 11.11) + numeroOuPadrao(provisaoMultaPct, 3.2)
  const encargosNum = salNum * encargosPctNum / 100
  const vtBrutoNum = parseFloat(valeTransporte) || 0
  const vtDescontoNum = Math.min(vtBrutoNum, salNum * (numeroOuPadrao(vtDescontoPct, 6) / 100))
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
    if (tamanhosStatus === 'carregando') return
    setSaving(true)
    setError('')
    const supabase = createClient()
    const payload: Record<string, unknown> = {
      nome: nome.trim(),
      cargo: cargo.trim() || null,
      funcao: funcao.trim() || null,
      cpf: cpf.trim() || null,
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      responsavel_entrega: responsavelEntrega,
      categoria_uniforme_id: categoriaUniformeId || null,
      data_admissao: dataAdmissao || null,
      acordo_rescisorio: acordoRescisorio,
      salario_bruto: salNum || null,
      horas_dia: horasNum,
      dias_mes: diasNum,
      custo_diario: custoDia || null,
      ativo,
      // numeroOuPadrao aceita 0% (parseFloat(x) || padrão trocava 0 pelo padrão)
      fgts_pct: numeroOuPadrao(fgtsPct, 8),
      inss_patronal_pct: numeroOuPadrao(inssPatronalPct, 0),
      provisao_13_pct: numeroOuPadrao(provisao13Pct, 8.33),
      provisao_ferias_pct: numeroOuPadrao(provisaoFeriasPct, 11.11),
      provisao_multa_pct: numeroOuPadrao(provisaoMultaPct, 3.2),
      vale_refeicao: parseFloat(valeRefeicao) || null,
      vale_transporte: parseFloat(valeTransporte) || null,
      vt_desconto_pct: numeroOuPadrao(vtDescontoPct, 6),
      plano_saude: parseFloat(planoSaude) || null,
      outros_beneficios: outrosBeneficios.filter(o => o.descricao.trim()).length > 0
        ? outrosBeneficios.filter(o => o.descricao.trim())
        : null,
    }
    // Só envia tipo_vinculo quando a coluna já existe (SQL de 28/10 rodado)
    if (suportaVinculo) payload.tipo_vinculo = tipoVinculo
    let idSalvo = funcionario?.id
    if (funcionario) {
      const { error: err } = await supabase.from('funcionarios').update(payload).eq('id', funcionario.id)
      if (err) { setSaving(false); setError(mensagemErro(err, 'Falha ao salvar funcionário')); return }
    } else {
      const { data, error: err } = await supabase.from('funcionarios').insert(payload).select('id').single()
      if (err || !data) { setSaving(false); setError(mensagemErro(err, 'Falha ao criar funcionário')); return }
      idSalvo = data.id
    }
    // Tamanhos: lista completa só se foi carregada; se a leitura falhou, grava só o
    // que o usuário alterou, sem apagar nada.
    if (idSalvo && (tamanhosStatus === 'ok' || tamanhosAlterados)) {
      const errTam = await salvarTamanhosFuncionario(idSalvo, tamanhosPecas, { apagarAusentes: tamanhosStatus === 'ok' })
      if (errTam) {
        setSaving(false)
        setError(`Dados do funcionário salvos, mas ${errTam.charAt(0).toLowerCase()}${errTam.slice(1)}`)
        return
      }
    }
    setSaving(false)
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
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -mr-2"><X size={16} className="text-[#64748B]" /></button>
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
            {suportaVinculo && (
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Vínculo</label>
                <select className="field" value={tipoVinculo} onChange={e => setTipoVinculo(e.target.value)}>
                  <option value="clt">CLT</option>
                  <option value="pj">PJ (prestador)</option>
                </select>
              </div>
            )}
            <div className="border-t border-[#E2E8F0] pt-4">
              <p className="text-xs font-semibold text-[#374151] mb-3 flex items-center gap-1.5"><Shirt size={13} /> Uniforme</p>
              <UniformeCamposFuncionario
                categoriaId={categoriaUniformeId}
                setCategoriaId={setCategoriaUniformeId}
                tamanhos={tamanhosPecas}
                setTamanho={setTamanho}
              />
              {tamanhosStatus === 'carregando' && (
                <p className="text-xs text-[#94A3B8] mt-2 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando tamanhos…</p>
              )}
              {tamanhosStatus === 'erro' && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2">
                  {tamanhosErro} Os tamanhos já cadastrados serão mantidos; só o que você alterar aqui será gravado.
                </p>
              )}
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
                <input className="field" type="number" inputMode="decimal" min="0" step="0.01" value={salarioBruto}
                  onChange={e => setSalarioBruto(e.target.value)} placeholder="0,00" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">Dias/mês <span className="text-[#94A3B8] font-normal">(CLT = 30)</span></label>
                  <input className="field" type="number" inputMode="numeric" min="1" max="31" step="1" value={diasMes} onChange={e => setDiasMes(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">Horas/mês <span className="text-[#94A3B8] font-normal">(CLT 44h = 220)</span></label>
                  <input className="field" type="number" inputMode="numeric" min="1" max="400" step="1" value={horasMes} onChange={e => setHorasMes(e.target.value)} />
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
                    <input className="field text-right pr-6 py-1.5 text-sm" type="number" inputMode="decimal" min="0" max="100" step="0.01"
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
                <input className="field" type="number" inputMode="decimal" min="0" step="0.01" value={valeRefeicao}
                  onChange={e => setValeRefeicao(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Vale Transporte <span className="text-[#94A3B8] font-normal">(valor bruto mensal)</span></label>
                <div className="flex gap-2">
                  <input className="field flex-1" type="number" inputMode="decimal" min="0" step="0.01" value={valeTransporte}
                    onChange={e => setValeTransporte(e.target.value)} placeholder="0,00" />
                  <div className="relative w-28 shrink-0">
                    <input className="field text-right pr-8" type="number" inputMode="decimal" min="0" max="6" step="0.1"
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
                <input className="field" type="number" inputMode="decimal" min="0" step="0.01" value={planoSaude}
                  onChange={e => setPlanoSaude(e.target.value)} placeholder="0,00" />
              </div>
              {outrosBeneficios.map(o => (
                <div key={o.id} className="flex items-center gap-2">
                  <input className="field flex-1 text-sm" placeholder="Descrição do benefício"
                    value={o.descricao} onChange={e => updateOutro(o.id, 'descricao', e.target.value)} />
                  <input className="field w-28 text-sm" type="number" inputMode="decimal" min="0" step="0.01" placeholder="Valor"
                    value={o.valor || ''} onChange={e => updateOutro(o.id, 'valor', e.target.value)} />
                  <button type="button" onClick={() => removeOutro(o.id)} aria-label="Remover benefício" title="Remover benefício"
                    className="p-2 text-[#94A3B8] hover:text-red-500 transition-colors shrink-0">
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
            <button onClick={salvar} disabled={saving || !nome.trim() || tamanhosStatus === 'carregando'}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
