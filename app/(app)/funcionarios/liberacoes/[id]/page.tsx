'use client'

// Solicitação de liberação: local (obra cadastrada ou avulso) → período →
// funcionários → veículos e motoristas → e-mail (para/CC, assunto, texto).
// A tabela vai no corpo do e-mail e em Excel anexo. /nova cria; /<id> edita
// (também depois de enviada) e permite reenviar.

import { Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import * as XLSX from 'xlsx'
import {
  ArrowLeft, Loader2, Search, Trash2, Plus, UserPlus, Car, X, Send, Save, Download, AlertTriangle, CheckCircle2, RotateCcw, Building2, MapPin,
} from 'lucide-react'
import Topbar from '@/components/Topbar'
import { createClient } from '@/lib/supabase/client'
import { useAccess } from '@/lib/useAccess'
import { diasEntre, formatarData, hojeLocal, somarDias } from '@/lib/datas'
import { mensagemErro } from '@/lib/erros'
import {
  assuntoPadrao, extrairEmails, htmlTabelas, mensagemPadrao, nomeArquivoExcel, novaChave, pendenciasEnvio, planilhaLiberacao,
  type DadosLiberacao, type Liberacao, type LiberacaoFuncionario, type LiberacaoMotorista, type LiberacaoVeiculo,
} from '@/lib/liberacoes'

interface ObraOpt { id: string; titulo: string; endereco: string | null; status: string; cliente_id: string | null; gestor_id: string | null; comprador_id: string | null }
interface ClienteOpt { id: string; nome: string; email: string | null; tipo: string | null; empresa_id: string | null }
interface EmpresaOpt { id: string; razao_social: string; apelido: string | null }
interface FuncOpt { id: string; nome: string; cpf: string | null; funcao: string | null; cargo: string | null }
interface VeicOpt { id: string; nome: string; placa: string; cor: string | null }
type Anterior = Pick<Liberacao, 'id' | 'obra_id' | 'local_nome' | 'local_endereco' | 'local_cliente' | 'destinatarios' | 'cc' | 'created_at'>

interface Form {
  modoLocal: 'obra' | 'avulso'
  obra_id: string
  local_nome: string
  local_endereco: string
  local_cliente: string
  data_inicio: string
  data_fim: string
  horario: string
  funcionarios: LiberacaoFuncionario[]
  veiculos: LiberacaoVeiculo[]
  destinatarios: string[]
  cc: string[]
  assunto: string
  mensagem: string
  assuntoEditado: boolean
  mensagemEditada: boolean
}

const hoje = hojeLocal()
const FORM_VAZIO: Form = {
  modoLocal: 'obra', obra_id: '', local_nome: '', local_endereco: '', local_cliente: '',
  data_inicio: hoje, data_fim: hoje, horario: '', funcionarios: [], veiculos: [],
  destinatarios: [], cc: [], assunto: '', mensagem: '', assuntoEditado: false, mensagemEditada: false,
}

function formDe(l: Liberacao, duplicando: boolean): Form {
  let { data_inicio, data_fim } = l
  // Duplicando uma liberação antiga: mesmo tamanho de período, começando hoje
  if (duplicando && data_inicio < hoje) {
    const dur = diasEntre(data_inicio, data_fim)
    data_inicio = hoje
    data_fim = somarDias(hoje, dur)
  }
  const dados: DadosLiberacao = { ...l, data_inicio, data_fim }
  const assuntoEditado = !duplicando && l.assunto !== assuntoPadrao(l)
  const mensagemEditada = !duplicando && l.mensagem !== mensagemPadrao(l)
  return {
    modoLocal: l.obra_id ? 'obra' : 'avulso',
    obra_id: l.obra_id ?? '',
    local_nome: l.local_nome ?? '',
    local_endereco: l.local_endereco ?? '',
    local_cliente: l.local_cliente ?? '',
    data_inicio, data_fim,
    horario: l.horario ?? '',
    funcionarios: (l.funcionarios ?? []).map(f => ({ ...f, chave: f.chave || novaChave() })),
    veiculos: (l.veiculos ?? []).map(v => ({ ...v, chave: v.chave || novaChave(), motoristas: v.motoristas ?? [] })),
    destinatarios: l.destinatarios ?? [],
    cc: l.cc ?? [],
    assunto: assuntoEditado ? l.assunto : assuntoPadrao(dados),
    mensagem: mensagemEditada ? l.mensagem : mensagemPadrao(dados),
    assuntoEditado, mensagemEditada,
  }
}

function EditorLiberacao() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const search = useSearchParams()
  const { isAdmin, loading: accessLoading, profile } = useAccess()

  const [id, setId] = useState<string | null>(params.id === 'nova' ? null : params.id)
  const [registro, setRegistro] = useState<Liberacao | null>(null)
  const [f, setF] = useState<Form>(FORM_VAZIO)
  const [obras, setObras] = useState<ObraOpt[]>([])
  const [clientes, setClientes] = useState<ClienteOpt[]>([])
  const [empresas, setEmpresas] = useState<EmpresaOpt[]>([])
  const [funcsCad, setFuncsCad] = useState<FuncOpt[]>([])
  const [veicsCad, setVeicsCad] = useState<VeicOpt[]>([])
  const [anteriores, setAnteriores] = useState<Anterior[]>([])
  const [buscaFunc, setBuscaFunc] = useState('')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState<'' | 'salvar' | 'enviar'>('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  // id que já está na tela (evita recarregar quando a URL muda de /nova para /<id> ao salvar)
  const idNaTela = useRef<string | null>(null)
  const duplicarId = search.get('duplicar')

  useEffect(() => {
    if (!accessLoading && !isAdmin) router.replace('/obras')
  }, [isAdmin, accessLoading, router])

  useEffect(() => {
    if (params.id !== 'nova' && params.id === idNaTela.current) return
    async function load() {
      const sb = createClient()
      const origemId = params.id !== 'nova' ? params.id : duplicarId
      const [ob, cl, em, fu, ve, an, origem] = await Promise.all([
        sb.from('obras').select('id, titulo, endereco, status, cliente_id, gestor_id, comprador_id').order('titulo'),
        sb.from('clientes').select('id, nome, email, tipo, empresa_id').order('nome'),
        sb.from('empresas').select('id, razao_social, apelido'),
        sb.from('funcionarios').select('id, nome, cpf, funcao, cargo').eq('ativo', true).order('nome'),
        sb.from('veiculos').select('id, nome, placa, cor').eq('ativo', true).order('nome'),
        sb.from('liberacoes').select('id, obra_id, local_nome, local_endereco, local_cliente, destinatarios, cc, created_at').order('created_at', { ascending: false }).limit(300),
        origemId ? sb.from('liberacoes').select('*').eq('id', origemId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ])
      if (an.error) setErro(`${mensagemErro(an.error, 'Erro ao carregar')} Confira se a migração 2026_11_06_liberacoes.sql já foi rodada.`)
      setObras((ob.data ?? []) as ObraOpt[])
      setClientes((cl.data ?? []) as ClienteOpt[])
      setEmpresas((em.data ?? []) as EmpresaOpt[])
      setFuncsCad((fu.data ?? []) as FuncOpt[])
      setVeicsCad((ve.data ?? []) as VeicOpt[])
      setAnteriores((an.data ?? []) as Anterior[])
      if (origemId) {
        if (!origem.data) setErro('Solicitação não encontrada.')
        else {
          const l = origem.data as Liberacao
          if (params.id !== 'nova') { setRegistro(l); idNaTela.current = l.id }
          setF(formDe(l, params.id === 'nova'))
        }
      }
      setLoading(false)
    }
    load()
  }, [params.id, duplicarId])

  // ── Dados derivados ──
  const dados: DadosLiberacao = {
    local_nome: f.local_nome.trim(), local_endereco: f.local_endereco.trim() || null, local_cliente: f.local_cliente.trim() || null,
    data_inicio: f.data_inicio, data_fim: f.data_fim, horario: f.horario.trim() || null,
    funcionarios: f.funcionarios, veiculos: f.veiculos,
  }
  const assunto = f.assuntoEditado ? f.assunto : assuntoPadrao(dados)
  const mensagem = f.mensagemEditada ? f.mensagem : mensagemPadrao(dados)
  const pendencias = pendenciasEnvio({ ...dados, destinatarios: f.destinatarios, assunto })
  const dias = f.data_inicio && f.data_fim ? diasEntre(f.data_inicio, f.data_fim) + 1 : 0

  const nomeEmpresa = (empresaId: string | null) => {
    const e = empresas.find(x => x.id === empresaId)
    return e ? (e.apelido || e.razao_social) : ''
  }
  const sugestoesEmail = useMemo(() => clientes.filter(c => c.email).map(c => ({
    email: c.email as string,
    rotulo: [c.nome, c.tipo, nomeEmpresa(c.empresa_id)].filter(Boolean).join(' · '),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [clientes, empresas])
  const locaisAvulsos = useMemo(() => Array.from(new Set(anteriores.filter(a => !a.obra_id && a.local_nome).map(a => a.local_nome))), [anteriores])

  const set = (patch: Partial<Form>) => setF(x => ({ ...x, ...patch }))

  // ── Local ──
  function escolherObra(obraId: string) {
    const o = obras.find(x => x.id === obraId)
    if (!o) { set({ obra_id: '', local_nome: '', local_endereco: '', local_cliente: '' }); return }
    const cliente = clientes.find(c => c.id === o.cliente_id)
    const patch: Partial<Form> = {
      obra_id: o.id, local_nome: o.titulo, local_endereco: o.endereco ?? '',
      local_cliente: cliente ? (nomeEmpresa(cliente.empresa_id) || cliente.nome) : '',
    }
    // Destinatários: os da última solicitação dessa obra; senão gestor (Para) e comprador (CC)
    if (!f.destinatarios.length && !f.cc.length) {
      const ultima = anteriores.find(a => a.obra_id === o.id)
      if (ultima) { patch.destinatarios = ultima.destinatarios; patch.cc = ultima.cc }
      else {
        const gestor = clientes.find(c => c.id === o.gestor_id)?.email
        const comprador = clientes.find(c => c.id === o.comprador_id)?.email
        patch.destinatarios = gestor ? [gestor] : []
        patch.cc = comprador && comprador !== gestor ? [comprador] : []
      }
    }
    set(patch)
  }

  function mudarLocalAvulso(nome: string) {
    const patch: Partial<Form> = { local_nome: nome }
    const ultima = anteriores.find(a => !a.obra_id && a.local_nome.toLowerCase() === nome.trim().toLowerCase())
    if (ultima) {
      if (!f.local_endereco) patch.local_endereco = ultima.local_endereco ?? ''
      if (!f.local_cliente) patch.local_cliente = ultima.local_cliente ?? ''
      if (!f.destinatarios.length && !f.cc.length) { patch.destinatarios = ultima.destinatarios; patch.cc = ultima.cc }
    }
    set(patch)
  }

  function trocarModo(modo: Form['modoLocal']) {
    if (modo === f.modoLocal) return
    set({ modoLocal: modo, obra_id: '', local_nome: '', local_endereco: '', local_cliente: '' })
  }

  // ── Período ──
  function mudarInicio(v: string) {
    if (!v) { set({ data_inicio: v }); return }
    // mantém a duração
    const dur = f.data_inicio && f.data_fim ? Math.max(0, diasEntre(f.data_inicio, f.data_fim)) : 0
    set({ data_inicio: v, data_fim: somarDias(v, dur) })
  }
  function mudarDias(n: number) {
    if (!f.data_inicio || !Number.isFinite(n) || n < 1) return
    set({ data_fim: somarDias(f.data_inicio, Math.min(n, 366) - 1) })
  }

  // ── Funcionários ──
  // Marcar na lista já inclui na solicitação; desmarcar tira.
  const idsNaLista = new Set(f.funcionarios.map(x => x.funcionario_id).filter(Boolean))
  const funcsFiltrados = funcsCad.filter(x => x.nome.toLowerCase().includes(buscaFunc.trim().toLowerCase()))
  function alternarFuncionario(fc: FuncOpt) {
    if (idsNaLista.has(fc.id)) {
      set({ funcionarios: f.funcionarios.filter(x => x.funcionario_id !== fc.id) })
      return
    }
    set({ funcionarios: [...f.funcionarios, { chave: novaChave(), funcionario_id: fc.id, nome: fc.nome, cpf: fc.cpf ?? '', funcao: fc.funcao || fc.cargo || '' }] })
  }
  const addFuncionarioAvulso = () =>
    set({ funcionarios: [...f.funcionarios, { chave: novaChave(), funcionario_id: null, nome: '', cpf: '', funcao: '' }] })
  const editFunc = (chave: string, patch: Partial<LiberacaoFuncionario>) =>
    set({ funcionarios: f.funcionarios.map(x => x.chave === chave ? { ...x, ...patch } : x) })
  const removerFunc = (chave: string) => set({ funcionarios: f.funcionarios.filter(x => x.chave !== chave) })

  // ── Veículos ──
  const veicsDisponiveis = veicsCad.filter(v => !f.veiculos.some(x => x.veiculo_id === v.id))
  function addVeiculo(veicId: string) {
    if (veicId === '__avulso') {
      set({ veiculos: [...f.veiculos, { chave: novaChave(), veiculo_id: null, nome: '', placa: '', cor: '', motoristas: [] }] })
      return
    }
    const v = veicsCad.find(x => x.id === veicId)
    if (!v) return
    set({ veiculos: [...f.veiculos, { chave: novaChave(), veiculo_id: v.id, nome: v.nome, placa: v.placa, cor: v.cor ?? '', motoristas: [] }] })
  }
  const editVeic = (chave: string, patch: Partial<LiberacaoVeiculo>) =>
    set({ veiculos: f.veiculos.map(x => x.chave === chave ? { ...x, ...patch } : x) })
  const removerVeic = (chave: string) => set({ veiculos: f.veiculos.filter(x => x.chave !== chave) })
  function addMotorista(chave: string, nome: string) {
    const n = nome.trim()
    if (!n) return
    const v = f.veiculos.find(x => x.chave === chave)
    if (!v || v.motoristas.some(m => m.nome.toLowerCase() === n.toLowerCase())) return
    const cad = funcsCad.find(x => x.nome.toLowerCase() === n.toLowerCase())
    const daLista = f.funcionarios.find(x => x.nome.toLowerCase() === n.toLowerCase())
    const m: LiberacaoMotorista = cad
      ? { funcionario_id: cad.id, nome: cad.nome, cpf: cad.cpf ?? '' }
      : { funcionario_id: daLista?.funcionario_id ?? null, nome: daLista?.nome ?? n, cpf: daLista?.cpf ?? '' }
    editVeic(chave, { motoristas: [...v.motoristas, m] })
  }

  // ── Salvar / enviar ──
  async function salvar(): Promise<string | null> {
    setErro(''); setAviso('')
    if (!f.data_inicio || !f.data_fim) { setErro('Informe o período.'); return null }
    if (f.data_fim < f.data_inicio) { setErro('A data final está antes da inicial.'); return null }
    if (f.modoLocal === 'obra' && !f.obra_id) { setErro('Escolha a obra ou mude para "Local não cadastrado".'); return null }
    const linha = {
      obra_id: f.modoLocal === 'obra' ? f.obra_id || null : null,
      local_nome: dados.local_nome,
      local_endereco: dados.local_endereco,
      local_cliente: dados.local_cliente,
      data_inicio: f.data_inicio,
      data_fim: f.data_fim,
      horario: dados.horario,
      funcionarios: f.funcionarios.map(x => ({ ...x, nome: x.nome.trim(), cpf: x.cpf.trim(), funcao: x.funcao.trim() })),
      veiculos: f.veiculos.map(x => ({ ...x, nome: x.nome.trim(), placa: x.placa.trim().toUpperCase(), cor: x.cor.trim() })),
      destinatarios: f.destinatarios,
      cc: f.cc,
      assunto: assunto.trim(),
      mensagem,
      updated_at: new Date().toISOString(),
    }
    const sb = createClient()
    if (id) {
      const { data, error } = await sb.from('liberacoes').update(linha).eq('id', id).select('*').single()
      if (error || !data) { setErro(mensagemErro(error, 'Não foi possível salvar')); return null }
      setRegistro(data as Liberacao)
      return id
    }
    const { data, error } = await sb.from('liberacoes')
      .insert({ ...linha, criado_por_nome: profile?.nome || profile?.email || null }).select('*').single()
    if (error || !data) { setErro(mensagemErro(error, 'Não foi possível salvar')); return null }
    setRegistro(data as Liberacao)
    setId(data.id)
    idNaTela.current = data.id
    // troca a URL sem recarregar a tela
    window.history.replaceState(null, '', `/funcionarios/liberacoes/${data.id}`)
    return data.id
  }

  async function salvarRascunho() {
    setSalvando('salvar')
    const ok = await salvar()
    setSalvando('')
    if (ok) setAviso('Salvo.')
  }

  async function enviar() {
    if (pendencias.length) { setErro(pendencias.join('. ') + '.'); return }
    const reenvio = registro?.status === 'enviada'
    const resumo = `${reenvio ? 'Enviar DE NOVO' : 'Enviar'} a solicitação para ${f.destinatarios.join(', ')}${f.cc.length ? `\ncom cópia para ${f.cc.join(', ')}` : ''}?`
    if (!confirm(resumo)) return
    setSalvando('enviar')
    const salvoId = await salvar()
    if (!salvoId) { setSalvando(''); return }
    try {
      const res = await fetch('/api/liberacoes/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: salvoId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setErro(json.error ?? 'Não foi possível enviar.'); return }
      setRegistro(r => r ? { ...r, status: 'enviada', envios: (r.envios ?? 0) + 1, enviada_em: json.enviadaEm, enviada_por_nome: profile?.nome || profile?.email || null } : r)
      setAviso(`E-mail enviado com a planilha em anexo.${json.copiaPara ? ` Uma cópia oculta foi para ${json.copiaPara}.` : ''}`)
    } catch {
      setErro('Sem conexão. A solicitação ficou salva; tente enviar de novo.')
    } finally {
      setSalvando('')
    }
  }

  async function excluir() {
    if (!id || !confirm('Excluir esta solicitação de liberação? O e-mail já enviado não é desfeito.')) return
    const { error } = await createClient().from('liberacoes').delete().eq('id', id)
    if (error) { setErro(mensagemErro(error, 'Não foi possível excluir')); return }
    router.push('/funcionarios/liberacoes')
  }

  function baixarExcel() {
    XLSX.writeFile(planilhaLiberacao(dados), nomeArquivoExcel(dados))
  }

  if (loading) return <div><Topbar /><div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#4F7CFF]" /></div></div>

  const obrasOrdenadas = [...obras].sort((a, b) => Number(a.status === 'Concluída') - Number(b.status === 'Concluída') || a.titulo.localeCompare(b.titulo))

  return (
    <div>
      <Topbar />
      <div className="p-4 md:p-6 pb-32 max-w-4xl space-y-4">
        <Link href="/funcionarios/liberacoes" className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A]">
          <ArrowLeft size={15} /> Liberações
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-syne text-xl md:text-2xl font-bold text-[#0F172A]">{id ? 'Solicitação de liberação' : 'Nova solicitação de liberação'}</h1>
          {registro?.status === 'enviada' && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#059669] bg-[#ECFDF5] border border-[#A7F3D0] rounded-full px-3 py-1">
              <CheckCircle2 size={13} /> Enviada{registro.enviada_em ? ` em ${formatarData(registro.enviada_em)}` : ''}{registro.envios > 1 ? ` · ${registro.envios} envios` : ''}
            </span>
          )}
        </div>
        {registro?.status === 'enviada' && (
          <p className="text-xs text-[#64748B] -mt-2">Você pode corrigir e enviar de novo. O e-mail anterior não muda.</p>
        )}

        {erro && <p className="text-sm text-[#EF4444] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3 py-2">{erro}</p>}
        {aviso && <p className="text-sm text-[#065F46] bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl px-3 py-2">{aviso}</p>}

        {/* 1. Local */}
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-syne font-semibold text-[#0F172A] text-sm">1. Local</h2>
            <div className="inline-flex rounded-lg border border-[#E2E8F0] p-0.5 text-xs">
              <button onClick={() => trocarModo('obra')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md ${f.modoLocal === 'obra' ? 'bg-[#EEF2FF] text-[#4F7CFF] font-medium' : 'text-[#64748B]'}`}>
                <Building2 size={12} /> Obra cadastrada
              </button>
              <button onClick={() => trocarModo('avulso')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md ${f.modoLocal === 'avulso' ? 'bg-[#EEF2FF] text-[#4F7CFF] font-medium' : 'text-[#64748B]'}`}>
                <MapPin size={12} /> Local não cadastrado
              </button>
            </div>
          </div>
          {f.modoLocal === 'obra' ? (
            <select className="field" value={f.obra_id} onChange={e => escolherObra(e.target.value)}>
              <option value="">Escolha a obra…</option>
              {obrasOrdenadas.map(o => <option key={o.id} value={o.id}>{o.titulo}{o.status === 'Concluída' ? ' (concluída)' : ''}</option>)}
            </select>
          ) : (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome do local</label>
              <input className="field" list="locais-avulsos" value={f.local_nome} onChange={e => mudarLocalAvulso(e.target.value)} placeholder="Ex: Shopping X – loja 120" />
              <datalist id="locais-avulsos">{locaisAvulsos.map(l => <option key={l} value={l} />)}</datalist>
            </div>
          )}
          {(f.modoLocal === 'avulso' || f.obra_id) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {f.modoLocal === 'obra' && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome do local no e-mail</label>
                  <input className="field" value={f.local_nome} onChange={e => set({ local_nome: e.target.value })} />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Endereço</label>
                <input className="field" value={f.local_endereco} onChange={e => set({ local_endereco: e.target.value })} placeholder="Opcional" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Cliente</label>
                <input className="field" value={f.local_cliente} onChange={e => set({ local_cliente: e.target.value })} placeholder="Opcional" />
              </div>
            </div>
          )}
        </div>

        {/* 2. Período */}
        <div className="card space-y-3">
          <h2 className="font-syne font-semibold text-[#0F172A] text-sm">2. Período</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Início</label>
              <input type="date" className="field" value={f.data_inicio} onChange={e => mudarInicio(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Fim</label>
              <input type="date" className="field" value={f.data_fim} min={f.data_inicio} onChange={e => set({ data_fim: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Dias</label>
              <input type="number" min={1} className="field" value={dias > 0 ? dias : ''} onChange={e => mudarDias(parseInt(e.target.value, 10))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Horário</label>
              <input className="field" value={f.horario} onChange={e => set({ horario: e.target.value })} placeholder="Ex: 07h às 17h" />
            </div>
          </div>
        </div>

        {/* 3. Funcionários */}
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-syne font-semibold text-[#0F172A] text-sm">3. Funcionários <span className="text-[#64748B] font-normal">({f.funcionarios.length})</span></h2>
            <button onClick={addFuncionarioAvulso} className="btn-secondary text-xs px-3 py-1.5 min-h-0">
              <UserPlus size={14} /> Pessoa fora do cadastro
            </button>
          </div>
          <div className="border border-[#E2E8F0] rounded-lg p-3 space-y-2 bg-[#F8FAFC]">
            <p className="text-xs font-semibold text-[#64748B]">Marque quem vai na liberação</p>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input className="field pl-8 text-sm" value={buscaFunc} onChange={e => setBuscaFunc(e.target.value)} placeholder="Buscar por nome…" />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-0.5 bg-white border border-[#E2E8F0] rounded-lg p-1.5">
              {funcsFiltrados.map(x => (
                <label key={x.id} className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded cursor-pointer hover:bg-[#F8FAFC] ${idsNaLista.has(x.id) ? 'text-[#0F172A] font-medium' : 'text-[#374151]'}`}>
                  <input type="checkbox" checked={idsNaLista.has(x.id)} onChange={() => alternarFuncionario(x)} className="w-4 h-4 accent-[#4F7CFF] shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{x.nome}{(x.funcao || x.cargo) ? <span className="font-normal text-[#64748B]"> — {x.funcao || x.cargo}</span> : null}</span>
                  {!x.cpf && <span className="text-[11px] text-[#B45309] shrink-0">sem CPF</span>}
                </label>
              ))}
              {funcsFiltrados.length === 0 && <p className="text-xs text-[#94A3B8] px-1.5 py-1">{funcsCad.length ? 'Ninguém com esse nome.' : 'Nenhum funcionário ativo cadastrado.'}</p>}
            </div>
          </div>

          {f.funcionarios.length > 0 && (
            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-[1.6fr_1fr_1fr_auto] gap-2 text-xs font-medium text-[#64748B] px-1">
                <span>Nome</span><span>CPF</span><span>Função</span><span className="w-9" />
              </div>
              {f.funcionarios.map(x => (
                <div key={x.chave} className="grid grid-cols-1 sm:grid-cols-[1.6fr_1fr_1fr_auto] gap-2 items-center border-b border-[#F1F5F9] pb-2 sm:border-0 sm:pb-0">
                  <input className="field" value={x.nome} onChange={e => editFunc(x.chave, { nome: e.target.value })} placeholder="Nome" aria-label="Nome" />
                  <div className="relative">
                    <input className={`field ${!x.cpf.trim() ? 'border-[#FCD34D]' : ''}`} value={x.cpf} onChange={e => editFunc(x.chave, { cpf: e.target.value })} placeholder="CPF" aria-label="CPF" />
                    {!x.cpf.trim() && <AlertTriangle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#F59E0B]" />}
                  </div>
                  <input className="field" value={x.funcao} onChange={e => editFunc(x.chave, { funcao: e.target.value })} placeholder="Função" aria-label="Função" />
                  <button onClick={() => removerFunc(x.chave)} className="justify-self-end w-9 h-9 flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEF2F2]" title="Tirar da solicitação">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {f.funcionarios.some(x => !x.cpf.trim()) && (
                <p className="text-xs text-[#B45309]">Tem gente sem CPF. Dá para digitar aqui. Se a pessoa for do cadastro, vale corrigir lá também.</p>
              )}
            </div>
          )}
        </div>

        {/* 4. Veículos */}
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-syne font-semibold text-[#0F172A] text-sm">4. Veículos <span className="text-[#64748B] font-normal">({f.veiculos.length})</span></h2>
            <select className="field sm:max-w-xs" value="" onChange={e => addVeiculo(e.target.value)}>
              <option value="">+ Incluir veículo…</option>
              {veicsDisponiveis.map(v => <option key={v.id} value={v.id}>{v.nome} · {v.placa}</option>)}
              <option value="__avulso">Veículo fora do cadastro</option>
            </select>
          </div>
          <datalist id="motoristas-sugestoes">
            {Array.from(new Set([...f.funcionarios.map(x => x.nome), ...funcsCad.map(x => x.nome)])).filter(Boolean).map(n => <option key={n} value={n} />)}
          </datalist>
          {f.veiculos.map(v => (
            <div key={v.chave} className="border border-[#E2E8F0] rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr_auto] gap-2 items-center">
                <input className="field" value={v.nome} onChange={e => editVeic(v.chave, { nome: e.target.value })} placeholder="Veículo (modelo)" aria-label="Veículo" />
                <input className="field uppercase" value={v.placa} onChange={e => editVeic(v.chave, { placa: e.target.value })} placeholder="Placa" aria-label="Placa" />
                <input className="field" value={v.cor} onChange={e => editVeic(v.chave, { cor: e.target.value })} placeholder="Cor" aria-label="Cor" />
                <button onClick={() => removerVeic(v.chave)} className="justify-self-end w-9 h-9 flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEF2F2]" title="Tirar da solicitação">
                  <Trash2 size={15} />
                </button>
              </div>
              <div>
                <p className="text-xs font-medium text-[#64748B] mb-1.5 flex items-center gap-1"><Car size={12} /> Motorista(s)</p>
                <div className="flex flex-wrap items-center gap-2">
                  {v.motoristas.map(m => (
                    <span key={m.nome} className="inline-flex items-center gap-1 text-xs bg-[#EEF2FF] text-[#3730A3] rounded-full pl-3 pr-1 py-1">
                      {m.nome}{m.cpf ? <span className="text-[#6366F1]"> · {m.cpf}</span> : null}
                      <button onClick={() => editVeic(v.chave, { motoristas: v.motoristas.filter(x => x.nome !== m.nome) })} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-[#E0E7FF]" aria-label={`Tirar ${m.nome}`}>
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <CampoMotorista onAdd={nome => addMotorista(v.chave, nome)} />
                </div>
              </div>
            </div>
          ))}
          {f.veiculos.length === 0 && <p className="text-xs text-[#94A3B8]">Nenhum veículo. Se a liberação for só de pessoas, deixe vazio.</p>}
        </div>

        {/* 5. E-mail */}
        <div className="card space-y-3">
          <h2 className="font-syne font-semibold text-[#0F172A] text-sm">5. E-mail</h2>
          <datalist id="emails-clientes">
            {sugestoesEmail.map(s => <option key={s.email + s.rotulo} value={s.email}>{s.rotulo}</option>)}
          </datalist>
          <CampoEmails rotulo="Para (gestora)" valores={f.destinatarios} onChange={v => set({ destinatarios: v })} />
          <CampoEmails rotulo="Cópia (CC)" valores={f.cc} onChange={v => set({ cc: v })} />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-[#374151]">Assunto</label>
              {f.assuntoEditado && (
                <button onClick={() => set({ assuntoEditado: false })} className="text-xs text-[#4F7CFF] inline-flex items-center gap-1"><RotateCcw size={11} /> Voltar ao automático</button>
              )}
            </div>
            <input className="field" value={assunto} onChange={e => set({ assunto: e.target.value, assuntoEditado: true })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-[#374151]">Mensagem</label>
              {f.mensagemEditada && (
                <button onClick={() => set({ mensagemEditada: false })} className="text-xs text-[#4F7CFF] inline-flex items-center gap-1"><RotateCcw size={11} /> Voltar ao automático</button>
              )}
            </div>
            <textarea className="field min-h-[150px]" value={mensagem} onChange={e => set({ mensagem: e.target.value, mensagemEditada: true })} />
            <p className="text-xs text-[#94A3B8] mt-1">As tabelas abaixo entram logo depois da mensagem, seguidas da sua assinatura. A planilha Excel vai em anexo.</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#64748B] mb-1.5">Como as tabelas vão no e-mail</p>
            <div className="border border-[#E2E8F0] rounded-xl p-3 overflow-x-auto bg-[#FCFDFE]" dangerouslySetInnerHTML={{ __html: htmlTabelas(dados) }} />
          </div>
        </div>

        {pendencias.length > 0 && (
          <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
            <p className="font-semibold flex items-center gap-1.5 mb-1"><AlertTriangle size={15} /> Para enviar, falta:</p>
            <ul className="list-disc pl-5 space-y-0.5">{pendencias.map(p => <li key={p}>{p}</li>)}</ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            {id && (
              <button onClick={excluir} className="text-xs text-[#94A3B8] hover:text-[#EF4444] inline-flex items-center gap-1 px-2 py-2">
                <Trash2 size={13} /> Excluir solicitação
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={baixarExcel} disabled={!f.funcionarios.length && !f.veiculos.length} className="btn-secondary disabled:opacity-50">
              <Download size={15} /> Baixar Excel
            </button>
            <button onClick={salvarRascunho} disabled={!!salvando} className="btn-secondary disabled:opacity-50">
              {salvando === 'salvar' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar
            </button>
            <button onClick={enviar} disabled={!!salvando || pendencias.length > 0} className="btn-primary">
              {salvando === 'enviar' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {registro?.status === 'enviada' ? 'Salvar e enviar de novo' : 'Salvar e enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Lista de e-mails em "chips": digite e aperte Enter, vírgula ou saia do campo.
function CampoEmails({ rotulo, valores, onChange }: { rotulo: string; valores: string[]; onChange: (v: string[]) => void }) {
  const [texto, setTexto] = useState('')
  const [invalido, setInvalido] = useState(false)
  function confirmar() {
    if (!texto.trim()) return
    const novos = extrairEmails(texto)
    if (!novos.length) { setInvalido(true); return }
    const atuais = new Set(valores.map(v => v.toLowerCase()))
    onChange([...valores, ...novos.filter(n => !atuais.has(n.toLowerCase()))])
    setTexto(''); setInvalido(false)
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') { e.preventDefault(); confirmar() }
    if (e.key === 'Backspace' && !texto && valores.length) onChange(valores.slice(0, -1))
  }
  return (
    <div>
      <label className="block text-sm font-medium text-[#374151] mb-1.5">{rotulo}</label>
      <div className={`flex flex-wrap items-center gap-1.5 min-h-11 px-2 py-1.5 border rounded-lg bg-white focus-within:border-[#4F7CFF] ${invalido ? 'border-[#FCA5A5]' : 'border-[#E2E8F0]'}`}>
        {valores.map(v => (
          <span key={v} className="inline-flex items-center gap-1 text-xs bg-[#F1F5F9] text-[#0F172A] rounded-full pl-3 pr-1 py-1">
            {v}
            <button onClick={() => onChange(valores.filter(x => x !== v))} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-[#E2E8F0]" aria-label={`Tirar ${v}`}>
              <X size={11} />
            </button>
          </span>
        ))}
        <input list="emails-clientes" value={texto} onChange={e => { setTexto(e.target.value); setInvalido(false) }} onKeyDown={onKey} onBlur={confirmar}
          className="flex-1 min-w-[180px] text-base sm:text-sm outline-none bg-transparent py-1" placeholder={valores.length ? '' : 'Digite o e-mail ou escolha um contato'} />
      </div>
      {invalido && <p className="text-xs text-[#EF4444] mt-1">E-mail inválido.</p>}
    </div>
  )
}

function CampoMotorista({ onAdd }: { onAdd: (nome: string) => void }) {
  const [texto, setTexto] = useState('')
  const confirmar = () => { if (texto.trim()) { onAdd(texto); setTexto('') } }
  return (
    <span className="inline-flex items-center gap-1">
      <input list="motoristas-sugestoes" value={texto} onChange={e => setTexto(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmar() } }}
        className="text-sm border border-[#E2E8F0] rounded-lg px-2 py-1.5 w-52 focus:outline-none focus:border-[#4F7CFF]" placeholder="Nome do motorista" />
      <button onClick={confirmar} disabled={!texto.trim()} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#EEF2FF] text-[#4F7CFF] disabled:opacity-40" aria-label="Incluir motorista">
        <Plus size={14} />
      </button>
    </span>
  )
}

export default function LiberacaoPage() {
  return <Suspense><EditorLiberacao /></Suspense>
}
