import { DocumentoSegurancaFormData, EMPRESAS_EMISSORAS } from './types'

const classificacaoCor: Record<string, { bg: string; text: string }> = {
  Baixo: { bg: '#D1FAE5', text: '#065F46' },
  Médio: { bg: '#FEF3C7', text: '#92400E' },
  Alto: { bg: '#FEE2E2', text: '#991B1B' },
}

function formatarData(data: string) {
  if (!data) return '—'
  return new Date(data + 'T12:00:00').toLocaleDateString('pt-BR')
}

const th: React.CSSProperties = { border: '1px solid #999', padding: '5px 7px', background: '#F1F1F1', fontWeight: 700, fontSize: 10, textAlign: 'left' }
const td: React.CSSProperties = { border: '1px solid #999', padding: '5px 7px', fontSize: 10.5, verticalAlign: 'top' }
const label: React.CSSProperties = { border: '1px solid #999', padding: '5px 7px', fontSize: 10.5, fontWeight: 700, background: '#FAFAFA', whiteSpace: 'nowrap' }

export default function AprDocument({ data }: { data: DocumentoSegurancaFormData }) {
  const empresaInfo = EMPRESAS_EMISSORAS[data.empresaEmissora]

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', color: '#111', fontSize: 11 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #999', padding: '6px 10px', width: '22%', textAlign: 'center', verticalAlign: 'middle' }}>
              <img src={empresaInfo.logo} alt={empresaInfo.nomeExibicao} style={{ maxHeight: 34, maxWidth: '100%', objectFit: 'contain' }} />
            </td>
            <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>Análise Preliminar de Riscos — APR</div>
              <div style={{ fontSize: 10, fontWeight: 600 }}>{empresaInfo.razaoSocial.toUpperCase()}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={label}>Empresa</td>
            <td style={td} colSpan={3}>{data.empresa || '—'}</td>
          </tr>
          <tr>
            <td style={label}>Cliente</td>
            <td style={td} colSpan={3}>{data.cliente || '—'}</td>
          </tr>
          <tr>
            <td style={label}>Início</td>
            <td style={td}>{formatarData(data.dataInicio)}</td>
            <td style={label}>Término</td>
            <td style={td}>{formatarData(data.dataTermino)}</td>
          </tr>
          <tr>
            <td style={label}>Cidade</td>
            <td style={td}>{data.cidade || '—'}</td>
            <td style={label}>Estado</td>
            <td style={td}>{data.estado || '—'}</td>
          </tr>
          <tr>
            <td style={label}>Local</td>
            <td style={td} colSpan={3}>{data.local || '—'}</td>
          </tr>
          <tr>
            <td style={label}>Responsável</td>
            <td style={td}>{data.responsavelEmpresa || '—'}</td>
            <td style={label}>Resp. Terceirizado</td>
            <td style={td}>{data.responsavelTerceirizado || '—'}</td>
          </tr>
          <tr>
            <td style={label}>Descrição das Atividades</td>
            <td style={{ ...td, whiteSpace: 'pre-wrap' }} colSpan={3}>{data.descricaoAtividades || '—'}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }} className="print:break-inside-avoid">
        <thead>
          <tr>
            <th style={{ ...th, width: '18%' }}>Etapa</th>
            <th style={{ ...th, width: '20%' }}>Riscos</th>
            <th style={{ ...th, width: '22%' }}>Causas / Motivos</th>
            <th style={{ ...th, width: '13%' }}>Classificação</th>
            <th style={th}>Recomendações</th>
          </tr>
        </thead>
        <tbody>
          {data.riscos.length === 0 ? (
            <tr><td style={td} colSpan={5}>Nenhum risco cadastrado.</td></tr>
          ) : data.riscos.map(r => {
            const cor = r.classificacaoRisco ? classificacaoCor[r.classificacaoRisco] : null
            return (
              <tr key={r.id} className="print:break-inside-avoid">
                <td style={{ ...td, whiteSpace: 'pre-wrap' }}>{r.etapa || '—'}</td>
                <td style={{ ...td, whiteSpace: 'pre-wrap' }}>{r.riscos || '—'}</td>
                <td style={{ ...td, whiteSpace: 'pre-wrap' }}>{r.causas || '—'}</td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {r.classificacaoRisco
                    ? <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 9.5, fontWeight: 700, background: cor?.bg, color: cor?.text }}>{r.classificacaoRisco}</span>
                    : '—'}
                </td>
                <td style={{ ...td, whiteSpace: 'pre-wrap' }}>{r.recomendacoes || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr><td style={{ ...th, textAlign: 'left' }} colSpan={2}>Classificação de Risco</td></tr>
          <tr>
            <td style={{ ...td, width: '15%', fontWeight: 700, background: classificacaoCor.Baixo.bg, color: classificacaoCor.Baixo.text }}>Baixo</td>
            <td style={td}>Risco administrável com a implementação das recomendações para prevenção de acidentes/doenças, com baixa complexidade de implantação e sem exigência de recursos adicionais.</td>
          </tr>
          <tr>
            <td style={{ ...td, fontWeight: 700, background: classificacaoCor.Médio.bg, color: classificacaoCor.Médio.text }}>Médio</td>
            <td style={td}>Risco administrável com a implementação das recomendações para prevenção de acidentes/doenças, controle e medidas de emergência, com maior complexidade de implantação e exigência de recursos adicionais.</td>
          </tr>
          <tr>
            <td style={{ ...td, fontWeight: 700, background: classificacaoCor.Alto.bg, color: classificacaoCor.Alto.text }}>Alto</td>
            <td style={td}>Não foram identificadas recomendações administrativas e de engenharia que garantam a prevenção de acidentes/doenças. A área demandante deverá reavaliar a locação e/ou dinâmica.</td>
          </tr>
        </tbody>
      </table>

      {data.observacoes && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
          <tbody>
            <tr><td style={{ ...th, textAlign: 'left' }}>Observações</td></tr>
            <tr><td style={{ ...td, whiteSpace: 'pre-wrap' }}>{data.observacoes}</td></tr>
          </tbody>
        </table>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }} className="print:break-inside-avoid">
        <tbody>
          <tr><td style={{ ...th, textAlign: 'left' }} colSpan={3}>Assinaturas dos Participantes</td></tr>
          <tr>
            <th style={{ ...th, width: '35%' }}>Nome</th>
            <th style={{ ...th, width: '25%' }}>Cargo</th>
            <th style={th}>Assinatura</th>
          </tr>
          {data.participantesApr.length === 0 ? (
            <tr><td style={td} colSpan={3}>Nenhum participante cadastrado.</td></tr>
          ) : data.participantesApr.map(p => (
            <tr key={p.id}>
              <td style={td}>{p.nome || '—'}</td>
              <td style={td}>{p.cargo || '—'}</td>
              <td style={{ ...td, height: 26 }}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
