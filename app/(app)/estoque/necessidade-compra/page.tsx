'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Shirt } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface FuncionarioTamanhos {
  id: string
  nome: string
  tamanho_camisa: string | null
  tamanho_calca: string | null
  tamanho_calca_brim: string | null
  tamanho_bota: string | null
}

interface ProdutoTamanho {
  nome: string
  tamanho: string | null
  quantidade_atual: number
}

type Peca = 'camisa' | 'calca_jeans' | 'calca_brim' | 'bota'

const PECA_LABEL: Record<Peca, string> = {
  camisa: 'Camisa',
  calca_jeans: 'Calça Jeans',
  calca_brim: 'Calça de Brim',
  bota: 'Bota',
}

const PECAS: Peca[] = ['camisa', 'calca_jeans', 'calca_brim', 'bota']

function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function classificarProduto(nome: string): Peca | null {
  const n = normalizar(nome)
  if (n.includes('camisa') || n.includes('jaleco')) return 'camisa'
  if (n.includes('bota')) return 'bota'
  if (n.includes('brim')) return 'calca_brim'
  if (n.includes('calca')) return 'calca_jeans'
  return null
}

function tamanhoFuncionario(f: FuncionarioTamanhos, peca: Peca): string | null {
  if (peca === 'camisa') return f.tamanho_camisa
  if (peca === 'calca_jeans') return f.tamanho_calca
  if (peca === 'calca_brim') return f.tamanho_calca_brim
  return f.tamanho_bota
}

export default function NecessidadeCompraPage() {
  const [funcionarios, setFuncionarios] = useState<FuncionarioTamanhos[]>([])
  const [produtos, setProdutos] = useState<ProdutoTamanho[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: func }, { data: prod }] = await Promise.all([
        supabase.from('funcionarios').select('id, nome, tamanho_camisa, tamanho_calca, tamanho_calca_brim, tamanho_bota').eq('ativo', true),
        supabase.from('estoque_produtos').select('nome, tamanho, quantidade_atual').eq('ativo', true),
      ])
      setFuncionarios(func ?? [])
      setProdutos(prod ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const relatorio = useMemo(() => {
    const necessario: Record<Peca, Record<string, string[]>> = { camisa: {}, calca_jeans: {}, calca_brim: {}, bota: {} }
    const disponivel: Record<Peca, Record<string, number>> = { camisa: {}, calca_jeans: {}, calca_brim: {}, bota: {} }

    for (const f of funcionarios) {
      for (const peca of PECAS) {
        const tamanho = tamanhoFuncionario(f, peca)
        if (!tamanho || !tamanho.trim()) continue
        const t = tamanho.trim()
        necessario[peca][t] = necessario[peca][t] ?? []
        necessario[peca][t].push(f.nome)
      }
    }

    for (const p of produtos) {
      const peca = classificarProduto(p.nome)
      if (!peca || !p.tamanho || !p.tamanho.trim()) continue
      const t = p.tamanho.trim()
      disponivel[peca][t] = (disponivel[peca][t] ?? 0) + (p.quantidade_atual ?? 0)
    }

    return PECAS.map(peca => {
      const tamanhos = Array.from(new Set([...Object.keys(necessario[peca]), ...Object.keys(disponivel[peca])])).sort()
      const linhas = tamanhos.map(tamanho => {
        const nomes = necessario[peca][tamanho] ?? []
        const necessarioQtd = nomes.length
        const disponivelQtd = disponivel[peca][tamanho] ?? 0
        const falta = Math.max(0, necessarioQtd - disponivelQtd)
        return { tamanho, necessarioQtd, disponivelQtd, falta, nomes }
      })
      const semTamanho = funcionarios.filter(f => {
        const campo = tamanhoFuncionario(f, peca)
        return !campo || !campo.trim()
      })
      return { peca, linhas, semTamanho }
    })
  }, [funcionarios, produtos])

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <Link href="/estoque" className="text-[#64748B] hover:text-[#0F172A]"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="font-syne font-bold text-xl md:text-2xl text-[#0F172A]">Necessidade de Compra de Uniforme/EPI</h1>
          <p className="text-sm text-[#64748B] mt-1">Compara o tamanho de cada funcionário ativo com o estoque disponível por tamanho.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-[#4F7CFF]" />
        </div>
      ) : (
        <div className="space-y-6">
          {relatorio.map(({ peca, linhas, semTamanho }) => (
            <div key={peca} className="card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center gap-2">
                <Shirt size={16} className="text-[#4F7CFF]" />
                <h2 className="font-syne font-semibold text-[#0F172A]">{PECA_LABEL[peca]}</h2>
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
                      <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Nº Funcionários</th>
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
          <p className="text-xs text-[#94A3B8]">
            Peças são identificadas pelo nome do produto no estoque (contendo &quot;camisa&quot;, &quot;jaleco&quot;, &quot;brim&quot;, &quot;calça&quot; ou &quot;bota&quot;), e o tamanho precisa ser digitado de forma idêntica entre o funcionário e o produto (ex: &quot;M&quot; com &quot;M&quot;, &quot;38&quot; com &quot;38&quot;) para o cruzamento funcionar.
          </p>
        </div>
      )}
    </div>
  )
}
