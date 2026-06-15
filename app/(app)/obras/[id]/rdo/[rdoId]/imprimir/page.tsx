'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Obra, RDO, RDOClima, RDOMaoObra, RDOEquipamento, RDOAtividade, RDOOcorrencia, RDOComentario, RDOFoto, RDOAssinatura } from '@/lib/types'

const DIAS_SEMANA = ['Domingo','Segunda-Feira','Terça-Feira','Quarta-Feira','Quinta-Feira','Sexta-Feira','Sábado']

export default function RDOImprimirPage() {
  const { id: obraId, rdoId } = useParams<{ id: string; rdoId: string }>()

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

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [obraRes, rdoRes, climaRes, maoRes, eqRes, atRes, ocRes, comRes, fotosRes, assRes] = await Promise.all([
        supabase.from('obras').select('*, cliente:clientes(*)').eq('id', obraId).single(),
        supabase.from('rdos').select('*').eq('id', rdoId).single(),
        supabase.from('rdo_clima').select('*').eq('rdo_id', rdoId).order('periodo'),
        supabase.from('rdo_mao_obra').select('*').eq('rdo_id', rdoId),
        supabase.from('rdo_equipamentos').select('*').eq('rdo_id', rdoId),
        supabase.from('rdo_atividades').select('*').eq('rdo_id', rdoId).order('ordem'),
        supabase.from('rdo_ocorrencias').select('*').eq('rdo_id', rdoId).order('created_at'),
        supabase.from('rdo_comentarios').select('*').eq('rdo_id', rdoId).order('created_at'),
        supabase.from('rdo_fotos').select('*').eq('rdo_id', rdoId).order('ordem'),
        supabase.from('rdo_assinaturas').select('*').eq('rdo_id', rdoId),
      ])
      if (obraRes.data) setObra(obraRes.data as Obra)
      if (rdoRes.data) setRdo(rdoRes.data as RDO)
      if (climaRes.data) setClima(climaRes.data as RDOClima[])
      if (maoRes.data) setMaoObra(maoRes.data as RDOMaoObra[])
      if (eqRes.data) setEquipamentos(eqRes.data as RDOEquipamento[])
      if (atRes.data) setAtividades(atRes.data as RDOAtividade[])
      if (ocRes.data) setOcorrencias(ocRes.data as RDOOcorrencia[])
      if (comRes.data) setComentarios(comRes.data as RDOComentario[])
      if (fotosRes.data) setFotos(fotosRes.data as RDOFoto[])
      if (assRes.data) setAssinaturas(assRes.data as RDOAssinatura[])
      setLoading(false)
    }
    load()
  }, [rdoId, obraId])

  useEffect(() => {
    if (!loading && rdo) {
      setTimeout(() => window.print(), 800)
    }
  }, [loading, rdo])

  if (loading || !rdo || !obra) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#4F7CFF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Preparando relatório...</p>
        </div>
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

  const periodoLabel: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
  const climaAtivo = clima.filter(c => c.ativo)
  const maoObraDireta = maoObra.filter(m => m.tipo === 'direta')
  const maoObraIndireta = maoObra.filter(m => m.tipo === 'indireta')
  const totalMao = maoObra.reduce((s, m) => s + m.quantidade, 0)

  const statusLabel = rdo.status === 'aprovado' ? 'Aprovado' : rdo.status === 'revisando' ? 'Revisando' : 'Preenchendo Relatório'

  return (
    <>
      <style>{`
        @page { size: A4; margin: 12mm 15mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: white; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 4px 6px; }
        th { background: #f5f5f5; font-weight: 600; }
        .section-title { color: #e65c00; font-size: 13px; font-weight: 700; border-bottom: 2px solid #e65c00; padding-bottom: 3px; margin: 16px 0 8px; }
        .header-table td { border: 1px solid #ccc; padding: 5px 8px; }
        .foto-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .foto-grid img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border: 1px solid #ddd; }
        .foto-legenda { font-size: 9px; color: #555; margin-top: 2px; text-align: center; min-height: 24px; border: 1px solid #eee; padding: 2px; }
        .sig-box { border: 1px solid #ccc; height: 70px; display: flex; align-items: center; justify-content: center; background: #fafafa; }
        .sig-box img { max-height: 64px; max-width: 100%; object-fit: contain; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
        .badge-green { background: #d1fae5; color: #065f46; }
        .badge-blue { background: #dbeafe; color: #1e40af; }
        .badge-amber { background: #fef3c7; color: #92400e; }
      `}</style>

      {/* Botão imprimir - some no print */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button onClick={() => window.print()}
          className="bg-[#4F7CFF] text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg hover:bg-[#3D6AE8] transition-colors">
          Imprimir / Salvar PDF
        </button>
        <button onClick={() => window.history.back()}
          className="bg-white text-gray-600 text-sm font-medium px-4 py-2 rounded-lg shadow border border-gray-200 hover:bg-gray-50">
          Voltar
        </button>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>

        {/* ── CABEÇALHO ── */}
        <table style={{ marginBottom: '12px' }}>
          <tbody>
            <tr>
              <td style={{ width: '33%', border: '1px solid #ccc', padding: '8px', textAlign: 'center', verticalAlign: 'middle' }}>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#1a1a1a' }}>MARV</div>
                <div style={{ fontSize: '9px', color: '#555' }}>Manutenção e Serviços Ltda.</div>
              </td>
              <td style={{ width: '34%', border: '1px solid #ccc', padding: '8px', textAlign: 'center', verticalAlign: 'middle' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1a1a1a' }}>Relatório Diário de Obra</div>
                <div style={{ fontSize: '11px', color: '#555', fontWeight: '600' }}>(RDO)</div>
              </td>
              <td style={{ width: '33%', border: '1px solid #ccc', padding: '0', verticalAlign: 'top' }}>
                <table style={{ width: '100%', margin: 0 }}>
                  <tbody>
                    <tr>
                      <td style={{ border: 'none', borderBottom: '1px solid #ccc', borderRight: '1px solid #ccc', padding: '4px 6px', fontSize: '10px', color: '#555' }}>Relatório nº</td>
                      <td style={{ border: 'none', borderBottom: '1px solid #ccc', padding: '4px 6px', fontWeight: '700' }}>{rdo.numero}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', borderBottom: '1px solid #ccc', borderRight: '1px solid #ccc', padding: '4px 6px', fontSize: '10px', color: '#555' }}>Data</td>
                      <td style={{ border: 'none', borderBottom: '1px solid #ccc', padding: '4px 6px', fontWeight: '700' }}>{dataRdo.toLocaleDateString('pt-BR')}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', borderBottom: '1px solid #ccc', borderRight: '1px solid #ccc', padding: '4px 6px', fontSize: '10px', color: '#555' }}>Dia da semana</td>
                      <td style={{ border: 'none', borderBottom: '1px solid #ccc', padding: '4px 6px' }}>{diaSemana}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', borderRight: '1px solid #ccc', padding: '4px 6px', fontSize: '10px', color: '#555' }}>Nº do contrato</td>
                      <td style={{ border: 'none', padding: '4px 6px' }}>{obra.numero_contrato || '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Info da obra */}
        <table style={{ marginBottom: '4px' }}>
          <tbody>
            <tr>
              <td style={{ width: '15%', fontWeight: '600', background: '#f5f5f5' }}>Obra</td>
              <td colSpan={3}>{obra.titulo}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: '600', background: '#f5f5f5' }}>Endereço</td>
              <td colSpan={3}>{obra.endereco || '—'}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: '600', background: '#f5f5f5' }}>Contratante</td>
              <td style={{ width: '30%' }}>{(obra.cliente as any)?.nome || '—'}</td>
              <td style={{ width: '15%', fontWeight: '600', background: '#f5f5f5' }}>Responsável</td>
              <td>{obra.engenheiro_responsavel || '—'}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: '600', background: '#f5f5f5' }}>Prazo contratual</td>
              <td>{prazoContratual} dias</td>
              <td style={{ fontWeight: '600', background: '#f5f5f5' }}>Prazo decorrido</td>
              <td>{prazoDecorrido} dias</td>
            </tr>
            <tr>
              <td style={{ fontWeight: '600', background: '#f5f5f5' }}>Prazo a vencer</td>
              <td>{prazoVencer} dias</td>
              <td style={{ fontWeight: '600', background: '#f5f5f5' }}>Status</td>
              <td><span className={`badge ${rdo.status === 'aprovado' ? 'badge-green' : rdo.status === 'revisando' ? 'badge-amber' : 'badge-blue'}`}>{statusLabel}</span></td>
            </tr>
          </tbody>
        </table>

        {/* ── CONDIÇÃO CLIMÁTICA ── */}
        {climaAtivo.length > 0 && (
          <>
            <div className="section-title">Condição Climática</div>
            <table>
              <thead>
                <tr>
                  <th>Período</th><th>Tempo</th><th>Condição</th>
                </tr>
              </thead>
              <tbody>
                {climaAtivo.map(c => (
                  <tr key={c.id}>
                    <td>{periodoLabel[c.periodo] || c.periodo}</td>
                    <td style={{ textTransform: 'capitalize' }}>{c.tempo || '—'}</td>
                    <td>{c.condicao === 'praticavel' ? 'Praticável' : c.condicao === 'impraticavel' ? 'Impraticável' : '—'}</td>
                  </tr>
                ))}
                {rdo.indice_pluviometrico && (
                  <tr>
                    <td colSpan={2} style={{ fontWeight: '600', background: '#f5f5f5' }}>Índice pluviométrico (mm)</td>
                    <td>{rdo.indice_pluviometrico}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* ── MÃO DE OBRA ── */}
        {maoObra.length > 0 && (
          <>
            <div className="section-title">Mão de Obra ({totalMao} pessoas)</div>
            <table>
              <thead><tr><th>Função</th><th>Tipo</th><th style={{ width: '80px' }}>Quantidade</th></tr></thead>
              <tbody>
                {maoObra.map(m => (
                  <tr key={m.id}>
                    <td>{m.funcao}</td>
                    <td>{m.tipo === 'direta' ? 'Mão de Obra Direta' : 'Mão de Obra Indireta'}</td>
                    <td style={{ textAlign: 'center', fontWeight: '700' }}>{m.quantidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ── EQUIPAMENTOS ── */}
        {equipamentos.length > 0 && (
          <>
            <div className="section-title">Equipamentos ({equipamentos.length})</div>
            <table>
              <thead><tr><th>Equipamento</th><th style={{ width: '80px' }}>Quantidade</th></tr></thead>
              <tbody>
                {equipamentos.map(e => (
                  <tr key={e.id}>
                    <td>{e.nome}</td>
                    <td style={{ textAlign: 'center', fontWeight: '700' }}>{e.quantidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ── ATIVIDADES ── */}
        {atividades.length > 0 && (
          <>
            <div className="section-title">Atividades ({atividades.length})</div>
            <table>
              <thead><tr><th>Descrição</th><th style={{ width: '100px' }}>Progresso</th><th style={{ width: '100px' }}>Status</th></tr></thead>
              <tbody>
                {atividades.map(a => (
                  <tr key={a.id}>
                    <td>• {a.descricao}</td>
                    <td style={{ textAlign: 'center' }}>{a.progresso}%</td>
                    <td style={{ textAlign: 'center' }}>{a.status_ativ}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ── OCORRÊNCIAS ── */}
        {ocorrencias.length > 0 && (
          <>
            <div className="section-title">Ocorrências ({ocorrencias.length})</div>
            <table>
              <thead><tr><th>Descrição</th><th style={{ width: '120px' }}>Data/Hora</th></tr></thead>
              <tbody>
                {ocorrencias.map(o => (
                  <tr key={o.id}>
                    <td>{o.descricao}</td>
                    <td style={{ fontSize: '9px', color: '#555' }}>{new Date(o.created_at).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ── COMENTÁRIOS ── */}
        {comentarios.length > 0 && (
          <>
            <div className="section-title">Comentários ({comentarios.length})</div>
            <table>
              <thead><tr><th style={{ width: '120px' }}>Autor</th><th>Texto</th><th style={{ width: '120px' }}>Data/Hora</th></tr></thead>
              <tbody>
                {comentarios.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: '600' }}>{c.autor}</td>
                    <td>{c.texto}</td>
                    <td style={{ fontSize: '9px', color: '#555' }}>{new Date(c.created_at).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ── FOTOS ── */}
        {fotos.length > 0 && (
          <>
            <div className="section-title page-break">Fotos ({fotos.length})</div>
            <div className="foto-grid">
              {fotos.map(f => (
                <div key={f.id}>
                  <img src={f.url} alt={f.legenda || ''} />
                  <div className="foto-legenda">{f.legenda || ''}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── ASSINATURAS ── */}
        <div className="section-title" style={{ marginTop: '24px' }}>Assinatura Manual</div>

        {/* Status do relatório */}
        <div style={{ marginBottom: '12px', fontSize: '11px' }}>
          <span style={{ fontWeight: '600', marginRight: '8px' }}>Status do relatório:</span>
          <span className={`badge ${rdo.status === 'aprovado' ? 'badge-green' : rdo.status === 'revisando' ? 'badge-amber' : 'badge-blue'}`}>{statusLabel}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Assinatura — MARV</th>
              <th>Assinatura — Cliente</th>
              <th>Assinatura — Fiscal</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {['marv', 'cliente', 'fiscal'].map(tipo => {
                const ass = assinaturas.find(a => a.tipo === tipo)
                return (
                  <td key={tipo} style={{ padding: '8px', textAlign: 'center', height: '90px', verticalAlign: 'middle' }}>
                    {ass?.assinatura_url
                      ? <img src={ass.assinatura_url} alt="assinatura" style={{ maxHeight: '70px', maxWidth: '100%', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                      : <div style={{ height: '70px', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '10px' }}>Sem assinatura</div>
                    }
                    {ass?.nome && <div style={{ fontSize: '10px', marginTop: '4px', fontWeight: '600' }}>{ass.nome}</div>}
                    {ass?.assinado_em && <div style={{ fontSize: '9px', color: '#555' }}>{new Date(ass.assinado_em).toLocaleString('pt-BR')}</div>}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '9px', color: '#999', borderTop: '1px solid #eee', paddingTop: '8px' }}>
          Relatório gerado por MARV Gestão — {new Date().toLocaleString('pt-BR')}
        </div>

      </div>
    </>
  )
}
