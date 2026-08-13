'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer, Plus, Trash2, ShieldAlert, ClipboardCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import AprDocument from '@/components/documentos/AprDocument'
import PtDocument from '@/components/documentos/PtDocument'
import {
  DocumentoSegurancaFormData, TipoDocumentoSeguranca, RiscoItem,
  EPIS_DISPONIVEIS, novoRiscoItem, criarFormDataInicial,
} from '@/components/documentos/types'

interface ObraOpcao {
  id: string
  titulo: string
  endereco?: string
  descricao?: string
  engenheiro_responsavel?: string
  cliente?: { nome: string; empresa_id?: string | null } | null
}

export default function NovoDocumentoSegurancaPage() {
  const [obras, setObras] = useState<ObraOpcao[]>([])
  const [empresasMap, setEmpresasMap] = useState<Record<string, string>>({})
  const [tipo, setTipo] = useState<TipoDocumentoSeguranca>('apr')
  const [form, setForm] = useState<DocumentoSegurancaFormData>(() => criarFormDataInicial())

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [obrasRes, empresasRes] = await Promise.all([
        supabase
          .from('obras')
          .select('id,titulo,endereco,descricao,engenheiro_responsavel,cliente:clientes(nome,empresa_id)')
          .order('titulo'),
        supabase.from('empresas').select('id,razao_social'),
      ])
      if (obrasRes.error) console.error('Erro ao carregar obras:', obrasRes.error)
      if (obrasRes.data) setObras(obrasRes.data as unknown as ObraOpcao[])
      if (empresasRes.data) {
        const map: Record<string, string> = {}
        empresasRes.data.forEach((e: { id: string; razao_social: string }) => { map[e.id] = e.razao_social })
        setEmpresasMap(map)
      }
    }
    load()
  }, [])

  function atualizar<K extends keyof DocumentoSegurancaFormData>(campo: K, valor: DocumentoSegurancaFormData[K]) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  function selecionarObra(obraId: string) {
    const obra = obras.find(o => o.id === obraId)
    if (!obra) { atualizar('obraId', ''); return }
    setForm(prev => ({
      ...prev,
      obraId,
      cliente: (obra.cliente?.empresa_id && empresasMap[obra.cliente.empresa_id]) || obra.cliente?.nome || prev.cliente,
      local: obra.endereco || prev.local,
      descricaoAtividades: obra.descricao || prev.descricaoAtividades,
      responsavelEmpresa: obra.engenheiro_responsavel || prev.responsavelEmpresa,
    }))
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

  function alternarAgenteFatalidade(chave: keyof DocumentoSegurancaFormData['agentesFatalidade']) {
    setForm(prev => ({
      ...prev,
      agentesFatalidade: { ...prev.agentesFatalidade, [chave]: !prev.agentesFatalidade[chave] },
    }))
  }

  function alternarEpi(epi: string) {
    setForm(prev => ({
      ...prev,
      episObrigatorios: prev.episObrigatorios.includes(epi)
        ? prev.episObrigatorios.filter(e => e !== epi)
        : [...prev.episObrigatorios, epi],
    }))
  }

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #documento-preview, #documento-preview * { visibility: visible; }
          #documento-preview { position: absolute; top: 0; left: 0; width: 210mm; margin: 0 !important; padding: 12mm 15mm !important; box-shadow: none !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>

      <div className="no-print">
        <Topbar searchPlaceholder="Buscar..." />
      </div>

      <div className="no-print p-4 md:p-6 pb-0">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 md:p-6">
        {/* ── Formulário ─────────────────────────────── */}
        <div className="no-print space-y-5">
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
              <h3 className="font-syne text-sm font-semibold text-[#0F172A] mb-1">Agentes da Fatalidade</h3>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['trabalhoAltura', 'Trabalho em Altura'],
                  ['andaimes', 'Andaimes'],
                  ['pta', 'PTA'],
                  ['escadas', 'Escadas'],
                  ['isolacaoArea', 'Isolação de Área'],
                  ['bloqueioEletricoLoto', 'Bloqueio Elétrico (LOTO)'],
                ] as const).map(([chave, texto]) => (
                  <label key={chave} className="flex items-center gap-2 text-sm text-[#374151] px-2 py-1.5 rounded-lg hover:bg-[#F8FAFC] cursor-pointer">
                    <input type="checkbox" checked={form.agentesFatalidade[chave]} onChange={() => alternarAgenteFatalidade(chave)} className="w-4 h-4 accent-[#4F7CFF]" />
                    {texto}
                  </label>
                ))}
              </div>
            </div>
          )}

          {tipo === 'pt' && (
            <div className="card space-y-2">
              <h3 className="font-syne text-sm font-semibold text-[#0F172A] mb-1">EPIs Obrigatórios</h3>
              <div className="grid grid-cols-2 gap-2">
                {EPIS_DISPONIVEIS.map(epi => (
                  <label key={epi} className="flex items-center gap-2 text-sm text-[#374151] px-2 py-1.5 rounded-lg hover:bg-[#F8FAFC] cursor-pointer">
                    <input type="checkbox" checked={form.episObrigatorios.includes(epi)} onChange={() => alternarEpi(epi)} className="w-4 h-4 accent-[#4F7CFF]" />
                    {epi}
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5 mt-2">Outros</label>
                <input className="field" value={form.episOutros} onChange={e => atualizar('episOutros', e.target.value)} placeholder="EPI adicional não listado" />
              </div>
            </div>
          )}
        </div>

        {/* ── Preview A4 ─────────────────────────────── */}
        <div className="lg:sticky lg:top-6 self-start">
          <div className="bg-[#F1F5F9] rounded-xl p-4 md:p-6 flex justify-center">
            <div
              id="documento-preview"
              style={{ width: '210mm', maxWidth: '100%', minHeight: '297mm', background: 'white', boxShadow: '0 4px 24px rgba(15,23,42,0.12)', padding: '14mm 12mm' }}
            >
              {tipo === 'apr' ? <AprDocument data={form} /> : <PtDocument data={form} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
