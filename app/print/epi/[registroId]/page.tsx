'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PrintCarregando, PrintNaoEncontrado } from '../../Estados'

interface RegistroEpi {
  id: string
  data: string
  produto_nome: string
  quantidade: number
  unidade?: string | null
  responsavel: string
  observacoes?: string | null
  funcionario?: { nome: string; cargo: string | null; funcao: string | null; cpf: string | null } | null
  estoque?: { nome: string; icone: string | null } | null
  produto?: { codigo: string | null } | null
  valores?: { valor: string; campo?: { nome: string } | null }[]
}

// Campo extra do registro que guarda o nº do CA (ex.: "Nº CA")
const ehCampoCA = (nome?: string) => !!nome && /\bCA\b/i.test(nome)

// Nº CA do item: o informado na saída tem prioridade; senão, o do cadastro do produto (EPI)
function caDoRegistro(r: RegistroEpi) {
  const doRegistro = (r.valores ?? []).find(v => ehCampoCA(v.campo?.nome) && v.valor)?.valor
  if (doRegistro) return doRegistro
  return r.estoque?.icone === 'shield' ? r.produto?.codigo ?? null : null
}

export default function EpiPrintPage() {
  const { registroId } = useParams<{ registroId: string }>()

  const [registro, setRegistro] = useState<RegistroEpi | null>(null)
  const [empresa, setEmpresa] = useState({
    razao_social: 'Marv Manutenção e Serviços Ltda.',
    cnpj: '03.709.796/0001-44',
    endereco: 'Estrada do Rio Grande, 268 – Taquara, Rio de Janeiro/RJ',
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const [{ data }, { data: dadosEmpresa }] = await Promise.all([
          supabase.from('estoque_registros')
            .select('id, data, produto_nome, quantidade, unidade, responsavel, observacoes, funcionario:funcionario_id(nome, cargo, funcao, cpf), estoque:estoque_id(nome, icone), produto:produto_id(codigo), valores:estoque_registro_valores(valor, campo:campo_id(nome))')
            .eq('id', registroId)
            .single(),
          supabase.from('configuracoes_empresa').select('valor').eq('chave', 'dados_empresa').maybeSingle(),
        ])
        setRegistro(data as unknown as RegistroEpi)
        if (dadosEmpresa?.valor) setEmpresa(e => ({ ...e, ...(dadosEmpresa.valor as object) }))
      } catch (err) {
        console.error('Erro ao carregar dados para impressão', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [registroId])

  useEffect(() => {
    // Só imprime com todos os dados carregados (loading cai depois de todas as consultas)
    if (loading || !(registro)) return
    const t = setTimeout(() => window.print(), 600)
    return () => clearTimeout(t)
  }, [loading, registro])

  if (loading) return <PrintCarregando texto="Preparando termo..." />
  if (!registro) return <PrintNaoEncontrado texto="Registro de entrega não encontrado." voltarHref="/estoque" voltarTexto="Voltar ao estoque" />

  const s: Record<string, React.CSSProperties> = {
    table: { borderCollapse: 'collapse', width: '100%', marginTop: 12 },
    th: { border: '1px solid #ccc', padding: '6px 8px', background: '#f5f5f5', fontWeight: 600, fontSize: 11, textAlign: 'left' },
    td: { border: '1px solid #ccc', padding: '6px 8px', fontSize: 11 },
  }

  const dataEmissao = new Date(registro.data + 'T00:00:00').toLocaleDateString('pt-BR')
  const valoresComNome = (registro.valores ?? []).filter(v => v.campo?.nome && v.valor && !ehCampoCA(v.campo.nome))
  const ca = caDoRegistro(registro)
  const mostrarCA = !!ca || registro.estoque?.icone === 'shield'

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
          Termo de Responsabilidade — {registro.estoque?.nome ?? 'Entrega de EPI'}
        </h1>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#64748B', marginBottom: 20, lineHeight: 1.5 }}>
          {empresa.razao_social} — CNPJ {empresa.cnpj}<br />
          {empresa.endereco}
        </p>

        <table style={s.table}>
          <tbody>
            <tr>
              <td style={{ ...s.th, width: '30%' }}>Funcionário</td>
              <td style={s.td}>{registro.funcionario?.nome ?? '—'}</td>
            </tr>
            {(registro.funcionario?.cargo || registro.funcionario?.funcao) && (
              <tr>
                <td style={s.th}>Cargo / Função</td>
                <td style={s.td}>{[registro.funcionario?.cargo, registro.funcionario?.funcao].filter(Boolean).join(' / ')}</td>
              </tr>
            )}
            {registro.funcionario?.cpf && (
              <tr>
                <td style={s.th}>CPF</td>
                <td style={s.td}>{registro.funcionario.cpf}</td>
              </tr>
            )}
            <tr>
              <td style={s.th}>Data de emissão</td>
              <td style={s.td}>{dataEmissao}</td>
            </tr>
            <tr>
              <td style={s.th}>Entregue por</td>
              <td style={s.td}>{registro.responsavel}</td>
            </tr>
          </tbody>
        </table>

        <h2 style={{ fontSize: 13, fontWeight: 700, margin: '20px 0 6px' }}>Item entregue</h2>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Item</th>
              <th style={s.th}>Quantidade</th>
              {mostrarCA && <th style={s.th}>Nº CA</th>}
              {valoresComNome.map(v => <th key={v.campo!.nome} style={s.th}>{v.campo!.nome}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={s.td}>{registro.produto_nome}</td>
              <td style={s.td}>{registro.quantidade} {registro.unidade ?? ''}</td>
              {mostrarCA && <td style={s.td}>{ca ?? '—'}</td>}
              {valoresComNome.map(v => <td key={v.campo!.nome} style={s.td}>{v.valor}</td>)}
            </tr>
          </tbody>
        </table>

        {registro.observacoes && (
          <p style={{ fontSize: 11, color: '#374151', marginTop: 12 }}><strong>Observações:</strong> {registro.observacoes}</p>
        )}

        <p style={{ fontSize: 11, color: '#374151', marginTop: 24, lineHeight: 1.6 }}>
          Declaro ter recebido o(s) item(ns) acima descrito(s), em bom estado de conservação e funcionamento,
          comprometendo-me a utilizá-lo(s) corretamente e zelar pela sua guarda e conservação, respondendo por
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
