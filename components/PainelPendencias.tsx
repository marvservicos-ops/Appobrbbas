'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Users, FileText, Send, DollarSign, Package, CalendarClock, Thermometer,
  CheckCircle2, ChevronRight, Loader2, ClipboardCheck, Clock,
} from 'lucide-react'

// Painel que cruza os dados do sistema e lista o que ficou sem lançar ou
// sem conferir — pra não depender de lembrar de abrir cada tela.

type Gravidade = 'alta' | 'media'
type Grupo = 'lancar' | 'conferir'

interface Pendencia {
  id: string
  grupo: Grupo
  gravidade: Gravidade
  icone: any
  titulo: string
  detalhe?: string
  href: string
}

const dataLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dataBR = (v: string) => new Date(v + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const diasEntre = (a: string, b: string) =>
  Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

/** Últimos `n` dias úteis (seg–sex) terminando em `ate`, do mais antigo pro mais recente. */
function ultimosDiasUteis(ate: Date, n: number) {
  const dias: string[] = []
  const d = new Date(ate)
  while (dias.length < n) {
    const dow = d.getDay()
    if (dow >= 1 && dow <= 5) dias.unshift(dataLocal(d))
    d.setDate(d.getDate() - 1)
  }
  return dias
}

export default function PainelPendencias() {
  const [pendencias, setPendencias] = useState<Pendencia[] | null>(null)

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const agora = new Date()
      const hoje = dataLocal(agora)
      const ontem = new Date(agora); ontem.setDate(agora.getDate() - 1)
      const diasAlocacao = ultimosDiasUteis(agora, 5)
      const ultimoDiaUtilAnterior = ultimosDiasUteis(ontem, 1)[0]
      const mesPassado = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)
      const competenciaAnterior = `${mesPassado.getFullYear()}-${String(mesPassado.getMonth() + 1).padStart(2, '0')}`
      const nomeMesAnterior = mesPassado.toLocaleDateString('pt-BR', { month: 'long' })

      const [
        { data: obras },
        { data: funcs },
        { data: alocs },
        { data: contratos },
      ] = await Promise.all([
        sb.from('obras').select('id, titulo, status, previsao_termino, diario_obra_id').eq('status', 'Em Andamento'),
        sb.from('funcionarios').select('id').eq('ativo', true),
        sb.from('funcionario_alocacoes').select('funcionario_id, data').gte('data', diasAlocacao[0]).lte('data', hoje),
        sb.from('contratos_manutencao').select('id, numero_contrato, empresa:empresas(razao_social, apelido)').eq('ativo', true),
      ])

      const obraIds = (obras ?? []).map(o => o.id)
      const contratoIds = (contratos ?? []).map(c => c.id)
      const vazio = Promise.resolve({ data: [] as any[] })

      const [
        { data: rdos },
        { data: threads },
        { data: medPlanejadas },
        { data: medFaturadas },
        { data: materiais },
        { data: etapas },
        { data: nfsManut },
        { data: equips },
      ] = await Promise.all([
        obraIds.length ? sb.from('diario_obra_relatorios').select('obra_id, data, importado_em').in('obra_id', obraIds) : vazio,
        obraIds.length ? sb.from('relatorio_email_threads').select('obra_id, updated_at').eq('tipo', 'rdo').in('obra_id', obraIds) : vazio,
        sb.from('obra_medicoes').select('id, obra_id, nome, data_prevista, obras:obra_id(titulo)').eq('status', 'planejada').lt('data_prevista', hoje),
        sb.from('obra_medicoes').select('id, obra_id, nome, data_vencimento, obras:obra_id(titulo)').eq('status', 'faturada').lt('data_vencimento', hoje),
        obraIds.length ? sb.from('obra_materiais').select('id, obra_id, status, oc_id, data_prevista_chegada').in('obra_id', obraIds) : vazio,
        obraIds.length ? sb.from('cronograma_etapas').select('id, obra_id, status, progresso, data_fim').in('obra_id', obraIds).lt('data_fim', hoje) : vazio,
        contratoIds.length ? sb.from('manutencao_nfs').select('contrato_id, status').eq('competencia', competenciaAnterior).in('contrato_id', contratoIds) : vazio,
        contratoIds.length ? sb.from('equipamentos').select('id, contrato_id').eq('ativo', true).in('contrato_id', contratoIds) : vazio,
      ])

      const equipIds = (equips ?? []).map((e: any) => e.id)
      const { data: historico } = equipIds.length
        ? await sb.from('manutencao_historico').select('equipamento_id').eq('competencia', competenciaAnterior).eq('preventiva_feita', true).in('equipamento_id', equipIds)
        : { data: [] as any[] }

      const lista: Pendencia[] = []
      const tituloObra = new Map((obras ?? []).map(o => [o.id, o.titulo as string]))

      // ── LANÇAR ────────────────────────────────────────────────

      // Alocação dos últimos dias úteis
      const totalFuncs = (funcs ?? []).length
      if (totalFuncs > 0) {
        const idsAtivos = new Set((funcs ?? []).map(f => f.id))
        const porDia = new Map<string, Set<string>>()
        for (const a of alocs ?? []) {
          if (!idsAtivos.has(a.funcionario_id)) continue
          if (!porDia.has(a.data)) porDia.set(a.data, new Set())
          porDia.get(a.data)!.add(a.funcionario_id)
        }
        const incompletosPassados = diasAlocacao.filter(d => d !== hoje && (porDia.get(d)?.size ?? 0) < totalFuncs)
        if (incompletosPassados.length > 0) {
          lista.push({
            id: 'aloc-atrasada', grupo: 'lancar', gravidade: 'alta', icone: Users,
            titulo: `Alocação incompleta em ${plural(incompletosPassados.length, 'dia', 'dias')}`,
            detalhe: incompletosPassados.map(d => `${dataBR(d)} (${totalFuncs - (porDia.get(d)?.size ?? 0)} sem lançar)`).join(' · '),
            href: '/funcionarios/alocacao',
          })
        }
        if (diasAlocacao.includes(hoje)) {
          const faltamHoje = totalFuncs - (porDia.get(hoje)?.size ?? 0)
          if (faltamHoje > 0) lista.push({
            id: 'aloc-hoje', grupo: 'lancar', gravidade: 'media', icone: Users,
            titulo: 'Alocação de hoje',
            detalhe: `${plural(faltamHoje, 'funcionário', 'funcionários')} sem lançamento`,
            href: '/funcionarios/alocacao',
          })
        }
      }

      // RDOs: obra em andamento sem relatório recente / sem vínculo com o Diário de Obra
      const ultimoRdo = new Map<string, { data: string | null; importado_em: string }>()
      for (const r of rdos ?? []) {
        const atual = ultimoRdo.get(r.obra_id)
        if (!atual || (r.data ?? '') > (atual.data ?? '')) ultimoRdo.set(r.obra_id, { data: r.data, importado_em: r.importado_em })
      }
      const semVinculo = (obras ?? []).filter(o => !o.diario_obra_id)
      if (semVinculo.length > 0) {
        lista.push({
          id: 'rdo-sem-vinculo', grupo: 'lancar', gravidade: 'media', icone: FileText,
          titulo: `${plural(semVinculo.length, 'obra em andamento', 'obras em andamento')} sem vínculo com o Diário de Obra`,
          detalhe: semVinculo.map(o => o.titulo).join(' · '),
          href: semVinculo.length === 1 ? `/obras/${semVinculo[0].id}?aba=relatorios` : '/obras',
        })
      }
      for (const o of obras ?? []) {
        if (!o.diario_obra_id) continue
        const ult = ultimoRdo.get(o.id)
        if (!ult?.data || ult.data < ultimoDiaUtilAnterior) {
          lista.push({
            id: `rdo-${o.id}`, grupo: 'lancar', gravidade: 'alta', icone: FileText,
            titulo: `Sem RDO recente — ${o.titulo}`,
            detalhe: ult?.data ? `Último RDO em ${dataBR(ult.data)} (há ${diasEntre(ult.data, hoje)} dias). Preencha no Diário de Obra e clique em "Sincronizar agora".` : 'Nenhum RDO sincronizado ainda.',
            href: `/obras/${o.id}?aba=relatorios`,
          })
        }
      }

      // Medições planejadas cuja data já passou (pedir/lançar)
      for (const m of medPlanejadas ?? []) {
        lista.push({
          id: `med-${m.id}`, grupo: 'lancar', gravidade: 'alta', icone: DollarSign,
          titulo: `Medição não solicitada — ${(m as any).obras?.titulo ?? ''}`,
          detalhe: `${m.nome} · prevista para ${dataBR(m.data_prevista)}`,
          href: `/obras/${m.obra_id}/financeiro`,
        })
      }

      // Materiais sem OC vinculada
      const semOc = new Map<string, number>()
      for (const m of materiais ?? []) if (!m.oc_id) semOc.set(m.obra_id, (semOc.get(m.obra_id) ?? 0) + 1)
      for (const [obraId, n] of Array.from(semOc)) {
        lista.push({
          id: `mat-oc-${obraId}`, grupo: 'lancar', gravidade: 'media', icone: Package,
          titulo: `Materiais sem OC — ${tituloObra.get(obraId)}`,
          detalhe: `${plural(n, 'material', 'materiais')} sem Ordem de Compra (não aparecem no Financeiro/Portal)`,
          href: `/obras/${obraId}?aba=materiais`,
        })
      }

      // Manutenções: NF e preventivas do mês anterior (a partir do dia 5)
      if (agora.getDate() >= 5) {
        const nfOk = new Set((nfsManut ?? []).filter((n: any) => n.status === 'emitida').map((n: any) => n.contrato_id))
        const prevFeitas = new Set((historico ?? []).map((h: any) => h.equipamento_id))
        for (const c of contratos ?? []) {
          const nome = (c as any).empresa?.apelido || (c as any).empresa?.razao_social || c.numero_contrato || 'Contrato'
          if (!nfOk.has(c.id)) lista.push({
            id: `nf-man-${c.id}`, grupo: 'lancar', gravidade: 'alta', icone: Thermometer,
            titulo: `NF de ${nomeMesAnterior} não emitida — ${nome}`,
            href: `/manutencoes/${c.id}`,
          })
          const equipsContrato = (equips ?? []).filter((e: any) => e.contrato_id === c.id)
          const faltando = equipsContrato.filter((e: any) => !prevFeitas.has(e.id)).length
          if (faltando > 0) lista.push({
            id: `prev-${c.id}`, grupo: 'lancar', gravidade: 'media', icone: Thermometer,
            titulo: `Preventivas de ${nomeMesAnterior} não marcadas — ${nome}`,
            detalhe: `${faltando} de ${plural(equipsContrato.length, 'equipamento', 'equipamentos')}`,
            href: `/manutencoes/${c.id}`,
          })
        }
      }

      // ── CONFERIR ──────────────────────────────────────────────

      // RDO sincronizado mas e-mail ainda não enviado
      const ultimoEnvio = new Map((threads ?? []).map((t: any) => [t.obra_id, t.updated_at as string]))
      for (const o of obras ?? []) {
        const ult = ultimoRdo.get(o.id)
        if (!ult) continue
        const envio = ultimoEnvio.get(o.id)
        if (!envio || ult.importado_em > envio) {
          lista.push({
            id: `rdo-email-${o.id}`, grupo: 'conferir', gravidade: 'media', icone: Send,
            titulo: `RDO não enviado por e-mail — ${o.titulo}`,
            detalhe: envio ? `Último envio em ${new Date(envio).toLocaleDateString('pt-BR')}` : 'Nenhum envio registrado',
            href: `/obras/${o.id}?aba=relatorios`,
          })
        }
      }

      // Medições faturadas vencidas sem recebimento
      for (const m of medFaturadas ?? []) {
        lista.push({
          id: `rec-${m.id}`, grupo: 'conferir', gravidade: 'alta', icone: DollarSign,
          titulo: `Pagamento vencido — ${(m as any).obras?.titulo ?? ''}`,
          detalhe: `${m.nome} · venceu em ${dataBR(m.data_vencimento)}. Recebeu? Marque como recebida; senão, cobre.`,
          href: `/obras/${m.obra_id}/financeiro`,
        })
      }

      // Materiais com chegada prevista vencida
      const atrasados = new Map<string, number>()
      for (const m of materiais ?? []) {
        if (['comprado', 'em_transito'].includes(m.status) && m.data_prevista_chegada && m.data_prevista_chegada < hoje)
          atrasados.set(m.obra_id, (atrasados.get(m.obra_id) ?? 0) + 1)
      }
      for (const [obraId, n] of Array.from(atrasados)) {
        lista.push({
          id: `mat-atr-${obraId}`, grupo: 'conferir', gravidade: 'media', icone: Package,
          titulo: `Material com chegada vencida — ${tituloObra.get(obraId)}`,
          detalhe: `${plural(n, 'item', 'itens')} ainda como comprado/em trânsito. Chegou? Atualize o status.`,
          href: `/obras/${obraId}?aba=materiais`,
        })
      }

      // Cronograma desatualizado
      const etapasVencidas = new Map<string, number>()
      for (const e of etapas ?? []) {
        if (e.status !== 'Concluída' && (e.progresso ?? 0) < 100)
          etapasVencidas.set(e.obra_id, (etapasVencidas.get(e.obra_id) ?? 0) + 1)
      }
      for (const [obraId, n] of Array.from(etapasVencidas)) {
        lista.push({
          id: `crono-${obraId}`, grupo: 'conferir', gravidade: 'media', icone: CalendarClock,
          titulo: `Cronograma desatualizado — ${tituloObra.get(obraId)}`,
          detalhe: `${plural(n, 'etapa passou', 'etapas passaram')} da data de fim sem estar concluída`,
          href: `/obras/${obraId}?aba=cronograma`,
        })
      }

      // Obra com prazo vencido
      for (const o of obras ?? []) {
        if (o.previsao_termino && o.previsao_termino < hoje) {
          lista.push({
            id: `prazo-${o.id}`, grupo: 'conferir', gravidade: 'media', icone: Clock,
            titulo: `Prazo vencido — ${o.titulo}`,
            detalhe: `Previsão era ${dataBR(o.previsao_termino)}. Já terminou? Mude o status para Concluída; senão, atualize a data.`,
            href: `/obras/${o.id}`,
          })
        }
      }

      lista.sort((a, b) => (a.gravidade === b.gravidade ? 0 : a.gravidade === 'alta' ? -1 : 1))
      setPendencias(lista)
    }
    load()
  }, [])

  if (pendencias === null) return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 flex items-center gap-2 text-sm text-[#94A3B8]">
      <Loader2 size={15} className="animate-spin" /> Verificando pendências…
    </div>
  )

  if (pendencias.length === 0) return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
      <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-emerald-800">Tudo em dia</p>
        <p className="text-xs text-emerald-700">Nenhum lançamento ou conferência pendente.</p>
      </div>
    </div>
  )

  const grupos: { key: Grupo; titulo: string; sub: string }[] = [
    { key: 'lancar', titulo: 'Falta lançar', sub: 'coisas que aconteceram e não estão no sistema' },
    { key: 'conferir', titulo: 'Falta conferir', sub: 'dados que provavelmente estão desatualizados' },
  ]

  return (
    <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-amber-100 bg-amber-50/60">
        <ClipboardCheck size={16} className="text-amber-600" />
        <h2 className="font-syne font-semibold text-[#0F172A] text-sm">Pendências</h2>
        <span className="text-[11px] font-bold bg-amber-500 text-white rounded-full px-2 py-0.5">{pendencias.length}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x divide-[#F1F5F9]">
        {grupos.map(g => {
          const itens = pendencias.filter(p => p.grupo === g.key)
          return (
            <div key={g.key}>
              <div className="px-5 pt-4 pb-2">
                <p className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide">{g.titulo} <span className="text-[#94A3B8]">({itens.length})</span></p>
                <p className="text-[11px] text-[#94A3B8]">{g.sub}</p>
              </div>
              {itens.length === 0 && (
                <p className="px-5 pb-4 text-xs text-emerald-600 flex items-center gap-1.5"><CheckCircle2 size={13} /> Nada pendente</p>
              )}
              <div className="divide-y divide-[#F8FAFC]">
                {itens.map(p => {
                  const Icone = p.icone
                  const alta = p.gravidade === 'alta'
                  return (
                    <Link key={p.id} href={p.href} className="flex items-start gap-3 px-5 py-3 hover:bg-[#F8FAFC] transition-colors group">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${alta ? 'bg-red-50' : 'bg-amber-50'}`}>
                        <Icone size={14} className={alta ? 'text-red-500' : 'text-amber-500'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0F172A]">{p.titulo}</p>
                        {p.detalhe && <p className="text-xs text-[#64748B] mt-0.5">{p.detalhe}</p>}
                      </div>
                      <ChevronRight size={14} className="text-[#CBD5E1] group-hover:text-[#4F7CFF] mt-1.5 shrink-0" />
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
