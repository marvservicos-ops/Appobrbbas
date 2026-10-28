'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Plus, Trash2, X, Loader2, Camera, Check, Pencil, Upload, Printer, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { converterSeForHeic } from '@/lib/utils/heic'
import { sanitizarNomeArquivo } from '@/lib/utils/nomeArquivo'
import { Obra, RDO, RDOClima, RDOMaoObra, RDOEquipamento, RDOAtividade, RDOOcorrencia, RDOComentario, RDOFoto, RDOAssinatura } from '@/lib/types'
import Link from 'next/link'
import { diasEntre } from '@/lib/datas'
import { mensagemErro } from '@/lib/erros'

// Progresso digitado: vazio = 100; aceita 0 e limita a 0–100
function parseProgresso(v: string | undefined): number {
  if (v == null || v.trim() === '') return 100
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? 100 : Math.min(100, Math.max(0, n))
}

const STATUS_CONFIG = {
  preenchendo: { label: 'Preenchendo', cls: 'bg-blue-100 text-blue-700' },
  revisando: { label: 'Revisando', cls: 'bg-amber-100 text-amber-700' },
  aprovado: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700' },
}

const DIAS_SEMANA = ['Domingo','Segunda-Feira','Terça-Feira','Quarta-Feira','Quinta-Feira','Sexta-Feira','Sábado']

export default function RDOPage() {
  const { id: obraId, rdoId } = useParams<{ id: string; rdoId: string }>()
  const router = useRouter()

  const [obra, setObra] = useState<Obra | null>(null)
  const [rdo, setRdo] = useState<RDO | null>(null)
  const [clima, setClima] = useState<RDOClima[]>([])
  const [maoObra, setMaoObra] = useState<RDOMaoObra[]>([])
  const [equipamentos, setEquipamentos] = useState<RDOEquipamento[]>([])
  const [atividades, setAtividades] = useState<RDOAtividade[]>([])
  const [ocorrencias, setOcorrencias] = useState<RDOOcorrencia[]>([])
  const [comentarios, setComentarios] = useState<RDOComentario[]>([])
  const [fotos, setFotos] = useState<RDOFoto[]>([])
  const [assinaturas, setAssinaturas] = useState<RDOAssinatura[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [enviandoFotos, setEnviandoFotos] = useState(0)
  const [erroCarregar, setErroCarregar] = useState('')

  async function load() {
    setErroCarregar('')
    const supabase = createClient()
    const [obraRes, rdoRes, climaRes, maoRes, eqRes, atRes, ocRes, comRes, fotosRes, assRes] = await Promise.all([
      supabase.from('obras').select('*, cliente:clientes(*)').eq('id', obraId).single(),
      supabase.from('rdos').select('*').eq('id', rdoId).single(),
      supabase.from('rdo_clima').select('*').eq('rdo_id', rdoId).order('periodo'),
      supabase.from('rdo_mao_obra').select('*').eq('rdo_id', rdoId),
      supabase.from('rdo_equipamentos').select('*').eq('rdo_id', rdoId),
      supabase.from('rdo_atividades').select('*').eq('rdo_id', rdoId).order('ordem'),
      supabase.from('rdo_ocorrencias').select('*').eq('rdo_id', rdoId).order('created_at'),
      supabase.from('rdo_comentarios').select('*').eq('rdo_id', rdoId).order('created_at'),
      supabase.from('rdo_fotos').select('*').eq('rdo_id', rdoId).order('ordem'),
      supabase.from('rdo_assinaturas').select('*').eq('rdo_id', rdoId),
    ])
    const erroLeitura = [obraRes, rdoRes].find(x => x.error && x.error.code !== 'PGRST116')?.error
      ?? [climaRes, maoRes, eqRes, atRes, ocRes, comRes, fotosRes, assRes].find(x => x.error)?.error
    if (erroLeitura) setErroCarregar(mensagemErro(erroLeitura, 'Não foi possível carregar o RDO'))
    if (obraRes.data) setObra(obraRes.data as Obra)
    if (rdoRes.data) setRdo(rdoRes.data as RDO)
    if (climaRes.data) setClima(climaRes.data as RDOClima[])
    if (maoRes.data) setMaoObra(maoRes.data as RDOMaoObra[])
    if (eqRes.data) setEquipamentos(eqRes.data as RDOEquipamento[])
    if (atRes.data) setAtividades(atRes.data as RDOAtividade[])
    if (ocRes.data) setOcorrencias(ocRes.data as RDOOcorrencia[])
    if (comRes.data) setComentarios(comRes.data as RDOComentario[])
    if (fotosRes.data) setFotos(fotosRes.data as RDOFoto[])
    if (assRes.data) setAssinaturas(assRes.data as RDOAssinatura[])
    setLoading(false)
  }

  useEffect(() => { load() }, [rdoId])

  // Mostra o erro e devolve true — a tela só muda quando o banco confirmou
  function falhou(error: { message: string } | null, contexto: string): boolean {
    if (!error) return false
    alert(mensagemErro(error, contexto))
    return true
  }

  async function updateStatus(status: RDO['status']) {
    const supabase = createClient()
    const { error } = await supabase.from('rdos').update({ status }).eq('id', rdoId)
    setShowStatusMenu(false)
    if (falhou(error, 'Não foi possível mudar o status')) return
    setRdo(r => r ? { ...r, status } : r)
  }

  async function updateIndice(val: string) {
    if ((rdo?.indice_pluviometrico ?? '') === val) return
    const supabase = createClient()
    const { error } = await supabase.from('rdos').update({ indice_pluviometrico: val || null }).eq('id', rdoId)
    if (falhou(error, 'Não foi possível salvar o índice pluviométrico')) return
    setRdo(r => r ? { ...r, indice_pluviometrico: val || undefined } as RDO : r)
  }

  // ── CLIMA ─────────────────────────────────────────────
  async function togglePeriodo(c: RDOClima) {
    const supabase = createClient()
    const { error } = await supabase.from('rdo_clima').update({ ativo: !c.ativo }).eq('id', c.id)
    if (falhou(error, 'Não foi possível salvar o clima')) return
    setClima(prev => prev.map(x => x.id === c.id ? { ...x, ativo: !x.ativo } : x))
  }

  async function updateClima(c: RDOClima, field: 'tempo' | 'condicao', value: string) {
    const supabase = createClient()
    const { error } = await supabase.from('rdo_clima').update({ [field]: value }).eq('id', c.id)
    if (falhou(error, 'Não foi possível salvar o clima')) return
    setClima(prev => prev.map(x => x.id === c.id ? { ...x, [field]: value } : x))
  }

  // ── Itens das listas (inserir / editar / excluir) ─────
  async function inserirItem<T>(tabela: string, dados: Record<string, unknown>, setter: React.Dispatch<React.SetStateAction<T[]>>, contexto: string): Promise<boolean> {
    const { data, error } = await createClient().from(tabela).insert({ rdo_id: rdoId, ...dados }).select().single()
    if (falhou(error, contexto)) return false
    if (data) setter(prev => [...prev, data as T])
    return true
  }

  async function editarItem<T extends { id: string }>(tabela: string, id: string, dados: Partial<T>, setter: React.Dispatch<React.SetStateAction<T[]>>, contexto: string): Promise<boolean> {
    const { error } = await createClient().from(tabela).update(dados as Record<string, unknown>).eq('id', id)
    if (falhou(error, contexto)) return false
    setter(prev => prev.map(x => x.id === id ? { ...x, ...dados } : x))
    return true
  }

  async function excluirItem<T extends { id: string }>(tabela: string, id: string, descricao: string, setter: React.Dispatch<React.SetStateAction<T[]>>) {
    if (!confirm(`Excluir ${descricao}?`)) return
    const { error } = await createClient().from(tabela).delete().eq('id', id)
    if (falhou(error, 'Não foi possível excluir')) return
    setter(prev => prev.filter(x => x.id !== id))
  }

  // ── MÃO DE OBRA ───────────────────────────────────────
  const addMaoObra = (funcao: string, tipo: string, quantidade: number) =>
    inserirItem<RDOMaoObra>('rdo_mao_obra', { funcao, tipo, quantidade }, setMaoObra, 'Não foi possível adicionar a mão de obra')

  async function updateQtdMao(id: string, delta: number) {
    const item = maoObra.find(m => m.id === id)
    if (!item) return
    const novaQtd = Math.max(1, item.quantidade + delta)
    await editarItem<RDOMaoObra>('rdo_mao_obra', id, { quantidade: novaQtd }, setMaoObra, 'Não foi possível alterar a quantidade')
  }

  // ── EQUIPAMENTOS ──────────────────────────────────────
  const addEquipamento = (nome: string, quantidade: number) =>
    inserirItem<RDOEquipamento>('rdo_equipamentos', { nome, quantidade }, setEquipamentos, 'Não foi possível adicionar o equipamento')

  async function updateQtdEq(id: string, delta: number) {
    const item = equipamentos.find(e => e.id === id)
    if (!item) return
    const novaQtd = Math.max(1, item.quantidade + delta)
    await editarItem<RDOEquipamento>('rdo_equipamentos', id, { quantidade: novaQtd }, setEquipamentos, 'Não foi possível alterar a quantidade')
  }

  // ── ATIVIDADES ────────────────────────────────────────
  const addAtividade = (descricao: string, progresso: number, status_ativ: string) =>
    inserirItem<RDOAtividade>('rdo_atividades', { descricao, progresso, status_ativ, ordem: atividades.length }, setAtividades, 'Não foi possível adicionar a atividade')

  // ── OCORRÊNCIAS ───────────────────────────────────────
  const addOcorrencia = (descricao: string) =>
    inserirItem<RDOOcorrencia>('rdo_ocorrencias', { descricao }, setOcorrencias, 'Não foi possível adicionar a ocorrência')

  // ── COMENTÁRIOS ───────────────────────────────────────
  const addComentario = (autor: string, texto: string) =>
    inserirItem<RDOComentario>('rdo_comentarios', { autor, texto }, setComentarios, 'Não foi possível adicionar o comentário')

  // ── FOTOS ─────────────────────────────────────────────
  async function uploadFotos(files: FileList) {
    const lista = Array.from(files)
    if (lista.length === 0) return
    const supabase = createClient()
    const base = fotos.length
    const falhas: string[] = []
    setEnviandoFotos(lista.length)
    try {
      for (let i = 0; i < lista.length; i++) {
        const fileOriginal = lista[i]
        try {
          const file = await converterSeForHeic(fileOriginal)
          const path = `${rdoId}/${Date.now()}_${i}_${sanitizarNomeArquivo(file.name)}`
          const { error } = await supabase.storage.from('rdo-fotos').upload(path, file)
          if (error) { console.error('upload foto RDO:', error); falhas.push(fileOriginal.name); continue }
          const { data: urlData } = supabase.storage.from('rdo-fotos').getPublicUrl(path)
          const { data, error: errFoto } = await supabase.from('rdo_fotos').insert({ rdo_id: rdoId, url: urlData.publicUrl, path, ordem: base + i }).select().single()
          if (errFoto) {
            console.error('gravar foto RDO:', errFoto)
            await supabase.storage.from('rdo-fotos').remove([path])
            falhas.push(fileOriginal.name)
            continue
          }
          if (data) setFotos(prev => [...prev, data as RDOFoto])
        } catch (e) {
          console.error('foto RDO:', e)
          falhas.push(fileOriginal.name)
        } finally {
          setEnviandoFotos(n => Math.max(0, n - 1))
        }
      }
    } finally {
      setEnviandoFotos(0)
    }
    if (falhas.length > 0) alert(`Não foi possível enviar ${falhas.length === 1 ? 'a foto' : `${falhas.length} fotos`}: ${falhas.join(', ')}. Verifique a internet e tente de novo.`)
  }

  async function updateLegenda(id: string, legenda: string) {
    if ((fotos.find(f => f.id === id)?.legenda ?? '') === legenda) return
    await editarItem<RDOFoto>('rdo_fotos', id, { legenda }, setFotos, 'Não foi possível salvar a legenda')
  }

  async function removeFoto(foto: RDOFoto) {
    if (!confirm('Excluir esta foto do RDO?')) return
    const supabase = createClient()
    const { error } = await supabase.from('rdo_fotos').delete().eq('id', foto.id)
    if (falhou(error, 'Não foi possível excluir a foto')) return
    if (foto.path) await supabase.storage.from('rdo-fotos').remove([foto.path])
    setFotos(prev => prev.filter(f => f.id !== foto.id))
  }

  // ── ASSINATURAS ───────────────────────────────────────
  async function salvarAssinaturaBlob(tipo: string, nome: string, blob: Blob): Promise<boolean> {
    setSaving(true)
    try {
      const supabase = createClient()
      const path = `rdo/${rdoId}/${tipo}_${Date.now()}.png`
      const { error } = await supabase.storage.from('assinaturas').upload(path, blob, { upsert: true })
      if (falhou(error, 'Não foi possível enviar a assinatura')) return false
      const { data: urlData } = supabase.storage.from('assinaturas').getPublicUrl(path)
      const existing = assinaturas.find(a => a.tipo === tipo)
      const agora = new Date().toISOString()
      if (existing) {
        const { error: errUpd } = await supabase.from('rdo_assinaturas').update({ assinatura_url: urlData.publicUrl, nome, assinado_em: agora }).eq('id', existing.id)
        if (falhou(errUpd, 'Não foi possível salvar a assinatura')) return false
        setAssinaturas(prev => prev.map(a => a.tipo === tipo ? { ...a, assinatura_url: urlData.publicUrl, nome, assinado_em: agora } : a))
      } else {
        const { data, error: errIns } = await supabase.from('rdo_assinaturas').insert({ rdo_id: rdoId, tipo, nome, assinatura_url: urlData.publicUrl, assinado_em: agora }).select().single()
        if (falhou(errIns, 'Não foi possível salvar a assinatura')) return false
        if (data) setAssinaturas(prev => [...prev, data as RDOAssinatura])
      }
      return true
    } catch (e) {
      alert(mensagemErro(e as Error, 'Não foi possível salvar a assinatura'))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function salvarAssinatura(tipo: string, nome: string, canvasRef: React.RefObject<HTMLCanvasElement>): Promise<boolean> {
    const canvas = canvasRef.current
    if (!canvas) return false
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
    if (!blob) return false
    return salvarAssinaturaBlob(tipo, nome, blob)
  }

  // Renomear o assinante de uma assinatura já feita
  async function salvarNomeAssinante(tipo: string, nome: string) {
    const existing = assinaturas.find(a => a.tipo === tipo)
    if (!existing || (existing.nome ?? '') === nome) return
    await editarItem<RDOAssinatura>('rdo_assinaturas', existing.id, { nome }, setAssinaturas, 'Não foi possível salvar o nome do assinante')
  }

  async function removerAssinatura(tipo: string): Promise<boolean> {
    const existing = assinaturas.find(a => a.tipo === tipo)
    if (!existing) return false
    if (!confirm('Remover esta assinatura?')) return false
    const supabase = createClient()
    const { error } = await supabase.from('rdo_assinaturas').delete().eq('id', existing.id)
    if (falhou(error, 'Não foi possível remover a assinatura')) return false
    setAssinaturas(prev => prev.filter(a => a.tipo !== tipo))
    return true
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 size={28} className="animate-spin text-[#4F7CFF]" /></div>
  if (!rdo || !obra) return (
    <div className="p-8 text-center text-[#64748B]">
      <p>{erroCarregar || 'RDO não encontrado.'}</p>
      {erroCarregar && <button onClick={() => { setLoading(true); load() }} className="btn-primary text-sm mx-auto mt-4">Tentar de novo</button>}
    </div>
  )

  const dataRdo = new Date(rdo.data + 'T12:00:00')
  const diaSemana = DIAS_SEMANA[dataRdo.getDay()]
  const sc = STATUS_CONFIG[rdo.status]

  // Prazos contados até a data do RDO (não a de hoje): reabrir um RDO antigo mostra os mesmos números
  const inicio = obra.data_inicio?.slice(0, 10)
  const termino = obra.previsao_termino?.slice(0, 10)
  const dataRef = rdo.data.slice(0, 10)
  const prazoContratual = inicio && termino ? diasEntre(inicio, termino) : null
  const prazoDecorrido = inicio ? Math.max(0, diasEntre(inicio, dataRef)) : null
  const prazoVencer = termino ? Math.max(0, diasEntre(dataRef, termino)) : null

  const periodoLabel: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="h-14 bg-white border-b border-[#E2E8F0] flex items-center px-3 md:px-4 gap-2 md:gap-3 sticky top-[calc(3.5rem+env(safe-area-inset-top))] md:top-0 z-20">
        <Link href={`/obras/${obraId}?tab=relatorios`} aria-label="Voltar para a obra" title="Voltar para a obra" className="flex items-center gap-1.5 p-2 -ml-2 text-sm text-[#64748B] hover:text-[#0F172A]">
          <ArrowLeft size={16} />
        </Link>
        <span className="text-sm font-medium text-[#0F172A] truncate flex-1">
          RDO n° {rdo.numero} — {dataRdo.toLocaleDateString('pt-BR')}
        </span>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setShowStatusMenu(s => !s)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${sc.cls}`}>
              {sc.label} <ChevronDown size={12} />
            </button>
            {showStatusMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-50 py-1 min-w-[140px]">
                {(Object.entries(STATUS_CONFIG) as [RDO['status'], typeof sc][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => updateStatus(key)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-[#F8FAFC] transition-colors">
                    <span className={`font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Link href={`/print/rdo/${rdoId}`} target="_blank"
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] text-[#64748B] transition-colors">
            <Printer size={14} /> <span className="hidden sm:inline">PDF</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 gap-0">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-4xl">

          {/* Info da obra */}
          <div className="card">
            <h3 className="font-syne font-semibold text-sm text-[#0F172A] mb-3 border-b border-[#F1F5F9] pb-2">Detalhes do Relatório</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div><span className="text-xs text-[#64748B]">Obra</span><p className="font-medium text-[#0F172A] mt-0.5 text-xs">{obra.titulo}</p></div>
              <div><span className="text-xs text-[#64748B]">Data</span><p className="font-medium text-[#0F172A] mt-0.5 text-xs">{dataRdo.toLocaleDateString('pt-BR')}</p></div>
              <div><span className="text-xs text-[#64748B]">Dia da semana</span><p className="font-medium text-[#0F172A] mt-0.5 text-xs">{diaSemana}</p></div>
              <div><span className="text-xs text-[#64748B]">Responsável</span><p className="font-medium text-[#0F172A] mt-0.5 text-xs">{obra.engenheiro_responsavel || '—'}</p></div>
              <div><span className="text-xs text-[#64748B]">Contratante</span><p className="font-medium text-[#0F172A] mt-0.5 text-xs">{(obra.cliente as any)?.nome || '—'}</p></div>
              <div><span className="text-xs text-[#64748B]">Nº Contrato</span><p className="font-medium text-[#0F172A] mt-0.5 text-xs">{obra.numero_contrato || '—'}</p></div>
              {prazoContratual !== null && <div><span className="text-xs text-[#64748B]">Prazo Contratual</span><p className="font-medium text-[#0F172A] mt-0.5 text-xs">{prazoContratual} dias</p></div>}
              {prazoDecorrido !== null && <div><span className="text-xs text-[#64748B]">Prazo Decorrido</span><p className="font-medium text-[#0F172A] mt-0.5 text-xs">{prazoDecorrido} dias</p></div>}
              {prazoVencer !== null && <div><span className="text-xs text-[#64748B]">Prazo a Vencer</span><p className="font-medium text-[#0F172A] mt-0.5 text-xs">{prazoVencer} dias</p></div>}
            </div>
          </div>

          {/* Condição Climática */}
          <Section id="clima" title="Condição Climática" count={0}>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2">
                <div className="hidden sm:grid grid-cols-[100px_1fr_1fr] gap-2 text-xs font-semibold text-[#64748B] px-1">
                  <span>Período</span><span>Tempo</span><span>Condição</span>
                </div>
                {clima.map(c => (
                  <div key={c.id} className={`grid grid-cols-1 sm:grid-cols-[100px_1fr_1fr] gap-2 items-center p-2 rounded-lg ${c.ativo ? 'bg-[#F8FAFC]' : 'bg-[#F1F5F9] opacity-60'}`}>
                    <label className="flex items-center gap-2 text-sm font-medium text-[#374151] cursor-pointer">
                      <input type="checkbox" checked={c.ativo} onChange={() => togglePeriodo(c)} className="rounded" />
                      {periodoLabel[c.periodo]}
                    </label>
                    <div className="flex gap-3">
                      {(['claro', 'nublado', 'chuvoso'] as const).map(t => (
                        <label key={t} className={`flex items-center gap-1 text-xs cursor-pointer capitalize ${!c.ativo ? 'pointer-events-none' : ''}`}>
                          <input type="radio" name={`tempo-${c.id}`} value={t} checked={c.tempo === t} onChange={() => updateClima(c, 'tempo', t)} disabled={!c.ativo} />
                          {t}
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      {(['praticavel', 'impraticavel'] as const).map(cd => (
                        <label key={cd} className={`flex items-center gap-1 text-xs cursor-pointer ${!c.ativo ? 'pointer-events-none' : ''}`}>
                          <input type="radio" name={`cond-${c.id}`} value={cd} checked={c.condicao === cd} onChange={() => updateClima(c, 'condicao', cd)} disabled={!c.ativo} />
                          {cd === 'praticavel' ? 'Praticável' : 'Impraticável'}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-[#64748B] whitespace-nowrap">Índice pluviométrico (mm)</label>
                <input defaultValue={rdo.indice_pluviometrico ?? ''} placeholder="Ex: 5.30" inputMode="decimal"
                  onBlur={e => updateIndice(e.target.value.trim())}
                  className="field text-sm w-32" />
              </div>
            </div>
          </Section>

          {/* Mão de Obra */}
          <Section id="mao-obra" title="Mão de Obra" count={maoObra.length}>
            <ListaComAdd
              items={maoObra}
              fields={[
                { key: 'funcao', label: 'Função', placeholder: 'Ex: Encarregado de Refrigeração' },
                { key: 'tipo', label: 'Tipo', type: 'select', options: [{ value: 'direta', label: 'Mão de Obra Direta' }, { value: 'indireta', label: 'Mão de Obra Indireta' }] },
              ]}
              onAdd={(vals) => addMaoObra(vals.funcao.trim(), vals.tipo || 'direta', 1)}
              valoresDe={item => ({ funcao: item.funcao, tipo: item.tipo })}
              onEdit={(item, vals) => editarItem<RDOMaoObra>('rdo_mao_obra', item.id, { funcao: vals.funcao.trim(), tipo: (vals.tipo || 'direta') as RDOMaoObra['tipo'] }, setMaoObra, 'Não foi possível salvar a mão de obra')}
              renderItem={(item, editar) => (
                <div key={item.id} className="flex items-center gap-2 p-2.5 bg-[#F8FAFC] rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{item.funcao}</p>
                    <p className="text-xs text-[#64748B]">{item.tipo === 'direta' ? 'Mão de Obra Direta' : 'Mão de Obra Indireta'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQtdMao(item.id, -1)} aria-label="Diminuir quantidade" title="Diminuir quantidade" className="w-8 h-8 flex items-center justify-center rounded border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] text-sm">−</button>
                    <span className="w-7 text-center text-sm font-semibold">{item.quantidade}</span>
                    <button onClick={() => updateQtdMao(item.id, +1)} aria-label="Aumentar quantidade" title="Aumentar quantidade" className="w-8 h-8 flex items-center justify-center rounded border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] text-sm">+</button>
                  </div>
                  <button onClick={editar} aria-label={`Editar ${item.funcao}`} title="Editar" className="p-2 text-[#94A3B8] hover:text-[#4F7CFF] transition-colors shrink-0"><Pencil size={14} /></button>
                  <button onClick={() => excluirItem('rdo_mao_obra', item.id, `a função "${item.funcao}"`, setMaoObra)} aria-label={`Excluir ${item.funcao}`} title="Excluir" className="p-2 text-[#94A3B8] hover:text-red-500 transition-colors shrink-0"><X size={14} /></button>
                </div>
              )}
            />
          </Section>

          {/* Equipamentos */}
          <Section id="equipamentos" title="Equipamentos" count={equipamentos.length}>
            <ListaComAdd
              items={equipamentos}
              fields={[{ key: 'nome', label: 'Equipamento', placeholder: 'Ex: Manifold digital' }]}
              onAdd={(vals) => addEquipamento(vals.nome.trim(), 1)}
              valoresDe={item => ({ nome: item.nome })}
              onEdit={(item, vals) => editarItem<RDOEquipamento>('rdo_equipamentos', item.id, { nome: vals.nome.trim() }, setEquipamentos, 'Não foi possível salvar o equipamento')}
              renderItem={(item, editar) => (
                <div key={item.id} className="flex items-center gap-2 p-2.5 bg-[#F8FAFC] rounded-lg">
                  <p className="flex-1 min-w-0 text-sm font-medium text-[#0F172A]">{item.nome}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQtdEq(item.id, -1)} aria-label="Diminuir quantidade" title="Diminuir quantidade" className="w-8 h-8 flex items-center justify-center rounded border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] text-sm">−</button>
                    <span className="w-7 text-center text-sm font-semibold">{item.quantidade}</span>
                    <button onClick={() => updateQtdEq(item.id, +1)} aria-label="Aumentar quantidade" title="Aumentar quantidade" className="w-8 h-8 flex items-center justify-center rounded border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] text-sm">+</button>
                  </div>
                  <button onClick={editar} aria-label={`Editar ${item.nome}`} title="Editar" className="p-2 text-[#94A3B8] hover:text-[#4F7CFF] transition-colors shrink-0"><Pencil size={14} /></button>
                  <button onClick={() => excluirItem('rdo_equipamentos', item.id, `o equipamento "${item.nome}"`, setEquipamentos)} aria-label={`Excluir ${item.nome}`} title="Excluir" className="p-2 text-[#94A3B8] hover:text-red-500 transition-colors shrink-0"><X size={14} /></button>
                </div>
              )}
            />
          </Section>

          {/* Atividades */}
          <Section id="atividades" title="Atividades" count={atividades.length}>
            <ListaComAdd
              items={atividades}
              fields={[
                { key: 'descricao', label: 'Descrição da atividade', placeholder: 'Ex: Instalação do evaporador' },
                { key: 'progresso', label: 'Progresso (%) — 0 a 100', type: 'number', placeholder: '100' },
                { key: 'status_ativ', label: 'Status', type: 'select', options: [
                  { value: 'Concluída', label: 'Concluída' },
                  { value: 'Em andamento', label: 'Em andamento' },
                  { value: 'Pendente', label: 'Pendente' },
                ]},
              ]}
              onAdd={(vals) => addAtividade(vals.descricao.trim(), parseProgresso(vals.progresso), vals.status_ativ || 'Concluída')}
              valoresDe={item => ({ descricao: item.descricao, progresso: String(item.progresso ?? ''), status_ativ: item.status_ativ ?? 'Concluída' })}
              onEdit={(item, vals) => editarItem<RDOAtividade>('rdo_atividades', item.id, { descricao: vals.descricao.trim(), progresso: parseProgresso(vals.progresso), status_ativ: vals.status_ativ || 'Concluída' } as Partial<RDOAtividade>, setAtividades, 'Não foi possível salvar a atividade')}
              renderItem={(item, editar) => (
                <div key={item.id} className="flex items-start gap-2 p-2.5 bg-[#F8FAFC] rounded-lg">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4F7CFF] mt-2 shrink-0" />
                  <p className="flex-1 min-w-0 text-sm text-[#0F172A] pt-0.5">{item.descricao}</p>
                  <span className="text-xs text-[#64748B] whitespace-nowrap shrink-0 pt-1">{item.progresso}% {item.status_ativ}</span>
                  <button onClick={editar} aria-label="Editar atividade" title="Editar" className="p-2 -mt-1.5 text-[#94A3B8] hover:text-[#4F7CFF] transition-colors shrink-0"><Pencil size={14} /></button>
                  <button onClick={() => excluirItem('rdo_atividades', item.id, 'esta atividade', setAtividades)} aria-label="Excluir atividade" title="Excluir" className="p-2 -mt-1.5 text-[#94A3B8] hover:text-red-500 transition-colors shrink-0"><X size={14} /></button>
                </div>
              )}
            />
          </Section>

          {/* Ocorrências */}
          <Section id="ocorrencias" title="Ocorrências" count={ocorrencias.length}>
            <ListaComAdd
              items={ocorrencias}
              fields={[{ key: 'descricao', label: 'Ocorrência', placeholder: 'Descreva a ocorrência...' }]}
              onAdd={(vals) => addOcorrencia(vals.descricao.trim())}
              valoresDe={item => ({ descricao: item.descricao })}
              onEdit={(item, vals) => editarItem<RDOOcorrencia>('rdo_ocorrencias', item.id, { descricao: vals.descricao.trim() }, setOcorrencias, 'Não foi possível salvar a ocorrência')}
              renderItem={(item, editar) => (
                <div key={item.id} className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                  <p className="flex-1 min-w-0 text-sm text-[#374151] pt-0.5">{item.descricao}</p>
                  <button onClick={editar} aria-label="Editar ocorrência" title="Editar" className="p-2 -mt-1.5 text-[#94A3B8] hover:text-[#4F7CFF] transition-colors shrink-0"><Pencil size={14} /></button>
                  <button onClick={() => excluirItem('rdo_ocorrencias', item.id, 'esta ocorrência', setOcorrencias)} aria-label="Excluir ocorrência" title="Excluir" className="p-2 -mt-1.5 text-[#94A3B8] hover:text-red-500 transition-colors shrink-0"><X size={14} /></button>
                </div>
              )}
            />
          </Section>

          {/* Comentários */}
          <Section id="comentarios" title="Comentários" count={comentarios.length}>
            <ListaComAdd
              items={comentarios}
              fields={[
                { key: 'autor', label: 'Autor', placeholder: 'Nome do autor' },
                { key: 'texto', label: 'Comentário', placeholder: 'Digite o comentário...' },
              ]}
              onAdd={(vals) => addComentario(vals.autor.trim(), (vals.texto ?? '').trim())}
              valoresDe={item => ({ autor: item.autor, texto: item.texto })}
              onEdit={(item, vals) => editarItem<RDOComentario>('rdo_comentarios', item.id, { autor: vals.autor.trim(), texto: (vals.texto ?? '').trim() }, setComentarios, 'Não foi possível salvar o comentário')}
              renderItem={(item, editar) => (
                <div key={item.id} className="p-3 bg-[#F8FAFC] rounded-lg border border-[#F1F5F9]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[#0F172A]">{item.autor}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-[#94A3B8] mr-1">{new Date(item.created_at).toLocaleString('pt-BR')}</span>
                      <button onClick={editar} aria-label="Editar comentário" title="Editar" className="p-2 text-[#94A3B8] hover:text-[#4F7CFF] transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => excluirItem('rdo_comentarios', item.id, 'este comentário', setComentarios)} aria-label="Excluir comentário" title="Excluir" className="p-2 text-[#94A3B8] hover:text-red-500 transition-colors"><X size={13} /></button>
                    </div>
                  </div>
                  <p className="text-sm text-[#374151]">{item.texto}</p>
                </div>
              )}
            />
          </Section>

          {/* Fotos */}
          <Section id="fotos" title="Fotos" count={fotos.length}>
            <div className="space-y-3">
              <label className={`flex items-center gap-2 w-fit px-3 py-2 border border-dashed border-[#CBD5E1] rounded-lg transition-colors text-sm text-[#64748B] ${enviandoFotos > 0 ? 'opacity-70 cursor-wait' : 'cursor-pointer hover:bg-[#EEF2FF] hover:border-[#4F7CFF]'}`}>
                {enviandoFotos > 0
                  ? <><Loader2 size={15} className="animate-spin" /> Enviando {enviandoFotos} {enviandoFotos === 1 ? 'foto' : 'fotos'}…</>
                  : <><Upload size={15} /> Adicionar fotos</>}
                <input type="file" multiple accept="image/*,.heic,.heif" className="hidden" disabled={enviandoFotos > 0} onChange={e => { if (e.target.files) uploadFotos(e.target.files); e.target.value = '' }} />
              </label>
              {fotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {fotos.map(f => (
                    <div key={f.id} className="relative group">
                      <div className="relative w-full aspect-square rounded-lg border border-[#E2E8F0] overflow-hidden">
                        <Image src={f.url} alt="" fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover" />
                      </div>
                      <button onClick={() => removeFoto(f)} aria-label="Excluir foto" title="Excluir foto" className="absolute top-1 right-1 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus:opacity-100 transition-opacity">
                        <X size={14} />
                      </button>
                      <input defaultValue={f.legenda ?? ''} placeholder="Legenda..."
                        onBlur={e => updateLegenda(f.id, e.target.value)}
                        className="w-full mt-1 text-xs px-2 py-1 border border-[#E2E8F0] rounded focus:outline-none focus:border-[#4F7CFF]" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* Assinaturas */}
          <Section id="assinaturas" title="Assinatura Manual" count={assinaturas.length}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[{ tipo: 'marv', label: 'Assinatura — MARV' }, { tipo: 'cliente', label: 'Assinatura — Cliente' }, { tipo: 'fiscal', label: 'Assinatura — Fiscal' }].map(({ tipo, label }) => {
                const ass = assinaturas.find(a => a.tipo === tipo)
                return <PadAssinatura key={tipo} tipo={tipo} label={label} assinatura={ass}
                  onSalvar={salvarAssinatura} onSalvarBlob={salvarAssinaturaBlob} onSalvarNome={salvarNomeAssinante} onRemover={removerAssinatura} saving={saving} />
              })}
            </div>
          </Section>

        </div>

        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-48 shrink-0 bg-white border-l border-[#E2E8F0] sticky top-28 h-fit">
          <div className="p-3">
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2 px-1">Seções</p>
            {[
              { id: 'clima', label: 'Condição climática', count: 0 },
              { id: 'mao-obra', label: 'Mão de obra', count: maoObra.length },
              { id: 'equipamentos', label: 'Equipamentos', count: equipamentos.length },
              { id: 'atividades', label: 'Atividades', count: atividades.length },
              { id: 'ocorrencias', label: 'Ocorrências', count: ocorrencias.length },
              { id: 'comentarios', label: 'Comentários', count: comentarios.length },
              { id: 'fotos', label: 'Fotos', count: fotos.length },
              { id: 'assinaturas', label: 'Aprovação', count: assinaturas.length },
            ].map(s => (
              <button key={s.id} onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors text-left">
                <span>{s.label}</span>
                {s.count > 0 && <span className="bg-[#EEF2FF] text-[#4F7CFF] text-[10px] font-semibold px-1.5 py-0.5 rounded-full">{s.count}</span>}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

// ── Componente Section ────────────────────────────────
function Section({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
  return (
    <div id={id} className="card scroll-mt-28">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#F1F5F9]">
        <h3 className="font-syne font-semibold text-[#0F172A]">{title}</h3>
        {count > 0 && <span className="text-xs font-semibold bg-[#EEF2FF] text-[#4F7CFF] px-2 py-0.5 rounded-full">({count})</span>}
      </div>
      {children}
    </div>
  )
}

// ── Componente GenericAdd ─────────────────────────────
type FieldDef = { key: string; label: string; placeholder?: string; type?: 'text' | 'number' | 'select'; options?: { value: string; label: string }[] }

function ListaComAdd<T extends { id: string }>({ items, fields, onAdd, onEdit, valoresDe, renderItem }: {
  items: T[]; fields: FieldDef[]
  onAdd: (vals: Record<string, string>) => Promise<boolean>
  // Edição inline do item (regra do projeto: todo cadastro pode ser editado)
  onEdit?: (item: T, vals: Record<string, string>) => Promise<boolean>
  valoresDe?: (item: T) => Record<string, string>
  renderItem: (item: T, editar: () => void) => React.ReactNode
}) {
  const [show, setShow] = useState(false)
  const [vals, setVals] = useState<Record<string, string>>({})
  const [editId, setEditId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  function fechar() { setShow(false); setEditId(null); setVals({}) }

  async function handleSalvar() {
    const main = fields[0]
    if (!vals[main.key]?.trim() || salvando) return
    setSalvando(true)
    const item = editId ? items.find(i => i.id === editId) : null
    // Só fecha o formulário se gravou — em caso de erro o texto digitado fica
    const ok = item && onEdit ? await onEdit(item, vals) : await onAdd(vals)
    setSalvando(false)
    if (ok) fechar()
  }

  function abrirEdicao(item: T) {
    setShow(false)
    setEditId(item.id)
    setVals(valoresDe ? valoresDe(item) : {})
  }

  const formulario = (
    <div className="p-3 border border-[#E2E8F0] rounded-lg bg-white space-y-2">
      {fields.map(f => (
        <div key={f.key}>
          <label className="text-xs text-[#64748B] mb-1 block">{f.label}</label>
          {f.type === 'select' ? (
            <select className="field text-sm" value={vals[f.key] ?? ''} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}>
              {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input type={f.type ?? 'text'} className="field text-sm" placeholder={f.placeholder}
              {...(f.type === 'number' ? { inputMode: 'numeric' as const, min: 0, max: 100 } : {})}
              value={vals[f.key] ?? ''} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSalvar()} autoFocus={f === fields[0]} />
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={handleSalvar} disabled={salvando} className="btn-primary text-sm py-1.5 px-3">
          {salvando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {salvando ? 'Salvando…' : editId ? 'Salvar' : 'Adicionar'}
        </button>
        <button onClick={fechar} disabled={salvando} className="text-sm text-[#64748B] hover:text-[#374151] px-2">Cancelar</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-2">
      {items.map(item => item.id === editId
        ? <div key={item.id}>{formulario}</div>
        : renderItem(item, () => abrirEdicao(item)))}
      {show ? formulario : (
        <button onClick={() => { setEditId(null); setVals({}); setShow(true) }} className="flex items-center gap-1.5 text-sm text-[#4F7CFF] hover:bg-[#EEF2FF] px-2 py-1.5 rounded-lg transition-colors">
          <Plus size={14} /> Adicionar
        </button>
      )}
    </div>
  )
}

// ── Pad de Assinatura ─────────────────────────────────
function PadAssinatura({ tipo, label, assinatura, onSalvar, onSalvarBlob, onSalvarNome, onRemover, saving }: {
  tipo: string; label: string; assinatura?: RDOAssinatura
  onSalvar: (tipo: string, nome: string, ref: React.RefObject<HTMLCanvasElement>) => Promise<boolean>
  onSalvarBlob: (tipo: string, nome: string, blob: Blob) => Promise<boolean>
  onSalvarNome: (tipo: string, nome: string) => Promise<void>
  onRemover: (tipo: string) => Promise<boolean>
  saving: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const [modo, setModo] = useState<'idle' | 'tela'>('idle')
  const [showMenu, setShowMenu] = useState(false)
  const [temDesenho, setTemDesenho] = useState(false)
  const [nome, setNome] = useState(assinatura?.nome ?? '')

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) { e.preventDefault(); isDrawing.current = true; lastPos.current = getPos(e); setTemDesenho(true) }
  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!isDrawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#0F172A'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke()
    lastPos.current = pos
  }
  function stopDraw(e: React.MouseEvent | React.TouchEvent) { e.preventDefault(); isDrawing.current = false }

  function limpar() {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !canvasRef.current) return
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    setTemDesenho(false)
  }

  async function handleImagem(fileOriginal: File) {
    setShowMenu(false)
    try {
      const file = await converterSeForHeic(fileOriginal)
      const blob = new Blob([await file.arrayBuffer()], { type: file.type })
      if (await onSalvarBlob(tipo, nome, blob)) setModo('idle')
    } catch (e) {
      alert(mensagemErro(e as Error, 'Não foi possível ler a imagem'))
    }
  }

  async function salvarTela() {
    // Depois de salvar volta a mostrar a assinatura gravada
    if (await onSalvar(tipo, nome, canvasRef)) { setModo('idle'); setTemDesenho(false) }
  }

  const assinado = !!assinatura?.assinatura_url

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[#64748B]">{label}</p>

      {assinado && modo === 'idle' ? (
        <div className="relative border border-[#E2E8F0] rounded-lg overflow-hidden bg-white p-2 w-full h-20">
          <Image src={assinatura!.assinatura_url!} alt="assinatura" fill sizes="300px" className="object-contain" />
        </div>
      ) : modo === 'tela' ? (
        <div className="border-2 border-[#4F7CFF] rounded-lg overflow-hidden bg-white touch-none" style={{ cursor: 'crosshair' }}>
          <canvas ref={canvasRef} width={300} height={80} className="w-full"
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
        </div>
      ) : (
        <div className="border-2 border-dashed border-[#E2E8F0] rounded-lg bg-[#F8FAFC] h-20 flex items-center justify-center text-xs text-[#94A3B8]">
          Sem assinatura
        </div>
      )}

      <input className="field text-xs" placeholder="Nome do assinante" value={nome} onChange={e => setNome(e.target.value)}
        onBlur={() => { if (assinado && modo === 'idle') onSalvarNome(tipo, nome.trim()) }} />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <button onClick={() => setShowMenu(s => !s)} disabled={saving}
            className="w-full text-xs font-medium py-1.5 bg-[#4F7CFF] text-white rounded-lg hover:bg-[#3D6AE8] transition-colors flex items-center justify-center gap-1">
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Pencil size={11} />} Assinar
          </button>
          {showMenu && (
            <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-50 py-1 text-xs min-w-[180px]">
              <button onClick={() => { setModo('tela'); setShowMenu(false); limpar() }}
                className="w-full text-left px-3 py-2 hover:bg-[#F8FAFC] text-[#374151]">✏️ Assinatura em tela</button>
              <label className="w-full text-left px-3 py-2 hover:bg-[#F8FAFC] text-[#374151] flex items-center cursor-pointer">
                🖼️ Selecionar imagem
                <input type="file" accept="image/*,.heic,.heif" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImagem(f) }} />
              </label>
              {assinado && (
                <button onClick={async () => { setShowMenu(false); if (await onRemover(tipo)) setModo('idle') }}
                  className="w-full text-left px-3 py-2 hover:bg-[#F8FAFC] text-red-500">🗑️ Remover assinatura</button>
              )}
            </div>
          )}
        </div>
        {modo === 'tela' && (
          <>
            {temDesenho && (
              <button onClick={salvarTela} disabled={saving}
                className="text-xs font-medium px-2.5 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-1 disabled:opacity-60">
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} {saving ? 'Salvando…' : 'Salvar'}
              </button>
            )}
            <button onClick={() => { limpar(); setModo('idle') }} aria-label="Cancelar assinatura" title="Cancelar" className="text-xs text-[#64748B] hover:text-red-500 p-2"><X size={13} /></button>
          </>
        )}
      </div>
    </div>
  )
}
