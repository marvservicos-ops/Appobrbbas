'use client'

import { useState } from 'react'
import { X, Loader2, Upload, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Ferramenta } from '@/lib/types'

export default function ModalEditarFerramenta({ ferramenta, onClose, onSaved }: {
  ferramenta: Ferramenta; onClose: () => void; onSaved: () => void
}) {
  const [nome, setNome] = useState(ferramenta.nome)
  const [categoria, setCategoria] = useState(ferramenta.categoria ?? '')
  const [marca, setMarca] = useState(ferramenta.marca ?? '')
  const [modelo, setModelo] = useState(ferramenta.modelo ?? '')
  const [numeroSerie, setNumeroSerie] = useState(ferramenta.numero_serie ?? '')
  const [valorAquisicao, setValorAquisicao] = useState(ferramenta.valor_aquisicao ? String(ferramenta.valor_aquisicao) : '')
  const [dataAquisicao, setDataAquisicao] = useState(ferramenta.data_aquisicao ?? '')
  const [observacoes, setObservacoes] = useState(ferramenta.observacoes ?? '')
  const [fotoUrl, setFotoUrl] = useState(ferramenta.foto_url ?? '')
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function uploadFoto(file: File) {
    setUploadingFoto(true)
    const supabase = createClient()
    const path = `ferramentas/${ferramenta.estoque_id}/${Date.now()}_${file.name}`
    const { error: err } = await supabase.storage.from('estoque').upload(path, file, { upsert: true })
    if (!err) {
      const { data } = supabase.storage.from('estoque').getPublicUrl(path)
      setFotoUrl(data.publicUrl)
    }
    setUploadingFoto(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('ferramentas').update({
      nome: nome.trim(),
      categoria: categoria.trim() || null,
      marca: marca.trim() || null,
      modelo: modelo.trim() || null,
      numero_serie: numeroSerie.trim() || null,
      valor_aquisicao: valorAquisicao ? parseFloat(valorAquisicao) : null,
      data_aquisicao: dataAquisicao || null,
      observacoes: observacoes.trim() || null,
      foto_url: fotoUrl || null,
      updated_at: new Date().toISOString(),
    }).eq('id', ferramenta.id)
    if (err) { setError(err.message); setLoading(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md max-h-[calc(100dvh-env(safe-area-inset-top))] overflow-y-auto mt-auto sm:mt-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">Editar Ferramenta</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome *</label>
            <input required autoFocus className="field" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Furadeira de Impacto" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Categoria</label>
              <input className="field" value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ex: Elétrica" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Nº de série</label>
              <input className="field" value={numeroSerie} onChange={e => setNumeroSerie(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Marca</label>
              <input className="field" value={marca} onChange={e => setMarca(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Modelo</label>
              <input className="field" value={modelo} onChange={e => setModelo(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Valor de aquisição (R$)</label>
              <input type="number" step="0.01" min="0" className="field" placeholder="0,00" value={valorAquisicao} onChange={e => setValorAquisicao(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Data de aquisição</label>
              <input type="date" className="field" value={dataAquisicao} onChange={e => setDataAquisicao(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Observações</label>
            <input className="field" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Foto</label>
            <div className="flex items-center gap-3">
              {fotoUrl
                ? <img src={fotoUrl} alt="foto" className="w-16 h-16 rounded-lg object-cover border border-[#E2E8F0]" />
                : <div className="w-16 h-16 rounded-lg bg-[#F1F5F9] flex items-center justify-center border border-dashed border-[#CBD5E1]">
                    <Wrench size={20} className="text-[#94A3B8]" />
                  </div>}
              <label className="flex-1 cursor-pointer flex items-center gap-2 px-3 py-2 border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] text-sm text-[#64748B] transition-colors">
                {uploadingFoto ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploadingFoto ? 'Enviando...' : fotoUrl ? 'Trocar foto' : 'Adicionar foto'}
                <input type="file" accept="image/*" className="hidden" disabled={uploadingFoto}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFoto(f) }} />
              </label>
              {fotoUrl && (
                <button type="button" onClick={() => setFotoUrl('')} className="text-[#94A3B8] hover:text-red-500 transition-colors">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
