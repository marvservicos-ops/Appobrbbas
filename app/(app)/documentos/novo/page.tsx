'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer, Plus, Trash2, ShieldAlert, ClipboardCheck, Settings, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import AprDocument from '@/components/documentos/AprDocument'
import PtDocument from '@/components/documentos/PtDocument'
import ModalGerenciarModelosPt from '@/components/documentos/ModalGerenciarModelosPt'
import {
  DocumentoSegurancaFormData, TipoDocumentoSeguranca, RiscoItem, MembroEquipe, ModeloPt, EmpresaEmissora,
  AGENTES_FATALIDADE_GRUPOS, RISCOS_ASSOCIADOS_COL1, RISCOS_ASSOCIADOS_COL2,
  PRECAUCOES_COL1, PRECAUCOES_COL2, EPI_COL1, EPI_COL2, EPI_COL3, EMPRESAS_EMISSORAS,
  novoRiscoItem, novoMembroEquipe, criarFormDataInicial, extrairDadosModelo, normalizarDadosModelo,
} from '@/components/documentos/types'

type ListaBooleana = 'riscosAssociadosCol1' | 'riscosAssociadosCol2' | 'precaucoesCol1' | 'precaucoesCol2' | 'epiCol1' | 'epiCol2' | 'epiCol3'

function ChecklistColuna({ titulo, itens, marcados, onToggle }: { titulo?: string; itens: readonly string[]; marcados: boolean[]; onToggle: (i: number) => void }) {
  return (
    <div>
      {titulo && <p className="text-xs font-semibold text-[#64748B] mb-1">{titulo}</p>}
      <div className="space-y-0.5">
        {itens.map((item, i) => (
          <label key={i} className="flex items-center gap-2 text-xs text-[#374151] px-1.5 py-1 rounded hover:bg-[#F8FAFC] cursor-pointer">
            <input type="checkbox" checked={!!marcados[i]} onChange={() => onToggle(i)} className="w-3.5 h-3.5 accent-[#4F7CFF] shrink-0" />
            <span>{item}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

interface ObraOpcao {
  id: string
  titulo: string
  endereco?: string
  descricao?: string
  engenheiro_responsavel?: string
  cliente_id?: string | null
  gestor_id?: string | null
}

interface ClienteOpcao {
  id: string
  nome: string
  empresa_id?: string | null
}

interface FuncionarioOpcao {
  id: string
  nome: string
  cargo: string | null
}

export default function NovoDocumentoSegurancaPage() {
  const [obras, setObras] = useState<ObraOpcao[]>([])
  const [clientesMap, setClientesMap] = useState<Record<string, ClienteOpcao>>({})
  const [empresasMap, setEmpresasMap] = useState<Record<string, string>>({})
  const [funcionarios, setFuncionarios] = useState<FuncionarioOpcao[]>([])
  const [funcionariosSelecionados, setFuncionariosSelecionados] = useState<string[]>([])
  const [buscaFuncionario, setBuscaFuncionario] = useState('')
  const [modelosPt, setModelosPt] = useState<ModeloPt[]>([])
  const [modeloSelecionadoId, setModeloSelecionadoId] = useState('')
  const [nomeNovoModelo, setNomeNovoModelo] = useState('')
  const [salvandoModelo, setSalvandoModelo] = useState(false)
  const [mostrarGerenciarModelos, setMostrarGerenciarModelos] = useState(false)
  const [tipo, setTipo] = useState<TipoDocumentoSeguranca>('apr')
  const [form, setForm] = useState<DocumentoSegurancaFormData>(() => criarFormDataInicial())

  async function recarregarModelos(): Promise<ModeloPt[]> {
    const { data, error } = await createClient().from('pt_modelos').select('id,nome,dados').order('nome')
    if (error) { console.error('Erro ao carregar modelos de PT:', error); return modelosPt }
    const lista = (data as ModeloPt[] | null) || []
    setModelosPt(lista)
    return lista
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [obrasRes, clientesRes, empresasRes, funcionariosRes, modelosRes] = await Promise.all([
        supabase.from('obras').select('id,titulo,endereco,descricao,engenheiro_responsavel,cliente_id,gestor_id').order('titulo'),
        supabase.from('clientes').select('id,nome,empresa_id'),
        supabase.from('empresas').select('id,razao_social'),
        supabase.from('funcionarios').select('id,nome,cargo').eq('ativo', true).order('nome'),
        supabase.from('pt_modelos').select('id,nome,dados').order('nome'),
      ])
      if (obrasRes.error) console.error('Erro ao carregar obras:', obrasRes.error)
      if (clientesRes.error) console.error('Erro ao carregar clientes:', clientesRes.error)
      if (empresasRes.error) console.error('Erro ao carregar empresas:', empresasRes.error)
      if (funcionariosRes.error) console.error('Erro ao carregar funcionários:', funcionariosRes.error)
      if (modelosRes.error) console.error('Erro ao carregar modelos de PT:', modelosRes.error)

      if (obrasRes.data) setObras(obrasRes.data as ObraOpcao[])
      if (clientesRes.data) {
        const map: Record<string, ClienteOpcao> = {}
        ;(clientesRes.data as ClienteOpcao[]).forEach(c => { map[c.id] = c })
        setClientesMap(map)
      }
      if (empresasRes.data) {
        const map: Record<string, string> = {}
        empresasRes.data.forEach((e: { id: string; razao_social: string }) => { map[e.id] = e.razao_social })
        setEmpresasMap(map)
      }
      if (funcionariosRes.data) setFuncionarios(funcionariosRes.data as FuncionarioOpcao[])
      if (modelosRes.data) setModelosPt(modelosRes.data as ModeloPt[])
    }
    load()
  }, [])

  function atualizar<K extends keyof DocumentoSegurancaFormData>(campo: K, valor: DocumentoSegurancaFormData[K]) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  function selecionarObra(obraId: string) {
    const obra = obras.find(o => o.id === obraId)
    if (!obra) { atualizar('obraId', ''); return }
    const cliente = obra.cliente_id ? clientesMap[obra.cliente_id] : undefined
    const nomeCliente = (cliente?.empresa_id && empresasMap[cliente.empresa_id]) || cliente?.nome
    const gestor = obra.gestor_id ? clientesMap[obra.gestor_id] : undefined
    setForm(prev => ({
      ...prev,
      obraId,
      cliente: nomeCliente || prev.cliente,
      local: obra.endereco || prev.local,
      descricaoAtividades: obra.descricao || prev.descricaoAtividades,
      responsavelEmpresa: obra.engenheiro_responsavel || prev.responsavelEmpresa,
      gestorTvg: gestor?.nome || prev.gestorTvg,
    }))
  }

  function selecionarEmpresaEmissora(chave: EmpresaEmissora) {
    setForm(prev => ({ ...prev, empresaEmissora: chave, empresa: EMPRESAS_EMISSORAS[chave].razaoSocial }))
  }

  function atualizarRisco(id: string, campo: keyof RiscoItem, valor: string) {
    setForm(prev => ({
      ...prev,
      riscos: prev.riscos.map(r => r.id === id ? { ...r, [campo]: valor } : r),
    }))
  }

  function adicionarRisco() {
    setForm(prev => ({ ...prev, riscos: [...prev.riscos, novoRiscoItem()] }))
  }

  function removerRisco(id: string) {
    setForm(prev => ({ ...prev, riscos: prev.riscos.filter(r => r.id !== id) }))
  }

  function alternarAgente(grupoIdx: number, itemIdx: number) {
    setForm(prev => ({
      ...prev,
      agentesFatalidade: prev.agentesFatalidade.map((grupo, gi) => gi === grupoIdx ? grupo.map((v, ii) => ii === itemIdx ? !v : v) : grupo),
    }))
  }

  function alternarItemLista(campo: ListaBooleana, index: number) {
    setForm(prev => ({ ...prev, [campo]: prev[campo].map((v, i) => i === index ? !v : v) }))
  }

  function atualizarMembro(id: string, campo: keyof MembroEquipe, valor: string | boolean) {
    setForm(prev => ({ ...prev, equipeExecucao: prev.equipeExecucao.map(m => m.id === id ? { ...m, [campo]: valor } : m) }))
  }

  function adicionarMembro() {
    setForm(prev => ({ ...prev, equipeExecucao: [...prev.equipeExecucao, novoMembroEquipe()] }))
  }

  function removerMembro(id: string) {
    setForm(prev => ({ ...prev, equipeExecucao: prev.equipeExecucao.filter(m => m.id !== id) }))
  }

  function alternarFuncionarioSelecionado(funcionarioId: string) {
    setFuncionariosSelecionados(prev => prev.includes(funcionarioId)
      ? prev.filter(id => id !== funcionarioId)
      : [...prev, funcionarioId])
  }

  function adicionarFuncionariosSelecionados() {
    if (funcionariosSelecionados.length === 0) return
    const novosMembros: MembroEquipe[] = funcionariosSelecionados.map(id => {
      const f = funcionarios.find(fn => fn.id === id)
      return { id: crypto.randomUUID(), nome: f?.nome || '', cargo: f?.cargo || '', nr35: false, nr12: false }
    })
    setForm(prev => {
      const membrosPreenchidos = prev.equipeExecucao.filter(m => m.nome.trim() !== '' || m.cargo.trim() !== '')
      return { ...prev, equipeExecucao: [...membrosPreenchidos, ...novosMembros] }
    })
    setFuncionariosSelecionados([])
    setBuscaFuncionario('')
  }

  function aplicarModelo(modeloId: string) {
    setModeloSelecionadoId(modeloId)
    if (!modeloId) return
    const modelo = modelosPt.find(m => m.id === modeloId)
    if (!modelo) return
    const dados = normalizarDadosModelo(modelo.dados)
    setForm(prev => ({ ...prev, ...dados }))
  }

  async function salvarComoNovoModelo() {
    if (!nomeNovoModelo.trim()) return
    setSalvandoModelo(true)
    const dados = extrairDadosModelo(form)
    const { data, error } = await createClient().from('pt_modelos').insert({ nome: nomeNovoModelo.trim(), dados }).select('id,nome,dados').single()
    setSalvandoModelo(false)
    if (error) { console.error('Erro ao salvar modelo de PT:', error); return }
    setNomeNovoModelo('')
    await recarregarModelos()
    if (data) setModeloSelecionadoId(data.id)
  }

  async function atualizarModeloSelecionado() {
    if (!modeloSelecionadoId) return
    setSalvandoModelo(true)
    const dados = extrairDadosModelo(form)
    const { error } = await createClient().from('pt_modelos').update({ dados, updated_at: new Date().toISOString() }).eq('id', modeloSelecionadoId)
    setSalvandoModelo(false)
    if (error) { console.error('Erro ao atualizar modelo de PT:', error); return }
    await recarregarModelos()
  }

  return (
    <div>
      <style>{`
        #documento-preview, #documento-preview *, #documento-preview *::before, #documento-preview *::after {
          box-sizing: border-box;
        }
        @media print {
          @page { size: A4; margin: 0; }
          html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          #documento-preview { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
        }
      `}</style>

      <div className="print:hidden">
        <Topbar searchPlaceholder="Buscar..." />
      </div>

      <div className="print:hidden p-4 md:p-6 pb-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/documentos" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] transition-colors">
              <ArrowLeft size={18} className="text-[#64748B]" />
            </Link>
            <div>
              <h1 className="font-syne text-xl font-bold text-[#0F172A]">Geração de Documentos de Segurança</h1>
              <p className="text-sm text-[#64748B]">Preencha os dados e acompanhe o documento em tempo real</p>
            </div>
          </div>
          <button onClick={() => window.print()} className="btn-primary">
            <Printer size={16} /> Exportar PDF
          </button>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={() => setTipo('apr')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${tipo === 'apr' ? 'bg-[#4F7CFF] text-white' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'}`}>
            <ShieldAlert size={16} /> Análise Preliminar de Risco (APR)
          </button>
          <button
            onClick={() => setTipo('pt')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${tipo === 'pt' ? 'bg-[#4F7CFF] text-white' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'}`}>
            <ClipboardCheck size={16} /> Permissão de Trabalho (PT)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 md:p-6 print:block print:p-0 print:gap-0">
        {/* ── Formulário ─────────────────────────────── */}
        <div className="print:hidden space-y-5">
          <div className="card">
            <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Obra vinculada</label>
            <select
              value={form.obraId}
              onChange={e => selecionarObra(e.target.value)}
              className="field"
            >
              <option value="">Selecione uma obra para preencher automaticamente…</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
            </select>
          </div>

          <div className="card space-y-3">
            <h3 className="font-syne text-sm font-semibold text-[#0F172A]">Dados Gerais</h3>

            {tipo === 'pt' && (
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Nº PTS</label>
                <input className="field" value={form.numeroDocumento} onChange={e => atualizar('numeroDocumento', e.target.value)} placeholder="Ex: 0125" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Cliente</label>
                <input className="field" value={form.cliente} onChange={e => atualizar('cliente', e.target.value)} placeholder="Nome do cliente" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Empresa / Filial</label>
                <input className="field" value={form.empresa} onChange={e => atualizar('empresa', e.target.value)} placeholder="Razão social contratada" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Local</label>
              <input className="field" value={form.local} onChange={e => atualizar('local', e.target.value)} placeholder="Endereço / local da atividade" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Cidade</label>
                <input className="field" value={form.cidade} onChange={e => atualizar('cidade', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Estado</label>
                <input className="field" value={form.estado} onChange={e => atualizar('estado', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Data Início</label>
                <input type="date" className="field" value={form.dataInicio} onChange={e => atualizar('dataInicio', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Data Término</label>
                <input type="date" className="field" value={form.dataTermino} onChange={e => atualizar('dataTermino', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Horário</label>
                <input className="field" value={form.horario} onChange={e => atualizar('horario', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Responsável (empresa)</label>
                <input className="field" value={form.responsavelEmpresa} onChange={e => atualizar('responsavelEmpresa', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Responsável Terceirizado</label>
                <input className="field" value={form.responsavelTerceirizado} onChange={e => atualizar('responsavelTerceirizado', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Descrição das Atividades</label>
              <textarea className="field min-h-24" value={form.descricaoAtividades} onChange={e => atualizar('descricaoAtividades', e.target.value)} />
            </div>
          </div>

          {tipo === 'apr' && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-syne text-sm font-semibold text-[#0F172A]">Tabela de Riscos</h3>
                <button onClick={adicionarRisco} className="btn-secondary text-xs px-3 py-1.5 min-h-0">
                  <Plus size={14} /> Adicionar linha
                </button>
              </div>
              {form.riscos.map((r, idx) => (
                <div key={r.id} className="border border-[#E2E8F0] rounded-lg p-3 space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#94A3B8]">Item {idx + 1}</span>
                    {form.riscos.length > 1 && (
                      <button onClick={() => removerRisco(r.id)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-red-400">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <input className="field text-sm" placeholder="Etapa" value={r.etapa} onChange={e => atualizarRisco(r.id, 'etapa', e.target.value)} />
                  <input className="field text-sm" placeholder="Riscos" value={r.riscos} onChange={e => atualizarRisco(r.id, 'riscos', e.target.value)} />
                  <input className="field text-sm" placeholder="Causas / Motivos" value={r.causas} onChange={e => atualizarRisco(r.id, 'causas', e.target.value)} />
                  <select className="field text-sm" value={r.classificacaoRisco} onChange={e => atualizarRisco(r.id, 'classificacaoRisco', e.target.value)}>
                    <option value="">Classificação de risco…</option>
                    <option value="Baixo">Baixo</option>
                    <option value="Médio">Médio</option>
                    <option value="Alto">Alto</option>
                  </select>
                  <textarea className="field text-sm min-h-16" placeholder="Recomendações" value={r.recomendacoes} onChange={e => atualizarRisco(r.id, 'recomendacoes', e.target.value)} />
                </div>
              ))}
            </div>
          )}

          {tipo === 'apr' && (
            <div className="card">
              <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Observações</label>
              <textarea className="field min-h-24" value={form.observacoes} onChange={e => atualizar('observacoes', e.target.value)} />
            </div>
          )}

          {tipo === 'pt' && (
            <div className="card space-y-2">
              <h3 className="font-syne text-sm font-semibold text-[#0F172A]">Empresa emissora</h3>
              <div className="flex gap-2">
                {(Object.keys(EMPRESAS_EMISSORAS) as EmpresaEmissora[]).map(chave => (
                  <button
                    key={chave}
                    onClick={() => selecionarEmpresaEmissora(chave)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${form.empresaEmissora === chave ? 'bg-[#4F7CFF] text-white border-[#4F7CFF]' : 'bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'}`}
                  >
                    {EMPRESAS_EMISSORAS[chave].nomeExibicao}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tipo === 'pt' && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-syne text-sm font-semibold text-[#0F172A]">Modelo de Atividade</h3>
                <button onClick={() => setMostrarGerenciarModelos(true)} className="text-xs text-[#4F7CFF] hover:underline flex items-center gap-1">
                  <Settings size={12} /> Gerenciar
                </button>
              </div>
              <p className="text-xs text-[#94A3B8] -mt-1">Aplica os checklists (agentes, riscos, precauções, EPI) de um modelo salvo. Você ajusta a equipe e o resto depois.</p>
              <select className="field" value={modeloSelecionadoId} onChange={e => aplicarModelo(e.target.value)}>
                <option value="">Nenhum modelo (preencher do zero)</option>
                {modelosPt.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
              <div className="flex gap-2">
                <input
                  className="field text-sm flex-1"
                  placeholder="Nome do novo modelo (ex: PT de Solda)"
                  value={nomeNovoModelo}
                  onChange={e => setNomeNovoModelo(e.target.value)}
                />
                <button onClick={salvarComoNovoModelo} disabled={!nomeNovoModelo.trim() || salvandoModelo} className="btn-secondary text-xs px-3 min-h-0 disabled:opacity-50 shrink-0">
                  <Save size={14} /> Salvar
                </button>
              </div>
              {modeloSelecionadoId && (
                <button onClick={atualizarModeloSelecionado} disabled={salvandoModelo} className="text-xs text-[#4F7CFF] hover:underline disabled:opacity-50">
                  Atualizar &quot;{modelosPt.find(m => m.id === modeloSelecionadoId)?.nome}&quot; com os checkboxes atuais
                </button>
              )}
            </div>
          )}

          {tipo === 'pt' && (
            <div className="card space-y-3">
              <h3 className="font-syne text-sm font-semibold text-[#0F172A]">Inspeção / Responsáveis</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Gestor TVG</label>
                  <input className="field" value={form.gestorTvg} onChange={e => atualizar('gestorTvg', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Solicitante PTS</label>
                  <input className="field" value={form.solicitantePts} onChange={e => atualizar('solicitantePts', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Elaborador PTS</label>
                  <input className="field" value={form.elaboradorPts} onChange={e => atualizar('elaboradorPts', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Data Inspeção</label>
                  <input type="date" className="field" value={form.dataInspecao} onChange={e => atualizar('dataInspecao', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Data elaboração PTS</label>
                  <input type="date" className="field" value={form.dataElaboracaoPts} onChange={e => atualizar('dataElaboracaoPts', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {tipo === 'pt' && (
            <div className="card space-y-3">
              <h3 className="font-syne text-sm font-semibold text-[#0F172A]">Agentes da Fatalidade</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AGENTES_FATALIDADE_GRUPOS.map((grupo, grupoIdx) => (
                  <ChecklistColuna
                    key={grupo.titulo}
                    titulo={grupo.titulo}
                    itens={grupo.itens}
                    marcados={form.agentesFatalidade[grupoIdx]}
                    onToggle={i => alternarAgente(grupoIdx, i)}
                  />
                ))}
              </div>
            </div>
          )}

          {tipo === 'pt' && (
            <div className="card space-y-3">
              <h3 className="font-syne text-sm font-semibold text-[#0F172A]">Riscos Associados ao Trabalho</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ChecklistColuna itens={RISCOS_ASSOCIADOS_COL1} marcados={form.riscosAssociadosCol1} onToggle={i => alternarItemLista('riscosAssociadosCol1', i)} />
                <ChecklistColuna itens={RISCOS_ASSOCIADOS_COL2} marcados={form.riscosAssociadosCol2} onToggle={i => alternarItemLista('riscosAssociadosCol2', i)} />
              </div>
            </div>
          )}

          {tipo === 'pt' && (
            <div className="card space-y-3">
              <h3 className="font-syne text-sm font-semibold text-[#0F172A]">Precauções Obrigatórias</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ChecklistColuna itens={PRECAUCOES_COL1} marcados={form.precaucoesCol1} onToggle={i => alternarItemLista('precaucoesCol1', i)} />
                <ChecklistColuna itens={PRECAUCOES_COL2} marcados={form.precaucoesCol2} onToggle={i => alternarItemLista('precaucoesCol2', i)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Outros (descrever)</label>
                <input className="field" value={form.precaucoesOutros} onChange={e => atualizar('precaucoesOutros', e.target.value)} />
              </div>
            </div>
          )}

          {tipo === 'pt' && (
            <div className="card space-y-3">
              <h3 className="font-syne text-sm font-semibold text-[#0F172A]">EPI</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ChecklistColuna itens={EPI_COL1} marcados={form.epiCol1} onToggle={i => alternarItemLista('epiCol1', i)} />
                <ChecklistColuna itens={EPI_COL2} marcados={form.epiCol2} onToggle={i => alternarItemLista('epiCol2', i)} />
                <ChecklistColuna itens={EPI_COL3} marcados={form.epiCol3} onToggle={i => alternarItemLista('epiCol3', i)} />
              </div>
            </div>
          )}

          {tipo === 'pt' && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-syne text-sm font-semibold text-[#0F172A]">Equipe de Execução</h3>
                <button onClick={adicionarMembro} className="btn-secondary text-xs px-3 py-1.5 min-h-0">
                  <Plus size={14} /> Adicionar em branco
                </button>
              </div>

              <div className="border border-[#E2E8F0] rounded-lg p-3 space-y-2 bg-[#F8FAFC]">
                <p className="text-xs font-semibold text-[#64748B]">Adicionar funcionários cadastrados</p>
                <input
                  className="field text-sm"
                  placeholder="Buscar por nome…"
                  value={buscaFuncionario}
                  onChange={e => setBuscaFuncionario(e.target.value)}
                />
                <div className="max-h-48 overflow-y-auto space-y-0.5 bg-white border border-[#E2E8F0] rounded-lg p-1.5">
                  {funcionarios
                    .filter(f => f.nome.toLowerCase().includes(buscaFuncionario.toLowerCase()))
                    .map(f => (
                      <label key={f.id} className="flex items-center gap-2 text-xs text-[#374151] px-1.5 py-1 rounded hover:bg-[#F8FAFC] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={funcionariosSelecionados.includes(f.id)}
                          onChange={() => alternarFuncionarioSelecionado(f.id)}
                          className="w-3.5 h-3.5 accent-[#4F7CFF] shrink-0"
                        />
                        <span>{f.nome}{f.cargo ? ` — ${f.cargo}` : ''}</span>
                      </label>
                    ))}
                  {funcionarios.length === 0 && <p className="text-xs text-[#94A3B8] px-1.5 py-1">Nenhum funcionário cadastrado.</p>}
                </div>
                <button
                  onClick={adicionarFuncionariosSelecionados}
                  disabled={funcionariosSelecionados.length === 0}
                  className="btn-primary text-xs px-3 py-1.5 min-h-0 disabled:opacity-50"
                >
                  <Plus size={14} /> Adicionar {funcionariosSelecionados.length > 0 ? `${funcionariosSelecionados.length} selecionado(s)` : 'selecionados'}
                </button>
              </div>

              {form.equipeExecucao.map((m, idx) => (
                <div key={m.id} className="border border-[#E2E8F0] rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#94A3B8]">Membro {idx + 1}</span>
                    {form.equipeExecucao.length > 1 && (
                      <button onClick={() => removerMembro(m.id)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-red-400">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <input className="field text-sm" placeholder="Nome" value={m.nome} onChange={e => atualizarMembro(m.id, 'nome', e.target.value)} />
                  <input className="field text-sm" placeholder="Cargo" value={m.cargo} onChange={e => atualizarMembro(m.id, 'cargo', e.target.value)} />
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs text-[#374151] cursor-pointer">
                      <input type="checkbox" checked={m.nr35} onChange={e => atualizarMembro(m.id, 'nr35', e.target.checked)} className="w-3.5 h-3.5 accent-[#4F7CFF]" />
                      Apto NR 35
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[#374151] cursor-pointer">
                      <input type="checkbox" checked={m.nr12} onChange={e => atualizarMembro(m.id, 'nr12', e.target.checked)} className="w-3.5 h-3.5 accent-[#4F7CFF]" />
                      Apto NR 12
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Preview A4 ─────────────────────────────── */}
        <div className="lg:sticky lg:top-6 self-start print:static">
          <div className="bg-[#F1F5F9] rounded-xl p-4 md:p-6 flex justify-center print:bg-transparent print:p-0 print:block">
            <div
              id="documento-preview"
              style={{ width: '210mm', maxWidth: '100%', minHeight: '297mm', background: 'white', boxShadow: '0 4px 24px rgba(15,23,42,0.12)', padding: '14mm 12mm', boxSizing: 'border-box' }}
            >
              {tipo === 'apr' ? <AprDocument data={form} /> : <PtDocument data={form} />}
            </div>
          </div>
        </div>
      </div>

      {mostrarGerenciarModelos && (
        <ModalGerenciarModelosPt
          modelos={modelosPt}
          onClose={() => setMostrarGerenciarModelos(false)}
          onChanged={async () => {
            const lista = await recarregarModelos()
            if (!lista.some(m => m.id === modeloSelecionadoId)) setModeloSelecionadoId('')
          }}
        />
      )}
    </div>
  )
}
