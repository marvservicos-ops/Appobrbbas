export type TipoDocumentoSeguranca = 'apr' | 'pt'

export interface RiscoItem {
  id: string
  etapa: string
  riscos: string
  causas: string
  classificacaoRisco: 'Baixo' | 'Médio' | 'Alto' | ''
  recomendacoes: string
}

export interface MembroEquipe {
  id: string
  nome: string
  cargo: string
  nr35: boolean
  nr12: boolean
}

// ─── Grupos de "Agentes da fatalidade" (grade 3x3 com ícone) ────────────────
export interface GrupoAgenteFatalidade {
  titulo: string
  icone: 'altura' | 'eletricidade' | 'quimicos' | 'quente' | 'carga' | 'moveis' | 'escavacao' | 'confinado' | 'outros'
  itens: string[]
}

export const AGENTES_FATALIDADE_GRUPOS: GrupoAgenteFatalidade[] = [
  { titulo: 'Trabalho em altura', icone: 'altura', itens: ['Trabalho em coberturas', 'Trabalho em andaime', 'Trabalho em PTA', 'Trabalho em escada (acima de 2mt)', 'Outros:'] },
  { titulo: 'Trabalho com eletricidade', icone: 'eletricidade', itens: ['Linha viva até 500 Volts', 'Linha viva acima de 500 Volts', 'Linha morta até 500 Volts', 'Linha morta acima de 500 Volts', 'Trabalho em Subestação', 'Outros'] },
  { titulo: 'Produtos Químicos', icone: 'quimicos', itens: ['Líquidos inflamáveis', 'Amônia / Cloro', 'Solventes', 'Manual', 'Uso pistola', 'Outros'] },
  { titulo: 'Trabalho a quente', icone: 'quente', itens: ['Solda oxiacetileno', 'Solda elétrica', 'Maçarico / Chama viva', 'Esmerilhadeira/Lixadeira', 'Outros'] },
  { titulo: 'Movimentação de carga suspensa', icone: 'carga', itens: ['Munck', 'Guindaste', 'Grua'] },
  { titulo: 'Equipamentos móveis', icone: 'moveis', itens: ['Rolo compressor', 'Retroescavadeira', 'Motoniveladora'] },
  { titulo: 'Escavação', icone: 'escavacao', itens: ['Manual', 'Máquina'] },
  { titulo: 'Espaço Confinado', icone: 'confinado', itens: ['Externo'] },
  { titulo: 'Outros', icone: 'outros', itens: ['Ferramentas manuais e elétricas', 'Trabalho em escada até 2 mt'] },
]

// ─── Riscos Associados ao Trabalho (2 colunas) ──────────────────────────────
export const RISCOS_ASSOCIADOS_COL1: string[] = [
  'Condição climática desfavorável',
  'Desabamento da estrutura / equipamento',
  'Linha de vida / ancoragem inadequada',
  'Queda de materiais',
  'Queda pessoas',
  'Rompimento de cabos / cordas',
  'Contato em partes energizadas',
  'Condições inadequadas para trabalho com eletricidade',
  'Instalações e/ou equipamentos inadequados',
  'Amarração inadequada da carga',
  'Atividade de trabalho em área não permitida',
  'Ausência de instalação de cabo guia',
  'Ausência de patolagem do equipamento',
  'Contato da lança com rede energizada',
  'Comunicação insuficiente',
  'Contato com partes quentes',
]

export const RISCOS_ASSOCIADOS_COL2: string[] = [
  'Ergonomia',
  'Intoxicação por fumos',
  'Movimentação / armazenamento inadequado do cilindro',
  'Projeção de materiais / fagulhas',
  'Projeção de materiais / fagulhas',
  'Quebra de equipamentos',
  'Vazamento de gás',
  'Intoxicação',
  'Irritação via respiratória e cutânea',
  'Asfixia',
  'Perfuração de dutos (água, gás, comunicação e/ou elétrico)',
  'Perfuração de membros',
  'Atropelamento',
  'Influência externa de terceiros',
  'Presença de animais peçonhentos',
  'Vazamento / contaminação',
]

// ─── Precauções Obrigatórias (2 colunas) ────────────────────────────────────
export const PRECAUCOES_COL1: string[] = [
  'Condições atmosféricas são favoráveis (ausência de chuvas, ventos fortes)?',
  'As escadas utilizadas estão em boas condições de segurança?',
  'Os executantes estão em boas condições física e psicológica?',
  'Verificado condições, estabilidade e travamento dos equipamentos?',
  'Foi fixado pranchões ou passarela em trabalhos no telhado?',
  'Os equipamentos de prevenções de queda, estão em perfeitas condições?',
  'Foi realizado check list do equipamento?',
  'As fontes de energia estão desligadas?',
  'As fontes de energia estão bloqueadas?',
  'Foi realizado teste de ausência de tensão?',
  'Os trabalhos com eletricidade serão realizados por dois eletricistas?',
  'Ventilar local da atividade',
  'Evitar atividades simultâneas',
  'Manter FISPQ anexada a PTS',
  'Materiais combustíveis estão ausentes no ambiente?',
  'A máquina de solda está com os cabos em perfeitas condições?',
  'O local foi avaliado por bombeiro civil ou brigadista antes da atividade?',
  'O perigo de condução de calor para outras áreas está controlado?',
  'O cenário de prevenção e combate a incêndio foi montada?',
  'Verificar o trabalho a quente após 60 minutos do término?',
]

export const PRECAUCOES_COL2: string[] = [
  'Foi realizado isolamento e sinalização no perímetro do içamento da carga?',
  'O piso está adequado para patolagem do guindaste ou munck?',
  'O piso está adequado para patolagem do guindaste ou munck?',
  'Foi aplicado o check-list dos equipamento a ser utilizado no içamento?',
  'Foi instalado corda guia ou dispositivo para auxiliar na movimentação?',
  'Foi realizado o plano de rigging e ART para o içamento de carga acima de 5 Ton?',
  'Existe comunicação adequada entre o sinalizador e operador?',
  'Equipamentos e acessórios de içamentos inspecionados e aprovados?',
  'Realizado o isolamento do local e comunicado as áreas fronteiras?',
  'Foi verificado ausência de eletrodutos e/ou dutos subterrâneos?',
  'O local de escavação possui escoramento? (1,25m e taludes)',
  'Existem duas ou mais pessoas envolvidas na atividade?',
  'O acesso as escavações garantem que não haja quedas?',
  'Foi realizada a análise do ambiente utilizando medidor de gases?',
  'Foi verificado o preenchimento da PET para trabalhos em espaço confinado?',
  'Inspecionar os equipamentos para realização da atividade no espaço confinado?',
  'Os equipamentos de resgate estão disponíveis em caso de emergência?',
  'Foi utilizada ventilação externa, assegurando a qualidade do ar respirável?',
  'Foi utilizada ventilação externa, assegurando a qualidade do ar respirável?',
  'A iluminação está adequada?',
]

// ─── EPI (3 colunas) ─────────────────────────────────────────────────────────
export const EPI_COL1: string[] = [
  'Capacete',
  'Capacete 3 pontos',
  'Máscara solda',
  'Protetor facial',
  'Protetor auricular concha',
  'Protetor auricular plug',
  'Respirador PFF1',
  'Respirador PFF2',
  'Máscara semi facial',
  'Filtro vapores org',
  'Filtro solventes',
]

export const EPI_COL2: string[] = [
  'Máscara facial total com adução de ar',
  'Óculos ampla visão',
  'Óculos com protetor lateral policarbonato',
  'Cinto Paraquedista',
  'Boldrie',
  'Avental Raspa / PVC',
  'Vestimenta NR10',
  'Mangote',
  'Luva nitrílica',
  'Luva vaqueta',
  'Luva raspa couro',
]

export const EPI_COL3: string[] = [
  'Luva látex',
  'Luva química',
  'Luva agente térmico (calor)',
  'Luva anti corte',
  'Luva isolante térmica',
  'Luva pigmentada',
  'Perneira raspa',
  'Perneira de couro (peçonha)',
  'Botina seg. antiderrapante com reforço',
  'Botina seg. antiderrapante eletricista',
  'Óculos com proteção lateral',
]

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

  // APR
  riscos: RiscoItem[]

  // PT
  agentesFatalidade: boolean[][]
  riscosAssociadosCol1: boolean[]
  riscosAssociadosCol2: boolean[]
  precaucoesCol1: boolean[]
  precaucoesCol2: boolean[]
  precaucoesOutros: string
  epiCol1: boolean[]
  epiCol2: boolean[]
  epiCol3: boolean[]
  equipeExecucao: MembroEquipe[]
  gestorTvg: string
  solicitantePts: string
  elaboradorPts: string
  dataInspecao: string
  dataElaboracaoPts: string
}

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

export function novoMembroEquipe(): MembroEquipe {
  return { id: crypto.randomUUID(), nome: '', cargo: '', nr35: false, nr12: false }
}

// ─── Modelos reutilizáveis de PT (checklists pré-marcados por tipo de atividade) ──
export interface DadosModeloPt {
  agentesFatalidade: boolean[][]
  riscosAssociadosCol1: boolean[]
  riscosAssociadosCol2: boolean[]
  precaucoesCol1: boolean[]
  precaucoesCol2: boolean[]
  precaucoesOutros: string
  epiCol1: boolean[]
  epiCol2: boolean[]
  epiCol3: boolean[]
}

export interface ModeloPt {
  id: string
  nome: string
  dados: DadosModeloPt
}

export function extrairDadosModelo(form: DocumentoSegurancaFormData): DadosModeloPt {
  return {
    agentesFatalidade: form.agentesFatalidade,
    riscosAssociadosCol1: form.riscosAssociadosCol1,
    riscosAssociadosCol2: form.riscosAssociadosCol2,
    precaucoesCol1: form.precaucoesCol1,
    precaucoesCol2: form.precaucoesCol2,
    precaucoesOutros: form.precaucoesOutros,
    epiCol1: form.epiCol1,
    epiCol2: form.epiCol2,
    epiCol3: form.epiCol3,
  }
}

function normalizarBooleanArray(salvo: boolean[] | undefined, tamanho: number): boolean[] {
  return Array.from({ length: tamanho }, (_, i) => !!salvo?.[i])
}

// Reconstrói os arrays de um modelo salvo no formato atual das listas de
// checklist — protege contra dessincronia caso os itens mudem no futuro.
export function normalizarDadosModelo(dados: Partial<DadosModeloPt> | null | undefined): DadosModeloPt {
  return {
    agentesFatalidade: AGENTES_FATALIDADE_GRUPOS.map((g, gi) => normalizarBooleanArray(dados?.agentesFatalidade?.[gi], g.itens.length)),
    riscosAssociadosCol1: normalizarBooleanArray(dados?.riscosAssociadosCol1, RISCOS_ASSOCIADOS_COL1.length),
    riscosAssociadosCol2: normalizarBooleanArray(dados?.riscosAssociadosCol2, RISCOS_ASSOCIADOS_COL2.length),
    precaucoesCol1: normalizarBooleanArray(dados?.precaucoesCol1, PRECAUCOES_COL1.length),
    precaucoesCol2: normalizarBooleanArray(dados?.precaucoesCol2, PRECAUCOES_COL2.length),
    precaucoesOutros: dados?.precaucoesOutros || '',
    epiCol1: normalizarBooleanArray(dados?.epiCol1, EPI_COL1.length),
    epiCol2: normalizarBooleanArray(dados?.epiCol2, EPI_COL2.length),
    epiCol3: normalizarBooleanArray(dados?.epiCol3, EPI_COL3.length),
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
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    responsavelEmpresa: '',
    responsavelTerceirizado: '',
    descricaoAtividades: '',
    observacoes: '',
    riscos: [novoRiscoItem()],
    agentesFatalidade: AGENTES_FATALIDADE_GRUPOS.map(g => g.itens.map(() => false)),
    riscosAssociadosCol1: RISCOS_ASSOCIADOS_COL1.map(() => false),
    riscosAssociadosCol2: RISCOS_ASSOCIADOS_COL2.map(() => false),
    precaucoesCol1: PRECAUCOES_COL1.map(() => false),
    precaucoesCol2: PRECAUCOES_COL2.map(() => false),
    precaucoesOutros: '',
    epiCol1: EPI_COL1.map(() => false),
    epiCol2: EPI_COL2.map(() => false),
    epiCol3: EPI_COL3.map(() => false),
    equipeExecucao: [novoMembroEquipe()],
    gestorTvg: '',
    solicitantePts: 'João Victor Leal Sameiro',
    elaboradorPts: 'João Victor Leal Sameiro',
    dataInspecao: '',
    dataElaboracaoPts: '',
  }
}
