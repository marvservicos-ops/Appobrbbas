import type { SupabaseClient } from '@supabase/supabase-js'
import { EstoqueProduto } from '@/lib/types'
import { arred } from '@/lib/numero'

type TabelaSaldo = 'estoque_produtos' | 'mala_estoque_produtos' | 'manutencao_estoque_produtos'

// Soma `delta` (negativo = saída) ao saldo direto no banco, sem sobrescrever
// movimentações feitas por outra pessoa. pisoZero: nunca deixa negativo
// (produtos sem controle de saldo). Devolve o novo saldo ou o erro.
// Sem a função ajustar_saldo no banco (migração estoque_ajustar_saldo.sql
// ainda não rodada), relê o saldo atual e grava — melhor que usar o valor
// carregado quando a tela abriu.
export async function ajustarSaldo(
  sb: SupabaseClient,
  produtoId: string,
  delta: number,
  opts: { tabela?: TabelaSaldo; pisoZero?: boolean } = {},
): Promise<{ saldo: number | null; error: { message: string; code?: string } | null }> {
  const tabela = opts.tabela ?? 'estoque_produtos'
  const pisoZero = opts.pisoZero ?? false
  const { data, error } = await sb.rpc('ajustar_saldo', { p_tabela: tabela, p_id: produtoId, p_delta: delta, p_piso_zero: pisoZero })
  if (!error) return { saldo: Number(data), error: null }
  const semFuncao = error.code === 'PGRST202' || error.code === '42883' || /ajustar_saldo/.test(error.message ?? '')
  if (!semFuncao) return { saldo: null, error }

  const { data: atual, error: errLer } = await sb.from(tabela).select('quantidade_atual').eq('id', produtoId).single()
  if (errLer) return { saldo: null, error: errLer }
  let novo = arred(Number(atual?.quantidade_atual ?? 0) + delta)
  if (pisoZero) novo = Math.max(0, novo)
  const { error: errGravar } = await sb.from(tabela).update({ quantidade_atual: novo }).eq('id', produtoId)
  return errGravar ? { saldo: null, error: errGravar } : { saldo: novo, error: null }
}

// Produto sem a coluna (antes da migração) conta como controlado, como sempre foi
export function controlaSaldo(p: Pick<EstoqueProduto, 'controla_saldo'> | null | undefined): boolean {
  return p?.controla_saldo !== false
}

// Saldo após uma saída. Sem controle de saldo, quantidade_atual é só o "saldo conhecido"
// (o que voltou de obra): a saída consome o que houver e nunca deixa negativo.
export function saldoAposSaida(p: Pick<EstoqueProduto, 'controla_saldo' | 'quantidade_atual'>, qtd: number): number {
  const novo = p.quantidade_atual - qtd
  return controlaSaldo(p) ? novo : Math.max(0, novo)
}
