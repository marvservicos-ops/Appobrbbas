import { NextRequest, NextResponse } from 'next/server'
import { sincronizarBackupCompleto } from '@/lib/diarioObra'
import { exigirUsuarioAtivo } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await exigirUsuarioAtivo()
  if (!auth.ok) return auth.resposta

  try {
    const body = await req.json().catch(() => ({}))
    const limite = typeof body?.limite === 'number' && body.limite > 0 ? Math.min(body.limite, 50) : 20
    const { resultados, completo } = await sincronizarBackupCompleto(limite)
    return NextResponse.json({ ok: true, obras: Object.keys(resultados).length, resultados, completo })
  } catch (e) {
    // Detalhe técnico só no log do servidor
    console.error('[diario-obra/backup-completo]', e)
    return NextResponse.json({
      ok: false,
      error: 'Não foi possível concluir o backup agora (Diário de Obra ou Google Drive não responderam).',
    }, { status: 500 })
  }
}
