'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FerramentaEmprestimo, FerramentaEmprestimoItem } from '@/lib/types'

export default function EmprestimoPrintPage() {
  const { emprestimoId } = useParams<{ emprestimoId: string }>()

  const [emprestimo, setEmprestimo] = useState<FerramentaEmprestimo | null>(null)
  const [itens, setItens] = useState<FerramentaEmprestimoItem[]>([])
  const [empresa, setEmpresa] = useState({
    razao_social: 'Marv Manutenção e Serviços Ltda.',
    cnpj: '03.709.796/0001-44',
    endereco: 'Rua Cândido Benício, nº 2326, Loja — Praça Seca, Jacarepaguá — RJ, CEP 22733-001',
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: emp }, { data: its }, { data: dadosEmpresa }] = await Promise.all([
        supabase.from('ferramenta_emprestimos').select('*, funcionario:funcionarios(id, nome, cargo, funcao, cpf), obra:obras(id, titulo)').eq('id', emprestimoId).single(),
        supabase.from('ferramenta_emprestimo_itens').select('*, ferramenta:ferramentas(*)').eq('emprestimo_id', emprestimoId),
        supabase.from('configuracoes_empresa').select('valor').eq('chave', 'dados_empresa').maybeSingle(),
      ])
      setEmprestimo(emp as unknown as FerramentaEmprestimo)
      setItens((its ?? []) as unknown as FerramentaEmprestimoItem[])
      if (dadosEmpresa?.valor) setEmpresa(e => ({ ...e, ...(dadosEmpresa.valor as object) }))
      setLoading(false)
    }
    load()
  }, [emprestimoId])

  useEffect(() => {
    if (!loading && emprestimo) setTimeout(() => window.print(), 600)
  }, [loading, emprestimo])

  if (loading || !emprestimo) {
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

  const dataEmprestimo = new Date(emprestimo.data_emprestimo + 'T12:00:00').toLocaleDateString('pt-BR')
  const dataPrevista = emprestimo.data_prevista_devolucao
    ? new Date(emprestimo.data_prevista_devolucao + 'T12:00:00').toLocaleDateString('pt-BR')
    : '—'

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
          Contrato de Empréstimo de Ferramentas
        </h1>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#64748B', marginBottom: 20, lineHeight: 1.5 }}>
          {empresa.razao_social} — CNPJ {empresa.cnpj}<br />
          {empresa.endereco}
        </p>

        <table style={s.table}>
          <tbody>
            <tr>
              <td style={{ ...s.th, width: '30%' }}>Funcionário responsável</td>
              <td style={s.td}>{emprestimo.funcionario?.nome ?? '—'}</td>
            </tr>
            {(emprestimo.funcionario?.cargo || emprestimo.funcionario?.funcao) && (
              <tr>
                <td style={s.th}>Cargo / Função</td>
                <td style={s.td}>{[emprestimo.funcionario?.cargo, emprestimo.funcionario?.funcao].filter(Boolean).join(' / ')}</td>
              </tr>
            )}
            {emprestimo.funcionario?.cpf && (
              <tr>
                <td style={s.th}>CPF</td>
                <td style={s.td}>{emprestimo.funcionario.cpf}</td>
              </tr>
            )}
            <tr>
              <td style={s.th}>Data do empréstimo</td>
              <td style={s.td}>{dataEmprestimo}</td>
            </tr>
            <tr>
              <td style={s.th}>Devolução prevista</td>
              <td style={s.td}>{dataPrevista}</td>
            </tr>
            {emprestimo.obra?.titulo && (
              <tr>
                <td style={s.th}>Obra</td>
                <td style={s.td}>{emprestimo.obra.titulo}</td>
              </tr>
            )}
            {emprestimo.observacoes && (
              <tr>
                <td style={s.th}>Observações</td>
                <td style={s.td}>{emprestimo.observacoes}</td>
              </tr>
            )}
          </tbody>
        </table>

        <h2 style={{ fontSize: 13, fontWeight: 700, margin: '20px 0 6px' }}>Ferramentas emprestadas</h2>
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
            {itens.map(it => (
              <tr key={it.id}>
                <td style={{ ...s.td, fontFamily: 'monospace', fontWeight: 700 }}>{it.ferramenta?.codigo_interno ?? '—'}</td>
                <td style={s.td}>{it.ferramenta?.nome ?? '—'}</td>
                <td style={s.td}>{[it.ferramenta?.marca, it.ferramenta?.modelo].filter(Boolean).join(' · ') || '—'}</td>
                <td style={s.td}>{it.ferramenta?.numero_serie ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ fontSize: 11, color: '#374151', marginTop: 24, lineHeight: 1.6 }}>
          Declaro ter recebido as ferramentas e/ou máquinas listadas acima em bom estado de conservação e funcionamento,
          comprometendo-me a devolvê-las nas mesmas condições, respondendo por eventuais danos, extravios ou perdas
          decorrentes de mau uso durante o período de posse.
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
