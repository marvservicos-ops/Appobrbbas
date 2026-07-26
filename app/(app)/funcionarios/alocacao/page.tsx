'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import {
  ChevronLeft, ChevronRight, ArrowLeft,
  Wrench, Building2, Sun, FileText, UserX, Minus,
  Loader2, CheckCircle2, X, Car, Bus, Home, Plus, Trash2, Download,
} from 'lucide-react'
import { useAccess } from '@/lib/useAccess'

type TipoAlocacao = 'obra' | 'escritorio' | 'folga' | 'atestado' | 'falta'

interface Funcionario { id: string; nome: string; cargo: string | null }
interface Obra { id: string; titulo: string }
interface Veiculo { id: string; nome: string; placa: string | null; cor: string | null }
interface Alocacao {
  id: string
  funcionario_id: string
  data: string
  tipo: TipoAlocacao
  obra_id: string | null
  obra_nome: string | null
  veiculo_id: string | null
  veiculo_nome: string | null
  transporte_tipo: string | null
  percentual: number
}

type TransporteTipo = 'veiculo' | 'transporte_publico' | 'casa'
const TRANSPORTES: { tipo: TransporteTipo; label: string; Icon: any }[] = [
  { tipo: 'veiculo',            label: 'Veículo empresa', Icon: Car  },
  { tipo: 'transporte_publico', label: 'Transp. público', Icon: Bus  },
  { tipo: 'casa',               label: 'Direto',          Icon: Home },
]

const TIPOS: { tipo: TipoAlocacao; label: string; cor: string; bg: string; Icon: any }[] = [
  { tipo: 'obra',       label: 'Obra',       cor: '#4F7CFF', bg: '#EEF2FF', Icon: Wrench    },
  { tipo: 'escritorio', label: 'Escritório',  cor: '#8B5CF6', bg: '#F5F3FF', Icon: Building2 },
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
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [alocacoes, setAlocacoes] = useState<Alocacao[]>([])
  const [loading, setLoading] = useState(true)
  const [modalDia, setModalDia] = useState<number | null>(null)
  const [modalCell, setModalCell] = useState<{ fid: string; dia: number } | null>(null)

  useEffect(() => {
    if (!accessLoading && !isAdmin) router.replace('/obras')
  }, [isAdmin, accessLoading, router])

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const inicio = toDate(ano, mes, 1)
    const fim = toDate(ano, mes, new Date(ano, mes + 1, 0).getDate())
    const [{ data: funcs }, { data: obs, error: obrasErr }, { data: aloc, error: alocErr }, { data: veics }] = await Promise.all([
      sb.from('funcionarios').select('id, nome, cargo').eq('ativo', true).order('nome'),
      sb.from('obras').select('id, titulo').in('status', ['Em Orçamento', 'Aprovada', 'Em Andamento']).order('titulo'),
      sb.from('funcionario_alocacoes')
        .select('id, funcionario_id, data, tipo, obra_id, veiculo_id, transporte_tipo, percentual, obras:obra_id(titulo), veiculos:veiculo_id(nome)')
        .gte('data', inicio).lte('data', fim),
      sb.from('veiculos').select('id, nome, placa, cor').eq('ativo', true).order('nome'),
    ])
    if (obrasErr) console.error('Obras error:', obrasErr)
    if (alocErr) console.error('Alocacoes error:', alocErr)
    setFuncionarios(funcs ?? [])
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
        veiculo_id: a.veiculo_id,
        veiculo_nome: a.veiculos?.nome ?? null,
        transporte_tipo: a.transporte_tipo,
        percentual: a.percentual ?? 100,
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
          <button onClick={() => exportarRelatorio(funcionarios, obras, alocacoes, mes, ano)}
            className="w-8 h-8 rounded-lg border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors" title="Exportar relatório mensal">
            <Download size={15} className="text-[#64748B]" />
          </button>
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
                                            : `${cfg.label}${showPct ? ` ${aloc.percentual}%` : ''}`}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                                {transpLabel && (
                                  <div className="w-full flex items-center justify-center bg-[#F1F5F9] shrink-0" style={{ height: 13 }}>
                                    <span className="text-[8px] font-medium text-[#64748B] truncate px-0.5">{transpLabel}</span>
                                  </div>
                                )}
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
          funcionarios={funcionarios} obras={obras} veiculos={veiculos} alocMap={alocMap}
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
          obras={obras} veiculos={veiculos}
          alocacoes={alocMap.get(`${modalCell.fid}_${modalCell.dia}`) ?? []}
          onClose={() => setModalCell(null)}
          onSaved={() => { setModalCell(null); load() }}
        />
      )}
    </div>
  )
}

// ── Modal preencher dia inteiro ────────────────────────────────────────────────

function ModalDia({ dia, mes, ano, funcionarios, obras, veiculos, alocMap, onClose, onSaved }: {
  dia: number; mes: number; ano: number
  funcionarios: Funcionario[]; obras: Obra[]; veiculos: Veiculo[]
  alocMap: Map<string, Alocacao[]>
  onClose: () => void; onSaved: () => void
}) {
  const data = toDate(ano, mes, dia)

  const [rows, setRows] = useState<Record<string, { tipo: TipoAlocacao | ''; obra_id: string; transporte_tipo: string; veiculo_id: string }>>(() => {
    const init: Record<string, any> = {}
    funcionarios.forEach(f => {
      const a = (alocMap.get(`${f.id}_${dia}`) ?? [])[0]
      init[f.id] = { tipo: a?.tipo ?? '', obra_id: a?.obra_id ?? '', transporte_tipo: a?.transporte_tipo ?? '', veiculo_id: a?.veiculo_id ?? '' }
    })
    return init
  })
  const [saving, setSaving] = useState(false)
  const [quickObra, setQuickObra] = useState('')

  function setTipo(fid: string, tipo: TipoAlocacao | '') {
    setRows(p => ({ ...p, [fid]: { ...p[fid], tipo, obra_id: tipo !== 'obra' ? '' : p[fid].obra_id } }))
  }
  function setObra(fid: string, obra_id: string) {
    setRows(p => ({ ...p, [fid]: { ...p[fid], obra_id } }))
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
      funcionarios.forEach(f => { n[f.id] = { ...n[f.id], tipo: 'obra', obra_id: quickObra } })
      return n
    })
  }

  async function salvar() {
    setSaving(true)
    const sb = createClient()
    await Promise.all(
      funcionarios.map(async f => {
        const row = rows[f.id]
        // Delete all existing allocations for this funcionario+day
        await sb.from('funcionario_alocacoes').delete().eq('funcionario_id', f.id).eq('data', data)
        if (row?.tipo) {
          await sb.from('funcionario_alocacoes').insert({
            funcionario_id: f.id, data,
            tipo: row.tipo as TipoAlocacao,
            obra_id: row.tipo === 'obra' && row.obra_id ? row.obra_id : null,
            percentual: 100,
            transporte_tipo: row.transporte_tipo || null,
            veiculo_id: row.transporte_tipo === 'veiculo' && row.veiculo_id ? row.veiculo_id : null,
          })
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
            const row = rows[f.id] ?? { tipo: '', obra_id: '', transporte_tipo: '', veiculo_id: '' }
            return (
              <div key={f.id} className="px-6 py-3 space-y-2">
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <div className="w-40 shrink-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{f.nome}</p>
                    {f.cargo && <p className="text-[11px] text-[#94A3B8] truncate">{f.cargo}</p>}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => setTipo(f.id, '')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors
                        ${row.tipo === '' ? 'bg-[#F1F5F9] border-[#94A3B8] text-[#374151]' : 'border-[#E2E8F0] text-[#CBD5E1] hover:border-[#94A3B8] hover:text-[#64748B]'}`}>
                      —
                    </button>
                    {TIPOS.map(t => (
                      <button key={t.tipo} onClick={() => setTipo(f.id, t.tipo)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors
                          ${row.tipo === t.tipo ? 'text-white border-transparent' : 'border-[#E2E8F0] text-[#94A3B8] hover:border-[#CBD5E1]'}`}
                        style={row.tipo === t.tipo ? { backgroundColor: t.cor } : {}}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {row.tipo === 'obra' && (
                    <select className="field text-sm py-1.5 min-w-0 flex-1 sm:w-48 sm:flex-none"
                      value={row.obra_id} onChange={e => setObra(f.id, e.target.value)}>
                      <option value="">Selecione a obra...</option>
                      {obras.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                    </select>
                  )}
                </div>
                {row.tipo && (
                  <div className="flex items-center gap-2 pl-0 sm:pl-44 flex-wrap">
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
                        <option value="">Selecione o veículo...</option>
                        {veiculos.map(v => <option key={v.id} value={v.id}>{v.nome} — {v.placa}</option>)}
                      </select>
                    )}
                  </div>
                )}
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
  percentual: number
}

let _rowKey = 0
function newRow(tipo: TipoAlocacao | '' = '', obra_id = '', percentual = 100): AlocRow {
  return { _key: ++_rowKey, tipo, obra_id, percentual }
}

function ModalCell({ fid, fNome, dia, mes, ano, obras, veiculos, alocacoes, onClose, onSaved }: {
  fid: string; fNome: string; dia: number; mes: number; ano: number
  obras: Obra[]; veiculos: Veiculo[]; alocacoes: Alocacao[]
  onClose: () => void; onSaved: () => void
}) {
  const data = toDate(ano, mes, dia)

  const [rows, setRows] = useState<AlocRow[]>(() => {
    if (alocacoes.length === 0) return [newRow()]
    return alocacoes.map(a => newRow(a.tipo, a.obra_id ?? '', a.percentual))
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
    setRows(p => [...p, newRow('', '', remaining || 50)])
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
      percentual: r.percentual,
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

              {/* Obra selector */}
              {row.tipo === 'obra' && (
                <div className="pl-7">
                  <select className="field text-sm py-1.5 w-full"
                    value={row.obra_id} onChange={e => updateRow(row._key, { obra_id: e.target.value })}>
                    <option value="">Selecione a obra...</option>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                  </select>
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
          <button onClick={salvar} disabled={saving || (hasTipo && !pctOk) || rows.some(r => r.tipo === 'obra' && !r.obra_id)}
            className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
