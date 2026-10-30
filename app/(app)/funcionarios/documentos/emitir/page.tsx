'use client'

// Emissão: modelo → funcionários → data/campos → gerar. Cada funcionário recebe uma
// cópia preenchida (guardada em doc_emitidos) e a impressão sai uma página por pessoa.

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, AlertTriangle, Search, FileText, Users } from 'lucide-react'
import Topbar from '@/components/Topbar'
import { createClient } from '@/lib/supabase/client'
import { useAccess } from '@/lib/useAccess'
import { hojeLocal } from '@/lib/datas'
import { mensagemErro } from '@/lib/erros'
import {
  CAMPO_LISTA_RECEBIMENTO, EMPRESA_DOCS_PADRAO, camposUsados, htmlListaRecebimento, pendenciasCadastro, preencher,
  statusInicial, valoresFuncionario, valoresGerais, type DadosEmpresa, type DocModelo, type FuncionarioDoc,
} from '@/lib/documentosFuncionario'

function EmitirDocumento() {
  const router = useRouter()
  const params = useSearchParams()
  const { isAdmin, loading: accessLoading, profile } = useAccess()
  const [modelos, setModelos] = useState<DocModelo[]>([])
  const [funcionarios, setFuncionarios] = useState<FuncionarioDoc[]>([])
  const [empresa, setEmpresa] = useState<DadosEmpresa>(EMPRESA_DOCS_PADRAO)
  const [modeloId, setModeloId] = useState(params.get('modelo') ?? '')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set((params.get('funcionarios') ?? '').split(',').filter(Boolean)))
  const [busca, setBusca] = useState('')
  const [data, setData] = useState(hojeLocal())
  const [extras, setExtras] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmarFaltas, setConfirmarFaltas] = useState(false)

  useEffect(() => {
    if (!accessLoading && !isAdmin) router.replace('/obras')
  }, [isAdmin, accessLoading, router])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: mods, error }, { data: funcs }, { data: dadosEmpresa }] = await Promise.all([
        supabase.from('doc_modelos').select('*').eq('atual', true).eq('ativo', true).order('nome'),
        supabase.from('funcionarios').select('id, nome, cpf, cargo, funcao, telefone, email, data_admissao').eq('ativo', true).order('nome'),
        supabase.from('configuracoes_empresa').select('valor').eq('chave', 'dados_empresa').maybeSingle(),
      ])
      if (error) setErro(mensagemErro(error, 'Erro ao carregar os modelos'))
      setModelos((mods ?? []) as DocModelo[])
      setFuncionarios((funcs ?? []) as FuncionarioDoc[])
      if (dadosEmpresa?.valor) setEmpresa(e => ({ ...e, ...(dadosEmpresa.valor as object) }))
      setLoading(false)
    }
    load()
  }, [])

  const modelo = modelos.find(m => m.id === modeloId) ?? null

  // Troca de modelo → valores padrão dos campos editáveis
  useEffect(() => {
    setExtras(Object.fromEntries((modelo?.campos_extras ?? []).map(c => [c.chave, c.padrao])))
    setConfirmarFaltas(false)
  }, [modelo])

  const escolhidos = funcionarios.filter(f => selecionados.has(f.id))
  const filtrados = funcionarios.filter(f => !busca || f.nome.toLowerCase().includes(busca.toLowerCase()))
  const faltasCadastro = useMemo(() => modelo && !modelo.coletivo ? pendenciasCadastro(modelo.conteudo_html, escolhidos) : [], [modelo, escolhidos])
  const usados = useMemo(() => new Set(modelo ? camposUsados(modelo.conteudo_html) : []), [modelo])
  const extrasVazios = (modelo?.campos_extras ?? []).filter(c => usados.has(`campo.${c.chave}`) && !extras[c.chave]?.trim())
  const temFaltas = faltasCadastro.length > 0 || extrasVazios.length > 0

  function alternar(id: string) {
    setSelecionados(s => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
    setConfirmarFaltas(false)
  }

  function todos() {
    const ids = filtrados.map(f => f.id)
    const marcarTodos = ids.some(id => !selecionados.has(id))
    setSelecionados(s => { const n = new Set(s); ids.forEach(id => marcarTodos ? n.add(id) : n.delete(id)); return n })
    setConfirmarFaltas(false)
  }

  async function gerar() {
    if (!modelo || escolhidos.length === 0) return
    if (temFaltas && !confirmarFaltas) { setConfirmarFaltas(true); return }
    setGerando(true)
    setErro('')
    const supabase = createClient()
    const { data: emissao, error } = await supabase.from('doc_emissoes').insert({
      modelo_id: modelo.id, data_emissao: data, valores_extras: extras, emitido_por_nome: profile?.nome || profile?.email || null,
    }).select('id').single()
    if (error || !emissao) { setGerando(false); setErro(mensagemErro(error, 'Erro ao emitir')); return }

    const gerais = valoresGerais(modelo, empresa, data, extras)
    let htmlColetivo = ''
    if (modelo.coletivo) {
      const lista = htmlListaRecebimento(escolhidos)
      const texto = modelo.conteudo_html.includes(`{{${CAMPO_LISTA_RECEBIMENTO}}}`) ? modelo.conteudo_html : modelo.conteudo_html + `<h2>Lista de recebimento</h2><p>{{${CAMPO_LISTA_RECEBIMENTO}}}</p>`
      htmlColetivo = preencher(texto, gerais, lista)
    }
    const linhas = escolhidos.map(f => ({
      emissao_id: emissao.id,
      modelo_id: modelo.id,
      funcionario_id: f.id,
      conteudo_html: modelo.coletivo ? htmlColetivo : preencher(modelo.conteudo_html, { ...gerais, ...valoresFuncionario(f) }),
      status: statusInicial(modelo),
    }))
    const { error: e2 } = await supabase.from('doc_emitidos').insert(linhas)
    if (e2) {
      await supabase.from('doc_emissoes').delete().eq('id', emissao.id)
      setGerando(false)
      setErro(mensagemErro(e2, 'Erro ao salvar os documentos emitidos'))
      return
    }
    router.push(`/print/documento/${emissao.id}`)
  }

  if (loading) return <div><Topbar /><div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#4F7CFF]" /></div></div>

  return (
    <div>
      <Topbar />
      <div className="p-4 md:p-6 pb-28 max-w-4xl space-y-4">
        <Link href="/funcionarios/documentos" className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A]">
          <ArrowLeft size={15} /> Documentos dos funcionários
        </Link>
        <h1 className="font-syne text-xl md:text-2xl font-bold text-[#0F172A]">Emitir documento</h1>
        {erro && <p className="text-sm text-[#EF4444] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3 py-2">{erro}</p>}

        {/* 1. Modelo */}
        <div className="card">
          <h2 className="font-syne font-semibold text-[#0F172A] text-sm mb-3">1. Modelo</h2>
          <select className="field" value={modeloId} onChange={e => setModeloId(e.target.value)}>
            <option value="">Escolha o modelo…</option>
            {modelos.map(m => <option key={m.id} value={m.id}>{m.nome} — v{m.versao}</option>)}
          </select>
          {modelo && (
            <p className="text-xs text-[#64748B] mt-2 flex items-center gap-1.5">
              {modelo.coletivo ? <><Users size={12} /> Coletivo: sai um documento só, com a lista de recebimento dos selecionados.</> : <><FileText size={12} /> Uma página por funcionário.</>}
              {modelo.exige_assinatura && ' Fica pendente de assinatura na pasta de cada um.'}
            </p>
          )}
        </div>

        {/* 2. Funcionários */}
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="font-syne font-semibold text-[#0F172A] text-sm">2. Funcionários <span className="text-[#64748B] font-normal">({escolhidos.length} selecionado{escolhidos.length === 1 ? '' : 's'})</span></h2>
            <button onClick={todos} className="text-xs text-[#4F7CFF] font-medium">
              {filtrados.every(f => selecionados.has(f.id)) && filtrados.length > 0 ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
          </div>
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input className="field pl-8" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar funcionário" />
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-[#F1F5F9] border border-[#F1F5F9] rounded-xl">
            {filtrados.map(f => {
              const faltas = faltasCadastro.find(p => p.funcionario.id === f.id)?.faltando
              return (
                <label key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-[#F8FAFC]">
                  <input type="checkbox" checked={selecionados.has(f.id)} onChange={() => alternar(f.id)} />
                  <span className="flex-1 min-w-0 truncate text-[#0F172A]">{f.nome}</span>
                  <span className="text-xs text-[#94A3B8] truncate hidden sm:inline">{f.cargo || f.funcao || 'sem cargo'} · {f.cpf || 'sem CPF'}</span>
                  {faltas && <AlertTriangle size={14} className="text-[#F59E0B] shrink-0" />}
                </label>
              )
            })}
            {filtrados.length === 0 && <p className="text-xs text-[#94A3B8] px-3 py-4 text-center">Nenhum funcionário ativo encontrado.</p>}
          </div>
        </div>

        {/* 3. Data e campos */}
        <div className="card space-y-3">
          <h2 className="font-syne font-semibold text-[#0F172A] text-sm">3. Data e campos do documento</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Data de emissão</label>
              <input type="date" className="field" value={data} onChange={e => setData(e.target.value)} />
            </div>
            {(modelo?.campos_extras ?? []).filter(c => usados.has(`campo.${c.chave}`)).map(c => (
              <div key={c.chave}>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">{c.rotulo}</label>
                <input className="field" value={extras[c.chave] ?? ''} onChange={e => { setExtras(x => ({ ...x, [c.chave]: e.target.value })); setConfirmarFaltas(false) }} />
              </div>
            ))}
          </div>
        </div>

        {/* Avisos antes de gerar */}
        {modelo && temFaltas && escolhidos.length > 0 && (
          <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E] space-y-2">
            <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={15} /> Faltam dados. Esses campos vão sair em branco (linha para preencher à mão):</p>
            {extrasVazios.length > 0 && <p>Campos do documento: {extrasVazios.map(c => c.rotulo).join(', ')}</p>}
            {faltasCadastro.length > 0 && (
              <ul className="space-y-1">
                {faltasCadastro.map(p => (
                  <li key={p.funcionario.id} className="flex flex-wrap items-center gap-x-2">
                    <span><strong>{p.funcionario.nome}</strong>: sem {p.faltando.join(', ')}</span>
                    <Link href={`/funcionarios/${p.funcionario.id}`} target="_blank" className="text-xs underline">corrigir cadastro</Link>
                    <button onClick={() => alternar(p.funcionario.id)} className="text-xs underline">tirar da emissão</button>
                  </li>
                ))}
              </ul>
            )}
            {faltasCadastro.length > 0 && <p className="text-xs">Depois de corrigir o cadastro, recarregue esta página.</p>}
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={gerar} disabled={!modelo || escolhidos.length === 0 || gerando} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {gerando && <Loader2 size={15} className="animate-spin" />}
            {temFaltas && confirmarFaltas ? 'Gerar mesmo assim' : `Gerar ${modelo?.coletivo ? 'documento' : `${escolhidos.length || ''} documento${escolhidos.length === 1 ? '' : 's'}`}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EmitirDocumentoPage() {
  return <Suspense><EmitirDocumento /></Suspense>
}
