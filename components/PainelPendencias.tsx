'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAccess } from '@/lib/useAccess'
import { mensagemErro } from '@/lib/erros'
import { calcularPendencias, type Pendencia, type Grupo, type IconePendencia } from '@/lib/pendencias'
import {
  Users, FileText, Send, DollarSign, Package, CalendarClock, Thermometer,
  CheckCircle2, ChevronRight, ChevronDown, Loader2, ClipboardCheck, Clock, Check, Undo2,
} from 'lucide-react'

// Painel que lista o que ficou sem lançar ou sem conferir — a regra fica em
// lib/pendencias.ts (compartilhada com o e-mail diário).

const ICONES: Record<IconePendencia, any> = {
  alocacao: Users, rdo: FileText, email: Send, financeiro: DollarSign,
  material: Package, cronograma: CalendarClock, manutencao: Thermometer, prazo: Clock,
}

const CHAVE_MINIMIZADO = 'pendencias-minimizado'

export default function PainelPendencias() {
  const { profile } = useAccess()
  const [pendencias, setPendencias] = useState<Pendencia[] | null>(null)
  const [minimizado, setMinimizado] = useState(false)
  const [verOk, setVerOk] = useState(false)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    try { setMinimizado(localStorage.getItem(CHAVE_MINIMIZADO) === '1') } catch {}
    calcularPendencias(createClient(), new Date()).then(setPendencias)
  }, [])

  function alternarMinimizado() {
    const novo = !minimizado
    setMinimizado(novo)
    try { localStorage.setItem(CHAVE_MINIMIZADO, novo ? '1' : '0') } catch {}
  }

  async function marcarOk(p: Pendencia, ok: boolean) {
    setSalvando(p.id); setErro(null)
    const sb = createClient()
    const { error } = ok
      ? await sb.from('pendencias_dispensadas').upsert({
          pendencia_id: p.id, chave: p.chave, titulo: p.titulo,
          dispensado_por: profile?.id ?? null, dispensado_por_nome: profile?.nome ?? null,
          created_at: new Date().toISOString(),
        })
      : await sb.from('pendencias_dispensadas').delete().eq('pendencia_id', p.id)
    setSalvando(null)
    if (error) { setErro(mensagemErro(error, 'Não foi possível salvar')); return }
    setPendencias(lista => lista?.map(x => x.id === p.id ? { ...x, dispensada: ok } : x) ?? null)
  }

  if (pendencias === null) return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 flex items-center gap-2 text-sm text-[#94A3B8]">
      <Loader2 size={15} className="animate-spin" /> Verificando pendências…
    </div>
  )

  const ativas = pendencias.filter(p => !p.dispensada)
  const dispensadas = pendencias.filter(p => p.dispensada)
  const lancar = ativas.filter(p => p.grupo === 'lancar').length
  const conferir = ativas.filter(p => p.grupo === 'conferir').length
  const emDia = ativas.length === 0

  const grupos: { key: Grupo; titulo: string; sub: string }[] = [
    { key: 'lancar', titulo: 'Falta lançar', sub: 'coisas que aconteceram e não estão no sistema' },
    { key: 'conferir', titulo: 'Falta conferir', sub: 'dados que provavelmente estão desatualizados' },
  ]

  const linha = (p: Pendencia) => {
    const Icone = ICONES[p.icone]
    const alta = p.gravidade === 'alta'
    return (
      <div key={p.id} className={`flex items-start gap-1 pr-3 hover:bg-[#F8FAFC] transition-colors group ${p.dispensada ? 'opacity-60' : ''}`}>
        <Link href={p.href} className="flex flex-1 min-w-0 items-start gap-3 pl-5 py-3">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${p.dispensada ? 'bg-[#F1F5F9]' : alta ? 'bg-red-50' : 'bg-amber-50'}`}>
            <Icone size={14} className={p.dispensada ? 'text-[#94A3B8]' : alta ? 'text-red-500' : 'text-amber-500'} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#0F172A]">{p.titulo}</p>
            {p.detalhe && <p className="text-xs text-[#64748B] mt-0.5">{p.detalhe}</p>}
          </div>
          <ChevronRight size={14} className="text-[#CBD5E1] group-hover:text-[#4F7CFF] mt-1.5 shrink-0" />
        </Link>
        <button
          onClick={() => marcarOk(p, !p.dispensada)}
          disabled={salvando === p.id}
          title={p.dispensada ? 'Voltar a mostrar esta pendência' : 'Está ok — esconder até a situação mudar'}
          className={`mt-2.5 shrink-0 flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg border transition-colors ${p.dispensada
            ? 'border-[#E2E8F0] text-[#64748B] hover:border-[#4F7CFF] hover:text-[#4F7CFF]'
            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
          {salvando === p.id ? <Loader2 size={12} className="animate-spin" /> : p.dispensada ? <Undo2 size={12} /> : <Check size={12} />}
          {p.dispensada ? 'Desfazer' : 'Está ok'}
        </button>
      </div>
    )
  }

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden ${emDia ? 'border-emerald-200' : 'border-amber-200'}`}>
      <button onClick={alternarMinimizado}
        className={`w-full flex items-center gap-2 px-5 py-4 text-left ${minimizado ? '' : 'border-b'} ${emDia ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50/60 border-amber-100'}`}>
        {emDia ? <CheckCircle2 size={16} className="text-emerald-600" /> : <ClipboardCheck size={16} className="text-amber-600" />}
        <h2 className="font-syne font-semibold text-[#0F172A] text-sm">{emDia ? 'Pendências — tudo em dia' : 'Pendências'}</h2>
        {!emDia && <span className="text-[11px] font-bold bg-amber-500 text-white rounded-full px-2 py-0.5">{ativas.length}</span>}
        {minimizado && !emDia && (
          <span className="text-xs text-[#64748B] truncate">{lancar} para lançar · {conferir} para conferir</span>
        )}
        <span className="ml-auto flex items-center gap-1 text-xs text-[#64748B] shrink-0">
          {minimizado ? 'Mostrar' : 'Minimizar'}
          <ChevronDown size={15} className={`transition-transform ${minimizado ? '' : 'rotate-180'}`} />
        </span>
      </button>

      {!minimizado && (
        <>
          {erro && <p className="px-5 pt-3 text-xs text-red-600">{erro}</p>}
          {!emDia && (
            <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x divide-[#F1F5F9]">
              {grupos.map(g => {
                const itens = ativas.filter(p => p.grupo === g.key)
                return (
                  <div key={g.key}>
                    <div className="px-5 pt-4 pb-2">
                      <p className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide">{g.titulo} <span className="text-[#94A3B8]">({itens.length})</span></p>
                      <p className="text-[11px] text-[#94A3B8]">{g.sub}</p>
                    </div>
                    {itens.length === 0 && (
                      <p className="px-5 pb-4 text-xs text-emerald-600 flex items-center gap-1.5"><CheckCircle2 size={13} /> Nada pendente</p>
                    )}
                    <div className="divide-y divide-[#F8FAFC]">{itens.map(linha)}</div>
                  </div>
                )
              })}
            </div>
          )}
          {emDia && <p className="px-5 py-4 text-xs text-emerald-700">Nenhum lançamento ou conferência pendente.</p>}

          {dispensadas.length > 0 && (
            <div className="border-t border-[#F1F5F9]">
              <button onClick={() => setVerOk(v => !v)} className="w-full flex items-center gap-1.5 px-5 py-3 text-xs text-[#64748B] hover:text-[#4F7CFF]">
                <ChevronRight size={13} className={`transition-transform ${verOk ? 'rotate-90' : ''}`} />
                {dispensadas.length} marcada{dispensadas.length !== 1 ? 's' : ''} como ok
                <span className="text-[#94A3B8]">— voltam sozinhas se a situação mudar</span>
              </button>
              {verOk && <div className="divide-y divide-[#F8FAFC] pb-2">{dispensadas.map(linha)}</div>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
