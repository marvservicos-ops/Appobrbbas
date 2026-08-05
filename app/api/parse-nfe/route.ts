import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Modelos tentados em ordem — o Google aposenta modelos "preview" com frequência,
// então caímos para o próximo candidato se o principal não existir mais (404).
const MODELOS_CANDIDATOS = ['gemini-3.5-flash', 'gemini-3-flash', 'gemini-2.5-flash', 'gemini-2.0-flash']

// Se nenhum candidato acima funcionar, consulta a API pra descobrir o nome
// exato dos modelos realmente disponíveis nesta chave, em vez de continuar chutando.
async function listarModelosDisponiveis(apiKey: string): Promise<string[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  if (!res.ok) return []
  const data = await res.json()
  const nomes = ((data.models ?? []) as any[])
    .filter(m => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map(m => String(m.name).replace(/^models\//, ''))
  // Prioriza "flash" (mais barato/rápido), depois qualquer outro que sobrar
  const flash = nomes.filter(n => n.toLowerCase().includes('flash'))
  const outros = nomes.filter(n => !flash.includes(n))
  return [...flash, ...outros]
}

async function gerarComFallback(genAI: GoogleGenerativeAI, apiKey: string, parts: any[]) {
  let ultimoErro: unknown = null
  const tentar = async (nomeModelo: string) => {
    const model = genAI.getGenerativeModel({ model: nomeModelo })
    return model.generateContent(parts)
  }

  for (const nomeModelo of MODELOS_CANDIDATOS) {
    try {
      return await tentar(nomeModelo)
    } catch (err) {
      ultimoErro = err
      const msg = String(err)
      if (!msg.includes('404') && !msg.includes('not found')) throw err
    }
  }

  // Nenhum candidato fixo funcionou — descobre dinamicamente
  const disponiveis = await listarModelosDisponiveis(apiKey)
  for (const nomeModelo of disponiveis) {
    if (MODELOS_CANDIDATOS.includes(nomeModelo)) continue
    try {
      return await tentar(nomeModelo)
    } catch (err) {
      ultimoErro = err
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
    const result = await gerarComFallback(genAI, apiKey, [
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
