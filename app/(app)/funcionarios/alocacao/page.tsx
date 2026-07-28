'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import {
  ChevronLeft, ChevronRight, ArrowLeft,
  Wrench, Building2, Sun, FileText, UserX, Minus,
  Loader2, CheckCircle2, X, Car, Bus, Home, Plus, Trash2, Download, Thermometer, GripVertical, ListOrdered, Moon,
} from 'lucide-react'
import { useAccess } from '@/lib/useAccess'

type TipoAlocacao = 'obra' | 'manutencao' | 'escritorio' | 'folga' | 'atestado' | 'falta'

interface Funcionario { id: string; nome: string; cargo: string | null }
interface Obra { id: string; titulo: string }
interface Manutencao { id: string; nome: string }
interface Veiculo { id: string; nome: string; placa: string | null; cor: string | null }
interface Alocacao {
  id: string
  funcionario_id: string
  data: string
  tipo: TipoAlocacao
  obra_id: string | null
  obra_nome: string | null
  manutencao_id: string | null
  manutencao_nome: string | null
  veiculo_id: string | null
  veiculo_nome: string | null
  transporte_tipo: string | null
  percentual: number
  noturno: boolean
}

type TransporteTipo = 'veiculo' | 'transporte_publico' | 'casa'
const TRANSPORTES: { tipo: TransporteTipo; label: string; Icon: any }[] = [
  { tipo: 'veiculo',            label: 'Veículo empresa', Icon: Car  },
  { tipo: 'transporte_publico', label: 'Transp. público', Icon: Bus  },
  { tipo: 'casa',               label: 'Direto',          Icon: Home },
]

const TIPOS: { tipo: TipoAlocacao; label: string; cor: string; bg: string; Icon: any }[] = [
  { tipo: 'obra',       label: 'Obra',       cor: '#4F7CFF', bg: '#EEF2FF', Icon: Wrench      },
  { tipo: 'manutencao', label: 'Manutenção', cor: '#0EA5E9', bg: '#E0F2FE', Icon: Thermometer },
  { tipo: 'escritorio', label: 'Galpão',  cor: '#8B5CF6', bg: '#F5F3FF', Icon: Building2 },
  { tipo: 'folga',      label: 'Folga',       cor: '#10B981', bg: '#ECFDF5', Icon: Sun       },
  { tipo: 'atestado',   label: 'Atestado',    cor: '#F59E0B', bg: '#FFFBEB', Icon: FileText  },
  { tipo: 'falta',      label: 'Falta',       cor: '#EF4444', bg: '#FEF2F2', Icon: UserX     },
]
const TIPO_MAP = Object.fromEntries(TIPOS.map(t => [t.tipo, t])) as Record<TipoAlocacao, typeof TIPOS[number]>

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DS = ['D','S','T','Q','Q','S','S']

function pad2(n: number) { return String(n).padStart(2, '0') }
function toDate(ano: number, mes: number, dia: number) { return `${ano}-${pad2(mes + 1)}-${pad2(dia)}` }
function abrev(nome: string) {
  const p = nome.trim().split(/\s+/)
  const s = p[0]
  return s.length > 9 ? s.slice(0, 8) + '.' : s
}
function labelData(ano: number, mes: number, dia: number) {
  return new Date(ano, mes, dia).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function exportarRelatorio(
  funcionarios: Funcionario[], obras: Obra[], alocacoes: Alocacao[], mes: number, ano: number
) {
  const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1)

  const alocMap = new Map<string, Alocacao[]>()
  alocacoes.forEach(a => {
    const dia = parseInt(a.data.split('-')[2])
    const key = `${a.funcionario_id}_${dia}`
    if (!alocMap.has(key)) alocMap.set(key, [])
    alocMap.get(key)!.push(a)
  })

  const rows = funcionarios.map(f => {
    const obraMap: Record<string, number> = {}
    let diasEscritorio = 0, diasFolga = 0, diasFalta = 0, diasAtestado = 0

    dias.forEach(dia => {
      const alocs = alocMap.get(`${f.id}_${dia}`) ?? []
      alocs.forEach(a => {
        const frac = (a.percentual || 100) / 100
        if (a.tipo === 'obra' && a.obra_id) {
          obraMap[a.obra_id] = (obraMap[a.obra_id] || 0) + frac
        } else if (a.tipo === 'escritorio') diasEscritorio += frac
        else if (a.tipo === 'folga') diasFolga += frac
        else if (a.tipo === 'falta') diasFalta += frac
        else if (a.tipo === 'atestado') diasAtestado += frac
      })
    })

    const obrasDetalhes = Object.entries(obraMap).map(([oid, dias]) => {
      const o = obras.find(x => x.id === oid)
      return `${o?.titulo ?? oid}: ${Number.isInteger(dias) ? dias : dias.toFixed(1)}d`
    }).join(' | ')

    const totalObra = Object.values(obraMap).reduce((s, v) => s + v, 0)

    return { nome: f.nome, cargo: f.cargo ?? '', obrasDetalhes, totalObra, diasEscritorio, diasFolga, diasFalta, diasAtestado }
  })

  const html = `<!DOCTYPE html><html lang="pt-BR"><head>
  <meta charset="UTF-8"><title>Alocação — ${MESES[mes]} ${ano}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 24px; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    p.sub { color: #666; font-size: 11px; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-size: 11px; border: 1px solid #e2e8f0; }
    td { padding: 5px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .num { text-align: center; }
    @media print { body { padding: 0; } }
  </style></head><body>
  <h1>Relatório de Alocação — ${MESES[mes]} ${ano}</h1>
  <p class="sub">Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
  <table>
    <thead><tr>
      <th>Funcionário</th><th>Cargo</th><th>Obras e dias</th>
      <th class="num">Dias obra</th><th class="num">Escrit.</th>
      <th class="num">Folga</th><th class="num">Falta</th><th class="num">Atest.</th>
    </tr></thead>
    <tbody>
    ${rows.map(r => `<tr>
      <td><strong>${r.nome}</strong></td>
      <td>${r.cargo}</td>
      <td style="font-size:10px">${r.obrasDetalhes || '—'}</td>
      <td class="num">${r.totalObra > 0 ? (Number.isInteger(r.totalObra) ? r.totalObra : r.totalObra.toFixed(1)) : '—'}</td>
      <td class="num">${r.diasEscritorio > 0 ? r.diasEscritorio.toFixed(r.diasEscritorio % 1 === 0 ? 0 : 1) : '—'}</td>
      <td class="num">${r.diasFolga > 0 ? r.diasFolga.toFixed(r.diasFolga % 1 === 0 ? 0 : 1) : '—'}</td>
      <td class="num">${r.diasFalta > 0 ? r.diasFalta.toFixed(r.diasFalta % 1 === 0 ? 0 : 1) : '—'}</td>
      <td class="num">${r.diasAtestado > 0 ? r.diasAtestado.toFixed(r.diasAtestado % 1 === 0 ? 0 : 1) : '—'}</td>
    </tr>`).join('')}
    </tbody>
  </table>
  <script>window.onload = () => window.print()</script>
  </body></html>`

  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}

export default function AlocacaoPage() {
  const router = useRouter()
  const { isAdmin, loading: accessLoading } = useAccess()
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth())
  const [ano, setAno] = useState(now.getFullYear())
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [alocacoes, setAlocacoes] = useState<Alocacao[]>([])
  const [loading, setLoading] = useState(true)
  const [modalDia, setModalDia] = useState<number | null>(null)
  const [modalCell, setModalCell] = useState<{ fid: string; dia: number } | null>(null)
  const [modalOrdem, setModalOrdem] = useState(false)

  useEffect(() => {
    if (!accessLoading && !isAdmin) router.replace('/obras')
  }, [isAdmin, accessLoading, router])

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const inicio = toDate(ano, mes, 1)
    const fim = toDate(ano, mes, new Date(ano, mes + 1, 0).getDate())
    const [{ data: funcs }, { data: obs, error: obrasErr }, { data: aloc, error: alocErr }, { data: veics }, { data: manuts }] = await Promise.all([
      sb.from('funcionarios').select('id, nome, cargo, ordem').eq('ativo', true).order('ordem', { ascending: true, nullsFirst: false }).order('nome'),
      sb.from('obras').select('id, titulo').in('status', ['Em Orçamento', 'Aprovada', 'Em Andamento']).order('titulo'),
      sb.from('funcionario_alocacoes')
        .select('id, funcionario_id, data, tipo, obra_id, manutencao_id, veiculo_id, transporte_tipo, percentual, obras:obra_id(titulo), contratos_manutencao:manutencao_id(empresa:empresas(apelido, razao_social)), veiculos:veiculo_id(nome)')
        .gte('data', inicio).lte('data', fim),
      sb.from('veiculos').select('id, nome, placa, cor').eq('ativo', true).order('nome'),
      sb.from('contratos_manutencao').select('id, empresa:empresas(apelido, razao_social)').eq('ativo', true).order('created_at'),
    ])
    if (obrasErr) console.error('Obras error:', obrasErr)
    if (alocErr) console.error('Alocacoes error:', alocErr)
    setFuncionarios(funcs ?? [])
    setManutencoes(((manuts ?? []) as any[]).map((m: any) => ({ id: m.id, nome: m.empresa?.apelido ?? m.empresa?.razao_social ?? m.id })))
    setObras(obs ?? [])
    setVeiculos(veics ?? [])
    setAlocacoes(
      (aloc ?? []).map((a: any) => ({
        id: a.id,
        funcionario_id: a.funcionario_id,
        data: a.data,
        tipo: a.tipo,
        obra_id: a.obra_id,
        obra_nome: a.obras?.titulo ?? null,
        manutencao_id: a.manutencao_id ?? null,
        manutencao_nome: a.contratos_manutencao?.empresa?.apelido ?? a.contratos_manutencao?.empresa?.razao_social ?? null,
        veiculo_id: a.veiculo_id,
        veiculo_nome: a.veiculos?.nome ?? null,
        transporte_tipo: a.transporte_tipo,
        percentual: a.percentual ?? 100,
        noturno: a.noturno ?? false,
      }))
    )
    setLoading(false)
  }, [mes, ano])

  useEffect(() => { load() }, [load])

  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1)

  // Map: "fid_dia" → Alocacao[] (múltiplas por dia)
  const alocMap = new Map<string, Alocacao[]>()
  alocacoes.forEach(a => {
    const dia = parseInt(a.data.split('-')[2])
    const key = `${a.funcionario_id}_${dia}`
    if (!alocMap.has(key)) alocMap.set(key, [])
    alocMap.get(key)!.push(a)
  })

  function isWeekend(dia: number) { const d = new Date(ano, mes, dia).getDay(); return d === 0 || d === 6 }
  function isHoje(dia: number) {
    const h = new Date()
    return h.getDate() === dia && h.getMonth() === mes && h.getFullYear() === ano
  }

  function navMes(delta: number) {
    const d = new Date(ano, mes + delta, 1)
    setMes(d.getMonth())
    setAno(d.getFullYear())
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar />

      {/* Barra superior */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-[#E2E8F0] bg-white shrink-0">
        <button onClick={() => router.push('/funcionarios')}
          className="w-8 h-8 rounded-lg border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors">
          <ArrowLeft size={15} className="text-[#64748B]" />
        </button>
        <h1 className="font-syne font-bold text-lg text-[#0F172A] flex-1">Quadro de Alocação</h1>
        {!loading && funcionarios.length > 0 && (
          <>
            <button onClick={() => setModalOrdem(true)}
              className="w-8 h-8 rounded-lg border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors" title="Reordenar funcionários">
              <ListOrdered size={15} className="text-[#64748B]" />
            </button>
            <button onClick={() => exportarRelatorio(funcionarios, obras, alocacoes, mes, ano)}
              className="w-8 h-8 rounded-lg border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors" title="Exportar relatório mensal">
              <Download size={15} className="text-[#64748B]" />
            </button>
          </>
        )}
        <div className="flex items-center gap-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-1 py-1">
          <button onClick={() => navMes(-1)}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white hover:shadow-sm transition-all">
            <ChevronLeft size={15} className="text-[#64748B]" />
          </button>
          <span className="text-sm font-semibold text-[#0F172A] px-2 min-w-[130px] text-center">
            {MESES[mes]} {ano}
          </span>
          <button onClick={() => navMes(1)}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white hover:shadow-sm transition-all">
            <ChevronRight size={15} className="text-[#64748B]" />
          </button>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 px-4 md:px-6 py-2 border-b border-[#E2E8F0] bg-[#F8FAFC] shrink-0 overflow-x-auto">
        {TIPOS.map(t => (
          <div key={t.tipo} className="flex items-center gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded" style={{ background: t.cor }} />
            <span className="text-xs text-[#64748B]">{t.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          <div className="w-3 h-3 rounded bg-[#F1F5F9] border border-[#E2E8F0]" />
          <span className="text-xs text-[#94A3B8]">Fim de semana</span>
        </div>
        <span className="text-xs text-[#94A3B8] ml-2 shrink-0">Clique no dia para preencher todos • Clique na célula para editar</span>
      </div>

      {/* Grade */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[#4F7CFF]" />
        </div>
      ) : funcionarios.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[#94A3B8]">Nenhum funcionário ativo cadastrado.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="border-collapse w-full" style={{ tableLayout: 'fixed', minWidth: 168 + diasNoMes * 40 }}>
            <colgroup>
              <col style={{ width: 168 }} />
              {dias.map(dia => <col key={dia} />)}
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-30 bg-[#F8FAFC] border-b-2 border-r border-[#E2E8F0] px-4 py-2 text-left">
                  <span className="text-xs font-semibold text-[#64748B]">Funcionário</span>
                </th>
                {dias.map(dia => {
                  const weekend = isWeekend(dia)
                  const hoje = isHoje(dia)
                  return (
                    <th key={dia}
                      onClick={() => setModalDia(dia)}
                      title={`Preencher ${dia}/${mes + 1}`}
                      className={`border-b-2 border-r border-[#E2E8F0] text-center cursor-pointer select-none transition-colors
                        ${weekend ? 'bg-[#F1F5F9]' : 'bg-[#F8FAFC] hover:bg-[#EEF2FF]'}
                        ${hoje ? 'border-b-[#4F7CFF]' : ''}`}
                      style={{ padding: '5px 2px' }}>
                      <div className={`text-xs font-bold ${hoje ? 'text-[#4F7CFF]' : weekend ? 'text-[#94A3B8]' : 'text-[#374151]'}`}>
                        {dia}
                      </div>
                      <div className={`text-[9px] font-medium ${weekend ? 'text-[#CBD5E1]' : 'text-[#94A3B8]'}`}>
                        {DS[new Date(ano, mes, dia).getDay()]}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {funcionarios.map((f, fi) => {
                const zebra = fi % 2 === 0
                return (
                  <tr key={f.id}>
                    <td className={`sticky left-0 z-10 border-b border-r border-[#E2E8F0] px-4 py-2 ${zebra ? 'bg-white' : 'bg-[#FAFAFA]'}`}>
                      <p className="text-sm font-medium text-[#0F172A] truncate">{f.nome}</p>
                      {f.cargo && <p className="text-[11px] text-[#94A3B8] truncate">{f.cargo}</p>}
                    </td>
                    {dias.map(dia => {
                      const alocArray = alocMap.get(`${f.id}_${dia}`) ?? []
                      const weekend = isWeekend(dia)
                      return (
                        <td key={dia}
                          onClick={() => setModalCell({ fid: f.id, dia })}
                          className={`border-b border-r border-[#E2E8F0] cursor-pointer transition-colors
                            ${alocArray.length === 0 && weekend ? (zebra ? 'bg-[#F4F6F9]' : 'bg-[#F0F2F5]') : zebra ? 'bg-white' : 'bg-[#FAFAFA]'}`}
                          style={{ height: 48, padding: 3 }}>
                          {alocArray.length > 0 ? (() => {
                            const transp = alocArray[0]
                            const veicNome = transp.veiculo_nome
                            const transpLabel = transp.transporte_tipo === 'veiculo' && veicNome
                              ? (veicNome.split(' ')[1] ?? veicNome.split(' ')[0])
                              : transp.transporte_tipo === 'transporte_publico' ? 'Ônibus'
                              : transp.transporte_tipo === 'casa' ? 'Direto'
                              : null
                            const hasNoturno = alocArray.some(a => a.noturno)
                            return (
                              <div className="rounded w-full h-full flex flex-col overflow-hidden">
                                <div className="flex flex-col flex-1 overflow-hidden gap-px min-h-0">
                                  {alocArray.map((aloc, i) => {
                                    const cfg = TIPO_MAP[aloc.tipo]
                                    const showPct = alocArray.length > 1
                                    return (
                                      <div key={aloc.id || i}
                                        className="w-full flex items-center justify-center overflow-hidden px-0.5"
                                        style={{ flex: aloc.percentual, minHeight: 0, backgroundColor: cfg.bg }}>
                                        <span className="text-[9px] font-semibold leading-tight text-center truncate w-full"
                                          style={{ color: cfg.cor }}>
                                          {aloc.tipo === 'obra' && aloc.obra_nome
                                            ? `${abrev(aloc.obra_nome)}${showPct ? ` ${aloc.percentual}%` : ''}`
                                            : aloc.tipo === 'manutencao' && aloc.manutencao_nome
                                            ? `${abrev(aloc.manutencao_nome)}${showPct ? ` ${aloc.percentual}%` : ''}`
                                            : `${cfg.label}${showPct ? ` ${aloc.percentual}%` : ''}`}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                                <div className="w-full flex items-center justify-center bg-[#F1F5F9] shrink-0 gap-1" style={{ height: 13 }}>
                                  {hasNoturno && <Moon size={8} className="text-[#6366F1] shrink-0" />}
                                  {transpLabel && <span className="text-[8px] font-medium text-[#64748B] truncate px-0.5">{transpLabel}</span>}
                                </div>
                              </div>
                            )
                          })() : (
                            <div className="rounded w-full h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity hover:bg-[#EEF2FF]">
                              <span className="text-[#C7D2FE] text-base leading-none">+</span>
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal preencher dia inteiro */}
      {modalDia !== null && (
        <ModalDia
          dia={modalDia} mes={mes} ano={ano}
          funcionarios={funcionarios} obras={obras} manutencoes={manutencoes} veiculos={veiculos} alocMap={alocMap}
          onClose={() => setModalDia(null)}
          onSaved={() => { setModalDia(null); load() }}
        />
      )}

      {/* Modal célula individual */}
      {modalCell !== null && (
        <ModalCell
          fid={modalCell.fid}
          fNome={funcionarios.find(f => f.id === modalCell.fid)?.nome ?? ''}
          dia={modalCell.dia} mes={mes} ano={ano}
          obras={obras} manutencoes={manutencoes} veiculos={veiculos}
          alocacoes={alocMap.get(`${modalCell.fid}_${modalCell.dia}`) ?? []}
          onClose={() => setModalCell(null)}
          onSaved={() => { setModalCell(null); load() }}
        />
      )}

      {/* Modal reordenar */}
      {modalOrdem && (
        <ModalOrdem
          funcionarios={funcionarios}
          onClose={() => setModalOrdem(false)}
          onSaved={() => { setModalOrdem(false); load() }}
        />
      )}
    </div>
  )
}

// ── Modal preencher dia inteiro ────────────────────────────────────────────────

interface DiaFuncRow {
  alocs: { _key: number; tipo: TipoAlocacao | ''; obra_id: string; manutencao_id: string; percentual: number; noturno: boolean }[]
  transporte_tipo: string
  veiculo_id: string
}

let _diaKey = 0
function newDiaAloc(tipo: TipoAlocacao | '' = '', obra_id = '', manutencao_id = '', percentual = 100, noturno = false) {
  return { _key: ++_diaKey, tipo, obra_id, manutencao_id, percentual, noturno }
}

function ModalDia({ dia, mes, ano, funcionarios, obras, manutencoes, veiculos, alocMap, onClose, onSaved }: {
  dia: number; mes: number; ano: number
  funcionarios: Funcionario[]; obras: Obra[]; manutencoes: Manutencao[]; veiculos: Veiculo[]
  alocMap: Map<string, Alocacao[]>
  onClose: () => void; onSaved: () => void
}) {
  const data = toDate(ano, mes, dia)

  const [rows, setRows] = useState<Record<string, DiaFuncRow>>(() => {
    const init: Record<string, DiaFuncRow> = {}
    funcionarios.forEach(f => {
      const existing = alocMap.get(`${f.id}_${dia}`) ?? []
      init[f.id] = {
        alocs: existing.length > 0
          ? existing.map(a => newDiaAloc(a.tipo, a.obra_id ?? '', a.manutencao_id ?? '', a.percentual, a.noturno))
          : [newDiaAloc()],
        transporte_tipo: existing[0]?.transporte_tipo ?? '',
        veiculo_id: existing[0]?.veiculo_id ?? '',
      }
    })
    return init
  })
  const [saving, setSaving] = useState(false)
  const [quickObra, setQuickObra] = useState('')

  function updateAloc(fid: string, key: number, patch: Partial<DiaFuncRow['alocs'][number]>) {
    setRows(p => ({ ...p, [fid]: { ...p[fid], alocs: p[fid].alocs.map(a => a._key === key ? { ...a, ...patch } : a) } }))
  }
  function removeAloc(fid: string, key: number) {
    setRows(p => {
      const alocs = p[fid].alocs
      return { ...p, [fid]: { ...p[fid], alocs: alocs.length === 1 ? [newDiaAloc()] : alocs.filter(a => a._key !== key) } }
    })
  }
  function addAloc(fid: string) {
    setRows(p => {
      const used = p[fid].alocs.reduce((s, a) => s + (a.tipo ? a.percentual : 0), 0)
      const remaining = Math.max(0, 100 - used)
      return { ...p, [fid]: { ...p[fid], alocs: [...p[fid].alocs, newDiaAloc('', '', '', remaining || 50)] } }
    })
  }
  function setTransporte(fid: string, transporte_tipo: string) {
    setRows(p => ({ ...p, [fid]: { ...p[fid], transporte_tipo, veiculo_id: transporte_tipo !== 'veiculo' ? '' : p[fid].veiculo_id } }))
  }
  function setVeiculoId(fid: string, veiculo_id: string) {
    setRows(p => ({ ...p, [fid]: { ...p[fid], veiculo_id } }))
  }

  function aplicarObra() {
    if (!quickObra) return
    setRows(p => {
      const n = { ...p }
      funcionarios.forEach(f => {
        n[f.id] = { ...n[f.id], alocs: [newDiaAloc('obra', quickObra, '', 100)] }
      })
      return n
    })
  }

  async function salvar() {
    setSaving(true)
    const sb = createClient()
    await Promise.all(
      funcionarios.map(async f => {
        const row = rows[f.id]
        await sb.from('funcionario_alocacoes').delete().eq('funcionario_id', f.id).eq('data', data)
        const toInsert = row.alocs.filter(a => a.tipo).map(a => ({
          funcionario_id: f.id, data,
          tipo: a.tipo as TipoAlocacao,
          obra_id: a.tipo === 'obra' && a.obra_id ? a.obra_id : null,
          manutencao_id: a.tipo === 'manutencao' && a.manutencao_id ? a.manutencao_id : null,
          percentual: a.percentual,
          noturno: (a.tipo === 'obra' || a.tipo === 'manutencao') ? a.noturno : false,
          transporte_tipo: row.transporte_tipo || null,
          veiculo_id: row.transporte_tipo === 'veiculo' && row.veiculo_id ? row.veiculo_id : null,
        }))
        if (toInsert.length > 0) {
          await sb.from('funcionario_alocacoes').insert(toInsert)
        }
      })
    )
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] shrink-0">
          <div>
            <h2 className="font-syne font-semibold text-[#0F172A]">Alocação — {dia} de {MESES[mes]}</h2>
            <p className="text-xs text-[#94A3B8] mt-0.5 capitalize">{labelData(ano, mes, dia)}</p>
          </div>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>

        {obras.length > 0 && (
          <div className="px-6 py-3 border-b border-[#F1F5F9] bg-[#F8FAFC] shrink-0 flex items-center gap-2">
            <span className="text-xs text-[#64748B] shrink-0 font-medium">Mesma obra p/ todos:</span>
            <select className="field flex-1 text-sm py-1.5" value={quickObra} onChange={e => setQuickObra(e.target.value)}>
              <option value="">Selecione...</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
            </select>
            <button onClick={aplicarObra} disabled={!quickObra}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#4F7CFF] text-white disabled:opacity-40 hover:bg-[#3d6ae0] transition-colors shrink-0">
              Aplicar
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto divide-y divide-[#F1F5F9]">
          {funcionarios.map(f => {
            const row = rows[f.id]
            const alocs = row?.alocs ?? []
            const hasTipo = alocs.some(a => !!a.tipo)
            const totalPct = alocs.reduce((s, a) => s + (a.tipo ? a.percentual : 0), 0)
            const multiAloc = alocs.filter(a => !!a.tipo).length > 1
            return (
              <div key={f.id} className="px-6 py-3 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-40 shrink-0 pt-1">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{f.nome}</p>
                    {f.cargo && <p className="text-[11px] text-[#94A3B8] truncate">{f.cargo}</p>}
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    {alocs.map((aloc, idx) => (
                      <div key={aloc._key} className="flex items-center gap-1.5 flex-wrap">
                        {/* tipo buttons — compact */}
                        <button onClick={() => updateAloc(f.id, aloc._key, { tipo: '', obra_id: '', manutencao_id: '' })}
                          className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors
                            ${aloc.tipo === '' ? 'bg-[#F1F5F9] border-[#94A3B8] text-[#374151]' : 'border-[#E2E8F0] text-[#CBD5E1] hover:border-[#94A3B8]'}`}>
                          —
                        </button>
                        {TIPOS.map(t => (
                          <button key={t.tipo}
                            onClick={() => updateAloc(f.id, aloc._key, { tipo: aloc.tipo === t.tipo ? '' : t.tipo, obra_id: t.tipo !== 'obra' ? '' : aloc.obra_id, manutencao_id: t.tipo !== 'manutencao' ? '' : aloc.manutencao_id })}
                            className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors
                              ${aloc.tipo === t.tipo ? 'text-white border-transparent' : 'border-[#E2E8F0] text-[#94A3B8] hover:border-[#CBD5E1]'}`}
                            style={aloc.tipo === t.tipo ? { backgroundColor: t.cor } : {}}>
                            {t.label}
                          </button>
                        ))}
                        {aloc.tipo === 'obra' && (
                          <select className="field text-xs py-1 flex-1 min-w-[120px]"
                            value={aloc.obra_id} onChange={e => updateAloc(f.id, aloc._key, { obra_id: e.target.value })}>
                            <option value="">Obra...</option>
                            {obras.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                          </select>
                        )}
                        {aloc.tipo === 'manutencao' && (
                          <select className="field text-xs py-1 flex-1 min-w-[120px]"
                            value={aloc.manutencao_id} onChange={e => updateAloc(f.id, aloc._key, { manutencao_id: e.target.value })}>
                            <option value="">Manutenção...</option>
                            {manutencoes.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                          </select>
                        )}
                        {(aloc.tipo === 'obra' || aloc.tipo === 'manutencao') && (
                          <label className="flex items-center gap-1 cursor-pointer shrink-0">
                            <input type="checkbox" checked={aloc.noturno} onChange={e => updateAloc(f.id, aloc._key, { noturno: e.target.checked })} className="w-3.5 h-3.5 accent-[#6366F1]" />
                            <Moon size={11} className="text-[#6366F1]" />
                          </label>
                        )}
                        {multiAloc && aloc.tipo && (
                          <input type="number" min={1} max={100}
                            value={aloc.percentual}
                            onChange={e => updateAloc(f.id, aloc._key, { percentual: Math.min(100, Math.max(1, parseInt(e.target.value) || 1)) })}
                            className="w-12 text-center text-xs font-semibold border border-[#E2E8F0] rounded-lg py-1 focus:outline-none focus:border-[#4F7CFF]"
                          />
                        )}
                        {(alocs.length > 1 || idx > 0) && (
                          <button onClick={() => removeAloc(f.id, aloc._key)} className="text-[#CBD5E1] hover:text-[#EF4444] transition-colors shrink-0">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center justify-between">
                      <button onClick={() => addAloc(f.id)}
                        className="flex items-center gap-1 text-[11px] font-medium text-[#4F7CFF] hover:text-[#3d6ae0] transition-colors">
                        <Plus size={11} /> Dividir dia
                      </button>
                      {multiAloc && (
                        <span className={`text-[11px] font-semibold ${totalPct === 100 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                          {totalPct}%
                        </span>
                      )}
                    </div>
                    {hasTipo && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-[#94A3B8] shrink-0">Transporte:</span>
                        {TRANSPORTES.map(t => (
                          <button key={t.tipo} onClick={() => setTransporte(f.id, row.transporte_tipo === t.tipo ? '' : t.tipo)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors
                              ${row.transporte_tipo === t.tipo ? 'bg-[#0F172A] text-white border-transparent' : 'border-[#E2E8F0] text-[#94A3B8] hover:border-[#CBD5E1]'}`}>
                            <t.Icon size={10} /> {t.label}
                          </button>
                        ))}
                        {row.transporte_tipo === 'veiculo' && (
                          <select className="field text-xs py-1 w-44"
                            value={row.veiculo_id} onChange={e => setVeiculoId(f.id, e.target.value)}>
                            <option value="">Veículo...</option>
                            {veiculos.map(v => <option key={v.id} value={v.id}>{v.nome} — {v.placa}</option>)}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="px-6 py-4 border-t border-[#E2E8F0] flex gap-3 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-colors">
            Cancelar
          </button>
          <button onClick={salvar} disabled={saving}
            className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal célula individual — multi-alocação ──────────────────────────────────

interface AlocRow {
  _key: number
  id?: string
  tipo: TipoAlocacao | ''
  obra_id: string
  manutencao_id: string
  percentual: number
  noturno: boolean
}

let _rowKey = 0
function newRow(tipo: TipoAlocacao | '' = '', obra_id = '', manutencao_id = '', percentual = 100, noturno = false): AlocRow {
  return { _key: ++_rowKey, tipo, obra_id, manutencao_id, percentual, noturno }
}

function ModalCell({ fid, fNome, dia, mes, ano, obras, manutencoes, veiculos, alocacoes, onClose, onSaved }: {
  fid: string; fNome: string; dia: number; mes: number; ano: number
  obras: Obra[]; manutencoes: Manutencao[]; veiculos: Veiculo[]; alocacoes: Alocacao[]
  onClose: () => void; onSaved: () => void
}) {
  const data = toDate(ano, mes, dia)

  const [rows, setRows] = useState<AlocRow[]>(() => {
    if (alocacoes.length === 0) return [newRow()]
    return alocacoes.map(a => newRow(a.tipo, a.obra_id ?? '', a.manutencao_id ?? '', a.percentual, a.noturno))
  })
  const [transporteTipo, setTransporteTipo] = useState<TransporteTipo | ''>(
    (alocacoes[0]?.transporte_tipo as TransporteTipo) ?? ''
  )
  const [veiculoId, setVeiculoId] = useState(alocacoes[0]?.veiculo_id ?? '')
  const [saving, setSaving] = useState(false)

  const totalPct = rows.reduce((s, r) => s + (r.tipo ? r.percentual : 0), 0)
  const pctOk = totalPct === 100 || totalPct === 0

  function updateRow(key: number, patch: Partial<AlocRow>) {
    setRows(p => p.map(r => r._key === key ? { ...r, ...patch } : r))
  }
  function removeRow(key: number) {
    setRows(p => p.length === 1 ? [newRow()] : p.filter(r => r._key !== key))
  }
  function addRow() {
    const remaining = Math.max(0, 100 - totalPct)
    setRows(p => [...p, newRow('', '', '', remaining || 50)])
  }

  async function salvar() {
    setSaving(true)
    const sb = createClient()
    // Delete all existing for this funcionario+day
    await sb.from('funcionario_alocacoes').delete().eq('funcionario_id', fid).eq('data', data)
    const toInsert = rows.filter(r => r.tipo).map(r => ({
      funcionario_id: fid,
      data,
      tipo: r.tipo as TipoAlocacao,
      obra_id: r.tipo === 'obra' && r.obra_id ? r.obra_id : null,
      manutencao_id: r.tipo === 'manutencao' && r.manutencao_id ? r.manutencao_id : null,
      percentual: r.percentual,
      noturno: (r.tipo === 'obra' || r.tipo === 'manutencao') ? r.noturno : false,
      transporte_tipo: transporteTipo || null,
      veiculo_id: transporteTipo === 'veiculo' && veiculoId ? veiculoId : null,
    }))
    if (toInsert.length > 0) {
      const { error } = await sb.from('funcionario_alocacoes').insert(toInsert)
      if (error) { console.error('Insert error:', error); alert('Erro ao salvar: ' + error.message); setSaving(false); return }
    }
    setSaving(false)
    onSaved()
  }

  const hasTipo = rows.some(r => !!r.tipo)

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] shrink-0">
          <div>
            <h2 className="font-syne font-semibold text-[#0F172A] text-sm">{fNome}</h2>
            <p className="text-xs text-[#94A3B8] capitalize">{labelData(ano, mes, dia)}</p>
          </div>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Linhas de alocação */}
          {rows.map((row, idx) => (
            <div key={row._key} className="border border-[#E2E8F0] rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-[#94A3B8] w-5 shrink-0">#{idx + 1}</span>
                {/* Tipo */}
                <div className="flex gap-1 flex-wrap flex-1">
                  {TIPOS.map(t => (
                    <button key={t.tipo}
                      onClick={() => updateRow(row._key, { tipo: row.tipo === t.tipo ? '' : t.tipo, obra_id: t.tipo !== 'obra' ? '' : row.obra_id })}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors
                        ${row.tipo === t.tipo ? 'text-white border-transparent' : 'border-[#E2E8F0] text-[#94A3B8] hover:border-[#CBD5E1]'}`}
                      style={row.tipo === t.tipo ? { backgroundColor: t.cor } : {}}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {/* Percentual */}
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number" min={1} max={100}
                    value={row.percentual}
                    onChange={e => updateRow(row._key, { percentual: Math.min(100, Math.max(1, parseInt(e.target.value) || 1)) })}
                    className="w-14 text-center text-sm font-semibold border border-[#E2E8F0] rounded-lg py-1 focus:outline-none focus:border-[#4F7CFF]"
                  />
                  <span className="text-xs text-[#94A3B8]">%</span>
                </div>
                <button onClick={() => removeRow(row._key)} className="shrink-0 text-[#CBD5E1] hover:text-[#EF4444] transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Seletores de obra / manutenção */}
              {row.tipo === 'obra' && (
                <div className="pl-7">
                  <select className="field text-sm py-1.5 w-full"
                    value={row.obra_id} onChange={e => updateRow(row._key, { obra_id: e.target.value })}>
                    <option value="">Selecione a obra...</option>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                  </select>
                </div>
              )}
              {row.tipo === 'manutencao' && (
                <div className="pl-7">
                  <select className="field text-sm py-1.5 w-full"
                    value={row.manutencao_id} onChange={e => updateRow(row._key, { manutencao_id: e.target.value })}>
                    <option value="">Selecione a manutenção...</option>
                    {manutencoes.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </div>
              )}
              {(row.tipo === 'obra' || row.tipo === 'manutencao') && (
                <div className="pl-7">
                  <label className="flex items-center gap-2 cursor-pointer w-fit">
                    <input type="checkbox" checked={row.noturno} onChange={e => updateRow(row._key, { noturno: e.target.checked })} className="w-4 h-4 accent-[#6366F1]" />
                    <Moon size={13} className="text-[#6366F1]" />
                    <span className="text-xs font-medium text-[#374151]">Noturno</span>
                  </label>
                </div>
              )}
            </div>
          ))}

          {/* Total percentual */}
          <div className="flex items-center justify-between px-1">
            <button onClick={addRow}
              className="flex items-center gap-1.5 text-xs font-medium text-[#4F7CFF] hover:text-[#3d6ae0] transition-colors">
              <Plus size={13} /> Adicionar alocação
            </button>
            <span className={`text-xs font-semibold ${pctOk ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              Total: {totalPct}%{!pctOk && ' ≠ 100'}
            </span>
          </div>

          {/* Transporte (compartilhado por todo o dia) */}
          {hasTipo && (
            <div className="border-t border-[#F1F5F9] pt-3 space-y-2">
              <p className="text-xs font-medium text-[#374151]">Transporte do dia</p>
              <div className="flex gap-2 flex-wrap">
                {TRANSPORTES.map(t => (
                  <button key={t.tipo}
                    onClick={() => { setTransporteTipo(transporteTipo === t.tipo ? '' : t.tipo); setVeiculoId('') }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors
                      ${transporteTipo === t.tipo ? 'bg-[#0F172A] text-white border-transparent' : 'border-[#E2E8F0] text-[#94A3B8] hover:border-[#CBD5E1]'}`}>
                    <t.Icon size={12} /> {t.label}
                  </button>
                ))}
              </div>
              {transporteTipo === 'veiculo' && (
                <select className="field text-sm w-full" value={veiculoId} onChange={e => setVeiculoId(e.target.value)}>
                  <option value="">Selecione o veículo...</option>
                  {veiculos.map(v => <option key={v.id} value={v.id}>{v.nome} — {v.placa}</option>)}
                </select>
              )}
            </div>
          )}
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-[#E2E8F0] flex gap-3 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-colors">
            Cancelar
          </button>
          <button onClick={salvar} disabled={saving || (hasTipo && !pctOk) || rows.some(r => r.tipo === 'obra' && !r.obra_id) || rows.some(r => r.tipo === 'manutencao' && !r.manutencao_id)}
            className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal reordenar funcionários ───────────────────────────────────────────────

function ModalOrdem({ funcionarios, onClose, onSaved }: {
  funcionarios: Funcionario[]
  onClose: () => void
  onSaved: () => void
}) {
  const [lista, setLista] = useState<Funcionario[]>([...funcionarios])
  const [saving, setSaving] = useState(false)
  const dragIdx = useRef<number | null>(null)

  function onDragStart(idx: number) { dragIdx.current = idx }
  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === idx) return
    setLista(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx.current!, 1)
      next.splice(idx, 0, moved)
      dragIdx.current = idx
      return next
    })
  }
  function onDragEnd() { dragIdx.current = null }

  async function salvar() {
    setSaving(true)
    const sb = createClient()
    await Promise.all(lista.map((f, i) =>
      sb.from('funcionarios').update({ ordem: i }).eq('id', f.id)
    ))
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] shrink-0">
          <div>
            <h2 className="font-syne font-semibold text-[#0F172A]">Ordem dos funcionários</h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">Arraste para reorganizar</p>
          </div>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {lista.map((f, idx) => (
            <div
              key={f.id}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={e => onDragOver(e, idx)}
              onDragEnd={onDragEnd}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] cursor-grab active:cursor-grabbing select-none"
            >
              <GripVertical size={15} className="text-[#CBD5E1] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0F172A] truncate">{f.nome}</p>
                {f.cargo && <p className="text-[11px] text-[#94A3B8] truncate">{f.cargo}</p>}
              </div>
              <span className="text-xs text-[#CBD5E1] font-mono shrink-0">{idx + 1}</span>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-[#E2E8F0] flex gap-3 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-colors">
            Cancelar
          </button>
          <button onClick={salvar} disabled={saving}
            className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {saving ? 'Salvando...' : 'Salvar ordem'}
          </button>
        </div>
      </div>
    </div>
  )
}
