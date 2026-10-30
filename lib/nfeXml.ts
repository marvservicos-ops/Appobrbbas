// Leitura do XML da NF-e (layout 4.00) sem IA: as tags são padronizadas pela
// SEFAZ, então dá para extrair emitente, totais, itens e duplicatas direto.
import type { NotaLida } from '@/lib/contasPagar'

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decodificar = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTIDADES[e])

// Conteúdo da 1ª ocorrência de <nome ...>...</nome> (aceita atributos, ignora prefixo de namespace)
function tag(xml: string | null, nome: string): string | null {
  if (!xml) return null
  const m = xml.match(new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nome}>`))
  return m ? decodificar(m[1].trim()) : null
}

function tags(xml: string | null, nome: string): string[] {
  if (!xml) return []
  const re = new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nome}>`, 'g')
  return Array.from(xml.matchAll(re), m => m[1])
}

const num = (v: string | null) => (v == null || v === '' ? 0 : Number(v))

export interface ProdutoNfe {
  codigo: string
  descricao: string
  unidade: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
}

export function lerNfeXml(xml: string): (NotaLida & { produtos: ProdutoNfe[] }) | null {
  const emit = tag(xml, 'emit')
  const ide = tag(xml, 'ide')
  if (!emit || !ide) return null

  const produtos = tags(xml, 'det').map(det => {
    const prod = tag(det, 'prod')
    return {
      codigo: tag(prod, 'cProd') ?? '',
      descricao: tag(prod, 'xProd') ?? '',
      unidade: tag(prod, 'uCom') ?? 'UN',
      quantidade: num(tag(prod, 'qCom')),
      valorUnitario: num(tag(prod, 'vUnCom')),
      valorTotal: num(tag(prod, 'vProd')),
    }
  })

  const duplicatas = tags(tag(xml, 'cobr'), 'dup')
    .map(d => ({ numero: tag(d, 'nDup'), vencimento: (tag(d, 'dVenc') ?? '').slice(0, 10), valor: num(tag(d, 'vDup')) }))
    .filter(d => d.vencimento && d.valor > 0)

  return {
    emitente: tag(emit, 'xNome'),
    emitenteFantasia: tag(emit, 'xFant'),
    emitenteCnpj: tag(emit, 'CNPJ') ?? tag(emit, 'CPF'),
    nfNumero: tag(ide, 'nNF'),
    dataEmissao: (tag(ide, 'dhEmi') ?? tag(ide, 'dEmi') ?? '').slice(0, 10) || null,
    valorTotal: num(tag(tag(xml, 'ICMSTot'), 'vNF')),
    duplicatas,
    produtos,
  }
}
