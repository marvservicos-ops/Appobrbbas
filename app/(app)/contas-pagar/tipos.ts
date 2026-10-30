export type StatusConta = 'pendente' | 'conferido_dda' | 'pago' | 'divergente' | 'cancelado'

export const STATUS_CONTA: Record<StatusConta, { label: string; classe: string }> = {
  pendente: { label: 'Pendente', classe: 'bg-slate-100 text-slate-600' },
  conferido_dda: { label: 'Conferido DDA', classe: 'bg-blue-50 text-blue-700' },
  pago: { label: 'Pago', classe: 'bg-emerald-50 text-emerald-700' },
  divergente: { label: 'Divergente', classe: 'bg-red-50 text-red-600' },
  cancelado: { label: 'Cancelado', classe: 'bg-gray-100 text-gray-400 line-through' },
}

export const STATUS_ORDEM: StatusConta[] = ['pendente', 'conferido_dda', 'divergente', 'pago', 'cancelado']

// Ainda precisa de atenção (não foi paga nem cancelada)
export const emAberto = (s: StatusConta) => s !== 'pago' && s !== 'cancelado'
export const STATUS_ABERTOS: StatusConta[] = ['pendente', 'conferido_dda', 'divergente']

export interface Conta {
  id: string
  nota_id: string | null
  fornecedor_id: string
  parcela: number | null
  descricao: string | null
  data_vencimento: string
  valor: number
  status: StatusConta
  motivo_divergencia: string | null
  data_pagamento: string | null
  observacao: string | null
  nota?: { id: string; numero_nf: string | null; parcelas: { count: number }[] } | null
}

export const SELECT_CONTA = '*, nota:notas_compra(id, numero_nf, parcelas:contas_pagar(count))'

export const MOTIVOS_DIVERGENCIA = [
  'Valor diferente no DDA',
  'Vencimento diferente no DDA',
  'Boleto não apareceu no DDA',
  'Boleto no DDA sem registro no sistema',
]
