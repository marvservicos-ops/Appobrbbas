import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

// Eventos a partir dos quais o status não muda mais de forma relevante.
const FINAIS = new Set(['delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'canceled', 'suppressed'])

// Consulta no Resend o último evento de cada e-mail ainda pendente da obra
// e atualiza o histórico (entregue, devolvido, etc.).
export async function POST(req: NextRequest) {
  const { obraId } = await req.json()
  if (!obraId) return NextResponse.json({ error: 'obraId obrigatório' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: pendentes } = await supabase
    .from('obra_emails_enviados')
    .select('id, resend_id, status')
    .eq('obra_id', obraId)
    .not('resend_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const aAtualizar = (pendentes ?? []).filter(p => !FINAIS.has(p.status))
  await Promise.all(aAtualizar.map(async p => {
    try {
      const { data } = await resend.emails.get(p.resend_id as string)
      const evento = data?.last_event
      if (evento && evento !== p.status) {
        await supabase.from('obra_emails_enviados').update({ status: evento }).eq('id', p.id)
      }
    } catch {
      // Falha pontual na consulta: mantém o status atual e tenta de novo depois.
    }
  }))

  return NextResponse.json({ ok: true, verificados: aAtualizar.length })
}
