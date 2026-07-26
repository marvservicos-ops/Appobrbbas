'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import { Plus, X, Loader2, Pencil, Trash2, Zap, Droplets, Building2, Monitor, FileText, ShieldCheck, MoreHorizontal, RefreshCw, ChevronDown } from 'lucide-react'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const dataBR = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

interface Custo {
  id: string
  descricao: string
  categoria: string
  valor: number
  data: string
  recorrencia: 'mensal' | 'anual' | 'unico'
  ativo: boolean
  observacao: string | null
}

const CATEGORIAS = [
  { key: 'utilidades',    label: 'Utilidades',       icon: Zap,          cor: '#F59E0B', bg: 'bg-amber-50',   text: 'text-amber-700'   },
  { key: 'imovel',       label: 'Imóvel',            icon: Building2,    cor: '#8B5CF6', bg: 'bg-purple-50',  text: 'text-purple-700'  },
  { key: 'tecnologia',   label: 'Tecnologia',        icon: Monitor,      cor: '#4F7CFF', bg: 'bg-blue-50',    text: 'text-blue-700'    },
  { key: 'documentacao', label: 'Documentação',      icon: FileText,     cor: '#10B981', bg: 'bg-green-50',   text: 'text-green-700'   },
  { key: 'burocracia',   label: 'Burocracia',        icon: ShieldCheck,  cor: '#EF4444', bg: 'bg-red-50',     text: 'text-red-700'     },
  { key: 'outros',       label: 'Outros',            icon: MoreHorizontal, cor: '#94A3B8', bg: 'bg-gray-100', text: 'text-gray-600'    },
]

const RECORRENCIA_LABEL: Record<string, string> = {
  mensal: 'Mensal',
  anual:  'Anual',
  unico:  'Único',
}

function catInfo(key: string) {
  return CATEGORIAS.find(c => c.key === key) ?? CATEGORIAS[CATEGORIAS.length - 1]
}

function custoMensalEquivalente(c: Custo): number {
  if (!c.ativo) return 0
  if (c.recorrencia === 'mensal') return c.valor
  if (c.recorrencia === 'anual')  return c.valor / 12
  return 0
}

const mesAtual = () => {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

export default function AdministrativoPage() {
  const [custos, setCustos] = useState<Custo[]>([])
  const [loading, setLoading] = useState(true)
  const [catFiltro, setCatFiltro] = useState<string>('todas')
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Custo | null>(null)
  const [mesFiltro, setMesFiltro] = useState(mesAtual())

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const sb = createClient()
    const { data } = await sb.from('custos_administrativos').select('*').order('data', { ascending: false })
    setCustos((data ?? []) as Custo[])
    setLoading(false)
  }

  // Recorrentes ativos
  const recorrentes = custos.filter(c => c.ativo && c.recorrencia !== 'unico')
  const totalMensalRecorrente = recorrentes.reduce((s, c) => s + custoMensalEquivalente(c), 0)
  const totalAnualRecorrente = totalMensalRecorrente * 12

  // Únicos no mês selecionado
  const unicosMes = custos.filter(c => c.recorrencia === 'unico' && c.data.startsWith(mesFiltro))
  const totalUnicosMes = unicosMes.reduce((s, c) => s + c.valor, 0)

  // Total real do mês = recorrentes mensais + proporção anual + únicos do mês
  const totalMes = totalMensalRecorrente + totalUnicosMes

  // Lista filtrada
  const lista = custos.filter(c => {
    const catOk = catFiltro === 'todas' || c.categoria === catFiltro
    if (!catOk) return false
    if (c.recorrencia === 'unico') return c.data.startsWith(mesFiltro)
    return true
  })

  // Agrupado por categoria para o resumo
  const porCategoria = CATEGORIAS.map(cat => ({
    ...cat,
    mensal: custos.filter(c => c.categoria === cat.key && c.ativo).reduce((s, c) => s + custoMensalEquivalente(c), 0),
    unicos: custos.filter(c => c.categoria === cat.key && c.recorrencia === 'unico' && c.data.startsWith(mesFiltro)).reduce((s, c) => s + c.valor, 0),
  })).filter(cat => cat.mensal > 0 || cat.unicos > 0)

  return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="p-4 md:p-6 flex-1 overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-syne text-xl font-bold text-[#0F172A]">Custos Administrativos</h1>
            <p className="text-sm text-[#64748B] mt-0.5">Controle de despesas fixas e variáveis da empresa</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors">
              <RefreshCw size={14} className="text-[#94A3B8]" />
            </button>
            <button onClick={() => { setEditando(null); setShowModal(true) }}
              className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={15} /> Novo custo
            </button>
          </div>
        </div>

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

          {/* Coluna esquerda: breakdown por categoria */}
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
                    const Icon = cat.icon
                    return (
                      <div key={cat.key} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${cat.bg}`}>
                            <Icon size={12} style={{ color: cat.cor }} />
                          </div>
                          <span className="text-xs font-medium text-[#374151] flex-1">{cat.label}</span>
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

          {/* Coluna direita: lista */}
          <div className="lg:col-span-2 space-y-4">

            {/* Filtros */}
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setCatFiltro('todas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${catFiltro === 'todas' ? 'bg-[#4F7CFF] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}>
                Todas
              </button>
              {CATEGORIAS.map(cat => (
                <button key={cat.key} onClick={() => setCatFiltro(cat.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${catFiltro === cat.key ? 'text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}
                  style={catFiltro === cat.key ? { backgroundColor: cat.cor } : {}}>
                  {cat.label}
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
                <p className="text-xs text-[#94A3B8] mt-1">Cadastre custos recorrentes ou avulsos</p>
                <button onClick={() => { setEditando(null); setShowModal(true) }}
                  className="btn-primary mt-4 text-sm flex items-center gap-2">
                  <Plus size={14} /> Adicionar
                </button>
              </div>
            ) : (
              <div className="card p-0 overflow-hidden">
                {/* Recorrentes */}
                {lista.filter(c => c.recorrencia !== 'unico').length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                      <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide">Recorrentes</p>
                    </div>
                    {lista.filter(c => c.recorrencia !== 'unico').map(c => (
                      <CustoRow key={c.id} custo={c} onEdit={() => { setEditando(c); setShowModal(true) }} onDelete={() => deletar(c.id)} />
                    ))}
                  </>
                )}
                {/* Avulsos */}
                {lista.filter(c => c.recorrencia === 'unico').length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                      <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide">Avulsos — {mesFiltro.split('-').reverse().join('/')}</p>
                    </div>
                    {lista.filter(c => c.recorrencia === 'unico').map(c => (
                      <CustoRow key={c.id} custo={c} onEdit={() => { setEditando(c); setShowModal(true) }} onDelete={() => deletar(c.id)} />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <ModalCusto
          custo={editando}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )

  async function deletar(id: string) {
    if (!confirm('Remover este custo?')) return
    const sb = createClient()
    await sb.from('custos_administrativos').delete().eq('id', id)
    load()
  }
}

function CustoRow({ custo, onEdit, onDelete }: { custo: Custo; onEdit: () => void; onDelete: () => void }) {
  const cat = catInfo(custo.categoria)
  const Icon = cat.icon
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#F8FAFC] last:border-0 hover:bg-[#FAFAFA] group transition-colors">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cat.bg}`}>
        <Icon size={14} style={{ color: cat.cor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[#0F172A] truncate">{custo.descricao}</p>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${cat.bg} ${cat.text}`}>{cat.label}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${custo.recorrencia === 'mensal' ? 'bg-blue-50 text-blue-600' : custo.recorrencia === 'anual' ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
            {RECORRENCIA_LABEL[custo.recorrencia]}
          </span>
          {!custo.ativo && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 shrink-0">Inativo</span>}
        </div>
        {custo.recorrencia === 'unico' && <p className="text-xs text-[#94A3B8] mt-0.5">{dataBR(custo.data)}</p>}
        {custo.observacao && <p className="text-xs text-[#94A3B8] truncate mt-0.5">{custo.observacao}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-[#0F172A]">{moeda(custo.valor)}</p>
        {custo.recorrencia === 'anual' && (
          <p className="text-[10px] text-[#94A3B8]">{moeda(custo.valor / 12)}/mês</p>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
        <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#EEF2FF] transition-colors">
          <Pencil size={12} className="text-[#4F7CFF]" />
        </button>
        <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors">
          <Trash2 size={12} className="text-red-400" />
        </button>
      </div>
    </div>
  )
}

function ModalCusto({ custo, onClose, onSaved }: { custo: Custo | null; onClose: () => void; onSaved: () => void }) {
  const [descricao, setDescricao] = useState(custo?.descricao ?? '')
  const [categoria, setCategoria] = useState(custo?.categoria ?? 'utilidades')
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
      categoria,
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

  const cat = catInfo(categoria)

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
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIAS.map(c => {
                const Icon = c.icon
                const sel = categoria === c.key
                return (
                  <button key={c.key} type="button" onClick={() => setCategoria(c.key)}
                    className={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl border-2 transition-all text-center ${sel ? 'border-current' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'}`}
                    style={sel ? { borderColor: c.cor, backgroundColor: c.cor + '12' } : {}}>
                    <Icon size={16} style={{ color: sel ? c.cor : '#94A3B8' }} />
                    <span className="text-[10px] font-semibold leading-tight" style={{ color: sel ? c.cor : '#94A3B8' }}>{c.label}</span>
                  </button>
                )
              })}
            </div>
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
