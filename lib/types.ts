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
  pasta?: string
  numero_nf?: string
  fornecedor?: string
  valor?: number
  data_documento?: string
  arquivo_url?: string
  arquivo_path?: string
  created_at: string
}

export interface DocPasta {
  id: string
  obra_id: string
  nome: string
  cor: string
  ordem: number
  created_at: string
}

export interface Perfil {
  id: string
  nome: string
  email: string
  avatar_url?: string
  cargo?: string
}

// ── Estoque V2 ────────────────────────────────────────
export interface Estoque {
  id: string
  nome: string
  descricao?: string
  cor: string
  icone: string
  created_at: string
}

export interface EstoqueCampo {
  id: string
  estoque_id: string
  nome: string
  tipo: 'text' | 'number' | 'date' | 'unit'
  obrigatorio: boolean
  ordem: number
}

export interface EstoqueProduto {
  id: string
  estoque_id: string
  nome: string
  codigo?: string
  codigo_barras?: string
  unidade: string
  quantidade_atual: number
  quantidade_minima: number
  foto_url?: string
  ativo: boolean
  created_at: string
}

export interface EstoqueRegistroValor {
  id: string
  registro_id: string
  campo_id: string
  valor: string
}

export interface EstoqueRegistro {
  id: string
  estoque_id: string
  produto_id?: string
  produto_nome: string
  tipo: 'entrada' | 'saida'
  quantidade: number
  unidade?: string
  responsavel: string
  assinatura_url?: string
  data: string
  observacoes?: string
  created_at: string
  valores?: EstoqueRegistroValor[]
}
// ──────────────────────────────────────────────────────

export type TipoMovimentacao = 'entrada' | 'saida' | 'devolucao' | 'ajuste'
export type StatusMovimentacao = 'concluido' | 'pendente_devolucao' | 'devolvido_parcial' | 'devolvido_total'

export interface EstoqueCategoria {
  id: string
  nome: string
  cor: string
  icone: string
  created_at: string
}

export interface EstoqueItem {
  id: string
  nome: string
  descricao?: string
  categoria_id?: string
  categoria?: EstoqueCategoria
  unidade: string
  quantidade_atual: number
  quantidade_minima: number
  quantidade_maxima?: number
  codigo_barras?: string
  codigo_interno?: string
  foto_url?: string
  foto_path?: string
  localizacao?: string
  preco_unitario?: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface EstoqueMovimentacao {
  id: string
  item_id: string
  item?: EstoqueItem
  tipo: TipoMovimentacao
  quantidade: number
  quantidade_devolvida: number
  responsavel: string
  obra_id?: string
  obra?: Obra
  motivo?: string
  observacoes?: string
  status: StatusMovimentacao
  data_prevista_devolucao?: string
  data_devolucao?: string
  created_at: string
}
