import { NextRequest, NextResponse } from 'next/server'
import { sincronizarRdosDaObra } from '@/lib/diarioObra'
import { exigirUsuarioAtivo } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await exigirUsuarioAtivo()
  if (!auth.ok) return auth.resposta

  const { obraId } = await req.json()
  if (!obraId) return NextResponse.json({ error: 'obraId é obrigatório' }, { status: 400 })

  try {
    const resultado = await sincronizarRdosDaObra(obraId)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (e) {
    console.error('[diario-obra/sincronizar]', e)
    const msg = e instanceof Error ? e.message : ''
    // Mensagens que nós mesmos lançamos (em português) podem ir para a tela
    const conhecida = /^(Obra não encontrada|Esta obra não está vinculada)/.test(msg)
    return NextResponse.json({ ok: false, error: conhecida ? msg : 'Não foi possível sincronizar com o Diário de Obra agora. Tente de novo.' }, { status: 500 })
  }
}
