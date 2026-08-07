import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { enviarTelegram } from '@/lib/telegram'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const supabase = createServiceClient()
  const { data: estoques } = await supabase.from('estoques').select('id, nome, icone').order('nome')
  const categoriasComQuantidade = (estoques ?? []).filter(e => !['wrench', 'building2', 'hammer'].includes(e.icone))

  if (categoriasComQuantidade.length === 0) {
    return NextResponse.json({ ok: true, enviado: false, motivo: 'sem categorias de estoque com quantidade' })
  }

  const threadEstoque = process.env.TELEGRAM_THREAD_ESTOQUE
  const dataHoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const erros: string[] = []
  let enviados = 0

  const esperar = (ms: number) => new Promise(res => setTimeout(res, ms))

  async function enviar(texto: string) {
    if (enviados + erros.length > 0) await esperar(600) // respeita limite de ~1 msg/s do Telegram por chat, sem estourar o timeout da function (Hobby: 10s)
    const r = await enviarTelegram(texto, threadEstoque)
    if (r.ok) enviados++
    else erros.push(r.error ?? 'erro desconhecido')
  }

  await enviar(`📦 <b>Relatório diário de estoque — ${dataHoje}</b>`)

  for (const estoque of categoriasComQuantidade) {
    const { data: produtos } = await supabase
      .from('estoque_produtos')
      .select('nome, quantidade_atual, quantidade_minima, unidade')
      .eq('estoque_id', estoque.id)
      .eq('ativo', true)
      .order('nome')

    if (!produtos || produtos.length === 0) continue

    const linhas = produtos.map(p => {
      const critico = p.quantidade_minima > 0 && p.quantidade_atual <= p.quantidade_minima
      const negativo = p.quantidade_atual < 0
      const marca = negativo ? '🔴' : critico ? '🟠' : '🟢'
      return `${marca} ${p.nome}: <b>${p.quantidade_atual}</b> ${p.unidade ?? ''}`
    })

    await enviar(`<b>${estoque.nome}</b>\n${linhas.join('\n')}`)
  }

  return NextResponse.json({
    ok: erros.length === 0,
    enviado: enviados > 0,
    enviados,
    categorias: categoriasComQuantidade.length,
    chatIdConfigurado: Boolean(process.env.TELEGRAM_CHAT_ID),
    threadConfigurado: Boolean(threadEstoque),
    executadoEm: new Date().toISOString(),
    erros: erros.length > 0 ? Array.from(new Set(erros)) : undefined,
  }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } })
}
