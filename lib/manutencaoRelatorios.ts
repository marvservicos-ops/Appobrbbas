// Regras dos relatórios de contrato de manutenção (tipos vinculados ao Diário de Obra).
// Usado pela aba Relatórios do contrato e pelas Pendências.

export type Periodicidade = 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'

export const PERIODICIDADES: { valor: Periodicidade; label: string; meses: number }[] = [
  { valor: 'mensal', label: 'Mensal', meses: 1 },
  { valor: 'bimestral', label: 'Bimestral', meses: 2 },
  { valor: 'trimestral', label: 'Trimestral', meses: 3 },
  { valor: 'semestral', label: 'Semestral', meses: 6 },
  { valor: 'anual', label: 'Anual', meses: 12 },
]

export interface ContratoRelatorioTipo {
  id: string
  contrato_id: string
  nome: string
  diario_obra_id: string
  periodicidade: Periodicidade
  mes_inicio: string | null
  ativo: boolean
  ordem: number
}

const indiceMes = (competencia: string) => {
  const [a, m] = competencia.split('-').map(Number)
  return a * 12 + (m - 1)
}

// 'aaaa-mm' somando `n` meses
export function somarMeses(competencia: string, n: number): string {
  const i = indiceMes(competencia) + n
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
}

/** O tipo de relatório é devido nesta competência? `inicioContrato` = data_inicio do contrato. */
export function devidoNoMes(tipo: Pick<ContratoRelatorioTipo, 'periodicidade' | 'mes_inicio'>, competencia: string, inicioContrato?: string | null): boolean {
  const passo = PERIODICIDADES.find(p => p.valor === tipo.periodicidade)?.meses ?? 1
  const inicio = tipo.mes_inicio || inicioContrato?.slice(0, 7)
  if (!inicio) return passo === 1
  const dif = indiceMes(competencia) - indiceMes(inicio)
  return dif >= 0 && dif % passo === 0
}

export function nomeCompetencia(competencia: string, formato: 'curto' | 'longo' = 'curto'): string {
  const [a, m] = competencia.split('-').map(Number)
  const d = new Date(a, m - 1, 15)
  return formato === 'longo'
    ? d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
}
