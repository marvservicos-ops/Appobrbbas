'use client'

import { useEffect, useState } from 'react'
import { Plus, Package, Thermometer, Droplets, Shield, Sparkles, Shirt, ChevronRight, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Estoque } from '@/lib/types'
import Link from 'next/link'

const ICONE_MAP: Record<string, React.ReactNode> = {
  shield: <Shield size={22} />,
  sparkles: <Sparkles size={22} />,
  thermometer: <Thermometer size={22} />,
  shirt: <Shirt size={22} />,
  droplets: <Droplets size={22} />,
  package: <Package size={22} />,
}

export default function EstoquePage() {
  const [estoques, setEstoques] = useState<Estoque[]>([])
  const [loading, setLoading] = useState(true)
  const [showNovo, setShowNovo] = useState(false)
  const [contagens, setContagens] = useState<Record<string, number>>({})

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('estoques').select('*').order('created_at')
    setEstoques(data ?? [])

    if (data && data.length > 0) {
      const ids = data.map(e => e.id)
      const { data: regs } = await supabase
        .from('estoque_registros')
        .select('estoque_id')
        .in('estoque_id', ids)
      const map: Record<string, number> = {}
      for (const r of regs ?? []) {
        map[r.estoque_id] = (map[r.estoque_id] ?? 0) + 1
      }
      setContagens(map)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-syne font-bold text-2xl text-[#0F172A]">Estoques</h1>
          <p className="text-sm text-[#64748B] mt-1">Gerencie cada estoque separadamente</p>
        </div>
        <button onClick={() => setShowNovo(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Novo Estoque
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-[#4F7CFF]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {estoques.map(e => (
            <Link key={e.id} href={`/estoque/${e.id}`}
              className="card hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group block">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white"
                    style={{ backgroundColor: e.cor }}>
                    {ICONE_MAP[e.icone] ?? <Package size={22} />}
                  </div>
                  <div>
                    <h3 className="font-syne font-semibold text-[#0F172A]">{e.nome}</h3>
                    {e.descricao && <p className="text-xs text-[#64748B] mt-0.5">{e.descricao}</p>}
                  </div>
                </div>
                <ChevronRight size={16} className="text-[#94A3B8] group-hover:text-[#4F7CFF] transition-colors mt-1" />
              </div>
              <div className="mt-4 pt-4 border-t border-[#F1F5F9] flex items-center justify-between">
                <span className="text-xs text-[#64748B]">{contagens[e.id] ?? 0} registros</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: e.cor }}>
                  Ver →
                </span>
              </div>
            </Link>
          ))}

          <button onClick={() => setShowNovo(true)}
            className="card border-2 border-dashed border-[#E2E8F0] hover:border-[#4F7CFF] hover:bg-[#F8FAFF] transition-all flex flex-col items-center justify-center gap-2 min-h-[120px] text-[#94A3B8] hover:text-[#4F7CFF]">
            <Plus size={24} />
            <span className="text-sm font-medium">Criar novo estoque</span>
          </button>
        </div>
      )}

      {showNovo && <ModalNovoEstoque onClose={() => setShowNovo(false)} onCreated={() => { setShowNovo(false); load() }} />}
    </div>
  )
}

const ICONES = ['package', 'shield', 'sparkles', 'thermometer', 'shirt', 'droplets']
const CORES = ['#4F7CFF', '#F59E0B', '#2DD4BF', '#8B5CF6', '#06B6D4', '#EF4444', '#10B981', '#F97316']

function ModalNovoEstoque({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [cor, setCor] = useState('#4F7CFF')
  const [icone, setIcone] = useState('package')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('estoques').insert({ nome: nome.trim(), descricao: descricao || null, cor, icone })
    if (err) { setError(err.message); setLoading(false); return }
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">Novo Estoque</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome *</label>
            <input required className="field" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Material de Refrigeração" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Descrição</label>
            <input className="field" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Ícone</label>
            <div className="flex gap-2 flex-wrap">
              {ICONES.map(ic => (
                <button key={ic} type="button"
                  onClick={() => setIcone(ic)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 transition-colors ${icone === ic ? 'border-[#4F7CFF] bg-[#EEF2FF]' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'}`}
                  style={{ color: icone === ic ? '#4F7CFF' : '#64748B' }}>
                  {ICONE_MAP[ic]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {CORES.map(c => (
                <button key={c} type="button" onClick={() => setCor(c)}
                  className={`w-8 h-8 rounded-full border-4 transition-all ${cor === c ? 'border-white ring-2 ring-offset-1 ring-[#4F7CFF] scale-110' : 'border-white'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: cor }}>
              {ICONE_MAP[icone]}
            </div>
            <span className="font-syne font-semibold text-[#0F172A]">{nome || 'Nome do estoque'}</span>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Criando...' : 'Criar Estoque'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
