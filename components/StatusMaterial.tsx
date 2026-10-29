'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Settings, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mensagemErro } from '@/lib/erros'

// Status (tags) dos materiais da obra — configuráveis na tabela obra_material_status.
export type StatusMaterial = { chave: string; label: string; cor: string; ordem: number; sistema: boolean }

// Usado enquanto a tabela não carrega (ou se a migration ainda não foi aplicada)
export const STATUS_MATERIAL_PADRAO: StatusMaterial[] = [
  { chave: 'pendente',    label: 'Pendente',    cor: '#475569', ordem: 10, sistema: true },
  { chave: 'orcado',      label: 'Orçado',      cor: '#B45309', ordem: 20, sistema: true },
  { chave: 'comprado',    label: 'Comprado',    cor: '#C2410C', ordem: 30, sistema: true },
  { chave: 'em_transito', label: 'Em trânsito', cor: '#1D4ED8', ordem: 40, sistema: true },
  { chave: 'recebido',    label: 'Recebido',    cor: '#0F766E', ordem: 50, sistema: true },
  { chave: 'em_obra',     label: 'Em obra',     cor: '#6D28D9', ordem: 60, sistema: true },
  { chave: 'instalado',   label: 'Instalado',   cor: '#047857', ordem: 70, sistema: true },
]

const CORES = ['#475569', '#B45309', '#C2410C', '#DC2626', '#DB2777', '#6D28D9', '#1D4ED8', '#0891B2', '#0F766E', '#047857', '#65A30D', '#CA8A04']

// Cache compartilhado entre todos os componentes da página
let cache: StatusMaterial[] | null = null
let carregando: Promise<void> | null = null
const ouvintes = new Set<(l: StatusMaterial[]) => void>()

async function carregar() {
  const { data, error } = await createClient().from('obra_material_status').select('chave, label, cor, ordem, sistema').order('ordem')
  cache = !error && data && data.length ? data as StatusMaterial[] : STATUS_MATERIAL_PADRAO
  ouvintes.forEach(fn => fn(cache!))
}

export function recarregarStatusMaterial() {
  carregando = carregar()
  return carregando
}

export function useStatusMaterial() {
  const [lista, setLista] = useState<StatusMaterial[]>(cache ?? STATUS_MATERIAL_PADRAO)
  useEffect(() => {
    ouvintes.add(setLista)
    if (cache) setLista(cache)
    else if (!carregando) recarregarStatusMaterial()
    return () => { ouvintes.delete(setLista) }
  }, [])
  const mapa = Object.fromEntries(lista.map(s => [s.chave, s]))
  const info = (chave?: string | null): StatusMaterial =>
    (chave && mapa[chave]) || { chave: chave ?? 'pendente', label: chave ?? 'Pendente', cor: '#475569', ordem: 0, sistema: false }
  return { lista, info }
}

export function StatusMaterialBadge({ chave, className = '' }: { chave?: string | null; className?: string }) {
  const { info } = useStatusMaterial()
  const s = info(chave)
  return (
    <span className={`font-bold px-2 py-0.5 rounded-full ${className}`} style={{ backgroundColor: `${s.cor}1A`, color: s.cor }}>
      {s.label}
    </span>
  )
}

function gerarChave(label: string, existentes: string[]) {
  const base = label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'status'
  let chave = base, n = 2
  while (existentes.includes(chave)) chave = `${base}_${n++}`
  return chave
}

export function StatusMaterialPicker({ value, onChange }: { value: string; onChange: (chave: string) => void }) {
  const { lista } = useStatusMaterial()
  const [gerenciar, setGerenciar] = useState(false)
  const [editando, setEditando] = useState<StatusMaterial | 'novo' | null>(null)
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(CORES[5])
  const [salvando, setSalvando] = useState(false)
  const sb = createClient()

  function abrirForm(s: StatusMaterial | 'novo') {
    setEditando(s)
    setNome(s === 'novo' ? '' : s.label)
    setCor(s === 'novo' ? CORES[5] : s.cor)
  }

  async function salvar() {
    const label = nome.trim()
    if (!label || !editando) return
    setSalvando(true)
    const { error } = editando === 'novo'
      ? await sb.from('obra_material_status').insert({
          chave: gerarChave(label, lista.map(s => s.chave)), label, cor,
          ordem: Math.max(0, ...lista.map(s => s.ordem)) + 10,
        })
      : await sb.from('obra_material_status').update({ label, cor }).eq('chave', editando.chave)
    setSalvando(false)
    if (error) { alert('Erro ao salvar tag: ' + mensagemErro(error)); return }
    setEditando(null)
    await recarregarStatusMaterial()
  }

  async function mover(i: number, dir: -1 | 1) {
    const a = lista[i], b = lista[i + dir]
    if (!a || !b) return
    // Se duas tags tiverem a mesma ordem, a troca não teria efeito — usa a posição na lista
    const oa = a.ordem === b.ordem ? (i + dir) * 10 : b.ordem
    const ob = a.ordem === b.ordem ? i * 10 : a.ordem
    const r = await Promise.all([
      sb.from('obra_material_status').update({ ordem: oa }).eq('chave', a.chave),
      sb.from('obra_material_status').update({ ordem: ob }).eq('chave', b.chave),
    ])
    const erro = r.find(x => x.error)?.error
    if (erro) alert('Erro ao reordenar: ' + mensagemErro(erro))
    await recarregarStatusMaterial()
  }

  async function excluir(s: StatusMaterial) {
    const { count } = await sb.from('obra_materiais').select('id', { count: 'exact', head: true }).eq('status', s.chave)
    if (count) { alert(`${count} material(is) usam a tag "${s.label}". Mude o status deles antes de excluir.`); return }
    if (!confirm(`Excluir a tag "${s.label}"?`)) return
    const { error } = await sb.from('obra_material_status').delete().eq('chave', s.chave)
    if (error) { alert('Erro ao excluir: ' + mensagemErro(error)); return }
    if (value === s.chave) onChange('pendente')
    await recarregarStatusMaterial()
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        {lista.map(s => (
          <button key={s.chave} type="button" onClick={() => onChange(s.chave)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full border-2 transition-all"
            style={value === s.chave
              ? { borderColor: s.cor, backgroundColor: `${s.cor}1A`, color: s.cor }
              : { borderColor: '#E2E8F0', color: '#64748B' }}>
            {s.label}
          </button>
        ))}
        <button type="button" onClick={() => { setGerenciar(true); abrirForm('novo') }}
          className="text-xs font-semibold px-3 py-1.5 rounded-full border-2 border-dashed border-[#CBD5E1] text-[#64748B] hover:border-[#4F7CFF] hover:text-[#4F7CFF] flex items-center gap-1">
          <Plus size={12} /> Nova tag
        </button>
        <button type="button" onClick={() => { setGerenciar(g => !g); setEditando(null) }} title="Editar tags" aria-label="Editar tags"
          className="text-xs px-2 py-1.5 rounded-full text-[#94A3B8] hover:text-[#4F7CFF] hover:bg-[#EEF2FF]">
          <Settings size={14} />
        </button>
      </div>

      {gerenciar && (
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#475569]">Tags de status</span>
            <button type="button" onClick={() => { setGerenciar(false); setEditando(null) }} aria-label="Fechar" className="text-[#94A3B8] hover:text-[#475569]"><X size={14} /></button>
          </div>

          {editando && (
            <div className="rounded-lg bg-white border border-[#E2E8F0] p-3 space-y-2">
              <input autoFocus className="field" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome da tag (ex: Em obra)"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); salvar() } }} />
              <div className="flex gap-1.5 flex-wrap">
                {CORES.map(c => (
                  <button key={c} type="button" onClick={() => setCor(c)} aria-label={`Cor ${c}`}
                    className={`w-6 h-6 rounded-full border-2 ${cor === c ? 'border-[#0F172A]' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setEditando(null)} className="text-xs px-3 py-1.5 rounded-lg text-[#64748B] hover:bg-[#F1F5F9]">Cancelar</button>
                <button type="button" onClick={salvar} disabled={salvando || !nome.trim()} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#4F7CFF] text-white disabled:opacity-50">
                  {salvando ? 'Salvando...' : editando === 'novo' ? 'Criar tag' : 'Salvar'}
                </button>
              </div>
            </div>
          )}

          <ul className="space-y-1">
            {lista.map((s, i) => (
              <li key={s.chave} className="flex items-center gap-2 bg-white rounded-lg px-2 py-1.5 border border-[#F1F5F9]">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.cor }} />
                <span className="text-sm text-[#0F172A] flex-1 truncate">{s.label}</span>
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${s.label}`} className="p-1 text-[#94A3B8] hover:text-[#4F7CFF] disabled:opacity-30"><ArrowUp size={13} /></button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === lista.length - 1} aria-label={`Descer ${s.label}`} className="p-1 text-[#94A3B8] hover:text-[#4F7CFF] disabled:opacity-30"><ArrowDown size={13} /></button>
                <button type="button" onClick={() => abrirForm(s)} aria-label={`Editar ${s.label}`} className="p-1 text-[#94A3B8] hover:text-[#4F7CFF]"><Pencil size={13} /></button>
                {!s.sistema && (
                  <button type="button" onClick={() => excluir(s)} aria-label={`Excluir ${s.label}`} className="p-1 text-[#94A3B8] hover:text-red-500"><Trash2 size={13} /></button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
