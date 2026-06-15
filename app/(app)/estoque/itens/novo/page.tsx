'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, Package, Scan } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EstoqueCategoria } from '@/lib/types'

const unidades = ['un', 'm', 'kg', 'L', 'm²', 'par', 'cx', 'rolo', 'peça', 'conjunto']

export default function NovoItemPage() {
  const router = useRouter()
  const [categorias, setCategorias] = useState<EstoqueCategoria[]>([])
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    categoria_id: '',
    unidade: 'un',
    quantidade_atual: '0',
    quantidade_minima: '5',
    quantidade_maxima: '',
    codigo_barras: '',
    codigo_interno: '',
    localizacao: '',
    preco_unitario: '',
  })

  useEffect(() => {
    createClient().from('estoque_categorias').select('*').order('nome').then(({ data }) => {
      if (data) setCategorias(data)
    })
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

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

    let foto_url = null
    let foto_path = null

    if (foto) {
      const path = `itens/${Date.now()}_${foto.name}`
      const { error: uploadError } = await supabase.storage.from('estoque').upload(path, foto)
      if (uploadError) { setError(uploadError.message); setLoading(false); return }
      foto_path = path
      const { data: urlData } = supabase.storage.from('estoque').getPublicUrl(path)
      foto_url = urlData.publicUrl
    }

    const { error: insertError } = await supabase.from('estoque_itens').insert({
      nome: form.nome,
      descricao: form.descricao || null,
      categoria_id: form.categoria_id || null,
      unidade: form.unidade,
      quantidade_atual: parseFloat(form.quantidade_atual) || 0,
      quantidade_minima: parseFloat(form.quantidade_minima) || 5,
      quantidade_maxima: form.quantidade_maxima ? parseFloat(form.quantidade_maxima) : null,
      codigo_barras: form.codigo_barras || null,
      codigo_interno: form.codigo_interno || null,
      localizacao: form.localizacao || null,
      preco_unitario: form.preco_unitario ? parseFloat(form.preco_unitario) : null,
      foto_url,
      foto_path,
    })

    if (insertError) { setError(insertError.message); setLoading(false); return }
    router.push('/estoque/itens')
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center px-6 gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-[#64748B] hover:text-[#0F172A] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-syne font-semibold text-[#0F172A]">Novo Item de Estoque</h1>
      </header>

      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Foto */}
          <div className="card">
            <h2 className="font-syne font-semibold text-sm text-[#0F172A] mb-4">Foto do Item</h2>
            <div className="flex items-center gap-4">
              <div className="w-28 h-28 rounded-xl border-2 border-dashed border-[#E2E8F0] overflow-hidden flex items-center justify-center bg-[#F8FAFC]">
                {fotoPreview ? (
                  <img src={fotoPreview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <Package size={32} className="text-[#CBD5E1]" />
                )}
              </div>
              <div>
                <label className="btn-secondary cursor-pointer">
                  <Upload size={16} />
                  {fotoPreview ? 'Trocar foto' : 'Enviar foto'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleFoto} />
                </label>
                <p className="text-xs text-[#94A3B8] mt-2">JPG, PNG ou WebP. Máximo 5MB.</p>
              </div>
            </div>
          </div>

          {/* Informações básicas */}
          <div className="card">
            <h2 className="font-syne font-semibold text-sm text-[#0F172A] mb-4">Informações Básicas</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome do Item *</label>
                <input required className="field" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Tubo de cobre 1/4" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Descrição</label>
                <textarea rows={2} className="field resize-none" value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Detalhes técnicos, especificações..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Categoria</label>
                <select className="field" value={form.categoria_id} onChange={e => set('categoria_id', e.target.value)}>
                  <option value="">Sem categoria</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Unidade de Medida</label>
                <select className="field" value={form.unidade} onChange={e => set('unidade', e.target.value)}>
                  {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Localização</label>
                <input className="field" value={form.localizacao} onChange={e => set('localizacao', e.target.value)} placeholder="Ex: Prateleira A3" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Preço Unitário (R$)</label>
                <input type="number" step="0.01" className="field" value={form.preco_unitario} onChange={e => set('preco_unitario', e.target.value)} placeholder="0,00" />
              </div>
            </div>
          </div>

          {/* Quantidades */}
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
                <p className="text-xs text-[#94A3B8] mt-1">Alerta quando atingir</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Qtd. Máxima</label>
                <input type="number" step="0.01" className="field" value={form.quantidade_maxima} onChange={e => set('quantidade_maxima', e.target.value)} placeholder="Opcional" />
              </div>
            </div>
          </div>

          {/* Códigos */}
          <div className="card">
            <h2 className="font-syne font-semibold text-sm text-[#0F172A] mb-4 flex items-center gap-2">
              <Scan size={16} className="text-[#4F7CFF]" />
              Identificação / Código de Barras
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Código Interno</label>
                <input className="field" value={form.codigo_interno} onChange={e => set('codigo_interno', e.target.value)} placeholder="MAT-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Código de Barras / QR</label>
                <input className="field" value={form.codigo_barras} onChange={e => set('codigo_barras', e.target.value)} placeholder="7891234567890" />
                <p className="text-xs text-[#94A3B8] mt-1">Para uso futuro com leitor</p>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary px-6">
              {loading ? 'Salvando...' : 'Salvar Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
