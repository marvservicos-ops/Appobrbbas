'use client'

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Plus, Pencil, FileText, ExternalLink, Send, Mail, X, Loader2, CheckCircle2, AlertTriangle, Clock, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DiarioObraRelatorio } from '@/lib/types'
import { mensagemErro } from '@/lib/erros'
import { formatarData, mesLocal } from '@/lib/datas'
import { ContratoRelatorioTipo, Periodicidade, PERIODICIDADES, devidoNoMes, nomeCompetencia, somarMeses } from '@/lib/manutencaoRelatorios'

const MESES_NA_GRADE = 6

type Celula = { relatorios: DiarioObraRelatorio[]; devido: boolean }

// ── Aba Relatórios ────────────────────────────────────
// Os relatórios são feitos no Diário de Obra (cada tipo é uma obra lá) e
// importados para o Drive; aqui só acompanhamos e enviamos ao cliente.
export default function AbaRelatorios({ contratoId, contratoNome, dataInicio }: { contratoId: string; contratoNome: string; dataInicio: string }) {
  const [tipos, setTipos] = useState<ContratoRelatorioTipo[]>([])
  const [relatorios, setRelatorios] = useState<DiarioObraRelatorio[]>([])
  const [loading, setLoading] = useState(true)
  const [erroCarga, setErroCarga] = useState('')
  const [semTabela, setSemTabela] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [editando, setEditando] = useState<ContratoRelatorioTipo | 'novo' | null>(null)
  const [mesAberto, setMesAberto] = useState(mesLocal())
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [enviando, setEnviando] = useState(false)

  const atual = mesLocal()
  const meses = useMemo(() => Array.from({ length: MESES_NA_GRADE }, (_, i) => somarMeses(atual, i - (MESES_NA_GRADE - 1))), [atual])

  async function load() {
    const sb = createClient()
    const { data: t, error: errT } = await sb.from('contrato_relatorio_tipos').select('*').eq('contrato_id', contratoId).order('ordem').order('created_at')
    if (errT) {
      // Tabela ainda não criada (migração manutencao_relatorios.sql não rodou)
      if (errT.code === '42P01' || errT.code === 'PGRST205' || /contrato_relatorio_tipos/.test(errT.message)) { setSemTabela(true); setLoading(false); return }
      setErroCarga(mensagemErro(errT, 'Erro ao carregar os relatórios')); setLoading(false); return
    }
    const lista = (t ?? []) as ContratoRelatorioTipo[]
    setTipos(lista)
    const projetos = Array.from(new Set(lista.map(x => x.diario_obra_id)))
    if (projetos.length === 0) { setRelatorios([]); setErroCarga(''); setLoading(false); return }
    const { data: r, error: errR } = await sb.from('diario_obra_relatorios').select('*')
      .in('diario_obra_id_externo', projetos)
      .gte('data', `${somarMeses(atual, -11)}-01`)
      .order('data', { ascending: false })
    if (errR) setErroCarga(mensagemErro(errR, 'Erro ao carregar os relatórios importados'))
    else { setRelatorios((r ?? []) as DiarioObraRelatorio[]); setErroCarga('') }
    setLoading(false)
  }

  useEffect(() => { load() }, [contratoId])

  async function sincronizar() {
    setSincronizando(true); setAviso(null)
    try {
      const res = await fetch('/api/manutencao/relatorios/sincronizar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contratoId }),
      })
      const data = await res.json()
      if (!res.ok) { setAviso({ tipo: 'erro', texto: data.error ?? 'Não foi possível sincronizar.' }); return }
      const partes = [`${data.importados} novo(s)`, `${data.atualizados} atualizado(s)`]
      if (data.removidos) partes.push(`${data.removidos} removido(s)`)
      let texto = `Sincronizado: ${partes.join(', ')}.`
      if (data.pendente) texto += ' Ainda há relatórios para importar — clique de novo.'
      if (data.erros?.length) texto += ` Avisos: ${data.erros.slice(0, 3).join(' · ')}`
      setAviso({ tipo: data.erros?.length ? 'erro' : 'ok', texto })
      await load()
    } catch {
      setAviso({ tipo: 'erro', texto: 'Sem conexão. Verifique a internet e tente de novo.' })
    } finally {
      setSincronizando(false)
    }
  }

  const tiposAtivos = tipos.filter(t => t.ativo)
  const grade = useMemo(() => {
    const m = new Map<string, Celula>()
    for (const t of tiposAtivos) for (const c of meses) {
      m.set(`${t.id}|${c}`, {
        relatorios: relatorios.filter(r => r.diario_obra_id_externo === t.diario_obra_id && (r.data ?? '').startsWith(c)),
        devido: devidoNoMes(t, c, dataInicio),
      })
    }
    return m
  }, [tiposAtivos, relatorios, meses, dataInicio])

  const nomeTipo = (r: DiarioObraRelatorio) => tipos.find(t => t.diario_obra_id === r.diario_obra_id_externo)?.nome ?? r.diario_obra_nome ?? 'Relatório'
  const doMes = relatorios
    .filter(r => (r.data ?? '').startsWith(mesAberto) && tiposAtivos.some(t => t.diario_obra_id === r.diario_obra_id_externo))
    .sort((a, b) => nomeTipo(a).localeCompare(nomeTipo(b)) || (a.data ?? '').localeCompare(b.data ?? ''))
  const naoEnviadosDoMes = doMes.filter(r => r.drive_file_id && !r.email_enviado_em)

  function abrirMes(c: string) { setMesAberto(c); setSelecionados(new Set()) }
  function alternar(id: string) {
    setSelecionados(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#4F7CFF] border-t-transparent rounded-full animate-spin" /></div>

  if (semTabela) return (
    <div className="card text-sm text-[#64748B]">
      Para usar os relatórios do contrato, rode a migração <code className="text-xs bg-[#F1F5F9] px-1 rounded">supabase/migrations/manutencao_relatorios.sql</code> no Supabase.
    </div>
  )

  return (
    <div className="space-y-4">
      {erroCarga && (
        <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <span>{erroCarga}</span>
          <button onClick={() => { setLoading(true); load() }} className="text-xs font-semibold underline shrink-0">Tentar de novo</button>
        </div>
      )}

      {/* Tipos de relatório do contrato */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="font-syne font-semibold text-[#0F172A]">Relatórios do contrato</h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">Cada relatório é uma obra no Diário de Obra. Os PDFs são importados de lá.</p>
          </div>
          <div className="flex gap-2">
            {tiposAtivos.length > 0 && (
              <button onClick={sincronizar} disabled={sincronizando}
                className="flex items-center gap-1.5 px-3 py-2 border border-[#E2E8F0] text-xs font-medium text-[#374151] rounded-xl hover:bg-[#F1F5F9] disabled:opacity-60">
                <RefreshCw size={13} className={sincronizando ? 'animate-spin' : ''} />
                {sincronizando ? 'Sincronizando…' : 'Sincronizar com o Diário'}
              </button>
            )}
            <button onClick={() => setEditando('novo')} className="flex items-center gap-1.5 px-3 py-2 bg-[#4F7CFF] text-white text-xs font-medium rounded-xl hover:bg-[#3D6AE8]">
              <Plus size={13} /> Relatório
            </button>
          </div>
        </div>

        {aviso && (
          <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2.5 mb-3 ${aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
            <span className="flex-1">{aviso.texto}</span>
            <button onClick={() => setAviso(null)} aria-label="Fechar aviso" title="Fechar aviso" className="p-1.5 -m-1"><X size={12} /></button>
          </div>
        )}

        {tipos.length === 0 ? (
          <p className="text-sm text-[#94A3B8] text-center py-6">
            Nenhum relatório cadastrado. Clique em <strong>+ Relatório</strong> e escolha a obra correspondente no Diário de Obra
            (ex.: &quot;Preventiva Unidades Internas&quot;, &quot;Chiller Hitachi&quot;).
          </p>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-[#94A3B8] pb-2 pr-3">Relatório</th>
                  {meses.map(c => (
                    <th key={c} className="pb-2 px-1">
                      <button onClick={() => abrirMes(c)}
                        className={`w-full text-xs font-semibold rounded-lg py-1 capitalize ${mesAberto === c ? 'bg-[#EEF2FF] text-[#4F7CFF]' : 'text-[#64748B] hover:bg-[#F1F5F9]'}`}>
                        {nomeCompetencia(c)}
                      </button>
                    </th>
                  ))}
                  <th className="pb-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {tipos.map(t => (
                  <tr key={t.id} className={t.ativo ? '' : 'opacity-50'}>
                    <td className="py-2 pr-3">
                      <p className="font-medium text-[#0F172A] leading-tight">{t.nome}</p>
                      <p className="text-[11px] text-[#94A3B8]">
                        {PERIODICIDADES.find(p => p.valor === t.periodicidade)?.label ?? t.periodicidade}{t.ativo ? '' : ' · inativo'}
                      </p>
                    </td>
                    {meses.map(c => {
                      const cel = t.ativo ? grade.get(`${t.id}|${c}`) : undefined
                      return (
                        <td key={c} className="py-2 px-1">
                          <button onClick={() => abrirMes(c)} className="w-full">
                            <CelulaStatus celula={cel} passado={c < atual} />
                          </button>
                        </td>
                      )
                    })}
                    <td className="py-2 text-right">
                      <button onClick={() => setEditando(t)} aria-label={`Editar ${t.nome}`} title="Editar"
                        className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9]">
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-[#64748B]">
              <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-[#059669]" /> Enviado ao cliente</span>
              <span className="flex items-center gap-1"><Mail size={12} className="text-[#D97706]" /> Feito, falta enviar</span>
              <span className="flex items-center gap-1"><AlertTriangle size={12} className="text-[#DC2626]" /> Não feito</span>
              <span className="flex items-center gap-1"><Clock size={12} className="text-[#94A3B8]" /> Aguardando (mês atual)</span>
            </div>
          </div>
        )}
      </div>

      {/* Relatórios do mês selecionado */}
      {tiposAtivos.length > 0 && (
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="font-syne font-semibold text-[#0F172A] capitalize">{nomeCompetencia(mesAberto, 'longo')}</h3>
            <div className="flex gap-2">
              {naoEnviadosDoMes.length > 0 && (
                <button onClick={() => setSelecionados(new Set(naoEnviadosDoMes.map(r => r.id)))}
                  className="px-3 py-2 border border-[#E2E8F0] text-xs font-medium text-[#374151] rounded-xl hover:bg-[#F1F5F9]">
                  Selecionar não enviados ({naoEnviadosDoMes.length})
                </button>
              )}
              <button onClick={() => setEnviando(true)} disabled={selecionados.size === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#4F7CFF] text-white text-xs font-medium rounded-xl hover:bg-[#3D6AE8] disabled:opacity-50">
                <Send size={13} /> Enviar{selecionados.size > 0 ? ` (${selecionados.size})` : ''}
              </button>
            </div>
          </div>

          {doMes.length === 0 ? (
            <p className="text-sm text-[#94A3B8] text-center py-6">Nenhum relatório importado neste mês. Se já foi feito no Diário de Obra, clique em &quot;Sincronizar com o Diário&quot;.</p>
          ) : (
            <ul className="divide-y divide-[#F1F5F9]">
              {doMes.map(r => (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <input type="checkbox" className="w-4 h-4 accent-[#4F7CFF] shrink-0" aria-label={`Selecionar ${nomeTipo(r)} de ${formatarData(r.data)}`}
                    disabled={!r.drive_file_id} checked={selecionados.has(r.id)} onChange={() => alternar(r.id)} />
                  <FileText size={16} className="text-[#94A3B8] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{nomeTipo(r)}</p>
                    <p className="text-xs text-[#94A3B8]">
                      {formatarData(r.data)}{r.numero ? ` · nº ${r.numero}` : ''}{r.status_descricao ? ` · ${r.status_descricao}` : ''}
                    </p>
                  </div>
                  {r.email_enviado_em ? (
                    <span className="text-[11px] text-[#059669] text-right shrink-0" title={(r.email_enviado_para ?? []).join(', ')}>
                      Enviado em {formatarData(r.email_enviado_em)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#D97706] shrink-0">Não enviado</span>
                  )}
                  {r.drive_file_url ? (
                    <a href={r.drive_file_url} target="_blank" rel="noopener noreferrer" aria-label="Abrir PDF" title="Abrir PDF"
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9] shrink-0">
                      <ExternalLink size={14} />
                    </a>
                  ) : <span className="text-[11px] text-[#94A3B8] shrink-0">sem PDF</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {editando && (
        <ModalTipoRelatorio contratoId={contratoId} tipo={editando === 'novo' ? null : editando} ordem={tipos.length}
          onClose={() => setEditando(null)} onSaved={() => { setEditando(null); load() }} />
      )}
      {enviando && (
        <ModalEnviarRelatorios contratoId={contratoId} contratoNome={contratoNome} competencia={mesAberto}
          relatorios={doMes.filter(r => selecionados.has(r.id))} nomeTipo={nomeTipo}
          onClose={() => setEnviando(false)}
          onSent={() => { setEnviando(false); setSelecionados(new Set()); setAviso({ tipo: 'ok', texto: 'Relatórios enviados ao cliente.' }); load() }} />
      )}
    </div>
  )
}

function CelulaStatus({ celula, passado }: { celula?: Celula; passado: boolean }) {
  if (!celula) return <span className="block h-8 rounded-lg bg-[#F8FAFC]" />
  const { relatorios, devido } = celula
  if (relatorios.length > 0) {
    const todosEnviados = relatorios.every(r => r.email_enviado_em)
    return (
      <span className={`flex items-center justify-center gap-1 h-8 rounded-lg text-[11px] font-semibold ${todosEnviados ? 'bg-emerald-50 text-[#059669]' : 'bg-amber-50 text-[#D97706]'}`}
        title={todosEnviados ? 'Enviado ao cliente' : 'Feito, falta enviar'}>
        {todosEnviados ? <CheckCircle2 size={13} /> : <Mail size={13} />}
        {relatorios.length > 1 ? relatorios.length : ''}
      </span>
    )
  }
  if (!devido) return <span className="flex items-center justify-center h-8 rounded-lg text-[11px] text-[#CBD5E1]" title="Não previsto neste mês">—</span>
  return passado
    ? <span className="flex items-center justify-center h-8 rounded-lg bg-red-50 text-[#DC2626]" title="Não feito"><AlertTriangle size={13} /></span>
    : <span className="flex items-center justify-center h-8 rounded-lg bg-[#F1F5F9] text-[#94A3B8]" title="Aguardando"><Clock size={13} /></span>
}

// ── Cadastro / edição de um tipo de relatório ─────────
function ModalTipoRelatorio({ contratoId, tipo, ordem, onClose, onSaved }: {
  contratoId: string; tipo: ContratoRelatorioTipo | null; ordem: number; onClose: () => void; onSaved: () => void
}) {
  const [nome, setNome] = useState(tipo?.nome ?? '')
  const [projeto, setProjeto] = useState(tipo?.diario_obra_id ?? '')
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>(tipo?.periodicidade ?? 'mensal')
  const [mesInicio, setMesInicio] = useState(tipo?.mes_inicio ?? '')
  const [ativo, setAtivo] = useState(tipo?.ativo ?? true)
  const [projetos, setProjetos] = useState<{ id: string; nome: string }[] | null>(null)
  const [erroProjetos, setErroProjetos] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch('/api/diario-obra/projetos').then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (ok) setProjetos(d.projetos ?? []); else setErroProjetos(true) })
      .catch(() => setErroProjetos(true))
  }, [])

  function escolherProjeto(id: string) {
    setProjeto(id)
    const p = projetos?.find(x => x.id === id)
    if (p && !nome.trim()) setNome(p.nome)
  }

  async function salvar() {
    if (!nome.trim()) { setErro('Informe o nome do relatório.'); return }
    if (!projeto.trim()) { setErro('Escolha a obra correspondente no Diário de Obra.'); return }
    setSalvando(true); setErro('')
    const payload = {
      nome: nome.trim(),
      diario_obra_id: projeto.trim(),
      periodicidade,
      mes_inicio: periodicidade === 'mensal' ? null : (mesInicio || null),
      ativo,
    }
    const sb = createClient()
    const { error } = tipo
      ? await sb.from('contrato_relatorio_tipos').update(payload).eq('id', tipo.id)
      : await sb.from('contrato_relatorio_tipos').insert({ ...payload, contrato_id: contratoId, ordem })
    setSalvando(false)
    if (error) { setErro(mensagemErro(error, 'Erro ao salvar')); return }
    onSaved()
  }

  async function excluir() {
    if (!tipo) return
    if (!confirm(`Remover "${tipo.nome}" deste contrato?\n\nOs PDFs já importados continuam no Drive; só deixam de aparecer aqui. Se for só pausar, desmarque "Ativo".`)) return
    setSalvando(true)
    const { error } = await createClient().from('contrato_relatorio_tipos').delete().eq('id', tipo.id)
    setSalvando(false)
    if (error) { setErro(mensagemErro(error, 'Erro ao remover')); return }
    onSaved()
  }

  const projetoNaLista = !projeto || projetos?.some(p => p.id === projeto)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90dvh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">{tipo ? 'Editar relatório' : 'Novo relatório do contrato'}</h2>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9]"><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Obra no Diário de Obra *</label>
            {projetos && !erroProjetos ? (
              <select className="field" value={projetoNaLista ? projeto : ''} onChange={e => escolherProjeto(e.target.value)}>
                <option value="">Selecione…</option>
                {projetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            ) : (
              <input className="field" placeholder={erroProjetos ? 'ID da obra no Diário de Obra' : 'Carregando obras do Diário…'}
                value={projeto} onChange={e => setProjeto(e.target.value)} disabled={!erroProjetos} />
            )}
            {erroProjetos && <p className="text-xs text-[#D97706] mt-1">Não consegui listar as obras do Diário de Obra. Cole o ID da obra (aparece na URL dela no Diário).</p>}
            {projetos && !projetoNaLista && <p className="text-xs text-[#D97706] mt-1">A obra vinculada ({projeto}) não aparece mais no Diário de Obra.</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome do relatório *</label>
            <input className="field" placeholder="Ex.: Preventiva Unidades Internas" value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Frequência</label>
              <select className="field" value={periodicidade} onChange={e => setPeriodicidade(e.target.value as Periodicidade)}>
                {PERIODICIDADES.map(p => <option key={p.valor} value={p.valor}>{p.label}</option>)}
              </select>
            </div>
            {periodicidade !== 'mensal' && (
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Primeiro mês</label>
                <input type="month" className="field" value={mesInicio} onChange={e => setMesInicio(e.target.value)} />
              </div>
            )}
          </div>
          {periodicidade !== 'mensal' && !mesInicio && <p className="text-xs text-[#94A3B8] -mt-2">Sem primeiro mês, conta a partir do início do contrato.</p>}
          <label className="flex items-center gap-2 text-sm text-[#374151]">
            <input type="checkbox" className="w-4 h-4 accent-[#4F7CFF]" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
            Ativo (aparece na grade e nas pendências)
          </label>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-[#F1F5F9]">
          {tipo && (
            <button onClick={excluir} disabled={salvando} aria-label="Remover relatório" title="Remover relatório"
              className="w-11 flex items-center justify-center border border-red-200 text-red-600 rounded-xl hover:bg-red-50">
              <Trash2 size={15} />
            </button>
          )}
          <button onClick={onClose} disabled={salvando} className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9]">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="flex-1 btn-primary py-2.5">{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Envio ao cliente ──────────────────────────────────
function ModalEnviarRelatorios({ contratoId, contratoNome, competencia, relatorios, nomeTipo, onClose, onSent }: {
  contratoId: string; contratoNome: string; competencia: string; relatorios: DiarioObraRelatorio[]
  nomeTipo: (r: DiarioObraRelatorio) => string; onClose: () => void; onSent: () => void
}) {
  const [temThread, setTemThread] = useState<boolean | null>(null)
  const [destinatarios, setDestinatarios] = useState('')
  const [cc, setCc] = useState('')
  const [assunto, setAssunto] = useState(`Relatórios de manutenção — ${contratoNome}`)
  const [mensagem, setMensagem] = useState('')
  const [assinaturaHtml, setAssinaturaHtml] = useState('')
  const [contatos, setContatos] = useState<{ nome: string; email: string; tipo: string | null }[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const sb = createClient()
    sb.from('relatorio_email_threads').select('id, ultimo_destinatarios, ultimo_cc').eq('contrato_id', contratoId).eq('tipo', 'manutencao').maybeSingle()
      .then(({ data }) => {
        setTemThread(Boolean(data))
        if (data?.ultimo_destinatarios?.length) setDestinatarios(data.ultimo_destinatarios.join(', '))
        if (data?.ultimo_cc?.length) setCc(data.ultimo_cc.join(', '))
      })
    sb.auth.getUser().then(({ data }) => setAssinaturaHtml(data.user?.user_metadata?.assinatura_email ?? ''))
    sb.from('clientes').select('nome, email, tipo').not('email', 'is', null).order('nome').then(({ data }) => {
      setContatos((data ?? []).filter(c => c.email).map(c => ({ nome: c.nome as string, email: c.email as string, tipo: (c.tipo as string) ?? null })))
    })
  }, [contratoId])

  useEffect(() => {
    const nomes = Array.from(new Set(relatorios.map(nomeTipo)))
    const lista = nomes.map(n => `• ${n}`).join('\n')
    setMensagem(`Bom dia,\n\nSeguem em anexo os relatórios de manutenção de ${nomeCompetencia(competencia, 'longo')}:\n\n${lista}\n\nQualquer dúvida, estamos à disposição.`)
  }, [relatorios, competencia, nomeTipo])

  function adicionarContato(campo: 'destinatarios' | 'cc', email: string) {
    const valor = campo === 'destinatarios' ? destinatarios : cc
    const setter = campo === 'destinatarios' ? setDestinatarios : setCc
    const atuais = valor.split(/[,;\n]/).map(e => e.trim()).filter(Boolean)
    if (!atuais.includes(email)) setter([...atuais, email].join(', '))
  }

  async function enviar() {
    const emails = destinatarios.split(/[,;\n]/).map(e => e.trim()).filter(Boolean)
    const emailsCc = cc.split(/[,;\n]/).map(e => e.trim()).filter(Boolean)
    const invalido = [...emails, ...emailsCc].find(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    if (emails.length === 0) { setErro('Informe pelo menos um e-mail de destino.'); return }
    if (invalido) { setErro(`E-mail inválido: ${invalido}`); return }
    if (!assunto.trim()) { setErro('Informe o assunto.'); return }
    setEnviando(true); setErro('')
    try {
      const res = await fetch('/api/manutencao/relatorios/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contratoId, relatorioIds: relatorios.map(r => r.id), destinatarios: emails, cc: emailsCc, assunto: assunto.trim(), mensagem, assinaturaHtml }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Falha ao enviar.'); return }
      if (data.avisos?.length) alert(data.avisos.join('\n'))
      onSent()
    } catch {
      setErro('Sem conexão. Verifique a internet e tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[560px] flex flex-col max-h-[90dvh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#EEF2FF] rounded-lg flex items-center justify-center"><Mail size={15} className="text-[#4F7CFF]" /></div>
            <div>
              <h2 className="font-syne font-semibold text-[#0F172A]">Enviar relatórios ao cliente</h2>
              <p className="text-xs text-[#94A3B8]">{relatorios.length} PDF{relatorios.length > 1 ? 's' : ''} em anexo</p>
            </div>
          </div>
          <button onClick={onClose} disabled={enviando} aria-label="Fechar" title="Fechar" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9]"><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          {contatos.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 max-h-28 overflow-y-auto">
              <span className="text-xs text-[#94A3B8]">Adicionar:</span>
              {contatos.map((c, i) => (
                <span key={`${c.email}-${i}`} className="inline-flex items-center rounded-full overflow-hidden bg-[#EEF2FF] text-[#4F7CFF]">
                  <button type="button" onClick={() => adicionarContato('destinatarios', c.email)} className="text-xs pl-2 pr-1.5 py-1 hover:brightness-95">
                    + {c.nome}{c.tipo ? ` (${c.tipo.toLowerCase()})` : ''}
                  </button>
                  <button type="button" onClick={() => adicionarContato('cc', c.email)} title="Adicionar em Cc" className="text-[10px] font-semibold px-1.5 py-1 border-l border-white/60 hover:brightness-95">Cc</button>
                </span>
              ))}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Destinatário(s) *</label>
            <input className="field" inputMode="email" placeholder="cliente@exemplo.com, outro@exemplo.com" value={destinatarios} onChange={e => setDestinatarios(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Cc</label>
            <input className="field" inputMode="email" placeholder="opcional, separado por vírgula" value={cc} onChange={e => setCc(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Assunto *</label>
            <input className="field" value={assunto} onChange={e => setAssunto(e.target.value)} />
            <p className="text-xs text-[#94A3B8] mt-1">Mantenha o mesmo assunto entre os meses para o Gmail agrupar tudo na mesma conversa.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Mensagem</label>
            <textarea className="field resize-none" rows={7} value={mensagem} onChange={e => setMensagem(e.target.value)} />
          </div>
          {temThread !== null && (
            <p className="text-xs text-[#94A3B8]">
              {temThread ? 'Vai responder ao último envio deste contrato, na mesma conversa.' : 'Primeiro envio deste contrato — os próximos vão responder este.'}
            </p>
          )}
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-[#F1F5F9]">
          <button type="button" onClick={onClose} disabled={enviando} className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9]">Cancelar</button>
          <button onClick={enviar} disabled={enviando} className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5">
            {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {enviando ? 'Baixando PDFs e enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
