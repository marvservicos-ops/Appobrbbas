import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { exigirUsuarioAtivo } from '@/lib/apiAuth'
import { extrairJson, gerarComFallback, transitorio } from '@/lib/gemini'
import type { ComprovanteLido } from '@/lib/cartao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PROMPT = `Você recebe um comprovante de compra brasileiro: cupom fiscal, NFC-e, nota fiscal (DANFE), recibo, comprovante da maquininha ou print de pedido (ex.: Mercado Livre, Amazon).
Retorne APENAS um JSON válido, sem markdown, sem explicações, nesta estrutura:
{
  "data": "YYYY-MM-DD da compra",
  "valor": 123.45,
  "estabelecimento": "nome da loja/vendedor",
  "cnpj": "só os dígitos do CNPJ do emitente, ou null",
  "descricao": "resumo curto do que foi comprado, até 80 caracteres (ex.: 'Combustível 40 L diesel', 'Parafusos e buchas', 'Almoço equipe')"
}
"valor" é o TOTAL PAGO (com desconto e frete). Use null no que não encontrar. Não invente.`

const IMAGEM = /^image\/(png|jpe?g|webp|heic|heif)$/

export async function POST(req: NextRequest) {
  // Qualquer usuário ativo: também lê o comprovante das despesas da obra
  const auth = await exigirUsuarioAtivo()
  if (!auth.ok) return auth.resposta

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('[ler-comprovante] GEMINI_API_KEY não configurada')
      return NextResponse.json({ error: 'Leitura automática indisponível no momento.' }, { status: 500 })
    }
    const file = (await req.formData()).get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

    const ehPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!ehPdf && !IMAGEM.test(file.type)) {
      return NextResponse.json({ error: 'Envie o comprovante em foto ou PDF.' }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const parte = { inlineData: { mimeType: ehPdf ? 'application/pdf' : file.type, data: buffer.toString('base64') } }

    const result = await gerarComFallback(new GoogleGenerativeAI(apiKey), apiKey, [parte, PROMPT])
    const l = (extrairJson(result.response.text()) ?? {}) as Partial<ComprovanteLido>
    const valor = Number(l.valor)
    const lido: ComprovanteLido = {
      data: /^\d{4}-\d{2}-\d{2}$/.test(String(l.data ?? '')) ? String(l.data) : null,
      valor: Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) / 100 : null,
      estabelecimento: l.estabelecimento ? String(l.estabelecimento).trim() : null,
      cnpj: String(l.cnpj ?? '').replace(/\D/g, '') || null,
      descricao: l.descricao ? String(l.descricao).trim().slice(0, 120) : null,
    }
    return NextResponse.json(lido)
  } catch (err) {
    console.error('[ler-comprovante] erro', err)
    const msg = err instanceof Error ? err.message : String(err)
    const motivo = err instanceof SyntaxError
      ? 'Não consegui entender o comprovante.'
      : transitorio(msg) ? 'O serviço de leitura está sobrecarregado.' : 'Não consegui ler o comprovante.'
    return NextResponse.json({ error: `${motivo} Tente de novo.` }, { status: 500 })
  }
}
