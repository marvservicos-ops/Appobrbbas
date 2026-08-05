'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Ferramenta } from '@/lib/types'

export default function MalaPrintPage() {
  const { malaId } = useParams<{ malaId: string }>()

  const [mala, setMala] = useState<Ferramenta | null>(null)
  const [itens, setItens] = useState<Ferramenta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: m }, { data: its }] = await Promise.all([
        supabase.from('ferramentas').select('*, responsavel_atual:funcionarios(id, nome, cargo, funcao, cpf)').eq('id', malaId).single(),
        supabase.from('ferramentas').select('*').eq('mala_id', malaId).order('nome'),
      ])
      setMala(m as unknown as Ferramenta)
      setItens((its ?? []) as unknown as Ferramenta[])
      setLoading(false)
    }
    load()
  }, [malaId])

  useEffect(() => {
    if (!loading && mala) setTimeout(() => window.print(), 600)
  }, [loading, mala])

  if (loading || !mala) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #4F7CFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#64748B', fontSize: 13 }}>Preparando contrato...</p>
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

  const dataHoje = new Date().toLocaleDateString('pt-BR')

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
          Termo de Responsabilidade — Mala de Ferramentas
        </h1>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#64748B', marginBottom: 20 }}>
          MARV Serviços
        </p>

        <table style={s.table}>
          <tbody>
            <tr>
              <td style={{ ...s.th, width: '30%' }}>Mala</td>
              <td style={s.td}>{mala.nome}{mala.codigo_interno ? ` (${mala.codigo_interno})` : ''}</td>
            </tr>
            <tr>
              <td style={s.th}>Responsável atual</td>
              <td style={s.td}>{mala.responsavel_atual?.nome ?? '—'}</td>
            </tr>
            {(mala.responsavel_atual?.cargo || mala.responsavel_atual?.funcao) && (
              <tr>
                <td style={s.th}>Cargo / Função</td>
                <td style={s.td}>{[mala.responsavel_atual?.cargo, mala.responsavel_atual?.funcao].filter(Boolean).join(' / ')}</td>
              </tr>
            )}
            {mala.responsavel_atual?.cpf && (
              <tr>
                <td style={s.th}>CPF</td>
                <td style={s.td}>{mala.responsavel_atual.cpf}</td>
              </tr>
            )}
            <tr>
              <td style={s.th}>Data de emissão</td>
              <td style={s.td}>{dataHoje}</td>
            </tr>
          </tbody>
        </table>

        <h2 style={{ fontSize: 13, fontWeight: 700, margin: '20px 0 6px' }}>Conteúdo da mala ({itens.length} {itens.length === 1 ? 'item' : 'itens'})</h2>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Código</th>
              <th style={s.th}>Ferramenta</th>
              <th style={s.th}>Marca / Modelo</th>
              <th style={s.th}>Nº de série</th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 ? (
              <tr><td style={s.td} colSpan={4}>Nenhum item cadastrado.</td></tr>
            ) : itens.map(it => (
              <tr key={it.id}>
                <td style={{ ...s.td, fontFamily: 'monospace', fontWeight: 700 }}>{it.codigo_interno ?? '—'}</td>
                <td style={s.td}>{it.nome}</td>
                <td style={s.td}>{[it.marca, it.modelo].filter(Boolean).join(' · ') || '—'}</td>
                <td style={s.td}>{it.numero_serie ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ fontSize: 11, color: '#374151', marginTop: 24, lineHeight: 1.6 }}>
          Declaro ter recebido a mala de ferramentas acima descrita, com todos os itens listados, em bom estado de
          conservação e funcionamento, ficando responsável pela sua guarda e conservação enquanto estiver em minha
          posse, respondendo por eventuais danos, extravios ou perdas decorrentes de mau uso. Este termo substitui
          qualquer versão anterior emitida para esta mala.
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
