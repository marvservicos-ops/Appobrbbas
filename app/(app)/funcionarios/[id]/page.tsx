'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import { ArrowLeft, Pencil, Loader2, CheckCircle2, XCircle, DollarSign, Clock, Package, TrendingUp, Heart, Wrench, Printer } from 'lucide-react'
import { useAccess } from '@/lib/useAccess'
import GestaoPJPanel from '@/components/GestaoPJPanel'
import { formatarData } from '@/lib/datas'
import ModalFuncionario, { ehPJ, type Funcionario, type RegraExtra } from '../ModalFuncionario'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const fmt2 = (v: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
const fmtData = (d: string) => formatarData(d)

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
  lote_id: string | null
}

interface FerramentaItem {
  id: string
  data_emprestimo: string
  data_devolucao: string | null
  ferramenta_nome: string
  codigo_interno: string | null
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


function calcMulta(f: Funcionario): { multa: number; meses: number; fgtsAcumulado: number } {
  if (f.acordo_rescisorio || !f.data_admissao || !f.salario_bruto) return { multa: 0, meses: 0, fgtsAcumulado: 0 }
  const admissao = new Date(f.data_admissao + 'T12:00:00')
  const now = new Date()
  const meses = Math.max(0, (now.getFullYear() - admissao.getFullYear()) * 12 + now.getMonth() - admissao.getMonth())
  const fgtsPct = (f.fgts_pct ?? 8) / 100
  const fgtsAcumulado = f.salario_bruto * fgtsPct * meses
  return { multa: fgtsAcumulado * 0.40, meses, fgtsAcumulado }
}

export default function CentralFuncionarioPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { isAdmin, loading: accessLoading } = useAccess()
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null)
  const [regras, setRegras] = useState<RegraExtra[]>([])
  const [registros, setRegistros] = useState<RegistroItem[]>([])
  const [ferramentas, setFerramentas] = useState<FerramentaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstoque, setFiltroEstoque] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState<'dados' | 'pj'>('dados')

  useEffect(() => {
    if (!accessLoading && !isAdmin) router.replace('/obras')
  }, [isAdmin, accessLoading, router])

  async function load() {
    const supabase = createClient()
    const [{ data: func }, { data: regs }, { data: emprestimos }, { data: cfg }] = await Promise.all([
      supabase.from('funcionarios').select('*').eq('id', id).single(),
      supabase.from('estoque_registros')
        .select(`
          id, data, produto_nome, quantidade, unidade, responsavel, observacoes, lote_id,
          estoque:estoque_id(nome, icone, cor),
          valores:estoque_registro_valores(valor, campo:campo_id(nome))
        `)
        .eq('funcionario_id', id)
        .eq('tipo', 'saida')
        .order('data', { ascending: false }),
      supabase.from('ferramenta_emprestimos')
        .select('data_emprestimo, itens:ferramenta_emprestimo_itens(id, data_devolucao, ferramenta:ferramentas(nome, codigo_interno))')
        .eq('funcionario_id', id)
        .order('data_emprestimo', { ascending: false }),
      supabase.from('configuracoes_empresa').select('chave, descricao, valor').like('chave', 'adicional_%'),
    ])

    setFuncionario(func)
    if (cfg) setRegras(cfg as RegraExtra[])

    const ferrItems: FerramentaItem[] = (emprestimos ?? []).flatMap((emp: any) =>
      (emp.itens ?? []).map((it: any) => ({
        id: it.id,
        data_emprestimo: emp.data_emprestimo,
        data_devolucao: it.data_devolucao,
        ferramenta_nome: it.ferramenta?.nome ?? '—',
        codigo_interno: it.ferramenta?.codigo_interno ?? null,
      }))
    )
    setFerramentas(ferrItems)

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
        lote_id: r.lote_id ?? null,
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

  const { custoTotalMensal, encargos, beneficioFixo, outrosTotal, custoDia, custoHora, encargosPct, vtBruto, vtDesconto, vtCustoEmpresa } = calculos(funcionario)
  const salario = funcionario.salario_bruto ?? 0
  const temEncargosOuBeneficios = encargos > 0 || (beneficioFixo + outrosTotal) > 0
  // tipo_vinculo === 'pj'; antes do SQL de 28/10 (coluna inexistente/vazia) usa a regra antiga pelo nome
  const isPJ = ehPJ(funcionario)
  const { multa, meses, fgtsAcumulado } = calcMulta(funcionario)

  return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="p-4 md:p-6 flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto">

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
          <button onClick={() => setShowEdit(true)} aria-label="Editar funcionário" title="Editar funcionário"
            className="w-10 h-10 rounded-xl border border-[#E2E8F0] flex items-center justify-center hover:bg-[#EEF2FF] hover:border-[#4F7CFF] hover:text-[#4F7CFF] transition-colors text-[#64748B] shrink-0 mt-0.5">
            <Pencil size={14} />
          </button>
        </div>

        {/* Abas (só aparece para PJ) */}
        {isPJ && (
          <div className="flex gap-1 border-b border-[#E2E8F0] mb-6 -mt-2">
            {([{ key: 'dados', label: 'Dados' }, { key: 'pj', label: 'Gestão PJ' }] as const).map(t => (
              <button key={t.key} onClick={() => setAbaAtiva(t.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${abaAtiva === t.key ? 'border-[#4F7CFF] text-[#4F7CFF]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'}`}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {isPJ && abaAtiva === 'pj' && <GestaoPJPanel />}

        {(!isPJ || abaAtiva === 'dados') && <>

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

        {/* Provisão rescisória */}
        {(!isPJ || abaAtiva === 'dados') && funcionario.salario_bruto && (
          <div className={`card p-4 mb-6 border-l-4 ${funcionario.acordo_rescisorio ? 'border-l-emerald-400' : multa > 0 ? 'border-l-red-400' : 'border-l-[#CBD5E1]'}`}>
            <p className="text-xs font-semibold text-[#374151] mb-3 flex items-center gap-1.5">
              <TrendingUp size={13} className={funcionario.acordo_rescisorio ? 'text-emerald-500' : 'text-red-500'} />
              Provisão Rescisória (Multa 40% FGTS)
            </p>
            {funcionario.acordo_rescisorio ? (
              <p className="text-sm font-semibold text-emerald-600 flex items-center gap-2">
                <CheckCircle2 size={15} /> Acordo rescisório já realizado
              </p>
            ) : !funcionario.data_admissao ? (
              <p className="text-xs text-[#94A3B8]">Cadastre a data de admissão para calcular a provisão.</p>
            ) : (
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-[#64748B]">
                  <span>Tempo de empresa</span>
                  <span className="font-medium text-[#374151]">{meses} meses ({new Date(funcionario.data_admissao + 'T12:00:00').toLocaleDateString('pt-BR')})</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>FGTS acumulado estimado ({funcionario.fgts_pct ?? 8}% × {meses} meses)</span>
                  <span className="font-medium text-[#374151]">{moeda(fgtsAcumulado)}</span>
                </div>
                <div className="flex justify-between border-t border-[#E2E8F0] pt-1.5 font-bold text-sm text-[#0F172A]">
                  <span>Multa rescisória (40%)</span>
                  <span className="text-red-500">{moeda(multa)}</span>
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
                  <th className="px-4 py-3 w-10"></th>
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
                    <td className="px-4 py-3">
                      {(r.estoque_icone === 'shield' || r.estoque_icone === 'shirt') && (
                        <a href={r.lote_id ? `/print/epi-lote/${r.lote_id}` : `/print/epi/${r.id}`} target="_blank" rel="noopener noreferrer" title="Imprimir termo"
                          className="text-[#94A3B8] hover:text-[#4F7CFF] transition-colors">
                          <Printer size={14} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Ferramentas */}
        <div className="mt-8 mb-3">
          <h2 className="font-syne font-semibold text-[#0F172A]">Ferramentas</h2>
        </div>
        {ferramentas.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-14 text-center">
            <Wrench size={28} className="text-[#CBD5E1] mb-3" />
            <p className="text-sm font-medium text-[#374151]">Nenhuma ferramenta registrada</p>
            <p className="text-xs text-[#94A3B8] mt-1">Empréstimos de ferramentas para este funcionário aparecerão aqui.</p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Ferramenta</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 hidden sm:table-cell">Código</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Retirada</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Devolução</th>
                  <th className="text-right text-xs font-semibold text-[#64748B] px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {ferramentas.map(f => (
                  <tr key={f.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-[#0F172A]">{f.ferramenta_nome}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {f.codigo_interno
                        ? <span className="text-xs font-mono bg-[#F1F5F9] px-2 py-0.5 rounded">{f.codigo_interno}</span>
                        : <span className="text-xs text-[#CBD5E1]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#64748B] whitespace-nowrap">{fmtData(f.data_emprestimo)}</td>
                    <td className="px-4 py-3 text-sm text-[#64748B] whitespace-nowrap">{f.data_devolucao ? fmtData(f.data_devolucao) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${f.data_devolucao ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {f.data_devolucao ? 'Devolvida' : 'Em posse'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        </>}
        </div>
      </div>

      {showEdit && (
        <ModalFuncionario
          funcionario={funcionario}
          regras={regras}
          suportaVinculo={'tipo_vinculo' in funcionario}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load() }}
        />
      )}
    </div>
  )
}
