import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseBRDate(s: string): string | null {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

function parseBRNumber(s: string): number | null {
  const clean = s.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(clean)
  return isNaN(n) ? null : n
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    const data = await pdfParse(buffer)
    const text: string = data.text

    // Extract emitente name — appears before CNPJ line in emitente block
    // Pattern: find "IDENTIFICAÇÃO DO EMITENTE" section
    const emitenteMatch = text.match(/CNPJ\s*[\r\n]+([^\r\n]+)\s+[\d.\/\-]{14,}/i)
      || text.match(/([A-Z][A-Z &.\/\-,]{10,}(?:LTDA|EPP|EIRELI|SA|S\/A|ME|MEI)[^\r\n]*)/i)
    const emitente = emitenteMatch ? emitenteMatch[1].trim() : null

    // NF number
    const nfMatch = text.match(/N[ºo°]\s*[\d.]{6,}/i)
    const nfNumero = nfMatch ? nfMatch[0].replace(/\s+/g, ' ').trim() : null

    // Data de emissão
    const dataMatch = text.match(/DATA DE EMISS[ÃA]O[\s\S]{0,10}(\d{2}\/\d{2}\/\d{4})/i)
      || text.match(/(\d{2}\/\d{2}\/\d{4})/)
    const dataEmissao = dataMatch ? parseBRDate(dataMatch[1]) : null

    // Valor total da nota
    const valorMatch = text.match(/VALOR TOTAL DA NOTA[\s\S]{0,30}?([\d.,]+)/i)
    const valorTotal = valorMatch ? parseBRNumber(valorMatch[1]) : null

    // Chave de acesso (44 digits)
    const chaveMatch = text.match(/\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}/)
    const chaveAcesso = chaveMatch ? chaveMatch[0].replace(/\s/g, '') : null

    // Products — parse the DADOS DO PRODUTO section
    const produtos: { codigo: string; descricao: string; quantidade: number; valorUnitario: number; valorTotal: number; unidade: string }[] = []
    const produtoSection = text.match(/DADOS DO PRODUTO\/SERVI[ÇC]O([\s\S]+?)(?:CONTINUAÇÃO|DADOS ADICIONAIS|TRANSPORTADOR|$)/i)
    if (produtoSection) {
      // Each row: CODE DESCRIPTION NCM CST CFOP UNIT QTY UNIT_VAL TOTAL ...
      const rows = produtoSection[1].split('\n').filter(l => l.trim())
      for (const row of rows) {
        // Match: number at start + text + numbers at end
        const m = row.match(/^(\d+)\s+(.+?)\s+(\d{8})\s+\d+\s+\d+\s+(UN|PC|KG|M|MT|CX|RL|JG|L|KIT)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/i)
        if (m) {
          produtos.push({
            codigo: m[1],
            descricao: m[2].trim(),
            unidade: m[4].toUpperCase(),
            quantidade: parseBRNumber(m[5]) ?? 0,
            valorUnitario: parseBRNumber(m[6]) ?? 0,
            valorTotal: parseBRNumber(m[7]) ?? 0,
          })
        }
      }
    }

    // Build description from products if found
    const descricao = produtos.length === 1
      ? produtos[0].descricao
      : produtos.length > 1
        ? `${produtos[0].descricao} (+${produtos.length - 1} itens)`
        : null

    return NextResponse.json({
      emitente,
      nfNumero,
      dataEmissao,
      valorTotal,
      chaveAcesso,
      produtos,
      descricao,
    })
  } catch (err) {
    console.error('parse-nfe error', err)
    return NextResponse.json({ error: 'Erro ao processar PDF' }, { status: 500 })
  }
}
