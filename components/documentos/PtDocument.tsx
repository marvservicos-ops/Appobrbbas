import { Mountain, Zap, FlaskConical, Flame, Weight, Truck, Pickaxe, TriangleAlert, HardHat } from 'lucide-react'
import {
  DocumentoSegurancaFormData, AGENTES_FATALIDADE_GRUPOS, GrupoAgenteFatalidade, EMPRESAS_EMISSORAS,
  RISCOS_ASSOCIADOS_COL1, RISCOS_ASSOCIADOS_COL2, PRECAUCOES_COL1, PRECAUCOES_COL2,
  EPI_COL1, EPI_COL2, EPI_COL3,
} from './types'

function formatarData(data: string) {
  if (!data) return '____/____/______'
  return new Date(data + 'T12:00:00').toLocaleDateString('pt-BR')
}

function adicionarDias(data: Date, dias: number): Date {
  const d = new Date(data)
  d.setDate(d.getDate() + dias)
  return d
}

function formatarDataObj(d: Date): string {
  return d.toLocaleDateString('pt-BR')
}

// Distribui o período total (dataInicio a dataTermino) em 5 blocos de 7 dias:
// Inicial + 4 Prorrogações. O último bloco é truncado na data término.
function calcularPeriodosAssinatura(dataInicioStr: string, dataTerminoStr: string): { inicio: Date; fim: Date }[] | null {
  if (!dataInicioStr || !dataTerminoStr) return null
  const inicio = new Date(dataInicioStr + 'T12:00:00')
  const termino = new Date(dataTerminoStr + 'T12:00:00')
  if (termino < inicio) return null

  const periodos: { inicio: Date; fim: Date }[] = []
  let cursor = inicio
  for (let i = 0; i < 5; i++) {
    const inicioBloco = cursor > termino ? termino : cursor
    const fimCalculado = adicionarDias(inicioBloco, 6)
    const fimBloco = fimCalculado > termino ? termino : fimCalculado
    periodos.push({ inicio: inicioBloco, fim: fimBloco })
    cursor = adicionarDias(fimBloco, 1)
  }
  return periodos
}

const th: React.CSSProperties = { border: '1px solid #999', padding: '4px 6px', background: '#F1F1F1', fontWeight: 700, fontSize: 9, textAlign: 'left' }
const td: React.CSSProperties = { border: '1px solid #999', padding: '4px 6px', fontSize: 9, verticalAlign: 'top' }
const label: React.CSSProperties = { border: '1px solid #999', padding: '4px 6px', fontSize: 9, fontWeight: 700, background: '#FAFAFA', whiteSpace: 'nowrap' }

const ICONES: Record<GrupoAgenteFatalidade['icone'], typeof Mountain> = {
  altura: Mountain,
  eletricidade: Zap,
  quimicos: FlaskConical,
  quente: Flame,
  carga: Weight,
  moveis: Truck,
  escavacao: Pickaxe,
  confinado: TriangleAlert,
  outros: HardHat,
}

function ItemChecklist({ texto, marcado }: { texto: string; marcado: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4, fontSize: 8, lineHeight: 1.3, padding: '1px 0' }}>
      <span>{texto}</span>
      <span style={{
        width: 8, height: 8, border: '1px solid #333', flexShrink: 0, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', background: marcado ? '#0F172A' : 'white',
      }}>
        {marcado && <span style={{ color: 'white', fontSize: 6.5, lineHeight: 1 }}>✓</span>}
      </span>
    </div>
  )
}

function AssinaturaCelula({ rotulo }: { rotulo: string }) {
  return (
    <td style={{ ...td, height: 34, verticalAlign: 'top', width: '33.33%' }}>
      <div style={{ fontSize: 8, fontWeight: 700 }}>{rotulo}</div>
    </td>
  )
}

function BlocoAssinaturas({ titulo }: { titulo?: string }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6 }} className="print:break-inside-avoid">
      <tbody>
        {titulo && <tr><td style={{ ...th, textAlign: 'center' }} colSpan={3}>{titulo}</td></tr>}
        <tr>
          <AssinaturaCelula rotulo="Gestor Globo" />
          <AssinaturaCelula rotulo="Responsável pela execução" />
          <AssinaturaCelula rotulo="Solicitante da PT" />
        </tr>
        <tr>
          <AssinaturaCelula rotulo="Emissor PT" />
          <AssinaturaCelula rotulo="Validação SST TVG Início" />
          <AssinaturaCelula rotulo="Validação SST TVG Término" />
        </tr>
      </tbody>
    </table>
  )
}

export default function PtDocument({ data }: { data: DocumentoSegurancaFormData }) {
  const periodos = calcularPeriodosAssinatura(data.dataInicio, data.dataTermino)

  const empresaInfo = EMPRESAS_EMISSORAS[data.empresaEmissora]

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', color: '#111', fontSize: 9 }}>
      {/* ── Cabeçalho ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #999', padding: '6px 10px', width: '22%', textAlign: 'center', verticalAlign: 'middle' }}>
              <img src={empresaInfo.logo} alt={empresaInfo.nomeExibicao} style={{ maxHeight: 34, maxWidth: '100%', objectFit: 'contain' }} />
            </td>
            <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>PERMISSÃO DE TRABALHO SEGURO</div>
              <div style={{ fontSize: 10, fontWeight: 600 }}>{empresaInfo.razaoSocial.toUpperCase()}</div>
            </td>
          </tr>
        </tbody>
      </table>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
        <tbody>
          <tr>
            <td style={label}>Cliente</td>
            <td style={td}>{data.cliente || '—'}</td>
            <td style={{ ...label, width: '14%' }}>N° PTS</td>
            <td style={{ ...td, width: '10%' }}>{data.numeroDocumento || '—'}</td>
          </tr>
          <tr>
            <td style={label}>Empresa executante</td>
            <td style={td} colSpan={3}>{data.empresa || '—'}</td>
          </tr>
          <tr>
            <td style={label}>Local da atividade</td>
            <td style={td} colSpan={3}>{data.local || '—'}</td>
          </tr>
          <tr>
            <td style={label}>Período execução</td>
            <td style={td}>{formatarData(data.dataInicio)} a {formatarData(data.dataTermino)}</td>
            <td style={label}>Horário</td>
            <td style={td}>{data.horario || '—'}</td>
          </tr>
          <tr>
            <td style={label}>Descrição atividade</td>
            <td style={{ ...td, whiteSpace: 'pre-wrap' }} colSpan={3}>{data.descricaoAtividades || '—'}</td>
          </tr>
        </tbody>
      </table>

      {/* ── Agentes da fatalidade ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
        <tbody>
          <tr><td style={{ ...th, textAlign: 'center' }} colSpan={3}>Agentes da fatalidade</td></tr>
          {[0, 1, 2].map(linha => (
            <tr key={linha} className="print:break-inside-avoid">
              {AGENTES_FATALIDADE_GRUPOS.slice(linha * 3, linha * 3 + 3).map((grupo, colIdx) => {
                const grupoIdx = linha * 3 + colIdx
                const Icone = ICONES[grupo.icone]
                return (
                  <td key={grupo.titulo} style={{ ...td, width: '33.33%', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 700, fontSize: 8.5, textAlign: 'center', marginBottom: 3 }}>{grupo.titulo}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <Icone size={28} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 2, color: '#374151' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {grupo.itens.map((item, itemIdx) => (
                          <ItemChecklist key={itemIdx} texto={item} marcado={!!data.agentesFatalidade[grupoIdx]?.[itemIdx]} />
                        ))}
                      </div>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Riscos Associados ao Trabalho ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
        <tbody>
          <tr><td style={{ ...th, textAlign: 'center' }} colSpan={2}>Riscos Associados ao Trabalho</td></tr>
          <tr>
            <td style={{ ...td, width: '50%', verticalAlign: 'top' }}>
              {RISCOS_ASSOCIADOS_COL1.map((item, i) => <ItemChecklist key={i} texto={item} marcado={!!data.riscosAssociadosCol1[i]} />)}
            </td>
            <td style={{ ...td, width: '50%', verticalAlign: 'top' }}>
              {RISCOS_ASSOCIADOS_COL2.map((item, i) => <ItemChecklist key={i} texto={item} marcado={!!data.riscosAssociadosCol2[i]} />)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Precauções Obrigatórias ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
        <tbody>
          <tr><td style={{ ...th, textAlign: 'center' }} colSpan={2}>Precauções Obrigatórias</td></tr>
          <tr>
            <td style={{ ...td, width: '50%', verticalAlign: 'top' }}>
              {PRECAUCOES_COL1.map((item, i) => <ItemChecklist key={i} texto={item} marcado={!!data.precaucoesCol1[i]} />)}
              <div style={{ fontSize: 8, marginTop: 4 }}><strong>Outros (Descrever):</strong> {data.precaucoesOutros || '—'}</div>
            </td>
            <td style={{ ...td, width: '50%', verticalAlign: 'top' }}>
              {PRECAUCOES_COL2.map((item, i) => <ItemChecklist key={i} texto={item} marcado={!!data.precaucoesCol2[i]} />)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── EPI (página 2) ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }} className="print:break-before-page">
        <tbody>
          <tr><td style={{ ...th, textAlign: 'center' }} colSpan={3}>EPI</td></tr>
          <tr>
            <td style={{ ...td, width: '33.33%', verticalAlign: 'top' }}>
              {EPI_COL1.map((item, i) => <ItemChecklist key={i} texto={item} marcado={!!data.epiCol1[i]} />)}
            </td>
            <td style={{ ...td, width: '33.33%', verticalAlign: 'top' }}>
              {EPI_COL2.map((item, i) => <ItemChecklist key={i} texto={item} marcado={!!data.epiCol2[i]} />)}
            </td>
            <td style={{ ...td, width: '33.33%', verticalAlign: 'top' }}>
              {EPI_COL3.map((item, i) => <ItemChecklist key={i} texto={item} marcado={!!data.epiCol3[i]} />)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Equipe execução ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }} className="print:break-inside-avoid">
        <tbody>
          <tr><td style={{ ...th, textAlign: 'center' }} colSpan={5}>Equipe execução</td></tr>
          <tr>
            <th style={{ ...th, width: '32%' }} rowSpan={2}>Nome</th>
            <th style={{ ...th, width: '22%' }} rowSpan={2}>Cargo</th>
            <th style={{ ...th, width: '26%' }} rowSpan={2}>Assinatura</th>
            <th style={{ ...th, textAlign: 'center' }} colSpan={2}>Aptidão</th>
          </tr>
          <tr>
            <th style={{ ...th, width: '10%', textAlign: 'center' }}>NR 35</th>
            <th style={{ ...th, width: '10%', textAlign: 'center' }}>NR 12</th>
          </tr>
          {data.equipeExecucao.length === 0 ? (
            <tr><td style={td} colSpan={5}>Nenhum membro cadastrado.</td></tr>
          ) : data.equipeExecucao.map(m => (
            <tr key={m.id}>
              <td style={td}>{m.nome || '—'}</td>
              <td style={td}>{m.cargo || '—'}</td>
              <td style={{ ...td, height: 20 }}>&nbsp;</td>
              <td style={{ ...td, textAlign: 'center' }}>{m.nr35 ? '✓' : ''}</td>
              <td style={{ ...td, textAlign: 'center' }}>{m.nr12 ? '✓' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Inspeção / Responsáveis ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }} className="print:break-inside-avoid">
        <tbody>
          <tr><td style={{ ...th, textAlign: 'center' }} colSpan={2}>Inspeção / Responsáveis</td></tr>
          <tr>
            <td style={label}>Gestor TVG</td><td style={td}>{data.gestorTvg || '—'}</td>
          </tr>
          <tr>
            <td style={label}>Responsável execução</td><td style={td}>{data.responsavelEmpresa || '—'}</td>
          </tr>
          <tr>
            <td style={label}>Solicitante PTS</td><td style={td}>{data.solicitantePts || '—'}</td>
          </tr>
          <tr>
            <td style={label}>Elaborador PTS</td><td style={td}>{data.elaboradorPts || '—'}</td>
          </tr>
          <tr>
            <td style={label}>Data Inspeção</td><td style={td}>{formatarData(data.dataInspecao)}</td>
          </tr>
          <tr>
            <td style={label}>Data elaboração PTS</td><td style={td}>{formatarData(data.dataElaboracaoPts)}</td>
          </tr>
        </tbody>
      </table>

      {/* ── Assinaturas ── */}
      <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Assinaturas</div>
      <BlocoAssinaturas
        titulo={periodos ? `Inicial: ${formatarDataObj(periodos[0].inicio)} A ${formatarDataObj(periodos[0].fim)}` : 'Inicial: ____/____/______ A ____/____/______'}
      />
      {['1°', '2°', '3°', '4°'].map((n, idx) => (
        <BlocoAssinaturas
          key={n}
          titulo={periodos ? `${n} Prorrogação: ${formatarDataObj(periodos[idx + 1].inicio)} a ${formatarDataObj(periodos[idx + 1].fim)}` : `${n} Prorrogação: ____/____/______ a ____/____/______`}
        />
      ))}
    </div>
  )
}
