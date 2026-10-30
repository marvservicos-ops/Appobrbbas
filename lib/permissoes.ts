// Permissões que o admin pode dar a um usuário (admin já tem todas).
// Fica fora de lib/access.ts porque aquele arquivo usa o cliente do servidor.
export const PERMISSOES = [
  { id: 'financeiro', label: 'Financeiro e medições' },
  { id: 'contas_pagar', label: 'Contas a pagar' },
] as const

export const PERMISSOES_IDS: string[] = PERMISSOES.map(p => p.id)
