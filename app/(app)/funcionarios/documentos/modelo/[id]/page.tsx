'use client'

// Cadastro e edição de modelo de documento. Editar um modelo que já foi emitido
// cria uma nova versão (a anterior fica guardada no histórico); enquanto a versão
// não foi emitida para ninguém, a edição fica nela mesma.

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Save, Upload, Plus, Trash2, Eye, EyeOff, History, AlertTriangle, Send, Wand2 } from 'lucide-react'
import Topbar from '@/components/Topbar'
import RichTextEditor from '@/components/RichTextEditor'
import { createClient } from '@/lib/supabase/client'
import { useAccess } from '@/lib/useAccess'
import { formatarData, hojeLocal } from '@/lib/datas'
import { mensagemErro } from '@/lib/erros'
import {
  CAMPOS_SISTEMA, CSS_DOCUMENTO, EMPRESA_DOCS_PADRAO, camposDesconhecidos, htmlListaRecebimento, preencher,
  proximaVersao, valoresFuncionario, valoresGerais, type CampoExtra, type DadosEmpresa, type DocModelo, type FuncionarioDoc,
} from '@/lib/documentosFuncionario'

// Colchetes comuns nos modelos em Word → campos automáticos
const COLCHETES_CONHECIDOS: Record<string, string> = {
  'NOME DO FUNCIONÁRIO': 'funcionario.nome', 'NOME DO FUNCIONARIO': 'funcionario.nome', 'NOME': 'funcionario.nome', 'FUNCIONÁRIO': 'funcionario.nome',
  'CPF': 'funcionario.cpf', 'CARGO': 'funcionario.cargo', 'FUNÇÃO': 'funcionario.funcao', 'FUNCAO': 'funcionario.funcao',
  'DATA DE ADMISSÃO': 'funcionario.data_admissao', 'DATA': 'data_emissao', 'DD/MM/AAAA': 'data_emissao',
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'campo'

// Texto entre colchetes que sobrou no modelo (ex.: "[HH:MM]")
function colchetesNoTexto(html: string): string[] {
  const texto = html.replace(/<[^>]+>/g, ' ')
  return Array.from(new Set(Array.from(texto.matchAll(/\[([^\[\]]{1,40})\]/g), m => m[1].trim())))
}

const VAZIO = { nome: '', versao: '1.0', vigencia: hojeLocal(), exige_assinatura: true, coletivo: false, conteudo_html: '', campos_extras: [] as CampoExtra[], arquivo_origem: null as string | null }

export default function ModeloDocumentoPage() {
  const { id } = useParams<{ id: string }>()
  const novo = id === 'novo'
  const router = useRouter()
  const { isAdmin, loading: accessLoading, profile } = useAccess()
  const [form, setForm] = useState(VAZIO)
  const [original, setOriginal] = useState<DocModelo | null>(null)
  const [versoes, setVersoes] = useState<(DocModelo & { emitidos: number })[]>([])
  const [emitidosDestaVersao, setEmitidosDestaVersao] = useState(0)
  const [empresa, setEmpresa] = useState<DadosEmpresa>(EMPRESA_DOCS_PADRAO)
  const [exemplo, setExemplo] = useState<FuncionarioDoc>({ id: '', nome: 'Fulano de Tal', cpf: '000.000.000-00', cargo: 'Técnico', funcao: null })
  const [loading, setLoading] = useState(!novo)
  const [salvando, setSalvando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [erro, setErro] = useState('')
  const [preview, setPreview] = useState(false)
  const [versaoAberta, setVersaoAberta] = useState<DocModelo | null>(null)
  const insertRef = useRef<((text: string) => void) | null>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!accessLoading && !isAdmin) router.replace('/obras')
  }, [isAdmin, accessLoading, router])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: dadosEmpresa }, { data: func }] = await Promise.all([
        supabase.from('configuracoes_empresa').select('valor').eq('chave', 'dados_empresa').maybeSingle(),
        supabase.from('funcionarios').select('id, nome, cpf, cargo, funcao, data_admissao').eq('ativo', true).not('cpf', 'is', null).order('nome').limit(1).maybeSingle(),
      ])
      if (dadosEmpresa?.valor) setEmpresa(e => ({ ...e, ...(dadosEmpresa.valor as object) }))
      if (func) setExemplo(func as FuncionarioDoc)
      if (novo) return

      const { data: m, error } = await supabase.from('doc_modelos').select('*').eq('id', id).single()
      if (error || !m) { setErro(mensagemErro(error, 'Modelo não encontrado')); setLoading(false); return }
      const modelo = m as DocModelo
      setOriginal(modelo)
      setForm({
        nome: modelo.nome, versao: modelo.versao, vigencia: modelo.vigencia ?? hojeLocal(),
        exige_assinatura: modelo.exige_assinatura, coletivo: modelo.coletivo, conteudo_html: modelo.conteudo_html,
        campos_extras: modelo.campos_extras ?? [], arquivo_origem: modelo.arquivo_origem,
      })
      const [{ data: vers }, { data: emit }] = await Promise.all([
        supabase.from('doc_modelos').select('*').eq('grupo_id', modelo.grupo_id).order('created_at', { ascending: false }),
        supabase.from('doc_emitidos').select('modelo_id, modelo:modelo_id!inner(grupo_id)').eq('modelo.grupo_id', modelo.grupo_id),
      ])
      const cont: Record<string, number> = {}
      for (const e of (emit ?? []) as { modelo_id: string }[]) cont[e.modelo_id] = (cont[e.modelo_id] ?? 0) + 1
      setVersoes(((vers ?? []) as DocModelo[]).map(v => ({ ...v, emitidos: cont[v.id] ?? 0 })))
      setEmitidosDestaVersao(cont[modelo.id] ?? 0)
      // Edição de versão já emitida → já sugere a próxima versão
      if ((cont[modelo.id] ?? 0) > 0) setForm(f => ({ ...f, versao: proximaVersao(modelo.versao), vigencia: hojeLocal() }))
      setLoading(false)
    }
    load()
  }, [id, novo])

  const somenteLeitura = !!original && !original.atual
  const criaNovaVersao = !!original && emitidosDestaVersao > 0
  const desconhecidos = useMemo(() => camposDesconhecidos(form.conteudo_html, form.campos_extras), [form.conteudo_html, form.campos_extras])
  const colchetes = useMemo(() => colchetesNoTexto(form.conteudo_html), [form.conteudo_html])

  const htmlPreview = useMemo(() => {
    const extras = Object.fromEntries(form.campos_extras.map(c => [c.chave, c.padrao]))
    const valores = { ...valoresGerais(form, empresa, hojeLocal(), extras), ...(form.coletivo ? {} : valoresFuncionario(exemplo)) }
    return preencher(form.conteudo_html, valores, form.coletivo ? htmlListaRecebimento([exemplo, { nome: '' }, { nome: '' }]) : undefined)
  }, [form, empresa, exemplo])

  function set<K extends keyof typeof VAZIO>(k: K, v: (typeof VAZIO)[K]) { setForm(f => ({ ...f, [k]: v })) }

  function setCampo(i: number, patch: Partial<CampoExtra>) {
    setForm(f => ({ ...f, campos_extras: f.campos_extras.map((c, j) => j === i ? { ...c, ...patch } : c) }))
  }

  // Troca "[TEXTO]" por um campo: automático se for conhecido, senão vira campo editável do modelo
  function converterColchete(texto: string) {
    const conhecido = COLCHETES_CONHECIDOS[texto.toUpperCase()]
    let chave = conhecido
    let extras = form.campos_extras
    if (!conhecido) {
      let base = slug(texto)
      while (extras.some(c => c.chave === base)) base += '_2'
      extras = [...extras, { chave: base, rotulo: texto, padrao: '' }]
      chave = `campo.${base}`
    }
    const re = new RegExp(`\\[\\s*${texto.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\s*\\]`, 'g')
    setForm(f => ({ ...f, campos_extras: extras, conteudo_html: f.conteudo_html.replace(re, `{{${chave}}}`) }))
  }

  async function importarDocx(file: File) {
    setImportando(true)
    setErro('')
    try {
      const mammoth = await import('mammoth')
      const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
      setForm(f => ({ ...f, conteudo_html: value, arquivo_origem: file.name, nome: f.nome || file.name.replace(/\.docx$/i, '') }))
    } catch (e) {
      setErro(mensagemErro(e as Error, 'Não foi possível ler o arquivo Word'))
    } finally {
      setImportando(false)
      if (arquivoRef.current) arquivoRef.current.value = ''
    }
  }

  async function salvar() {
    setErro('')
    if (!form.nome.trim() || !form.versao.trim()) { setErro('Preencha o nome e a versão do modelo.'); return }
    if (!form.conteudo_html.replace(/<[^>]+>/g, '').trim()) { setErro('O texto do modelo está vazio.'); return }
    const chaves = form.campos_extras.map(c => c.chave.trim())
    if (chaves.some(c => !/^[a-z0-9_]+$/.test(c))) { setErro('A chave dos campos editáveis só pode ter letras minúsculas sem acento, números e _.'); return }
    if (new Set(chaves).size !== chaves.length) { setErro('Há dois campos editáveis com a mesma chave.'); return }
    if (criaNovaVersao && versoes.some(v => v.versao === form.versao.trim())) { setErro(`A versão ${form.versao} já existe. Informe uma versão nova (ex.: ${proximaVersao(original!.versao)}).`); return }

    setSalvando(true)
    const supabase = createClient()
    const dados = {
      nome: form.nome.trim(), versao: form.versao.trim(), vigencia: form.vigencia || null,
      exige_assinatura: form.exige_assinatura, coletivo: form.coletivo, conteudo_html: form.conteudo_html,
      campos_extras: form.campos_extras.map(c => ({ chave: c.chave.trim(), rotulo: c.rotulo.trim() || c.chave, padrao: c.padrao })),
      arquivo_origem: form.arquivo_origem,
    }
    const autor = profile?.nome || profile?.email || null

    if (!original) {
      const { data, error } = await supabase.from('doc_modelos')
        .insert({ ...dados, grupo_id: crypto.randomUUID(), criado_por_nome: autor }).select('id').single()
      setSalvando(false)
      if (error) { setErro(mensagemErro(error, 'Erro ao salvar o modelo')); return }
      router.replace(`/funcionarios/documentos/modelo/${data.id}`)
      return
    }

    if (!criaNovaVersao) {
      const { error } = await supabase.from('doc_modelos').update(dados).eq('id', original.id)
      setSalvando(false)
      if (error) { setErro(mensagemErro(error, 'Erro ao salvar o modelo')); return }
      router.push('/funcionarios/documentos')
      return
    }

    // Nova versão: desmarca a atual (índice único "uma atual por grupo") e insere a nova
    const { error: e1 } = await supabase.from('doc_modelos').update({ atual: false }).eq('id', original.id)
    if (e1) { setSalvando(false); setErro(mensagemErro(e1, 'Erro ao criar a nova versão')); return }
    const { data, error: e2 } = await supabase.from('doc_modelos')
      .insert({ ...dados, grupo_id: original.grupo_id, ativo: original.ativo, criado_por_nome: autor }).select('id').single()
    if (e2) {
      await supabase.from('doc_modelos').update({ atual: true }).eq('id', original.id)
      setSalvando(false)
      setErro(mensagemErro(e2, 'Erro ao criar a nova versão'))
      return
    }
    setSalvando(false)
    router.replace(`/funcionarios/documentos/modelo/${data.id}`)
  }

  async function alternarAtivo() {
    if (!original) return
    const { error } = await createClient().from('doc_modelos').update({ ativo: !original.ativo }).eq('id', original.id)
    if (error) { setErro(mensagemErro(error, 'Erro ao alterar o modelo')); return }
    setOriginal({ ...original, ativo: !original.ativo })
  }

  if (loading) return <div><Topbar /><div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#4F7CFF]" /></div></div>

  const grupos = ['Funcionário', 'Empresa', 'Documento'] as const

  return (
    <div>
      <Topbar />
      <style>{CSS_DOCUMENTO}</style>
      <div className="p-4 md:p-6 max-w-6xl">
        <Link href="/funcionarios/documentos" className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A] mb-3">
          <ArrowLeft size={15} /> Documentos dos funcionários
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h1 className="font-syne text-xl md:text-2xl font-bold text-[#0F172A]">
            {novo ? 'Novo modelo' : somenteLeitura ? `${original?.nome} — versão ${original?.versao} (antiga)` : 'Editar modelo'}
          </h1>
          {!somenteLeitura && (
            <div className="flex items-center gap-2">
              {original && (
                <>
                  <button onClick={alternarAtivo} className="text-sm px-3 py-2 rounded-xl border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]">
                    {original.ativo ? 'Inativar' : 'Reativar'}
                  </button>
                  <Link href={`/funcionarios/documentos/emitir?modelo=${original.id}`}
                    className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]">
                    <Send size={14} /> Emitir
                  </Link>
                </>
              )}
              <button onClick={salvar} disabled={salvando} className="btn-primary flex items-center gap-2 text-sm">
                {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {criaNovaVersao ? `Salvar versão ${form.versao}` : 'Salvar'}
              </button>
            </div>
          )}
        </div>

        {somenteLeitura && (
          <p className="text-sm bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] rounded-xl px-3 py-2 mb-4">
            Esta é uma versão antiga, guardada só para consulta. <Link className="underline" href={`/funcionarios/documentos/modelo/${versoes.find(v => v.atual)?.id ?? ''}`}>Abrir a versão atual</Link>
          </p>
        )}
        {criaNovaVersao && !somenteLeitura && (
          <p className="text-sm bg-[#EEF2FF] border border-[#C7D2FE] text-[#3730A3] rounded-xl px-3 py-2 mb-4">
            A versão {original?.versao} já foi emitida para {emitidosDestaVersao} funcionário(s). Ao salvar, cria-se a versão {form.versao} e a {original?.versao} fica guardada no histórico.
          </p>
        )}
        {erro && <p className="text-sm text-[#EF4444] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3 py-2 mb-4">{erro}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
          <div className="space-y-4 min-w-0">
            <div className="card space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_160px] gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome do modelo</label>
                  <input className="field" disabled={somenteLeitura} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex.: Termo de Ciência da Política" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Versão</label>
                  <input className="field" disabled={somenteLeitura} value={form.versao} onChange={e => set('versao', e.target.value)} placeholder="1.0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Vigência</label>
                  <input type="date" className="field" disabled={somenteLeitura} value={form.vigencia} onChange={e => set('vigencia', e.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <label className="flex items-center gap-2 text-sm text-[#374151]">
                  <input type="checkbox" disabled={somenteLeitura} checked={form.exige_assinatura} onChange={e => set('exige_assinatura', e.target.checked)} />
                  Exige assinatura do funcionário
                </label>
                <label className="flex items-center gap-2 text-sm text-[#374151]">
                  <input type="checkbox" disabled={somenteLeitura} checked={form.coletivo} onChange={e => set('coletivo', e.target.checked)} />
                  Coletivo (um documento só, com lista de recebimento)
                </label>
              </div>
              {form.coletivo && !form.conteudo_html.includes('{{lista_recebimento}}') && (
                <p className="text-xs text-[#B45309]">Documento coletivo: insira o campo “Lista de recebimento” onde a tabela deve aparecer. Sem ele, a lista sai no fim do documento.</p>
              )}
            </div>

            <div className="card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-syne font-semibold text-[#0F172A]">Texto do documento</h2>
                <div className="flex items-center gap-2">
                  {!somenteLeitura && (
                    <>
                      <input ref={arquivoRef} type="file" accept=".docx" className="hidden" onChange={e => e.target.files?.[0] && importarDocx(e.target.files[0])} />
                      <button onClick={() => arquivoRef.current?.click()} disabled={importando}
                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]">
                        {importando ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Importar Word (.docx)
                      </button>
                    </>
                  )}
                  <button onClick={() => setPreview(p => !p)}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]">
                    {preview ? <EyeOff size={13} /> : <Eye size={13} />} {preview ? 'Editar texto' : 'Pré-visualizar'}
                  </button>
                </div>
              </div>
              {form.arquivo_origem && <p className="text-xs text-[#94A3B8]">Importado de {form.arquivo_origem}</p>}

              {colchetes.length > 0 && !somenteLeitura && (
                <div className="text-xs bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-3 py-2 space-y-1.5">
                  <p className="text-[#92400E] flex items-center gap-1.5"><Wand2 size={13} /> Campos entre colchetes ainda não trocados. Clique para transformar em campo (os que não vêm do cadastro viram campo editável):</p>
                  <div className="flex flex-wrap gap-1.5">
                    {colchetes.map(c => (
                      <button key={c} onClick={() => converterColchete(c)} className="px-2 py-1 rounded-md bg-white border border-[#FDE68A] text-[#92400E] hover:bg-[#FEF3C7]">
                        [{c}] → {COLCHETES_CONHECIDOS[c.toUpperCase()] ? CAMPOS_SISTEMA.find(s => s.chave === COLCHETES_CONHECIDOS[c.toUpperCase()])?.rotulo : 'campo editável'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {desconhecidos.length > 0 && (
                <p className="text-xs text-[#EF4444] flex items-center gap-1.5"><AlertTriangle size={13} /> Campos que o sistema não conhece (vão sair em branco): {desconhecidos.map(d => `{{${d}}}`).join(', ')}</p>
              )}

              {preview || somenteLeitura ? (
                <div className="border border-[#E2E8F0] rounded-xl bg-white p-6">
                  {!form.coletivo && <p className="text-xs text-[#94A3B8] mb-3">Exemplo com o cadastro de {exemplo.nome}</p>}
                  <div className="doc-funcionario max-w-[720px] mx-auto" dangerouslySetInnerHTML={{ __html: htmlPreview }} />
                </div>
              ) : (
                <RichTextEditor completo minHeight="420px" value={form.conteudo_html} onChange={v => set('conteudo_html', v)} insertRef={insertRef} placeholder="Escreva o texto ou importe um arquivo Word" />
              )}
            </div>

            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-syne font-semibold text-[#0F172A]">Campos editáveis</h2>
                  <p className="text-xs text-[#64748B] mt-0.5">Dados que não vêm do cadastro (ex.: horário do almoço). O valor padrão pode ser trocado na hora de emitir.</p>
                </div>
                {!somenteLeitura && (
                  <button onClick={() => set('campos_extras', [...form.campos_extras, { chave: `campo_${form.campos_extras.length + 1}`, rotulo: '', padrao: '' }])}
                    className="flex items-center gap-1 text-xs text-[#4F7CFF] font-medium shrink-0"><Plus size={13} /> Adicionar</button>
                )}
              </div>
              {form.campos_extras.length === 0 && <p className="text-xs text-[#94A3B8]">Nenhum campo editável.</p>}
              {form.campos_extras.map((c, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_160px_140px_auto] gap-2 items-center">
                  <input className="field" disabled={somenteLeitura} value={c.rotulo} onChange={e => setCampo(i, { rotulo: e.target.value })} placeholder="Nome do campo (ex.: Início do almoço)" />
                  <input className="field font-mono text-xs" disabled={somenteLeitura} value={c.chave} onChange={e => setCampo(i, { chave: e.target.value })} placeholder="chave" title="Entra no texto como {{campo.chave}}" />
                  <input className="field" disabled={somenteLeitura} value={c.padrao} onChange={e => setCampo(i, { padrao: e.target.value })} placeholder="Valor padrão" />
                  {!somenteLeitura && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => insertRef.current?.(`{{campo.${c.chave}}}`)} disabled={preview} className="text-xs px-2 py-1.5 rounded-lg bg-[#EEF2FF] text-[#4F7CFF] disabled:opacity-40">Inserir</button>
                      <button onClick={() => set('campos_extras', form.campos_extras.filter((_, j) => j !== i))} className="p-1.5 text-[#94A3B8] hover:text-[#EF4444]"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {!somenteLeitura && (
              <div className="card lg:sticky lg:top-4">
                <h2 className="font-syne font-semibold text-[#0F172A] text-sm">Campos automáticos</h2>
                <p className="text-xs text-[#64748B] mt-0.5 mb-3">Clique para inserir onde está o cursor do texto.</p>
                {grupos.map(g => (
                  <div key={g} className="mb-3">
                    <p className="text-[11px] uppercase tracking-wide text-[#94A3B8] mb-1.5">{g}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {CAMPOS_SISTEMA.filter(c => c.grupo === g).map(c => (
                        <button key={c.chave} disabled={preview} onClick={() => insertRef.current?.(`{{${c.chave}}}`)} title={`{{${c.chave}}}`}
                          className="text-xs px-2 py-1 rounded-md bg-[#F1F5F9] text-[#374151] hover:bg-[#E2E8F0] disabled:opacity-40">{c.rotulo}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {versoes.length > 0 && (
              <div className="card">
                <h2 className="font-syne font-semibold text-[#0F172A] text-sm flex items-center gap-1.5 mb-2"><History size={14} /> Versões</h2>
                <div className="space-y-1.5">
                  {versoes.map(v => (
                    <div key={v.id} className={`text-xs rounded-lg px-2.5 py-2 ${v.id === original?.id ? 'bg-[#EEF2FF]' : 'bg-[#F8FAFC]'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#0F172A]">v{v.versao} {v.atual && <span className="text-[#10B981] font-normal">· atual</span>}</span>
                        {v.id !== original?.id && (
                          <button onClick={() => setVersaoAberta(v)} className="text-[#4F7CFF]">Ver</button>
                        )}
                      </div>
                      <p className="text-[#64748B] mt-0.5">
                        {v.vigencia ? `Vigência ${formatarData(v.vigencia)} · ` : ''}{v.emitidos} emitido(s)
                        {v.criado_por_nome ? ` · ${v.criado_por_nome}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {versaoAberta && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setVersaoAberta(null)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-syne font-semibold text-[#0F172A]">{versaoAberta.nome} — v{versaoAberta.versao}</h3>
              <button onClick={() => setVersaoAberta(null)} className="text-sm text-[#64748B]">Fechar</button>
            </div>
            <div className="doc-funcionario" dangerouslySetInnerHTML={{ __html: versaoAberta.conteudo_html }} />
          </div>
        </div>
      )}
    </div>
  )
}
