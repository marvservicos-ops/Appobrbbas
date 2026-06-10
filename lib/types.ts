export type StatusObra = 'Em Planejamento' | 'Em Andamento' | 'Paralisada' | 'Concluída'
export type TipoServico = 'HVAC' | 'Elétrico' | 'Hidráulico' | 'Civil'
export type StatusEtapa = 'Pendente' | 'Em Andamento' | 'Concluída' | 'Atrasada'
export type CategoriaDoc = 'Financeiro' | 'Técnico' | 'Jurídico' | 'Outros'

export interface Cliente {
  id: string
  nome: string
  email?: string
  telefone?: string
  created_at: string
}

export interface Obra {
  id: string
  titulo: string
  cliente_id: string
  cliente?: Cliente
  tipo_servico: TipoServico
  status: StatusObra
  engenheiro_responsavel?: string
  numero_contrato?: string
  endereco?: string
  valor_estimado?: number
  data_inicio?: string
  previsao_termino?: string
  descricao?: string
  created_at: string
  updated_at: string
}

export interface CronogramaEtapa {
  id: string
  obra_id: string
  titulo: string
  responsavel?: string
  data_inicio?: string
  data_fim?: string
  progresso: number
  status: StatusEtapa
  arquivo_url?: string
  arquivo_nome?: string
  ordem: number
  created_at: string
}

export interface Documento {
  id: string
  obra_id: string
  nome: string
  categoria: CategoriaDoc
  numero_nf?: string
  fornecedor?: string
  valor?: number
  data_documento?: string
  arquivo_url?: string
  arquivo_path?: string
  created_at: string
}

export interface Perfil {
  id: string
  nome: string
  email: string
  avatar_url?: string
  cargo?: string
}
