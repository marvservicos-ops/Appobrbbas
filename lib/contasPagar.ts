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

// Dados lidos de uma NF (PDF pelo Gemini ou XML da NF-e) — /api/parse-nfe
export interface DuplicataLida {
  numero?: string | null
  vencimento: string
  valor: number
}

export interface NotaLida {
  emitente?: string | null
  emitenteFantasia?: string | null
  emitenteCnpj?: string | null
  nfNumero?: string | null
  dataEmissao?: string | null
  valorTotal?: number | null
  duplicatas?: DuplicataLida[]
}

// "NF 000.086.191" → "86191"; o que não for número fica como veio
export function normalizarNumeroNf(v: string | null | undefined): string {
  const s = (v ?? '').trim()
  const d = s.replace(/\D/g, '')
  return d && /^(nf|n[ºo°]?\.?)?\s*[\d.\s-]+$/i.test(s) ? String(Number(d)) : s
}

// ── Alerta semanal (configuracoes_empresa) ─────────────────────────
export const CHAVE_ALERTA = 'contas_pagar_alerta'
export interface ConfigAlerta { ativo: boolean; emails: string[] }

// ── Conciliação com o extrato DDA ──────────────────────────────────
export interface BoletoDda {
  beneficiario: string | null
  cnpj: string | null
  vencimento: string
  valor: number
}

export type ItemConciliacao =
  | { tipo: 'confere'; boleto: BoletoDda; conta: Conta }
  | { tipo: 'divergente'; boleto: BoletoDda; conta: Conta; diferencas: string[] }
  | { tipo: 'sem_registro'; boleto: BoletoDda }

interface FornecedorBasico { id: string; nome: string; nome_fantasia: string | null; cnpj: string | null }

const normalizarNome = (s: string | null | undefined) => (s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\b(ltda|me|epp|eireli|s\/?a|cia|comercio|com)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ').trim()

const mesmoValor = (a: number, b: number) => Math.abs(Number(a) - Number(b)) < 0.005
const brData = (d: string) => d.split('-').reverse().slice(0, 2).join('/')
const brMoeda = (n: number) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// CNPJ: compara a raiz (8 dígitos), porque o boleto pode sair por outra filial.
// Sem CNPJ no DDA, compara o nome.
function mesmoFornecedor(b: BoletoDda, f: FornecedorBasico | undefined): boolean {
  if (!f) return false
  const cb = (b.cnpj ?? '').replace(/\D/g, '')
  if (cb && f.cnpj) return cb.length === 14 && f.cnpj.length === 14 ? cb.slice(0, 8) === f.cnpj.slice(0, 8) : cb === f.cnpj
  const nb = normalizarNome(b.beneficiario)
  if (!nb) return false
  return [f.nome, f.nome_fantasia].map(normalizarNome).some(n => n && (nb.includes(n) || n.includes(nb)))
}

// Cruza os boletos do DDA com as contas lançadas. Cada conta casa com um
// boleto só; primeiro os que batem em tudo, depois os parciais.
export function conciliarDda(boletos: BoletoDda[], contas: Conta[], fornecedores: FornecedorBasico[]) {
  const fornecedorDe = (c: Conta) => fornecedores.find(f => f.id === c.fornecedor_id)
  const usadas = new Set<string>()
  const resultado = new Map<number, ItemConciliacao>()

  const passos: { casa: (b: BoletoDda, c: Conta) => boolean; diferencas?: (b: BoletoDda, c: Conta) => string[] }[] = [
    { casa: (b, c) => mesmoFornecedor(b, fornecedorDe(c)) && mesmoValor(b.valor, c.valor) && b.vencimento === c.data_vencimento },
    {
      casa: (b, c) => mesmoValor(b.valor, c.valor) && b.vencimento === c.data_vencimento,
      diferencas: b => [`Beneficiário no DDA: ${b.beneficiario || 'sem nome'}${b.cnpj ? ` (${b.cnpj})` : ''}`],
    },
    {
      casa: (b, c) => mesmoFornecedor(b, fornecedorDe(c)) && mesmoValor(b.valor, c.valor),
      diferencas: (b, c) => [`Vencimento no DDA ${brData(b.vencimento)} (sistema ${brData(c.data_vencimento)})`],
    },
    {
      casa: (b, c) => mesmoFornecedor(b, fornecedorDe(c)) && b.vencimento === c.data_vencimento,
      diferencas: (b, c) => [`Valor no DDA ${brMoeda(b.valor)} (sistema ${brMoeda(c.valor)})`],
    },
  ]

  for (const passo of passos) {
    boletos.forEach((b, i) => {
      if (resultado.has(i)) return
      const conta = contas.find(c => !usadas.has(c.id) && c.status !== 'cancelado' && passo.casa(b, c))
      if (!conta) return
      usadas.add(conta.id)
      resultado.set(i, passo.diferencas
        ? { tipo: 'divergente', boleto: b, conta, diferencas: passo.diferencas(b, conta) }
        : { tipo: 'confere', boleto: b, conta })
    })
  }

  const itens: ItemConciliacao[] = boletos.map((b, i) => resultado.get(i) ?? { tipo: 'sem_registro', boleto: b })

  // Lançadas no período do extrato, ainda em aberto, que não apareceram no DDA
  const datas = boletos.map(b => b.vencimento).sort()
  const ausentes = datas.length === 0 ? [] : contas.filter(c =>
    !usadas.has(c.id) && STATUS_ABERTOS.includes(c.status) &&
    c.data_vencimento >= datas[0] && c.data_vencimento <= datas[datas.length - 1])

  return { itens, ausentes }
}
