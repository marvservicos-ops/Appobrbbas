import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/service'
import { calcularPendencias, agoraBrasilia, type Pendencia } from '@/lib/pendencias'
import { cronAutorizado } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

// E-mail diário (17h, dias úteis) com o que falta lançar/conferir — o mesmo
// conteúdo do painel de Pendências do Dashboard. Só envia se houver pendência.

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.marvservicos.com.br'
const FROM = process.env.EMAIL_FROM ?? 'joaovictor@marvservicos.com.br'
const DESTINATARIO = process.env.PENDENCIAS_EMAIL_TO ?? 'joaovictor@marvservicos.com.br'

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function secao(titulo: string, itens: Pendencia[]) {
  if (itens.length === 0) return ''
  const linhas = itens.map(p => `
    <tr><td style="padding:10px 0;border-bottom:1px solid #F1F5F9">
      <a href="${APP_URL}${p.href}" style="color:#0F172A;text-decoration:none;font-weight:600;font-size:14px">
        <span style="color:${p.gravidade === 'alta' ? '#EF4444' : '#F59E0B'}">●</span> ${esc(p.titulo)}
      </a>
      ${p.detalhe ? `<div style="color:#64748B;font-size:12px;margin-top:2px;padding-left:16px">${esc(p.detalhe)}</div>` : ''}
    </td></tr>`).join('')
  return `<h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#0F172A;margin:24px 0 4px">${titulo} (${itens.length})</h3>
    <table width="100%" cellpadding="0" cellspacing="0">${linhas}</table>`
}

export async function GET(req: NextRequest) {
  const negado = cronAutorizado(req, 'cron/pendencias')
  if (negado) return negado

  const agora = agoraBrasilia()
  const pendencias = (await calcularPendencias(createServiceClient(), agora)).filter(p => !p.dispensada)
  if (pendencias.length === 0) {
    return NextResponse.json({ ok: true, enviado: false, motivo: 'nenhuma pendência' })
  }

  const lancar = pendencias.filter(p => p.grupo === 'lancar')
  const conferir = pendencias.filter(p => p.grupo === 'conferir')
  const dataHoje = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#0F172A">
    <h2 style="font-size:18px;margin:0 0 4px">Pendências do dia — ${pendencias.length}</h2>
    <p style="color:#64748B;font-size:13px;margin:0">${dataHoje}. Clique em cada item para abrir direto no lugar certo.</p>
    ${secao('Falta lançar', lancar)}
    ${secao('Falta conferir', conferir)}
    <p style="margin-top:28px"><a href="${APP_URL}/dashboard" style="background:#4F7CFF;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Abrir o Dashboard</a></p>
  </div>`

  const { data, error } = await resend.emails.send({
    from: `MARV Gestão <${FROM}>`,
    to: DESTINATARIO.split(',').map(e => e.trim()).filter(Boolean),
    subject: `Pendências do dia: ${lancar.length} para lançar, ${conferir.length} para conferir`,
    html,
  })

  if (error) {
    console.error('[cron/pendencias] falha ao enviar e-mail', error)
    return NextResponse.json({ ok: false, error: 'Falha ao enviar o e-mail de pendências' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, enviado: true, id: data?.id, total: pendencias.length },
    { headers: { 'Cache-Control': 'no-store' } })
}
