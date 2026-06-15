'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Upload, Package, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EstoqueCategoria, EstoqueItem } from '@/lib/types'

const unidades = ['un', 'm', 'kg', 'L', 'm²', 'par', 'cx', 'rolo', 'peça', 'conjunto']

export default function EditarItemPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [categorias, setCategorias] = useState<EstoqueCategoria[]>([])
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nome: '', descricao: '', categoria_id: '', unidade: 'un',
    quantidade_atual: '0', quantidade_minima: '5', quantidade_maxima: '',
    codigo_barras: '', codigo_interno: '', localizacao: '', preco_unitario: '',
    foto_url: '', foto_path: '',
  })

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('estoque_itens').select('*, categoria:estoque_categorias(*)').eq('id', id).single(),
      supabase.from('estoque_categorias').select('*').order('nome'),
    ]).then(([itemRes, catsRes]) => {
      if (itemRes.data) {
        const i = itemRes.data as EstoqueItem
        setForm({
          nome: i.nome || '', descricao: i.descricao || '',
          categoria_id: i.categoria_id || '', unidade: i.unidade || 'un',
          quantidade_atual: String(i.quantidade_atual ?? 0),
          quantidade_minima: String(i.quantidade_minima ?? 5),
          quantidade_maxima: i.quantidade_maxima ? String(i.quantidade_maxima) : '',
          codigo_barras: i.codigo_barras || '', codigo_interno: i.codigo_interno || '',
          localizacao: i.localizacao || '',
          preco_unitario: i.preco_unitario ? String(i.preco_unitario) : '',
          foto_url: i.foto_url || '', foto_path: i.foto_path || '',
        })
        if (i.foto_url) setFotoPreview(i.foto_url)
      }
      if (catsRes.data) setCategorias(catsRes.data)
      setLoadingData(false)
    })
  }, [id])

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFoto(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    let foto_url = form.foto_url || null
    let foto_path = form.foto_path || null

    if (foto) {
      const path = `itens/${Date.now()}_${foto.name}`
      const { error: uploadError } = await supabase.storage.from('estoque').upload(path, foto)
      if (uploadError) { setError(uploadError.message); setLoading(false); return }
      foto_path = path
      const { data: urlData } = supabase.storage.from('estoque').getPublicUrl(path)
      foto_url = urlData.publicUrl
    }

    const { error: updateError } = await supabase.from('estoque_itens').update({
      nome: form.nome, descricao: form.descricao || null,
      categoria_id: form.categoria_id || null, unidade: form.unidade,
      quantidade_atual: parseFloat(form.quantidade_atual) || 0,
      quantidade_minima: parseFloat(form.quantidade_minima) || 5,
      quantidade_maxima: form.quantidade_maxima ? parseFloat(form.quantidade_maxima) : null,
      codigo_barras: form.codigo_barras || null, codigo_interno: form.codigo_interno || null,
      localizacao: form.localizacao || null,
      preco_unitario: form.preco_unitario ? parseFloat(form.preco_unitario) : null,
      foto_url, foto_path, updated_at: new Date().toISOString(),
    }).eq('id', id)

    if (updateError) { setError(updateError.message); setLoading(false); return }
    router.push(`/estoque/itens/${id}`)
  }

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.')) return
    const supabase = createClient()
    await supabase.from('estoque_itens').update({ ativo: false }).eq('id', id)
    router.push('/estoque/itens')
  }

  if (loadingData) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-[#4F7CFF] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="flex flex-col h-full">
      <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center px-6 gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-[#64748B] hover:text-[#0F172A]"><ArrowLeft size={18} /></button>
        <h1 className="font-syne font-semibold text-[#0F172A] flex-1">Editar Item</h1>
        <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors">
          <Trash2 size={14} /> Excluir
        </button>
      </header>

      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card">
            <h2 className="font-syne font-semibold text-sm text-[#0F172A] mb-4">Foto do Item</h2>
            <div className="flex items-center gap-4">
              <div className="w-28 h-28 rounded-xl border-2 border-dashed border-[#E2E8F0] overflow-hidden flex items-center justify-center bg-[#F8FAFC]">
                {fotoPreview ? <img src={fotoPreview} alt="preview" className="w-full h-full object-cover" /> : <Package size={32} className="text-[#CBD5E1]" />}
              </div>
              <label className="btn-secondary cursor-pointer">
                <Upload size={16} /> {fotoPreview ? 'Trocar foto' : 'Enviar foto'}
                <input type="file" accept="image/*" className="hidden" onChange={handleFoto} />
              </label>
            </div>
          </div>

          <div className="card">
            <h2 className="font-syne font-semibold text-sm text-[#0F172A] mb-4">Informações Básicas</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome *</label>
                <input required className="field" value={form.nome} onChange={e => set('nome', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Descrição</label>
                <textarea rows={2} className="field resize-none" value={form.descricao} onChange={e => set('descricao', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Categoria</label>
                <select className="field" value={form.categoria_id} onChange={e => set('categoria_id', e.target.value)}>
                  <option value="">Sem categoria</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Unidade</label>
                <select className="field" value={form.unidade} onChange={e => set('unidade', e.target.value)}>
                  {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Localização</label>
                <input className="field" value={form.localizacao} onChange={e => set('localizacao', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Preço Unitário (R$)</label>
                <input type="number" step="0.01" className="field" value={form.preco_unitario} onChange={e => set('preco_unitario', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-syne font-semibold text-sm text-[#0F172A] mb-4">Controle de Quantidade</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Qtd. Atual</label>
                <input type="number" step="0.01" className="field" value={form.quantidade_atual} onChange={e => set('quantidade_atual', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Qtd. Mínima ⚠️</label>
                <input type="number" step="0.01" className="field" value={form.quantidade_minima} onChange={e => set('quantidade_minima', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Qtd. Máxima</label>
                <input type="number" step="0.01" className="field" value={form.quantidade_maxima} onChange={e => set('quantidade_maxima', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-syne font-semibold text-sm text-[#0F172A] mb-4">Códigos</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Código Interno</label>
                <input className="field" value={form.codigo_interno} onChange={e => set('codigo_interno', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Código de Barras</label>
                <input className="field" value={form.codigo_barras} onChange={e => set('codigo_barras', e.target.value)} />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary px-6">{loading ? 'Salvando...' : 'Salvar Alterações'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
