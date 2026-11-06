// Solicitação de liberação de acesso (funcionários e/ou veículos) para uma obra
// ou local avulso. Usado na tela (pré-visualização, Excel) e na rota de envio.

import * as XLSX from 'xlsx'
import { diasEntre, formatarData } from '@/lib/datas'

export interface LiberacaoFuncionario {
  chave: string
  funcionario_id: string | null
  nome: string
  cpf: string
  funcao: string
}

export interface LiberacaoMotorista {
  funcionario_id: string | null
  nome: string
  cpf: string
}

export interface LiberacaoVeiculo {
  chave: string
  veiculo_id: string | null
  nome: string
  placa: string
  cor: string
  motoristas: LiberacaoMotorista[]
}

export interface Liberacao {
  id: string
  obra_id: string | null
  local_nome: string
  local_endereco: string | null
  local_cliente: string | null
  data_inicio: string
  data_fim: string
  horario: string | null
  funcionarios: LiberacaoFuncionario[]
  veiculos: LiberacaoVeiculo[]
  destinatarios: string[]
  cc: string[]
  assunto: string
  mensagem: string
  status: 'rascunho' | 'enviada'
  envios: number
  enviada_em: string | null
  enviada_por_nome: string | null
  criado_por_nome: string | null
  created_at: string
  updated_at: string
}

// Só o que importa para montar o texto, as tabelas e o Excel
export type DadosLiberacao = Pick<Liberacao,
  'local_nome' | 'local_endereco' | 'local_cliente' | 'data_inicio' | 'data_fim' | 'horario' | 'funcionarios' | 'veiculos'>

export const novaChave = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : Math.random().toString(36).slice(2)

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/
export const emailValido = (e: string) => EMAIL_RE.test(e.trim())

// Aceita "a@x.com; b@y.com", "Nome <a@x.com>" etc. e devolve só os endereços
export function extrairEmails(texto: string): string[] {
  return texto
    .split(/[,;\s]+/)
    .map(p => p.replace(/^.*</, '').replace(/>.*$/, '').trim())
    .filter(emailValido)
}

export function tipoLiberacao(d: Pick<DadosLiberacao, 'funcionarios' | 'veiculos'>): string {
  const f = d.funcionarios.length > 0
  const v = d.veiculos.length > 0
  if (f && v) return d.veiculos.length > 1 ? 'Funcionários e veículos' : 'Funcionários e veículo'
  if (v) return d.veiculos.length > 1 ? 'Veículos' : 'Veículo'
  return d.funcionarios.length === 1 ? 'Funcionário' : 'Funcionários'
}

export function textoPeriodo(d: Pick<DadosLiberacao, 'data_inicio' | 'data_fim'>): string {
  if (!d.data_inicio) return ''
  if (!d.data_fim || d.data_fim === d.data_inicio) return `no dia ${formatarData(d.data_inicio)}`
  const dias = diasEntre(d.data_inicio, d.data_fim) + 1
  return `de ${formatarData(d.data_inicio)} a ${formatarData(d.data_fim)} (${dias} dias)`
}

const periodoCurto = (d: Pick<DadosLiberacao, 'data_inicio' | 'data_fim'>) =>
  !d.data_fim || d.data_fim === d.data_inicio
    ? formatarData(d.data_inicio).slice(0, 5)
    : `${formatarData(d.data_inicio).slice(0, 5)} a ${formatarData(d.data_fim).slice(0, 5)}`

export function assuntoPadrao(d: DadosLiberacao): string {
  return `Solicitação de liberação – ${tipoLiberacao(d)} – ${d.local_nome || 'local'} – ${periodoCurto(d)}`
}

// Texto de abertura (as tabelas entram logo abaixo, automaticamente)
export function mensagemPadrao(d: DadosLiberacao): string {
  const o_que: string[] = []
  if (d.funcionarios.length) o_que.push(d.funcionarios.length === 1 ? 'do funcionário' : 'dos funcionários')
  if (d.veiculos.length) o_que.push(d.veiculos.length === 1 ? 'do veículo' : 'dos veículos')
  const local = [d.local_nome, d.local_endereco].filter(Boolean).join(', ')
  const horario = d.horario?.trim() ? `, ${d.horario.trim()}` : ''
  return [
    'Prezados(as),',
    '',
    `Solicitamos a liberação de acesso ${o_que.join(' e ') || 'dos itens'} relacionados abaixo para ${local || 'o local indicado'}, ${textoPeriodo(d)}${horario}.`,
    '',
    'Os dados estão na tabela abaixo e também na planilha em anexo.',
    '',
    'Ficamos à disposição.',
  ].join('\n')
}

// ── HTML do e-mail ───────────────────────────────────────────────────────
export function escapar(t: string | null | undefined): string {
  return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const TH = 'style="border:1px solid #CBD5E1;background:#F1F5F9;padding:6px 10px;text-align:left;font-size:13px"'
const TD = 'style="border:1px solid #CBD5E1;padding:6px 10px;font-size:13px"'
const TABELA = 'style="border-collapse:collapse;margin:6px 0 16px 0;font-family:Arial,sans-serif"'
const TITULO = 'style="font-family:Arial,sans-serif;font-size:14px;font-weight:bold;margin:12px 0 4px 0"'

export const nomeMotoristas = (v: LiberacaoVeiculo) =>
  v.motoristas.map(m => m.cpf ? `${m.nome} (CPF ${m.cpf})` : m.nome).join('; ')

export function htmlTabelas(d: DadosLiberacao): string {
  const partes: string[] = []
  const linhaInfo = (rotulo: string, valor: string | null | undefined) =>
    valor ? `<tr><td ${TH}>${escapar(rotulo)}</td><td ${TD}>${escapar(valor)}</td></tr>` : ''
  partes.push(`<table ${TABELA}>` +
    linhaInfo('Local', d.local_nome) +
    linhaInfo('Endereço', d.local_endereco) +
    linhaInfo('Cliente', d.local_cliente) +
    linhaInfo('Período', textoPeriodo(d)) +
    linhaInfo('Horário', d.horario) +
    '</table>')

  if (d.funcionarios.length) {
    partes.push(`<p ${TITULO}>Funcionários</p>`)
    partes.push(`<table ${TABELA}><tr><th ${TH}>#</th><th ${TH}>Nome</th><th ${TH}>CPF</th><th ${TH}>Função</th></tr>` +
      d.funcionarios.map((f, i) => `<tr><td ${TD}>${i + 1}</td><td ${TD}>${escapar(f.nome)}</td><td ${TD}>${escapar(f.cpf)}</td><td ${TD}>${escapar(f.funcao)}</td></tr>`).join('') +
      '</table>')
  }
  if (d.veiculos.length) {
    partes.push(`<p ${TITULO}>Veículos</p>`)
    partes.push(`<table ${TABELA}><tr><th ${TH}>#</th><th ${TH}>Veículo</th><th ${TH}>Placa</th><th ${TH}>Cor</th><th ${TH}>Motorista(s)</th></tr>` +
      d.veiculos.map((v, i) => `<tr><td ${TD}>${i + 1}</td><td ${TD}>${escapar(v.nome)}</td><td ${TD}>${escapar(v.placa)}</td><td ${TD}>${escapar(v.cor)}</td><td ${TD}>${escapar(nomeMotoristas(v))}</td></tr>`).join('') +
      '</table>')
  }
  return partes.join('')
}

// Mensagem (texto) + tabelas. A assinatura entra na rota de envio.
export function htmlEmail(mensagem: string, d: DadosLiberacao): string {
  const paragrafos = mensagem.split('\n').map(l => escapar(l) || '&nbsp;').join('<br>')
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0F172A">${paragrafos}<br><br>${htmlTabelas(d)}</div>`
}

// ── Excel ────────────────────────────────────────────────────────────────
export function planilhaLiberacao(d: DadosLiberacao): XLSX.WorkBook {
  const linhas: (string | number)[][] = [
    ['SOLICITAÇÃO DE LIBERAÇÃO DE ACESSO'],
    [],
    ['Local', d.local_nome],
  ]
  if (d.local_endereco) linhas.push(['Endereço', d.local_endereco])
  if (d.local_cliente) linhas.push(['Cliente', d.local_cliente])
  linhas.push(['Período', textoPeriodo(d)])
  if (d.horario) linhas.push(['Horário', d.horario])

  if (d.funcionarios.length) {
    linhas.push([], ['FUNCIONÁRIOS'], ['#', 'Nome', 'CPF', 'Função'])
    d.funcionarios.forEach((f, i) => linhas.push([i + 1, f.nome, f.cpf, f.funcao]))
  }
  if (d.veiculos.length) {
    linhas.push([], ['VEÍCULOS'], ['#', 'Veículo', 'Placa', 'Cor', 'Motorista(s)'])
    d.veiculos.forEach((v, i) => linhas.push([i + 1, v.nome, v.placa, v.cor, nomeMotoristas(v)]))
  }

  const ws = XLSX.utils.aoa_to_sheet(linhas)
  ws['!cols'] = [{ wch: 12 }, { wch: 38 }, { wch: 18 }, { wch: 22 }, { wch: 45 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Liberação')
  return wb
}

export function nomeArquivoExcel(d: DadosLiberacao): string {
  const local = (d.local_nome || 'local').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return `Liberacao-${local}-${d.data_inicio}.xlsx`
}

// O que falta para poder enviar (vazio = pode enviar)
export function pendenciasEnvio(d: DadosLiberacao & Pick<Liberacao, 'destinatarios' | 'assunto'>): string[] {
  const p: string[] = []
  if (!d.local_nome.trim()) p.push('Informe o local')
  if (!d.data_inicio || !d.data_fim) p.push('Informe o período')
  else if (d.data_fim < d.data_inicio) p.push('A data final está antes da inicial')
  if (!d.funcionarios.length && !d.veiculos.length) p.push('Inclua ao menos um funcionário ou veículo')
  if (d.funcionarios.some(f => !f.nome.trim())) p.push('Tem funcionário sem nome')
  if (d.veiculos.some(v => !v.nome.trim() && !v.placa.trim())) p.push('Tem veículo sem nome/placa')
  if (!d.destinatarios.length) p.push('Informe o destinatário (gestora)')
  if (!d.assunto.trim()) p.push('Informe o assunto')
  return p
}
