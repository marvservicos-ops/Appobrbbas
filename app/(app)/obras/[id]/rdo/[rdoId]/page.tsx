'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, X, Loader2, Camera, Check, Pencil, Upload, Eraser, Printer, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Obra, RDO, RDOClima, RDOMaoObra, RDOEquipamento, RDOAtividade, RDOOcorrencia, RDOComentario, RDOFoto, RDOAssinatura } from '@/lib/types'
import Link from 'next/link'

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

  async function load() {
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

  async function updateStatus(status: RDO['status']) {
    const supabase = createClient()
    await supabase.from('rdos').update({ status }).eq('id', rdoId)
    setRdo(r => r ? { ...r, status } : r)
    setShowStatusMenu(false)
  }

  async function updateIndice(val: string) {
    const supabase = createClient()
    await supabase.from('rdos').update({ indice_pluviometrico: val || null }).eq('id', rdoId)
  }

  // ── CLIMA ─────────────────────────────────────────────
  async function togglePeriodo(c: RDOClima) {
    const supabase = createClient()
    await supabase.from('rdo_clima').update({ ativo: !c.ativo }).eq('id', c.id)
    setClima(prev => prev.map(x => x.id === c.id ? { ...x, ativo: !x.ativo } : x))
  }

  async function updateClima(c: RDOClima, field: 'tempo' | 'condicao', value: string) {
    const supabase = createClient()
    await supabase.from('rdo_clima').update({ [field]: value }).eq('id', c.id)
    setClima(prev => prev.map(x => x.id === c.id ? { ...x, [field]: value } : x))
  }

  // ── MÃO DE OBRA ───────────────────────────────────────
  async function addMaoObra(funcao: string, tipo: string, quantidade: number) {
    const supabase = createClient()
    const { data } = await supabase.from('rdo_mao_obra').insert({ rdo_id: rdoId, funcao, tipo, quantidade }).select().single()
    if (data) setMaoObra(prev => [...prev, data as RDOMaoObra])
  }

  async function updateQtdMao(id: string, delta: number) {
    const item = maoObra.find(m => m.id === id)
    if (!item) return
    const novaQtd = Math.max(1, item.quantidade + delta)
    const supabase = createClient()
    await supabase.from('rdo_mao_obra').update({ quantidade: novaQtd }).eq('id', id)
    setMaoObra(prev => prev.map(m => m.id === id ? { ...m, quantidade: novaQtd } : m))
  }

  async function removeMaoObra(id: string) {
    const supabase = createClient()
    await supabase.from('rdo_mao_obra').delete().eq('id', id)
    setMaoObra(prev => prev.filter(m => m.id !== id))
  }

  // ── EQUIPAMENTOS ──────────────────────────────────────
  async function addEquipamento(nome: string, quantidade: number) {
    const supabase = createClient()
    const { data } = await supabase.from('rdo_equipamentos').insert({ rdo_id: rdoId, nome, quantidade }).select().single()
    if (data) setEquipamentos(prev => [...prev, data as RDOEquipamento])
  }

  async function updateQtdEq(id: string, delta: number) {
    const item = equipamentos.find(e => e.id === id)
    if (!item) return
    const novaQtd = Math.max(1, item.quantidade + delta)
    const supabase = createClient()
    await supabase.from('rdo_equipamentos').update({ quantidade: novaQtd }).eq('id', id)
    setEquipamentos(prev => prev.map(e => e.id === id ? { ...e, quantidade: novaQtd } : e))
  }

  async function removeEquipamento(id: string) {
    const supabase = createClient()
    await supabase.from('rdo_equipamentos').delete().eq('id', id)
    setEquipamentos(prev => prev.filter(e => e.id !== id))
  }

  // ── ATIVIDADES ────────────────────────────────────────
  async function addAtividade(descricao: string, progresso: number, status_ativ: string) {
    const supabase = createClient()
    const { data } = await supabase.from('rdo_atividades').insert({ rdo_id: rdoId, descricao, progresso, status_ativ, ordem: atividades.length }).select().single()
    if (data) setAtividades(prev => [...prev, data as RDOAtividade])
  }

  async function removeAtividade(id: string) {
    const supabase = createClient()
    await supabase.from('rdo_atividades').delete().eq('id', id)
    setAtividades(prev => prev.filter(a => a.id !== id))
  }

  // ── OCORRÊNCIAS ───────────────────────────────────────
  async function addOcorrencia(descricao: string) {
    const supabase = createClient()
    const { data } = await supabase.from('rdo_ocorrencias').insert({ rdo_id: rdoId, descricao }).select().single()
    if (data) setOcorrencias(prev => [...prev, data as RDOOcorrencia])
  }

  async function removeOcorrencia(id: string) {
    const supabase = createClient()
    await supabase.from('rdo_ocorrencias').delete().eq('id', id)
    setOcorrencias(prev => prev.filter(o => o.id !== id))
  }

  // ── COMENTÁRIOS ───────────────────────────────────────
  async function addComentario(autor: string, texto: string) {
    const supabase = createClient()
    const { data } = await supabase.from('rdo_comentarios').insert({ rdo_id: rdoId, autor, texto }).select().single()
    if (data) setComentarios(prev => [...prev, data as RDOComentario])
  }

  async function removeComentario(id: string) {
    const supabase = createClient()
    await supabase.from('rdo_comentarios').delete().eq('id', id)
    setComentarios(prev => prev.filter(c => c.id !== id))
  }

  // ── FOTOS ─────────────────────────────────────────────
  async function uploadFotos(files: FileList) {
    const supabase = createClient()
    for (const file of Array.from(files)) {
      const path = `${rdoId}/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('rdo-fotos').upload(path, file)
      if (!error) {
        const { data: urlData } = supabase.storage.from('rdo-fotos').getPublicUrl(path)
        const { data } = await supabase.from('rdo_fotos').insert({ rdo_id: rdoId, url: urlData.publicUrl, path, ordem: fotos.length }).select().single()
        if (data) setFotos(prev => [...prev, data as RDOFoto])
      }
    }
  }

  async function updateLegenda(id: string, legenda: string) {
    const supabase = createClient()
    await supabase.from('rdo_fotos').update({ legenda }).eq('id', id)
    setFotos(prev => prev.map(f => f.id === id ? { ...f, legenda } : f))
  }

  async function removeFoto(foto: RDOFoto) {
    const supabase = createClient()
    if (foto.path) await supabase.storage.from('rdo-fotos').remove([foto.path])
    await supabase.from('rdo_fotos').delete().eq('id', foto.id)
    setFotos(prev => prev.filter(f => f.id !== foto.id))
  }

  // ── ASSINATURAS ───────────────────────────────────────
  async function salvarAssinatura(tipo: string, nome: string, canvasRef: React.RefObject<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    setSaving(true)
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
    if (!blob) { setSaving(false); return }
    const supabase = createClient()
    const path = `rdo/${rdoId}/${tipo}_${Date.now()}.png`
    const { error } = await supabase.storage.from('assinaturas').upload(path, blob, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('assinaturas').getPublicUrl(path)
      const existing = assinaturas.find(a => a.tipo === tipo)
      if (existing) {
        await supabase.from('rdo_assinaturas').update({ assinatura_url: urlData.publicUrl, nome, assinado_em: new Date().toISOString() }).eq('id', existing.id)
        setAssinaturas(prev => prev.map(a => a.tipo === tipo ? { ...a, assinatura_url: urlData.publicUrl, nome, assinado_em: new Date().toISOString() } : a))
      } else {
        const { data } = await supabase.from('rdo_assinaturas').insert({ rdo_id: rdoId, tipo, nome, assinatura_url: urlData.publicUrl, assinado_em: new Date().toISOString() }).select().single()
        if (data) setAssinaturas(prev => [...prev, data as RDOAssinatura])
      }
    }
    setSaving(false)
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 size={28} className="animate-spin text-[#4F7CFF]" /></div>
  if (!rdo || !obra) return <div className="p-8 text-center text-[#64748B]">RDO não encontrado.</div>

  const dataRdo = new Date(rdo.data + 'T12:00:00')
  const diaSemana = DIAS_SEMANA[dataRdo.getDay()]
  const sc = STATUS_CONFIG[rdo.status]

  const startDate = obra.data_inicio ? new Date(obra.data_inicio + 'T00:00:00') : null
  const endDate = obra.previsao_termino ? new Date(obra.previsao_termino + 'T00:00:00') : null
  const today = new Date()
  const prazoContratual = startDate && endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) : null
  const prazoDecorrido = startDate ? Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / 86400000)) : null
  const prazoVencer = endDate ? Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / 86400000)) : null

  const periodoLabel: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="h-14 bg-white border-b border-[#E2E8F0] flex items-center px-4 gap-3 sticky top-14 md:top-0 z-20">
        <Link href={`/obras/${obraId}?tab=relatorios`} className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A]">
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
                <div className="grid grid-cols-[100px_1fr_1fr] gap-2 text-xs font-semibold text-[#64748B] px-1">
                  <span>Período</span><span>Tempo</span><span>Condição</span>
                </div>
                {clima.map(c => (
                  <div key={c.id} className={`grid grid-cols-[100px_1fr_1fr] gap-2 items-center p-2 rounded-lg ${c.ativo ? 'bg-[#F8FAFC]' : 'bg-[#F1F5F9] opacity-60'}`}>
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
                <input defaultValue={rdo.indice_pluviometrico ?? ''} placeholder="Ex: 5.30"
                  onBlur={e => updateIndice(e.target.value)}
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
              onAdd={(vals) => addMaoObra(vals.funcao, vals.tipo || 'direta', 1)}
              renderItem={(item) => (
                <div key={item.id} className="flex items-center gap-3 p-2.5 bg-[#F8FAFC] rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{item.funcao}</p>
                    <p className="text-xs text-[#64748B]">{item.tipo === 'direta' ? 'Mão de Obra Direta' : 'Mão de Obra Indireta'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQtdMao(item.id, -1)} className="w-6 h-6 flex items-center justify-center rounded border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] text-xs">−</button>
                    <span className="w-8 text-center text-sm font-semibold">{item.quantidade}</span>
                    <button onClick={() => updateQtdMao(item.id, +1)} className="w-6 h-6 flex items-center justify-center rounded border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] text-xs">+</button>
                  </div>
                  <button onClick={() => removeMaoObra(item.id)} className="text-[#94A3B8] hover:text-red-500 transition-colors"><X size={14} /></button>
                </div>
              )}
            />
          </Section>

          {/* Equipamentos */}
          <Section id="equipamentos" title="Equipamentos" count={equipamentos.length}>
            <ListaComAdd
              items={equipamentos}
              fields={[{ key: 'nome', label: 'Equipamento', placeholder: 'Ex: Manifold digital' }]}
              onAdd={(vals) => addEquipamento(vals.nome, 1)}
              renderItem={(item) => (
                <div key={item.id} className="flex items-center gap-3 p-2.5 bg-[#F8FAFC] rounded-lg">
                  <p className="flex-1 text-sm font-medium text-[#0F172A]">{item.nome}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQtdEq(item.id, -1)} className="w-6 h-6 flex items-center justify-center rounded border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] text-xs">−</button>
                    <span className="w-8 text-center text-sm font-semibold">{item.quantidade}</span>
                    <button onClick={() => updateQtdEq(item.id, +1)} className="w-6 h-6 flex items-center justify-center rounded border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] text-xs">+</button>
                  </div>
                  <button onClick={() => removeEquipamento(item.id)} className="text-[#94A3B8] hover:text-red-500 transition-colors"><X size={14} /></button>
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
                { key: 'progresso', label: 'Progresso (%)', type: 'number', placeholder: '100' },
                { key: 'status_ativ', label: 'Status', type: 'select', options: [
                  { value: 'Concluída', label: 'Concluída' },
                  { value: 'Em andamento', label: 'Em andamento' },
                  { value: 'Pendente', label: 'Pendente' },
                ]},
              ]}
              onAdd={(vals) => addAtividade(vals.descricao, parseInt(vals.progresso) || 100, vals.status_ativ || 'Concluída')}
              renderItem={(item) => (
                <div key={item.id} className="flex items-start gap-3 p-2.5 bg-[#F8FAFC] rounded-lg">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4F7CFF] mt-2 shrink-0" />
                  <p className="flex-1 text-sm text-[#0F172A]">{item.descricao}</p>
                  <span className="text-xs text-[#64748B] whitespace-nowrap shrink-0">{item.progresso}% {item.status_ativ}</span>
                  <button onClick={() => removeAtividade(item.id)} className="text-[#94A3B8] hover:text-red-500 transition-colors shrink-0"><X size={14} /></button>
                </div>
              )}
            />
          </Section>

          {/* Ocorrências */}
          <Section id="ocorrencias" title="Ocorrências" count={ocorrencias.length}>
            <ListaComAdd
              items={ocorrencias}
              fields={[{ key: 'descricao', label: 'Ocorrência', placeholder: 'Descreva a ocorrência...' }]}
              onAdd={(vals) => addOcorrencia(vals.descricao)}
              renderItem={(item) => (
                <div key={item.id} className="flex items-start gap-3 p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                  <p className="flex-1 text-sm text-[#374151]">{item.descricao}</p>
                  <button onClick={() => removeOcorrencia(item.id)} className="text-[#94A3B8] hover:text-red-500 transition-colors"><X size={14} /></button>
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
              onAdd={(vals) => addComentario(vals.autor, vals.texto)}
              renderItem={(item) => (
                <div key={item.id} className="p-3 bg-[#F8FAFC] rounded-lg border border-[#F1F5F9]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[#0F172A]">{item.autor}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#94A3B8]">{new Date(item.created_at).toLocaleString('pt-BR')}</span>
                      <button onClick={() => removeComentario(item.id)} className="text-[#94A3B8] hover:text-red-500 transition-colors"><X size={13} /></button>
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
              <label className="flex items-center gap-2 w-fit cursor-pointer px-3 py-2 border border-dashed border-[#CBD5E1] rounded-lg hover:bg-[#EEF2FF] hover:border-[#4F7CFF] transition-colors text-sm text-[#64748B]">
                <Upload size={15} /> Adicionar fotos
                <input type="file" multiple accept="image/*" className="hidden" onChange={e => { if (e.target.files) uploadFotos(e.target.files); e.target.value = '' }} />
              </label>
              {fotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {fotos.map(f => (
                    <div key={f.id} className="relative group">
                      <img src={f.url} alt="" className="w-full aspect-square object-cover rounded-lg border border-[#E2E8F0]" />
                      <button onClick={() => removeFoto(f)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={12} />
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
                return <PadAssinatura key={tipo} tipo={tipo} label={label} assinatura={ass} onSalvar={salvarAssinatura} saving={saving} />
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

function ListaComAdd<T extends { id: string }>({ items, fields, onAdd, renderItem }: {
  items: T[]; fields: FieldDef[]; onAdd: (vals: Record<string, string>) => void; renderItem: (item: T) => React.ReactNode
}) {
  const [show, setShow] = useState(false)
  const [vals, setVals] = useState<Record<string, string>>({})

  function handleAdd() {
    const main = fields[0]
    if (!vals[main.key]?.trim()) return
    onAdd(vals)
    setVals({})
    setShow(false)
  }

  return (
    <div className="space-y-2">
      {items.map(renderItem)}
      {show ? (
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
                  value={vals[f.key] ?? ''} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()} autoFocus={f === fields[0]} />
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={handleAdd} className="btn-primary text-sm py-1.5 px-3"><Check size={13} /> Adicionar</button>
            <button onClick={() => { setShow(false); setVals({}) }} className="text-sm text-[#64748B] hover:text-[#374151] px-2">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShow(true)} className="flex items-center gap-1.5 text-sm text-[#4F7CFF] hover:bg-[#EEF2FF] px-2 py-1.5 rounded-lg transition-colors">
          <Plus size={14} /> Adicionar
        </button>
      )}
    </div>
  )
}

// ── Pad de Assinatura ─────────────────────────────────
function PadAssinatura({ tipo, label, assinatura, onSalvar, saving }: {
  tipo: string; label: string; assinatura?: RDOAssinatura; onSalvar: (tipo: string, nome: string, ref: React.RefObject<HTMLCanvasElement>) => void; saving: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
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
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
    setTemDesenho(false)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[#64748B]">{label}</p>
      {assinatura?.assinatura_url && !temDesenho ? (
        <div className="border border-[#E2E8F0] rounded-lg overflow-hidden bg-white p-2">
          <img src={assinatura.assinatura_url} alt="assinatura" className="w-full h-20 object-contain" />
        </div>
      ) : (
        <div className="border-2 border-[#E2E8F0] rounded-lg overflow-hidden bg-white touch-none" style={{ cursor: 'crosshair' }}>
          <canvas ref={canvasRef} width={300} height={80} className="w-full"
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
        </div>
      )}
      <input className="field text-xs" placeholder="Nome do assinante" value={nome} onChange={e => setNome(e.target.value)} />
      <div className="flex gap-2">
        <button onClick={() => onSalvar(tipo, nome, canvasRef)} disabled={saving}
          className="flex-1 text-xs font-medium py-1.5 bg-[#4F7CFF] text-white rounded-lg hover:bg-[#3D6AE8] transition-colors flex items-center justify-center gap-1">
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Pencil size={11} />} Assinar
        </button>
        {temDesenho && <button onClick={limpar} className="text-xs text-[#64748B] hover:text-red-500 px-2"><Eraser size={13} /></button>}
      </div>
    </div>
  )
}
