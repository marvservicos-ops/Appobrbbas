'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import {
  Plus, X, Loader2, Pencil, Trash2, RefreshCw, Settings,
  Zap, Droplets, Building2, Monitor, FileText, ShieldCheck, MoreHorizontal,
  Wifi, Phone, Car, Wrench, Package, Users, Coffee, Printer, Server,
  Lock, Globe, Mail, Truck, CreditCard, BarChart2, Home, Flame,
  Wind, Thermometer, Camera, Shield, BookOpen, Clipboard, Archive,
  HardDrive, Database, Cloud, Layout, Star, Tag, Hash, DollarSign,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const dataBR = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

// Mapa de ícones disponíveis para as categorias
const ICONES: Record<string, LucideIcon> = {
  Zap, Droplets, Building2, Monitor, FileText, ShieldCheck, MoreHorizontal,
  Wifi, Phone, Car, Wrench, Package, Users, Coffee, Printer, Server,
  Lock, Globe, Mail, Truck, CreditCard, BarChart2, Home, Flame,
  Wind, Thermometer, Camera, Shield, BookOpen, Clipboard, Archive,
  HardDrive, Database, Cloud, Layout, Star, Tag, Hash, DollarSign,
}

const ICONE_NOMES = Object.keys(ICONES)

function IconeComp({ nome, size = 14, cor }: { nome: string; size?: number; cor?: string }) {
  const Icon = ICONES[nome] ?? MoreHorizontal
  return <Icon size={size} style={cor ? { color: cor } : undefined} />
}

interface Categoria {
  id: string
  nome: string
  icone: string
  cor: string
}

interface Custo {
  id: string
  descricao: string
  categoria_id: string | null
  valor: number
  data: string
  recorrencia: 'mensal' | 'anual' | 'unico'
  ativo: boolean
  observacao: string | null
}

const RECORRENCIA_LABEL: Record<string, string> = {
  mensal: 'Mensal',
  anual: 'Anual',
  unico: 'Único',
}

function custoMensalEquivalente(c: Custo): number {
  if (!c.ativo) return 0
  if (c.recorrencia === 'mensal') return c.valor
  if (c.recorrencia === 'anual') return c.valor / 12
  return 0
}

const mesAtual = () => {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

export default function AdministrativoPage() {
  const [custos, setCustos] = useState<Custo[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'custos' | 'categorias'>('custos')
  const [catFiltro, setCatFiltro] = useState<string>('todas')
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Custo | null>(null)
  const [mesFiltro, setMesFiltro] = useState(mesAtual())

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const sb = createClient()
    const [{ data: cats }, { data: costs }] = await Promise.all([
      sb.from('categorias_administrativas').select('*').order('nome'),
      sb.from('custos_administrativos').select('*').order('data', { ascending: false }),
    ])
    setCategorias((cats ?? []) as Categoria[])
    setCustos((costs ?? []) as Custo[])
    setLoading(false)
  }

  function catInfo(id: string | null): Categoria {
    return categorias.find(c => c.id === id) ?? { id: '', nome: 'Sem categoria', icone: 'MoreHorizontal', cor: '#94A3B8' }
  }

  // KPIs
  const recorrentes = custos.filter(c => c.ativo && c.recorrencia !== 'unico')
  const totalMensalRecorrente = recorrentes.reduce((s, c) => s + custoMensalEquivalente(c), 0)
  const totalAnualRecorrente = totalMensalRecorrente * 12
  const unicosMes = custos.filter(c => c.recorrencia === 'unico' && c.data.startsWith(mesFiltro))
  const totalUnicosMes = unicosMes.reduce((s, c) => s + c.valor, 0)
  const totalMes = totalMensalRecorrente + totalUnicosMes

  // Lista filtrada
  const lista = custos.filter(c => {
    const catOk = catFiltro === 'todas' || c.categoria_id === catFiltro
    if (!catOk) return false
    if (c.recorrencia === 'unico') return c.data.startsWith(mesFiltro)
    return true
  })

  // Breakdown por categoria
  const porCategoria = categorias.map(cat => ({
    ...cat,
    mensal: custos.filter(c => c.categoria_id === cat.id && c.ativo).reduce((s, c) => s + custoMensalEquivalente(c), 0),
    unicos: custos.filter(c => c.categoria_id === cat.id && c.recorrencia === 'unico' && c.data.startsWith(mesFiltro)).reduce((s, c) => s + c.valor, 0),
  })).filter(cat => cat.mensal > 0 || cat.unicos > 0)

  async function deletarCusto(id: string) {
    if (!confirm('Remover este custo?')) return
    await createClient().from('custos_administrativos').delete().eq('id', id)
    load()
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="p-4 md:p-6 flex-1 overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-syne text-xl font-bold text-[#0F172A]">Custos Administrativos</h1>
            <p className="text-sm text-[#64748B] mt-0.5">Controle de despesas fixas e variáveis da empresa</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors">
              <RefreshCw size={14} className="text-[#94A3B8]" />
            </button>
            {tab === 'custos' && (
              <button onClick={() => { setEditando(null); setShowModal(true) }}
                className="btn-primary flex items-center gap-2 text-sm">
                <Plus size={15} /> Novo custo
              </button>
            )}
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1 border-b border-[#E2E8F0] mb-6">
          <button onClick={() => setTab('custos')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === 'custos' ? 'border-[#4F7CFF] text-[#4F7CFF]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'}`}>
            Despesas
          </button>
          <button onClick={() => setTab('categorias')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${tab === 'categorias' ? 'border-[#4F7CFF] text-[#4F7CFF]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'}`}>
            <Settings size={13} /> Categorias
          </button>
        </div>

        {tab === 'categorias' && (
          <GerenciarCategorias categorias={categorias} onChanged={load} />
        )}

        {tab === 'custos' && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="card p-4 border-l-4 border-l-red-400">
                <p className="text-xs text-[#64748B] font-medium mb-1">Total/Mês (recorrente)</p>
                <p className="font-syne font-bold text-xl text-[#0F172A]">{moeda(totalMensalRecorrente)}</p>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">{recorrentes.length} despesas ativas</p>
              </div>
              <div className="card p-4 border-l-4 border-l-amber-400">
                <p className="text-xs text-[#64748B] font-medium mb-1">Total/Ano (projeção)</p>
                <p className="font-syne font-bold text-xl text-[#0F172A]">{moeda(totalAnualRecorrente)}</p>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">só recorrentes</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-[#64748B] font-medium mb-1">Avulsos em {mesFiltro.split('-').reverse().join('/')}</p>
                <p className="font-syne font-bold text-xl text-[#0F172A]">{moeda(totalUnicosMes)}</p>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">{unicosMes.length} lançamento{unicosMes.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="card p-4 border-l-4 border-l-[#4F7CFF]">
                <p className="text-xs text-[#64748B] font-medium mb-1">Total real do mês</p>
                <p className="font-syne font-bold text-xl text-[#0F172A]">{moeda(totalMes)}</p>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">recorrente + avulsos</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Breakdown por categoria */}
              <div className="lg:col-span-1">
                <div className="card p-0 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#F1F5F9]">
                    <p className="text-sm font-semibold text-[#0F172A]">Por categoria</p>
                    <p className="text-xs text-[#94A3B8]">equivalente mensal</p>
                  </div>
                  {porCategoria.length === 0 ? (
                    <p className="text-sm text-[#94A3B8] text-center py-8">Nenhuma despesa cadastrada</p>
                  ) : (
                    <div className="divide-y divide-[#F8FAFC]">
                      {porCategoria.map(cat => {
                        const total = cat.mensal + cat.unicos
                        const pct = totalMes > 0 ? (total / totalMes) * 100 : 0
                        return (
                          <div key={cat.id} className="px-4 py-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: cat.cor + '20' }}>
                                <IconeComp nome={cat.icone} size={12} cor={cat.cor} />
                              </div>
                              <span className="text-xs font-medium text-[#374151] flex-1 truncate">{cat.nome}</span>
                              <span className="text-xs font-semibold text-[#0F172A]">{moeda(total)}</span>
                            </div>
                            <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cat.cor }} />
                            </div>
                            <p className="text-[10px] text-[#94A3B8] mt-0.5">{pct.toFixed(0)}% do total</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Lista */}
              <div className="lg:col-span-2 space-y-4">
                {/* Filtros */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setCatFiltro('todas')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${catFiltro === 'todas' ? 'bg-[#4F7CFF] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}>
                    Todas
                  </button>
                  {categorias.map(cat => (
                    <button key={cat.id} onClick={() => setCatFiltro(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${catFiltro === cat.id ? 'text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}
                      style={catFiltro === cat.id ? { backgroundColor: cat.cor } : {}}>
                      <IconeComp nome={cat.icone} size={11} cor={catFiltro === cat.id ? '#fff' : cat.cor} />
                      {cat.nome}
                    </button>
                  ))}
                  <div className="ml-auto">
                    <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)}
                      className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-xs text-[#374151] focus:outline-none focus:border-[#4F7CFF]" />
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 size={24} className="animate-spin text-[#4F7CFF]" />
                  </div>
                ) : lista.length === 0 ? (
                  <div className="card flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-sm font-medium text-[#374151]">Nenhuma despesa encontrada</p>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      {categorias.length === 0 ? 'Crie categorias primeiro na aba "Categorias"' : 'Cadastre custos recorrentes ou avulsos'}
                    </p>
                    {categorias.length > 0 && (
                      <button onClick={() => { setEditando(null); setShowModal(true) }}
                        className="btn-primary mt-4 text-sm flex items-center gap-2">
                        <Plus size={14} /> Adicionar
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="card p-0 overflow-hidden">
                    {lista.filter(c => c.recorrencia !== 'unico').length > 0 && (
                      <>
                        <div className="px-4 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                          <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide">Recorrentes</p>
                        </div>
                        {lista.filter(c => c.recorrencia !== 'unico').map(c => (
                          <CustoRow key={c.id} custo={c} cat={catInfo(c.categoria_id)}
                            onEdit={() => { setEditando(c); setShowModal(true) }}
                            onDelete={() => deletarCusto(c.id)} />
                        ))}
                      </>
                    )}
                    {lista.filter(c => c.recorrencia === 'unico').length > 0 && (
                      <>
                        <div className="px-4 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                          <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide">Avulsos — {mesFiltro.split('-').reverse().join('/')}</p>
                        </div>
                        {lista.filter(c => c.recorrencia === 'unico').map(c => (
                          <CustoRow key={c.id} custo={c} cat={catInfo(c.categoria_id)}
                            onEdit={() => { setEditando(c); setShowModal(true) }}
                            onDelete={() => deletarCusto(c.id)} />
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {showModal && (
        <ModalCusto
          custo={editando}
          categorias={categorias}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

/* ── Linha de custo ─────────────────────────────────── */
function CustoRow({ custo, cat, onEdit, onDelete }: { custo: Custo; cat: Categoria; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#F8FAFC] last:border-0 hover:bg-[#FAFAFA] group transition-colors">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: cat.cor + '20' }}>
        <IconeComp nome={cat.icone} size={14} cor={cat.cor} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-[#0F172A] truncate">{custo.descricao}</p>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: cat.cor + '20', color: cat.cor }}>
            {cat.nome}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${custo.recorrencia === 'mensal' ? 'bg-blue-50 text-blue-600' : custo.recorrencia === 'anual' ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
            {RECORRENCIA_LABEL[custo.recorrencia]}
          </span>
          {!custo.ativo && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 shrink-0">Inativo</span>}
        </div>
        {custo.recorrencia === 'unico' && <p className="text-xs text-[#94A3B8] mt-0.5">{dataBR(custo.data)}</p>}
        {custo.observacao && <p className="text-xs text-[#94A3B8] truncate">{custo.observacao}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-[#0F172A]">{moeda(custo.valor)}</p>
        {custo.recorrencia === 'anual' && <p className="text-[10px] text-[#94A3B8]">{moeda(custo.valor / 12)}/mês</p>}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
        <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#EEF2FF]">
          <Pencil size={12} className="text-[#4F7CFF]" />
        </button>
        <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50">
          <Trash2 size={12} className="text-red-400" />
        </button>
      </div>
    </div>
  )
}

/* ── Gerenciar categorias ───────────────────────────── */
function GerenciarCategorias({ categorias, onChanged }: { categorias: Categoria[]; onChanged: () => void }) {
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Categoria | null>(null)

  async function deletar(id: string) {
    if (!confirm('Remover esta categoria? Os custos vinculados ficarão sem categoria.')) return
    await createClient().from('categorias_administrativas').delete().eq('id', id)
    onChanged()
  }

  return (
    <div className="max-w-xl space-y-4">
      <button onClick={() => { setEditando(null); setShowModal(true) }}
        className="w-full flex items-center gap-2 justify-center py-3 border-2 border-dashed border-[#E2E8F0] rounded-xl text-sm text-[#64748B] hover:border-[#4F7CFF] hover:text-[#4F7CFF] transition-colors">
        <Plus size={16} /> Nova categoria
      </button>

      {categorias.length === 0 ? (
        <p className="text-sm text-[#94A3B8] text-center py-8">Nenhuma categoria criada ainda.</p>
      ) : (
        <div className="card p-0 overflow-hidden divide-y divide-[#F8FAFC]">
          {categorias.map(cat => (
            <div key={cat.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFA] group transition-colors">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: cat.cor + '25' }}>
                <IconeComp nome={cat.icone} size={16} cor={cat.cor} />
              </div>
              <p className="flex-1 text-sm font-medium text-[#0F172A]">{cat.nome}</p>
              <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: cat.cor }} />
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditando(cat); setShowModal(true) }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#EEF2FF]">
                  <Pencil size={12} className="text-[#4F7CFF]" />
                </button>
                <button onClick={() => deletar(cat.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50">
                  <Trash2 size={12} className="text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ModalCategoria
          categoria={editando}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); onChanged() }}
        />
      )}
    </div>
  )
}

/* ── Modal categoria ────────────────────────────────── */
function ModalCategoria({ categoria, onClose, onSaved }: { categoria: Categoria | null; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(categoria?.nome ?? '')
  const [icone, setIcone] = useState(categoria?.icone ?? 'Tag')
  const [cor, setCor] = useState(categoria?.cor ?? '#4F7CFF')
  const [saving, setSaving] = useState(false)

  const CORES_PRESET = [
    '#4F7CFF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
    '#06B6D4', '#64748B', '#DC2626', '#7C3AED', '#059669',
  ]

  async function salvar() {
    if (!nome.trim()) return
    setSaving(true)
    const sb = createClient()
    const payload = { nome: nome.trim(), icone, cor }
    if (categoria) {
      await sb.from('categorias_administrativas').update(payload).eq('id', categoria.id)
    } else {
      await sb.from('categorias_administrativas').insert(payload)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: cor + '25' }}>
              <IconeComp nome={icone} size={18} cor={cor} />
            </div>
            <h2 className="font-syne font-semibold text-[#0F172A]">{categoria ? 'Editar categoria' : 'Nova categoria'}</h2>
          </div>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-5">

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Nome *</label>
            <input className="field" value={nome} onChange={e => setNome(e.target.value)}
              placeholder="Ex: Utilidades, Impostos, Tecnologia..." autoFocus />
          </div>

          {/* Cor */}
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-2">Cor</label>
            <div className="flex items-center gap-2 flex-wrap">
              {CORES_PRESET.map(c => (
                <button key={c} type="button" onClick={() => setCor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${cor === c ? 'ring-2 ring-offset-2 ring-[#0F172A] scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={cor} onChange={e => setCor(e.target.value)}
                className="w-7 h-7 rounded-full border-2 border-[#E2E8F0] cursor-pointer overflow-hidden p-0.5"
                title="Cor personalizada" />
            </div>
          </div>

          {/* Ícone */}
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-2">Ícone</label>
            <div className="grid grid-cols-8 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {ICONE_NOMES.map(nome_icone => {
                const sel = icone === nome_icone
                return (
                  <button key={nome_icone} type="button" onClick={() => setIcone(nome_icone)}
                    title={nome_icone}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${sel ? 'ring-2 ring-offset-1' : 'hover:bg-[#F1F5F9]'}`}
                    style={sel ? { backgroundColor: cor + '20', borderColor: cor } : {}}>
                    <IconeComp nome={nome_icone} size={16} cor={sel ? cor : '#94A3B8'} />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9]">
              Cancelar
            </button>
            <button onClick={salvar} disabled={saving || !nome.trim()}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Modal custo ────────────────────────────────────── */
function ModalCusto({ custo, categorias, onClose, onSaved }: {
  custo: Custo | null; categorias: Categoria[]; onClose: () => void; onSaved: () => void
}) {
  const [descricao, setDescricao] = useState(custo?.descricao ?? '')
  const [categoriaId, setCategoriaId] = useState(custo?.categoria_id ?? (categorias[0]?.id ?? ''))
  const [valor, setValor] = useState(custo?.valor ? String(custo.valor) : '')
  const [data, setData] = useState(custo?.data ?? new Date().toISOString().split('T')[0])
  const [recorrencia, setRecorrencia] = useState<Custo['recorrencia']>(custo?.recorrencia ?? 'mensal')
  const [ativo, setAtivo] = useState(custo?.ativo ?? true)
  const [observacao, setObservacao] = useState(custo?.observacao ?? '')
  const [saving, setSaving] = useState(false)

  async function salvar() {
    if (!descricao.trim() || !valor) return
    setSaving(true)
    const sb = createClient()
    const payload = {
      descricao: descricao.trim(),
      categoria_id: categoriaId || null,
      valor: parseFloat(valor),
      data,
      recorrencia,
      ativo,
      observacao: observacao.trim() || null,
    }
    if (custo) {
      await sb.from('custos_administrativos').update(payload).eq('id', custo.id)
    } else {
      await sb.from('custos_administrativos').insert(payload)
    }
    setSaving(false)
    onSaved()
  }

  const catSel = categorias.find(c => c.id === categoriaId)

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="font-syne font-semibold text-[#0F172A]">{custo ? 'Editar custo' : 'Novo custo'}</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-4">

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Descrição *</label>
            <input className="field" value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Conta de luz, IPTU, Adobe..." autoFocus />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Categoria</label>
            {categorias.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">Crie categorias na aba "Categorias" primeiro.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {categorias.map(cat => {
                  const sel = categoriaId === cat.id
                  return (
                    <button key={cat.id} type="button" onClick={() => setCategoriaId(cat.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${sel ? 'border-current' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'}`}
                      style={sel ? { borderColor: cat.cor, backgroundColor: cat.cor + '12' } : {}}>
                      <IconeComp nome={cat.icone} size={14} cor={sel ? cat.cor : '#94A3B8'} />
                      <span className="text-xs font-semibold truncate" style={{ color: sel ? cat.cor : '#64748B' }}>{cat.nome}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Valor (R$) *</label>
              <input type="number" step="0.01" min="0" className="field" value={valor}
                onChange={e => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Recorrência</label>
              <select className="field" value={recorrencia} onChange={e => setRecorrencia(e.target.value as Custo['recorrencia'])}>
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
                <option value="unico">Único (avulso)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">
              {recorrencia === 'unico' ? 'Data do pagamento' : 'Data de referência'}
            </label>
            <input type="date" className="field" value={data} onChange={e => setData(e.target.value)} />
          </div>

          {recorrencia === 'anual' && parseFloat(valor) > 0 && (
            <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-xs text-purple-700">
              Equivale a <strong>{moeda(parseFloat(valor) / 12)}/mês</strong> provisionado
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Observação</label>
            <input className="field" value={observacao} onChange={e => setObservacao(e.target.value)}
              placeholder="Ex: Vencimento dia 10, referente ao galpão..." />
          </div>

          {custo && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setAtivo(v => !v)}
                className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${ativo ? 'bg-[#4F7CFF]' : 'bg-[#CBD5E1]'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${ativo ? 'left-4' : 'left-0.5'}`} />
              </button>
              <span className="text-xs text-[#374151]">{ativo ? 'Ativo' : 'Inativo (não conta nos totais)'}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9]">
              Cancelar
            </button>
            <button onClick={salvar} disabled={saving || !descricao.trim() || !valor}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
