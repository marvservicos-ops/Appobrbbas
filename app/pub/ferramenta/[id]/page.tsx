import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
}
function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

function statusLabelMap(modoPatrimonio: boolean): Record<string, string> {
  return modoPatrimonio
    ? { disponivel: 'Em operação', emprestada: 'Em uso', em_manutencao: 'Com defeito', baixada: 'Fora de uso' }
    : { disponivel: 'Disponível', emprestada: 'Emprestada', em_manutencao: 'Em manutenção', baixada: 'Baixada' }
}
const STATUS_COLOR: Record<string, string> = {
  disponivel: '#059669', emprestada: '#D97706', em_manutencao: '#DC2626', baixada: '#64748B',
}

export default async function PubFerramentaPage({ params }: { params: { id: string } }) {
  const sb = await createClient()

  const [{ data: ferramenta }, { data: itemAberto }, { data: defeitos }, { data: conteudoMala }, { data: dadosTecnicos }] = await Promise.all([
    sb.from('ferramentas').select('*, estoque:estoques(icone), mala:mala_id(id, nome, codigo_interno, responsavel_atual:funcionarios(id, nome)), responsavel_atual:funcionarios(id, nome)').eq('id', params.id).single(),
    sb.from('ferramenta_emprestimo_itens').select('*, emprestimo:ferramenta_emprestimos(*, funcionario:funcionarios(id, nome))').eq('ferramenta_id', params.id).is('data_devolucao', null).maybeSingle(),
    sb.from('ferramenta_defeitos').select('*').eq('ferramenta_id', params.id).order('data', { ascending: false }).limit(10),
    sb.from('ferramentas').select('id, nome, codigo_interno, status').eq('mala_id', params.id).order('nome'),
    sb.from('ferramenta_dados').select('*, campo:campos_tecnicos(*)').eq('ferramenta_id', params.id),
  ])

  if (!ferramenta) notFound()

  const f = ferramenta as any
  const modoPatrimonio = f.estoque?.icone === 'building2'
  const STATUS_LABEL = statusLabelMap(modoPatrimonio)
  const cor = STATUS_COLOR[f.status] ?? '#64748B'
  const funcionario = (itemAberto as any)?.emprestimo?.funcionario

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#F8FAFC', minHeight: '100vh', padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '20px 24px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <img src="/marv-logo.png" alt="MARV" style={{ height: 22, width: 'auto', display: 'block', marginBottom: 8 }} />
          <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>
            MARV Gestão · {modoPatrimonio ? 'Patrimônio' : 'Ferramentas'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {f.eh_mala ? (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#EEF2FF', color: '#4F7CFF' }}>Mala</span>
            ) : f.mala_id && f.status === 'disponivel' ? (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#EEF2FF', color: '#4F7CFF' }}>Na mala</span>
            ) : (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                background: cor + '20', color: cor,
              }}>{STATUS_LABEL[f.status] ?? f.status}</span>
            )}
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0F172A' }}>{f.nome}</h1>
            {f.codigo_interno && (
              <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#64748B', background: '#F1F5F9', padding: '2px 8px', borderRadius: 6 }}>
                {f.codigo_interno}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Foto */}
        {f.foto_url && (
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px #0001', flex: 1 }}>
              <img src={f.foto_url} alt={f.nome} style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />
            </div>
            {f.foto_url_2 && (
              <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px #0001', flex: 1 }}>
                <img src={f.foto_url_2} alt={f.nome} style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />
              </div>
            )}
          </div>
        )}

        {/* Pertence a uma mala */}
        {f.mala && (
          <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 16, padding: '14px 20px' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#4338CA' }}>
              Faz parte da mala {f.mala.nome}{f.mala.codigo_interno ? ` (${f.mala.codigo_interno})` : ''}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#4338CA' }}>
              {f.mala.responsavel_atual ? `Com ${f.mala.responsavel_atual.nome}` : 'Sem responsável definido'}
            </p>
          </div>
        )}

        {/* Responsável pela mala */}
        {f.eh_mala && (
          <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 16, padding: '14px 20px' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#4338CA' }}>
              {f.responsavel_atual ? `Com ${f.responsavel_atual.nome}` : 'Sem responsável definido'}
            </p>
          </div>
        )}

        {/* Custódia atual (empréstimo) */}
        {funcionario && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 16, padding: '14px 20px' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#92400E' }}>
              Com {funcionario.nome} desde {fmtDate((itemAberto as any)?.emprestimo?.data_emprestimo)}
            </p>
          </div>
        )}

        {/* Conteúdo da mala */}
        {f.eh_mala && conteudoMala && conteudoMala.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 1px 4px #0001' }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Conteúdo da Mala</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(conteudoMala as any[]).map((it: any) => (
                <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}>
                  <span>{it.nome}{it.codigo_interno ? ` · ${it.codigo_interno}` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dados */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 1px 4px #0001' }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{modoPatrimonio ? 'Dados do Patrimônio' : 'Dados da Ferramenta'}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
            {f.categoria && (
              <div>
                <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>Categoria</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{f.categoria}</p>
              </div>
            )}
            {(f.marca || f.modelo) && (
              <div>
                <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>Marca / Modelo</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{[f.marca, f.modelo].filter(Boolean).join(' · ')}</p>
              </div>
            )}
            {f.numero_serie && (
              <div>
                <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>Nº de série</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{f.numero_serie}</p>
              </div>
            )}
            {f.valor_aquisicao != null && (
              <div>
                <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>Valor de aquisição</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{fmt(f.valor_aquisicao)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Dados técnicos */}
        {dadosTecnicos && dadosTecnicos.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 1px 4px #0001' }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Dados Técnicos</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
              {(dadosTecnicos as any[]).filter(d => d.valor).map((d: any) => (
                <div key={d.id}>
                  <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>{d.campo?.nome}{d.campo?.unidade ? ` (${d.campo.unidade})` : ''}</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{d.valor}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Histórico de defeitos */}
        {defeitos && defeitos.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 1px 4px #0001' }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Histórico de Defeitos</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(defeitos as any[]).map((d: any) => (
                <div key={d.id} style={{ padding: '10px 12px', border: '1px solid #F1F5F9', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{d.descricao}</p>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 999, whiteSpace: 'nowrap',
                      background: d.resolvido ? '#D1FAE5' : '#FEE2E2',
                      color: d.resolvido ? '#059669' : '#DC2626',
                    }}>{d.resolvido ? 'Resolvido' : 'Em aberto'}</span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>{fmtDate(d.data)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA para gerenciar */}
        <Link href="/login" style={{
          display: 'block', textAlign: 'center', background: '#4F7CFF', color: 'white',
          fontWeight: 700, fontSize: 14, padding: '14px', borderRadius: 12, textDecoration: 'none',
        }}>
          Entrar para gerenciar
        </Link>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#CBD5E1', margin: 0 }}>MARV Gestão · {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
