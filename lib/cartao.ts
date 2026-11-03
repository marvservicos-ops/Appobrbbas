// Cartão corporativo: tipos e regras compartilhadas entre a tela, a leitura
// da fatura e a leitura dos comprovantes.

import { diasEntre } from '@/lib/datas'

export const BUCKET_CARTAO = 'cartao-comprovantes'

// Tabela ainda não criada (migration não rodou): quem só soma custos segue sem o cartão
export const semTabelaCartao = (e: { code?: string } | null | undefined) =>
  e?.code === 'PGRST205' || e?.code === '42P01'

export interface Comprovante {
  id: string
  lancamento_id: string
  path: string
  nome: string | null
}

export interface Lancamento {
  id: string
  competencia: string
  data: string
  estabelecimento: string
  valor: number
  parcela: string | null
  descricao: string | null
  destino: 'obra' | 'empresa' | null
  obra_id: string | null
  categoria_id: string | null
  na_fatura: boolean
  dispensa_comprovante: string | null
  observacao: string | null
  comprovantes: Comprovante[]
}

export const SELECT_LANCAMENTO = '*, comprovantes:cartao_comprovantes(id, lancamento_id, path, nome)'

// Linha lida da fatura (OFX, planilha ou PDF)
export interface LinhaFatura {
  data: string
  estabelecimento: string
  valor: number
  parcela: string | null
}

// O que a IA leu de um cupom/nota/recibo
export interface ComprovanteLido {
  data: string | null
  valor: number | null
  estabelecimento: string | null
  cnpj: string | null
  descricao: string | null
}

export const MOTIVOS_DISPENSA = ['Anuidade', 'IOF', 'Tarifa do banco', 'Juros/encargos', 'Estorno']

export type Situacao = 'comprovado' | 'dispensado' | 'pendente'

export function situacao(l: Pick<Lancamento, 'comprovantes' | 'dispensa_comprovante'>): Situacao {
  if (l.comprovantes.length > 0) return 'comprovado'
  if (l.dispensa_comprovante) return 'dispensado'
  return 'pendente'
}

// Pronto para fechar: tem comprovante (ou dispensa) e foi classificado
export const semClassificacao = (l: Lancamento) =>
  !l.destino || (l.destino === 'obra' && !l.obra_id) || (l.destino === 'empresa' && !l.categoria_id)

// "POSTO SHELL 123*" e "Posto Shell  123" viram a mesma chave
export const chaveEstabelecimento = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '')

// "2/5" → { atual: 2, total: 5 }
export function lerParcela(p: string | null | undefined): { atual: number; total: number } | null {
  const m = String(p ?? '').match(/(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i)
  if (!m) return null
  const atual = Number(m[1]), total = Number(m[2])
  return atual >= 1 && total >= atual ? { atual, total } : null
}

const centavos = (v: number) => Math.round(v * 100)

// Quanto o comprovante combina com o gasto (0 = não combina). O valor tem que
// bater — o da parcela ou o total da compra parcelada; a data só desempata.
export function pontuarComprovante(c: ComprovanteLido, l: Pick<Lancamento, 'valor' | 'data' | 'parcela' | 'estabelecimento'>): number {
  if (c.valor == null) return 0
  const parc = lerParcela(l.parcela)
  const bateValor = Math.abs(centavos(c.valor) - centavos(l.valor)) <= 1
  const bateTotal = parc && parc.total > 1 && Math.abs(centavos(c.valor) - centavos(l.valor * parc.total)) <= parc.total
  if (!bateValor && !bateTotal) return 0
  let pontos = 50
  if (c.data) {
    const dias = Math.abs(diasEntre(c.data, l.data))
    if (dias <= 1) pontos += 40
    else if (dias <= 5) pontos += 25
    else if (dias <= 40) pontos += 5
    else return 0
  }
  if (c.estabelecimento) {
    const a = chaveEstabelecimento(c.estabelecimento), b = chaveEstabelecimento(l.estabelecimento)
    if (a && b && (a.includes(b.slice(0, 6)) || b.includes(a.slice(0, 6)))) pontos += 10
  }
  return pontos
}

// Gasto lançado antes da fatura que corresponde a esta linha da fatura
export function mesmoGasto(linha: LinhaFatura, l: Pick<Lancamento, 'valor' | 'data'>): boolean {
  return Math.abs(centavos(linha.valor) - centavos(l.valor)) <= 1 && Math.abs(diasEntre(linha.data, l.data)) <= 4
}

// Mesma linha já importada (reimportar a fatura não duplica)
export function linhaRepetida(linha: LinhaFatura, l: Pick<Lancamento, 'valor' | 'data' | 'estabelecimento' | 'parcela'>): boolean {
  return centavos(linha.valor) === centavos(l.valor) && linha.data === l.data
    && chaveEstabelecimento(linha.estabelecimento) === chaveEstabelecimento(l.estabelecimento)
    && (lerParcela(linha.parcela)?.atual ?? 0) === (lerParcela(l.parcela)?.atual ?? 0)
}

// Parcela anterior da mesma compra (para herdar comprovante e classificação)
export function parcelaAnterior<T extends Pick<Lancamento, 'valor' | 'data' | 'estabelecimento' | 'parcela'>>(linha: LinhaFatura, existentes: T[]): T | undefined {
  const p = lerParcela(linha.parcela)
  if (!p || p.atual < 2) return undefined
  const chave = chaveEstabelecimento(linha.estabelecimento)
  return existentes.find(l => {
    const q = lerParcela(l.parcela)
    return q && q.total === p.total && q.atual < p.atual
      && Math.abs(centavos(l.valor) - centavos(linha.valor)) <= 1
      && chaveEstabelecimento(l.estabelecimento) === chave
  })
}

// ── OFX (formato padrão de exportação dos bancos) ─────────────
// Lido aqui mesmo, sem IA: cada <STMTTRN> vira uma linha. O pagamento da
// fatura fica de fora. A maioria dos bancos manda a compra negativa; se a
// maioria vier positiva, o banco usa o sinal ao contrário.
export function lerOfx(texto: string): LinhaFatura[] {
  const tag = (bloco: string, nome: string) =>
    bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, 'i'))?.[1]?.trim() ?? ''
  const brutas: (Omit<LinhaFatura, 'valor'> & { bruto: number })[] = []
  for (const bloco of texto.split(/<STMTTRN>/i).slice(1)) {
    const dt = tag(bloco, 'DTPOSTED')
    const bruto = Number(tag(bloco, 'TRNAMT').replace(',', '.'))
    const memo = tag(bloco, 'MEMO') || tag(bloco, 'NAME')
    if (!/^\d{8}/.test(dt) || !Number.isFinite(bruto) || bruto === 0) continue
    if (/PAGAMENTO|PAGTO|PGTO/i.test(memo)) continue
    const parcela = memo.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*$/)
    brutas.push({
      data: `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`,
      estabelecimento: (parcela ? memo.slice(0, parcela.index).trim() : memo) || 'Sem descrição',
      bruto,
      parcela: parcela ? `${Number(parcela[1])}/${Number(parcela[2])}` : null,
    })
  }
  const sinal = brutas.filter(b => b.bruto > 0).length > brutas.length / 2 ? 1 : -1
  return brutas.map(({ bruto, ...b }) => ({ ...b, valor: Math.round(sinal * bruto * 100) / 100 }))
}
