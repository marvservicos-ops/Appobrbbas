import { DocumentoSegurancaFormData } from './types'

function formatarData(data: string) {
  if (!data) return '—'
  return new Date(data + 'T12:00:00').toLocaleDateString('pt-BR')
}

const th: React.CSSProperties = { border: '1px solid #999', padding: '5px 7px', background: '#F1F1F1', fontWeight: 700, fontSize: 10, textAlign: 'left' }
const td: React.CSSProperties = { border: '1px solid #999', padding: '5px 7px', fontSize: 10.5, verticalAlign: 'top' }
const label: React.CSSProperties = { border: '1px solid #999', padding: '5px 7px', fontSize: 10.5, fontWeight: 700, background: '#FAFAFA', whiteSpace: 'nowrap' }

const AGENTES_FATALIDADE: { chave: keyof DocumentoSegurancaFormData['agentesFatalidade']; label: string }[] = [
  { chave: 'trabalhoAltura', label: 'Trabalho em Altura' },
  { chave: 'andaimes', label: 'Andaimes' },
  { chave: 'pta', label: 'PTA' },
  { chave: 'escadas', label: 'Escadas' },
  { chave: 'isolacaoArea', label: 'Isolação de Área' },
  { chave: 'bloqueioEletricoLoto', label: 'Bloqueio Elétrico (LOTO)' },
]

function Checkbox({ checked, label: text }: { checked: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, padding: '3px 0' }}>
      <span style={{
        width: 12, height: 12, border: '1.5px solid #333', borderRadius: 2, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        background: checked ? '#0F172A' : 'transparent',
      }}>
        {checked && <span style={{ color: 'white', fontSize: 9, lineHeight: 1 }}>✓</span>}
      </span>
      {text}
    </div>
  )
}

export default function PtDocument({ data }: { data: DocumentoSegurancaFormData }) {
  const episSelecionados = [...data.episObrigatorios, ...(data.episOutros ? [data.episOutros] : [])]

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', color: '#111', fontSize: 11 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 4 }}>
        <tbody>
          <tr>
            <td style={{ ...th, textAlign: 'center', fontSize: 13 }} colSpan={3}>
              Permissão de Trabalho Seguro
              <div style={{ fontSize: 9.5, fontWeight: 400, marginTop: 2 }}>MARV Manutenção e Serviços Ltda EPP</div>
            </td>
            <td style={{ ...label, width: '20%', textAlign: 'center' }}>Nº PTS<br /><span style={{ fontSize: 12 }}>{data.numeroDocumento || '—'}</span></td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={label}>Cliente</td>
            <td style={td} colSpan={3}>{data.cliente || '—'}</td>
          </tr>
          <tr>
            <td style={label}>Empresa</td>
            <td style={td} colSpan={3}>{data.empresa || '—'}</td>
          </tr>
          <tr>
            <td style={label}>Local da Atividade</td>
            <td style={td} colSpan={3}>{data.local || '—'}</td>
          </tr>
          <tr>
            <td style={label}>Período</td>
            <td style={td}>{formatarData(data.dataInicio)} a {formatarData(data.dataTermino)}</td>
            <td style={label}>Horário</td>
            <td style={td}>{data.horario || '—'}</td>
          </tr>
          <tr>
            <td style={label}>Responsável</td>
            <td style={td}>{data.responsavelEmpresa || '—'}</td>
            <td style={label}>Resp. Terceirizado</td>
            <td style={td}>{data.responsavelTerceirizado || '—'}</td>
          </tr>
          <tr>
            <td style={label}>Descrição Atividade</td>
            <td style={{ ...td, whiteSpace: 'pre-wrap' }} colSpan={3}>{data.descricaoAtividades || '—'}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }} className="print:break-inside-avoid">
        <tbody>
          <tr><td style={{ ...th, textAlign: 'left' }} colSpan={3}>Agentes da Fatalidade</td></tr>
          <tr>
            {[0, 1, 2].map(col => (
              <td key={col} style={{ ...td, width: '33.3%' }}>
                {AGENTES_FATALIDADE.slice(col * 2, col * 2 + 2).map(a => (
                  <Checkbox key={a.chave} checked={data.agentesFatalidade[a.chave]} label={a.label} />
                ))}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }} className="print:break-inside-avoid">
        <tbody>
          <tr><td style={{ ...th, textAlign: 'left' }}>EPIs Obrigatórios</td></tr>
          <tr>
            <td style={td}>
              {episSelecionados.length === 0
                ? <span style={{ color: '#888' }}>Nenhum EPI selecionado.</span>
                : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 12px' }}>
                    {episSelecionados.map(e => <Checkbox key={e} checked label={e} />)}
                  </div>
                )}
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }} className="print:break-inside-avoid">
        <tbody>
          <tr>
            <th style={{ ...th, width: '40%' }}>Nome</th>
            <th style={{ ...th, width: '25%' }}>Cargo</th>
            <th style={th}>Assinatura</th>
          </tr>
          {[1, 2, 3].map(i => (
            <tr key={i}>
              <td style={{ ...td, height: 22 }}>&nbsp;</td>
              <td style={{ ...td, height: 22 }}>&nbsp;</td>
              <td style={{ ...td, height: 22 }}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse' }} className="print:break-inside-avoid">
        <tbody>
          <tr><td style={{ ...th, textAlign: 'left' }} colSpan={3}>Assinaturas</td></tr>
          <tr>
            <th style={{ ...th, width: '33.3%', textAlign: 'center' }}>Gestor / Cliente</th>
            <th style={{ ...th, width: '33.3%', textAlign: 'center' }}>Responsável pela Execução</th>
            <th style={{ ...th, textAlign: 'center' }}>Solicitante da PT</th>
          </tr>
          <tr>
            <td style={{ ...td, height: 50 }}>&nbsp;</td>
            <td style={{ ...td, height: 50 }}>&nbsp;</td>
            <td style={{ ...td, height: 50 }}>&nbsp;</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
