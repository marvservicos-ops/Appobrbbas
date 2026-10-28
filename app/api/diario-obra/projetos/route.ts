import { NextResponse } from 'next/server'
import { listarProjetosDiario } from '@/lib/diarioObra'
import { exigirUsuarioAtivo } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

// Lista os projetos (obras) do Diário de Obra para escolher o vínculo nas telas
export async function GET() {
  const auth = await exigirUsuarioAtivo()
  if (!auth.ok) return auth.resposta

  try {
    return NextResponse.json({ projetos: await listarProjetosDiario() })
  } catch (e) {
    console.error('[diario-obra/projetos]', e)
    return NextResponse.json({ error: 'Não foi possível buscar os projetos do Diário de Obra agora.' }, { status: 500 })
  }
}
