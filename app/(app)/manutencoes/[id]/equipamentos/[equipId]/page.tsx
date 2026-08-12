'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Upload, CheckCircle2, XCircle, Plus, Trash2, Wrench, AlertTriangle, Pencil, X, Check, QrCode, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { converterSeForHeic } from '@/lib/utils/heic'
import { validarPdf } from '@/lib/utils/pdf'
import { sanitizarNomeArquivo } from '@/lib/utils/nomeArquivo'
import { Equipamento, ManutencaoHistorico } from '@/lib/types'

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtDate(d?: string | null) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—' }
function competenciaLabel(c: string) {
  const [ano, mes] = c.split('-')
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${meses[parseInt(mes) - 1]} / ${ano}`
}

function QrModal({ equipId }: { equipId: string }) {
  const [open, setOpen] = useState(false)
  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/pub/equipamento/${equipId}`
    : ''
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(url)}`

  return (
    <>
      <div className="flex justify-end">
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0] px-3 py-1.5 rounded-xl hover:bg-white transition-colors">
          <QrCode size={13} /> QR Code da ficha
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-col items-center gap-4 max-w-xs w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-syne font-semibold text-[#0F172A]">QR Code da Ficha</h3>
            <img src={qrSrc} alt="QR Code" className="w-56 h-56 rounded-xl" />
            <p className="text-xs text-[#94A3B8] text-center">Escaneie para ver a ficha técnica e histórico deste equipamento</p>
            <div className="flex gap-2 w-full">
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center text-xs text-[#4F7CFF] border border-[#C7D2FE] px-3 py-2 rounded-lg hover:bg-[#EEF2FF] transition-colors">
                Abrir ficha
              </a>
              <a href={`/pub/etiqueta/${equipId}`} target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center text-xs bg-[#4F7CFF] text-white px-3 py-2 rounded-lg hover:bg-[#3D68F0] transition-colors">
                Imprimir etiqueta
              </a>
            </div>
            <button onClick={() => setOpen(false)} className="text-xs text-[#94A3B8] hover:text-[#64748B]">Fechar</button>
          </div>
        </div>
      )}
    </>
  )
}

interface Campo { id: string; nome: string; unidade: string | null; ordem: number }
interface Dado { id: string; campo_id: string; valor: string; campo: Campo }

function DadosTecnicos({ equipId }: { equipId: string }) {
  const [todos, setTodos] = useState<Campo[]>([])
  const [dados, setDados] = useState<Dado[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [novoCampo, setNovoCampo] = useState('')
  const [editando, setEditando] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  async function load() {
    const sb = createClient()
    const [{ data: c }, { data: d }] = await Promise.all([
      sb.from('campos_tecnicos').select('*').order('ordem').order('nome'),
      sb.from('equipamento_dados').select('*, campo:campos_tecnicos(*)').eq('equipamento_id', equipId),
    ])
    setTodos((c ?? []) as Campo[])
    setDados((d ?? []) as Dado[])
  }

  useEffect(() => { load() }, [equipId])

  const dadosCampoIds = new Set(dados.map(d => d.campo_id))
  const disponiveis = todos.filter(c => !dadosCampoIds.has(c.id))

  async function adicionarCampo(campo: Campo) {
    const { data } = await createClient().from('equipamento_dados').insert({
      equipamento_id: equipId, campo_id: campo.id, valor: '',
    }).select('*, campo:campos_tecnicos(*)').single()
    if (data) setDados(prev => [...prev, data as Dado])
    setShowPicker(false)
  }

  async function criarEAdicionar() {
    if (!novoCampo.trim()) return
    const sb = createClient()
    const { data: campo } = await sb.from('campos_tecnicos').insert({
      nome: novoCampo.trim(), ordem: todos.length,
    }).select().single()
    if (!campo) return
    setTodos(prev => [...prev, campo as Campo])
    await adicionarCampo(campo as Campo)
    setNovoCampo('')
  }

  async function salvarValor(dado: Dado) {
    const valor = editando[dado.id] ?? dado.valor
    setSalvando(dado.id)
    await createClient().from('equipamento_dados').update({ valor }).eq('id', dado.id)
    setDados(prev => prev.map(d => d.id === dado.id ? { ...d, valor } : d))
    setEditando(prev => { const n = { ...prev }; delete n[dado.id]; return n })
    setSalvando(null)
  }

  async function removerDado(dadoId: string) {
    await createClient().from('equipamento_dados').delete().eq('id', dadoId)
    setDados(prev => prev.filter(d => d.id !== dadoId))
  }

  return (
    <div className="card md:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-syne font-semibold text-[#0F172A] text-sm">Dados Técnicos</h3>
        <button onClick={() => setShowPicker(v => !v)}
          className="flex items-center gap-1 text-xs text-[#4F7CFF] hover:text-[#3D68F0] font-medium px-2 py-1 rounded-lg hover:bg-[#EEF2FF] transition-colors">
          <Plus size={12} /> Adicionar campo
        </button>
      </div>

      {/* Picker de campos */}
      {showPicker && (
        <div className="mb-4 border border-[#E2E8F0] rounded-xl overflow-hidden">
          {disponiveis.length > 0 && (
            <div className="divide-y divide-[#F1F5F9] max-h-48 overflow-y-auto">
              {disponiveis.map(c => (
                <button key={c.id} onClick={() => adicionarCampo(c)}
                  className="w-full text-left px-4 py-2.5 text-sm text-[#0F172A] hover:bg-[#F8FAFC] flex items-center justify-between group transition-colors">
                  <span>{c.nome}{c.unidade ? ` (${c.unidade})` : ''}</span>
                  <Plus size={13} className="text-[#4F7CFF] opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 p-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
            <input
              autoFocus
              className="field text-sm py-1.5 flex-1"
              placeholder="Criar novo campo..."
              value={novoCampo}
              onChange={e => setNovoCampo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') criarEAdicionar(); if (e.key === 'Escape') setShowPicker(false) }}
            />
            <button onClick={criarEAdicionar} disabled={!novoCampo.trim()}
              className="px-3 py-1.5 text-xs bg-[#4F7CFF] text-white rounded-lg hover:bg-[#3D68F0] disabled:opacity-50 shrink-0">
              Criar e adicionar
            </button>
          </div>
        </div>
      )}

      {dados.length === 0 && !showPicker ? (
        <p className="text-sm text-[#94A3B8] text-center py-6">Nenhum dado técnico adicionado ainda</p>
      ) : (
        <div className="space-y-2">
          {dados.map(d => {
            const isEditing = d.id in editando
            const valor = isEditing ? editando[d.id] : d.valor
            return (
              <div key={d.id} className="flex items-center gap-3 group">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[#94A3B8] mb-0.5">
                    {d.campo.nome}{d.campo.unidade ? ` (${d.campo.unidade})` : ''}
                  </p>
                  {isEditing ? (
                    <input
                      autoFocus
                      className="field text-sm py-1"
                      value={valor}
                      onChange={e => setEditando(prev => ({ ...prev, [d.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') salvarValor(d); if (e.key === 'Escape') setEditando(prev => { const n = { ...prev }; delete n[d.id]; return n }) }}
                    />
                  ) : (
                    <p className="text-sm font-medium text-[#0F172A]">{d.valor || <span className="text-[#94A3B8] italic">—</span>}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <button onClick={() => salvarValor(d)} disabled={salvando === d.id}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#D1FAE5] text-[#059669]">
                        <Check size={13} />
                      </button>
                      <button onClick={() => setEditando(prev => { const n = { ...prev }; delete n[d.id]; return n })}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F1F5F9] text-[#94A3B8]">
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setEditando(prev => ({ ...prev, [d.id]: d.valor }))}
                        className="w-7 h-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#4F7CFF] transition-all">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => removerDado(d.id)}
                        className="w-7 h-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-[#94A3B8] hover:text-red-400 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function EquipamentoPage() {
  const { id: contratoId, equipId } = useParams<{ id: string; equipId: string }>()
  const router = useRouter()
  const [equip, setEquip] = useState<Equipamento | null>(null)
  const [historico, setHistorico] = useState<ManutencaoHistorico[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [uploadingManual, setUploadingManual] = useState(false)
  const [erroManual, setErroManual] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [fComp, setFComp] = useState('')
  const [fPrev, setFPrev] = useState(false)
  const [fCorr, setFCorr] = useState(false)
  const [fCorrDesc, setFCorrDesc] = useState('')
  const [fCorrCusto, setFCorrCusto] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function load() {
    const sb = createClient()
    const [{ data: e }, { data: h }] = await Promise.all([
      sb.from('equipamentos').select('*').eq('id', equipId).single(),
      sb.from('manutencao_historico').select('*').eq('equipamento_id', equipId).order('competencia', { ascending: false }),
    ])
    setEquip(e as Equipamento)
    setHistorico((h ?? []) as ManutencaoHistorico[])
    setLoading(false)
  }

  useEffect(() => { load() }, [equipId])

  async function uploadFoto(fileOriginal: File) {
    setUploadingFoto(true)
    const file = await converterSeForHeic(fileOriginal)
    const ext = file.name.split('.').pop()
    const path = `equipamentos/${equipId}.${ext}`
    const sb = createClient()
    await sb.storage.from('marv-manutencao').upload(path, file, { upsert: true })
    const { data } = sb.storage.from('marv-manutencao').getPublicUrl(path)
    await sb.from('equipamentos').update({ foto_url: data.publicUrl }).eq('id', equipId)
    setUploadingFoto(false)
    load()
  }

  async function uploadManual(file: File) {
    const erro = validarPdf(file)
    if (erro) { setErroManual(erro); return }
    setUploadingManual(true)
    setErroManual('')
    const path = `equipamentos/${equipId}_manual_${Date.now()}_${sanitizarNomeArquivo(file.name)}`
    const sb = createClient()
    const { error: err } = await sb.storage.from('marv-manutencao').upload(path, file, { upsert: true })
    if (!err) {
      const { data } = sb.storage.from('marv-manutencao').getPublicUrl(path)
      await sb.from('equipamentos').update({ manual_url: data.publicUrl, manual_nome: file.name }).eq('id', equipId)
      load()
    } else {
      setErroManual(err.message)
    }
    setUploadingManual(false)
  }

  async function salvarManutencao() {
    if (!fComp) return
    setSalvando(true)
    await createClient().from('manutencao_historico').insert({
      equipamento_id: equipId,
      competencia: fComp,
      preventiva_feita: fPrev,
      corretiva: fCorr,
      corretiva_descricao: fCorr && fCorrDesc ? fCorrDesc : null,
      corretiva_custo: fCorr && fCorrCusto ? parseFloat(fCorrCusto) : null,
    })
    setFComp(''); setFPrev(false); setFCorr(false); setFCorrDesc(''); setFCorrCusto('')
    setShowForm(false)
    setSalvando(false)
    load()
  }

  async function excluirManutencao(hId: string) {
    if (!confirm('Excluir registro?')) return
    await createClient().from('manutencao_historico').delete().eq('id', hId)
    load()
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-6 h-6 border-2 border-[#4F7CFF] border-t-transparent rounded-full animate-spin" /></div>
  if (!equip) return <div className="p-8 text-center text-[#94A3B8]">Equipamento não encontrado.</div>

  const tipoColor: Record<string, string> = {
    Split: 'bg-[#EEF2FF] text-[#4F7CFF]',
    Cassete: 'bg-[#D1FAE5] text-[#059669]',
    VRF: 'bg-[#FEF3C7] text-[#D97706]',
    Janela: 'bg-[#FCE7F3] text-[#DB2777]',
    'Piso-teto': 'bg-[#E0E7FF] text-[#4338CA]',
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <div className="bg-white border-b border-[#E2E8F0] px-4 md:px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.push(`/manutencoes/${contratoId}?tab=equipamentos`)} className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A] mb-3 transition-colors">
            <ArrowLeft size={15} /> Equipamentos
          </button>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tipoColor[equip.tipo] ?? 'bg-[#F1F5F9] text-[#64748B]'}`}>{equip.tipo}</span>
            <h1 className="font-syne font-bold text-xl text-[#0F172A]">{equip.nome}</h1>
          </div>
        </div>
      </div>

      <main className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full space-y-6">

        <QrModal equipId={equipId} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Foto */}
          <div className="card p-0 overflow-hidden relative min-h-[220px] flex flex-col">
            {equip.foto_url ? (
              <img src={equip.foto_url} alt={equip.nome} className="w-full h-full object-cover flex-1" style={{ minHeight: 220 }} />
            ) : (
              <div className="flex-1 bg-[#F1F5F9] flex items-center justify-center" style={{ minHeight: 220 }}>
                <Wrench size={32} className="text-[#CBD5E1]" />
              </div>
            )}
            <label className="absolute bottom-2 right-2 flex items-center gap-1.5 text-xs text-[#4F7CFF] bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow cursor-pointer hover:bg-white transition-colors">
              {uploadingFoto ? 'Enviando...' : <><Upload size={12} /> {equip.foto_url ? 'Trocar foto' : 'Adicionar foto'}</>}
              <input type="file" className="hidden" accept="image/*,.heic,.heif" onChange={e => { const f = e.target.files?.[0]; if (f) uploadFoto(f) }} />
            </label>
          </div>

          {/* Manual de instruções */}
          <div className="card flex flex-col justify-between">
            <div>
              <h3 className="font-syne font-semibold text-[#0F172A] text-sm mb-3">Manual de Instruções</h3>
              {equip.manual_url ? (
                <a href={equip.manual_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#4F7CFF] bg-[#EEF2FF] px-3 py-2 rounded-lg hover:bg-[#E0E7FF] transition-colors">
                  <FileText size={15} className="shrink-0" /> <span className="truncate">{equip.manual_nome || 'Ver manual (PDF)'}</span>
                </a>
              ) : (
                <p className="text-sm text-[#94A3B8]">Nenhum manual anexado</p>
              )}
              {erroManual && <p className="text-xs text-red-500 mt-2">{erroManual}</p>}
            </div>
            <label className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#64748B] border border-[#E2E8F0] px-3 py-2 rounded-lg cursor-pointer hover:bg-[#F8FAFC] transition-colors">
              {uploadingManual ? 'Enviando...' : <><Upload size={12} /> {equip.manual_url ? 'Trocar PDF' : 'Adicionar PDF'}</>}
              <input type="file" className="hidden" accept="application/pdf,.pdf" disabled={uploadingManual}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadManual(f) }} />
            </label>
          </div>

          {/* Dados técnicos dinâmicos */}
          <DadosTecnicos equipId={equipId} />
        </div>

        {/* Histórico */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-syne font-semibold text-[#0F172A]">Histórico de Manutenções</h3>
            <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4F7CFF] hover:bg-[#3D68F0] text-white text-xs font-semibold rounded-lg transition-colors">
              <Plus size={13} /> Registrar
            </button>
          </div>

          {showForm && (
            <div className="bg-[#F8FAFC] rounded-xl p-4 mb-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-[#64748B] block mb-1">Competência (mês) *</label>
                <input type="month" className="field text-sm w-48" value={fComp} onChange={e => setFComp(e.target.value)} />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={fPrev} onChange={e => setFPrev(e.target.checked)} className="w-4 h-4 accent-[#4F7CFF]" />
                  <span className="text-sm font-medium text-[#0F172A]">Preventiva realizada</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={fCorr} onChange={e => setFCorr(e.target.checked)} className="w-4 h-4 accent-[#EF4444]" />
                  <span className="text-sm font-medium text-[#0F172A]">Houve corretiva</span>
                </label>
              </div>
              {fCorr && (
                <div className="space-y-3 pl-4 border-l-2 border-[#FCA5A5]">
                  <div>
                    <label className="text-xs font-medium text-[#64748B] block mb-1">Descrição da corretiva</label>
                    <textarea rows={2} className="field text-sm resize-none" placeholder="O que foi feito..." value={fCorrDesc} onChange={e => setFCorrDesc(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#64748B] block mb-1">Custo adicional (R$)</label>
                    <input type="number" className="field text-sm w-48" placeholder="0,00" value={fCorrCusto} onChange={e => setFCorrCusto(e.target.value)} />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="text-xs text-[#64748B] px-3 py-1.5 hover:bg-white rounded-lg">Cancelar</button>
                <button onClick={salvarManutencao} disabled={salvando || !fComp}
                  className="text-xs bg-[#4F7CFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#3D68F0] disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          )}

          {historico.length === 0 ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">Nenhuma manutenção registrada</p>
          ) : (
            <div className="space-y-3">
              {historico.map(h => (
                <div key={h.id} className="flex items-start gap-3 p-3 border border-[#E2E8F0] rounded-xl">
                  <div className="flex flex-col gap-1 items-center pt-0.5 shrink-0">
                    {h.preventiva_feita ? <CheckCircle2 size={16} className="text-[#10B981]" /> : <XCircle size={16} className="text-[#94A3B8]" />}
                    {h.corretiva && <AlertTriangle size={16} className="text-[#EF4444]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A]">{competenciaLabel(h.competencia)}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${h.preventiva_feita ? 'bg-[#D1FAE5] text-[#059669]' : 'bg-[#F1F5F9] text-[#94A3B8]'}`}>
                        Preventiva {h.preventiva_feita ? 'feita' : 'não feita'}
                      </span>
                      {h.corretiva && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#DC2626]">
                          Corretiva {h.corretiva_custo ? `• ${fmt(h.corretiva_custo)}` : ''}
                        </span>
                      )}
                    </div>
                    {h.corretiva && h.corretiva_descricao && (
                      <p className="text-xs text-[#64748B] mt-1">{h.corretiva_descricao}</p>
                    )}
                  </div>
                  <button onClick={() => excluirManutencao(h.id)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-[#94A3B8] hover:text-red-400 shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
