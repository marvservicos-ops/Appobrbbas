import { GoogleGenerativeAI } from '@google/generative-ai'

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

export function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)) }

// 503/"overloaded"/"high demand" são transitórios — vale tentar de novo antes de
// desistir do modelo. 404/"not found" significa que o modelo não existe: já pula
// direto pro próximo candidato, sem gastar tempo tentando de novo.
export function transitorio(msg: string) {
  return msg.includes('503') || msg.toLowerCase().includes('overloaded') || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('unavailable')
}
function inexistente(msg: string) {
  return msg.includes('404') || msg.toLowerCase().includes('not found')
}

export async function gerarComFallback(genAI: GoogleGenerativeAI, apiKey: string, parts: any[]) {
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

// Tira o ```json ... ``` que o modelo às vezes devolve em volta do JSON
export function extrairJson(texto: string): unknown {
  const json = texto.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  return JSON.parse(json)
}
