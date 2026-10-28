import { NextRequest, NextResponse } from 'next/server'
import { limparDuplicadosDaObra, nomePastaDaObra } from '@/lib/diarioObra'
import { exigirUsuarioAtivo } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await exigirUsuarioAtivo()
  if (!auth.ok) return auth.resposta

  const { obraId } = await req.json()
  if (!obraId) return NextResponse.json({ error: 'obraId é obrigatório' }, { status: 400 })

  try {
    // Mesmo nome de pasta que a sincronização usa (nome da obra no Diário de Obra)
    const nomePasta = await nomePastaDaObra(obraId)
    const resultado = await limparDuplicadosDaObra(nomePasta)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (e) {
    console.error('[diario-obra/limpar-duplicados]', e)
    const msg = e instanceof Error ? e.message : ''
    return NextResponse.json({ ok: false, error: msg === 'Obra não encontrada' ? msg : 'Não foi possível limpar os duplicados agora. Tente de novo.' }, { status: 500 })
  }
}
