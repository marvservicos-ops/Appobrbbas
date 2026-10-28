'use client'

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Plus, Pencil, Send, Mail, X, Loader2, CheckCircle2, AlertTriangle, Clock, Trash2 } from 'lucide-react'
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
  const [enviandoTipo, setEnviandoTipo] = useState<ContratoRelatorioTipo | null>(null)
  const [marcando, setMarcando] = useState(false)

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

  // Relatórios do mês aberto, separados por tipo (cada tipo é enviado num e-mail próprio)
  const doMesPorTipo = (t: ContratoRelatorioTipo) => relatorios
    .filter(r => r.diario_obra_id_externo === t.diario_obra_id && (r.data ?? '').startsWith(mesAberto))
    .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? '') || (b.numero ?? 0) - (a.numero ?? 0))

  // Para relatórios que já foram enviados por fora do app (antes desta aba existir)
  async function marcarComoEnviados(ids: string[]) {
    if (!confirm(`Marcar ${ids.length} relatório(s) como já enviado(s) ao cliente?\n\nNenhum e-mail será enviado — use para o que já foi mandado por fora do app.`)) return
    setMarcando(true)
    const { error } = await createClient().from('diario_obra_relatorios')
      .update({ email_enviado_em: new Date().toISOString(), email_enviado_por: 'Marcado manualmente' })
      .in('id', ids)
    setMarcando(false)
    if (error) { setAviso({ tipo: 'erro', texto: mensagemErro(error, 'Erro ao marcar como enviado') }); return }
    setSelecionados(prev => new Set(Array.from(prev).filter(id => !ids.includes(id))))
    load()
  }

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
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className="text-left text-sm font-semibold text-[#64748B] pb-3 pr-3">Relatório</th>
                  {meses.map(c => (
                    <th key={c} className="pb-3 px-1">
                      <button onClick={() => abrirMes(c)}
                        className={`w-full text-sm font-semibold rounded-lg py-1.5 capitalize ${mesAberto === c ? 'bg-[#EEF2FF] text-[#4F7CFF]' : 'text-[#64748B] hover:bg-[#F1F5F9]'}`}>
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
                    <td className="py-3 pr-3">
                      <p className="text-[15px] font-semibold text-[#0F172A] leading-tight">{t.nome}</p>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        {PERIODICIDADES.find(p => p.valor === t.periodicidade)?.label ?? t.periodicidade}{t.ativo ? '' : ' · inativo'}
                      </p>
                    </td>
                    {meses.map(c => {
                      const cel = t.ativo ? grade.get(`${t.id}|${c}`) : undefined
                      return (
                        <td key={c} className="py-3 px-1">
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
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 text-sm text-[#64748B]">
              <span className="flex items-center gap-1"><CheckCircle2 size={14} className="text-[#059669]" /> Enviado ao cliente</span>
              <span className="flex items-center gap-1"><Mail size={14} className="text-[#D97706]" /> Feito, falta enviar</span>
              <span className="flex items-center gap-1"><AlertTriangle size={14} className="text-[#DC2626]" /> Não feito</span>
              <span className="flex items-center gap-1"><Clock size={14} className="text-[#94A3B8]" /> Aguardando (mês atual)</span>
            </div>
          </div>
        )}
      </div>

      {/* Relatórios do mês selecionado, um bloco por tipo */}
      {tiposAtivos.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-syne font-semibold text-lg text-[#0F172A] capitalize px-1">{nomeCompetencia(mesAberto, 'longo')}</h3>
          {tiposAtivos.map(t => {
            const lista = doMesPorTipo(t)
            const selecionaveis = lista.filter(r => r.drive_file_id)
            const naoEnviados = selecionaveis.filter(r => !r.email_enviado_em)
            const sel = lista.filter(r => selecionados.has(r.id)).map(r => r.id)
            return (
              <div key={t.id} className="card p-0 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[#E2E8F0]">
                  <div>
                    <p className="font-semibold text-[#0F172A]">{t.nome}</p>
                    <p className="text-xs text-[#94A3B8]">
                      {lista.length === 0 ? 'Nenhum relatório neste mês' : `${lista.length} relatório${lista.length > 1 ? 's' : ''}${naoEnviados.length ? ` · ${naoEnviados.length} não enviado${naoEnviados.length > 1 ? 's' : ''}` : ' · todos enviados'}`}
                    </p>
                  </div>
                  {lista.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {naoEnviados.length > 0 && (
                        <button onClick={() => setSelecionados(prev => new Set([...Array.from(prev).filter(id => !lista.some(r => r.id === id)), ...naoEnviados.map(r => r.id)]))}
                          className="text-sm px-3 py-2 border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] text-[#374151]">
                          Selecionar não enviados ({naoEnviados.length})
                        </button>
                      )}
                      <button onClick={() => marcarComoEnviados(sel)} disabled={sel.length === 0 || marcando}
                        title="Para relatórios já enviados por fora do app"
                        className="text-sm px-3 py-2 border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] text-[#374151] disabled:opacity-50">
                        {marcando ? 'Marcando…' : 'Marcar como enviado'}
                      </button>
                      <button onClick={() => setEnviandoTipo(t)} disabled={sel.length === 0}
                        className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
                        <Mail size={14} /> Enviar por e-mail{sel.length ? ` (${sel.length})` : ''}
                      </button>
                    </div>
                  )}
                </div>
                {lista.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px]">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                          <th className="px-4 py-3 w-8">
                            <input type="checkbox" className="rounded" aria-label={`Selecionar todos de ${t.nome}`}
                              checked={selecionaveis.length > 0 && selecionaveis.every(r => selecionados.has(r.id))}
                              onChange={e => setSelecionados(prev => {
                                const n = new Set(prev)
                                for (const r of selecionaveis) { if (e.target.checked) n.add(r.id); else n.delete(r.id) }
                                return n
                              })} />
                          </th>
                          <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Nº</th>
                          <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Data</th>
                          <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Status</th>
                          <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">E-mail</th>
                          <th className="px-4 py-3 w-36" />
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map(r => (
                          <tr key={r.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                            <td className="px-4 py-3">
                              {r.drive_file_id && (
                                <input type="checkbox" className="rounded" aria-label={`Selecionar nº ${r.numero ?? ''}`}
                                  checked={selecionados.has(r.id)} onChange={() => alternar(r.id)} />
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-[#0F172A]">#{r.numero ?? '—'}</td>
                            <td className="px-4 py-3 text-sm text-[#374151]">{formatarData(r.data) || '—'}</td>
                            <td className="px-4 py-3"><StatusRelatorio status={r.status_descricao} /></td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {r.email_enviado_em ? (
                                <span title={[r.email_enviado_para?.length ? `Para: ${r.email_enviado_para.join(', ')}` : '', r.email_enviado_por ? `Por: ${r.email_enviado_por}` : ''].filter(Boolean).join('\n')}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                                  <CheckCircle2 size={12} /> Enviado {new Date(r.email_enviado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded">
                                  <Mail size={12} /> Não enviado
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              {r.drive_file_url ? (
                                <a href={r.drive_file_url} target="_blank" rel="noopener noreferrer"
                                  className="inline-block text-xs font-medium text-white bg-[#4F7CFF] hover:bg-[#3D6AE8] px-3 py-1.5 rounded transition-colors">
                                  Abrir no Drive
                                </a>
                              ) : <span className="text-xs text-[#94A3B8]">sem PDF</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editando && (
        <ModalTipoRelatorio contratoId={contratoId} tipo={editando === 'novo' ? null : editando} ordem={tipos.length}
          onClose={() => setEditando(null)} onSaved={() => { setEditando(null); load() }} />
      )}
      {enviandoTipo && (
        <ModalEnviarRelatorios contratoId={contratoId} contratoNome={contratoNome} competencia={mesAberto} tipo={enviandoTipo}
          relatorios={doMesPorTipo(enviandoTipo).filter(r => selecionados.has(r.id))}
          onClose={() => setEnviandoTipo(null)}
          onSent={ids => {
            setEnviandoTipo(null)
            setSelecionados(prev => new Set(Array.from(prev).filter(id => !ids.includes(id))))
            setAviso({ tipo: 'ok', texto: 'Relatórios enviados ao cliente.' }); load()
          }} />
      )}
    </div>
  )
}

function StatusRelatorio({ status }: { status?: string | null }) {
  if (!status) return <span className="text-sm text-[#94A3B8]">—</span>
  const s = status.toLowerCase()
  const cor = s.includes('aprov') ? 'bg-emerald-50 text-emerald-700'
    : s.includes('revis') ? 'bg-amber-50 text-amber-700'
    : s.includes('preench') ? 'bg-[#F1F5F9] text-[#64748B]'
    : 'bg-[#EEF2FF] text-[#4F7CFF]'
  return <span className={`inline-block text-xs font-medium px-2 py-1 rounded ${cor}`}>{status}</span>
}

function CelulaStatus({ celula, passado }: { celula?: Celula; passado: boolean }) {
  if (!celula) return <span className="block h-10 rounded-lg bg-[#F8FAFC]" />
  const { relatorios, devido } = celula
  if (relatorios.length > 0) {
    const todosEnviados = relatorios.every(r => r.email_enviado_em)
    return (
      <span className={`flex items-center justify-center gap-1 h-10 rounded-lg text-sm font-semibold ${todosEnviados ? 'bg-emerald-50 text-[#059669]' : 'bg-amber-50 text-[#D97706]'}`}
        title={todosEnviados ? 'Enviado ao cliente' : 'Feito, falta enviar'}>
        {todosEnviados ? <CheckCircle2 size={15} /> : <Mail size={15} />}
        {relatorios.length > 1 ? relatorios.length : ''}
      </span>
    )
  }
  if (!devido) return <span className="flex items-center justify-center h-10 rounded-lg text-sm text-[#CBD5E1]" title="Não previsto neste mês">—</span>
  return passado
    ? <span className="flex items-center justify-center h-10 rounded-lg bg-red-50 text-[#DC2626]" title="Não feito"><AlertTriangle size={15} /></span>
    : <span className="flex items-center justify-center h-10 rounded-lg bg-[#F1F5F9] text-[#94A3B8]" title="Aguardando"><Clock size={15} /></span>
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
function ModalEnviarRelatorios({ contratoId, contratoNome, competencia, tipo, relatorios, onClose, onSent }: {
  contratoId: string; contratoNome: string; competencia: string; tipo: ContratoRelatorioTipo; relatorios: DiarioObraRelatorio[]
  onClose: () => void; onSent: (ids: string[]) => void
}) {
  const [temThread, setTemThread] = useState<boolean | null>(null)
  const [destinatarios, setDestinatarios] = useState('')
  const [cc, setCc] = useState('')
  const [assunto, setAssunto] = useState(`${tipo.nome} — ${contratoNome}`)
  const [mensagem, setMensagem] = useState('')
  const [assinaturaHtml, setAssinaturaHtml] = useState('')
  const [contatos, setContatos] = useState<{ nome: string; email: string; tipo: string | null }[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const sb = createClient()
    sb.from('relatorio_email_threads').select('id, ultimo_destinatarios, ultimo_cc').eq('contrato_id', contratoId).eq('tipo', `rel:${tipo.id}`).maybeSingle()
      .then(({ data }) => {
        setTemThread(Boolean(data))
        if (data?.ultimo_destinatarios?.length) setDestinatarios(data.ultimo_destinatarios.join(', '))
        if (data?.ultimo_cc?.length) setCc(data.ultimo_cc.join(', '))
      })
    sb.auth.getUser().then(({ data }) => setAssinaturaHtml(data.user?.user_metadata?.assinatura_email ?? ''))
    sb.from('clientes').select('nome, email, tipo').not('email', 'is', null).order('nome').then(({ data }) => {
      setContatos((data ?? []).filter(c => c.email).map(c => ({ nome: c.nome as string, email: c.email as string, tipo: (c.tipo as string) ?? null })))
    })
  }, [contratoId, tipo.id])

  useEffect(() => {
    const datas = [...relatorios].sort((a, b) => (a.data ?? '').localeCompare(b.data ?? '')).map(r => formatarData(r.data)).filter(Boolean)
    const quando = relatorios.length === 1 ? `do dia ${datas[0]}` : `de ${nomeCompetencia(competencia, 'longo')} (${datas.join(', ')})`
    setMensagem(relatorios.length === 1
      ? `Bom dia,\n\nSegue em anexo o relatório ${tipo.nome} ${quando}.\n\nQualquer dúvida, estamos à disposição.`
      : `Bom dia,\n\nSeguem em anexo os relatórios ${tipo.nome} ${quando}.\n\nQualquer dúvida, estamos à disposição.`)
  }, [relatorios, competencia, tipo.nome])

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
        body: JSON.stringify({ contratoId, tipoId: tipo.id, relatorioIds: relatorios.map(r => r.id), destinatarios: emails, cc: emailsCc, assunto: assunto.trim(), mensagem, assinaturaHtml }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Falha ao enviar.'); return }
      if (data.avisos?.length) alert(data.avisos.join('\n'))
      onSent(relatorios.map(r => r.id))
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
              <h2 className="font-syne font-semibold text-[#0F172A]">Enviar {tipo.nome}</h2>
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
              {temThread ? `Vai responder ao último envio de ${tipo.nome}, na mesma conversa.` : `Primeiro envio de ${tipo.nome} — os próximos vão responder este.`}
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
