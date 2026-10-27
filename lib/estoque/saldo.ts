import { EstoqueProduto } from '@/lib/types'

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
