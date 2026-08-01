import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import PinForm from './PinForm'

function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
}
function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

const STATUS_LABEL: Record<string, string> = {
  planejada: 'Planejada', faturada: 'Faturada', recebida: 'Recebida', atrasada: 'Atrasada', cancelada: 'Cancelada',
}
const STATUS_COLOR: Record<string, string> = {
  planejada: '#64748B', faturada: '#2563EB', recebida: '#059669', atrasada: '#D97706', cancelada: '#DC2626',
}
const TIPO_LABEL: Record<string, string> = { servico: 'Serviço', material: 'Material', outro: 'Outro' }

async function getSessaoObraId(token: string) {
  const cookieStore = await cookies()
  const sessaoId = cookieStore.get('portal_session')?.value
  if (!sessaoId) return null

  const service = createServiceClient()
  const { data: sessao } = await service
    .from('obra_portal_sessoes')
    .select('expires_at, acesso:obra_acessos_cliente(obra_id, token, ativo)')
    .eq('id', sessaoId)
    .maybeSingle()

  if (!sessao) return null
  const acesso = sessao.acesso as any
  if (!acesso || !acesso.ativo || acesso.token !== token) return null
  if (new Date(sessao.expires_at) < new Date()) return null

  return acesso.obra_id as string
}

export default async function PortalPage({ params }: { params: { token: string } }) {
  const obraId = await getSessaoObraId(params.token)

  if (!obraId) {
    return <PinForm token={params.token} />
  }

  const service = createServiceClient()
  const [{ data: obra }, { data: ocs }, { data: medicoes }] = await Promise.all([
    service.from('obras').select('id, titulo, endereco').eq('id', obraId).single(),
    service.from('obra_ocs').select('*').eq('obra_id', obraId).order('created_at'),
    service.from('obra_medicoes').select('*').eq('obra_id', obraId).order('ordem'),
  ])

  if (!obra) notFound()

  const medicoesPorOC = (ocId: string) => (medicoes ?? []).filter((m: any) => m.oc_id === ocId).sort((a: any, b: any) => a.ordem - b.ordem)

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#F8FAFC', minHeight: '100vh', padding: '0 0 40px' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '20px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>
            MARV Gestão · Portal do Cliente
          </p>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0F172A' }}>{obra.titulo}</h1>
          {obra.endereco && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>{obra.endereco}</p>}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {(!ocs || ocs.length === 0) ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 20px', boxShadow: '0 1px 4px #0001', textAlign: 'center' }}>
            <p style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>Nenhuma ordem de compra cadastrada para esta obra ainda.</p>
          </div>
        ) : (ocs as any[]).map(oc => {
          const meds = medicoesPorOC(oc.id)
          const faturado = meds.filter((m: any) => m.status !== 'cancelada').reduce((s: number, m: any) => s + Number(m.valor_faturado || 0), 0)
          const saldo = Math.max(0, Number(oc.valor_total) - faturado)

          return (
            <div key={oc.id} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px #0001' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 999, background: '#EEF2FF', color: '#4F7CFF' }}>
                      {TIPO_LABEL[oc.tipo] ?? oc.tipo}
                    </span>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{oc.numero_oc}</p>
                  </div>
                  {oc.observacoes && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>{oc.observacoes}</p>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>Valor total da OC</p>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{fmt(Number(oc.valor_total))}</p>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748B', fontWeight: 600 }}>Medição</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748B', fontWeight: 600 }}>%</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748B', fontWeight: 600 }}>Valor</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748B', fontWeight: 600 }}>NF / Data</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748B', fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meds.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: '12px', color: '#94A3B8', textAlign: 'center' }}>Nenhuma medição cadastrada ainda.</td></tr>
                    ) : meds.map((m: any) => (
                      <tr key={m.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 12px', color: '#0F172A', fontWeight: 500 }}>{m.nome}</td>
                        <td style={{ padding: '8px 12px', color: '#374151' }}>{Number(m.percentual).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</td>
                        <td style={{ padding: '8px 12px', color: '#374151' }}>{fmt(Number(m.valor_previsto))}</td>
                        <td style={{ padding: '8px 12px', color: '#374151' }}>{m.numero_nf ? `${m.numero_nf} — ${fmtDate(m.data_emissao)}` : '—'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: (STATUS_COLOR[m.status] ?? '#64748B') + '20', color: STATUS_COLOR[m.status] ?? '#64748B' }}>
                            {STATUS_LABEL[m.status] ?? m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: '14px 20px', background: '#FFFBEB', borderTop: '1px solid #FDE68A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>Faturado até agora: {fmt(faturado)}</span>
                <span style={{ fontSize: 15, color: '#92400E', fontWeight: 800 }}>Saldo: {fmt(saldo)}</span>
              </div>
            </div>
          )
        })}

        <p style={{ textAlign: 'center', fontSize: 11, color: '#CBD5E1', margin: 0 }}>MARV Gestão · {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
