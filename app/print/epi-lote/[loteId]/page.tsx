'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface RegistroEpi {
  id: string
  data: string
  produto_nome: string
  quantidade: number
  unidade?: string | null
  responsavel: string
  observacoes?: string | null
  funcionario?: { nome: string } | null
  estoque?: { nome: string } | null
  valores?: { valor: string; campo?: { nome: string } | null }[]
}

export default function EpiLotePrintPage() {
  const { loteId } = useParams<{ loteId: string }>()

  const [registros, setRegistros] = useState<RegistroEpi[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('estoque_registros')
        .select('id, data, produto_nome, quantidade, unidade, responsavel, observacoes, funcionario:funcionario_id(nome), estoque:estoque_id(nome), valores:estoque_registro_valores(valor, campo:campo_id(nome))')
        .eq('lote_id', loteId)
        .order('created_at')
      setRegistros((data ?? []) as unknown as RegistroEpi[])
      setLoading(false)
    }
    load()
  }, [loteId])

  useEffect(() => {
    if (!loading && registros.length > 0) setTimeout(() => window.print(), 600)
  }, [loading, registros])

  if (loading || registros.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #4F7CFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#64748B', fontSize: 13 }}>Preparando termo...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const s: Record<string, React.CSSProperties> = {
    table: { borderCollapse: 'collapse', width: '100%', marginTop: 12 },
    th: { border: '1px solid #ccc', padding: '6px 8px', background: '#f5f5f5', fontWeight: 600, fontSize: 11, textAlign: 'left' },
    td: { border: '1px solid #ccc', padding: '6px 8px', fontSize: 11 },
  }

  const primeiro = registros[0]
  const dataEmissao = new Date(primeiro.data + 'T00:00:00').toLocaleDateString('pt-BR')

  // Colunas de campos extras (ex.: Nº CA) que aparecem em pelo menos um item
  const nomesCampos = Array.from(new Set(
    registros.flatMap(r => (r.valores ?? []).filter(v => v.campo?.nome && v.valor).map(v => v.campo!.nome))
  ))

  return (
    <>
      <style>{`
        @page { size: A4; margin: 15mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; margin: 0; background: white; }
      `}</style>

      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 100 }}>
        <button onClick={() => window.print()}
          style={{ background: '#4F7CFF', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Imprimir / Salvar PDF
        </button>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 8px' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>
          Termo de Responsabilidade — {primeiro.estoque?.nome ?? 'Entrega de EPI'}
        </h1>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#64748B', marginBottom: 20 }}>
          MARV Serviços
        </p>

        <table style={s.table}>
          <tbody>
            <tr>
              <td style={{ ...s.th, width: '30%' }}>Funcionário</td>
              <td style={s.td}>{primeiro.funcionario?.nome ?? '—'}</td>
            </tr>
            <tr>
              <td style={s.th}>Data de emissão</td>
              <td style={s.td}>{dataEmissao}</td>
            </tr>
            <tr>
              <td style={s.th}>Entregue por</td>
              <td style={s.td}>{primeiro.responsavel}</td>
            </tr>
          </tbody>
        </table>

        <h2 style={{ fontSize: 13, fontWeight: 700, margin: '20px 0 6px' }}>Itens entregues ({registros.length})</h2>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Item</th>
              <th style={s.th}>Quantidade</th>
              {nomesCampos.map(nome => <th key={nome} style={s.th}>{nome}</th>)}
            </tr>
          </thead>
          <tbody>
            {registros.map(r => (
              <tr key={r.id}>
                <td style={s.td}>{r.produto_nome}</td>
                <td style={s.td}>{r.quantidade} {r.unidade ?? ''}</td>
                {nomesCampos.map(nome => (
                  <td key={nome} style={s.td}>{(r.valores ?? []).find(v => v.campo?.nome === nome)?.valor ?? '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {primeiro.observacoes && (
          <p style={{ fontSize: 11, color: '#374151', marginTop: 12 }}><strong>Observações:</strong> {primeiro.observacoes}</p>
        )}

        <p style={{ fontSize: 11, color: '#374151', marginTop: 24, lineHeight: 1.6 }}>
          Declaro ter recebido os itens acima descritos, em bom estado de conservação e funcionamento,
          comprometendo-me a utilizá-los corretamente e zelar pela sua guarda e conservação, respondendo por
          eventuais danos, extravios ou perdas decorrentes de mau uso ou negligência.
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 64, gap: 24 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 6, fontSize: 11 }}>
              Assinatura do funcionário
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 6, fontSize: 11 }}>
              Assinatura do responsável (empresa)
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
