// Números digitados ou importados no formato brasileiro.

// "1.234,56" → 1234.56 · "1234.56" → 1234.56 · "1,5" → 1.5 · "1.000" → 1000 · "" → NaN
export function parseNumeroBR(v: string | number | null | undefined): number {
  if (typeof v === 'number') return v
  if (v == null) return NaN
  let s = String(v).trim().replace(/\s|R\$/g, '')
  if (!s) return NaN
  const temVirgula = s.includes(',')
  const pontos = (s.match(/\./g) || []).length
  if (temVirgula) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (pontos > 1 || /^\d{1,3}(\.\d{3})+$/.test(s)) {
    // só pontos, em grupos de milhar ("1.000", "1.234.567")
    s = s.replace(/\./g, '')
  }
  return Number(s)
}

// Valor digitado ou o padrão quando vazio/ inválido — aceita 0
// (ao contrário de `parseFloat(x) || padrao`, que troca 0 pelo padrão).
export function numeroOuPadrao(v: string | number | null | undefined, padrao: number): number {
  if (v === '' || v == null) return padrao
  const n = parseNumeroBR(v)
  return Number.isNaN(n) ? padrao : n
}

// Arredonda para evitar 0.30000000000000004 em somas de quantidade/valor
export function arred(n: number, casas = 4): number {
  const f = 10 ** casas
  return Math.round(n * f) / f
}

export const formatarMoeda = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatarQtd = (n: number | null | undefined, casas = 3) =>
  arred(n ?? 0, casas).toLocaleString('pt-BR', { maximumFractionDigits: casas })
