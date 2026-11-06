// Despesas diversas da obra: tipos e regras compartilhadas entre a aba
// Despesas (todo usuário) e o Centro de Custos (Financeiro).

export const BUCKET_DESPESAS = 'obra-despesas'

export const CATEGORIAS_DESPESA = [
  'Estacionamento', 'Pedágio', 'Combustível', 'Alimentação', 'Transporte (Uber/táxi)', 'Hospedagem', 'Outros',
]

export const FORMAS_PAGAMENTO = [
  { valor: 'pix', rotulo: 'Pix da empresa' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'reembolso', rotulo: 'Do próprio bolso (reembolsar)' },
  { valor: 'boleto', rotulo: 'Boleto' },
  { valor: 'outro', rotulo: 'Outro' },
]

export const rotuloForma = (v: string) => FORMAS_PAGAMENTO.find(f => f.valor === v)?.rotulo ?? v

export interface DespesaObra {
  id: string
  obra_id: string
  data: string
  categoria: string
  descricao: string | null
  valor: number
  forma_pagamento: string
  pago_por: string | null
  comprovante_path: string | null
  comprovante_nome: string | null
  observacao: string | null
  criado_por_nome: string | null
  created_at: string
}

export function custoDespesasObra(despesas: { valor: number | string | null }[]): number {
  return despesas.reduce((s, d) => s + (Number(d.valor) || 0), 0)
}
