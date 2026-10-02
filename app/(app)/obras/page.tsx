'use client'

import { useEffect, useState } from 'react'
import { Plus, User, MoreVertical, Pencil, ChevronDown, ChevronRight, AlertTriangle, ArrowRight, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Obra, Cliente, StatusObra } from '@/lib/types'
import Topbar from '@/components/Topbar'
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

function isAtrasada(obra: Obra): boolean {
  if (obra.status === 'Concluída' || !obra.previsao_termino) return false
  return new Date(obra.previsao_termino).getTime() < Date.now()
}

const GRUPOS: { status: StatusObra; label: string; dot: string }[] = [
  { status: 'Em Andamento', label: 'Em andamento', dot: 'bg-blue-500' },
  { status: 'Aprovada', label: 'Aprovadas', dot: 'bg-violet-500' },
  { status: 'Em Orçamento', label: 'Em orçamento', dot: 'bg-slate-400' },
  { status: 'Concluída', label: 'Concluídas', dot: 'bg-emerald-500' },
]

// Atrasadas primeiro, depois término mais próximo; concluídas: término mais recente primeiro
function ordenar(lista: Obra[], status: StatusObra): Obra[] {
  const t = (o: Obra) => (o.previsao_termino ? new Date(o.previsao_termino).getTime() : null)
  return [...lista].sort((a, b) => {
    if (status === 'Concluída') return (t(b) ?? 0) - (t(a) ?? 0)
    const atrasoA = isAtrasada(a) ? 0 : 1
    const atrasoB = isAtrasada(b) ? 0 : 1
    if (atrasoA !== atrasoB) return atrasoA - atrasoB
    return (t(a) ?? Infinity) - (t(b) ?? Infinity)
  })
}

const STORAGE_KEY = 'obras:grupos-recolhidos'
const ROW_GRID = 'md:grid md:grid-cols-[minmax(0,2.6fr)_minmax(0,1.3fr)_minmax(0,1fr)_130px_110px_28px] md:gap-4 md:items-center'

export default function ObrasPage() {
  const [obras, setObras] = useState<Obra[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editObra, setEditObra] = useState<Obra | null>(null)
  const [menuObraId, setMenuObraId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [recolhidos, setRecolhidos] = useState<Record<string, boolean>>({ 'Concluída': true })

  async function load() {
    setLoading(true)
    const supabase = createClient()
    let { data, error } = await supabase
      .from('obras')
      .select('*, cliente:clientes!cliente_id(id, nome)')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('obras load error (com cliente):', error)
      ;({ data, error } = await supabase.from('obras').select('*').order('created_at', { ascending: false }))
      if (error) console.error('obras load error:', error)
    }
    if (data) setObras(data as Obra[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY)
      if (salvo) setRecolhidos(JSON.parse(salvo))
    } catch {}
  }, [])

  function toggleGrupo(status: StatusObra) {
    setRecolhidos(prev => {
      const next = { ...prev, [status]: !prev[status] }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  async function mudarStatus(obra: Obra, status: StatusObra) {
    setMenuObraId(null)
    const anterior = obra.status
    setObras(prev => prev.map(o => (o.id === obra.id ? { ...o, status } : o)))
    const supabase = createClient()
    const { error } = await supabase.from('obras').update({ status }).eq('id', obra.id)
    if (error) {
      console.error('mudar status error:', error)
      setObras(prev => prev.map(o => (o.id === obra.id ? { ...o, status: anterior } : o)))
      alert('Não foi possível mudar o status da obra.')
    }
  }

  const termo = search.toLowerCase()
  const filtered = obras.filter(o =>
    o.titulo.toLowerCase().includes(termo) ||
    (o.cliente as Cliente | undefined)?.nome?.toLowerCase().includes(termo) ||
    o.engenheiro_responsavel?.toLowerCase().includes(termo)
  )

  function renderObraRow(obra: Obra) {
    const progress = calcProgress(obra)
    const atrasada = isAtrasada(obra)
    const cliente = obra.cliente as Cliente | undefined
    const barColor = obra.status === 'Concluída' ? 'bg-emerald-500' : atrasada ? 'bg-red-400' : progress > 70 ? 'bg-amber-400' : 'bg-[#4F7CFF]'

    return (
      <Link key={obra.id} href={`/obras/${obra.id}`} className="block">
        <div className={`${ROW_GRID} px-4 py-3 border-t border-[#F1F5F9] hover:bg-[#F8FAFF] transition-colors cursor-pointer group`}>
          {/* Obra / cliente */}
          <div className="min-w-0 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-syne font-semibold text-[#0F172A] text-sm truncate">{obra.titulo}</p>
              <p className="text-xs text-[#94A3B8] truncate">
                {cliente?.nome ?? 'Sem cliente'}
                <span className="md:hidden">{obra.engenheiro_responsavel ? ` · ${obra.engenheiro_responsavel}` : ''}</span>
              </p>
            </div>
            <div className="relative md:hidden shrink-0">{renderMenuButton(obra)}</div>
          </div>

          {/* Tipo de serviço */}
          <div className="min-w-0 hidden md:block">
            {obra.tipo_servico && (
              <span className="block text-xs text-[#4F7CFF] bg-[#EEF2FF] px-1.5 py-0.5 rounded truncate w-fit max-w-full" title={obra.tipo_servico}>
                {obra.tipo_servico}
              </span>
            )}
          </div>

          {/* Responsável */}
          <div className="min-w-0 hidden md:flex items-center gap-1 text-xs text-[#64748B]">
            {obra.engenheiro_responsavel && (
              <>
                <User size={11} className="shrink-0 text-[#94A3B8]" />
                <span className="truncate">{obra.engenheiro_responsavel}</span>
              </>
            )}
          </div>

          {/* Prazo decorrido + término (no mobile ficam na mesma linha) */}
          <div className="flex items-center gap-3 mt-2 md:mt-0 md:contents">
            <div className="flex items-center gap-2 flex-1 md:flex-none">
              <div className="h-1 flex-1 bg-[#F1F5F9] rounded-full overflow-hidden">
                <div className={`h-1 rounded-full ${barColor}`} style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs font-medium text-[#64748B] w-9 text-right">{progress}%</span>
            </div>

            <div className={`flex items-center gap-1 text-xs whitespace-nowrap ${atrasada ? 'text-red-600 font-medium' : 'text-[#64748B]'}`}>
              {atrasada && <AlertTriangle size={12} />}
              {formatDate(obra.previsao_termino)}
            </div>
          </div>

          {/* Menu */}
          <div className="relative hidden md:block">{renderMenuButton(obra)}</div>
        </div>
      </Link>
    )
  }

  function renderMenuButton(obra: Obra) {
    return (
      <>
        <button
          className="w-7 h-7 flex items-center justify-center rounded md:opacity-0 group-hover:opacity-100 hover:bg-[#F1F5F9] transition-all"
          onClick={e => { e.preventDefault(); e.stopPropagation(); setMenuObraId(menuObraId === obra.id ? null : obra.id) }}
        >
          <MoreVertical size={14} className="text-[#64748B]" />
        </button>
        {menuObraId === obra.id && renderMenu(obra)}
      </>
    )
  }

  function renderMenu(obra: Obra) {
    return (
      <div
        className="absolute right-0 top-8 z-20 bg-white border border-[#E2E8F0] rounded-xl shadow-lg py-1 min-w-[190px]"
        onClick={e => { e.preventDefault(); e.stopPropagation() }}
      >
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F8FAFF] transition-colors"
          onClick={() => { setEditObra(obra); setMenuObraId(null) }}
        >
          <Pencil size={13} className="text-[#64748B]" />
          Editar obra
        </button>
        <div className="border-t border-[#F1F5F9] my-1" />
        <p className="px-3 pt-1 pb-1 text-[11px] font-medium text-[#94A3B8] uppercase tracking-wide">Mover para</p>
        {GRUPOS.map(g => {
          const atual = g.status === obra.status
          return (
            <button
              key={g.status}
              disabled={atual}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[#374151] hover:bg-[#F8FAFF] transition-colors disabled:text-[#94A3B8] disabled:hover:bg-transparent"
              onClick={() => mudarStatus(obra, g.status)}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${g.dot}`} />
              {g.status}
              {atual ? <Check size={13} className="ml-auto" /> : <ArrowRight size={13} className="ml-auto text-[#CBD5E1]" />}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" onClick={() => setMenuObraId(null)}>
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

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card animate-pulse h-32 bg-[#F1F5F9]" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {GRUPOS.map(g => {
              const lista = ordenar(filtered.filter(o => o.status === g.status), g.status)
              if (search && lista.length === 0) return null
              const recolhido = !search && !!recolhidos[g.status]
              const atrasadas = lista.filter(isAtrasada).length

              return (
                <section key={g.status} className="card p-0 md:p-0 [&>a:last-child>div]:rounded-b-xl">
                  <button
                    onClick={() => toggleGrupo(g.status)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
                  >
                    {recolhido ? <ChevronRight size={16} className="text-[#94A3B8]" /> : <ChevronDown size={16} className="text-[#94A3B8]" />}
                    <span className={`w-2 h-2 rounded-full ${g.dot}`} />
                    <span className="font-syne font-semibold text-sm text-[#0F172A]">{g.label}</span>
                    <span className="text-xs font-medium text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded-full">{lista.length}</span>
                    {atrasadas > 0 && (
                      <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        <AlertTriangle size={11} />
                        {atrasadas} {atrasadas === 1 ? 'atrasada' : 'atrasadas'}
                      </span>
                    )}
                  </button>

                  {!recolhido && (
                    lista.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-[#94A3B8] border-t border-[#F1F5F9]">Nenhuma obra {g.label.toLowerCase()}.</p>
                    ) : (
                      <>
                        <div className={`hidden ${ROW_GRID} px-4 pb-2 text-[11px] font-medium text-[#94A3B8] uppercase tracking-wide`}>
                          <div>Obra / cliente</div>
                          <div>Tipo de serviço</div>
                          <div>Responsável</div>
                          <div>Prazo decorrido</div>
                          <div>Término</div>
                          <div />
                        </div>
                        {lista.map(renderObraRow)}
                      </>
                    )
                  )}
                </section>
              )
            })}

            {search && filtered.length === 0 && (
              <p className="text-sm text-[#94A3B8] py-6 text-center">Nenhuma obra encontrada.</p>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <ModalNovaObra
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load() }}
        />
      )}
      {editObra && (
        <ModalNovaObra
          obra={editObra}
          onClose={() => setEditObra(null)}
          onCreated={() => { setEditObra(null); load() }}
        />
      )}
    </div>
  )
}
