import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Modelos tentados em ordem — o Google aposenta modelos "preview" com frequência,
// então caímos para o próximo candidato se o principal não existir mais (404).
const MODELOS_CANDIDATOS = ['gemini-3-flash', 'gemini-2.5-flash', 'gemini-2.0-flash']

async function gerarComFallback(genAI: GoogleGenerativeAI, parts: any[]) {
  let ultimoErro: unknown = null
  for (const nomeModelo of MODELOS_CANDIDATOS) {
    try {
      const model = genAI.getGenerativeModel({ model: nomeModelo })
      return await model.generateContent(parts)
    } catch (err) {
      ultimoErro = err
      const msg = String(err)
      if (!msg.includes('404') && !msg.includes('not found')) throw err
    }
  }
  throw ultimoErro
}

const PROMPT = `Você é um extrator de dados de Nota Fiscal Eletrônica (DANFE) brasileira.
Analise o PDF e retorne APENAS um JSON válido, sem markdown, sem explicações, com esta estrutura exata:
{
  "emitente": "razão social do fornecedor/emitente",
  "nfNumero": "número da NF (ex: NF 000.086.191)",
  "dataEmissao": "YYYY-MM-DD",
  "valorTotal": 2385.43,
  "produtos": [
    {
      "codigo": "1501",
      "descricao": "descrição completa do produto",
      "unidade": "UN",
      "quantidade": 1,
      "valorUnitario": 510.00,
      "valorTotal": 510.00
    }
  ]
}
Retorne null nos campos que não encontrar. Retorne array vazio em produtos se não houver itens.`

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')

    const genAI = new GoogleGenerativeAI(apiKey)
    const result = await gerarComFallback(genAI, [
      { inlineData: { mimeType: 'application/pdf', data: base64 } },
      PROMPT,
    ])

    const text = result.response.text().trim()
    // Remove markdown code blocks if present
    const json = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(json)

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('parse-nfe gemini error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
