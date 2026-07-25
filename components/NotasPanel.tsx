'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Pin, Trash2, Plus, Search, Check, ArrowLeft, StickyNote } from 'lucide-react'

interface Nota {
  id: string
  titulo: string
  conteudo: string | null
  pinned: boolean
  updated_at: string
}

function useDebounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback((...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => fn(...args), delay)
  }, [fn, delay])
}

function Toolbar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement> }) {
  const [showCores, setShowCores] = useState(false)
  const coresRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function click(e: MouseEvent) {
      if (coresRef.current && !coresRef.current.contains(e.target as Node)) setShowCores(false)
    }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [])

  function exec(cmd: string, val?: string) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val)
  }

  const CORES = [
    '#0F172A', '#64748B', '#4F7CFF', '#10B981', '#EF4444', '#8B5CF6', '#F59E0B',
  ]

  const btnCls = 'px-2 py-1 rounded-md text-xs font-semibold text-[#374151] hover:bg-[#EEF2FF] transition-colors'

  return (
    <div className="flex items-center gap-0.5 px-3 py-2 border-b border-[#E2E8F0] bg-[#F8FAFC] flex-wrap">
      <button onMouseDown={e => { e.preventDefault(); exec('bold') }} className={btnCls}><b>N</b></button>
      <button onMouseDown={e => { e.preventDefault(); exec('italic') }} className={btnCls}><i>I</i></button>
      <button onMouseDown={e => { e.preventDefault(); exec('underline') }} className={btnCls}><u>S</u></button>
      <button onMouseDown={e => { e.preventDefault(); exec('strikeThrough') }} className={btnCls}><s className="text-xs">T</s></button>
      <div className="w-px h-4 bg-[#E2E8F0] mx-1" />
      <button onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList') }} className={btnCls}>• Lista</button>
      <button onMouseDown={e => { e.preventDefault(); exec('insertOrderedList') }} className={btnCls}>1. Num.</button>
      <div className="w-px h-4 bg-[#E2E8F0] mx-1" />
      <div className="relative" ref={coresRef}>
        <button onMouseDown={e => { e.preventDefault(); setShowCores(v => !v) }} className={btnCls + ' flex items-center gap-1'}>
          <span className="text-xs">A</span>
          <span className="w-3 h-1 rounded-sm" style={{ background: 'linear-gradient(90deg,#4F7CFF,#EF4444,#10B981)' }} />
        </button>
        {showCores && (
          <div className="absolute top-full left-0 z-50 bg-white border border-[#E2E8F0] rounded-xl p-2 flex gap-1.5 shadow-lg mt-1">
            {CORES.map(c => (
              <button key={c} onMouseDown={e => { e.preventDefault(); exec('foreColor', c); setShowCores(false) }}
                className="w-5 h-5 rounded-full border-2 border-white ring-1 ring-[#E2E8F0] hover:scale-110 transition-transform"
                style={{ background: c }} />
            ))}
          </div>
        )}
      </div>
      <button onMouseDown={e => { e.preventDefault(); exec('removeFormat') }} className={btnCls + ' text-[#94A3B8]'}>Limpar</button>
    </div>
  )
}

export default function NotasPanel({ compact = false }: { compact?: boolean }) {
  const [notas, setNotas] = useState<Nota[]>([])
  const [selected, setSelected] = useState<Nota | null>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list')
  const editorRef = useRef<HTMLDivElement>(null)

  async function fetchNotas() {
    const sb = createClient()
    const { data } = await sb.from('notas').select('id,titulo,conteudo,pinned,updated_at')
      .order('pinned', { ascending: false }).order('updated_at', { ascending: false })
    if (data) setNotas(data as Nota[])
  }

  useEffect(() => { fetchNotas() }, [])

  async function saveNota(id: string, tituloVal: string, conteudoVal: string, pinned: boolean) {
    setSaving(true)
    const sb = createClient()
    await sb.from('notas').update({ titulo: tituloVal, conteudo: conteudoVal, pinned, updated_at: new Date().toISOString() }).eq('id', id)
    setSaving(false)
    setNotas(prev => prev.map(n => n.id === id ? { ...n, titulo: tituloVal, conteudo: conteudoVal, updated_at: new Date().toISOString() } : n))
  }

  const debouncedSave = useDebounce((id: string, t: string, c: string, p: boolean) => saveNota(id, t, c, p), 800)

  function onTituloChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setTitulo(val)
    if (selected) debouncedSave(selected.id, val, editorRef.current?.innerHTML ?? '', selected.pinned)
  }

  function onConteudoInput() {
    if (selected) debouncedSave(selected.id, titulo, editorRef.current?.innerHTML ?? '', selected.pinned)
  }

  async function newNota() {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return null
    const { data } = await sb.from('notas').insert({ titulo: 'Nova nota', conteudo: '', user_id: user.id }).select().single()
    if (data) {
      setNotas(prev => [data as Nota, ...prev])
      openNota(data as Nota)
    }
    return data
  }

  function openNota(nota: Nota) {
    setSelected(nota)
    setTitulo(nota.titulo)
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = nota.conteudo ?? ''
        editorRef.current.focus()
      }
    }, 30)
  }

  async function deleteNota(id: string) {
    if (!confirm('Apagar esta nota?')) return
    const sb = createClient()
    await sb.from('notas').delete().eq('id', id)
    setNotas(prev => prev.filter(n => n.id !== id))
    if (selected?.id === id) { setSelected(null); setMobileView('list') }
  }

  async function togglePin(nota: Nota) {
    const pinned = !nota.pinned
    const sb = createClient()
    await sb.from('notas').update({ pinned }).eq('id', nota.id)
    setNotas(prev => [...prev.map(n => n.id === nota.id ? { ...n, pinned } : n)]
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
    if (selected?.id === nota.id) setSelected(s => s ? { ...s, pinned } : s)
  }

  const filtradas = notas.filter(n =>
    !search ||
    n.titulo.toLowerCase().includes(search.toLowerCase()) ||
    (n.conteudo ?? '').replace(/<[^>]*>/g, '').toLowerCase().includes(search.toLowerCase())
  )

  function formatDate(d: string) {
    const dt = new Date(d)
    const diff = (Date.now() - dt.getTime()) / 1000
    if (diff < 60) return 'agora'
    if (diff < 3600) return `${Math.floor(diff / 60)}min`
    if (diff < 86400) return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  const showList = !compact || mobileView === 'list'
  const showEditor = !compact || mobileView === 'editor'

  return (
    <div className={`flex h-full bg-white overflow-hidden ${compact ? 'flex-col' : 'flex-row'}`}>

      {/* ── Lista ── */}
      {showList && (
        <div className={`${compact ? 'w-full' : 'w-[240px] shrink-0 border-r border-[#E2E8F0]'} flex flex-col bg-[#F8FAFC]`}>
          <div className="px-3 py-3 border-b border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-syne font-bold text-sm text-[#0F172A]">Notas</span>
              <button onClick={async () => { const n = await newNota(); if (compact && n) setMobileView('editor') }}
                className="w-7 h-7 rounded-full bg-[#4F7CFF] text-white flex items-center justify-center hover:bg-[#3d6ae0] transition-colors">
                <Plus size={14} />
              </button>
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-white border border-[#E2E8F0] rounded-lg outline-none focus:border-[#4F7CFF] transition-colors" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtradas.length === 0 && (
              <div className="p-4 text-xs text-[#94A3B8] text-center mt-4">
                {search ? 'Nenhuma nota encontrada' : 'Nenhuma nota ainda'}
              </div>
            )}
            {filtradas.map(nota => (
              <button key={nota.id} onClick={() => { openNota(nota); if (compact) setMobileView('editor') }}
                className={`w-full text-left px-3 py-2.5 border-b border-[#F1F5F9] transition-colors border-l-2 ${selected?.id === nota.id ? 'bg-[#EEF2FF] border-l-[#4F7CFF]' : 'hover:bg-white border-l-transparent'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#0F172A] truncate flex items-center gap-1">
                      {nota.pinned && <Pin size={9} className="text-[#4F7CFF] shrink-0" />}
                      {nota.titulo}
                    </p>
                    <p className="text-[11px] text-[#94A3B8] truncate mt-0.5">
                      {(nota.conteudo ?? '').replace(/<[^>]*>/g, '').substring(0, 55) || '—'}
                    </p>
                  </div>
                  <span className="text-[10px] text-[#CBD5E1] shrink-0 pt-0.5">{formatDate(nota.updated_at)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Editor ── */}
      {showEditor && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E2E8F0]">
                {compact && (
                  <button onClick={() => setMobileView('list')} className="text-[#4F7CFF] mr-1">
                    <ArrowLeft size={18} />
                  </button>
                )}
                <input value={titulo} onChange={onTituloChange} placeholder="Título"
                  className="flex-1 text-base font-syne font-bold text-[#0F172A] bg-transparent border-none outline-none" />
                <div className="flex items-center gap-1">
                  {saving && <span className="text-[10px] text-[#94A3B8]">salvando...</span>}
                  <button onClick={() => togglePin(selected)} title={selected.pinned ? 'Desafixar' : 'Fixar'}
                    className={`p-1.5 rounded-lg border transition-colors ${selected.pinned ? 'bg-[#EEF2FF] border-[#4F7CFF] text-[#4F7CFF]' : 'border-[#E2E8F0] text-[#94A3B8] hover:border-[#4F7CFF] hover:text-[#4F7CFF]'}`}>
                    <Pin size={13} />
                  </button>
                  <button onClick={() => deleteNota(selected.id)}
                    className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#94A3B8] hover:border-red-300 hover:text-red-500 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <Toolbar editorRef={editorRef} />
              <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={onConteudoInput}
                className="flex-1 p-4 outline-none text-sm text-[#374151] leading-relaxed overflow-y-auto" />
            </>
          ) : !compact ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#94A3B8]">
              <StickyNote size={36} className="text-[#CBD5E1]" />
              <p className="text-sm font-medium text-[#374151]">Selecione uma nota</p>
              <p className="text-xs">ou clique em + para criar</p>
              <button onClick={newNota} className="mt-2 btn-primary text-sm flex items-center gap-1.5 px-4 py-2">
                <Plus size={14} /> Nova nota
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
