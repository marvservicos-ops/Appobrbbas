import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import { escaparHtml } from '@/lib/apiAuth'
import { formatarData, segundaDaSemana, somarDias, parseData } from '@/lib/datas'
import { formatarMoeda } from '@/lib/numero'
import { formatarDocumento } from '@/lib/fornecedores'
import { CHAVE_ALERTA, STATUS_ABERTOS, STATUS_CONTA, type ConfigAlerta, type StatusConta } from '@/lib/contasPagar'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.marvservicos.com.br'
const FROM = process.env.EMAIL_FROM ?? 'joaovictor@marvservicos.com.br'
const PADRAO = process.env.PENDENCIAS_EMAIL_TO ?? 'joaovictor@marvservicos.com.br'
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

interface Linha {
  data_vencimento: string
  valor: number
  status: StatusConta
  parcela: number | null
  descricao: string | null
  fornecedor: { nome: string; nome_fantasia: string | null; cnpj: string | null } | null
  nota: { numero_nf: string | null } | null
}

export const hojeBrasilia = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

export async function lerConfigAlerta(sb: SupabaseClient): Promise<ConfigAlerta> {
  const { data } = await sb.from('configuracoes_empresa').select('valor').eq('chave', CHAVE_ALERTA).maybeSingle()
  const v = data?.valor as Partial<ConfigAlerta> | undefined
  // Sem configuração salva: liga e manda para o mesmo destinatário das pendências
  if (!v) return { ativo: true, emails: PADRAO.split(',').map(e => e.trim()).filter(Boolean) }
  return { ativo: v.ativo !== false, emails: (v.emails ?? []).filter(Boolean) }
}

function tabela(linhas: Linha[]) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">${linhas.map(c => {
    const f = c.fornecedor
    const nome = f ? (f.nome_fantasia || f.nome) : '—'
    const origem = c.nota ? `NF ${c.nota.numero_nf ?? 's/ nº'}${c.parcela ? ` · parc. ${c.parcela}` : ''}` : (c.descricao || 'Boleto avulso')
    const st = c.status === 'pendente' ? '' : ` · <span style="color:${c.status === 'divergente' ? '#DC2626' : '#2563EB'}">${STATUS_CONTA[c.status].label}</span>`
    return `<tr><td style="padding:8px 0;border-bottom:1px solid #F1F5F9">
        <div style="font-weight:600;color:#0F172A">${escaparHtml(nome)}</div>
        <div style="color:#64748B;font-size:12px">${f?.cnpj ? `${formatarDocumento(f.cnpj)} · ` : ''}${escaparHtml(origem)}${st}</div>
      </td><td style="padding:8px 0;border-bottom:1px solid #F1F5F9;text-align:right;white-space:nowrap;font-weight:600">${formatarMoeda(Number(c.valor))}</td></tr>`
  }).join('')}</table>`
}

const soma = (l: Linha[]) => l.reduce((t, c) => t + Number(c.valor), 0)

// Resumo dos boletos em aberto que vencem na semana (segunda a domingo),
// mais os vencidos que ficaram para trás. Usado pelo cron de segunda e pelo
// botão "Enviar agora" da tela.
export async function enviarResumoSemana(sb: SupabaseClient, opcoes: { para?: string[] } = {}) {
  const config = await lerConfigAlerta(sb)
  const para = opcoes.para ?? (config.ativo ? config.emails : [])
  if (para.length === 0) return { ok: true, enviado: false, motivo: 'alerta desligado ou sem destinatários' }

  const hoje = hojeBrasilia()
  const seg = segundaDaSemana(hoje)
  const dom = somarDias(seg, 6)
  const sel = 'data_vencimento, valor, status, parcela, descricao, fornecedor:fornecedores(nome, nome_fantasia, cnpj), nota:notas_compra(numero_nf)'
  const [{ data: semana, error: e1 }, { data: vencidas, error: e2 }] = await Promise.all([
    sb.from('contas_pagar').select(sel).in('status', STATUS_ABERTOS).gte('data_vencimento', seg).lte('data_vencimento', dom).order('data_vencimento'),
    sb.from('contas_pagar').select(sel).in('status', STATUS_ABERTOS).lt('data_vencimento', seg).order('data_vencimento'),
  ])
  if (e1 || e2) return { ok: false, enviado: false, motivo: `erro ao ler contas: ${(e1 ?? e2)!.message}` }
  const lSemana = (semana ?? []) as unknown as Linha[]
  const lVencidas = (vencidas ?? []) as unknown as Linha[]

  const periodo = `${formatarData(seg).slice(0, 5)} a ${formatarData(dom)}`
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(seg, i))
    .map(d => ({ d, itens: lSemana.filter(c => c.data_vencimento === d) }))
    .filter(g => g.itens.length > 0)

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#0F172A">
    <h2 style="font-size:18px;margin:0 0 4px">Boletos esperados no DDA — ${periodo}</h2>
    <p style="color:#64748B;font-size:13px;margin:0">${lSemana.length} boleto${lSemana.length !== 1 ? 's' : ''} em aberto na semana, total <b>${formatarMoeda(soma(lSemana))}</b>. Confira cada um no DDA do banco e marque em Contas a pagar.</p>
    ${lVencidas.length ? `<h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#DC2626;margin:24px 0 4px">Vencidos e não pagos (${lVencidas.length}) — ${formatarMoeda(soma(lVencidas))}</h3>${tabela(lVencidas)}` : ''}
    ${dias.map(g => `<h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.04em;margin:24px 0 4px">${DIAS[parseData(g.d).getDay()]}, ${formatarData(g.d).slice(0, 5)} — ${formatarMoeda(soma(g.itens))}</h3>${tabela(g.itens)}`).join('')}
    ${lSemana.length === 0 ? '<p style="margin-top:20px;font-size:14px">Nenhum boleto lançado vence nesta semana. Se aparecer algum no DDA, lance como "Boleto do DDA sem registro".</p>' : ''}
    <p style="margin-top:28px"><a href="${APP_URL}/contas-pagar" style="background:#4F7CFF;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Abrir Contas a pagar</a></p>
  </div>`

  const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: `MARV Gestão <${FROM}>`,
    to: para,
    subject: `DDA da semana ${periodo}: ${lSemana.length} boleto${lSemana.length !== 1 ? 's' : ''}, ${formatarMoeda(soma(lSemana))}${lVencidas.length ? ` · ${lVencidas.length} vencido${lVencidas.length > 1 ? 's' : ''}` : ''}`,
    html,
  })
  if (error) return { ok: false, enviado: false, motivo: `falha no envio: ${error.message}` }
  return { ok: true, enviado: true, id: data?.id, para, boletos: lSemana.length, vencidos: lVencidas.length }
}
