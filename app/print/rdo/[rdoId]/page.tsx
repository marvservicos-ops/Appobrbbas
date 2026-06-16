'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Obra, RDO, RDOClima, RDOMaoObra, RDOEquipamento, RDOAtividade, RDOOcorrencia, RDOComentario, RDOFoto, RDOAssinatura } from '@/lib/types'

const DIAS_SEMANA = ['Domingo','Segunda-Feira','Terça-Feira','Quarta-Feira','Quinta-Feira','Sexta-Feira','Sábado']

export default function RDOPrintPage() {
  const { rdoId } = useParams<{ rdoId: string }>()

  const [obra, setObra] = useState<Obra | null>(null)
  const [rdo, setRdo] = useState<RDO | null>(null)
  const [clima, setClima] = useState<RDOClima[]>([])
  const [maoObra, setMaoObra] = useState<RDOMaoObra[]>([])
  const [equipamentos, setEquipamentos] = useState<RDOEquipamento[]>([])
  const [atividades, setAtividades] = useState<RDOAtividade[]>([])
  const [ocorrencias, setOcorrencias] = useState<RDOOcorrencia[]>([])
  const [comentarios, setComentarios] = useState<RDOComentario[]>([])
  const [fotos, setFotos] = useState<RDOFoto[]>([])
  const [assinaturas, setAssinaturas] = useState<RDOAssinatura[]>([])
  const [loading, setLoading] = useState(true)
  const [modelo, setModelo] = useState<{
    logo_empresa_url?: string; logo_relatorio_url?: string; logo_relatorio2_url?: string; nome?: string
  } | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const rdoRes = await supabase.from('rdos').select('*').eq('id', rdoId).single()
      if (!rdoRes.data) { setLoading(false); return }
      const rdoData = rdoRes.data as RDO
      setRdo(rdoData)

      const [obraRes, climaRes, maoRes, eqRes, atRes, ocRes, comRes, fotosRes, assRes, modeloRes] = await Promise.all([
        supabase.from('obras').select('*, cliente:clientes(*)').eq('id', rdoData.obra_id).single(),
        supabase.from('rdo_clima').select('*').eq('rdo_id', rdoId).order('periodo'),
        supabase.from('rdo_mao_obra').select('*').eq('rdo_id', rdoId),
        supabase.from('rdo_equipamentos').select('*').eq('rdo_id', rdoId),
        supabase.from('rdo_atividades').select('*').eq('rdo_id', rdoId).order('ordem'),
        supabase.from('rdo_ocorrencias').select('*').eq('rdo_id', rdoId).order('created_at'),
        supabase.from('rdo_comentarios').select('*').eq('rdo_id', rdoId).order('created_at'),
        supabase.from('rdo_fotos').select('*').eq('rdo_id', rdoId).order('ordem'),
        supabase.from('rdo_assinaturas').select('*').eq('rdo_id', rdoId),
        supabase.from('rdo_modelos').select('nome,logo_empresa_url,logo_relatorio_url,logo_relatorio2_url').eq('obra_id', rdoData.obra_id).eq('ativo', true).limit(1).maybeSingle(),
      ])
      if (obraRes.data) setObra(obraRes.data as Obra)
      if (climaRes.data) setClima(climaRes.data as RDOClima[])
      if (maoRes.data) setMaoObra(maoRes.data as RDOMaoObra[])
      if (eqRes.data) setEquipamentos(eqRes.data as RDOEquipamento[])
      if (atRes.data) setAtividades(atRes.data as RDOAtividade[])
      if (ocRes.data) setOcorrencias(ocRes.data as RDOOcorrencia[])
      if (comRes.data) setComentarios(comRes.data as RDOComentario[])
      if (fotosRes.data) setFotos(fotosRes.data as RDOFoto[])
      if (assRes.data) setAssinaturas(assRes.data as RDOAssinatura[])
      if (modeloRes.data) setModelo(modeloRes.data)
      setLoading(false)
    }
    load()
  }, [rdoId])

  useEffect(() => {
    if (!loading && rdo) setTimeout(() => window.print(), 600)
  }, [loading, rdo])

  if (loading || !rdo || !obra) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #4F7CFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#64748B', fontSize: 13 }}>Preparando relatório...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const dataRdo = new Date(rdo.data + 'T12:00:00')
  const diaSemana = DIAS_SEMANA[dataRdo.getDay()]
  const today = new Date()
  const startDate = obra.data_inicio ? new Date(obra.data_inicio + 'T00:00:00') : null
  const endDate = obra.previsao_termino ? new Date(obra.previsao_termino + 'T00:00:00') : null
  const prazoContratual = startDate && endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) : '—'
  const prazoDecorrido = startDate ? Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / 86400000)) : '—'
  const prazoVencer = endDate ? Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / 86400000)) : '—'
  const climaAtivo = clima.filter(c => c.ativo)
  const totalMao = maoObra.reduce((s, m) => s + m.quantidade, 0)
  const periodoLabel: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
  const statusLabel = rdo.status === 'aprovado' ? 'Aprovado' : rdo.status === 'revisando' ? 'Revisando' : 'Preenchendo Relatório'
  const statusColor = rdo.status === 'aprovado' ? '#065f46' : rdo.status === 'revisando' ? '#92400e' : '#1e40af'
  const statusBg = rdo.status === 'aprovado' ? '#d1fae5' : rdo.status === 'revisando' ? '#fef3c7' : '#dbeafe'

  const s: Record<string, React.CSSProperties> = {
    table: { borderCollapse: 'collapse', width: '100%', marginBottom: 0 },
    th: { border: '1px solid #ccc', padding: '5px 8px', background: '#f5f5f5', fontWeight: 600, fontSize: 11, textAlign: 'left' },
    td: { border: '1px solid #ccc', padding: '5px 8px', fontSize: 11 },
    sectionTitle: { color: '#e65c00', fontSize: 13, fontWeight: 700, borderBottom: '2px solid #e65c00', paddingBottom: 3, margin: '18px 0 8px' },
  }

  return (
    <>
      <style>{`
        @page { size: A4; margin: 12mm 15mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; margin: 0; background: white; }
      `}</style>

      {/* Botão imprimir — some no print */}
      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 100 }}>
        <button onClick={() => window.print()}
          style={{ background: '#4F7CFF', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Imprimir / Salvar PDF
        </button>
        <button onClick={() => window.history.back()}
          style={{ background: 'white', color: '#555', border: '1px solid #ddd', padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          Voltar
        </button>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '20px 16px' }}>

        {/* ── CABEÇALHO ── */}
        <table style={{ ...s.table, marginBottom: 10 }}>
          <tbody>
            <tr>
              <td style={{ width: '33%', border: '1px solid #ccc', padding: '10px 12px', verticalAlign: 'middle', textAlign: 'center' }}>
                {modelo?.logo_empresa_url
                  ? <img src={modelo.logo_empresa_url} alt="Logo empresa" style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }} />
                  : <><div style={{ fontSize: 18, fontWeight: 800 }}>MARV</div><div style={{ fontSize: 9, color: '#666' }}>Manutenção e Serviços Ltda.</div></>
                }
              </td>
              <td style={{ width: '34%', border: '1px solid #ccc', padding: 10, textAlign: 'center', verticalAlign: 'middle' }}>
                {modelo?.logo_relatorio_url
                  ? <>
                      <img src={modelo.logo_relatorio_url} alt="Logo relatório" style={{ maxHeight: 50, maxWidth: '100%', objectFit: 'contain', display: 'block', margin: '0 auto 4px' }} />
                      <div style={{ fontSize: 12, fontWeight: 700 }}>Relatório Diário de Obra</div>
                      <div style={{ fontSize: 10, color: '#555' }}>(RDO)</div>
                    </>
                  : <><div style={{ fontSize: 14, fontWeight: 700 }}>Relatório Diário de Obra</div><div style={{ fontSize: 11, color: '#555' }}>(RDO)</div></>
                }
              </td>
              <td style={{ width: '33%', border: '1px solid #ccc', padding: 0, verticalAlign: 'top' }}>
                {modelo?.logo_relatorio2_url && (
                  <div style={{ padding: '6px 8px', borderBottom: '1px solid #ccc', textAlign: 'center' }}>
                    <img src={modelo.logo_relatorio2_url} alt="Logo relatório 2" style={{ maxHeight: 40, maxWidth: '100%', objectFit: 'contain' }} />
                  </div>
                )}
                <table style={{ ...s.table }}>
                  <tbody>
                    {[
                      ['Relatório nº', String(rdo.numero), true],
                      ['Data', dataRdo.toLocaleDateString('pt-BR'), true],
                      ['Dia da semana', diaSemana, false],
                      ['Nº do contrato', obra.numero_contrato || '—', false],
                    ].map(([label, val, bold]) => (
                      <tr key={label as string}>
                        <td style={{ border: 'none', borderBottom: '1px solid #ccc', borderRight: '1px solid #ccc', padding: '4px 6px', fontSize: 10, color: '#555', width: '55%' }}>{label}</td>
                        <td style={{ border: 'none', borderBottom: '1px solid #ccc', padding: '4px 6px', fontWeight: bold ? 700 : 400 }}>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Info obra */}
        <table style={{ ...s.table, marginBottom: 4 }}>
          <tbody>
            <tr><td style={{ ...s.td, ...s.th, width: '18%' }}>Obra</td><td style={s.td} colSpan={3}>{obra.titulo}</td></tr>
            <tr><td style={{ ...s.td, ...s.th }}>Endereço</td><td style={s.td} colSpan={3}>{obra.endereco || '—'}</td></tr>
            <tr>
              <td style={{ ...s.td, ...s.th }}>Contratante</td><td style={{ ...s.td, width: '30%' }}>{(obra.cliente as any)?.nome || '—'}</td>
              <td style={{ ...s.td, ...s.th, width: '15%' }}>Responsável</td><td style={s.td}>{obra.engenheiro_responsavel || '—'}</td>
            </tr>
            <tr>
              <td style={{ ...s.td, ...s.th }}>Prazo contratual</td><td style={s.td}>{prazoContratual} dias</td>
              <td style={{ ...s.td, ...s.th }}>Prazo decorrido</td><td style={s.td}>{prazoDecorrido} dias</td>
            </tr>
            <tr>
              <td style={{ ...s.td, ...s.th }}>Prazo a vencer</td><td style={s.td}>{prazoVencer} dias</td>
              <td style={{ ...s.td, ...s.th }}>Status</td>
              <td style={s.td}><span style={{ background: statusBg, color: statusColor, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{statusLabel}</span></td>
            </tr>
          </tbody>
        </table>

        {/* Condição Climática */}
        {climaAtivo.length > 0 && (
          <>
            <div style={s.sectionTitle}>Condição Climática</div>
            <table style={s.table}>
              <thead><tr><th style={s.th}>Período</th><th style={s.th}>Tempo</th><th style={s.th}>Condição</th></tr></thead>
              <tbody>
                {climaAtivo.map(c => (
                  <tr key={c.id}>
                    <td style={s.td}>{periodoLabel[c.periodo] || c.periodo}</td>
                    <td style={{ ...s.td, textTransform: 'capitalize' }}>{c.tempo || '—'}</td>
                    <td style={s.td}>{c.condicao === 'praticavel' ? 'Praticável' : c.condicao === 'impraticavel' ? 'Impraticável' : '—'}</td>
                  </tr>
                ))}
                {rdo.indice_pluviometrico && (
                  <tr>
                    <td style={{ ...s.td, ...s.th }} colSpan={2}>Índice pluviométrico (mm)</td>
                    <td style={s.td}>{rdo.indice_pluviometrico}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* Mão de Obra */}
        {maoObra.length > 0 && (
          <>
            <div style={s.sectionTitle}>Mão de Obra ({totalMao} pessoas)</div>
            <table style={s.table}>
              <thead><tr><th style={s.th}>Função</th><th style={s.th}>Tipo</th><th style={{ ...s.th, width: 90, textAlign: 'center' }}>Quantidade</th></tr></thead>
              <tbody>
                {maoObra.map(m => (
                  <tr key={m.id}>
                    <td style={s.td}>{m.funcao}</td>
                    <td style={s.td}>{m.tipo === 'direta' ? 'Mão de Obra Direta' : 'Mão de Obra Indireta'}</td>
                    <td style={{ ...s.td, textAlign: 'center', fontWeight: 700 }}>{m.quantidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Equipamentos */}
        {equipamentos.length > 0 && (
          <>
            <div style={s.sectionTitle}>Equipamentos ({equipamentos.length})</div>
            <table style={s.table}>
              <thead><tr><th style={s.th}>Equipamento</th><th style={{ ...s.th, width: 90, textAlign: 'center' }}>Quantidade</th></tr></thead>
              <tbody>
                {equipamentos.map(e => (
                  <tr key={e.id}>
                    <td style={s.td}>{e.nome}</td>
                    <td style={{ ...s.td, textAlign: 'center', fontWeight: 700 }}>{e.quantidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Atividades */}
        {atividades.length > 0 && (
          <>
            <div style={s.sectionTitle}>Atividades ({atividades.length})</div>
            <table style={s.table}>
              <thead><tr><th style={s.th}>Descrição</th><th style={{ ...s.th, width: 90, textAlign: 'center' }}>Progresso</th><th style={{ ...s.th, width: 100, textAlign: 'center' }}>Status</th></tr></thead>
              <tbody>
                {atividades.map(a => (
                  <tr key={a.id}>
                    <td style={s.td}>• {a.descricao}</td>
                    <td style={{ ...s.td, textAlign: 'center' }}>{a.progresso}%</td>
                    <td style={{ ...s.td, textAlign: 'center' }}>{a.status_ativ}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Ocorrências */}
        {ocorrencias.length > 0 && (
          <>
            <div style={s.sectionTitle}>Ocorrências ({ocorrencias.length})</div>
            <table style={s.table}>
              <thead><tr><th style={s.th}>Descrição</th><th style={{ ...s.th, width: 130 }}>Data/Hora</th></tr></thead>
              <tbody>
                {ocorrencias.map(o => (
                  <tr key={o.id}>
                    <td style={s.td}>{o.descricao}</td>
                    <td style={{ ...s.td, fontSize: 9, color: '#555' }}>{new Date(o.created_at).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Comentários */}
        {comentarios.length > 0 && (
          <>
            <div style={s.sectionTitle}>Comentários ({comentarios.length})</div>
            <table style={s.table}>
              <thead><tr><th style={{ ...s.th, width: 120 }}>Autor</th><th style={s.th}>Texto</th><th style={{ ...s.th, width: 130 }}>Data/Hora</th></tr></thead>
              <tbody>
                {comentarios.map(c => (
                  <tr key={c.id}>
                    <td style={{ ...s.td, fontWeight: 600 }}>{c.autor}</td>
                    <td style={s.td}>{c.texto}</td>
                    <td style={{ ...s.td, fontSize: 9, color: '#555' }}>{new Date(c.created_at).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Fotos */}
        {fotos.length > 0 && (
          <>
            <div style={{ ...s.sectionTitle }} className="page-break">Fotos ({fotos.length})</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {fotos.map(f => (
                <div key={f.id}>
                  <img src={f.url} alt={f.legenda || ''} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', border: '1px solid #ddd', display: 'block' }} />
                  <div style={{ fontSize: 9, color: '#555', marginTop: 2, textAlign: 'center', minHeight: 24, border: '1px solid #eee', padding: '2px 4px' }}>{f.legenda || ''}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Assinaturas */}
        <div style={s.sectionTitle}>Assinatura Manual</div>
        <div style={{ marginBottom: 10, fontSize: 11 }}>
          <span style={{ fontWeight: 600, marginRight: 8 }}>Status do relatório:</span>
          <span style={{ background: statusBg, color: statusColor, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{statusLabel}</span>
        </div>
        <table style={s.table}>
          <thead>
            <tr>
              {['Assinatura — MARV', 'Assinatura — Cliente', 'Assinatura — Fiscal'].map(l => (
                <th key={l} style={{ ...s.th, textAlign: 'center' }}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {['marv', 'cliente', 'fiscal'].map(tipo => {
                const ass = assinaturas.find(a => a.tipo === tipo)
                return (
                  <td key={tipo} style={{ ...s.td, textAlign: 'center', height: 100, verticalAlign: 'middle', padding: 8 }}>
                    {ass?.assinatura_url
                      ? <img src={ass.assinatura_url} alt="assinatura" style={{ maxHeight: 70, maxWidth: '100%', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                      : <div style={{ height: 70, border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 10 }}>Sem assinatura</div>
                    }
                    {ass?.nome && <div style={{ fontSize: 10, marginTop: 4, fontWeight: 600 }}>{ass.nome}</div>}
                    {ass?.assinado_em && <div style={{ fontSize: 9, color: '#777' }}>{new Date(ass.assinado_em).toLocaleString('pt-BR')}</div>}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 9, color: '#aaa', borderTop: '1px solid #eee', paddingTop: 8 }}>
          Relatório gerado por MARV Gestão — {new Date().toLocaleString('pt-BR')}
        </div>

      </div>
    </>
  )
}
