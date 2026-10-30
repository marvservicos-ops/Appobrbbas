'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle, Banknote, CheckCheck, ChevronLeft, ChevronRight, FilePlus2, Loader2,
  Pencil, Plus, RefreshCw, ScanSearch, Search,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import { useAccess } from '@/lib/useAccess'
import { mensagemErro } from '@/lib/erros'
import { formatarData, hojeLocal, mesLocal, parseData, segundaDaSemana, somarDias } from '@/lib/datas'
import { formatarMoeda } from '@/lib/numero'
import { type Fornecedor, formatarDocumento, nomeFornecedor, somenteDigitos } from '@/lib/fornecedores'
import { emAberto, SELECT_CONTA, STATUS_ABERTOS, STATUS_CONTA, STATUS_ORDEM, type Conta, type StatusConta } from '@/lib/contasPagar'
import ModalNota from '@/components/ModalNotaCompra'
import ModalConta from './ModalConta'
import ModalStatus from './ModalStatus'

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const diaMes = (d: string) => formatarData(d).slice(0, 5)

type FiltroStatus = 'todos' | 'abertos' | StatusConta

function ultimoDiaMes(mes: string) {
  const [a, m] = mes.split('-').map(Number)
  return `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`
}

export default function ContasPagarPage() {
  const { can, loading: accessLoading } = useAccess()
  const permitido = can('contas_pagar')
  const hoje = hojeLocal()

  const [aba, setAba] = useState<'semana' | 'todas'>('semana')
  const [segunda, setSegunda] = useState(segundaDaSemana(hoje))
  const [mes, setMes] = useState(mesLocal())
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos')
  const [busca, setBusca] = useState('')

  const [contas, setContas] = useState<Conta[]>([])
  const [atrasadas, setAtrasadas] = useState<Conta[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [modalNota, setModalNota] = useState<{ id: string | null } | null>(null)
  const [modalConta, setModalConta] = useState<{ conta: Conta | null; doDda?: boolean } | null>(null)
  const [modalStatus, setModalStatus] = useState<{ conta: Conta; para: 'divergente' | 'pago' } | null>(null)

  const domingo = somarDias(segunda, 6)

  useEffect(() => {
    if (!accessLoading && permitido) load()
  }, [accessLoading, permitido, aba, segunda, mes]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    setErro(null)
    const sb = createClient()
    const [ini, fim] = aba === 'semana' ? [segunda, domingo] : [`${mes}-01`, ultimoDiaMes(mes)]
    // Vencidos em aberto de antes da semana exibida (para nada se perder de uma semana para outra)
    const corteAtraso = segunda < hoje ? segunda : hoje
    const [{ data: forn, error: e1 }, { data: lista, error: e2 }, { data: atras, error: e3 }] = await Promise.all([
      sb.from('fornecedores').select('*').order('nome'),
      sb.from('contas_pagar').select(SELECT_CONTA).gte('data_vencimento', ini).lte('data_vencimento', fim).order('data_vencimento'),
      aba === 'semana'
        ? sb.from('contas_pagar').select(SELECT_CONTA).lt('data_vencimento', corteAtraso).in('status', STATUS_ABERTOS).order('data_vencimento')
        : Promise.resolve({ data: [], error: null }),
    ])
    const e = e1 ?? e2 ?? e3
    if (e) { setErro(mensagemErro(e, 'Erro ao carregar as contas')); setLoading(false); return }
    setFornecedores((forn ?? []) as Fornecedor[])
    setContas((lista ?? []) as Conta[])
    setAtrasadas((atras ?? []) as Conta[])
    setLoading(false)
  }

  async function conferir(c: Conta) {
    const { error } = await createClient().from('contas_pagar').update({ status: 'conferido_dda' }).eq('id', c.id)
    if (error) { alert(mensagemErro(error, 'Erro ao marcar como conferido')); return }
    setContas(cs => cs.map(x => x.id === c.id ? { ...x, status: 'conferido_dda' } : x))
    setAtrasadas(cs => cs.map(x => x.id === c.id ? { ...x, status: 'conferido_dda' } : x))
  }

  const fornecedorDe = (id: string) => fornecedores.find(f => f.id === id)
  const adicionarFornecedor = (f: Fornecedor) => setFornecedores(fs => fs.some(x => x.id === f.id) ? fs : [...fs, f])

  const combina = (c: Conta) => {
    if (filtroStatus === 'abertos' ? !emAberto(c.status) : filtroStatus !== 'todos' && c.status !== filtroStatus) return false
    const q = busca.trim().toLowerCase()
    if (!q) return true
    const f = fornecedorDe(c.fornecedor_id)
    const dq = somenteDigitos(q)
    return Boolean(
      f?.nome.toLowerCase().includes(q) || f?.nome_fantasia?.toLowerCase().includes(q) ||
      (dq.length >= 3 && f?.cnpj?.includes(dq)) ||
      c.nota?.numero_nf?.toLowerCase().includes(q) || c.descricao?.toLowerCase().includes(q),
    )
  }

  const validas = contas.filter(c => c.status !== 'cancelado')
  const resumo = (s: StatusConta) => {
    const l = validas.filter(c => c.status === s)
    return { qtd: l.length, total: l.reduce((t, c) => t + Number(c.valor), 0) }
  }
  const totalPeriodo = validas.reduce((t, c) => t + Number(c.valor), 0)
  const lista = contas.filter(combina)
  const listaAtrasadas = atrasadas.filter(combina)

  // Semana agrupada por dia de vencimento
  const porDia = Array.from({ length: 7 }, (_, i) => somarDias(segunda, i))
    .map(dia => ({ dia, itens: lista.filter(c => c.data_vencimento === dia) }))
    .filter(g => g.itens.length > 0)

  const abrirConta = (c: Conta) => setModalConta({ conta: c })
  const linhaProps = (c: Conta, mostrarData: boolean) => ({
    conta: c, fornecedor: fornecedorDe(c.fornecedor_id), mostrarData, hoje,
    onConferir: () => conferir(c),
    onDivergente: () => setModalStatus({ conta: c, para: 'divergente' }),
    onPago: () => setModalStatus({ conta: c, para: 'pago' }),
    onEditar: () => abrirConta(c),
  })

  if (accessLoading || !permitido) {
    return (
      <div className="flex flex-col h-full">
        <Topbar />
        <div className="flex items-center justify-center py-16">
          {accessLoading
            ? <Loader2 size={24} className="animate-spin text-[#4F7CFF]" />
            : <p className="text-sm text-[#64748B]">Acesso restrito. Peça ao administrador a permissão “Contas a pagar”.</p>}
        </div>
      </div>
    )
  }

  const kpis: { s: StatusConta; label: string; borda: string }[] = [
    { s: 'pendente', label: 'A conferir', borda: 'border-l-slate-400' },
    { s: 'conferido_dda', label: 'Conferido DDA', borda: 'border-l-blue-500' },
    { s: 'divergente', label: 'Divergentes', borda: 'border-l-red-500' },
    { s: 'pago', label: 'Pagos', borda: 'border-l-emerald-500' },
  ]

  return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="p-4 md:p-6 flex-1 overflow-y-auto">

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="font-syne text-xl font-bold text-[#0F172A]">Contas a pagar</h1>
            <p className="text-sm text-[#64748B] mt-0.5">Notas de compra, boletos e conferência com o DDA</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={load} aria-label="Atualizar" title="Atualizar" className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#E2E8F0] hover:bg-[#F1F5F9]">
              <RefreshCw size={14} className="text-[#94A3B8]" />
            </button>
            <button onClick={() => setModalConta({ conta: null, doDda: true })} title="Boleto que apareceu no DDA e não está lançado"
              className="btn-secondary flex items-center gap-2 text-sm">
              <ScanSearch size={15} /> Boleto do DDA sem registro
            </button>
            <button onClick={() => setModalConta({ conta: null })} className="btn-secondary flex items-center gap-2 text-sm">
              <Plus size={15} /> Boleto avulso
            </button>
            <button onClick={() => setModalNota({ id: null })} className="btn-primary flex items-center gap-2 text-sm">
              <FilePlus2 size={15} /> Lançar nota
            </button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-[#E2E8F0] mb-5">
          {([['semana', 'Vencimentos da semana'], ['todas', 'Todas por mês']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setAba(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${aba === id ? 'border-[#4F7CFF] text-[#4F7CFF]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Período */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {aba === 'semana' ? (
            <>
              <button onClick={() => setSegunda(somarDias(segunda, -7))} aria-label="Semana anterior" title="Semana anterior" className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#E2E8F0] hover:bg-[#F1F5F9]">
                <ChevronLeft size={16} className="text-[#64748B]" />
              </button>
              <p className="text-sm font-semibold text-[#0F172A] min-w-[150px] text-center">{diaMes(segunda)} a {formatarData(domingo)}</p>
              <button onClick={() => setSegunda(somarDias(segunda, 7))} aria-label="Próxima semana" title="Próxima semana" className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#E2E8F0] hover:bg-[#F1F5F9]">
                <ChevronRight size={16} className="text-[#64748B]" />
              </button>
              {segunda !== segundaDaSemana(hoje) && (
                <button onClick={() => setSegunda(segundaDaSemana(hoje))} className="text-xs font-medium text-[#4F7CFF] px-2 py-1 rounded-lg hover:bg-[#EEF2FF]">Esta semana</button>
              )}
            </>
          ) : (
            <input type="month" value={mes} onChange={e => e.target.value && setMes(e.target.value)} aria-label="Mês"
              className="px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm text-[#374151] focus:outline-none focus:border-[#4F7CFF]" />
          )}
          <div className="relative flex-1 min-w-[200px] sm:max-w-xs sm:ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input className="field !pl-9" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Fornecedor, CNPJ ou nº da NF" />
          </div>
        </div>

        {erro ? (
          <div className="card flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm font-medium text-red-600">{erro}</p>
            <button onClick={load} className="btn-primary mt-4 text-sm">Tentar de novo</button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#4F7CFF]" /></div>
        ) : (
          <>
            {/* Resumo — clicar filtra a lista */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <button onClick={() => setFiltroStatus('todos')}
                className={`card p-4 text-left border-l-4 border-l-[#4F7CFF] ${filtroStatus === 'todos' ? 'ring-2 ring-[#4F7CFF]/30' : ''}`}>
                <p className="text-xs text-[#64748B] font-medium mb-1">{aba === 'semana' ? 'Total da semana' : 'Total do mês'}</p>
                <p className="font-syne font-bold text-lg text-[#0F172A]">{formatarMoeda(totalPeriodo)}</p>
                <p className="text-[11px] text-[#94A3B8]">{validas.length} boleto{validas.length !== 1 ? 's' : ''}</p>
              </button>
              {kpis.map(k => {
                const r = resumo(k.s)
                return (
                  <button key={k.s} onClick={() => setFiltroStatus(filtroStatus === k.s ? 'todos' : k.s)}
                    className={`card p-4 text-left border-l-4 ${k.borda} ${filtroStatus === k.s ? 'ring-2 ring-[#4F7CFF]/30' : ''}`}>
                    <p className="text-xs text-[#64748B] font-medium mb-1">{k.label}</p>
                    <p className="font-syne font-bold text-lg text-[#0F172A]">{formatarMoeda(r.total)}</p>
                    <p className="text-[11px] text-[#94A3B8]">{r.qtd} boleto{r.qtd !== 1 ? 's' : ''}</p>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap mb-4">
              {(['todos', 'abertos', ...STATUS_ORDEM] as FiltroStatus[]).map(s => (
                <button key={s} onClick={() => setFiltroStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filtroStatus === s ? 'bg-[#4F7CFF] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}>
                  {s === 'todos' ? 'Todos' : s === 'abertos' ? 'Em aberto' : STATUS_CONTA[s].label}
                </button>
              ))}
            </div>

            {aba === 'semana' && listaAtrasadas.length > 0 && (
              <div className="card p-0 overflow-hidden mb-4 border-red-200">
                <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-500" />
                  <p className="text-xs font-semibold text-red-700 flex-1">Vencidos e não pagos ({listaAtrasadas.length})</p>
                  <p className="text-xs font-semibold text-red-700">{formatarMoeda(listaAtrasadas.reduce((t, c) => t + Number(c.valor), 0))}</p>
                </div>
                {listaAtrasadas.map(c => <ContaLinha key={c.id} {...linhaProps(c, true)} />)}
              </div>
            )}

            {lista.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-14 text-center">
                <p className="text-sm font-medium text-[#374151]">
                  {contas.length === 0 ? (aba === 'semana' ? 'Nenhum boleto vence nesta semana' : 'Nenhum boleto vence neste mês') : 'Nenhum boleto com este filtro'}
                </p>
                <p className="text-xs text-[#94A3B8] mt-1">Lance as notas de compra assim que chegarem — os boletos aparecem aqui na semana do vencimento.</p>
              </div>
            ) : aba === 'semana' ? (
              <div className="space-y-4">
                {porDia.map(({ dia, itens }) => (
                  <div key={dia} className="card p-0 overflow-hidden">
                    <div className={`px-4 py-2 border-b border-[#E2E8F0] flex items-center gap-2 ${dia === hoje ? 'bg-[#EEF2FF]' : 'bg-[#F8FAFC]'}`}>
                      <p className={`text-xs font-semibold flex-1 ${dia === hoje ? 'text-[#4F7CFF]' : 'text-[#374151]'}`}>
                        {DIAS_SEMANA[parseData(dia).getDay()]}, {diaMes(dia)}{dia === hoje ? ' · hoje' : ''}
                      </p>
                      <p className="text-xs font-semibold text-[#374151]">{formatarMoeda(itens.filter(c => c.status !== 'cancelado').reduce((t, c) => t + Number(c.valor), 0))}</p>
                    </div>
                    {itens.map(c => <ContaLinha key={c.id} {...linhaProps(c, false)} />)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="card p-0 overflow-hidden">
                {lista.map(c => <ContaLinha key={c.id} {...linhaProps(c, true)} />)}
              </div>
            )}
          </>
        )}
      </div>

      {modalNota && (
        <ModalNota notaId={modalNota.id} fornecedores={fornecedores}
          onFornecedorCriado={adicionarFornecedor}
          onClose={() => setModalNota(null)}
          onSaved={() => { setModalNota(null); load() }} />
      )}
      {modalConta && (
        <ModalConta conta={modalConta.conta} doDda={modalConta.doDda} fornecedores={fornecedores}
          onFornecedorCriado={adicionarFornecedor}
          onEditarNota={id => { setModalConta(null); setModalNota({ id }) }}
          onClose={() => setModalConta(null)}
          onSaved={() => { setModalConta(null); load() }} />
      )}
      {modalStatus && (
        <ModalStatus conta={modalStatus.conta} para={modalStatus.para}
          onClose={() => setModalStatus(null)}
          onSaved={() => { setModalStatus(null); load() }} />
      )}
    </div>
  )
}

/* ── Linha de boleto ─────────────────────────────────── */
function ContaLinha({ conta: c, fornecedor, mostrarData, hoje, onConferir, onDivergente, onPago, onEditar }: {
  conta: Conta
  fornecedor: Fornecedor | undefined
  mostrarData: boolean
  hoje: string
  onConferir: () => void
  onDivergente: () => void
  onPago: () => void
  onEditar: () => void
}) {
  const st = STATUS_CONTA[c.status]
  const vencido = emAberto(c.status) && c.data_vencimento < hoje
  const totalParcelas = c.nota?.parcelas?.[0]?.count ?? 0
  const origem = c.nota
    ? `${c.nota.numero_nf ? `NF ${c.nota.numero_nf}` : 'Nota sem nº'}${totalParcelas > 1 && c.parcela ? ` · parcela ${c.parcela}/${totalParcelas}` : ''}`
    : (c.descricao || 'Boleto avulso')

  const botao = 'h-9 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium'
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-3 border-b border-[#F1F5F9] last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-[#0F172A] truncate">{nomeFornecedor(fornecedor)}</p>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${st.classe}`}>{st.label}</span>
          {vencido && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 bg-red-500 text-white">Vencido</span>}
        </div>
        <p className="text-xs text-[#64748B] truncate">
          {fornecedor?.cnpj ? `${formatarDocumento(fornecedor.cnpj)} · ` : ''}{origem}
        </p>
        {c.status === 'divergente' && c.motivo_divergencia && <p className="text-xs text-red-600 mt-0.5">{c.motivo_divergencia}</p>}
        {c.status === 'pago' && c.data_pagamento && <p className="text-[11px] text-emerald-700 mt-0.5">Pago em {formatarData(c.data_pagamento)}</p>}
      </div>
      <div className="flex items-center gap-3 sm:gap-1">
        <div className="sm:text-right sm:mr-2 flex-1 sm:flex-none">
          <p className="text-sm font-semibold text-[#0F172A]">{formatarMoeda(Number(c.valor))}</p>
          {mostrarData && <p className={`text-[11px] ${vencido ? 'text-red-600 font-medium' : 'text-[#94A3B8]'}`}>vence {formatarData(c.data_vencimento)}</p>}
        </div>
        {(c.status === 'pendente' || c.status === 'divergente') && (
          <button onClick={onConferir} title="Bate com o DDA" className={`${botao} text-blue-700 bg-blue-50 hover:bg-blue-100`}>
            <CheckCheck size={14} /> Conferido
          </button>
        )}
        {emAberto(c.status) && c.status !== 'divergente' && (
          <button onClick={onDivergente} aria-label="Marcar como divergente" title="Não bate com o DDA" className={`${botao} text-red-600 hover:bg-red-50`}>
            <AlertTriangle size={14} />
          </button>
        )}
        {emAberto(c.status) && (
          <button onClick={onPago} aria-label="Marcar como pago" title="Marcar como pago" className={`${botao} text-emerald-700 hover:bg-emerald-50`}>
            <Banknote size={14} />
          </button>
        )}
        <button onClick={onEditar} aria-label="Editar" title="Editar" className={`${botao} hover:bg-[#EEF2FF]`}>
          <Pencil size={14} className="text-[#4F7CFF]" />
        </button>
      </div>
    </div>
  )
}
