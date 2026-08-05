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

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)) }

// 503/"overloaded"/"high demand" são transitórios — vale tentar de novo antes de
// desistir do modelo. 404/"not found" significa que o modelo não existe: já pula
// direto pro próximo candidato, sem gastar tempo tentando de novo.
function transitorio(msg: string) {
  return msg.includes('503') || msg.toLowerCase().includes('overloaded') || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('unavailable')
}
function inexistente(msg: string) {
  return msg.includes('404') || msg.toLowerCase().includes('not found')
}

async function gerarComFallback(genAI: GoogleGenerativeAI, apiKey: string, parts: any[]) {
  let ultimoErro: unknown = null
  const tentar = async (nomeModelo: string) => {
    const model = genAI.getGenerativeModel({ model: nomeModelo })
    return model.generateContent(parts)
  }

  for (const nomeModelo of MODELOS_CANDIDATOS) {
    const tentativas = 3
    for (let i = 0; i < tentativas; i++) {
      try {
        return await tentar(nomeModelo)
      } catch (err) {
        ultimoErro = err
        const msg = String(err)
        if (inexistente(msg)) break // pula pro próximo modelo, sem retry
        if (transitorio(msg) && i < tentativas - 1) { await sleep(1500 * (i + 1)); continue }
        if (!transitorio(msg)) throw err // erro de verdade (ex: arquivo inválido) — não adianta tentar outro modelo
        break // esgotou as tentativas transitórias neste modelo, tenta o próximo
      }
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

const PROMPT = `Você é um extrator de dados de documentos para controle ESG de uma empresa de manutenção e serviços mecânicos (ar-condicionado, refrigeração).

Analise o documento (pode ser uma nota fiscal, cupom, comprovante, foto de painel de combustível, romaneio de sucata, recibo de venda de gás refrigerante, nota de compra de equipamento/EPI etc.) e identifique a qual das 4 categorias abaixo ele pertence, extraindo os dados correspondentes.

Categorias possíveis:
1. "combustivel" — abastecimento de veículo (posto de gasolina, cupom fiscal de combustível)
2. "investimento" — compra de ferramenta, EPI, equipamento, melhoria ambiental/social/estrutural
3. "destinacao" — venda/entrega de material reciclável (ferro, aço, cobre, alumínio, papelão) para reciclagem
4. "gas" — venda/entrega de gás refrigerante recolhido (R-410A, R-407C, R-22, R-32 etc.) para reciclagem

Retorne APENAS um JSON válido, sem markdown, sem explicações, com esta estrutura exata:
{
  "categoria": "combustivel" | "investimento" | "destinacao" | "gas" | null,
  "data": "YYYY-MM-DD ou null",
  "confianca": "alta" | "media" | "baixa",
  "observacao": "nota curta explicando a classificação ou alertando sobre algo incerto, ou null",

  "combustivel_tipo": "Gasolina" | "Diesel" | "Etanol" | "GNV" | null,
  "combustivel_litros": 25.9 ou null,
  "combustivel_valor": 150.00 ou null,
  "combustivel_veiculo_placa": "placa do veículo se visível impressa no documento, ou null",
  "combustivel_veiculo_nome": "apelido ou nome do veículo, geralmente escrito à mão no cupom/nota (ex: Bongo, Corsa, L200, Amarok, Hb20, Civic/Honda) — procure por qualquer anotação manuscrita no documento, ou null",

  "investimento_item": "nome do item comprado, ou null",
  "investimento_categoria": "Ambiental" | "Social" | "Ferramental" | "SST" | null,
  "investimento_quantidade": 1 ou null,
  "investimento_valor": 0 ou null,

  "destinacao_cliente": "nome do cliente/destino que recebeu o material, ou null",
  "destinacao_material": "Ferro" | "Aço" | "Cobre" | "Alumínio" | "Papelão" | "Metal" | outro texto, ou null,
  "destinacao_quantidade_kg": 0 ou null,
  "destinacao_valor": 0 ou null,

  "gas_empresa_emissora": "nome da empresa/cliente de onde veio o gás, ou null",
  "gas_tipo": "R-410A" | "R-407C" | "R-22" | "R-32" | "R-134A" | outro texto, ou null,
  "gas_quantidade_kg": 0 ou null,
  "gas_valor_recebido": 0 ou null
}

Preencha apenas os campos da categoria identificada; deixe os demais como null. Use ponto decimal (não vírgula) em números. Se não conseguir identificar a categoria com confiança, retorne "categoria": null e explique em "observacao".`

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

    const mimeType = file.type || 'application/pdf'
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')

    const genAI = new GoogleGenerativeAI(apiKey)
    const result = await gerarComFallback(genAI, apiKey, [
      { inlineData: { mimeType, data: base64 } },
      PROMPT,
    ])

    const text = result.response.text().trim()
    const json = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(json)

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('parse-esg gemini error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
