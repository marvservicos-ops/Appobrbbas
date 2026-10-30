// Datas no fuso de quem usa (Brasil). Evite `new Date().toISOString().split('T')[0]`:
// toISOString é UTC, e depois das 21h já devolve o dia seguinte.

// 'aaaa-mm-dd' de uma data, no fuso local
export const dataLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// 'aaaa-mm-dd' de hoje, no fuso local (valor padrão de campos <input type="date">)
export const hojeLocal = () => dataLocal(new Date())

// 'aaaa-mm' do mês atual, no fuso local
export const mesLocal = () => hojeLocal().slice(0, 7)

// Converte 'aaaa-mm-dd' (ou timestamp ISO) em Date sem voltar um dia.
// `new Date('2026-10-30')` é meia-noite UTC = 29/10 às 21h no Brasil.
export function parseData(v: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T12:00:00') : new Date(v)
}

// 'dd/mm/aaaa' a partir de 'aaaa-mm-dd' (ou timestamp ISO). Vazio → ''.
export function formatarData(v: string | null | undefined): string {
  if (!v) return ''
  return parseData(v).toLocaleDateString('pt-BR')
}

// 'mm/aaaa' a partir de 'aaaa-mm'
export function formatarCompetencia(v: string | null | undefined): string {
  if (!v) return ''
  const [a, m] = v.split('-')
  return m ? `${m}/${a}` : v
}

// Dias inteiros de `a` até `b` ('aaaa-mm-dd'), sem erro de fuso
export function diasEntre(a: string, b: string): number {
  return Math.round((parseData(b).getTime() - parseData(a).getTime()) / 86400000)
}

// 'aaaa-mm-dd' somando n dias (n pode ser negativo)
export function somarDias(v: string, n: number): string {
  const d = parseData(v)
  d.setDate(d.getDate() + n)
  return dataLocal(d)
}

// Segunda-feira da semana (segunda a domingo) que contém a data
export function segundaDaSemana(v: string): string {
  return somarDias(v, -((parseData(v).getDay() + 6) % 7))
}
