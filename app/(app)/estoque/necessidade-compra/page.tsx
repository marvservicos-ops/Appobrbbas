'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Shirt } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Categoria {
  id: string
  nome: string
}

interface Peca {
  id: string
  nome: string
}

interface Funcionario {
  id: string
  nome: string
  categoria_uniforme_id: string | null
}

interface FuncionarioTamanho {
  funcionario_id: string
  peca_id: string
  tamanho: string | null
  quantidade: number
}

interface Produto {
  nome: string
  tamanho: string | null
  quantidade_atual: number
  peca_uniforme_id: string | null
}

function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// fallback para produtos antigos sem peça vinculada: tenta casar pelo nome
function classificarPorNome(nomeProduto: string, pecas: Peca[]): string | null {
  const n = normalizar(nomeProduto)
  const match = pecas.find(p => n.includes(normalizar(p.nome)))
  return match?.id ?? null
}

export default function NecessidadeCompraPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaPecas, setCategoriaPecas] = useState<Record<string, Peca[]>>({})
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [tamanhosFuncionarios, setTamanhosFuncionarios] = useState<FuncionarioTamanho[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [pecas, setPecas] = useState<Peca[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: cats }, { data: rels }, { data: func }, { data: tam }, { data: prod }, { data: ps }] = await Promise.all([
        supabase.from('uniforme_categorias').select('id, nome').order('nome'),
        supabase.from('uniforme_categoria_pecas').select('categoria_id, uniforme_pecas(id, nome)'),
        supabase.from('funcionarios').select('id, nome, categoria_uniforme_id').eq('ativo', true),
        supabase.from('funcionario_uniforme_tamanhos').select('funcionario_id, peca_id, tamanho, quantidade'),
        supabase.from('estoque_produtos').select('nome, tamanho, quantidade_atual, peca_uniforme_id').eq('ativo', true),
        supabase.from('uniforme_pecas').select('id, nome'),
      ])
      setCategorias(cats ?? [])
      const map: Record<string, Peca[]> = {}
      for (const r of (rels ?? []) as unknown as { categoria_id: string; uniforme_pecas: Peca | null }[]) {
        if (!r.uniforme_pecas) continue
        map[r.categoria_id] = map[r.categoria_id] ?? []
        map[r.categoria_id].push(r.uniforme_pecas)
      }
      setCategoriaPecas(map)
      setFuncionarios(func ?? [])
      setTamanhosFuncionarios(tam ?? [])
      setProdutos(prod ?? [])
      setPecas(ps ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const relatorioPorCategoria = useMemo(() => {
    return categorias.map(categoria => {
      const pecasCategoria = categoriaPecas[categoria.id] ?? []
      const funcionariosCategoria = funcionarios.filter(f => f.categoria_uniforme_id === categoria.id)

      const grupos = pecasCategoria.map(peca => {
        const necessario: Record<string, string[]> = {}
        for (const f of funcionariosCategoria) {
          const tamanhoRow = tamanhosFuncionarios.find(t => t.funcionario_id === f.id && t.peca_id === peca.id)
          if (!tamanhoRow?.tamanho?.trim()) continue
          const t = tamanhoRow.tamanho.trim()
          const qtd = tamanhoRow.quantidade || 1
          necessario[t] = necessario[t] ?? []
          for (let i = 0; i < qtd; i++) necessario[t].push(f.nome)
        }

        const disponivel: Record<string, number> = {}
        for (const p of produtos) {
          const pecaId = p.peca_uniforme_id ?? classificarPorNome(p.nome, pecas)
          if (pecaId !== peca.id || !p.tamanho?.trim()) continue
          const t = p.tamanho.trim()
          disponivel[t] = (disponivel[t] ?? 0) + (p.quantidade_atual ?? 0)
        }

        const tamanhos = Array.from(new Set([...Object.keys(necessario), ...Object.keys(disponivel)])).sort()
        const linhas = tamanhos.map(tamanho => {
          const nomes = necessario[tamanho] ?? []
          const necessarioQtd = nomes.length
          const disponivelQtd = disponivel[tamanho] ?? 0
          const falta = Math.max(0, necessarioQtd - disponivelQtd)
          return { tamanho, necessarioQtd, disponivelQtd, falta, nomes }
        })

        const semTamanho = funcionariosCategoria.filter(f =>
          !tamanhosFuncionarios.find(t => t.funcionario_id === f.id && t.peca_id === peca.id)?.tamanho?.trim()
        )

        return { peca, linhas, semTamanho }
      })

      return { categoria, funcionariosCategoria, grupos }
    })
  }, [categorias, categoriaPecas, funcionarios, tamanhosFuncionarios, produtos, pecas])

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <Link href="/estoque" className="text-[#64748B] hover:text-[#0F172A]"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="font-syne font-bold text-xl md:text-2xl text-[#0F172A]">Necessidade de Compra de Uniforme/EPI</h1>
          <p className="text-sm text-[#64748B] mt-1">Compara o tamanho de cada funcionário ativo com o estoque disponível por tamanho, separado por categoria.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-[#4F7CFF]" />
        </div>
      ) : categorias.length === 0 ? (
        <div className="card py-12 text-center text-sm text-[#94A3B8]">
          Nenhuma categoria de uniforme cadastrada. Configure em{' '}
          <Link href="/funcionarios/uniformes" className="text-[#4F7CFF] hover:underline">Funcionários → Uniformes</Link>.
        </div>
      ) : (
        <div className="space-y-8">
          {relatorioPorCategoria.map(({ categoria, funcionariosCategoria, grupos }) => (
            <div key={categoria.id}>
              <h2 className="font-syne font-bold text-lg text-[#0F172A] mb-3">
                {categoria.nome} <span className="text-sm font-normal text-[#94A3B8]">({funcionariosCategoria.length} funcionário{funcionariosCategoria.length !== 1 ? 's' : ''})</span>
              </h2>
              {grupos.length === 0 ? (
                <div className="card py-6 text-center text-sm text-[#94A3B8] mb-2">
                  Nenhuma peça de uniforme vinculada a esta categoria.
                </div>
              ) : (
                <div className="space-y-6">
                  {grupos.map(({ peca, linhas, semTamanho }) => (
                    <div key={peca.id} className="card p-0 overflow-hidden">
                      <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center gap-2">
                        <Shirt size={16} className="text-[#4F7CFF]" />
                        <h3 className="font-syne font-semibold text-[#0F172A]">{peca.nome}</h3>
                      </div>
                      {linhas.length === 0 ? (
                        <div className="py-8 text-center text-sm text-[#94A3B8]">
                          Nenhum tamanho cadastrado ainda (nem em funcionários, nem no estoque).
                        </div>
                      ) : (
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                              <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Tamanho</th>
                              <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Nº Necessário</th>
                              <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Em estoque</th>
                              <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Falta comprar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {linhas.map(l => (
                              <tr key={l.tamanho} className={`border-b border-[#F1F5F9] ${l.falta > 0 ? 'bg-amber-50' : ''}`}>
                                <td className="px-4 py-2.5 text-sm font-medium text-[#0F172A]">{l.tamanho}</td>
                                <td className="px-4 py-2.5 text-sm text-[#374151]" title={l.nomes.join(', ')}>{l.necessarioQtd}</td>
                                <td className="px-4 py-2.5 text-sm text-[#374151]">{l.disponivelQtd}</td>
                                <td className={`px-4 py-2.5 text-sm font-semibold ${l.falta > 0 ? 'text-amber-700' : 'text-emerald-600'}`}>
                                  {l.falta > 0 ? l.falta : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {semTamanho.length > 0 && (
                        <div className="px-5 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#94A3B8]">
                          Sem tamanho cadastrado ({semTamanho.length}): {semTamanho.map(f => f.nome).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <p className="text-xs text-[#94A3B8]">
            Produtos do estoque são cruzados pela peça de uniforme vinculada a eles; produtos ainda sem peça vinculada são identificados pelo nome como reserva. O tamanho precisa ser digitado de forma idêntica entre funcionário e produto para o cruzamento funcionar.
          </p>
        </div>
      )}
    </div>
  )
}
