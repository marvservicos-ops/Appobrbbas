'use client'

// Solicitações de liberação de acesso (funcionários e/ou veículos) enviadas às
// gestoras. Cada uma pode ser editada, reenviada ou duplicada para outro período.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Pencil, Copy, Loader2, KeyRound, Search, Users, Car, CheckCircle2, FileClock, MapPin } from 'lucide-react'
import Topbar from '@/components/Topbar'
import { createClient } from '@/lib/supabase/client'
import { useAccess } from '@/lib/useAccess'
import { formatarData, hojeLocal } from '@/lib/datas'
import { mensagemErro } from '@/lib/erros'
import { textoPeriodo, tipoLiberacao, type Liberacao } from '@/lib/liberacoes'

export default function LiberacoesPage() {
  const router = useRouter()
  const { isAdmin, loading: accessLoading } = useAccess()
  const [lista, setLista] = useState<Liberacao[]>([])
  const [obras, setObras] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    if (!accessLoading && !isAdmin) router.replace('/obras')
  }, [isAdmin, accessLoading, router])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data, error }, { data: obs }] = await Promise.all([
        supabase.from('liberacoes').select('*').order('data_inicio', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('obras').select('id, titulo'),
      ])
      if (error) setErro(`${mensagemErro(error, 'Erro ao carregar as liberações')} Confira se a migração 2026_11_06_liberacoes.sql já foi rodada.`)
      setLista((data ?? []) as Liberacao[])
      setObras(Object.fromEntries((obs ?? []).map(o => [o.id, o.titulo])))
      setLoading(false)
    }
    load()
  }, [])

  const hoje = hojeLocal()
  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return lista
    return lista.filter(l =>
      [l.local_nome, l.local_endereco, l.local_cliente, l.obra_id ? obras[l.obra_id] : '', ...l.funcionarios.map(f => f.nome), ...l.veiculos.flatMap(v => [v.nome, v.placa])]
        .some(x => x?.toLowerCase().includes(t)))
  }, [lista, busca, obras])

  return (
    <div>
      <Topbar />
      <div className="p-4 md:p-6 max-w-5xl">
        <Link href="/funcionarios" className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A] mb-3">
          <ArrowLeft size={15} /> Funcionários
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="font-syne text-xl md:text-2xl font-bold text-[#0F172A]">Liberações de acesso</h1>
            <p className="text-xs md:text-sm text-[#64748B] mt-0.5">Pedidos de liberação de funcionários e veículos para as gestoras</p>
          </div>
          <Link href="/funcionarios/liberacoes/nova" className="btn-primary flex items-center gap-2 text-sm whitespace-nowrap">
            <Plus size={15} /> Nova solicitação
          </Link>
        </div>

        {erro && <p className="text-sm text-[#EF4444] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3 py-2 mb-4">{erro}</p>}

        {lista.length > 0 && (
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input className="field pl-8" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por local, funcionário ou placa" />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#4F7CFF]" /></div>
        ) : visiveis.length === 0 && !erro ? (
          <div className="card text-center py-12">
            <KeyRound size={28} className="mx-auto text-[#CBD5E1] mb-2" />
            <p className="text-sm text-[#64748B]">{busca ? 'Nada encontrado.' : 'Nenhuma solicitação de liberação ainda.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visiveis.map(l => {
              const vigente = l.status === 'enviada' && l.data_inicio <= hoje && l.data_fim >= hoje
              return (
                <div key={l.id} className="card flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0">
                    <KeyRound size={18} className="text-[#4F7CFF]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#0F172A] truncate">
                      {l.local_nome || (l.obra_id ? obras[l.obra_id] : '') || 'Sem local'}
                      <span className="text-[#64748B] font-normal"> · {tipoLiberacao(l)}</span>
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-[#64748B]">
                      <span>{textoPeriodo(l)}</span>
                      {l.funcionarios.length > 0 && <span className="inline-flex items-center gap-1"><Users size={11} /> {l.funcionarios.length}</span>}
                      {l.veiculos.length > 0 && <span className="inline-flex items-center gap-1"><Car size={11} /> {l.veiculos.map(v => v.placa || v.nome).join(', ')}</span>}
                      {!l.obra_id && <span className="inline-flex items-center gap-1"><MapPin size={11} /> Local avulso</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs">
                      {l.status === 'enviada' ? (
                        <span className="inline-flex items-center gap-1 text-[#059669]">
                          <CheckCircle2 size={12} /> Enviada {l.enviada_em ? `em ${formatarData(l.enviada_em)}` : ''}{l.envios > 1 ? ` (${l.envios} envios)` : ''}{l.enviada_por_nome ? ` por ${l.enviada_por_nome}` : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#B45309]"><FileClock size={12} /> Rascunho, não enviada</span>
                      )}
                      {vigente && <span className="text-[#4F7CFF] font-medium">Em vigor hoje</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/funcionarios/liberacoes/nova?duplicar=${l.id}`} title="Usar como base para uma nova solicitação"
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]">
                      <Copy size={13} /> Duplicar
                    </Link>
                    <Link href={`/funcionarios/liberacoes/${l.id}`}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-[#EEF2FF] text-[#4F7CFF] font-medium hover:bg-[#E0E7FF]">
                      <Pencil size={13} /> Abrir
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
