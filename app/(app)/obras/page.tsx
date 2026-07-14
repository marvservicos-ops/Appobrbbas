'use client'

import { useEffect, useState } from 'react'
import { Plus, Calendar, User, MoreVertical, AlertTriangle, CheckCircle2, Clock, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Obra, Cliente } from '@/lib/types'
import Topbar from '@/components/Topbar'
import StatusChip from '@/components/StatusChip'
import ModalNovaObra from '@/components/ModalNovaObra'
import Link from 'next/link'

function calcProgress(obra: Obra): number {
  if (!obra.data_inicio || !obra.previsao_termino) return 0
  const start = new Date(obra.data_inicio).getTime()
  const end = new Date(obra.previsao_termino).getTime()
  const now = Date.now()
  if (now >= end) return 100
  if (now <= start) return 0
  return Math.round(((now - start) / (end - start)) * 100)
}

function formatDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function ObrasPage() {
  const [obras, setObras] = useState<Obra[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const [obrasRes, clientesRes] = await Promise.all([
      supabase.from('obras').select('*, cliente:clientes(*)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('nome'),
    ])
    if (obrasRes.data) setObras(obrasRes.data as Obra[])
    if (clientesRes.data) setClientes(clientesRes.data as Cliente[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = obras.filter(o =>
    o.titulo.toLowerCase().includes(search.toLowerCase()) ||
    (o.cliente as Cliente | undefined)?.nome?.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: obras.length,
    orcamento: obras.filter(o => o.status === 'Em Orçamento').length,
    aprovada: obras.filter(o => o.status === 'Aprovada').length,
    andamento: obras.filter(o => o.status === 'Em Andamento').length,
    concluida: obras.filter(o => o.status === 'Concluída').length,
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar searchPlaceholder="Buscar obra ou cliente..." onSearch={setSearch} />

      <div className="p-4 md:p-6 flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex-1 min-w-0 pr-3">
            <h1 className="font-syne text-xl md:text-2xl font-bold text-[#0F172A]">Gestão de Obras</h1>
            <p className="text-xs md:text-sm text-[#64748B] mt-0.5 hidden sm:block">Monitore o progresso técnico e financeiro de todos os projetos em tempo real</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary shrink-0 text-sm px-3 py-2">
            <Plus size={15} />
            <span className="hidden sm:inline">Nova </span>Obra
          </button>
        </div>

        {/* Stats — barra compacta */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {[
            { label: 'Total', value: stats.total, icon: <TrendingUp size={13} />, color: 'text-[#0F172A]', bg: 'bg-[#F1F5F9]' },
            { label: 'Em orçamento', value: stats.orcamento, icon: <Clock size={13} />, color: 'text-slate-600', bg: 'bg-slate-100' },
            { label: 'Aprovadas', value: stats.aprovada, icon: <CheckCircle2 size={13} />, color: 'text-violet-700', bg: 'bg-violet-50' },
            { label: 'Em andamento', value: stats.andamento, icon: <Clock size={13} />, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Concluídas', value: stats.concluida, icon: <CheckCircle2 size={13} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(s => (
            <div key={s.label} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${s.bg}`}>
              <span className={s.color}>{s.icon}</span>
              <span className={`font-syne font-bold text-base ${s.color}`}>{s.value}</span>
              <span className="text-xs text-[#64748B]">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card animate-pulse h-44 bg-[#F1F5F9]" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(obra => {
                const progress = calcProgress(obra)
                const cliente = obra.cliente as Cliente | undefined
                return (
                  <Link key={obra.id} href={`/obras/${obra.id}`}>
                    <div className="card p-3 hover:border-[#4F7CFF]/30 hover:shadow-sm transition-all cursor-pointer group">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <StatusChip status={obra.status} />
                          {obra.tipo_servico && <span className="text-xs text-[#4F7CFF] bg-[#EEF2FF] px-1.5 py-0.5 rounded truncate">{obra.tipo_servico}</span>}
                        </div>
                        <button className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-[#F1F5F9] transition-all shrink-0" onClick={e => e.preventDefault()}>
                          <MoreVertical size={13} className="text-[#64748B]" />
                        </button>
                      </div>

                      <h3 className="font-syne font-semibold text-[#0F172A] text-sm mb-0.5 line-clamp-1">{obra.titulo}</h3>
                      {cliente && <p className="text-xs text-[#94A3B8] mb-2 truncate">{cliente.nome}</p>}

                      <div className="h-1 bg-[#F1F5F9] rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-1 rounded-full transition-all ${progress >= 100 ? 'bg-emerald-500' : progress > 70 ? 'bg-amber-400' : 'bg-[#4F7CFF]'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                        {obra.engenheiro_responsavel && (
                          <div className="flex items-center gap-1">
                            <User size={11} />
                            <span className="truncate max-w-[100px]">{obra.engenheiro_responsavel}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 ml-auto">
                          <span className="font-medium text-[#64748B]">{progress}%</span>
                          {obra.previsao_termino && <><span>·</span><Calendar size={11} /><span>{formatDate(obra.previsao_termino)}</span></>}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}

              {/* Empty state card */}
              <button onClick={() => setShowModal(true)} className="card p-3 border-dashed hover:border-[#4F7CFF] hover:bg-[#F8FAFF] transition-all flex flex-col items-center justify-center gap-2 min-h-[100px] group">
                <div className="w-8 h-8 rounded-full bg-[#EEF2FF] group-hover:bg-[#4F7CFF] flex items-center justify-center transition-colors">
                  <Plus size={16} className="text-[#4F7CFF] group-hover:text-white transition-colors" />
                </div>
                <p className="text-xs font-medium text-[#94A3B8]">Nova Obra</p>
              </button>
            </div>

            {filtered.length > 6 && (
              <div className="flex justify-center mt-6">
                <button className="btn-secondary">Ver mais obras ↓</button>
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <ModalNovaObra
          clientes={clientes}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
