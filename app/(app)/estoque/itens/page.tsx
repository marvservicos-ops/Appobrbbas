'use client'

import { useEffect, useState } from 'react'
import { Plus, Package, Search, Filter, Edit2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EstoqueItem, EstoqueCategoria } from '@/lib/types'
import Topbar from '@/components/Topbar'
import Link from 'next/link'

function nivelEstoque(item: EstoqueItem) {
  if (item.quantidade_atual <= 0) return 'critico'
  if (item.quantidade_atual <= item.quantidade_minima) return 'baixo'
  return 'ok'
}

export default function EstoqueItensPage() {
  const [itens, setItens] = useState<EstoqueItem[]>([])
  const [categorias, setCategorias] = useState<EstoqueCategoria[]>([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const [itensRes, catsRes] = await Promise.all([
      supabase.from('estoque_itens').select('*, categoria:estoque_categorias(*)').order('nome'),
      supabase.from('estoque_categorias').select('*').order('nome'),
    ])
    if (itensRes.data) setItens(itensRes.data as EstoqueItem[])
    if (catsRes.data) setCategorias(catsRes.data as EstoqueCategoria[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = itens.filter(i => {
    const matchSearch = i.nome.toLowerCase().includes(search.toLowerCase()) ||
      (i.codigo_barras || '').includes(search) ||
      (i.codigo_interno || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = !catFilter || i.categoria_id === catFilter
    return matchSearch && matchCat
  })

  return (
    <div className="flex flex-col h-full">
      <Topbar searchPlaceholder="Buscar por nome, código..." onSearch={setSearch} />

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-syne text-2xl font-bold text-[#0F172A]">Itens do Estoque</h1>
            <p className="text-sm text-[#64748B] mt-0.5">{itens.length} itens cadastrados</p>
          </div>
          <Link href="/estoque/itens/novo" className="btn-primary">
            <Plus size={16} /> Novo Item
          </Link>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-[#64748B]" />
            <span className="text-sm text-[#64748B]">Categoria:</span>
          </div>
          <button
            onClick={() => setCatFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!catFilter ? 'bg-[#4F7CFF] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}
          >
            Todas
          </button>
          {categorias.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCatFilter(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${catFilter === cat.id ? 'text-white' : 'text-[#64748B] hover:bg-[#E2E8F0]'}`}
              style={catFilter === cat.id ? { backgroundColor: cat.cor } : { backgroundColor: '#F1F5F9' }}
            >
              {cat.nome}
            </button>
          ))}
        </div>

        {/* Grid de cards */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => <div key={i} className="card h-52 animate-pulse bg-[#F1F5F9]" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map(item => {
              const nivel = nivelEstoque(item)
              const cat = item.categoria as any
              return (
                <div key={item.id} className="card p-0 overflow-hidden hover:border-[#4F7CFF]/30 hover:shadow-sm transition-all group">
                  {/* Foto */}
                  <div className="relative h-36 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    {item.foto_url ? (
                      <img src={item.foto_url} alt={item.nome} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={32} className="text-[#CBD5E1]" />
                      </div>
                    )}
                    {/* Status badge */}
                    <div className="absolute top-2 right-2">
                      {nivel === 'critico' && <span className="text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">Zerado</span>}
                      {nivel === 'baixo' && <span className="text-xs font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">Baixo</span>}
                    </div>
                    {/* Edit button */}
                    <Link href={`/estoque/itens/${item.id}/editar`} className="absolute top-2 left-2 w-7 h-7 bg-white/90 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-[#E2E8F0]">
                      <Edit2 size={12} className="text-[#64748B]" />
                    </Link>
                  </div>

                  <Link href={`/estoque/itens/${item.id}`} className="block p-3">
                    {cat && (
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: cat.cor + '20', color: cat.cor }}>
                        {cat.nome}
                      </span>
                    )}
                    <h3 className="font-syne font-semibold text-sm text-[#0F172A] mt-1.5 line-clamp-2">{item.nome}</h3>
                    <div className={`mt-2 font-bold text-base ${nivel === 'critico' ? 'text-red-500' : nivel === 'baixo' ? 'text-amber-500' : 'text-[#0F172A]'}`}>
                      {item.quantidade_atual} <span className="text-xs font-normal text-[#64748B]">{item.unidade}</span>
                    </div>
                    {item.localizacao && <div className="text-xs text-[#94A3B8] mt-0.5">{item.localizacao}</div>}
                  </Link>
                </div>
              )
            })}

            {/* Novo item card */}
            <Link href="/estoque/itens/novo" className="card border-dashed hover:border-[#4F7CFF] hover:bg-[#F8FAFF] transition-all flex flex-col items-center justify-center gap-2 min-h-[200px] group">
              <div className="w-10 h-10 rounded-full bg-[#EEF2FF] group-hover:bg-[#4F7CFF] flex items-center justify-center transition-colors">
                <Plus size={20} className="text-[#4F7CFF] group-hover:text-white transition-colors" />
              </div>
              <p className="text-sm font-medium text-[#374151]">Novo Item</p>
            </Link>

            {filtered.length === 0 && itens.length > 0 && (
              <div className="col-span-full text-center py-10 text-sm text-[#94A3B8]">
                Nenhum item encontrado para este filtro.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
