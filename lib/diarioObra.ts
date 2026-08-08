import { google } from 'googleapis'
import { Readable } from 'stream'
import { createServiceClient } from '@/lib/supabase/service'

const API_BASE = 'https://apiexterna.diariodeobra.app/v1'

type DiarioRelatorioResumo = {
  _id: string
  numero: number
  data: string
  status: { id: number; descricao: string }
}

type DiarioRelatorioDetalhe = DiarioRelatorioResumo & {
  linkPdf?: string
}

type DiarioObraExterna = { _id: string; nome: string }

function diarioObraHeaders() {
  const token = process.env.DIARIO_OBRA_TOKEN
  if (!token) throw new Error('DIARIO_OBRA_TOKEN não configurado')
  return { 'Content-Type': 'application/json', token }
}

async function listarObrasExternas(): Promise<DiarioObraExterna[]> {
  const res = await fetch(`${API_BASE}/obras`, { headers: diarioObraHeaders() })
  if (!res.ok) throw new Error(`Erro ao listar obras (${res.status})`)
  return res.json()
}

async function listarRelatorios(diarioObraId: string): Promise<DiarioRelatorioResumo[]> {
  const res = await fetch(`${API_BASE}/obras/${diarioObraId}/relatorios?ordem=desc`, { headers: diarioObraHeaders() })
  if (!res.ok) throw new Error(`Erro ao listar relatórios (${res.status})`)
  return res.json()
}

async function buscarDetalheRelatorio(diarioObraId: string, relatorioId: string): Promise<DiarioRelatorioDetalhe> {
  const res = await fetch(`${API_BASE}/obras/${diarioObraId}/relatorios/${relatorioId}`, { headers: diarioObraHeaders() })
  if (!res.ok) throw new Error(`Erro ao buscar relatório ${relatorioId} (${res.status})`)
  return res.json()
}

// ── Google Drive ────────────────────────────────────────
function driveClient() {
  // Contas de serviço não têm cota própria no Drive pessoal (só funcionam em
  // Shared Drives do Workspace). Por isso autenticamos como o usuário real via
  // OAuth (refresh token), pra que os arquivos entrem na cota dele normalmente.
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Credenciais OAuth do Google Drive não configuradas (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN)')
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({ refresh_token: refreshToken })
  return google.drive({ version: 'v3', auth })
}

async function pastaObra(obraTitulo: string): Promise<string> {
  const rootId = process.env.GOOGLE_DRIVE_RDOS_ROOT_FOLDER_ID
  if (!rootId) throw new Error('GOOGLE_DRIVE_RDOS_ROOT_FOLDER_ID não configurado')
  const drive = driveClient()
  const nomeEscapado = obraTitulo.replace(/'/g, "\\'")
  const { data } = await drive.files.list({
    q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${nomeEscapado}' and trashed = false`,
    fields: 'files(id, name)',
  })
  if (data.files && data.files.length > 0) return data.files[0].id!
  const { data: nova } = await drive.files.create({
    requestBody: { name: obraTitulo, mimeType: 'application/vnd.google-apps.folder', parents: [rootId] },
    fields: 'id',
  })
  return nova.id!
}

async function uploadPdf(pastaId: string, nomeArquivo: string, pdfUrl: string): Promise<{ id: string; url: string }> {
  const resp = await fetch(pdfUrl)
  if (!resp.ok) throw new Error(`Erro ao baixar PDF (${resp.status})`)
  const buffer = Buffer.from(await resp.arrayBuffer())
  const drive = driveClient()
  const { data } = await drive.files.create({
    requestBody: { name: nomeArquivo, parents: [pastaId] },
    media: { mimeType: 'application/pdf', body: Readable.from(buffer) },
    fields: 'id, webViewLink',
  })
  return { id: data.id!, url: data.webViewLink ?? `https://drive.google.com/file/d/${data.id}/view` }
}

type ResultadoSincronizacao = { importados: number; ignorados: number; erros: string[]; pendente: boolean }

// ── Sincronização de uma obra externa (do Diário de Obra) ───────────
// obraId: id da obra correspondente no marv-gestão, se houver (só pra
// exibir a lista dentro da tela da obra — o backup em si não depende disso).
// orcamento: número máximo de RDOs a baixar/subir nesta chamada, pra nunca
// estourar o tempo limite do servidor — o que sobrar fica pra próxima chamada.
async function sincronizarObraExterna(diarioObraId: string, diarioObraNome: string, obraId: string | null, orcamento: number): Promise<ResultadoSincronizacao> {
  const supabase = createServiceClient()
  const relatorios = await listarRelatorios(diarioObraId)
  const { data: jaImportados } = await supabase.from('diario_obra_relatorios').select('diario_relatorio_id').eq('diario_obra_id_externo', diarioObraId)
  const idsImportados = new Set((jaImportados ?? []).map(r => r.diario_relatorio_id))

  let importados = 0, ignorados = 0
  let pendente = false
  const erros: string[] = []

  for (const resumo of relatorios) {
    if (idsImportados.has(resumo._id)) { ignorados++; continue }
    if (importados >= orcamento) { pendente = true; break }
    try {
      const detalhe = await buscarDetalheRelatorio(diarioObraId, resumo._id)
      if (!detalhe.linkPdf) { erros.push(`RDO ${resumo.numero}: sem PDF disponível ainda`); continue }

      const pastaId = await pastaObra(diarioObraNome)
      const nomeArquivo = `RDO-${String(resumo.numero).padStart(3, '0')}_${resumo.data.replace(/\//g, '-')}.pdf`
      const arquivo = await uploadPdf(pastaId, nomeArquivo, detalhe.linkPdf)

      await supabase.from('diario_obra_relatorios').insert({
        obra_id: obraId,
        diario_obra_id_externo: diarioObraId,
        diario_obra_nome: diarioObraNome,
        diario_relatorio_id: resumo._id,
        numero: resumo.numero,
        data: converterDataBR(resumo.data),
        status_descricao: resumo.status?.descricao ?? null,
        drive_file_id: arquivo.id,
        drive_file_url: arquivo.url,
      })
      importados++
    } catch (e) {
      erros.push(`RDO ${resumo.numero}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { importados, ignorados, erros, pendente }
}

// ── Sincronização de uma obra vinculada no marv-gestão ───────────────
export async function sincronizarRdosDaObra(obraId: string, orcamento = 30): Promise<ResultadoSincronizacao> {
  const supabase = createServiceClient()
  const { data: obra, error: obraErr } = await supabase.from('obras').select('id, titulo, diario_obra_id').eq('id', obraId).single()
  if (obraErr || !obra) throw new Error('Obra não encontrada')
  if (!obra.diario_obra_id) throw new Error('Esta obra não está vinculada a uma obra no Diário de Obra')

  return sincronizarObraExterna(obra.diario_obra_id, obra.titulo, obraId, orcamento)
}

// ── Backup completo: TODAS as obras do Diário de Obra, vinculadas ou não ──
// limite: teto de RDOs baixados/enviados nesta chamada (mantém cada chamada
// curta o bastante pra não estourar o tempo do servidor). completo=false
// avisa o chamador que ainda sobrou trabalho pra uma próxima chamada.
export async function sincronizarBackupCompleto(limite = 20): Promise<{ resultados: Record<string, ResultadoSincronizacao | { erro: string }>; completo: boolean }> {
  const supabase = createServiceClient()
  const [obrasExternas, { data: obrasMarv }] = await Promise.all([
    listarObrasExternas(),
    supabase.from('obras').select('id, diario_obra_id').not('diario_obra_id', 'is', null),
  ])
  const mapaLink = new Map((obrasMarv ?? []).map(o => [o.diario_obra_id as string, o.id as string]))

  const resultados: Record<string, ResultadoSincronizacao | { erro: string }> = {}
  let orcamentoRestante = limite
  let completo = true

  for (const obraExterna of obrasExternas) {
    if (orcamentoRestante <= 0) { completo = false; break }
    try {
      const r = await sincronizarObraExterna(obraExterna._id, obraExterna.nome, mapaLink.get(obraExterna._id) ?? null, orcamentoRestante)
      resultados[obraExterna.nome] = r
      orcamentoRestante -= r.importados
      if (r.pendente) completo = false
    } catch (e) {
      resultados[obraExterna.nome] = { erro: e instanceof Error ? e.message : String(e) }
    }
  }
  return { resultados, completo }
}

function converterDataBR(data: string): string | null {
  const [dia, mes, ano] = data.split('/')
  if (!dia || !mes || !ano) return null
  return `${ano}-${mes}-${dia}`
}
