export type StatusObra = 'Em Orçamento' | 'Aprovada' | 'Em Andamento' | 'Concluída'
export interface TipoServico {
  id: string
  nome: string
  ordem: number
  created_at: string
}
export type StatusEtapa = 'Pendente' | 'Em Andamento' | 'Concluída' | 'Atrasada'
export type CategoriaDoc = 'Financeiro' | 'Técnico' | 'Jurídico' | 'Outros'

export type TipoCliente = 'Gestor' | 'Comprador'

export interface Empresa {
  id: string
  razao_social: string
  apelido?: string
  cnpj?: string
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string
  telefone?: string
  email?: string
  created_at: string
}

export interface Cliente {
  id: string
  nome: string
  email?: string
  telefone?: string
  tipo?: TipoCliente
  cargo?: string
  empresa_id?: string | null
  empresa?: Empresa
  created_at: string
}

export interface Obra {
  id: string
  titulo: string
  cliente_id: string
  cliente?: Cliente
  tipo_servico: string
  status: StatusObra
  engenheiro_responsavel?: string
  numero_contrato?: string
  endereco?: string
  pavimento?: string
  data_inicio?: string
  previsao_termino?: string
  data_aprovacao_contrato?: string
  descricao?: string
  gestor_id?: string | null
  comprador_id?: string | null
  gestor?: Cliente
  comprador?: Cliente
  valor_art?: number | null
  diario_obra_id?: string | null
  created_at: string
  updated_at: string
}

export interface DiarioObraRelatorio {
  id: string
  obra_id?: string | null
  diario_obra_id_externo: string
  diario_obra_nome?: string | null
  diario_relatorio_id: string
  numero?: number | null
  data?: string | null
  status_descricao?: string | null
  drive_file_id?: string | null
  drive_file_url?: string | null
  importado_em: string
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
  cor?: string
  numero_item?: string
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
  parent_id?: string | null
  created_at: string
}

export interface Perfil {
  id: string
  nome: string
  email: string
  avatar_url?: string
  cargo?: string
}

export type TipoOC = 'servico' | 'material' | 'outro'
export type StatusOC = 'ativa' | 'concluida'

export interface ObraOC {
  id: string
  obra_id: string
  numero_oc: string
  tipo: TipoOC
  valor_total: number
  observacoes?: string | null
  status: StatusOC
  created_at: string
  updated_at: string
}

export interface ObraMedicao {
  id: string
  obra_id: string
  aditivo_id?: string | null
  oc_id?: string | null
  oc?: ObraOC
  ordem: number
  nome: string
  percentual: number
  valor_previsto: number
  status: 'planejada' | 'solicitada' | 'faturada' | 'recebida' | 'atrasada' | 'cancelada'
  data_prevista?: string
  data_emissao?: string
  data_vencimento?: string
  data_pagamento?: string
  valor_faturado?: number
  valor_recebido?: number
  numero_nf?: string
  nf_nome?: string
  nf_path?: string
  observacoes?: string
  created_at: string
  updated_at: string
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
  preco_unitario?: number | null
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
  obra_id?: string | null
  funcionario_id?: string | null
  manutencao_id?: string | null
  destino_tipo?: 'obra' | 'manutencao' | 'uso_interno' | 'funcionario' | null
  lote_id?: string | null
  preco_unitario_custo?: number | null
  valor_total?: number | null
  registro_origem_id?: string | null
  created_at: string
  valores?: EstoqueRegistroValor[]
  obra?: { titulo: string } | null
  funcionario?: { nome: string } | null
  manutencao?: { numero_contrato: string | null; empresa?: { razao_social: string; apelido?: string | null } | null } | null
}
// ──────────────────────────────────────────────────────

// ── Estoque em cliente de manutenção ───────────────────
export interface ManutencaoEstoqueProduto {
  id: string
  contrato_id: string
  produto_id: string
  produto?: EstoqueProduto
  quantidade_atual: number
  quantidade_minima: number
  created_at: string
}

export interface ManutencaoEstoqueRegistro {
  id: string
  contrato_id: string
  produto_id: string
  produto?: EstoqueProduto
  tipo: 'entrada' | 'saida'
  quantidade: number
  responsavel?: string | null
  data: string
  observacoes?: string | null
  origem_estoque_registro_id?: string | null
  created_at: string
}
// ──────────────────────────────────────────────────────

// ── Materiais de uso dentro de uma mala de ferramentas ──
export interface MalaEstoqueProduto {
  id: string
  mala_id: string
  produto_id: string
  produto?: EstoqueProduto
  quantidade_atual: number
  quantidade_minima: number
  created_at: string
}

export interface MalaEstoqueRegistro {
  id: string
  mala_id: string
  produto_id: string
  produto?: EstoqueProduto
  tipo: 'entrada' | 'saida'
  quantidade: number
  responsavel?: string | null
  data: string
  observacoes?: string | null
  origem_estoque_registro_id?: string | null
  created_at: string
}
// ──────────────────────────────────────────────────────

// ── RDO ──────────────────────────────────────────────
export interface RDO {
  id: string; obra_id: string; numero: number; data: string
  status: 'preenchendo' | 'revisando' | 'aprovado'
  indice_pluviometrico?: string; created_at: string
}
export interface RDOClima {
  id: string; rdo_id: string; periodo: 'manha' | 'tarde' | 'noite'
  ativo: boolean; tempo?: string; condicao?: string
}
export interface RDOMaoObra { id: string; rdo_id: string; funcao: string; tipo: string; quantidade: number }
export interface RDOEquipamento { id: string; rdo_id: string; nome: string; quantidade: number }
export interface RDOAtividade { id: string; rdo_id: string; descricao: string; progresso: number; status_ativ: string; ordem: number }
export interface RDOOcorrencia { id: string; rdo_id: string; descricao: string; created_at: string }
export interface RDOComentario { id: string; rdo_id: string; autor: string; texto: string; created_at: string }
export interface RDOFoto { id: string; rdo_id: string; url: string; path?: string; legenda?: string; ordem: number; created_at: string }
export interface RDOAssinatura { id: string; rdo_id: string; tipo: string; nome?: string; assinatura_url?: string; assinado_em?: string }
// ──────────────────────────────────────────────────────

// ── Manutenções ───────────────────────────────────────
export type TipoEquipamentoAC = 'Split' | 'Cassete' | 'VRF' | 'Janela' | 'Piso-teto' | 'Outro' | string

export interface ContratoManutencao {
  id: string
  cliente_id: string
  cliente?: Cliente
  empresa_id?: string | null
  empresa?: Empresa
  numero_contrato?: string | null
  valor_mensal: number
  data_inicio: string
  data_fim?: string | null
  ativo: boolean
  observacoes?: string | null
  created_at: string
}

export interface ManutencaoAditivo {
  id: string
  contrato_id: string
  descricao: string
  valor: number
  data: string
  created_at: string
}

export interface ManutencaoNF {
  id: string
  contrato_id: string
  competencia: string
  valor: number
  numero_nf?: string | null
  status: 'pendente' | 'emitida'
  arquivo_url?: string | null
  observacoes?: string | null
  created_at: string
}

export interface ManutencaoFuncionario {
  id: string
  contrato_id: string
  funcionario_id: string
  funcionario?: { id: string; nome: string; cargo: string | null }
  tipo: 'fixo' | 'eventual'
}

export interface Equipamento {
  id: string
  contrato_id: string
  nome: string
  tipo: TipoEquipamentoAC
  marca?: string | null
  modelo?: string | null
  capacidade_btu?: number | null
  numero_serie?: string | null
  localizacao?: string | null
  data_instalacao?: string | null
  foto_url?: string | null
  ativo: boolean
  created_at: string
}

export interface ManutencaoHistorico {
  id: string
  equipamento_id: string
  competencia: string
  preventiva_feita: boolean
  corretiva: boolean
  corretiva_descricao?: string | null
  corretiva_custo?: number | null
  created_at: string
}
// ──────────────────────────────────────────────────────

// ── ESG ──────────────────────────────────────────────
export interface EsgCombustivel {
  id: string
  data: string
  veiculo_id?: string | null
  veiculo?: { id: string; nome: string; placa: string | null } | null
  combustivel: string
  litros: number
  valor: number
  observacoes?: string | null
  created_at: string
}

export type EsgInvestimentoCategoria = 'Ambiental' | 'Social' | 'Ferramental' | 'SST'

export interface EsgInvestimento {
  id: string
  data: string
  item: string
  categoria: EsgInvestimentoCategoria
  quantidade: number
  valor: number
  observacoes?: string | null
  created_at: string
}

export interface EsgDestinacaoMaterial {
  id: string
  data: string
  cliente: string
  material: string
  quantidade: number
  valor?: number | null
  observacoes?: string | null
  created_at: string
}

export interface EsgReciclagemGas {
  id: string
  data: string
  empresa_emissora: string
  manutencao_contrato_id?: string | null
  contrato?: { id: string; numero_contrato: string | null; empresa?: { razao_social: string; apelido?: string | null } | null } | null
  tipo_gas: string
  quantidade: number
  valor_recebido?: number | null
  observacoes?: string | null
  created_at: string
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
  preco_unitario_custo?: number
  valor_total?: number
  data_prevista_devolucao?: string
  data_devolucao?: string
  created_at: string
}

// ── Ferramentas (patrimônio/ativos rastreáveis) ────────
export type FerramentaStatus = 'disponivel' | 'emprestada' | 'em_manutencao' | 'baixada'

export interface Ferramenta {
  id: string
  estoque_id: string
  nome: string
  codigo_interno?: string | null
  categoria?: string | null
  marca?: string | null
  modelo?: string | null
  numero_serie?: string | null
  valor_aquisicao?: number | null
  data_aquisicao?: string | null
  foto_url?: string | null
  foto_url_2?: string | null
  status: FerramentaStatus
  observacoes?: string | null
  eh_mala: boolean
  mala_id?: string | null
  mala?: { id: string; nome: string; codigo_interno?: string | null; responsavel_atual?: { id: string; nome: string } | null } | null
  responsavel_atual_id?: string | null
  responsavel_atual?: { id: string; nome: string; cargo?: string | null; funcao?: string | null; cpf?: string | null } | null
  created_at: string
  updated_at: string
}

export interface FerramentaEmprestimo {
  id: string
  funcionario_id: string
  funcionario?: { id: string; nome: string; cargo?: string | null; funcao?: string | null; cpf?: string | null }
  obra_id?: string | null
  obra?: { id: string; titulo: string }
  data_emprestimo: string
  data_prevista_devolucao?: string | null
  observacoes?: string | null
  responsavel?: string | null
  created_at: string
}

export interface FerramentaEmprestimoItem {
  id: string
  emprestimo_id: string
  emprestimo?: FerramentaEmprestimo
  ferramenta_id: string
  ferramenta?: Ferramenta
  data_devolucao?: string | null
  observacoes_devolucao?: string | null
  created_at: string
}

export interface FerramentaDefeito {
  id: string
  ferramenta_id: string
  descricao: string
  custo?: number | null
  data: string
  resolvido: boolean
  data_resolucao?: string | null
  created_at: string
}

export interface CampoTecnico {
  id: string
  nome: string
  unidade?: string | null
  ordem: number
}

export interface FerramentaDado {
  id: string
  ferramenta_id: string
  campo_id: string
  valor: string
  campo: CampoTecnico
  created_at: string
}
// ──────────────────────────────────────────────────────
