'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, Building2, Camera, CheckCircle2, ChevronLeft, ChevronRight, Download, FileUp, Loader2,
  Lock, LockOpen, Paperclip, Plus, RefreshCw, Search, Wrench,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import { useAccess } from '@/lib/useAccess'
import { mensagemErro } from '@/lib/erros'
import { formatarCompetencia, formatarData, mesLocal } from '@/lib/datas'
import { formatarMoeda } from '@/lib/numero'
import { SELECT_LANCAMENTO, semClassificacao, situacao, type Lancamento } from '@/lib/cartao'
import { enviarArquivo, lerComprovante, removerArquivoSeSobrou, ACEITA_COMPROVANTE, type CategoriaOpcao, type ObraOpcao } from './comum'
import ModalLancamento from './ModalLancamento'
import ModalImportarFatura from './ModalImportarFatura'
import ModalComprovantes from './ModalComprovantes'

type Filtro = 'todos' | 'pendentes' | 'sem_classificacao' | 'comprovados'

const somarMeses = (comp: string, n: number) => {
  const [a, m] = comp.split('-').map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function CartaoCorporativoPage() {
  const { isAdmin, loading: accessLoading } = useAccess()
  const [mes, setMes] = useState(mesLocal())
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [fechamento, setFechamento] = useState<{ fechado_em: string } | null>(null)
  const [obras, setObras] = useState<ObraOpcao[]>([])
  const [categorias, setCategorias] = useState<CategoriaOpcao[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')

  const [modalGasto, setModalGasto] = useState<{ l: Lancamento | null } | null>(null)
  const [modalFatura, setModalFatura] = useState(false)
  const [modalComprovantes, setModalComprovantes] = useState(false)
  const [anexando, setAnexando] = useState<string | null>(null)
  const anexarRef = useRef<HTMLInputElement>(null)
  const anexarPara = useRef<Lancamento | null>(null)

  useEffect(() => {
    if (!accessLoading && isAdmin) load()
  }, [accessLoading, isAdmin, mes]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true); setErro(null)
    const sb = createClient()
    const [lanRes, fecRes, obrRes, catRes] = await Promise.all([
      sb.from('cartao_lancamentos').select(SELECT_LANCAMENTO).eq('competencia', mes).order('data').order('created_at'),
      sb.from('cartao_fechamentos').select('fechado_em').eq('competencia', mes).maybeSingle(),
      sb.from('obras').select('id, titulo, status').order('titulo'),
      sb.from('categorias_administrativas').select('id, nome, cor').order('nome'),
    ])
    const e = lanRes.error ?? fecRes.error ?? obrRes.error ?? catRes.error
    if (e) { setErro(mensagemErro(e, 'Não foi possível carregar o cartão corporativo')); setLoading(false); return }
    setLancamentos((lanRes.data ?? []) as Lancamento[])
    setFechamento(fecRes.data)
    setObras((obrRes.data ?? []) as ObraOpcao[])
    setCategorias((catRes.data ?? []) as CategoriaOpcao[])
    setLoading(false)
  }

  const fechado = Boolean(fechamento)

  // Anexo rápido direto na linha: sobe o arquivo e, se faltar, preenche o que foi comprado
  async function anexarRapido(file: File | undefined) {
    const l = anexarPara.current
    if (anexarRef.current) anexarRef.current.value = ''
    if (!file || !l) return
    setAnexando(l.id)
    const sb = createClient()
    try {
      const { path, nome, arquivo } = await enviarArquivo(file, l.competencia)
      const { error } = await sb.from('cartao_comprovantes').insert({ lancamento_id: l.id, path, nome })
      if (error) { await removerArquivoSeSobrou(path); throw error }
      const mudar: Record<string, unknown> = {}
      if (l.dispensa_comprovante) mudar.dispensa_comprovante = null
      if (!l.descricao) {
        const lido = await lerComprovante(arquivo)
        if (lido?.descricao) mudar.descricao = lido.descricao
      }
      if (Object.keys(mudar).length > 0) await sb.from('cartao_lancamentos').update(mudar).eq('id', l.id)
    } catch (err) {
      alert(mensagemErro(err as Error, 'Não foi possível anexar o comprovante'))
    }
    setAnexando(null)
    load()
  }

  async function alternarFechamento() {
    const sb = createClient()
    if (fechado) {
      if (!confirm(`Reabrir ${formatarCompetencia(mes)} para alterações?`)) return
      const { error } = await sb.from('cartao_fechamentos').delete().eq('competencia', mes)
      if (error) { alert(mensagemErro(error, 'Erro ao reabrir o mês')); return }
    } else {
      const faltam = [
        pendentes.length && `${pendentes.length} sem comprovante`,
        semClass.length && `${semClass.length} sem classificação`,
        foraDaFatura.length && `${foraDaFatura.length} que não apareceram na fatura`,
      ].filter(Boolean)
      const aviso = faltam.length
        ? `Ainda há ${faltam.join(', ')}. Fechar ${formatarCompetencia(mes)} mesmo assim?`
        : `Fechar ${formatarCompetencia(mes)}? Os gastos ficam travados até reabrir.`
      if (!confirm(aviso)) return
      const { error } = await sb.from('cartao_fechamentos').insert({ competencia: mes })
      if (error) { alert(mensagemErro(error, 'Erro ao fechar o mês')); return }
    }
    load()
  }

  function nomeDestino(l: Lancamento): string | null {
    if (l.destino === 'obra') return obras.find(o => o.id === l.obra_id)?.titulo ?? null
    if (l.destino === 'empresa') return categorias.find(c => c.id === l.categoria_id)?.nome ?? null
    return null
  }

  async function exportar() {
    const XLSX = await import('xlsx')
    const linhas = lancamentos.map(l => ({
      Data: formatarData(l.data),
      Estabelecimento: l.estabelecimento,
      Parcela: l.parcela ?? '',
      'O que foi comprado': l.descricao ?? '',
      Destino: l.destino === 'obra' ? `Obra: ${nomeDestino(l) ?? '—'}` : l.destino === 'empresa' ? `Empresa: ${nomeDestino(l) ?? '—'}` : '',
      Valor: l.valor,
      Comprovante: situacao(l) === 'comprovado' ? `Sim (${l.comprovantes.length})` : situacao(l) === 'dispensado' ? `Dispensado: ${l.dispensa_comprovante}` : 'Falta',
      'Na fatura': l.na_fatura ? 'Sim' : 'Não',
      Observação: l.observacao ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(linhas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, formatarCompetencia(mes).replace('/', '-'))
    XLSX.writeFile(wb, `cartao-corporativo-${mes}.xlsx`)
  }

  if (accessLoading || !isAdmin) {
    return (
      <div className="flex flex-col h-full">
        <Topbar />
        <div className="flex items-center justify-center py-16">
          {accessLoading
            ? <Loader2 size={24} className="animate-spin text-[#4F7CFF]" />
            : <p className="text-sm text-[#64748B]">Acesso restrito a administradores.</p>}
        </div>
      </div>
    )
  }

  const total = lancamentos.reduce((s, l) => s + l.valor, 0)
  const pendentes = lancamentos.filter(l => situacao(l) === 'pendente')
  const comprovados = lancamentos.filter(l => situacao(l) !== 'pendente')
  const semClass = lancamentos.filter(semClassificacao)
  const foraDaFatura = lancamentos.filter(l => !l.na_fatura)
  const soma = (ls: Lancamento[]) => ls.reduce((s, l) => s + l.valor, 0)
  const pct = lancamentos.length ? Math.round((comprovados.length / lancamentos.length) * 100) : 0

  const termo = busca.trim().toLowerCase()
  const lista = lancamentos.filter(l => {
    if (filtro === 'pendentes' && situacao(l) !== 'pendente') return false
    if (filtro === 'comprovados' && situacao(l) === 'pendente') return false
    if (filtro === 'sem_classificacao' && !semClassificacao(l)) return false
    if (!termo) return true
    return [l.estabelecimento, l.descricao, nomeDestino(l)].some(t => t?.toLowerCase().includes(termo))
  })

  const kpis: { f: Filtro; label: string; valor: number; qtd: number; borda: string }[] = [
    { f: 'todos', label: 'Total do mês', valor: total, qtd: lancamentos.length, borda: 'border-l-[#4F7CFF]' },
    { f: 'pendentes', label: 'Falta comprovante', valor: soma(pendentes), qtd: pendentes.length, borda: 'border-l-amber-400' },
    { f: 'sem_classificacao', label: 'Sem classificação', valor: soma(semClass), qtd: semClass.length, borda: 'border-l-slate-400' },
    { f: 'comprovados', label: 'Comprovados', valor: soma(comprovados), qtd: comprovados.length, borda: 'border-l-emerald-500' },
  ]

  return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="p-4 md:p-6 flex-1 overflow-y-auto">

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="font-syne text-xl font-bold text-[#0F172A]">Cartão corporativo</h1>
            <p className="text-sm text-[#64748B] mt-0.5">Gastos da fatura, comprovantes e para onde vai cada custo</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={load} aria-label="Atualizar" title="Atualizar" className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#E2E8F0] hover:bg-[#F1F5F9]">
              <RefreshCw size={14} className="text-[#94A3B8]" />
            </button>
            <button onClick={exportar} disabled={lancamentos.length === 0} aria-label="Exportar planilha" title="Exportar planilha do mês"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#E2E8F0] hover:bg-[#F1F5F9] disabled:opacity-40">
              <Download size={14} className="text-[#64748B]" />
            </button>
            <button onClick={() => setModalGasto({ l: null })} disabled={fechado} className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50">
              <Plus size={15} /> Gasto avulso
            </button>
            <button onClick={() => setModalComprovantes(true)} disabled={fechado} className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50">
              <Camera size={15} /> Enviar comprovantes
            </button>
            <button onClick={() => setModalFatura(true)} disabled={fechado} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
              <FileUp size={15} /> Importar fatura
            </button>
          </div>
        </div>

        {/* Mês da fatura */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <button onClick={() => setMes(somarMeses(mes, -1))} aria-label="Mês anterior" title="Mês anterior" className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#E2E8F0] hover:bg-[#F1F5F9]">
            <ChevronLeft size={16} className="text-[#64748B]" />
          </button>
          <input type="month" value={mes} onChange={e => e.target.value && setMes(e.target.value)} aria-label="Mês da fatura"
            className="px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm text-[#374151] focus:outline-none focus:border-[#4F7CFF]" />
          <button onClick={() => setMes(somarMeses(mes, 1))} aria-label="Próximo mês" title="Próximo mês" className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#E2E8F0] hover:bg-[#F1F5F9]">
            <ChevronRight size={16} className="text-[#64748B]" />
          </button>
          {mes !== mesLocal() && (
            <button onClick={() => setMes(mesLocal())} className="text-xs font-medium text-[#4F7CFF] px-2 py-1 rounded-lg hover:bg-[#EEF2FF]">Mês atual</button>
          )}
          {!loading && !erro && (
            <button onClick={alternarFechamento} disabled={lancamentos.length === 0 && !fechado}
              className={`sm:ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 ${fechado ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border border-[#E2E8F0] text-[#374151] hover:bg-[#F1F5F9]'}`}>
              {fechado ? <><Lock size={13} /> Fechado em {formatarData(fechamento!.fechado_em)} · Reabrir</> : <><LockOpen size={13} /> Fechar o mês</>}
            </button>
          )}
        </div>

        {erro ? (
          <div className="card flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm font-medium text-red-600">{erro}</p>
            <button onClick={load} className="btn-primary mt-4 text-sm">Tentar de novo</button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#4F7CFF]" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              {kpis.map(k => (
                <button key={k.f} onClick={() => setFiltro(filtro === k.f ? 'todos' : k.f)}
                  className={`card p-4 text-left border-l-4 ${k.borda} ${filtro === k.f ? 'ring-2 ring-[#4F7CFF]/30' : ''}`}>
                  <p className="text-xs text-[#64748B] font-medium mb-1">{k.label}</p>
                  <p className="font-syne font-bold text-lg text-[#0F172A]">{formatarMoeda(k.valor)}</p>
                  <p className="text-[11px] text-[#94A3B8]">{k.qtd} gasto{k.qtd !== 1 ? 's' : ''}</p>
                </button>
              ))}
            </div>

            {lancamentos.length > 0 && (
              <div className="mb-4">
                <div className="h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-[#64748B] mt-1">{pct}% comprovado</p>
              </div>
            )}

            {foraDaFatura.length > 0 && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                {foraDaFatura.length} gasto{foraDaFatura.length !== 1 ? 's' : ''} lançado{foraDaFatura.length !== 1 ? 's' : ''} à mão ainda não apareceu na fatura. Ao importar a fatura, eles se juntam sozinhos à linha certa.
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap mb-4">
              <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input className="field !pl-9" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Estabelecimento, descrição, obra…" />
              </div>
              {filtro !== 'todos' && (
                <button onClick={() => setFiltro('todos')} className="text-xs font-medium text-[#4F7CFF] px-2 py-1 rounded-lg hover:bg-[#EEF2FF]">Ver todos</button>
              )}
            </div>

            <input ref={anexarRef} type="file" accept={ACEITA_COMPROVANTE} className="hidden" onChange={e => anexarRapido(e.target.files?.[0])} />

            {lancamentos.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-14 text-center px-6">
                <FileUp size={24} className="text-[#CBD5E1] mb-3" />
                <p className="text-sm font-medium text-[#0F172A]">Nenhum gasto em {formatarCompetencia(mes)}</p>
                <p className="text-xs text-[#94A3B8] mt-1 max-w-sm">Importe a fatura do mês para listar as compras, ou envie os comprovantes que já tem: eles viram gastos e se juntam à fatura quando ela chegar.</p>
                {!fechado && (
                  <button onClick={() => setModalFatura(true)} className="btn-primary mt-4 text-sm flex items-center gap-2"><FileUp size={15} /> Importar fatura</button>
                )}
              </div>
            ) : lista.length === 0 ? (
              <div className="card py-10 text-center text-sm text-[#94A3B8]">Nenhum gasto neste filtro.</div>
            ) : (
              <div className="card p-0 overflow-hidden divide-y divide-[#F1F5F9]">
                {lista.map(l => {
                  const s = situacao(l)
                  const destinoNome = nomeDestino(l)
                  return (
                    <div key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFC] cursor-pointer"
                      onClick={() => setModalGasto({ l })}>
                      <div className="w-11 text-center shrink-0">
                        <p className="text-sm font-semibold text-[#0F172A] leading-none">{formatarData(l.data).slice(0, 2)}</p>
                        <p className="text-[10px] text-[#94A3B8] uppercase">{new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#0F172A] truncate">
                          {l.descricao || l.estabelecimento}
                          {l.parcela && <span className="text-[#94A3B8] font-normal"> · {l.parcela}</span>}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {l.descricao && <span className="text-xs text-[#94A3B8] truncate max-w-[200px]">{l.estabelecimento}</span>}
                          {destinoNome ? (
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded ${l.destino === 'obra' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>
                              {l.destino === 'obra' ? <Wrench size={10} /> : <Building2 size={10} />}{destinoNome}
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">Sem classificação</span>
                          )}
                          {!l.na_fatura && <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Fora da fatura</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-semibold ${l.valor < 0 ? 'text-emerald-600' : 'text-[#0F172A]'}`}>{formatarMoeda(l.valor)}</p>
                        {s === 'comprovado' && <p className="text-[11px] text-emerald-600 flex items-center justify-end gap-1"><CheckCircle2 size={11} /> {l.comprovantes.length > 1 ? `${l.comprovantes.length} anexos` : 'Comprovado'}</p>}
                        {s === 'dispensado' && <p className="text-[11px] text-[#94A3B8]">{l.dispensa_comprovante}</p>}
                      </div>
                      {s === 'pendente' && !fechado ? (
                        <button onClick={e => { e.stopPropagation(); anexarPara.current = l; anexarRef.current?.click() }}
                          disabled={anexando === l.id} aria-label="Anexar comprovante" title="Anexar comprovante"
                          className="shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100">
                          {anexando === l.id ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                          <span className="hidden sm:inline">Anexar</span>
                        </button>
                      ) : <div className="w-[38px] sm:w-[84px] shrink-0" />}
                    </div>
                  )
                })}
              </div>
            )}

            <p className="text-[11px] text-[#94A3B8] mt-4">
              Gasto de obra entra no centro de custos da obra; gasto da empresa soma em Custos da empresa. Não lance a mesma compra também lá, para não contar em dobro.
            </p>
          </>
        )}
      </div>

      {modalGasto && (
        <ModalLancamento lancamento={modalGasto.l} competencia={mes} obras={obras} categorias={categorias}
          bloqueado={fechado} onClose={() => setModalGasto(null)} onSaved={() => { setModalGasto(null); load() }} />
      )}
      {modalFatura && (
        <ModalImportarFatura competencia={mes} onClose={() => setModalFatura(false)}
          onSaved={comp => { setModalFatura(false); if (comp !== mes) setMes(comp); else load() }} />
      )}
      {modalComprovantes && (
        <ModalComprovantes competencia={mes} lancamentos={lancamentos}
          onClose={() => setModalComprovantes(false)} onSaved={() => { setModalComprovantes(false); load() }} />
      )}
    </div>
  )
}
