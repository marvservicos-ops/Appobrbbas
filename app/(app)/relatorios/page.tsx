'use client'

import { useEffect, useState } from 'react'
import { BarChart2, Wrench, Package, AlertTriangle, CheckCircle2, Clock, TrendingDown, Users, FileText, Printer, Mail, Send, Loader2, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import Link from 'next/link'

interface ObraResumo {
  id: string
  titulo: string
  status: string
  tipo_servico: string
  engenheiro_responsavel?: string
  previsao_termino?: string
  cliente?: { nome: string }
}

interface ProdutoCritico {
  id: string
  nome: string
  quantidade_atual: number
  quantidade_minima: number
  unidade: string
  estoque_nome: string
  estoque_cor: string
}

interface RegistroRecente {
  id: string
  produto_nome: string
  tipo: string
  quantidade: number
  responsavel: string
  data: string
  estoque_nome: string
}

export default function RelatoriosPage() {
  const [obras, setObras] = useState<ObraResumo[]>([])
  const [criticos, setCriticos] = useState<ProdutoCritico[]>([])
  const [registros, setRegistros] = useState<RegistroRecente[]>([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<'obras' | 'estoque' | 'epi' | 'enviar'>('obras')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [obrasRes, produtosRes, registrosRes] = await Promise.all([
        supabase.from('obras').select('id,titulo,status,tipo_servico,engenheiro_responsavel,previsao_termino,cliente:clientes(nome)').order('created_at', { ascending: false }),
        supabase.from('estoque_produtos').select('id,nome,quantidade_atual,quantidade_minima,unidade,estoque:estoques(nome,cor)').eq('ativo', true),
        supabase.from('estoque_registros').select('id,produto_nome,tipo,quantidade,responsavel,data,estoque:estoques(nome)').order('data', { ascending: false }).order('created_at', { ascending: false }).limit(50),
      ])

      if (obrasRes.data) setObras(obrasRes.data as any)

      if (produtosRes.data) {
        const crit = (produtosRes.data as any[])
          .filter(p => p.quantidade_atual <= p.quantidade_minima)
          .map(p => ({
            id: p.id,
            nome: p.nome,
            quantidade_atual: p.quantidade_atual,
            quantidade_minima: p.quantidade_minima,
            unidade: p.unidade,
            estoque_nome: p.estoque?.nome ?? '—',
            estoque_cor: p.estoque?.cor ?? '#64748B',
          }))
        setCriticos(crit)
      }

      if (registrosRes.data) {
        setRegistros((registrosRes.data as any[]).map(r => ({
          id: r.id,
          produto_nome: r.produto_nome,
          tipo: r.tipo,
          quantidade: r.quantidade,
          responsavel: r.responsavel,
          data: r.data,
          estoque_nome: r.estoque?.nome ?? '—',
        })))
      }

      setLoading(false)
    }
    load()
  }, [])

  const stats = {
    andamento: obras.filter(o => o.status === 'Em Andamento').length,
    paralisada: obras.filter(o => o.status === 'Paralisada').length,
    concluida: obras.filter(o => o.status === 'Concluída').length,
    criticos: criticos.length,
  }

  function formatDate(d?: string) {
    if (!d) return '—'
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
  }

  const statusColor: Record<string, string> = {
    'Em Andamento': 'bg-blue-50 text-blue-700',
    'Paralisada': 'bg-amber-50 text-amber-700',
    'Concluída': 'bg-emerald-50 text-emerald-700',
    'Em Planejamento': 'bg-purple-50 text-purple-700',
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="p-4 md:p-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-syne text-xl md:text-2xl font-bold text-[#0F172A]">Relatórios</h1>
            <p className="text-xs text-[#64748B] mt-0.5 hidden sm:block">Visão gerencial consolidada de obras e estoque</p>
          </div>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] transition-colors">
            <Printer size={14} /> Imprimir
          </button>
        </div>

        {/* Cards resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center"><Wrench size={14} className="text-[#4F7CFF]" /></div>
              <span className="text-xs text-[#64748B]">Em Andamento</span>
            </div>
            <div className="font-syne text-3xl font-bold text-[#4F7CFF]">{stats.andamento}</div>
            <div className="text-xs text-[#64748B] mt-1">obras ativas</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center"><AlertTriangle size={14} className="text-amber-500" /></div>
              <span className="text-xs text-[#64748B]">Paralisadas</span>
            </div>
            <div className="font-syne text-3xl font-bold text-amber-500">{stats.paralisada}</div>
            <div className="text-xs text-amber-600 mt-1">requer atenção</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center"><CheckCircle2 size={14} className="text-emerald-500" /></div>
              <span className="text-xs text-[#64748B]">Concluídas</span>
            </div>
            <div className="font-syne text-3xl font-bold text-emerald-600">{stats.concluida}</div>
            <div className="text-xs text-[#64748B] mt-1">obras finalizadas</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center"><TrendingDown size={14} className="text-red-500" /></div>
              <span className="text-xs text-[#64748B]">Estoque Crítico</span>
            </div>
            <div className="font-syne text-3xl font-bold text-red-500">{stats.criticos}</div>
            <div className="text-xs text-red-500 mt-1">abaixo do mínimo</div>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1 mb-5 bg-[#F1F5F9] p-1 rounded-xl w-fit">
          {([['obras', 'Obras', Wrench], ['estoque', 'Estoque Crítico', Package], ['epi', 'Registros Recentes', FileText], ['enviar', 'Enviar RDO', Mail]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setAba(id as any)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all ${aba === id ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#374151]'}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="card animate-pulse h-48" />
        ) : (
          <>
            {/* Aba Obras */}
            {aba === 'obras' && (
              <div className="card p-0 overflow-hidden overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Obra</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Cliente</th>
                      <th className="hidden sm:table-cell text-left text-xs font-semibold text-[#64748B] px-4 py-3">Tipo</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Status</th>
                      <th className="hidden md:table-cell text-left text-xs font-semibold text-[#64748B] px-4 py-3">Eng. Responsável</th>
                      <th className="hidden md:table-cell text-left text-xs font-semibold text-[#64748B] px-4 py-3">Previsão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {obras.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-sm text-[#94A3B8]">Nenhuma obra cadastrada.</td></tr>
                    ) : obras.map(o => (
                      <tr key={o.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3">
                          <Link href={`/obras/${o.id}`} className="text-sm font-medium text-[#0F172A] hover:text-[#4F7CFF] transition-colors">{o.titulo}</Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#64748B]">{(o.cliente as any)?.nome ?? '—'}</td>
                        <td className="hidden sm:table-cell px-4 py-3 text-sm text-[#64748B]">{o.tipo_servico}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[o.status] ?? 'bg-gray-100 text-gray-600'}`}>{o.status}</span>
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-sm text-[#64748B]">{o.engenheiro_responsavel ?? '—'}</td>
                        <td className="hidden md:table-cell px-4 py-3 text-sm text-[#64748B]">{formatDate(o.previsao_termino)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Aba Estoque Crítico */}
            {aba === 'estoque' && (
              <div className="card p-0 overflow-hidden overflow-x-auto">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Produto</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Estoque</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Qtd Atual</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Mínimo</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criticos.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12 text-sm text-emerald-600">Todos os produtos estão acima do mínimo.</td></tr>
                    ) : criticos.map(p => (
                      <tr key={p.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3 text-sm font-medium text-[#0F172A]">{p.nome}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: p.estoque_cor }}>{p.estoque_nome}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-red-600">{p.quantidade_atual} {p.unidade}</td>
                        <td className="px-4 py-3 text-sm text-[#64748B]">{p.quantidade_minima} {p.unidade}</td>
                        <td className="px-4 py-3">
                          {p.quantidade_atual === 0
                            ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Zerado</span>
                            : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Crítico</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Aba Registros Recentes */}
            {aba === 'epi' && (
              <div className="card p-0 overflow-hidden overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Data</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Produto</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Estoque</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Tipo</th>
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Qtd</th>
                      <th className="hidden sm:table-cell text-left text-xs font-semibold text-[#64748B] px-4 py-3">Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registros.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-sm text-[#94A3B8]">Nenhum registro encontrado.</td></tr>
                    ) : registros.map(r => (
                      <tr key={r.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3 text-sm text-[#374151] whitespace-nowrap">{formatDate(r.data)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-[#0F172A]">{r.produto_nome}</td>
                        <td className="px-4 py-3 text-xs text-[#64748B]">{r.estoque_nome}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.tipo === 'saida' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            {r.tipo === 'saida' ? 'Saída' : 'Entrada'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#374151]">{r.quantidade}</td>
                        <td className="hidden sm:table-cell px-4 py-3 text-sm text-[#64748B]">{r.responsavel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Aba Enviar RDO */}
            {aba === 'enviar' && <EnviarRdoTab obras={obras} />}
          </>
        )}
      </div>
    </div>
  )
}

// ── Enviar RDO por e-mail ──────────────────────────────
interface RdoResumo {
  id: string
  numero: number
  data: string
  status: string
}

function EnviarRdoTab({ obras }: { obras: ObraResumo[] }) {
  const [obraId, setObraId] = useState('')
  const [rdos, setRdos] = useState<RdoResumo[]>([])
  const [loadingRdos, setLoadingRdos] = useState(false)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [temThread, setTemThread] = useState<boolean | null>(null)
  const [destinatarios, setDestinatarios] = useState('')
  const [cc, setCc] = useState('')
  const [assunto, setAssunto] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [assinaturaHtml, setAssinaturaHtml] = useState('')
  const [remetente, setRemetente] = useState<{ nome: string; email: string }>({ nome: '', email: '' })
  const [contatos, setContatos] = useState<{ gestor?: { nome: string; email: string }; comprador?: { nome: string; email: string } }>({})

  const obra = obras.find(o => o.id === obraId)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setAssinaturaHtml(data.user?.user_metadata?.assinatura_email ?? '')
      setRemetente({ nome: data.user?.user_metadata?.nome ?? '', email: data.user?.email ?? '' })
    })
  }, [])

  useEffect(() => {
    setRdos([])
    setSelecionados(new Set())
    setTemThread(null)
    setSucesso(false)
    setErro('')
    setDestinatarios('')
    setCc('')
    setContatos({})
    if (!obraId) return
    setLoadingRdos(true)
    const supabase = createClient()
    Promise.all([
      supabase.from('rdos').select('id, numero, data, status').eq('obra_id', obraId).order('numero', { ascending: false }).limit(30),
      supabase.from('relatorio_email_threads').select('id, ultimo_destinatarios, ultimo_cc').eq('obra_id', obraId).eq('tipo', 'rdo').maybeSingle(),
      supabase.from('obras').select('gestor_id, comprador_id').eq('id', obraId).single(),
    ]).then(async ([rdosRes, threadRes, obraRes]) => {
      setRdos((rdosRes.data ?? []) as RdoResumo[])
      setTemThread(Boolean(threadRes.data))
      if (threadRes.data?.ultimo_destinatarios?.length) setDestinatarios(threadRes.data.ultimo_destinatarios.join(', '))
      if (threadRes.data?.ultimo_cc?.length) setCc(threadRes.data.ultimo_cc.join(', '))
      setLoadingRdos(false)

      const obraRow = obraRes.data
      if (obraRow) {
        const [gestorRes, compradorRes] = await Promise.all([
          obraRow.gestor_id ? supabase.from('clientes').select('nome, email').eq('id', obraRow.gestor_id).single() : Promise.resolve({ data: null }),
          obraRow.comprador_id ? supabase.from('clientes').select('nome, email').eq('id', obraRow.comprador_id).single() : Promise.resolve({ data: null }),
        ])
        setContatos({
          gestor: gestorRes.data?.email ? gestorRes.data : undefined,
          comprador: compradorRes.data?.email ? compradorRes.data : undefined,
        })
      }
    })
  }, [obraId])

  function adicionarContato(campo: 'destinatarios' | 'cc', email: string) {
    const set = campo === 'destinatarios' ? destinatarios : cc
    const setter = campo === 'destinatarios' ? setDestinatarios : setCc
    const atuais = set.split(/[,;\n]/).map(e => e.trim()).filter(Boolean)
    if (atuais.includes(email)) return
    setter([...atuais, email].join(', '))
  }

  useEffect(() => {
    if (!obra || selecionados.size === 0) { setAssunto(''); setMensagem(''); return }
    const escolhidos = rdos.filter(r => selecionados.has(r.id)).sort((a, b) => a.numero - b.numero)
    const datas = escolhidos.map(r => new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')).join(', ')
    setAssunto(`RDO — ${obra.titulo}`)
    setMensagem(
      escolhidos.length === 1
        ? `Bom dia,\n\nSegue em anexo o relatório do dia ${datas} da obra ${obra.titulo}.\n\nQualquer dúvida, estamos à disposição.`
        : `Bom dia,\n\nSeguem em anexo os relatórios dos dias ${datas} da obra ${obra.titulo}.\n\nQualquer dúvida, estamos à disposição.`
    )
  }, [selecionados, obra, rdos])

  function toggleRdo(id: string) {
    setSelecionados(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function enviar() {
    const emails = destinatarios.split(/[,;\n]/).map(e => e.trim()).filter(Boolean)
    const emailsCc = cc.split(/[,;\n]/).map(e => e.trim()).filter(Boolean)
    if (emails.length === 0) { setErro('Informe pelo menos um e-mail de destino.'); return }
    if (selecionados.size === 0) { setErro('Selecione pelo menos um relatório.'); return }
    if (!assunto.trim()) { setErro('Informe o assunto.'); return }

    setEnviando(true)
    setErro('')
    setSucesso(false)
    try {
      const res = await fetch('/api/relatorios/enviar-rdo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          obraId,
          rdoIds: Array.from(selecionados),
          destinatarios: emails,
          cc: emailsCc,
          assunto: assunto.trim(),
          mensagem,
          assinaturaHtml,
          remetenteNome: remetente.nome,
          remetenteEmail: remetente.email,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Falha ao enviar.'); setEnviando(false); return }
      setSucesso(true)
      setTemThread(true)
      setSelecionados(new Set())
    } catch {
      setErro('Falha de conexão ao enviar.')
    }
    setEnviando(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Coluna esquerda: obra + seleção de RDOs */}
      <div className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Obra</label>
          <select className="field" value={obraId} onChange={e => setObraId(e.target.value)}>
            <option value="">Selecione uma obra...</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
          </select>
        </div>

        {obraId && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-[#374151]">Relatórios (RDO)</label>
              {selecionados.size > 0 && <span className="text-xs text-[#4F7CFF] font-medium">{selecionados.size} selecionado{selecionados.size > 1 ? 's' : ''}</span>}
            </div>
            {loadingRdos ? (
              <div className="py-8 flex justify-center"><Loader2 size={18} className="animate-spin text-[#4F7CFF]" /></div>
            ) : rdos.length === 0 ? (
              <p className="text-sm text-[#94A3B8] py-4 text-center">Nenhum RDO cadastrado nesta obra.</p>
            ) : (
              <div className="border border-[#E2E8F0] rounded-lg divide-y divide-[#F1F5F9] max-h-72 overflow-y-auto">
                {rdos.map(r => (
                  <label key={r.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#F8FAFC] transition-colors">
                    <input type="checkbox" checked={selecionados.has(r.id)} onChange={() => toggleRdo(r.id)} className="rounded" />
                    <div className="flex-1 flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs font-semibold text-[#64748B]">#{String(r.numero).padStart(3, '0')}</span>
                      <span className="text-[#0F172A]">{new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {temThread !== null && (
              <p className="text-xs text-[#94A3B8] mt-2">
                {temThread
                  ? 'Este e-mail vai responder ao último relatório enviado desta obra, mantendo o histórico na mesma conversa.'
                  : 'Este será o primeiro e-mail de relatório desta obra — os próximos vão responder este.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Coluna direita: composição do e-mail */}
      <div className="card space-y-4">
        {(contatos.gestor || contatos.comprador) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-[#94A3B8]">Adicionar:</span>
            {contatos.gestor && (
              <button type="button" onClick={() => adicionarContato('destinatarios', contatos.gestor!.email)}
                className="text-xs px-2 py-1 rounded-full bg-[#EEF2FF] text-[#4F7CFF] hover:bg-[#DDE6FF] transition-colors">
                + {contatos.gestor.nome} (gestor)
              </button>
            )}
            {contatos.comprador && (
              <button type="button" onClick={() => adicionarContato('destinatarios', contatos.comprador!.email)}
                className="text-xs px-2 py-1 rounded-full bg-[#EEF2FF] text-[#4F7CFF] hover:bg-[#DDE6FF] transition-colors">
                + {contatos.comprador.nome} (comprador)
              </button>
            )}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Destinatário(s) *</label>
          <input className="field" placeholder="cliente@exemplo.com, outro@exemplo.com"
            value={destinatarios} onChange={e => setDestinatarios(e.target.value)} />
          <p className="text-xs text-[#94A3B8] mt-1">Separe múltiplos e-mails por vírgula.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Cc</label>
          <input className="field" placeholder="opcional, separado por vírgula"
            value={cc} onChange={e => setCc(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Assunto *</label>
          <input className="field" value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Selecione um relatório para preencher automaticamente" />
          <p className="text-xs text-[#94A3B8] mt-1">Evite mudar o assunto entre envios — o Gmail só agrupa e-mails da mesma conversa quando o assunto é idêntico.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Mensagem</label>
          <textarea className="field" rows={7} value={mensagem} onChange={e => setMensagem(e.target.value)} placeholder="Selecione um relatório para preencher automaticamente" />
        </div>

        {erro && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2.5">
            <span className="flex-1">{erro}</span>
            <button onClick={() => setErro('')}><X size={12} /></button>
          </div>
        )}
        {sucesso && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg px-3 py-2.5">
            <Check size={14} /> E-mail enviado com sucesso!
          </div>
        )}

        <button onClick={enviar} disabled={enviando || !obraId} className="btn-primary w-full flex items-center justify-center gap-2">
          {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {enviando ? 'Gerando PDF e enviando...' : 'Enviar Relatório'}
        </button>
        {enviando && <p className="text-xs text-[#94A3B8] text-center">Isso pode levar até 30-40 segundos para gerar o PDF do relatório.</p>}
      </div>
    </div>
  )
}
