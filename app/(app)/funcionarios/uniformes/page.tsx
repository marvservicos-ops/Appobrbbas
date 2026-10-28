'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import { ArrowLeft, Plus, Pencil, Trash2, X, Loader2, Shirt } from 'lucide-react'
import { mensagemErro } from '@/lib/erros'

interface Categoria {
  id: string
  nome: string
  cor: string
}

interface Peca {
  id: string
  nome: string
}

const CORES_PRESET = [
  '#4F7CFF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
]

export default function UniformesConfigPage() {
  const [tab, setTab] = useState<'categorias' | 'pecas'>('categorias')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [pecas, setPecas] = useState<Peca[]>([])
  const [categoriaPecas, setCategoriaPecas] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [erroLoad, setErroLoad] = useState('')

  async function load() {
    const supabase = createClient()
    const [{ data: cats, error: e1 }, { data: ps, error: e2 }, { data: rels, error: e3 }] = await Promise.all([
      supabase.from('uniforme_categorias').select('id, nome, cor').order('nome'),
      supabase.from('uniforme_pecas').select('id, nome').order('nome'),
      supabase.from('uniforme_categoria_pecas').select('categoria_id, peca_id'),
    ])
    setErroLoad(e1 || e2 || e3 ? mensagemErro(e1 || e2 || e3, 'Falha ao carregar uniformes') : '')
    setCategorias(cats ?? [])
    setPecas(ps ?? [])
    const map: Record<string, string[]> = {}
    for (const r of rels ?? []) {
      map[r.categoria_id] = map[r.categoria_id] ?? []
      map[r.categoria_id].push(r.peca_id)
    }
    setCategoriaPecas(map)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="p-4 md:p-6 flex-1 overflow-y-auto max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/funcionarios" aria-label="Voltar para Funcionários" title="Voltar" className="p-2 -ml-2 text-[#64748B] hover:text-[#0F172A]"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="font-syne font-bold text-xl md:text-2xl text-[#0F172A]">Uniformes</h1>
            <p className="text-sm text-[#64748B] mt-1">Categorias de funcionário (ex: Chão de Fábrica, Corpo Técnico) e as peças de uniforme de cada uma.</p>
          </div>
        </div>

        <div className="flex gap-2 mb-5">
          {(['categorias', 'pecas'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t ? 'bg-[#4F7CFF] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}>
              {t === 'categorias' ? 'Categorias' : 'Peças de Uniforme'}
            </button>
          ))}
        </div>

        {erroLoad && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-3 mb-4">
            <span className="flex-1">{erroLoad}</span>
            <button onClick={load} className="font-semibold underline shrink-0">Tentar de novo</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={22} className="animate-spin text-[#4F7CFF]" />
          </div>
        ) : tab === 'categorias' ? (
          <GerenciarCategorias categorias={categorias} pecas={pecas} categoriaPecas={categoriaPecas} onChanged={load} />
        ) : (
          <GerenciarPecas pecas={pecas} onChanged={load} />
        )}
      </div>
    </div>
  )
}

function GerenciarCategorias({ categorias, pecas, categoriaPecas, onChanged }: {
  categorias: Categoria[]
  pecas: Peca[]
  categoriaPecas: Record<string, string[]>
  onChanged: () => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Categoria | null>(null)

  async function deletar(cat: Categoria) {
    const supabase = createClient()
    // Conta antes: a FK funcionarios.categoria_uniforme_id impede excluir categoria em uso
    const { count, error: errCount } = await supabase
      .from('funcionarios').select('id', { count: 'exact', head: true }).eq('categoria_uniforme_id', cat.id)
    if (errCount) { alert(mensagemErro(errCount, 'Falha ao verificar a categoria')); return }
    const emUso = count ?? 0
    const msg = emUso > 0
      ? `A categoria "${cat.nome}" está em uso por ${emUso} funcionário${emUso > 1 ? 's' : ''}. Remover mesmo assim? Eles ficarão sem categoria de uniforme.`
      : `Remover a categoria "${cat.nome}"?`
    if (!confirm(msg)) return
    if (emUso > 0) {
      const { error } = await supabase.from('funcionarios').update({ categoria_uniforme_id: null }).eq('categoria_uniforme_id', cat.id)
      if (error) { alert(mensagemErro(error, 'Falha ao desvincular os funcionários')); return }
    }
    const { error } = await supabase.from('uniforme_categorias').delete().eq('id', cat.id)
    if (error) { alert(mensagemErro(error, 'Falha ao remover categoria')); return }
    onChanged()
  }

  return (
    <div className="space-y-4">
      <button onClick={() => { setEditando(null); setShowModal(true) }}
        className="w-full flex items-center gap-2 justify-center py-3 border-2 border-dashed border-[#E2E8F0] rounded-xl text-sm text-[#64748B] hover:border-[#4F7CFF] hover:text-[#4F7CFF] transition-colors">
        <Plus size={16} /> Nova categoria
      </button>

      {categorias.length === 0 ? (
        <p className="text-sm text-[#94A3B8] text-center py-8">Nenhuma categoria criada ainda.</p>
      ) : (
        <div className="card p-0 overflow-hidden divide-y divide-[#F8FAFC]">
          {categorias.map(cat => {
            const pecasCat = pecas.filter(p => (categoriaPecas[cat.id] ?? []).includes(p.id))
            return (
              <div key={cat.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFA] group transition-colors">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: cat.cor + '25' }}>
                  <Shirt size={16} style={{ color: cat.cor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0F172A]">{cat.nome}</p>
                  <p className="text-xs text-[#94A3B8] truncate">
                    {pecasCat.length > 0 ? pecasCat.map(p => p.nome).join(', ') : 'Nenhuma peça vinculada'}
                  </p>
                </div>
                <div className="flex gap-1 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditando(cat); setShowModal(true) }} aria-label={`Editar ${cat.nome}`} title="Editar"
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#EEF2FF]">
                    <Pencil size={12} className="text-[#4F7CFF]" />
                  </button>
                  <button onClick={() => deletar(cat)} aria-label={`Remover ${cat.nome}`} title="Remover"
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50">
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <ModalCategoria
          categoria={editando}
          pecas={pecas}
          pecasSelecionadas={editando ? (categoriaPecas[editando.id] ?? []) : []}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); onChanged() }}
        />
      )}
    </div>
  )
}

function ModalCategoria({ categoria, pecas, pecasSelecionadas, onClose, onSaved }: {
  categoria: Categoria | null
  pecas: Peca[]
  pecasSelecionadas: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const [nome, setNome] = useState(categoria?.nome ?? '')
  const [cor, setCor] = useState(categoria?.cor ?? '#4F7CFF')
  const [selecionadas, setSelecionadas] = useState<string[]>(pecasSelecionadas)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function togglePeca(id: string) {
    setSelecionadas(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  async function salvar() {
    if (!nome.trim()) return
    setSaving(true)
    setError('')
    const supabase = createClient()
    let categoriaId = categoria?.id
    if (categoria) {
      const { error: err } = await supabase.from('uniforme_categorias').update({ nome: nome.trim(), cor }).eq('id', categoria.id)
      if (err) { setSaving(false); setError(mensagemErro(err, 'Falha ao salvar categoria')); return }
    } else {
      const { data, error: err } = await supabase.from('uniforme_categorias').insert({ nome: nome.trim(), cor }).select('id').single()
      if (err || !data) { setSaving(false); setError(mensagemErro(err, 'Falha ao criar categoria')); return }
      categoriaId = data.id
    }
    if (categoriaId) {
      // Insere os vínculos novos antes de apagar os removidos (falha no meio não esvazia a categoria)
      const anteriores = categoria ? pecasSelecionadas : []
      const novas = selecionadas.filter(id => !anteriores.includes(id))
      const removidas = anteriores.filter(id => !selecionadas.includes(id))
      if (novas.length > 0) {
        const { error: err } = await supabase.from('uniforme_categoria_pecas')
          .upsert(novas.map(peca_id => ({ categoria_id: categoriaId, peca_id })), { onConflict: 'categoria_id,peca_id', ignoreDuplicates: true })
        if (err) { setSaving(false); setError(mensagemErro(err, 'Falha ao vincular as peças')); return }
      }
      if (removidas.length > 0) {
        const { error: err } = await supabase.from('uniforme_categoria_pecas').delete().eq('categoria_id', categoriaId).in('peca_id', removidas)
        if (err) { setSaving(false); setError(mensagemErro(err, 'Falha ao desvincular as peças')); return }
      }
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="font-syne font-semibold text-[#0F172A]">{categoria ? 'Editar categoria' : 'Nova categoria'}</h2>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -mr-2"><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Nome *</label>
            <input className="field" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Chão de Fábrica, Corpo Técnico..." autoFocus />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-2">Cor</label>
            <div className="flex items-center gap-2 flex-wrap">
              {CORES_PRESET.map(c => (
                <button key={c} type="button" onClick={() => setCor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${cor === c ? 'ring-2 ring-offset-2 ring-[#0F172A] scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={cor} onChange={e => setCor(e.target.value)}
                className="w-7 h-7 rounded-full border-2 border-[#E2E8F0] cursor-pointer overflow-hidden p-0.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-2">Peças de uniforme desta categoria</label>
            {pecas.length === 0 ? (
              <p className="text-xs text-[#94A3B8]">Cadastre peças na aba &quot;Peças de Uniforme&quot; primeiro.</p>
            ) : (
              <div className="space-y-1.5">
                {pecas.map(p => (
                  <label key={p.id} className="flex items-center gap-2.5 cursor-pointer select-none px-2 py-1.5 rounded-lg hover:bg-[#F8FAFC]">
                    <input type="checkbox" checked={selecionadas.includes(p.id)} onChange={() => togglePeca(p.id)}
                      className="w-4 h-4 rounded accent-[#4F7CFF]" />
                    <span className="text-sm text-[#374151]">{p.nome}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9]">
              Cancelar
            </button>
            <button onClick={salvar} disabled={saving || !nome.trim()}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function GerenciarPecas({ pecas, onChanged }: { pecas: Peca[]; onChanged: () => void }) {
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Peca | null>(null)

  async function deletar(peca: Peca) {
    const supabase = createClient()
    // Conta antes: a FK estoque_produtos.peca_uniforme_id impede excluir peça em uso
    const [{ count: nProd, error: e1 }, { count: nFunc, error: e2 }] = await Promise.all([
      supabase.from('estoque_produtos').select('id', { count: 'exact', head: true }).eq('peca_uniforme_id', peca.id),
      supabase.from('funcionario_uniforme_tamanhos').select('id', { count: 'exact', head: true }).eq('peca_id', peca.id),
    ])
    if (e1 || e2) { alert(mensagemErro(e1 || e2, 'Falha ao verificar a peça')); return }
    const produtos = nProd ?? 0
    const funcs = nFunc ?? 0
    const usos = [
      funcs > 0 && `${funcs} funcionário${funcs > 1 ? 's' : ''}`,
      produtos > 0 && `${produtos} produto${produtos > 1 ? 's' : ''} do estoque`,
    ].filter(Boolean).join(' e ')
    const msg = usos
      ? `A peça "${peca.nome}" está em uso por ${usos}. Remover mesmo assim? Ela será desvinculada das categorias, dos tamanhos dos funcionários e dos produtos.`
      : `Remover a peça "${peca.nome}"? Ela será desvinculada de todas as categorias.`
    if (!confirm(msg)) return
    if (produtos > 0) {
      const { error } = await supabase.from('estoque_produtos').update({ peca_uniforme_id: null }).eq('peca_uniforme_id', peca.id)
      if (error) { alert(mensagemErro(error, 'Falha ao desvincular os produtos')); return }
    }
    const { error } = await supabase.from('uniforme_pecas').delete().eq('id', peca.id)
    if (error) { alert(mensagemErro(error, 'Falha ao remover peça')); return }
    onChanged()
  }

  return (
    <div className="space-y-4">
      <button onClick={() => { setEditando(null); setShowModal(true) }}
        className="w-full flex items-center gap-2 justify-center py-3 border-2 border-dashed border-[#E2E8F0] rounded-xl text-sm text-[#64748B] hover:border-[#4F7CFF] hover:text-[#4F7CFF] transition-colors">
        <Plus size={16} /> Nova peça
      </button>

      {pecas.length === 0 ? (
        <p className="text-sm text-[#94A3B8] text-center py-8">Nenhuma peça cadastrada ainda.</p>
      ) : (
        <div className="card p-0 overflow-hidden divide-y divide-[#F8FAFC]">
          {pecas.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFA] group transition-colors">
              <Shirt size={15} className="text-[#94A3B8] shrink-0" />
              <p className="flex-1 text-sm font-medium text-[#0F172A]">{p.nome}</p>
              <div className="flex gap-1 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditando(p); setShowModal(true) }} aria-label={`Editar ${p.nome}`} title="Editar"
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#EEF2FF]">
                  <Pencil size={12} className="text-[#4F7CFF]" />
                </button>
                <button onClick={() => deletar(p)} aria-label={`Remover ${p.nome}`} title="Remover"
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50">
                  <Trash2 size={12} className="text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ModalPeca peca={editando} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); onChanged() }} />
      )}
    </div>
  )
}

function ModalPeca({ peca, onClose, onSaved }: { peca: Peca | null; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(peca?.nome ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function salvar() {
    if (!nome.trim()) return
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: err } = peca
      ? await supabase.from('uniforme_pecas').update({ nome: nome.trim() }).eq('id', peca.id)
      : await supabase.from('uniforme_pecas').insert({ nome: nome.trim() })
    setSaving(false)
    if (err) { setError(mensagemErro(err, 'Falha ao salvar peça')); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">{peca ? 'Editar peça' : 'Nova peça'}</h2>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -mr-2"><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Nome *</label>
            <input className="field" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Camisa, Jaleco, Calça Jeans..." autoFocus />
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9]">
              Cancelar
            </button>
            <button onClick={salvar} disabled={saving || !nome.trim()}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
