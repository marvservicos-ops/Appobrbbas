export type TipoDocumentoSeguranca = 'apr' | 'pt'

export interface RiscoItem {
  id: string
  etapa: string
  riscos: string
  causas: string
  classificacaoRisco: 'Baixo' | 'Médio' | 'Alto' | ''
  recomendacoes: string
}

export interface AgentesFatalidade {
  trabalhoAltura: boolean
  andaimes: boolean
  pta: boolean
  escadas: boolean
  isolacaoArea: boolean
  bloqueioEletricoLoto: boolean
}

export interface DocumentoSegurancaFormData {
  obraId: string
  numeroDocumento: string
  cliente: string
  empresa: string
  local: string
  dataInicio: string
  dataTermino: string
  horario: string
  cidade: string
  estado: string
  responsavelEmpresa: string
  responsavelTerceirizado: string
  descricaoAtividades: string
  observacoes: string
  riscos: RiscoItem[]
  agentesFatalidade: AgentesFatalidade
  episObrigatorios: string[]
  episOutros: string
}

export const EPIS_DISPONIVEIS = [
  'Capacete',
  'Óculos de proteção',
  'Protetor auricular',
  'Luva de raspa/couro',
  'Luva de látex/nitrílica',
  'Botina de segurança',
  'Cinto paraquedista c/ talabarte',
  'Máscara/respirador',
  'Vestimenta NR10',
  'Perneira',
] as const

export function novoRiscoItem(): RiscoItem {
  return {
    id: crypto.randomUUID(),
    etapa: '',
    riscos: '',
    causas: '',
    classificacaoRisco: '',
    recomendacoes: '',
  }
}

export function criarFormDataInicial(): DocumentoSegurancaFormData {
  return {
    obraId: '',
    numeroDocumento: '',
    cliente: '',
    empresa: 'MARV Manutenção e Serviços Ltda EPP',
    local: '',
    dataInicio: '',
    dataTermino: '',
    horario: '08:00 às 18:00',
    cidade: '',
    estado: '',
    responsavelEmpresa: '',
    responsavelTerceirizado: '',
    descricaoAtividades: '',
    observacoes: '',
    riscos: [novoRiscoItem()],
    agentesFatalidade: {
      trabalhoAltura: false,
      andaimes: false,
      pta: false,
      escadas: false,
      isolacaoArea: false,
      bloqueioEletricoLoto: false,
    },
    episObrigatorios: [],
    episOutros: '',
  }
}
