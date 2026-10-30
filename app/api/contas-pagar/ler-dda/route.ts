import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as XLSX from 'xlsx'
import { exigirUsuarioAtivo } from '@/lib/apiAuth'
import { extrairJson, gerarComFallback, transitorio } from '@/lib/gemini'
import type { BoletoDda } from '@/lib/contasPagar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PROMPT = `Você recebe o extrato de DDA (Débito Direto Autorizado) de um banco brasileiro: a lista de boletos emitidos contra a empresa.
Extraia TODOS os boletos e retorne APENAS um JSON válido, sem markdown, sem explicações, nesta estrutura:
{
  "boletos": [
    { "beneficiario": "razão social do beneficiário/cedente", "cnpj": "só os dígitos do CNPJ/CPF do beneficiário", "vencimento": "YYYY-MM-DD", "valor": 1234.56 }
  ]
}
Use o valor do documento (não o valor com juros/multa). Use null em beneficiario ou cnpj se não houver. Não invente boletos; ignore totais e cabeçalhos.`

const IMAGEM = /^image\/(png|jpe?g|webp|heic|heif)$/

// Planilha (xlsx/xls/csv) vira texto CSV para o modelo ler, qualquer que seja o layout do banco
function planilhaComoTexto(buffer: Buffer): string {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  return wb.SheetNames.map(nome => `# ${nome}\n${XLSX.utils.sheet_to_csv(wb.Sheets[nome], { dateNF: 'yyyy-mm-dd' })}`).join('\n\n')
}

export async function POST(req: NextRequest) {
  const auth = await exigirUsuarioAtivo({ permissao: 'contas_pagar' })
  if (!auth.ok) return auth.resposta

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('[ler-dda] GEMINI_API_KEY não configurada')
      return NextResponse.json({ error: 'Leitura automática indisponível no momento.' }, { status: 500 })
    }
    const file = (await req.formData()).get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const nome = file.name.toLowerCase()
    let conteudo: object | string
    if (file.type === 'application/pdf' || nome.endsWith('.pdf')) {
      conteudo = { inlineData: { mimeType: 'application/pdf', data: buffer.toString('base64') } }
    } else if (IMAGEM.test(file.type)) {
      conteudo = { inlineData: { mimeType: file.type, data: buffer.toString('base64') } }
    } else if (/\.(xlsx|xls|csv)$/.test(nome)) {
      conteudo = `Conteúdo da planilha exportada do banco:\n\n${planilhaComoTexto(buffer).slice(0, 200_000)}`
    } else {
      return NextResponse.json({ error: 'Envie o extrato em PDF, imagem (foto/print) ou planilha (xlsx, xls, csv).' }, { status: 400 })
    }

    const result = await gerarComFallback(new GoogleGenerativeAI(apiKey), apiKey, [conteudo, PROMPT])
    const lido = extrairJson(result.response.text()) as { boletos?: Partial<BoletoDda>[] } | null
    const boletos: BoletoDda[] = (lido?.boletos ?? [])
      .map(b => ({
        beneficiario: b.beneficiario ? String(b.beneficiario).trim() : null,
        cnpj: String(b.cnpj ?? '').replace(/\D/g, '') || null,
        vencimento: String(b.vencimento ?? '').slice(0, 10),
        valor: Number(b.valor),
      }))
      .filter(b => /^\d{4}-\d{2}-\d{2}$/.test(b.vencimento) && b.valor > 0)

    return NextResponse.json({ boletos })
  } catch (err) {
    console.error('[ler-dda] erro', err)
    const msg = err instanceof Error ? err.message : String(err)
    const motivo = err instanceof SyntaxError
      ? 'Não consegui entender o conteúdo do extrato.'
      : transitorio(msg) ? 'O serviço de leitura está sobrecarregado.' : 'Não consegui ler o extrato.'
    return NextResponse.json({ error: `${motivo} Tente de novo.` }, { status: 500 })
  }
}
