import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Wrench, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
}
function competenciaLabel(c: string) {
  const [ano, mes] = c.split('-')
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${meses[parseInt(mes) - 1]}/${ano}`
}
function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export default async function PubEquipamentoPage({ params }: { params: { equipId: string } }) {
  const sb = await createClient()

  const [{ data: equip }, { data: dados }, { data: historico }] = await Promise.all([
    sb.from('equipamentos').select('*, contrato:contratos_manutencao(empresa:empresas(razao_social, apelido))').eq('id', params.equipId).single(),
    sb.from('equipamento_dados').select('*, campo:campos_tecnicos(nome, unidade)').eq('equipamento_id', params.equipId),
    sb.from('manutencao_historico').select('*').eq('equipamento_id', params.equipId).order('competencia', { ascending: false }).limit(12),
  ])

  if (!equip) notFound()

  const empresa = (equip as any).contrato?.empresa
  const nomeEmpresa = empresa?.apelido ?? empresa?.razao_social ?? ''

  const tipoColor: Record<string, string> = {
    Split: '#4F7CFF', Cassete: '#059669', VRF: '#D97706',
    Janela: '#DB2777', 'Piso-teto': '#4338CA',
  }
  const cor = tipoColor[(equip as any).tipo] ?? '#64748B'

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#F8FAFC', minHeight: '100vh', padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '20px 24px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>
            {nomeEmpresa || 'MARV Gestão'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
              background: cor + '20', color: cor,
            }}>{(equip as any).tipo}</span>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0F172A' }}>{(equip as any).nome}</h1>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Foto */}
        {(equip as any).foto_url && (
          <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px #0001' }}>
            <img src={(equip as any).foto_url} alt={(equip as any).nome} style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />
          </div>
        )}

        {/* Dados técnicos */}
        {dados && dados.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 1px 4px #0001' }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Dados Técnicos</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
              {(dados as any[]).map((d: any) => (
                <div key={d.id}>
                  <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>
                    {d.campo.nome}{d.campo.unidade ? ` (${d.campo.unidade})` : ''}
                  </p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{d.valor || '—'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Histórico */}
        {historico && historico.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 1px 4px #0001' }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Histórico de Manutenções</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(historico as any[]).map((h: any) => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', border: '1px solid #F1F5F9', borderRadius: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 1 }}>
                    {h.preventiva_feita
                      ? <span style={{ color: '#10B981', fontSize: 16 }}>✓</span>
                      : <span style={{ color: '#94A3B8', fontSize: 16 }}>○</span>}
                    {h.corretiva && <span style={{ color: '#EF4444', fontSize: 13 }}>⚠</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{competenciaLabel(h.competencia)}</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 999,
                        background: h.preventiva_feita ? '#D1FAE5' : '#F1F5F9',
                        color: h.preventiva_feita ? '#059669' : '#94A3B8',
                      }}>Prev. {h.preventiva_feita ? 'feita' : 'não feita'}</span>
                      {h.corretiva && (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 999, background: '#FEE2E2', color: '#DC2626' }}>
                          Corretiva
                        </span>
                      )}
                    </div>
                    {h.corretiva_descricao && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>{h.corretiva_descricao}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 11, color: '#CBD5E1', margin: 0 }}>MARV Gestão · {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
