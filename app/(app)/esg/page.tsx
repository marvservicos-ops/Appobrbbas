'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  EsgCombustivel, EsgInvestimento, EsgInvestimentoCategoria, EsgDestinacaoMaterial, EsgReciclagemGas,
} from '@/lib/types'
import { Leaf, Fuel, Hammer, Recycle, Wind, Plus, Pencil, Trash2, X, BarChart3 } from 'lucide-react'

type Tab = 'combustivel' | 'investimentos' | 'destinacao' | 'gas' | 'relatorios'

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtDate(d?: string | null) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—' }
function fmtNum(v: number) { return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) }
function mesLabel(ym: string) {
  const [ano, mes] = ym.split('-')
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${meses[parseInt(mes) - 1]}/${ano.slice(2)}`
}

const CATEGORIA_COLOR: Record<EsgInvestimentoCategoria, string> = {
  Ambiental: 'bg-[#D1FAE5] text-[#059669]',
  Social: 'bg-[#EEF2FF] text-[#4F7CFF]',
  Ferramental: 'bg-[#FEF3C7] text-[#D97706]',
  SST: 'bg-[#FCE7F3] text-[#DB2777]',
}

// ── Componentes de gráfico (sem libs externas) ─────────
const PALETTE = ['#4F7CFF', '#10B981', '#F59E0B', '#DB2777', '#7C3AED', '#06B6D4', '#EF4444', '#94A3B8', '#84CC16', '#F472B6']

function ReportBarList({ items, format }: { items: { label: string; value: number }[]; format: (v: number) => string }) {
  const max = Math.max(...items.map(i => i.value), 1)
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={it.label}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[#374151] font-medium truncate">{it.label}</span>
            <span className="text-[#0F172A] font-semibold shrink-0 ml-2">{format(it.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function ReportDonut({ items, format }: { items: { label: string; value: number }[]; format: (v: number) => string }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1
  let acc = 0
  const stops = items.map((it, i) => {
    const start = (acc / total) * 100
    acc += it.value
    const end = (acc / total) * 100
    return `${PALETTE[i % PALETTE.length]} ${start}% ${end}%`
  })
  return (
    <div className="flex items-center gap-6 flex-wrap">
      <div className="w-36 h-36 rounded-full shrink-0" style={{ background: `conic-gradient(${stops.join(', ')})` }}>
        <div className="w-full h-full rounded-full flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-white flex flex-col items-center justify-center">
            <span className="text-[10px] text-[#94A3B8]">Total</span>
            <span className="text-xs font-bold text-[#0F172A]">{format(total)}</span>
          </div>
        </div>
      </div>
      <div className="space-y-1.5 min-w-0">
        {items.map((it, i) => (
          <div key={it.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
            <span className="text-[#374151] truncate">{it.label}</span>
            <span className="text-[#94A3B8] shrink-0">{((it.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReportCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="font-syne font-semibold text-[#0F172A] mb-4 text-sm">{title}</h3>
      {children}
    </div>
  )
}

function agruparPorMes<T>(items: T[], getData: (i: T) => string, getValor: (i: T) => number) {
  const map = new Map<string, number>()
  for (const it of items) {
    const ym = getData(it).slice(0, 7)
    map.set(ym, (map.get(ym) ?? 0) + getValor(it))
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([ym, v]) => ({ label: mesLabel(ym), value: v }))
}

// ── Aba Combustível ────────────────────────────────────
function ModalCombustivel({ entity, veiculos, onClose, onSaved }: {
  entity?: EsgCombustivel | null
  veiculos: { id: string; nome: string; placa: string | null }[]
  onClose: () => void; onSaved: () => void
}) {
  const editing = !!entity
  const [data, setData] = useState(entity?.data ?? new Date().toISOString().split('T')[0])
  const [veiculoId, setVeiculoId] = useState(entity?.veiculo_id ?? '')
  const [combustivel, setCombustivel] = useState(entity?.combustivel ?? 'Gasolina')
  const [litros, setLitros] = useState(entity ? String(entity.litros) : '')
  const [valor, setValor] = useState(entity ? String(entity.valor) : '')
  const [observacoes, setObservacoes] = useState(entity?.observacoes ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function salvar() {
    setError('')
    if (!veiculoId) { setError('Selecione o veículo.'); return }
    if (!litros || parseFloat(litros) <= 0) { setError('Informe os litros.'); return }
    if (!valor || parseFloat(valor) <= 0) { setError('Informe o valor.'); return }
    setSaving(true)
    const payload = { data, veiculo_id: veiculoId, combustivel, litros: parseFloat(litros), valor: parseFloat(valor), observacoes: observacoes || null }
    const supabase = createClient()
    const { error: err } = editing
      ? await supabase.from('esg_combustivel').update(payload).eq('id', entity!.id)
      : await supabase.from('esg_combustivel').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-syne font-semibold text-[#0F172A]">{editing ? 'Editar abastecimento' : 'Novo abastecimento'}</h3>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Data *</label>
              <input type="date" className="field" value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Combustível *</label>
              <select className="field" value={combustivel} onChange={e => setCombustivel(e.target.value)}>
                <option value="Gasolina">Gasolina</option>
                <option value="Diesel">Diesel</option>
                <option value="Etanol">Etanol</option>
                <option value="GNV">GNV</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Veículo *</label>
            <select className="field" value={veiculoId} onChange={e => setVeiculoId(e.target.value)}>
              <option value="">Selecione...</option>
              {veiculos.map(v => <option key={v.id} value={v.id}>{v.nome}{v.placa ? ` — ${v.placa}` : ''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Litros *</label>
              <input type="number" min="0" step="any" className="field" value={litros} onChange={e => setLitros(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Valor (R$) *</label>
              <input type="number" min="0" step="any" className="field" value={valor} onChange={e => setValor(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Observações</label>
            <input className="field" value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#E2E8F0]">
          <button onClick={onClose} className="text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg px-3 py-1.5">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="btn-primary">{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

function AbaCombustivel() {
  const [registros, setRegistros] = useState<EsgCombustivel[]>([])
  const [veiculos, setVeiculos] = useState<{ id: string; nome: string; placa: string | null }[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<EsgCombustivel | null>(null)

  async function load() {
    const sb = createClient()
    const [{ data: r }, { data: v }] = await Promise.all([
      sb.from('esg_combustivel').select('*, veiculo:veiculos(id, nome, placa)').order('data', { ascending: false }),
      sb.from('veiculos').select('id, nome, placa').eq('ativo', true).order('nome'),
    ])
    setRegistros((r ?? []) as EsgCombustivel[])
    setVeiculos((v ?? []) as { id: string; nome: string; placa: string | null }[])
  }
  useEffect(() => { load() }, [])

  async function excluir(id: string) {
    if (!confirm('Excluir este abastecimento?')) return
    await createClient().from('esg_combustivel').delete().eq('id', id)
    load()
  }

  const totalLitros = registros.reduce((s, r) => s + r.litros, 0)
  const totalValor = registros.reduce((s, r) => s + r.valor, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card py-4">
          <p className="text-xs text-[#94A3B8]">Total de litros</p>
          <p className="text-xl font-syne font-bold text-[#0F172A] mt-1">{fmtNum(totalLitros)} L</p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-[#94A3B8]">Total gasto</p>
          <p className="text-xl font-syne font-bold text-[#4F7CFF] mt-1">{fmt(totalValor)}</p>
        </div>
        <div className="card py-4 hidden md:block">
          <p className="text-xs text-[#94A3B8]">Abastecimentos</p>
          <p className="text-xl font-syne font-bold text-[#0F172A] mt-1">{registros.length}</p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
          <h3 className="font-syne font-semibold text-[#0F172A]">Abastecimentos</h3>
          <button onClick={() => { setEditing(null); setShowModal(true) }} className="flex items-center gap-1 text-xs text-[#4F7CFF] hover:underline">
            <Plus size={13} /> Novo abastecimento
          </button>
        </div>
        {registros.length === 0 ? (
          <p className="text-sm text-[#94A3B8] text-center py-6">Nenhum abastecimento registrado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Data</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Veículo</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Combustível</th>
                  <th className="text-right text-xs font-semibold text-[#64748B] px-4 py-2.5">Litros</th>
                  <th className="text-right text-xs font-semibold text-[#64748B] px-4 py-2.5">Valor</th>
                  <th className="px-4 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {registros.map(r => (
                  <tr key={r.id} className="hover:bg-[#F8FAFC] group">
                    <td className="px-4 py-2.5 text-[#374151] whitespace-nowrap">{fmtDate(r.data)}</td>
                    <td className="px-4 py-2.5 text-[#0F172A] font-medium whitespace-nowrap">{r.veiculo?.nome ?? '—'}{r.veiculo?.placa ? ` — ${r.veiculo.placa}` : ''}</td>
                    <td className="px-4 py-2.5 text-[#64748B]">{r.combustivel}</td>
                    <td className="px-4 py-2.5 text-right text-[#374151] whitespace-nowrap">{fmtNum(r.litros)} L</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[#0F172A] whitespace-nowrap">{fmt(r.valor)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditing(r); setShowModal(true) }} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#4F7CFF]">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => excluir(r.id)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-[#94A3B8] hover:text-red-400">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ModalCombustivel entity={editing} veiculos={veiculos} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}

// ── Aba Investimentos (Melhorias) ──────────────────────
function ModalInvestimento({ entity, onClose, onSaved }: { entity?: EsgInvestimento | null; onClose: () => void; onSaved: () => void }) {
  const editing = !!entity
  const [data, setData] = useState(entity?.data ?? new Date().toISOString().split('T')[0])
  const [item, setItem] = useState(entity?.item ?? '')
  const [categoria, setCategoria] = useState<EsgInvestimentoCategoria>(entity?.categoria ?? 'Ambiental')
  const [quantidade, setQuantidade] = useState(entity ? String(entity.quantidade) : '1')
  const [valor, setValor] = useState(entity ? String(entity.valor) : '')
  const [observacoes, setObservacoes] = useState(entity?.observacoes ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function salvar() {
    setError('')
    if (!item.trim()) { setError('Informe o item.'); return }
    if (!valor || parseFloat(valor) < 0) { setError('Informe o valor.'); return }
    setSaving(true)
    const payload = { data, item: item.trim(), categoria, quantidade: parseFloat(quantidade) || 1, valor: parseFloat(valor), observacoes: observacoes || null }
    const supabase = createClient()
    const { error: err } = editing
      ? await supabase.from('esg_investimentos').update(payload).eq('id', entity!.id)
      : await supabase.from('esg_investimentos').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-syne font-semibold text-[#0F172A]">{editing ? 'Editar investimento' : 'Novo investimento'}</h3>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Data *</label>
              <input type="date" className="field" value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Categoria *</label>
              <select className="field" value={categoria} onChange={e => setCategoria(e.target.value as EsgInvestimentoCategoria)}>
                <option value="Ambiental">Ambiental</option>
                <option value="Social">Social</option>
                <option value="Ferramental">Ferramental</option>
                <option value="SST">SST</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Item *</label>
            <input className="field" value={item} onChange={e => setItem(e.target.value)} placeholder="Ex: Cilindro para gás recolhedora 50L" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Quantidade</label>
              <input type="number" min="0" step="any" className="field" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Valor (R$) *</label>
              <input type="number" min="0" step="any" className="field" value={valor} onChange={e => setValor(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Observações</label>
            <input className="field" value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#E2E8F0]">
          <button onClick={onClose} className="text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg px-3 py-1.5">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="btn-primary">{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

function AbaInvestimentos() {
  const [registros, setRegistros] = useState<EsgInvestimento[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<EsgInvestimento | null>(null)

  async function load() {
    const { data } = await createClient().from('esg_investimentos').select('*').order('data', { ascending: false })
    setRegistros((data ?? []) as EsgInvestimento[])
  }
  useEffect(() => { load() }, [])

  async function excluir(id: string) {
    if (!confirm('Excluir este investimento?')) return
    await createClient().from('esg_investimentos').delete().eq('id', id)
    load()
  }

  const porCategoria = (['Ambiental', 'Social', 'Ferramental', 'SST'] as const).map(cat => ({
    categoria: cat, total: registros.filter(r => r.categoria === cat).reduce((s, r) => s + r.valor, 0),
  }))
  const totalGeral = registros.reduce((s, r) => s + r.valor, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {porCategoria.map(c => (
          <div key={c.categoria} className="card py-4">
            <p className="text-xs text-[#94A3B8]">{c.categoria}</p>
            <p className="text-lg font-syne font-bold text-[#0F172A] mt-1">{fmt(c.total)}</p>
          </div>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
          <h3 className="font-syne font-semibold text-[#0F172A]">Investimentos (melhorias) · {fmt(totalGeral)}</h3>
          <button onClick={() => { setEditing(null); setShowModal(true) }} className="flex items-center gap-1 text-xs text-[#4F7CFF] hover:underline">
            <Plus size={13} /> Novo investimento
          </button>
        </div>
        {registros.length === 0 ? (
          <p className="text-sm text-[#94A3B8] text-center py-6">Nenhum investimento registrado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Data</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Categoria</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Item</th>
                  <th className="text-right text-xs font-semibold text-[#64748B] px-4 py-2.5">Qtd</th>
                  <th className="text-right text-xs font-semibold text-[#64748B] px-4 py-2.5">Valor</th>
                  <th className="px-4 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {registros.map(r => (
                  <tr key={r.id} className="hover:bg-[#F8FAFC] group">
                    <td className="px-4 py-2.5 text-[#374151] whitespace-nowrap">{fmtDate(r.data)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORIA_COLOR[r.categoria]}`}>{r.categoria}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[#0F172A] font-medium">{r.item}</td>
                    <td className="px-4 py-2.5 text-right text-[#374151] whitespace-nowrap">{fmtNum(r.quantidade)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[#0F172A] whitespace-nowrap">{fmt(r.valor)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditing(r); setShowModal(true) }} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#4F7CFF]">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => excluir(r.id)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-[#94A3B8] hover:text-red-400">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ModalInvestimento entity={editing} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}

// ── Aba Destinação dos Materiais ───────────────────────
function ModalDestinacao({ entity, onClose, onSaved }: { entity?: EsgDestinacaoMaterial | null; onClose: () => void; onSaved: () => void }) {
  const editing = !!entity
  const [data, setData] = useState(entity?.data ?? new Date().toISOString().split('T')[0])
  const [cliente, setCliente] = useState(entity?.cliente ?? '')
  const [material, setMaterial] = useState(entity?.material ?? '')
  const [quantidade, setQuantidade] = useState(entity ? String(entity.quantidade) : '')
  const [valor, setValor] = useState(entity?.valor != null ? String(entity.valor) : '')
  const [observacoes, setObservacoes] = useState(entity?.observacoes ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function salvar() {
    setError('')
    if (!cliente.trim()) { setError('Informe o cliente.'); return }
    if (!material.trim()) { setError('Informe o material.'); return }
    if (!quantidade || parseFloat(quantidade) <= 0) { setError('Informe a quantidade.'); return }
    setSaving(true)
    const payload = {
      data, cliente: cliente.trim(), material: material.trim(), quantidade: parseFloat(quantidade),
      valor: valor ? parseFloat(valor) : null, observacoes: observacoes || null,
    }
    const supabase = createClient()
    const { error: err } = editing
      ? await supabase.from('esg_destinacao_materiais').update(payload).eq('id', entity!.id)
      : await supabase.from('esg_destinacao_materiais').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-syne font-semibold text-[#0F172A]">{editing ? 'Editar destinação' : 'Nova destinação'}</h3>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Data *</label>
              <input type="date" className="field" value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Material *</label>
              <input className="field" value={material} onChange={e => setMaterial(e.target.value)} placeholder="Ex: Ferro, Cobre..." />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Cliente / Destino *</label>
            <input className="field" value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Ex: Globo Participações" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Quantidade (kg) *</label>
              <input type="number" min="0" step="any" className="field" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Valor recebido (R$)</label>
              <input type="number" min="0" step="any" className="field" value={valor} onChange={e => setValor(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Observações</label>
            <input className="field" value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#E2E8F0]">
          <button onClick={onClose} className="text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg px-3 py-1.5">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="btn-primary">{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

function AbaDestinacaoMateriais() {
  const [registros, setRegistros] = useState<EsgDestinacaoMaterial[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<EsgDestinacaoMaterial | null>(null)

  async function load() {
    const { data } = await createClient().from('esg_destinacao_materiais').select('*').order('data', { ascending: false })
    setRegistros((data ?? []) as EsgDestinacaoMaterial[])
  }
  useEffect(() => { load() }, [])

  async function excluir(id: string) {
    if (!confirm('Excluir esta destinação?')) return
    await createClient().from('esg_destinacao_materiais').delete().eq('id', id)
    load()
  }

  const totalKg = registros.reduce((s, r) => s + r.quantidade, 0)
  const totalValor = registros.reduce((s, r) => s + (r.valor || 0), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card py-4">
          <p className="text-xs text-[#94A3B8]">Total destinado</p>
          <p className="text-xl font-syne font-bold text-[#0F172A] mt-1">{fmtNum(totalKg)} kg</p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-[#94A3B8]">Valor recebido</p>
          <p className="text-xl font-syne font-bold text-[#10B981] mt-1">{fmt(totalValor)}</p>
        </div>
        <div className="card py-4 hidden md:block">
          <p className="text-xs text-[#94A3B8]">Registros</p>
          <p className="text-xl font-syne font-bold text-[#0F172A] mt-1">{registros.length}</p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
          <h3 className="font-syne font-semibold text-[#0F172A]">Destinação dos materiais</h3>
          <button onClick={() => { setEditing(null); setShowModal(true) }} className="flex items-center gap-1 text-xs text-[#4F7CFF] hover:underline">
            <Plus size={13} /> Nova destinação
          </button>
        </div>
        {registros.length === 0 ? (
          <p className="text-sm text-[#94A3B8] text-center py-6">Nenhuma destinação registrada</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Data</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Material</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Cliente / Destino</th>
                  <th className="text-right text-xs font-semibold text-[#64748B] px-4 py-2.5">Quantidade</th>
                  <th className="text-right text-xs font-semibold text-[#64748B] px-4 py-2.5">Valor</th>
                  <th className="px-4 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {registros.map(r => (
                  <tr key={r.id} className="hover:bg-[#F8FAFC] group">
                    <td className="px-4 py-2.5 text-[#374151] whitespace-nowrap">{fmtDate(r.data)}</td>
                    <td className="px-4 py-2.5 text-[#0F172A] font-medium">{r.material}</td>
                    <td className="px-4 py-2.5 text-[#64748B]">{r.cliente}</td>
                    <td className="px-4 py-2.5 text-right text-[#374151] whitespace-nowrap">{fmtNum(r.quantidade)} kg</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[#0F172A] whitespace-nowrap">{r.valor != null ? fmt(r.valor) : '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditing(r); setShowModal(true) }} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#4F7CFF]">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => excluir(r.id)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-[#94A3B8] hover:text-red-400">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ModalDestinacao entity={editing} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}

// ── Aba Reciclagem de Gás ──────────────────────────────
const TIPOS_GAS = ['R-410A', 'R-407C', 'R-22', 'R-32', 'R-134A']

function ModalReciclagemGas({ entity, contratos, onClose, onSaved }: {
  entity?: EsgReciclagemGas | null
  contratos: { id: string; numero_contrato: string | null; empresa?: { razao_social: string; apelido?: string | null } | null }[]
  onClose: () => void; onSaved: () => void
}) {
  const editing = !!entity
  const [data, setData] = useState(entity?.data ?? new Date().toISOString().split('T')[0])
  const [contratoId, setContratoId] = useState(entity?.manutencao_contrato_id ?? '')
  const [empresaEmissora, setEmpresaEmissora] = useState(entity?.empresa_emissora ?? '')
  const [tipoGas, setTipoGas] = useState(entity?.tipo_gas ?? '')
  const [quantidade, setQuantidade] = useState(entity ? String(entity.quantidade) : '')
  const [valorRecebido, setValorRecebido] = useState(entity?.valor_recebido != null ? String(entity.valor_recebido) : '')
  const [observacoes, setObservacoes] = useState(entity?.observacoes ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function selecionarContrato(id: string) {
    setContratoId(id)
    const c = contratos.find(c => c.id === id)
    if (c) setEmpresaEmissora(c.empresa?.apelido || c.empresa?.razao_social || '')
  }

  async function salvar() {
    setError('')
    if (!empresaEmissora.trim()) { setError('Informe a empresa emissora.'); return }
    if (!tipoGas.trim()) { setError('Informe o tipo de gás.'); return }
    if (!quantidade || parseFloat(quantidade) <= 0) { setError('Informe a quantidade.'); return }
    setSaving(true)
    const payload = {
      data, manutencao_contrato_id: contratoId || null, empresa_emissora: empresaEmissora.trim(),
      tipo_gas: tipoGas.trim(), quantidade: parseFloat(quantidade),
      valor_recebido: valorRecebido ? parseFloat(valorRecebido) : null, observacoes: observacoes || null,
    }
    const supabase = createClient()
    const { error: err } = editing
      ? await supabase.from('esg_reciclagem_gas').update(payload).eq('id', entity!.id)
      : await supabase.from('esg_reciclagem_gas').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-syne font-semibold text-[#0F172A]">{editing ? 'Editar reciclagem de gás' : 'Nova reciclagem de gás'}</h3>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Data *</label>
              <input type="date" className="field" value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Tipo de gás *</label>
              <input className="field" list="tipos-gas" value={tipoGas} onChange={e => setTipoGas(e.target.value)} placeholder="Ex: R-410A" />
              <datalist id="tipos-gas">{TIPOS_GAS.map(t => <option key={t} value={t} />)}</datalist>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Contrato de manutenção (opcional)</label>
            <select className="field" value={contratoId} onChange={e => selecionarContrato(e.target.value)}>
              <option value="">Nenhum / cliente avulso</option>
              {contratos.map(c => (
                <option key={c.id} value={c.id}>
                  {(c.empresa?.apelido || c.empresa?.razao_social || 'Sem empresa')}{c.numero_contrato ? ` · ${c.numero_contrato}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Empresa emissora *</label>
            <input className="field" value={empresaEmissora} onChange={e => setEmpresaEmissora(e.target.value)} placeholder="Nome da empresa" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Quantidade (kg) *</label>
              <input type="number" min="0" step="any" className="field" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Valor recebido (R$)</label>
              <input type="number" min="0" step="any" className="field" value={valorRecebido} onChange={e => setValorRecebido(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Observações</label>
            <input className="field" value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#E2E8F0]">
          <button onClick={onClose} className="text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg px-3 py-1.5">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="btn-primary">{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

function AbaReciclagemGas() {
  const [registros, setRegistros] = useState<EsgReciclagemGas[]>([])
  const [contratos, setContratos] = useState<{ id: string; numero_contrato: string | null; empresa?: { razao_social: string; apelido?: string | null } | null }[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<EsgReciclagemGas | null>(null)

  async function load() {
    const sb = createClient()
    const [{ data: r }, { data: c }] = await Promise.all([
      sb.from('esg_reciclagem_gas').select('*, contrato:contratos_manutencao(id, numero_contrato, empresa:empresas(razao_social, apelido))').order('data', { ascending: false }),
      sb.from('contratos_manutencao').select('id, numero_contrato, empresa:empresas(razao_social, apelido)').eq('ativo', true),
    ])
    setRegistros((r ?? []) as EsgReciclagemGas[])
    setContratos((c ?? []) as any)
  }
  useEffect(() => { load() }, [])

  async function excluir(id: string) {
    if (!confirm('Excluir este registro?')) return
    await createClient().from('esg_reciclagem_gas').delete().eq('id', id)
    load()
  }

  const totalKg = registros.reduce((s, r) => s + r.quantidade, 0)
  const totalValor = registros.reduce((s, r) => s + (r.valor_recebido || 0), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card py-4">
          <p className="text-xs text-[#94A3B8]">Gás reciclado</p>
          <p className="text-xl font-syne font-bold text-[#0F172A] mt-1">{fmtNum(totalKg)} kg</p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-[#94A3B8]">Valor recebido</p>
          <p className="text-xl font-syne font-bold text-[#10B981] mt-1">{fmt(totalValor)}</p>
        </div>
        <div className="card py-4 hidden md:block">
          <p className="text-xs text-[#94A3B8]">Registros</p>
          <p className="text-xl font-syne font-bold text-[#0F172A] mt-1">{registros.length}</p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
          <h3 className="font-syne font-semibold text-[#0F172A]">Reciclagem de gás refrigerante</h3>
          <button onClick={() => { setEditing(null); setShowModal(true) }} className="flex items-center gap-1 text-xs text-[#4F7CFF] hover:underline">
            <Plus size={13} /> Novo registro
          </button>
        </div>
        {registros.length === 0 ? (
          <p className="text-sm text-[#94A3B8] text-center py-6">Nenhum registro ainda</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Data</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Tipo de gás</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Empresa emissora</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Contrato</th>
                  <th className="text-right text-xs font-semibold text-[#64748B] px-4 py-2.5">Quantidade</th>
                  <th className="text-right text-xs font-semibold text-[#64748B] px-4 py-2.5">Valor recebido</th>
                  <th className="px-4 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {registros.map(r => (
                  <tr key={r.id} className="hover:bg-[#F8FAFC] group">
                    <td className="px-4 py-2.5 text-[#374151] whitespace-nowrap">{fmtDate(r.data)}</td>
                    <td className="px-4 py-2.5 text-[#0F172A] font-medium whitespace-nowrap">{r.tipo_gas}</td>
                    <td className="px-4 py-2.5 text-[#64748B]">{r.empresa_emissora}</td>
                    <td className="px-4 py-2.5 text-[#94A3B8]">{r.contrato?.numero_contrato ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-[#374151] whitespace-nowrap">{fmtNum(r.quantidade)} kg</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[#0F172A] whitespace-nowrap">{r.valor_recebido != null ? fmt(r.valor_recebido) : '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditing(r); setShowModal(true) }} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#4F7CFF]">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => excluir(r.id)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-[#94A3B8] hover:text-red-400">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ModalReciclagemGas entity={editing} contratos={contratos} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}

// ── Relatórios ──────────────────────────────────────────
const FATORES_CO2: Record<string, number> = { gasolina: 2.212, diesel: 2.603, etanol: 1.500, gnv: 2.050 }
function fatorCo2(combustivel: string) {
  return FATORES_CO2[combustivel.trim().toLowerCase()] ?? 2.3
}

function RelatorioCo2() {
  const [registros, setRegistros] = useState<EsgCombustivel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient().from('esg_combustivel').select('*, veiculo:veiculos(id, nome, placa)').order('data')
      .then(({ data }) => { setRegistros((data ?? []) as EsgCombustivel[]); setLoading(false) })
  }, [])

  if (loading) return <p className="text-sm text-[#94A3B8] text-center py-10">Carregando...</p>
  if (registros.length === 0) return <p className="text-sm text-[#94A3B8] text-center py-10">Sem abastecimentos registrados ainda.</p>

  const comCo2 = registros.map(r => ({ ...r, co2: r.litros * fatorCo2(r.combustivel) }))
  const totalCo2 = comCo2.reduce((s, r) => s + r.co2, 0)
  const totalLitros = registros.reduce((s, r) => s + r.litros, 0)
  const totalValor = registros.reduce((s, r) => s + r.valor, 0)

  const meses = new Set(registros.map(r => r.data.slice(0, 7))).size || 1
  const mediaMensal = totalCo2 / meses

  const porCombustivel = [...new Set(registros.map(r => r.combustivel))].map(c => ({
    label: c, value: comCo2.filter(r => r.combustivel === c).reduce((s, r) => s + r.litros, 0),
  })).sort((a, b) => b.value - a.value)

  const co2PorCombustivel = [...new Set(registros.map(r => r.combustivel))].map(c => ({
    label: c, value: comCo2.filter(r => r.combustivel === c).reduce((s, r) => s + r.co2, 0),
  })).sort((a, b) => b.value - a.value)

  const porVeiculo = [...new Map(registros.map(r => [r.veiculo?.id ?? r.id, r.veiculo?.nome ?? '—'])).entries()]
    .map(([id, nome]) => ({ label: nome, value: registros.filter(r => (r.veiculo?.id ?? r.id) === id).reduce((s, r) => s + r.litros, 0) }))
    .sort((a, b) => b.value - a.value)

  const evolucaoMensal = agruparPorMes(comCo2, r => r.data, r => r.co2)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card py-4">
          <p className="text-xs text-[#94A3B8]">Emissão total de CO2</p>
          <p className="text-lg font-syne font-bold text-[#0F172A] mt-1">{fmtNum(totalCo2)} kg</p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-[#94A3B8]">Média mensal</p>
          <p className="text-lg font-syne font-bold text-[#0F172A] mt-1">{fmtNum(mediaMensal)} kg</p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-[#94A3B8]">Total de litros</p>
          <p className="text-lg font-syne font-bold text-[#4F7CFF] mt-1">{fmtNum(totalLitros)} L</p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-[#94A3B8]">Total gasto</p>
          <p className="text-lg font-syne font-bold text-[#10B981] mt-1">{fmt(totalValor)}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ReportCard title="Litros por combustível">
          <ReportBarList items={porCombustivel} format={v => `${fmtNum(v)} L`} />
        </ReportCard>
        <ReportCard title="Emissão de CO2 por combustível">
          <ReportDonut items={co2PorCombustivel} format={v => `${fmtNum(v)} kg`} />
        </ReportCard>
        <ReportCard title="Consumo de litros por veículo">
          <ReportBarList items={porVeiculo} format={v => `${fmtNum(v)} L`} />
        </ReportCard>
        <ReportCard title="Evolução mensal de emissão de CO2">
          <ReportBarList items={evolucaoMensal} format={v => `${fmtNum(v)} kg`} />
        </ReportCard>
      </div>

      <p className="text-xs text-[#94A3B8] px-1">
        Fatores de emissão estimados (GHG Protocol Brasil): Gasolina 2,212 kgCO2/L · Diesel 2,603 kgCO2/L · Etanol 1,500 kgCO2/L · GNV 2,050 kgCO2/L.
      </p>
    </div>
  )
}

function RelatorioDestinacao() {
  const [registros, setRegistros] = useState<EsgDestinacaoMaterial[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient().from('esg_destinacao_materiais').select('*').order('data')
      .then(({ data }) => { setRegistros((data ?? []) as EsgDestinacaoMaterial[]); setLoading(false) })
  }, [])

  if (loading) return <p className="text-sm text-[#94A3B8] text-center py-10">Carregando...</p>
  if (registros.length === 0) return <p className="text-sm text-[#94A3B8] text-center py-10">Sem destinações registradas ainda.</p>

  const totalKg = registros.reduce((s, r) => s + r.quantidade, 0)
  const totalValor = registros.reduce((s, r) => s + (r.valor || 0), 0)

  const porMaterial = [...new Set(registros.map(r => r.material))].map(m => ({
    label: m, value: registros.filter(r => r.material === m).reduce((s, r) => s + r.quantidade, 0),
  })).sort((a, b) => b.value - a.value)

  const materialPredominante = porMaterial[0]?.label ?? '—'
  const evolucaoMensal = agruparPorMes(registros, r => r.data, r => r.quantidade)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card py-4">
          <p className="text-xs text-[#94A3B8]">Total destinado</p>
          <p className="text-lg font-syne font-bold text-[#0F172A] mt-1">{fmtNum(totalKg)} kg</p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-[#94A3B8]">Valor recebido</p>
          <p className="text-lg font-syne font-bold text-[#10B981] mt-1">{fmt(totalValor)}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-[#94A3B8]">Material predominante</p>
          <p className="text-lg font-syne font-bold text-[#0F172A] mt-1">{materialPredominante}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-[#94A3B8]">Registros</p>
          <p className="text-lg font-syne font-bold text-[#0F172A] mt-1">{registros.length}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ReportCard title="Quantidade por tipo de material">
          <ReportBarList items={porMaterial} format={v => `${fmtNum(v)} kg`} />
        </ReportCard>
        <ReportCard title="Distribuição por material">
          <ReportDonut items={porMaterial} format={v => `${fmtNum(v)} kg`} />
        </ReportCard>
        <ReportCard title="Evolução mensal de destinação">
          <ReportBarList items={evolucaoMensal} format={v => `${fmtNum(v)} kg`} />
        </ReportCard>
      </div>
    </div>
  )
}

function RelatorioInvestimentos() {
  const [registros, setRegistros] = useState<EsgInvestimento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient().from('esg_investimentos').select('*').order('data')
      .then(({ data }) => { setRegistros((data ?? []) as EsgInvestimento[]); setLoading(false) })
  }, [])

  if (loading) return <p className="text-sm text-[#94A3B8] text-center py-10">Carregando...</p>
  if (registros.length === 0) return <p className="text-sm text-[#94A3B8] text-center py-10">Sem investimentos registrados ainda.</p>

  const totalGeral = registros.reduce((s, r) => s + r.valor, 0)
  const porCategoria = (['Ambiental', 'Social', 'Ferramental', 'SST'] as const).map(cat => ({
    label: cat, value: registros.filter(r => r.categoria === cat).reduce((s, r) => s + r.valor, 0),
  })).sort((a, b) => b.value - a.value)

  const evolucaoMensal = agruparPorMes(registros, r => r.data, r => r.valor)

  const top5 = [...registros].sort((a, b) => b.valor - a.valor).slice(0, 5).map(r => ({ label: r.item, value: r.valor }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card py-4">
          <p className="text-xs text-[#94A3B8]">Total investido</p>
          <p className="text-lg font-syne font-bold text-[#0F172A] mt-1">{fmt(totalGeral)}</p>
        </div>
        {porCategoria.map(c => (
          <div key={c.label} className="card py-4">
            <p className="text-xs text-[#94A3B8]">{c.label}</p>
            <p className="text-lg font-syne font-bold text-[#0F172A] mt-1">{fmt(c.value)}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ReportCard title="Investimento por pilar ESG">
          <ReportBarList items={porCategoria} format={fmt} />
        </ReportCard>
        <ReportCard title="Distribuição por pilar ESG">
          <ReportDonut items={porCategoria} format={fmt} />
        </ReportCard>
        <ReportCard title="Evolução mensal de investimentos">
          <ReportBarList items={evolucaoMensal} format={fmt} />
        </ReportCard>
        <ReportCard title="Top 5 maiores investimentos">
          <ReportBarList items={top5} format={fmt} />
        </ReportCard>
      </div>
    </div>
  )
}

function AbaRelatorios() {
  const [sub, setSub] = useState<'co2' | 'destinacao' | 'investimentos'>('co2')

  const subTabs = [
    { key: 'co2' as const, label: 'Emissão de CO2' },
    { key: 'destinacao' as const, label: 'Destinação de Materiais' },
    { key: 'investimentos' as const, label: 'Investimentos' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto">
        {subTabs.map(t => (
          <button key={t.key} onClick={() => setSub(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap
              ${sub === t.key ? 'bg-[#0F172A] text-white' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {sub === 'co2' && <RelatorioCo2 />}
      {sub === 'destinacao' && <RelatorioDestinacao />}
      {sub === 'investimentos' && <RelatorioInvestimentos />}
    </div>
  )
}

// ── Página principal ──────────────────────────────────
export default function EsgPage() {
  const [tab, setTab] = useState<Tab>('combustivel')

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'combustivel', label: 'Combustível', icon: <Fuel size={15} /> },
    { key: 'investimentos', label: 'Investimentos', icon: <Hammer size={15} /> },
    { key: 'destinacao', label: 'Destinação de Materiais', icon: <Recycle size={15} /> },
    { key: 'gas', label: 'Reciclagem de Gás', icon: <Wind size={15} /> },
    { key: 'relatorios', label: 'Relatórios', icon: <BarChart3 size={15} /> },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <div className="bg-white border-b border-[#E2E8F0] px-4 md:px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D1FAE5] flex items-center justify-center shrink-0">
              <Leaf size={18} className="text-[#059669]" />
            </div>
            <div>
              <h1 className="font-syne font-bold text-xl text-[#0F172A]">ESG</h1>
              <p className="text-xs text-[#94A3B8]">Controles ambientais e sociais da empresa</p>
            </div>
          </div>

          <div className="flex gap-1 mt-4 overflow-x-auto">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap
                  ${tab === t.key ? 'bg-[#4F7CFF] text-white' : 'text-[#64748B] hover:bg-[#F1F5F9]'}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full">
        {tab === 'combustivel' && <AbaCombustivel />}
        {tab === 'investimentos' && <AbaInvestimentos />}
        {tab === 'destinacao' && <AbaDestinacaoMateriais />}
        {tab === 'gas' && <AbaReciclagemGas />}
        {tab === 'relatorios' && <AbaRelatorios />}
      </main>
    </div>
  )
}
