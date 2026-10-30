// Modelos de documento dos funcionários (Política de Jornada, termos, comunicados...).
// O texto do modelo é HTML com campos {{...}} que o sistema troca pelos dados do
// cadastro na hora de emitir. Campos que não vêm do cadastro ficam em
// `campos_extras` do modelo e entram no texto como {{campo.<chave>}}.

import { formatarData, parseData } from '@/lib/datas'

export interface CampoExtra {
  chave: string
  rotulo: string
  padrao: string
}

export interface DocModelo {
  id: string
  grupo_id: string
  nome: string
  versao: string
  vigencia: string | null
  exige_assinatura: boolean
  coletivo: boolean
  conteudo_html: string
  campos_extras: CampoExtra[]
  arquivo_origem: string | null
  atual: boolean
  ativo: boolean
  criado_por_nome: string | null
  created_at: string
}

export interface DadosEmpresa {
  razao_social: string
  cnpj: string
  endereco: string
  responsavel_nome: string
  responsavel_cargo: string
}

export const EMPRESA_DOCS_PADRAO: DadosEmpresa = {
  razao_social: 'MARV MANUTENÇÃO E SERVIÇOS LTDA EPP',
  cnpj: '03.709.796/0001-44',
  endereco: 'Estrada do Rio Grande, 268 – Taquara, Rio de Janeiro/RJ',
  responsavel_nome: 'Marcelo Lopes Leal',
  responsavel_cargo: 'Sócio-Proprietário',
}

// Só o que o preenchimento usa do cadastro do funcionário
export interface FuncionarioDoc {
  id: string
  nome: string
  cpf: string | null
  cargo: string | null
  funcao: string | null
  telefone?: string | null
  email?: string | null
  data_admissao?: string | null
}

export const CAMPO_LISTA_RECEBIMENTO = 'lista_recebimento'

// Campos automáticos, na ordem em que aparecem no editor. `obrigatorio`: se o
// modelo usa o campo e o funcionário não tem o dado, a emissão avisa antes de gerar.
export const CAMPOS_SISTEMA: { chave: string; rotulo: string; grupo: 'Funcionário' | 'Empresa' | 'Documento'; obrigatorio?: boolean }[] = [
  { chave: 'funcionario.nome', rotulo: 'Nome', grupo: 'Funcionário', obrigatorio: true },
  { chave: 'funcionario.cpf', rotulo: 'CPF', grupo: 'Funcionário', obrigatorio: true },
  { chave: 'funcionario.cargo', rotulo: 'Cargo', grupo: 'Funcionário', obrigatorio: true },
  { chave: 'funcionario.funcao', rotulo: 'Função', grupo: 'Funcionário', obrigatorio: true },
  { chave: 'funcionario.data_admissao', rotulo: 'Data de admissão', grupo: 'Funcionário', obrigatorio: true },
  { chave: 'funcionario.telefone', rotulo: 'Telefone', grupo: 'Funcionário', obrigatorio: true },
  { chave: 'funcionario.email', rotulo: 'E-mail', grupo: 'Funcionário', obrigatorio: true },
  { chave: 'empresa.nome', rotulo: 'Razão social', grupo: 'Empresa' },
  { chave: 'empresa.cnpj', rotulo: 'CNPJ', grupo: 'Empresa' },
  { chave: 'empresa.endereco', rotulo: 'Endereço', grupo: 'Empresa' },
  { chave: 'responsavel.nome', rotulo: 'Responsável', grupo: 'Empresa' },
  { chave: 'responsavel.cargo', rotulo: 'Cargo do responsável', grupo: 'Empresa' },
  { chave: 'data_emissao', rotulo: 'Data (dd/mm/aaaa)', grupo: 'Documento' },
  { chave: 'data_emissao_extenso', rotulo: 'Data por extenso', grupo: 'Documento' },
  { chave: 'modelo.versao', rotulo: 'Versão do modelo', grupo: 'Documento' },
  { chave: 'modelo.vigencia', rotulo: 'Vigência do modelo', grupo: 'Documento' },
  { chave: CAMPO_LISTA_RECEBIMENTO, rotulo: 'Lista de recebimento', grupo: 'Documento' },
]

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

// '2026-11-03' → '03 de novembro de 2026'
export function dataPorExtenso(v: string): string {
  const d = parseData(v)
  return `${String(d.getDate()).padStart(2, '0')} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

const RE_CAMPO = /\{\{\s*([a-z0-9_.]+)\s*\}\}/gi

// Chaves usadas no texto, sem repetir
export function camposUsados(html: string): string[] {
  return Array.from(new Set(Array.from(html.matchAll(RE_CAMPO), m => m[1])))
}

// Campos {{...}} do texto que não existem (nem no sistema nem nos extras do modelo)
export function camposDesconhecidos(html: string, extras: CampoExtra[]): string[] {
  const validos = new Set([...CAMPOS_SISTEMA.map(c => c.chave), ...extras.map(e => `campo.${e.chave}`)])
  return camposUsados(html).filter(c => !validos.has(c))
}

export function valoresFuncionario(f: FuncionarioDoc): Record<string, string> {
  return {
    'funcionario.nome': f.nome ?? '',
    'funcionario.cpf': f.cpf ?? '',
    // Cargo vazio no cadastro → usa a função
    'funcionario.cargo': f.cargo || f.funcao || '',
    'funcionario.funcao': f.funcao || f.cargo || '',
    'funcionario.data_admissao': formatarData(f.data_admissao),
    'funcionario.telefone': f.telefone ?? '',
    'funcionario.email': f.email ?? '',
  }
}

export function valoresGerais(modelo: Pick<DocModelo, 'versao' | 'vigencia'>, empresa: DadosEmpresa, dataEmissao: string, extras: Record<string, string>): Record<string, string> {
  const v: Record<string, string> = {
    'empresa.nome': empresa.razao_social,
    'empresa.cnpj': empresa.cnpj,
    'empresa.endereco': empresa.endereco,
    'responsavel.nome': empresa.responsavel_nome,
    'responsavel.cargo': empresa.responsavel_cargo,
    'data_emissao': formatarData(dataEmissao),
    'data_emissao_extenso': dataPorExtenso(dataEmissao),
    'modelo.versao': modelo.versao,
    'modelo.vigencia': formatarData(modelo.vigencia),
  }
  for (const [chave, valor] of Object.entries(extras)) v[`campo.${chave}`] = valor
  return v
}

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Tabela de recebimento do documento coletivo (uma linha por funcionário). O título fica no texto do modelo.
export function htmlListaRecebimento(funcionarios: Pick<FuncionarioDoc, 'nome'>[]): string {
  const linhas = funcionarios.map(f => `<tr><td><p>${escapar(f.nome)}</p></td><td><p></p></td><td><p></p></td></tr>`).join('')
  return `<table class="lista-recebimento"><tbody><tr><th><p>Nome</p></th><th><p>Data</p></th><th><p>Assinatura</p></th></tr>${linhas}</tbody></table>`
}

// Troca os campos pelos valores. Campo sem valor fica como "____" para preencher à mão.
export function preencher(html: string, valores: Record<string, string>, listaRecebimento?: string): string {
  let saida = html
  if (listaRecebimento != null) {
    // O campo costuma estar sozinho num parágrafo: troca o parágrafo inteiro pela tabela
    saida = saida.replace(new RegExp(`<p>\\s*\\{\\{\\s*${CAMPO_LISTA_RECEBIMENTO}\\s*\\}\\}\\s*</p>`, 'g'), listaRecebimento)
  }
  return saida.replace(RE_CAMPO, (_, chave: string) => {
    if (chave === CAMPO_LISTA_RECEBIMENTO) return listaRecebimento ?? ''
    const v = valores[chave]
    return v ? escapar(v) : '<span class="campo-vazio">______________</span>'
  })
}

// Dados obrigatórios que faltam para cada funcionário, considerando só os campos que o modelo usa
export function pendenciasCadastro(html: string, funcionarios: FuncionarioDoc[]): { funcionario: FuncionarioDoc; faltando: string[] }[] {
  const usados = new Set(camposUsados(html))
  const exigidos = CAMPOS_SISTEMA.filter(c => c.obrigatorio && usados.has(c.chave))
  return funcionarios
    .map(f => {
      const v = valoresFuncionario(f)
      return { funcionario: f, faltando: exigidos.filter(c => !v[c.chave]?.trim()).map(c => c.rotulo) }
    })
    .filter(p => p.faltando.length > 0)
}

// Próxima versão sugerida ao editar: '1.0' → '1.1', '2' → '3', 'v1.9' → 'v1.10'
export function proximaVersao(v: string): string {
  const m = v.match(/^(.*?)(\d+)$/)
  return m ? `${m[1]}${Number(m[2]) + 1}` : `${v}.1`
}

// Status inicial do documento emitido
export function statusInicial(modelo: Pick<DocModelo, 'exige_assinatura' | 'coletivo'>): 'pendente' | 'entregue' {
  return modelo.exige_assinatura || modelo.coletivo ? 'pendente' : 'entregue'
}

// CSS do documento impresso — usado na impressão e na pré-visualização
export const CSS_DOCUMENTO = `
.doc-funcionario { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.55; color: #1a1a1a; }
.doc-funcionario h1 { font-size: 17px; text-align: center; margin: 0 0 12px; }
.doc-funcionario h2 { font-size: 13px; margin: 18px 0 6px; }
.doc-funcionario h3 { font-size: 12px; margin: 14px 0 4px; }
.doc-funcionario p { margin: 0 0 8px; }
.doc-funcionario ul, .doc-funcionario ol { margin: 0 0 8px; padding-left: 22px; }
.doc-funcionario li p { margin: 0 0 3px; }
.doc-funcionario table { border-collapse: collapse; width: 100%; margin: 6px 0 10px; }
.doc-funcionario th, .doc-funcionario td { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; }
.doc-funcionario th { background: #f2f2f2; }
.doc-funcionario th p, .doc-funcionario td p { margin: 0; }
.doc-funcionario table.lista-recebimento td { height: 26px; }
.doc-funcionario .campo-vazio { color: #1a1a1a; }
`
