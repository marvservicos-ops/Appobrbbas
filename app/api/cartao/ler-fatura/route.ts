import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as XLSX from 'xlsx'
import { exigirUsuarioAtivo } from '@/lib/apiAuth'
import { extrairJson, gerarComFallback, transitorio } from '@/lib/gemini'
import { lerOfx, type LinhaFatura } from '@/lib/cartao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PROMPT = `Você recebe a fatura de um cartão de crédito corporativo de um banco brasileiro.
Extraia TODOS os lançamentos e retorne APENAS um JSON válido, sem markdown, sem explicações, nesta estrutura:
{
  "vencimento": "YYYY-MM-DD ou null",
  "lancamentos": [
    { "data": "YYYY-MM-DD", "estabelecimento": "nome como aparece na fatura, sem o número da parcela", "valor": 123.45, "parcela": "2/5 ou null" }
  ]
}
Regras:
- Compras, IOF, anuidade, tarifas e juros têm valor POSITIVO. Estornos e créditos têm valor NEGATIVO.
- NÃO inclua o pagamento da fatura anterior, saldo anterior, totais, subtotais nem limites.
- Se a data vier sem ano, use o ano em que a compra foi feita (compras de dezembro numa fatura de janeiro são do ano anterior).
- "parcela" no formato "atual/total" quando a compra for parcelada (ex.: "PARC 02/05" → "2/5").
Não invente lançamentos.`

const IMAGEM = /^image\/(png|jpe?g|webp|heic|heif)$/

function planilhaComoTexto(buffer: Buffer): string {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  return wb.SheetNames.map(nome => `# ${nome}\n${XLSX.utils.sheet_to_csv(wb.Sheets[nome], { dateNF: 'yyyy-mm-dd' })}`).join('\n\n')
}

export async function POST(req: NextRequest) {
  const auth = await exigirUsuarioAtivo({ admin: true })
  if (!auth.ok) return auth.resposta

  try {
    const file = (await req.formData()).get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    const buffer = Buffer.from(await file.arrayBuffer())
    const nome = file.name.toLowerCase()

    // OFX é padrão: lê direto, sem gastar IA
    if (nome.endsWith('.ofx') || nome.endsWith('.qfx')) {
      const lancamentos = lerOfx(buffer.toString('latin1'))
      if (lancamentos.length === 0) return NextResponse.json({ error: 'Não achei lançamentos neste OFX.' }, { status: 400 })
      return NextResponse.json({ lancamentos, vencimento: null })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('[ler-fatura] GEMINI_API_KEY não configurada')
      return NextResponse.json({ error: 'Leitura automática indisponível. Use o arquivo OFX da fatura.' }, { status: 500 })
    }
    let conteudo: object | string
    if (file.type === 'application/pdf' || nome.endsWith('.pdf')) {
      conteudo = { inlineData: { mimeType: 'application/pdf', data: buffer.toString('base64') } }
    } else if (IMAGEM.test(file.type)) {
      conteudo = { inlineData: { mimeType: file.type, data: buffer.toString('base64') } }
    } else if (/\.(xlsx|xls|csv)$/.test(nome)) {
      conteudo = `Conteúdo da planilha exportada do banco:\n\n${planilhaComoTexto(buffer).slice(0, 200_000)}`
    } else {
      return NextResponse.json({ error: 'Envie a fatura em OFX, planilha (xlsx, xls, csv), PDF ou imagem.' }, { status: 400 })
    }

    const result = await gerarComFallback(new GoogleGenerativeAI(apiKey), apiKey, [conteudo, PROMPT])
    const lido = extrairJson(result.response.text()) as { vencimento?: string | null; lancamentos?: Partial<LinhaFatura>[] } | null
    const lancamentos: LinhaFatura[] = (lido?.lancamentos ?? [])
      .map(l => ({
        data: String(l.data ?? '').slice(0, 10),
        estabelecimento: String(l.estabelecimento ?? '').trim() || 'Sem descrição',
        valor: Math.round(Number(l.valor) * 100) / 100,
        parcela: l.parcela ? String(l.parcela).trim() : null,
      }))
      .filter(l => /^\d{4}-\d{2}-\d{2}$/.test(l.data) && Number.isFinite(l.valor) && l.valor !== 0)
    const vencimento = /^\d{4}-\d{2}-\d{2}$/.test(String(lido?.vencimento ?? '')) ? String(lido!.vencimento) : null

    return NextResponse.json({ lancamentos, vencimento })
  } catch (err) {
    console.error('[ler-fatura] erro', err)
    const msg = err instanceof Error ? err.message : String(err)
    const motivo = err instanceof SyntaxError
      ? 'Não consegui entender o conteúdo da fatura.'
      : transitorio(msg) ? 'O serviço de leitura está sobrecarregado.' : 'Não consegui ler a fatura.'
    return NextResponse.json({ error: `${motivo} Tente de novo.` }, { status: 500 })
  }
}
