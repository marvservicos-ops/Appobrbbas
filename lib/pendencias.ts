import type { SupabaseClient } from '@supabase/supabase-js'

// Cruza os dados do sistema e lista o que ficou sem lançar ou sem conferir.
// Usado pelo painel de Pendências do Dashboard e pelo e-mail diário
// (/api/cron/pendencias) — mesma regra nos dois lugares.

export type IconePendencia = 'alocacao' | 'rdo' | 'email' | 'financeiro' | 'material' | 'cronograma' | 'manutencao' | 'prazo'

export type Gravidade = 'alta' | 'media'
export type Grupo = 'lancar' | 'conferir'

export interface Pendencia {
  id: string
  /** Impressão do estado atual: um "está ok" só vale enquanto ela não mudar. */
  chave: string
  /** Marcada como ok pelo usuário (sai do painel e do e-mail). */
  dispensada?: boolean
  grupo: Grupo
  gravidade: Gravidade
  icone: IconePendencia
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

/** `agora` deve estar no horário de Brasília (ver `agoraBrasilia`). */
export async function calcularPendencias(sb: SupabaseClient, agora: Date): Promise<Pendencia[]> {
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
    { data: medPlanejadas },
    { data: medFaturadas },
    { data: materiais },
    { data: etapas },
    { data: nfsManut },
    { data: equips },
  ] = await Promise.all([
    obraIds.length ? sb.from('diario_obra_relatorios').select('*').in('obra_id', obraIds) : vazio,
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
        id: 'aloc-atrasada', chave: incompletosPassados.join(','), grupo: 'lancar', gravidade: 'alta', icone: 'alocacao',
        titulo: `Alocação incompleta em ${plural(incompletosPassados.length, 'dia', 'dias')}`,
        detalhe: incompletosPassados.map(d => `${dataBR(d)} (${totalFuncs - (porDia.get(d)?.size ?? 0)} sem lançar)`).join(' · '),
        href: '/funcionarios/alocacao',
      })
    }
    if (diasAlocacao.includes(hoje)) {
      const faltamHoje = totalFuncs - (porDia.get(hoje)?.size ?? 0)
      if (faltamHoje > 0) lista.push({
        id: 'aloc-hoje', chave: hoje, grupo: 'lancar', gravidade: 'media', icone: 'alocacao',
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
      id: 'rdo-sem-vinculo', chave: semVinculo.map(o => o.id).sort().join(','), grupo: 'lancar', gravidade: 'media', icone: 'rdo',
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
        id: `rdo-${o.id}`, chave: ult?.data ?? 'nenhum', grupo: 'lancar', gravidade: 'alta', icone: 'rdo',
        titulo: `Sem RDO recente — ${o.titulo}`,
        detalhe: ult?.data ? `Último RDO em ${dataBR(ult.data)} (há ${diasEntre(ult.data, hoje)} dias). Preencha no Diário de Obra e clique em "Sincronizar agora".` : 'Nenhum RDO sincronizado ainda.',
        href: `/obras/${o.id}?aba=relatorios`,
      })
    }
  }

  // Medições planejadas cuja data já passou (pedir/lançar)
  for (const m of medPlanejadas ?? []) {
    lista.push({
      id: `med-${m.id}`, chave: m.data_prevista, grupo: 'lancar', gravidade: 'alta', icone: 'financeiro',
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
      id: `mat-oc-${obraId}`, chave: String(n), grupo: 'lancar', gravidade: 'media', icone: 'material',
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
        id: `nf-man-${c.id}`, chave: competenciaAnterior, grupo: 'lancar', gravidade: 'alta', icone: 'manutencao',
        titulo: `NF de ${nomeMesAnterior} não emitida — ${nome}`,
        href: `/manutencoes/${c.id}`,
      })
      const equipsContrato = (equips ?? []).filter((e: any) => e.contrato_id === c.id)
      const faltando = equipsContrato.filter((e: any) => !prevFeitas.has(e.id)).length
      if (faltando > 0) lista.push({
        id: `prev-${c.id}`, chave: `${competenciaAnterior}:${faltando}`, grupo: 'lancar', gravidade: 'media', icone: 'manutencao',
        titulo: `Preventivas de ${nomeMesAnterior} não marcadas — ${nome}`,
        detalhe: `${faltando} de ${plural(equipsContrato.length, 'equipamento', 'equipamentos')}`,
        href: `/manutencoes/${c.id}`,
      })
    }
  }

  // ── CONFERIR ──────────────────────────────────────────────

  // RDOs sincronizados que ainda não foram enviados por e-mail
  const naoEnviados = new Map<string, any[]>()
  for (const r of rdos ?? []) {
    if (r.drive_file_id && !r.email_enviado_em) {
      if (!naoEnviados.has(r.obra_id)) naoEnviados.set(r.obra_id, [])
      naoEnviados.get(r.obra_id)!.push(r)
    }
  }
  for (const [obraId, lst] of Array.from(naoEnviados)) {
    lst.sort((x, y) => (x.numero ?? 0) - (y.numero ?? 0))
    lista.push({
      id: `rdo-email-${obraId}`, chave: lst.map(r => r.id).sort().join(','), grupo: 'conferir', gravidade: 'media', icone: 'email',
      titulo: `${plural(lst.length, 'RDO não enviado', 'RDOs não enviados')} por e-mail — ${tituloObra.get(obraId)}`,
      detalhe: lst.map(r => `#${r.numero ?? '?'}`).join(', '),
      href: `/obras/${obraId}?aba=relatorios`,
    })
  }

  // Medições faturadas vencidas sem recebimento
  for (const m of medFaturadas ?? []) {
    lista.push({
      id: `rec-${m.id}`, chave: m.data_vencimento, grupo: 'conferir', gravidade: 'alta', icone: 'financeiro',
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
      id: `mat-atr-${obraId}`, chave: String(n), grupo: 'conferir', gravidade: 'media', icone: 'material',
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
      id: `crono-${obraId}`, chave: String(n), grupo: 'conferir', gravidade: 'media', icone: 'cronograma',
      titulo: `Cronograma desatualizado — ${tituloObra.get(obraId)}`,
      detalhe: `${plural(n, 'etapa passou', 'etapas passaram')} da data de fim sem estar concluída`,
      href: `/obras/${obraId}?aba=cronograma`,
    })
  }

  // Obra com prazo vencido
  for (const o of obras ?? []) {
    if (o.previsao_termino && o.previsao_termino < hoje) {
      lista.push({
        id: `prazo-${o.id}`, chave: o.previsao_termino, grupo: 'conferir', gravidade: 'media', icone: 'prazo',
        titulo: `Prazo vencido — ${o.titulo}`,
        detalhe: `Previsão era ${dataBR(o.previsao_termino)}. Já terminou? Mude o status para Concluída; senão, atualize a data.`,
        href: `/obras/${o.id}`,
      })
    }
  }

  lista.sort((a, b) => (a.gravidade === b.gravidade ? 0 : a.gravidade === 'alta' ? -1 : 1))
  // "Está ok" dados pelo usuário — valem enquanto o estado (chave) não mudar.
  // Se a tabela ainda não existir, o erro é ignorado e nada fica dispensado.
  const { data: dispensas } = await sb.from('pendencias_dispensadas').select('pendencia_id, chave')
  const okMap = new Map((dispensas ?? []).map((d: any) => [d.pendencia_id as string, d.chave as string]))
  for (const p of lista) p.dispensada = okMap.get(p.id) === p.chave

  lista.sort((a, b) => (a.gravidade === b.gravidade ? 0 : a.gravidade === 'alta' ? -1 : 1))
  return lista
}

/** Data/hora atual "como vista em Brasília", para rodar no servidor (UTC). */
export function agoraBrasilia() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
}
