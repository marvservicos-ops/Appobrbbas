import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const result = await model.generateContent([
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
