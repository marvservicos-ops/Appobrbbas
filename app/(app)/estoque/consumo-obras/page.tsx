'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EstoqueProdutoCategoria } from '@/lib/types'
import { chaveNome } from '@/components/ObraMateriaisAnalise'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

interface ObraLinha { id: string; titulo: string; status: string }
interface Grandeza { obra_id: string; nome: string; unidade: string | null; valor: number }

// O Supabase devolve no máximo 1000 linhas por consulta
async function buscarTudo<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const todos: T[] = []
  for (let de = 0; ; de += 1000) {
    const { data } = await consulta(de, de + 999)
    todos.push(...(data ?? []))
    if (!data || data.length < 1000) return todos
  }
}

const COMPRAS = '__compras__'
const SEM = '__sem__'

export default function ConsumoObrasPage() {
  const [loading, setLoading] = useState(true)
  const [categorias, setCategorias] = useState<EstoqueProdutoCategoria[]>([])
  const [obras, setObras] = useState<ObraLinha[]>([])
  const [custos, setCustos] = useState<Map<string, Map<string, number>>>(new Map())
  const [grandezas, setGrandezas] = useState<Grandeza[]>([])
  const [grandezaNome, setGrandezaNome] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [catRes, obrasRes, gRes, regs, mats] = await Promise.all([
        supabase.from('estoque_produto_categorias').select('*').order('ordem').order('nome'),
        supabase.from('obras').select('id, titulo, status').order('titulo'),
        supabase.from('obra_grandezas').select('obra_id, nome, unidade, valor'),
        buscarTudo<{ obra_id: string; produto_id: string | null; tipo: string; valor_total: number | null }>((de, ate) =>
          supabase.from('estoque_registros').select('obra_id, produto_id, tipo, valor_total').not('obra_id', 'is', null).order('id').range(de, ate)),
        buscarTudo<{ obra_id: string; valor_total: number | null }>((de, ate) =>
          supabase.from('obra_materiais').select('obra_id, valor_total').eq('tipo_compra', 'interna').order('id').range(de, ate)),
      ])
      const cats = (catRes.data ?? []) as EstoqueProdutoCategoria[]
      const estoqueIds = Array.from(new Set(cats.map(c => c.estoque_id)))
      const prods = estoqueIds.length > 0
        ? await buscarTudo<{ id: string; categoria_id: string | null }>((de, ate) =>
            supabase.from('estoque_produtos').select('id, categoria_id').in('estoque_id', estoqueIds).order('id').range(de, ate))
        : []
      // Categorias de mesmo nome em estoques diferentes somam juntas
      const nomeCat = new Map(cats.map(c => [c.id, chaveNome(c.nome)]))
      const catDe = new Map(prods.map(p => [p.id, p.categoria_id ? nomeCat.get(p.categoria_id) ?? null : null]))

      const mapa = new Map<string, Map<string, number>>()
      const somar = (obraId: string, chave: string, v: number) => {
        if (!mapa.has(obraId)) mapa.set(obraId, new Map())
        const m = mapa.get(obraId)!
        m.set(chave, (m.get(chave) ?? 0) + v)
      }
      for (const r of regs) {
        const cat = (r.produto_id && catDe.get(r.produto_id)) || SEM
        somar(r.obra_id, cat, (r.tipo === 'saida' ? 1 : -1) * (r.valor_total || 0))
      }
      for (const m of mats) somar(m.obra_id, COMPRAS, m.valor_total || 0)

      const gs = (gRes.data ?? []) as Grandeza[]
      setCategorias(cats)
      setObras((obrasRes.data ?? []) as ObraLinha[])
      setCustos(mapa)
      setGrandezas(gs)
      const nomes = Array.from(new Set(gs.map(g => g.nome)))
      if (nomes.length > 0) setGrandezaNome(nomes[0])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 size={28} className="animate-spin text-[#4F7CFF]" />
    </div>
  )

  const colunas = [
    ...categorias
      .filter((c, i) => categorias.findIndex(x => chaveNome(x.nome) === chaveNome(c.nome)) === i)
      .map(c => ({ id: chaveNome(c.nome), nome: c.nome, cor: c.cor })),
    { id: SEM, nome: 'Sem categoria', cor: '#94A3B8' },
    { id: COMPRAS, nome: 'Compras diretas', cor: '#3B82F6' },
  ]
  const nomesGrandeza = Array.from(new Set(grandezas.map(g => g.nome)))
  const unidadeGrandeza = grandezas.find(g => g.nome === grandezaNome)?.unidade ?? ''
  const divisorDe = (obraId: string) => grandezas.filter(g => g.obra_id === obraId && g.nome === grandezaNome).reduce((s, g) => s + Number(g.valor || 0), 0)

  const statusDisponiveis = Array.from(new Set(obras.map(o => o.status))).filter(Boolean)
  const linhas = obras
    .filter(o => custos.has(o.id))
    .filter(o => !filtroStatus || o.status === filtroStatus)
    .map(o => {
      const m = custos.get(o.id)!
      const total = colunas.reduce((s, c) => s + (m.get(c.id) ?? 0), 0)
      return { obra: o, m, total, divisor: divisorDe(o.id) }
    })
    .sort((a, b) => b.total - a.total)
  // Só mostra coluna que tem valor em alguma obra
  const colunasVisiveis = colunas.filter(c => linhas.some(l => (l.m.get(c.id) ?? 0) !== 0))

  // Média do índice entre as obras que têm a grandeza informada
  const comIndice = linhas.filter(l => l.divisor > 0)
  const somaDivisor = comIndice.reduce((s, l) => s + l.divisor, 0)
  const mediaIndice = (chave: string | null) => {
    if (somaDivisor === 0) return 0
    const soma = comIndice.reduce((s, l) => s + (chave ? l.m.get(chave) ?? 0 : l.total), 0)
    return soma / somaDivisor
  }

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/estoque" className="w-9 h-9 rounded-xl border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors">
          <ArrowLeft size={16} className="text-[#64748B]" />
        </Link>
        <div className="flex-1">
          <h1 className="font-syne font-bold text-xl text-[#0F172A] flex items-center gap-2"><BarChart3 size={18} className="text-[#4F7CFF]" /> Consumo de material por obra</h1>
          <p className="text-xs text-[#64748B]">Saídas menos devoluções, por categoria de produto, mais as compras diretas da obra.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select className="field text-sm w-auto" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Todas as obras</option>
          {statusDisponiveis.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {nomesGrandeza.length > 0 ? (
          <label className="flex items-center gap-2 text-sm text-[#64748B]">
            Índice por
            <select className="field text-sm w-auto" value={grandezaNome} onChange={e => setGrandezaNome(e.target.value)}>
              {nomesGrandeza.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        ) : (
          <p className="text-xs text-[#94A3B8]">Cadastre grandezas (máquinas, TR, m² de duto) no Centro de Custos de cada obra para ver o custo por unidade.</p>
        )}
      </div>

      {comIndice.length > 0 && (
        <div className="card p-4 mb-4">
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">Média por {grandezaNome}{unidadeGrandeza ? ` (${unidadeGrandeza})` : ''} · {comIndice.length} obra(s)</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {colunasVisiveis.map(c => (
              <div key={c.id}>
                <p className="text-[11px] text-[#94A3B8] flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.cor }} />{c.nome}</p>
                <p className="text-sm font-semibold text-[#0F172A]">{moeda(mediaIndice(c.id))}</p>
              </div>
            ))}
            <div>
              <p className="text-[11px] text-[#94A3B8]">Total</p>
              <p className="text-sm font-bold text-[#4F7CFF]">{moeda(mediaIndice(null))}</p>
            </div>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        {linhas.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#94A3B8]">Nenhuma obra com consumo de material registrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Obra</th>
                  {colunasVisiveis.map(c => (
                    <th key={c.id} className="text-right text-xs font-semibold text-[#64748B] px-3 py-3 whitespace-nowrap">{c.nome}</th>
                  ))}
                  <th className="text-right text-xs font-semibold text-[#64748B] px-3 py-3">Total</th>
                  {nomesGrandeza.length > 0 && <th className="text-right text-xs font-semibold text-[#64748B] px-4 py-3 whitespace-nowrap">Por {unidadeGrandeza || grandezaNome}</th>}
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => (
                  <tr key={l.obra.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3 text-sm">
                      <Link href={`/obras/${l.obra.id}/financeiro?aba=centro-custos`} className="font-medium text-[#0F172A] hover:text-[#4F7CFF]">{l.obra.titulo}</Link>
                      <span className="block text-[11px] text-[#94A3B8]">{l.obra.status}{l.divisor > 0 ? ` · ${l.divisor} ${unidadeGrandeza}` : ''}</span>
                    </td>
                    {colunasVisiveis.map(c => (
                      <td key={c.id} className="px-3 py-3 text-sm text-right text-[#374151] whitespace-nowrap">{(l.m.get(c.id) ?? 0) !== 0 ? moeda(l.m.get(c.id)!) : '—'}</td>
                    ))}
                    <td className="px-3 py-3 text-sm text-right font-semibold text-[#0F172A] whitespace-nowrap">{moeda(l.total)}</td>
                    {nomesGrandeza.length > 0 && (
                      <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                        {l.divisor > 0 ? <span className="font-semibold text-[#4F7CFF]">{moeda(l.total / l.divisor)}</span> : <span className="text-[#CBD5E1]">—</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
