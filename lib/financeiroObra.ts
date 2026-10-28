// Totais financeiros de uma obra — uma única regra para as telas de Medições,
// Centro de Custos e o resumo do Financeiro (antes cada uma somava de um jeito).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ObraMedicao } from '@/lib/types'
import { parseData } from '@/lib/datas'

type Num = number | string | null | undefined
const n = (v: Num) => Number(v || 0)

// ── Receita: contrato, faturado, recebido ─────────────────────────────

type MedicaoValores = Pick<ObraMedicao, 'status'> & {
  valor_previsto?: Num; valor_faturado?: Num; valor_recebido?: Num
}

// Faturado de uma medição: o valor faturado digitado; sem ele, o previsto
// das medições já faturadas/recebidas. Cancelada não conta.
export function valorFaturadoMedicao(m: MedicaoValores): number {
  if (m.status === 'cancelada') return 0
  if (n(m.valor_faturado) > 0) return n(m.valor_faturado)
  return m.status === 'faturada' || m.status === 'recebida' ? n(m.valor_previsto) : 0
}

// Recebido de uma medição: o valor recebido digitado; sem ele, o faturado
// (ou previsto) das medições marcadas como recebidas.
export function valorRecebidoMedicao(m: MedicaoValores): number {
  if (m.status === 'cancelada') return 0
  if (n(m.valor_recebido) > 0) return n(m.valor_recebido)
  return m.status === 'recebida' ? valorFaturadoMedicao(m) : 0
}

export interface TotaisReceita {
  totalOcs: number
  contratoLegado: number
  totalAditivos: number
  contrato: number      // OCs + contrato legado + aditivos
  faturado: number
  recebido: number
  saldoAFaturar: number
}

export function totaisReceitaObra(dados: {
  ocs?: { valor_total?: Num }[] | null
  valorContratoLegado?: Num
  aditivos?: { valor?: Num }[] | null
  medicoes?: MedicaoValores[] | null
}): TotaisReceita {
  const totalOcs = (dados.ocs ?? []).reduce((s, o) => s + n(o.valor_total), 0)
  const contratoLegado = n(dados.valorContratoLegado)
  const totalAditivos = (dados.aditivos ?? []).reduce((s, a) => s + n(a.valor), 0)
  const contrato = totalOcs + contratoLegado + totalAditivos
  const meds = dados.medicoes ?? []
  const faturado = meds.reduce((s, m) => s + valorFaturadoMedicao(m), 0)
  const recebido = meds.reduce((s, m) => s + valorRecebidoMedicao(m), 0)
  return { totalOcs, contratoLegado, totalAditivos, contrato, faturado, recebido, saldoAFaturar: Math.max(0, contrato - faturado) }
}

// ── Custos ─────────────────────────────────────────────────────────────

type Extra = { descricao: string; valor: number }
export interface MaterialCusto {
  id: string
  valor_total?: number | null
  custos_extras?: Extra[] | null
  nota_fiscal_url?: string | null
  observacoes?: string | null
  fornecedor?: string | null
  created_at?: string | null
}

// Itens do mesmo orçamento: pela url do arquivo; sem arquivo, pelo nº da NF
// + fornecedor; sem nenhum dos dois, pelo lote de inserção (mesmo created_at).
// Mesma chave da lista de materiais da obra — cada item do lote guarda uma
// cópia dos custos extras (frete/ICMS), que contam uma vez por grupo.
export function chaveGrupoMaterial(m: MaterialCusto): string {
  if (m.nota_fiscal_url) return `url|${m.nota_fiscal_url}`
  const nfNumero = m.observacoes?.match(/NF:\s*([^\s|]+)/)?.[1]
  if (nfNumero) return `nf|${m.fornecedor ?? ''}|${nfNumero}`
  return `lote|${m.created_at ?? m.id}|${m.fornecedor ?? ''}`
}

export function agruparMateriais<T extends MaterialCusto>(materiais: T[]): Map<string, T[]> {
  const mapa = new Map<string, T[]>()
  for (const m of materiais) {
    const k = chaveGrupoMaterial(m)
    if (!mapa.has(k)) mapa.set(k, [])
    mapa.get(k)!.push(m)
  }
  return mapa
}

export const totalExtras = (extras: Extra[] | null | undefined) =>
  (extras ?? []).reduce((s, c) => s + n(c.valor), 0)

// Custo de compra dos materiais: itens + custos extras uma vez por grupo
export function custoMateriaisObra(materiais: MaterialCusto[]): number {
  const itens = materiais.reduce((s, m) => s + n(m.valor_total), 0)
  const extras = Array.from(agruparMateriais(materiais).values()).reduce((s, g) => s + totalExtras(g[0].custos_extras), 0)
  return itens + extras
}

// Consumo de estoque: saídas menos entradas (devoluções/sobras) vinculadas à obra
export function custoEstoqueObra(registros: { tipo: string; valor_total?: Num }[]): number {
  return registros.reduce((s, r) => s + (r.tipo === 'saida' ? 1 : -1) * n(r.valor_total), 0)
}

export interface FuncionarioCusto {
  id: string; nome?: string; cargo?: string | null
  custo_diario?: number | null; salario_bruto?: number | null; dias_mes?: number | null
}
export interface AlocacaoCusto {
  data: string; funcionario_id: string; percentual?: number | null; noturno?: boolean | null; tipo: string
}
export interface CustoFuncionario {
  id: string
  funcionario: { nome: string; cargo: string | null }
  dias_trabalhados: number
  custo_diario_epoca: number
  custo_total: number
}

export const custoDiaFuncionario = (f: FuncionarioCusto): number =>
  f.custo_diario ?? (f.salario_bruto && f.dias_mes ? f.salario_bruto / f.dias_mes : 0)

// Lê configuracoes_empresa 'adicional_%' (valor numérico ou { percentual })
export function lerAdicionais(cfgs: { chave: string; valor: unknown }[] | null | undefined) {
  const mapa = new Map((cfgs ?? []).map(c => {
    const v = c.valor as { percentual?: Num } | Num
    const bruto = typeof v === 'object' && v !== null ? v.percentual : v
    return [c.chave, parseFloat(String(bruto ?? '')) || 0] as const
  }))
  return {
    noturno: (mapa.get('adicional_noturno') ?? 0) / 100,
    sabado: (mapa.get('adicional_sabado') ?? 0) / 100,
    domingo: (mapa.get('adicional_domingo_feriado') ?? 0) / 100,
  }
}

// Custo de mão de obra por funcionário, com adicional noturno/sábado/domingo
export function custoMaoDeObraObra(
  alocacoes: AlocacaoCusto[],
  funcionarios: FuncionarioCusto[],
  adicionais: { noturno: number; sabado: number; domingo: number },
): CustoFuncionario[] {
  const funcMap = new Map(funcionarios.map(f => [f.id, f]))
  const map = new Map<string, CustoFuncionario>()
  for (const r of alocacoes) {
    const f = funcMap.get(r.funcionario_id)
    if (!f) continue
    const custoDia = custoDiaFuncionario(f)
    if (!map.has(r.funcionario_id)) {
      map.set(r.funcionario_id, {
        id: r.funcionario_id,
        funcionario: { nome: f.nome ?? '', cargo: f.cargo ?? null },
        dias_trabalhados: 0, custo_diario_epoca: custoDia, custo_total: 0,
      })
    }
    const entry = map.get(r.funcionario_id)!
    const pct = (r.percentual ?? 100) / 100
    entry.dias_trabalhados += pct
    entry.custo_total += pct * custoDia
    if (r.tipo === 'folga' || r.tipo === 'escritorio') continue
    const dow = parseData(r.data).getDay()
    if (r.noturno && adicionais.noturno > 0) entry.custo_total += pct * custoDia * adicionais.noturno
    else if (!r.noturno && dow === 6 && adicionais.sabado > 0) entry.custo_total += pct * custoDia * adicionais.sabado
    else if (!r.noturno && dow === 0 && adicionais.domingo > 0) entry.custo_total += pct * custoDia * adicionais.domingo
  }
  return Array.from(map.values()).sort((a, b) => a.funcionario.nome.localeCompare(b.funcionario.nome))
}

// ── Carga completa (resumo do Financeiro) ──────────────────────────────

export interface TotaisObra extends TotaisReceita {
  custoEstoque: number
  custoMateriais: number
  custoMaoDeObra: number
  custoTotal: number
}

// Lê tudo que entra nos totais. Devolve `error` se alguma leitura falhar,
// para a tela não mostrar R$ 0 como se fosse o valor real.
export async function carregarTotaisObra(sb: SupabaseClient, obraId: string): Promise<{ totais: TotaisObra | null; error: { message: string; code?: string } | null }> {
  const [medRes, ocRes, finRes, adRes, regRes, matRes, alocRes, adicRes] = await Promise.all([
    sb.from('obra_medicoes').select('status, valor_previsto, valor_faturado, valor_recebido').eq('obra_id', obraId),
    sb.from('obra_ocs').select('valor_total').eq('obra_id', obraId),
    sb.from('obra_financeiro').select('valor_contrato').eq('obra_id', obraId).maybeSingle(),
    sb.from('obra_aditivos').select('valor').eq('obra_id', obraId),
    sb.from('estoque_registros').select('tipo, valor_total').eq('obra_id', obraId),
    sb.from('obra_materiais').select('id, valor_total, custos_extras, nota_fiscal_url, observacoes, fornecedor, created_at').eq('obra_id', obraId).eq('tipo_compra', 'interna'),
    sb.from('funcionario_alocacoes').select('data, funcionario_id, percentual, noturno, tipo').eq('obra_id', obraId).in('tipo', ['obra', 'folga', 'escritorio']),
    sb.from('configuracoes_empresa').select('chave, valor').like('chave', 'adicional_%'),
  ])
  const erro = [medRes, ocRes, finRes, adRes, regRes, matRes, alocRes].find(r => r.error)?.error
  if (erro) return { totais: null, error: erro }

  const alocs = (alocRes.data ?? []) as AlocacaoCusto[]
  let funcs: FuncionarioCusto[] = []
  if (alocs.length > 0) {
    const ids = Array.from(new Set(alocs.map(a => a.funcionario_id)))
    const { data, error } = await sb.from('funcionarios').select('id, nome, cargo, custo_diario, salario_bruto, dias_mes').in('id', ids)
    if (error) return { totais: null, error }
    funcs = (data ?? []) as FuncionarioCusto[]
  }

  const receita = totaisReceitaObra({
    ocs: ocRes.data, valorContratoLegado: finRes.data?.valor_contrato,
    aditivos: adRes.data, medicoes: medRes.data as MedicaoValores[],
  })
  const custoEstoque = custoEstoqueObra(regRes.data ?? [])
  const custoMateriais = custoMateriaisObra((matRes.data ?? []) as MaterialCusto[])
  const custoMaoDeObra = custoMaoDeObraObra(alocs, funcs, lerAdicionais(adicRes.data)).reduce((s, e) => s + e.custo_total, 0)
  return {
    totais: { ...receita, custoEstoque, custoMateriais, custoMaoDeObra, custoTotal: custoEstoque + custoMateriais + custoMaoDeObra },
    error: null,
  }
}
