import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { enviarTelegram, escaparTelegram } from '@/lib/telegram'
import { formatarQtd } from '@/lib/numero'
import { cronAutorizado } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const negado = cronAutorizado(req, 'cron/relatorio-estoque')
  if (negado) return negado

  const supabase = createServiceClient()
  const { data: estoques, error: erroEstoques } = await supabase.from('estoques').select('*').order('nome')
  if (erroEstoques) {
    console.error('[cron/relatorio-estoque] erro ao ler estoques', erroEstoques)
    return NextResponse.json({ ok: false, error: 'Erro ao ler estoques' }, { status: 500 })
  }
  const categoriasComQuantidade = (estoques ?? []).filter(e => e.ativo !== false && !['wrench', 'building2', 'hammer'].includes(e.icone))

  if (categoriasComQuantidade.length === 0) {
    return NextResponse.json({ ok: true, enviado: false, motivo: 'sem categorias de estoque com quantidade' })
  }

  const threadEstoque = process.env.TELEGRAM_THREAD_ESTOQUE
  const agora = new Date()
  const dataHoje = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const horaAgora = agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const erros: string[] = []
  let enviados = 0

  const esperar = (ms: number) => new Promise(res => setTimeout(res, ms))

  async function enviar(texto: string) {
    if (enviados + erros.length > 0) await esperar(600) // respeita limite de ~1 msg/s do Telegram por chat, sem estourar o timeout da function (Hobby: 10s)
    const r = await enviarTelegram(texto, threadEstoque)
    if (r.ok) enviados++
    else erros.push(r.error ?? 'erro desconhecido')
  }

  await enviar(`📦 <b>Relatório diário de estoque — ${dataHoje} ${horaAgora}</b>`)

  for (const estoque of categoriasComQuantidade) {
    const { data: produtos, error: erroProdutos } = await supabase
      .from('estoque_produtos')
      .select('nome, quantidade_atual, quantidade_minima, unidade')
      .eq('estoque_id', estoque.id)
      .eq('ativo', true)
      .order('nome')
    if (erroProdutos) {
      console.error(`[cron/relatorio-estoque] erro ao ler produtos de ${estoque.nome}`, erroProdutos)
      erros.push(`Erro ao ler produtos de ${estoque.nome}`)
      continue
    }

    if (!produtos || produtos.length === 0) continue

    const linhas = produtos.map(p => {
      const atual = Number(p.quantidade_atual ?? 0)
      const minima = Number(p.quantidade_minima ?? 0)
      // Mesmo critério do sino e do Dashboard: crítico = atual <= mínimo (com mínimo definido)
      const critico = minima > 0 && atual <= minima
      const negativo = atual < 0
      const marca = negativo ? '🔴' : critico ? '🟠' : '🟢'
      return `${marca} ${escaparTelegram(p.nome)}: <b>${formatarQtd(atual)}</b> ${escaparTelegram(p.unidade ?? '')}`
    })

    await enviar(`<b>${escaparTelegram(estoque.nome)}</b>\n${linhas.join('\n')}\n<i>${horaAgora}</i>`)
  }

  return NextResponse.json({
    ok: erros.length === 0,
    enviado: enviados > 0,
    enviados,
    categorias: categoriasComQuantidade.length,
    erros: erros.length > 0 ? Array.from(new Set(erros)) : undefined,
  }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } })
}
