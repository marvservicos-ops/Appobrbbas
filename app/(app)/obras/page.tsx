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
    andamento: obras.filter(o => o.status === 'Em Andamento').length,
    paralisada: obras.filter(o => o.status === 'Paralisada').length,
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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#64748B]">Total de Projetos</span>
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <TrendingUp size={16} className="text-[#4F7CFF]" />
              </div>
            </div>
            <div className="font-syne text-3xl font-bold text-[#0F172A]">{stats.total}</div>
            <div className="text-xs text-[#64748B] mt-1">+2 este mês</div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#64748B]">Em Andamento</span>
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Clock size={16} className="text-[#4F7CFF]" />
              </div>
            </div>
            <div className="font-syne text-3xl font-bold text-[#4F7CFF]">{stats.andamento}</div>
            <div className="w-full h-1 bg-[#E2E8F0] rounded-full mt-3">
              <div className="h-1 bg-[#4F7CFF] rounded-full" style={{ width: stats.total ? `${(stats.andamento/stats.total)*100}%` : '0%' }} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#64748B]">Paralisadas</span>
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                <AlertTriangle size={16} className="text-amber-500" />
              </div>
            </div>
            <div className="font-syne text-3xl font-bold text-amber-500">{stats.paralisada}</div>
            <div className="text-xs text-amber-600 mt-1">Requer atenção imediata</div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#64748B]">Concluídas</span>
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                <CheckCircle2 size={16} className="text-emerald-500" />
              </div>
            </div>
            <div className="font-syne text-3xl font-bold text-emerald-600">{stats.concluida}</div>
            <div className="text-xs text-emerald-600 mt-1">Meta mensal atingida</div>
          </div>
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
                    <div className="card hover:border-[#4F7CFF]/30 hover:shadow-sm transition-all cursor-pointer group">
                      <div className="flex items-start justify-between mb-3">
                        <StatusChip status={obra.status} />
                        <button className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[#F1F5F9] transition-all" onClick={e => e.preventDefault()}>
                          <MoreVertical size={14} className="text-[#64748B]" />
                        </button>
                      </div>

                      <div className="mb-1">
                        <span className="text-xs font-medium text-[#4F7CFF] bg-[#EEF2FF] px-2 py-0.5 rounded">{obra.tipo_servico}</span>
                      </div>

                      <h3 className="font-syne font-semibold text-[#0F172A] text-sm mt-2 mb-1 line-clamp-2">{obra.titulo}</h3>
                      {cliente && <p className="text-xs text-[#64748B] mb-3">{cliente.nome}</p>}

                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-[#64748B] mb-1">
                          <span>Prazo</span>
                          <span className="font-medium">{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all ${progress >= 100 ? 'bg-emerald-500' : progress > 70 ? 'bg-amber-400' : 'bg-[#4F7CFF]'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[#64748B]">
                        {obra.engenheiro_responsavel && (
                          <div className="flex items-center gap-1">
                            <User size={12} />
                            <span className="truncate max-w-[100px]">{obra.engenheiro_responsavel}</span>
                          </div>
                        )}
                        {obra.previsao_termino && (
                          <div className="flex items-center gap-1 ml-auto">
                            <Calendar size={12} />
                            <span>{formatDate(obra.previsao_termino)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}

              {/* Empty state card */}
              <button onClick={() => setShowModal(true)} className="card border-dashed hover:border-[#4F7CFF] hover:bg-[#F8FAFF] transition-all flex flex-col items-center justify-center gap-3 min-h-[180px] group">
                <div className="w-10 h-10 rounded-full bg-[#EEF2FF] group-hover:bg-[#4F7CFF] flex items-center justify-center transition-colors">
                  <Plus size={20} className="text-[#4F7CFF] group-hover:text-white transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[#374151]">Novo Projeto</p>
                  <p className="text-xs text-[#94A3B8]">Clique para criar e configurar</p>
                </div>
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
