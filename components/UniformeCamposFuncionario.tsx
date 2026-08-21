'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface UniformeCategoria { id: string; nome: string }
export interface UniformePeca { id: string; nome: string }
export type TamanhosPorPeca = Record<string, { tamanho: string; quantidade: string }>

export function useUniformeCategorias() {
  const [categorias, setCategorias] = useState<UniformeCategoria[]>([])
  const [categoriaPecas, setCategoriaPecas] = useState<Record<string, UniformePeca[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: cats }, { data: rels }] = await Promise.all([
        supabase.from('uniforme_categorias').select('id, nome').order('nome'),
        supabase.from('uniforme_categoria_pecas').select('categoria_id, uniforme_pecas(id, nome)'),
      ])
      setCategorias(cats ?? [])
      const map: Record<string, UniformePeca[]> = {}
      for (const r of (rels ?? []) as unknown as { categoria_id: string; uniforme_pecas: UniformePeca | null }[]) {
        if (!r.uniforme_pecas) continue
        map[r.categoria_id] = map[r.categoria_id] ?? []
        map[r.categoria_id].push(r.uniforme_pecas)
      }
      setCategoriaPecas(map)
      setLoading(false)
    }
    load()
  }, [])

  return { categorias, categoriaPecas, loading }
}

export async function carregarTamanhosFuncionario(funcionarioId: string): Promise<TamanhosPorPeca> {
  const supabase = createClient()
  const { data } = await supabase
    .from('funcionario_uniforme_tamanhos')
    .select('peca_id, tamanho, quantidade')
    .eq('funcionario_id', funcionarioId)
  const map: TamanhosPorPeca = {}
  for (const row of data ?? []) {
    map[row.peca_id] = { tamanho: row.tamanho ?? '', quantidade: String(row.quantidade ?? 1) }
  }
  return map
}

export async function salvarTamanhosFuncionario(funcionarioId: string, tamanhos: TamanhosPorPeca) {
  const supabase = createClient()
  const rows = Object.entries(tamanhos)
    .filter(([, v]) => v.tamanho?.trim())
    .map(([pecaId, v]) => ({
      funcionario_id: funcionarioId,
      peca_id: pecaId,
      tamanho: v.tamanho.trim(),
      quantidade: parseInt(v.quantidade, 10) || 1,
    }))
  await supabase.from('funcionario_uniforme_tamanhos').delete().eq('funcionario_id', funcionarioId)
  if (rows.length > 0) {
    await supabase.from('funcionario_uniforme_tamanhos').insert(rows)
  }
}

export function UniformeCamposFuncionario({
  categoriaId, setCategoriaId, tamanhos, setTamanho,
}: {
  categoriaId: string
  setCategoriaId: (id: string) => void
  tamanhos: TamanhosPorPeca
  setTamanho: (pecaId: string, key: 'tamanho' | 'quantidade', value: string) => void
}) {
  const { categorias, categoriaPecas, loading } = useUniformeCategorias()
  const pecas = categoriaPecas[categoriaId] ?? []

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-[#374151] mb-1.5">Categoria de Uniforme</label>
        <select className="field" value={categoriaId} onChange={e => setCategoriaId(e.target.value)} disabled={loading}>
          <option value="">Selecione...</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      {pecas.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {pecas.map(p => (
            <div key={p.id}>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">{p.nome}</label>
              <div className="flex gap-2">
                <input className="field flex-1" value={tamanhos[p.id]?.tamanho ?? ''}
                  onChange={e => setTamanho(p.id, 'tamanho', e.target.value)} placeholder="Tamanho" />
                <input className="field w-16" type="number" min="0" step="1"
                  value={tamanhos[p.id]?.quantidade ?? ''}
                  onChange={e => setTamanho(p.id, 'quantidade', e.target.value)} placeholder="Qtd" title="Quantidade preferida" />
              </div>
            </div>
          ))}
        </div>
      )}
      {categoriaId && !loading && pecas.length === 0 && (
        <p className="text-xs text-[#94A3B8]">
          Essa categoria ainda não tem peças de uniforme vinculadas. Configure em Funcionários → Uniformes.
        </p>
      )}
    </div>
  )
}
