import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { gerarComFallback, transitorio } from '@/lib/gemini'
import { exigirUsuarioAtivo } from '@/lib/apiAuth'
import { lerNfeXml } from '@/lib/nfeXml'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PROMPT = `Você é um extrator de dados de Nota Fiscal Eletrônica (DANFE) brasileira.
Analise o PDF e retorne APENAS um JSON válido, sem markdown, sem explicações, com esta estrutura exata:
{
  "emitente": "razão social do fornecedor/emitente",
  "emitenteFantasia": "nome fantasia do emitente, se houver",
  "emitenteCnpj": "CNPJ do emitente, só os 14 dígitos",
  "nfNumero": "número da NF (ex: NF 000.086.191)",
  "dataEmissao": "YYYY-MM-DD",
  "valorTotal": 2385.43,
  "duplicatas": [
    { "numero": "001", "vencimento": "YYYY-MM-DD", "valor": 1192.72 }
  ],
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
Retorne null nos campos que não encontrar. Retorne array vazio em produtos se não houver itens.
As duplicatas vêm do quadro "FATURA / DUPLICATAS" (número, vencimento e valor de cada parcela); retorne array vazio se o quadro não existir.`

export async function POST(req: NextRequest) {
  const auth = await exigirUsuarioAtivo()
  if (!auth.ok) return auth.resposta

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

    // XML da NF-e: leitura direta, sem IA
    if (/\.xml$/i.test(file.name) || file.type.includes('xml')) {
      const nota = lerNfeXml(await file.text())
      if (!nota) return NextResponse.json({ error: 'Este XML não parece uma NF-e. Envie o XML da nota ou o PDF (DANFE).' }, { status: 400 })
      return NextResponse.json(nota)
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('[parse-nfe] GEMINI_API_KEY não configurada')
      return NextResponse.json({ error: 'Leitura automática indisponível no momento. Preencha manualmente.' }, { status: 500 })
    }

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
    if (parsed && typeof parsed === 'object') {
      parsed.emitenteCnpj = String(parsed.emitenteCnpj ?? '').replace(/\D/g, '') || null
      parsed.duplicatas = Array.isArray(parsed.duplicatas)
        ? parsed.duplicatas.filter((d: { vencimento?: string; valor?: number }) => d?.vencimento && Number(d.valor) > 0)
        : []
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('parse-nfe gemini error', err)
    const msg = err instanceof Error ? err.message : String(err)
    const motivo = err instanceof SyntaxError
      ? 'Não consegui entender o conteúdo do arquivo.'
      : transitorio(msg) ? 'O serviço de leitura está sobrecarregado.' : 'Não consegui ler o arquivo.'
    return NextResponse.json({ error: `${motivo} Tente de novo ou preencha manualmente.` }, { status: 500 })
  }
}
