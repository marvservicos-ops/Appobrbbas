import { google } from 'googleapis'
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

function diarioObraHeaders() {
  const token = process.env.DIARIO_OBRA_TOKEN
  if (!token) throw new Error('DIARIO_OBRA_TOKEN não configurado')
  return { 'Content-Type': 'application/json', token }
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
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!email || !privateKey) throw new Error('Credenciais do Google Drive não configuradas (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)')
  const auth = new google.auth.JWT({ email, key: privateKey, scopes: ['https://www.googleapis.com/auth/drive'] })
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
  const { Readable } = await import('stream')
  const { data } = await drive.files.create({
    requestBody: { name: nomeArquivo, parents: [pastaId] },
    media: { mimeType: 'application/pdf', body: Readable.from(buffer) },
    fields: 'id, webViewLink',
  })
  return { id: data.id!, url: data.webViewLink ?? `https://drive.google.com/file/d/${data.id}/view` }
}

// ── Sincronização de uma obra ────────────────────────────
export async function sincronizarRdosDaObra(obraId: string): Promise<{ importados: number; ignorados: number; erros: string[] }> {
  const supabase = createServiceClient()
  const { data: obra, error: obraErr } = await supabase.from('obras').select('id, titulo, diario_obra_id').eq('id', obraId).single()
  if (obraErr || !obra) throw new Error('Obra não encontrada')
  if (!obra.diario_obra_id) throw new Error('Esta obra não está vinculada a uma obra no Diário de Obra')

  const relatorios = await listarRelatorios(obra.diario_obra_id)
  const { data: jaImportados } = await supabase.from('diario_obra_relatorios').select('diario_relatorio_id').eq('obra_id', obraId)
  const idsImportados = new Set((jaImportados ?? []).map(r => r.diario_relatorio_id))

  let importados = 0, ignorados = 0
  const erros: string[] = []

  for (const resumo of relatorios) {
    if (idsImportados.has(resumo._id)) { ignorados++; continue }
    try {
      const detalhe = await buscarDetalheRelatorio(obra.diario_obra_id, resumo._id)
      if (!detalhe.linkPdf) { erros.push(`RDO ${resumo.numero}: sem PDF disponível ainda`); continue }

      const pastaId = await pastaObra(obra.titulo)
      const nomeArquivo = `RDO-${String(resumo.numero).padStart(3, '0')}_${resumo.data.replace(/\//g, '-')}.pdf`
      const arquivo = await uploadPdf(pastaId, nomeArquivo, detalhe.linkPdf)

      await supabase.from('diario_obra_relatorios').insert({
        obra_id: obraId,
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

  return { importados, ignorados, erros }
}

function converterDataBR(data: string): string | null {
  const [dia, mes, ano] = data.split('/')
  if (!dia || !mes || !ano) return null
  return `${ano}-${mes}-${dia}`
}
