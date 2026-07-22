'use client'

import { useEffect, useState } from 'react'
import { Package, TrendingDown, TrendingUp, Scale, Undo2, X, Loader2, Users, ShoppingCart, ArrowUpCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const dataBR = (v?: string) => v ? new Date(v + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

// ── tipos ─────────────────────────────────────────────
interface RegistroEstoque {
  id: string
  produto_id?: string | null
  produto_nome: string
  quantidade: number
  unidade?: string
  preco_unitario_custo?: number | null
  valor_total?: number | null
  data: string
  responsavel: string
  tipo: 'entrada' | 'saida'
  estoque_id: string
  obra_id?: string | null
  estoque_nome?: string
}

interface MaterialObra {
  id: string
  descricao: string
  tipo_compra: 'interna' | 'cliente'
  fornecedor?: string | null
  quantidade?: number | null
  unidade?: string | null
  valor_unitario?: number | null
  valor_total?: number | null
  preco_venda_unitario?: number | null
  valor_venda_total?: number | null
  custos_extras?: { descricao: string; valor: number }[] | null
  nota_fiscal_url?: string | null
  status: string
  numero_oc?: string | null
  obra_id: string
}

interface AlocacaoFuncionario {
  id: string
  funcionario?: { nome: string; cargo: string | null } | null
  dias_trabalhados: number
  custo_diario_epoca: number
  custo_total: number
  data_inicio?: string | null
  data_fim?: string | null
}

interface Estoque {
  id: string
  nome: string
}

interface EstoqueProduto {
  id: string
  nome: string
  estoque_id: string
  quantidade_atual: number
  unidade: string
}

// ── componente principal ──────────────────────────────
export default function ObraCentroCustos({ obraId }: { obraId: string }) {
  const [saidas, setSaidas] = useState<RegistroEstoque[]>([])
  const [devolucoes, setDevolucoes] = useState<RegistroEstoque[]>([])
  const [materiais, setMateriais] = useState<MaterialObra[]>([])
  const [equipe, setEquipe] = useState<AlocacaoFuncionario[]>([])
  const [valorContrato, setValorContrato] = useState<number>(0)
  const [aliquotaSimples, setAliquotaSimples] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  const [devolvendoRegistro, setDevolvendoRegistro] = useState<RegistroEstoque | null>(null)
  const [enviandoEstoque, setEnviandoEstoque] = useState<MaterialObra | null>(null)

  const [secaoEstoque, setSecaoEstoque] = useState(true)
  const [secaoMateriais, setSecaoMateriais] = useState(true)
  const [secaoMaoDeObra, setSecaoMaoDeObra] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [regRes, matRes, eqRes, finRes, tribRes] = await Promise.all([
        supabase.from('estoque_registros').select('*, estoque:estoques(nome)').eq('obra_id', obraId).order('data', { ascending: false }),
        supabase.from('obra_materiais').select('*').eq('obra_id', obraId).eq('tipo_compra', 'interna').order('created_at', { ascending: false }),
        supabase.from('obra_funcionarios').select('*, funcionario:funcionarios(nome, cargo)').eq('obra_id', obraId),
        supabase.from('obra_financeiro').select('valor_contrato').eq('obra_id', obraId).maybeSingle(),
        supabase.from('configuracoes_empresa').select('valor').eq('chave', 'aliquota_simples').maybeSingle(),
      ])

      if (regRes.data) {
        const mapped = regRes.data.map((r: any) => ({ ...r, estoque_nome: r.estoque?.nome }))
        setSaidas(mapped.filter((r: RegistroEstoque) => r.tipo === 'saida'))
        setDevolucoes(mapped.filter((r: RegistroEstoque) => r.tipo === 'entrada'))
      }
      if (matRes.data) setMateriais(matRes.data as MaterialObra[])
      if (eqRes.data) setEquipe(eqRes.data as AlocacaoFuncionario[])
      if (finRes.data) setValorContrato(Number(finRes.data.valor_contrato) || 0)
      if (tribRes.data) setAliquotaSimples(Number((tribRes.data.valor as any)?.percentual) || 0)
      setLoading(false)
    }
    load()
  }, [obraId])

  // ── totais ────────────────────────────────────────
  const totalSaidas = saidas.reduce((s, r) => s + (r.valor_total || 0), 0)
  const totalDevolucoes = devolucoes.reduce((s, r) => s + (r.valor_total || 0), 0)
  const custoEstoque = totalSaidas - totalDevolucoes

  // Agrupar materiais por orçamento
  const grupos = new Map<string, MaterialObra[]>()
  const avulsos: MaterialObra[] = []
  for (const m of materiais) {
    if (m.nota_fiscal_url) {
      if (!grupos.has(m.nota_fiscal_url)) grupos.set(m.nota_fiscal_url, [])
      grupos.get(m.nota_fiscal_url)!.push(m)
    } else {
      avulsos.push(m)
    }
  }

  const custoMateriais = materiais.reduce((s, m) => {
    const extras = (m.custos_extras ?? []).reduce((e, c) => e + c.valor, 0)
    return s + (m.valor_total ?? 0) + (m.nota_fiscal_url ? 0 : extras) // extras só no primeiro item do grupo seria duplicado
  }, 0)
  // Calcular extras por grupo (1 vez por grupo)
  const extrasGrupos = Array.from(grupos.values()).reduce((s, itens) => {
    const extras = (itens[0].custos_extras ?? []).reduce((e, c) => e + c.valor, 0)
    return s + extras
  }, 0)
  const custoMateriaisReal = materiais.reduce((s, m) => s + (m.valor_total ?? 0), 0) + extrasGrupos
  const vendaMateriais = materiais.reduce((s, m) => s + (m.valor_venda_total ?? 0), 0)

  const custoMaoDeObra = equipe.reduce((s, e) => s + (e.custo_total ?? 0), 0)

  const impostoSimples = valorContrato * (aliquotaSimples / 100)
  const receitaLiquida = valorContrato - impostoSimples
  const custoOperacional = custoEstoque + custoMateriaisReal + custoMaoDeObra
  const custoTotal = impostoSimples + custoOperacional
  const margemMat = vendaMateriais - custoMateriaisReal
  const resultado = receitaLiquida - custoOperacional
  const margem = valorContrato > 0 ? (resultado / valorContrato) * 100 : 0

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[#4F7CFF] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* ── Cards resumo ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 border-l-4 border-l-blue-500">
          <p className="text-xs text-[#64748B] font-medium mb-1">Contrato</p>
          <p className="font-syne font-bold text-lg text-[#0F172A]">{moeda(valorContrato)}</p>
          {valorContrato === 0 && <p className="text-xs text-amber-500 mt-0.5">Defina em Medições</p>}
        </div>
        <div className="card p-4 border-l-4 border-l-amber-400">
          <p className="text-xs text-[#64748B] font-medium mb-1">Impostos (Simples)</p>
          <p className="font-syne font-bold text-lg text-amber-700">{moeda(impostoSimples)}</p>
          <p className="text-xs text-[#94A3B8] mt-0.5">{aliquotaSimples > 0 ? `${aliquotaSimples}% s/ receita` : 'Configure em Configurações'}</p>
        </div>
        <div className="card p-4 border-l-4 border-l-violet-400">
          <p className="text-xs text-[#64748B] font-medium mb-1">Resultado Bruto</p>
          <p className={`font-syne font-bold text-lg ${resultado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{moeda(resultado)}</p>
          {valorContrato > 0 && <p className="text-xs text-[#94A3B8] mt-0.5">Margem: {margem.toFixed(1)}%</p>}
        </div>
        <div className="card p-4 border-l-4 border-l-emerald-400">
          <p className="text-xs text-[#64748B] font-medium mb-1">Markup Materiais</p>
          <p className={`font-syne font-bold text-lg ${margemMat >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{moeda(margemMat)}</p>
          <p className="text-xs text-[#94A3B8] mt-0.5">Venda {moeda(vendaMateriais)}</p>
        </div>
      </div>

      {/* ── Seção 1: Consumo de Estoque ── */}
      <Section
        icon={<TrendingDown size={15} className="text-red-400" />}
        title="Consumo de Estoque"
        total={moeda(custoEstoque)}
        totalClass="text-red-700"
        aberto={secaoEstoque}
        onToggle={() => setSecaoEstoque(a => !a)}
      >
        {saidas.length === 0 ? (
          <EmptyState text="Nenhuma saída de estoque vinculada a esta obra." />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-[#F1F5F9]">
              {saidas.map(r => (
                <div key={r.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{r.produto_nome}</p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{r.estoque_nome ?? '—'} · {r.quantidade} {r.unidade ?? ''}{r.preco_unitario_custo ? ` · ${moeda(r.preco_unitario_custo)}/un` : ''}</p>
                    <p className="text-xs text-[#94A3B8]">{dataBR(r.data)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-red-600">{r.valor_total ? moeda(r.valor_total) : '—'}</span>
                    <button onClick={() => setDevolvendoRegistro(r)} className="p-1.5 rounded hover:bg-emerald-50 text-[#CBD5E1] hover:text-emerald-600"><Undo2 size={14} /></button>
                  </div>
                </div>
              ))}
              <div className="px-4 py-2.5 bg-[#F8FAFC] flex justify-between text-xs font-semibold text-[#374151]">
                <span>Saídas</span><span className="text-red-600">{moeda(totalSaidas)}</span>
              </div>
              {devolucoes.length > 0 && (
                <div className="px-4 py-2.5 bg-[#F0FDF4] flex justify-between text-xs font-semibold text-[#374151]">
                  <span>Devoluções</span><span className="text-green-600">−{moeda(totalDevolucoes)}</span>
                </div>
              )}
              <div className="px-4 py-3 bg-red-50 flex justify-between text-sm font-bold">
                <span className="text-[#374151]">Custo líquido</span><span className="text-red-700">{moeda(custoEstoque)}</span>
              </div>
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[580px]">
                <thead><tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <Th>Material</Th><Th>Estoque</Th><Th>Qtd</Th><Th>Custo Unit.</Th><Th>Total</Th><Th>Data</Th><th className="w-10" />
                </tr></thead>
                <tbody>
                  {saidas.map(r => (
                    <tr key={r.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors group">
                      <Td bold>{r.produto_nome}</Td>
                      <Td>{r.estoque_nome ?? '—'}</Td>
                      <Td>{r.quantidade} {r.unidade ?? ''}</Td>
                      <Td>{r.preco_unitario_custo ? moeda(r.preco_unitario_custo) : '—'}</Td>
                      <td className="px-4 py-3 text-sm font-semibold text-red-600">{r.valor_total ? moeda(r.valor_total) : '—'}</td>
                      <Td>{dataBR(r.data)}</Td>
                      <td className="px-3 py-3">
                        <button onClick={() => setDevolvendoRegistro(r)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-emerald-50 text-[#94A3B8] hover:text-emerald-600"><Undo2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#F8FAFC] border-t-2 border-[#E2E8F0]">
                    <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-[#374151]">Saídas</td>
                    <td className="px-4 py-2.5 text-sm font-bold text-red-600">{moeda(totalSaidas)}</td><td colSpan={2} />
                  </tr>
                  {devolucoes.length > 0 && (
                    <tr className="bg-[#F0FDF4] border-t border-[#BBF7D0]">
                      <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-[#374151]">Devoluções</td>
                      <td className="px-4 py-2.5 text-sm font-bold text-green-600">−{moeda(totalDevolucoes)}</td><td colSpan={2} />
                    </tr>
                  )}
                  <tr className="bg-red-50 border-t-2 border-red-200">
                    <td colSpan={4} className="px-4 py-2.5 text-sm font-bold text-[#374151]">Custo líquido estoque</td>
                    <td className="px-4 py-2.5 text-sm font-bold text-red-700">{moeda(custoEstoque)}</td><td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Section>

      {/* ── Seção 2: Materiais da Obra (Compra Interna) ── */}
      <Section
        icon={<ShoppingCart size={15} className="text-blue-500" />}
        title="Materiais da Obra"
        total={`Custo ${moeda(custoMateriaisReal)}`}
        totalClass="text-blue-700"
        aberto={secaoMateriais}
        onToggle={() => setSecaoMateriais(a => !a)}
      >
        {materiais.length === 0 ? (
          <EmptyState text="Nenhum material de compra interna cadastrado." />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-[#F1F5F9]">
              {Array.from(grupos.entries()).map(([url, itens]) => {
                const extras = (itens[0].custos_extras ?? []) as { descricao: string; valor: number }[]
                const totalExtras = extras.reduce((s, c) => s + c.valor, 0)
                const custoGrupo = itens.reduce((s, m) => s + (m.valor_total ?? 0), 0) + totalExtras
                const vendaGrupo = itens.reduce((s, m) => s + (m.valor_venda_total ?? 0), 0)
                const orcNum = itens[0].numero_oc ?? itens[0].nota_fiscal_url?.split('/').pop()?.substring(0, 10)
                return (
                  <div key={`mgrp-${url}`}>
                    <div className="px-4 py-2 bg-[#F0F4FF]">
                      <p className="text-xs font-semibold text-[#4F7CFF]">{itens[0].fornecedor ?? 'Fornecedor'}{orcNum ? ` · ${orcNum}` : ''}</p>
                    </div>
                    {itens.map(m => (
                      <div key={m.id} className="px-4 py-3 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-[#374151] truncate">{m.descricao}</p>
                          {m.quantidade != null && <p className="text-xs text-[#94A3B8]">{m.quantidade} {m.unidade ?? ''}{m.valor_unitario ? ` · ${moeda(m.valor_unitario)}/un` : ''}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-blue-700">{m.valor_total ? moeda(m.valor_total) : '—'}</p>
                          {m.valor_venda_total && <p className="text-xs text-emerald-600">OC {moeda(m.valor_venda_total)}</p>}
                        </div>
                      </div>
                    ))}
                    {extras.map((c, i) => (
                      <div key={i} className="px-4 py-1.5 bg-[#FAFAFA] flex justify-between">
                        <span className="text-xs italic text-[#94A3B8]">{c.descricao}</span>
                        <span className="text-xs text-[#64748B]">{moeda(c.valor)}</span>
                      </div>
                    ))}
                    <div className="px-4 py-2.5 bg-[#F8FAFF] flex justify-between">
                      <span className="text-xs font-bold text-[#374151]">Subtotal</span>
                      <div className="text-right">
                        <span className="text-xs font-bold text-blue-700">{moeda(custoGrupo)}</span>
                        {vendaGrupo > 0 && <span className="text-xs text-emerald-600 ml-2">OC {moeda(vendaGrupo)}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
              {avulsos.map(m => (
                <div key={m.id} className="px-4 py-3 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{m.descricao}</p>
                    {m.quantidade != null && <p className="text-xs text-[#94A3B8]">{m.quantidade} {m.unidade ?? ''}{m.valor_unitario ? ` · ${moeda(m.valor_unitario)}/un` : ''}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-blue-700">{m.valor_total ? moeda(m.valor_total) : '—'}</p>
                    {m.valor_venda_total && <p className="text-xs text-emerald-600">OC {moeda(m.valor_venda_total)}</p>}
                  </div>
                </div>
              ))}
              <div className="px-4 py-3 bg-blue-50 flex justify-between text-sm font-bold border-t-2 border-blue-200">
                <span className="text-[#374151]">Total materiais</span>
                <div className="text-right">
                  <span className="text-blue-700">{moeda(custoMateriaisReal)}</span>
                  {vendaMateriais > 0 && <span className="text-xs text-emerald-600 block">OC {moeda(vendaMateriais)}</span>}
                </div>
              </div>
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead><tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <Th>Descrição</Th><Th>Qtd</Th><Th>Custo Unit.</Th><Th>Custo Total</Th><Th>Venda Total</Th><Th>Margem</Th><th className="w-10" />
                </tr></thead>
                <tbody>
                  {Array.from(grupos.entries()).map(([url, itens]) => {
                    const extras = (itens[0].custos_extras ?? []) as { descricao: string; valor: number }[]
                    const totalExtras = extras.reduce((s, c) => s + c.valor, 0)
                    const custoGrupo = itens.reduce((s, m) => s + (m.valor_total ?? 0), 0) + totalExtras
                    const vendaGrupo = itens.reduce((s, m) => s + (m.valor_venda_total ?? 0), 0)
                    const mg = vendaGrupo - custoGrupo
                    const orcNum = itens[0].numero_oc ?? itens[0].nota_fiscal_url?.split('/').pop()?.substring(0, 12)
                    return (
                      <>
                        <tr key={`grupo-${url}`} className="bg-[#F0F4FF] border-b border-[#E2E8F0]">
                          <td colSpan={7} className="px-4 py-2 text-xs font-semibold text-[#4F7CFF]">
                            Orçamento {orcNum ? `· ${orcNum}` : ''} · {itens[0].fornecedor ?? '—'} · {itens.length} iten{itens.length === 1 ? '' : 's'}
                          </td>
                        </tr>
                        {itens.map(m => {
                          const margem = (m.valor_venda_total ?? 0) - (m.valor_total ?? 0)
                          return (
                            <tr key={m.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors group">
                              <td className="px-4 py-2.5 pl-8 text-sm text-[#374151]">{m.descricao}</td>
                              <Td>{m.quantidade != null ? `${m.quantidade} ${m.unidade ?? ''}` : '—'}</Td>
                              <Td>{m.valor_unitario ? moeda(m.valor_unitario) : '—'}</Td>
                              <Td>{m.valor_total ? moeda(m.valor_total) : '—'}</Td>
                              <td className="px-4 py-2.5 text-sm font-medium text-emerald-700">{m.valor_venda_total ? moeda(m.valor_venda_total) : '—'}</td>
                              <td className={`px-4 py-2.5 text-xs font-semibold ${margem >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{m.valor_venda_total ? moeda(margem) : '—'}</td>
                              <td className="px-3 py-2.5"><button onClick={() => setEnviandoEstoque(m)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-blue-50 text-[#94A3B8] hover:text-blue-600"><ArrowUpCircle size={13} /></button></td>
                            </tr>
                          )
                        })}
                        {extras.map((c, i) => (
                          <tr key={`extra-${url}-${i}`} className="border-b border-[#F1F5F9] bg-[#FAFAFA]">
                            <td className="px-4 py-1.5 pl-8 text-xs italic text-[#94A3B8]">{c.descricao}</td>
                            <td colSpan={2} /><td className="px-4 py-1.5 text-xs text-[#64748B]">{moeda(c.valor)}</td><td colSpan={3} />
                          </tr>
                        ))}
                        <tr key={`sub-${url}`} className="border-b-2 border-[#E2E8F0] bg-[#F8FAFF]">
                          <td className="px-4 py-2 pl-8 text-xs font-bold text-[#374151]">Subtotal orçamento</td>
                          <td colSpan={2} />
                          <td className="px-4 py-2 text-xs font-bold text-blue-700">{moeda(custoGrupo)}</td>
                          <td className="px-4 py-2 text-xs font-bold text-emerald-700">{moeda(vendaGrupo)}</td>
                          <td className={`px-4 py-2 text-xs font-bold ${mg >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{moeda(mg)}</td>
                          <td />
                        </tr>
                      </>
                    )
                  })}
                  {avulsos.map(m => {
                    const margem = (m.valor_venda_total ?? 0) - (m.valor_total ?? 0)
                    return (
                      <tr key={m.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors group">
                        <Td bold>{m.descricao}</Td>
                        <Td>{m.quantidade != null ? `${m.quantidade} ${m.unidade ?? ''}` : '—'}</Td>
                        <Td>{m.valor_unitario ? moeda(m.valor_unitario) : '—'}</Td>
                        <Td>{m.valor_total ? moeda(m.valor_total) : '—'}</Td>
                        <td className="px-4 py-2.5 text-sm font-medium text-emerald-700">{m.valor_venda_total ? moeda(m.valor_venda_total) : '—'}</td>
                        <td className={`px-4 py-2.5 text-xs font-semibold ${margem >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{m.valor_venda_total ? moeda(margem) : '—'}</td>
                        <td className="px-3 py-2.5"><button onClick={() => setEnviandoEstoque(m)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-blue-50 text-[#94A3B8] hover:text-blue-600"><ArrowUpCircle size={13} /></button></td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50 border-t-2 border-blue-200">
                    <td colSpan={3} className="px-4 py-2.5 text-sm font-bold text-[#374151]">Total materiais</td>
                    <td className="px-4 py-2.5 text-sm font-bold text-blue-700">{moeda(custoMateriaisReal)}</td>
                    <td className="px-4 py-2.5 text-sm font-bold text-emerald-700">{moeda(vendaMateriais)}</td>
                    <td className={`px-4 py-2.5 text-sm font-bold ${margemMat >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{moeda(margemMat)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Section>

      {/* ── Seção 3: Mão de Obra ── */}
      <Section
        icon={<Users size={15} className="text-violet-500" />}
        title="Mão de Obra"
        total={moeda(custoMaoDeObra)}
        totalClass="text-violet-700"
        aberto={secaoMaoDeObra}
        onToggle={() => setSecaoMaoDeObra(a => !a)}
      >
        {equipe.length === 0 ? (
          <EmptyState text="Nenhum funcionário alocado. Acesse a aba Equipe para adicionar." />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-[#F1F5F9]">
              {equipe.map(e => (
                <div key={e.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#0F172A]">{e.funcionario?.nome ?? '—'}</p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{e.funcionario?.cargo ?? '—'} · {e.dias_trabalhados}d · {moeda(e.custo_diario_epoca)}/dia</p>
                  </div>
                  <span className="text-sm font-bold text-violet-700 shrink-0">{moeda(e.custo_total)}</span>
                </div>
              ))}
              <div className="px-4 py-3 bg-violet-50 flex justify-between text-sm font-bold border-t-2 border-violet-200">
                <span className="text-[#374151]">Total mão de obra</span>
                <span className="text-violet-700">{moeda(custoMaoDeObra)}</span>
              </div>
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead><tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <Th>Funcionário</Th><Th>Cargo</Th><Th>Dias</Th><Th>Custo/Dia</Th><Th>Total</Th>
                </tr></thead>
                <tbody>
                  {equipe.map(e => (
                    <tr key={e.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                      <Td bold>{e.funcionario?.nome ?? '—'}</Td>
                      <Td>{e.funcionario?.cargo ?? '—'}</Td>
                      <Td>{e.dias_trabalhados}d</Td>
                      <Td>{moeda(e.custo_diario_epoca)}</Td>
                      <td className="px-4 py-3 text-sm font-semibold text-violet-700">{moeda(e.custo_total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-violet-50 border-t-2 border-violet-200">
                    <td colSpan={4} className="px-4 py-2.5 text-sm font-bold text-[#374151]">Total mão de obra</td>
                    <td className="px-4 py-2.5 text-sm font-bold text-violet-700">{moeda(custoMaoDeObra)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Section>

      {/* ── Resultado Final (DRE) ── */}
      <div className="card p-5 bg-[#F8FAFF] border-[#C7D2FE] space-y-4">
        <h3 className="font-syne font-bold text-[#0F172A] flex items-center gap-2">
          <Scale size={16} className="text-[#4F7CFF]" /> Resultado da Obra — DRE
        </h3>

        {/* Linha do DRE */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-[#F1F5F9]">
            <span className="text-sm font-semibold text-[#0F172A]">Receita</span>
            <span className="text-sm font-bold text-[#0F172A]">{moeda(valorContrato)}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-2.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
            <span className="text-xs text-[#64748B] pl-3">Contrato + Aditivos</span>
            <span className="text-xs text-[#64748B]">{moeda(valorContrato)}</span>
          </div>

          {/* Impostos */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-[#F1F5F9]">
            <span className="text-sm font-semibold text-[#0F172A]">Impostos</span>
            <span className="text-sm font-bold text-amber-700">({moeda(impostoSimples)})</span>
          </div>
          <div className="flex justify-between items-center px-4 py-2 border-b border-[#F1F5F9] bg-[#F8FAFC]">
            <span className="text-xs text-[#64748B] pl-3">Simples Nacional ({aliquotaSimples}% s/ receita)</span>
            <span className="text-xs text-amber-600">({moeda(impostoSimples)})</span>
          </div>

          {/* Receita Líquida */}
          <div className="flex justify-between items-center px-4 py-2.5 border-b border-[#E2E8F0] bg-[#F0F4FF]">
            <span className="text-xs font-semibold text-[#4F7CFF]">Receita Líquida (após impostos)</span>
            <span className="text-xs font-bold text-[#4F7CFF]">{moeda(receitaLiquida)}</span>
          </div>

          {/* Custos Operacionais */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-[#F1F5F9]">
            <span className="text-sm font-semibold text-[#0F172A]">Custos Operacionais</span>
            <span className="text-sm font-bold text-red-600">({moeda(custoOperacional)})</span>
          </div>
          <div className="flex justify-between items-center px-4 py-2 border-b border-[#F1F5F9] bg-[#F8FAFC]">
            <span className="text-xs text-[#64748B] pl-3">Consumo de Estoque</span>
            <span className="text-xs text-red-500">({moeda(custoEstoque)})</span>
          </div>
          <div className="flex justify-between items-center px-4 py-2 border-b border-[#F1F5F9] bg-[#F8FAFC]">
            <span className="text-xs text-[#64748B] pl-3">Materiais da Obra</span>
            <span className="text-xs text-red-500">({moeda(custoMateriaisReal)})</span>
          </div>
          <div className="flex justify-between items-center px-4 py-2 border-b border-[#F1F5F9] bg-[#F8FAFC]">
            <span className="text-xs text-[#64748B] pl-3">Mão de Obra</span>
            <span className="text-xs text-red-500">({moeda(custoMaoDeObra)})</span>
          </div>

          <div className={`flex justify-between items-center px-4 py-3.5 ${resultado >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <div>
              <span className="text-sm font-bold text-[#0F172A]">Resultado Bruto</span>
              {valorContrato > 0 && (
                <span className={`text-xs ml-2 font-semibold ${resultado >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  ({margem.toFixed(1)}%)
                </span>
              )}
            </div>
            <span className={`font-syne font-bold text-lg ${resultado >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{moeda(resultado)}</span>
          </div>
        </div>

        {/* Info: markup materiais */}
        {vendaMateriais > 0 && (
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-emerald-700 mb-1.5">Markup de Materiais (embutido no contrato)</p>
            <div className="grid grid-cols-3 gap-3 text-xs text-[#374151]">
              <div><p className="text-[#94A3B8]">Custo fornecedor</p><p className="font-semibold">{moeda(custoMateriaisReal)}</p></div>
              <div><p className="text-[#94A3B8]">Valor na OC</p><p className="font-semibold text-emerald-700">{moeda(vendaMateriais)}</p></div>
              <div><p className="text-[#94A3B8]">Markup</p><p className={`font-semibold ${margemMat >= 0 ? 'text-emerald-700' : 'text-red-500'}`}>{moeda(margemMat)}</p></div>
            </div>
          </div>
        )}

        {valorContrato === 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Defina o valor do contrato na aba <strong>Medições</strong> para calcular o resultado.
          </p>
        )}
        {aliquotaSimples === 0 && valorContrato > 0 && (
          <p className="text-xs text-[#94A3B8] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2">
            Alíquota do Simples não configurada — acesse <strong>Configurações → Tributação</strong> para ativar o cálculo de imposto.
          </p>
        )}
      </div>

      {/* Modals */}
      {devolvendoRegistro && (
        <ModalDevolucao
          registro={devolvendoRegistro}
          onClose={() => setDevolvendoRegistro(null)}
          onSaved={async () => {
            setDevolvendoRegistro(null)
            const supabase = createClient()
            const { data } = await supabase.from('estoque_registros').select('*, estoque:estoques(nome)').eq('obra_id', obraId).order('data', { ascending: false })
            if (data) {
              const mapped = data.map((r: any) => ({ ...r, estoque_nome: r.estoque?.nome }))
              setSaidas(mapped.filter((r: RegistroEstoque) => r.tipo === 'saida'))
              setDevolucoes(mapped.filter((r: RegistroEstoque) => r.tipo === 'entrada'))
            }
          }}
        />
      )}

      {enviandoEstoque && (
        <ModalEnviarEstoque
          material={enviandoEstoque}
          onClose={() => setEnviandoEstoque(null)}
          onSaved={() => setEnviandoEstoque(null)}
        />
      )}
    </div>
  )
}

// ── helpers de layout ─────────────────────────────────
function Section({ icon, title, total, totalClass, aberto, onToggle, children }: {
  icon: React.ReactNode; title: string; total: string; totalClass: string
  aberto: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="card p-0 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-syne font-semibold text-sm text-[#0F172A]">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${totalClass}`}>{total}</span>
          {aberto ? <ChevronDown size={15} className="text-[#94A3B8]" /> : <ChevronRight size={15} className="text-[#94A3B8]" />}
        </div>
      </button>
      {aberto && children}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">{children}</th>
}
function Td({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return <td className={`px-4 py-3 text-sm ${bold ? 'font-medium text-[#0F172A]' : 'text-[#374151]'}`}>{children}</td>
}
function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Package size={20} className="text-[#CBD5E1] mb-2" />
      <p className="text-xs text-[#94A3B8]">{text}</p>
    </div>
  )
}

// ── Modal Devolução ao Estoque ─────────────────────────
function ModalDevolucao({ registro, onClose, onSaved }: {
  registro: RegistroEstoque; onClose: () => void; onSaved: () => void
}) {
  const [qtd, setQtd] = useState('')
  const [responsavel, setResponsavel] = useState(registro.responsavel)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const qtdNum = parseFloat(qtd) || 0
  const precoAtual = registro.preco_unitario_custo || 0
  const valorCredito = qtdNum * precoAtual

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!qtdNum || qtdNum <= 0) { setError('Informe a quantidade.'); return }
    if (qtdNum > registro.quantidade) { setError(`Máximo: ${registro.quantidade} ${registro.unidade ?? ''}`); return }
    setSaving(true)
    const supabase = createClient()

    await supabase.from('estoque_registros').insert({
      estoque_id: registro.estoque_id,
      produto_id: registro.produto_id ?? null,
      produto_nome: registro.produto_nome,
      tipo: 'entrada',
      quantidade: qtdNum,
      unidade: registro.unidade ?? 'un',
      responsavel: responsavel.trim(),
      data: new Date().toISOString().split('T')[0],
      obra_id: registro.obra_id ?? null,
      preco_unitario_custo: precoAtual || null,
      valor_total: valorCredito || null,
      observacoes: `Devolução de saída de ${dataBR(registro.data)}`,
    })

    if (registro.produto_id) {
      const { data: prod } = await supabase.from('estoque_produtos').select('quantidade_atual, preco_unitario').eq('id', registro.produto_id).single()
      if (prod) {
        const novaQtd = prod.quantidade_atual + qtdNum
        const novoCMP = prod.quantidade_atual > 0 && precoAtual > 0
          ? (prod.quantidade_atual * (prod.preco_unitario || 0) + qtdNum * precoAtual) / novaQtd
          : prod.preco_unitario
        await supabase.from('estoque_produtos').update({ quantidade_atual: novaQtd, preco_unitario: novoCMP }).eq('id', registro.produto_id)
      }
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[420px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div>
            <h3 className="font-syne font-semibold text-[#0F172A]">Registrar Devolução</h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">{registro.produto_nome}</p>
          </div>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="bg-[#FFF7ED] border border-orange-100 rounded-lg px-3 py-2.5 text-xs text-orange-800">
            <p>Saída original: <strong>{registro.quantidade} {registro.unidade ?? ''}</strong> em {dataBR(registro.data)}</p>
            {precoAtual > 0 && <p>CMP: <strong>{moeda(precoAtual)}</strong></p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Quantidade a devolver *</label>
            <input type="number" step="0.01" min="0.01" max={registro.quantidade} className="field" autoFocus
              value={qtd} onChange={e => setQtd(e.target.value)} />
            {qtdNum > 0 && precoAtual > 0 && <p className="text-xs text-emerald-600 mt-1">Crédito: {moeda(valorCredito)}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Responsável *</label>
            <input required className="field" value={responsavel} onChange={e => setResponsavel(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm flex items-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
              {saving ? 'Registrando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal Enviar ao Estoque (sobra de material da obra) ─
function ModalEnviarEstoque({ material, onClose, onSaved }: {
  material: MaterialObra; onClose: () => void; onSaved: () => void
}) {
  const [estoques, setEstoques] = useState<Estoque[]>([])
  const [produtos, setProdutos] = useState<EstoqueProduto[]>([])
  const [estoqueId, setEstoqueId] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [nomeProduto, setNomeProduto] = useState(material.descricao)
  const [quantidade, setQuantidade] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('estoques').select('id, nome').order('nome').then(({ data }) => { if (data) setEstoques(data as Estoque[]) })
  }, [])

  useEffect(() => {
    if (!estoqueId) { setProdutos([]); return }
    createClient().from('estoque_produtos').select('id, nome, estoque_id, quantidade_atual, unidade').eq('estoque_id', estoqueId).eq('ativo', true).order('nome')
      .then(({ data }) => { if (data) setProdutos(data as EstoqueProduto[]) })
  }, [estoqueId])

  const qtdNum = parseFloat(quantidade) || 0
  const custoUnit = material.valor_unitario ?? 0

  async function salvar() {
    if (!estoqueId || !qtdNum || !responsavel.trim()) return
    setSaving(true)
    const supabase = createClient()

    const prodSelecionado = produtoId ? produtos.find(p => p.id === produtoId) : null

    await supabase.from('estoque_registros').insert({
      estoque_id: estoqueId,
      produto_id: produtoId || null,
      produto_nome: prodSelecionado?.nome ?? nomeProduto.trim(),
      tipo: 'entrada',
      quantidade: qtdNum,
      unidade: material.unidade ?? 'un',
      responsavel: responsavel.trim(),
      data: new Date().toISOString().split('T')[0],
      preco_unitario_custo: custoUnit || null,
      valor_total: custoUnit ? qtdNum * custoUnit : null,
      observacoes: `Sobra de material — obra`,
    })

    if (produtoId && prodSelecionado) {
      const novaQtd = prodSelecionado.quantidade_atual + qtdNum
      const cmpAtual = 0
      const novoCMP = custoUnit > 0
        ? (prodSelecionado.quantidade_atual * cmpAtual + qtdNum * custoUnit) / novaQtd
        : undefined
      await supabase.from('estoque_produtos').update({
        quantidade_atual: novaQtd,
        ...(novoCMP !== undefined ? { preco_unitario: novoCMP } : {}),
      }).eq('id', produtoId)
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[440px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div>
            <h3 className="font-syne font-semibold text-[#0F172A]">Enviar Sobra ao Estoque</h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">{material.descricao}</p>
          </div>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Estoque de destino *</label>
            <select className="field" value={estoqueId} onChange={e => { setEstoqueId(e.target.value); setProdutoId('') }}>
              <option value="">Selecionar estoque...</option>
              {estoques.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
          {estoqueId && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Produto no estoque (opcional)</label>
              <select className="field" value={produtoId} onChange={e => setProdutoId(e.target.value)}>
                <option value="">Criar novo produto com este nome</option>
                {produtos.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.quantidade_atual} {p.unidade})</option>)}
              </select>
              {!produtoId && (
                <div className="mt-2">
                  <label className="block text-xs text-[#64748B] mb-1">Nome do produto</label>
                  <input className="field text-sm" value={nomeProduto} onChange={e => setNomeProduto(e.target.value)} />
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Quantidade *</label>
              <input type="number" min="0.01" step="0.01" className="field" value={quantidade} onChange={e => setQuantidade(e.target.value)}
                placeholder={`máx. ${material.quantidade ?? '?'} ${material.unidade ?? ''}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Responsável *</label>
              <input className="field" value={responsavel} onChange={e => setResponsavel(e.target.value)} />
            </div>
          </div>
          {qtdNum > 0 && custoUnit > 0 && (
            <p className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
              Entrará no estoque com custo unitário de {moeda(custoUnit)} → total {moeda(qtdNum * custoUnit)}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg">Cancelar</button>
            <button onClick={salvar} disabled={saving || !estoqueId || !qtdNum || !responsavel.trim()}
              className="btn-primary text-sm flex items-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpCircle size={14} />}
              {saving ? 'Enviando...' : 'Enviar ao Estoque'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
