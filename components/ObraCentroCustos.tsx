'use client'

import { Fragment, useEffect, useState } from 'react'
import { AlertTriangle, Package, TrendingDown, TrendingUp, Scale, Undo2, X, Loader2, Users, ShoppingCart, ArrowUpCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ModalSobraMista from '@/components/ModalSobraMista'
import ObraMateriaisAnalise from '@/components/ObraMateriaisAnalise'
import { hojeLocal } from '@/lib/datas'
import { mensagemErro } from '@/lib/erros'
import { ajustarSaldo, controlaSaldo } from '@/lib/estoque/saldo'
import { agruparMateriais, custoMateriaisObra, custoMaoDeObraObra, lerAdicionais, totaisReceitaObra, totalExtras, type AlocacaoCusto, type FuncionarioCusto } from '@/lib/financeiroObra'

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
  registro_origem_id?: string | null
  observacoes?: string | null
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
  observacoes?: string | null
  created_at?: string | null
  status: string
  numero_oc?: string | null
  oc_id?: string | null
  oc?: { numero_oc: string } | null
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
  preco_unitario?: number | null
  controla_saldo?: boolean
}

// Marca gravada nas observações da entrada de sobra, para saber quanto de
// cada material da obra já voltou ao estoque
const marcaSobra = (materialId: string) => `[material ${materialId}]`

// ── componente principal ──────────────────────────────
export default function ObraCentroCustos({ obraId }: { obraId: string }) {
  const [saidas, setSaidas] = useState<RegistroEstoque[]>([])
  const [devolucoes, setDevolucoes] = useState<RegistroEstoque[]>([])
  const [materiais, setMateriais] = useState<MaterialObra[]>([])
  const [equipe, setEquipe] = useState<AlocacaoFuncionario[]>([])
  const [valorContrato, setValorContrato] = useState<number>(0)
  const [aliquotaSimples, setAliquotaSimples] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [erroCarregar, setErroCarregar] = useState('')
  const [tentativa, setTentativa] = useState(0)

  const [devolvendoRegistro, setDevolvendoRegistro] = useState<RegistroEstoque | null>(null)
  const [enviandoEstoque, setEnviandoEstoque] = useState<MaterialObra | null>(null)
  const [showSobraMista, setShowSobraMista] = useState(false)

  const [secaoEstoque, setSecaoEstoque] = useState(true)
  const [secaoMateriais, setSecaoMateriais] = useState(true)
  const [secaoMaoDeObra, setSecaoMaoDeObra] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true); setErroCarregar('')
      const supabase = createClient()
      const [regRes, matRes, alocRes, finRes, tribRes, adicRes, ocRes, aditRes, medRes] = await Promise.all([
        supabase.from('estoque_registros').select('*, estoque:estoques(nome)').eq('obra_id', obraId).order('data', { ascending: false }),
        supabase.from('obra_materiais').select('*, oc:obra_ocs(numero_oc)').eq('obra_id', obraId).eq('tipo_compra', 'interna').order('created_at', { ascending: false }),
        supabase.from('funcionario_alocacoes').select('data, funcionario_id, percentual, noturno, tipo').eq('obra_id', obraId).in('tipo', ['obra', 'folga', 'escritorio']),
        supabase.from('obra_financeiro').select('valor_contrato').eq('obra_id', obraId).maybeSingle(),
        supabase.from('configuracoes_empresa').select('valor').eq('chave', 'aliquota_simples').maybeSingle(),
        supabase.from('configuracoes_empresa').select('chave, valor').like('chave', 'adicional_%'),
        supabase.from('obra_ocs').select('valor_total').eq('obra_id', obraId),
        supabase.from('obra_aditivos').select('valor').eq('obra_id', obraId),
        supabase.from('obra_medicoes').select('status, valor_previsto, valor_faturado, valor_recebido').eq('obra_id', obraId),
      ])

      // Falha de leitura não pode virar "R$ 0" silencioso
      const erroLeitura = [regRes, matRes, alocRes, finRes, ocRes, aditRes, medRes].find(x => x.error)?.error
      if (erroLeitura) {
        setErroCarregar(mensagemErro(erroLeitura, 'Não foi possível carregar o centro de custos'))
        setLoading(false)
        return
      }

      if (regRes.data) {
        const mapped = regRes.data.map((r: any) => ({ ...r, estoque_nome: r.estoque?.nome }))
        setSaidas(mapped.filter((r: RegistroEstoque) => r.tipo === 'saida'))
        setDevolucoes(mapped.filter((r: RegistroEstoque) => r.tipo === 'entrada'))
      }
      if (matRes.data) setMateriais(matRes.data as MaterialObra[])

      if (alocRes.data && alocRes.data.length > 0) {
        const ids = Array.from(new Set(alocRes.data.map((r: any) => r.funcionario_id as string)))
        const { data: funcs, error: errFuncs } = await supabase.from('funcionarios')
          .select('id, nome, cargo, custo_diario, salario_bruto, horas_dia, dias_mes')
          .in('id', ids)
        if (errFuncs) {
          setErroCarregar(mensagemErro(errFuncs, 'Não foi possível carregar o custo da mão de obra'))
          setLoading(false)
          return
        }
        setEquipe(custoMaoDeObraObra(alocRes.data as AlocacaoCusto[], (funcs ?? []) as FuncionarioCusto[], lerAdicionais(adicRes.data)))
      } else {
        setEquipe([])
      }

      // Contrato = OCs + contrato legado + aditivos (mesma regra das Medições)
      setValorContrato(totaisReceitaObra({
        ocs: ocRes.data, valorContratoLegado: finRes.data?.valor_contrato,
        aditivos: aditRes.data, medicoes: medRes.data as any,
      }).contrato)
      if (tribRes.data) setAliquotaSimples(Number((tribRes.data.valor as any)?.percentual) || 0)
      setLoading(false)
    }
    load()
  }, [obraId, tentativa])

  async function recarregarRegistros() {
    const supabase = createClient()
    const { data, error } = await supabase.from('estoque_registros').select('*, estoque:estoques(nome)').eq('obra_id', obraId).order('data', { ascending: false })
    if (data) {
      const mapped = data.map((r: any) => ({ ...r, estoque_nome: r.estoque?.nome }))
      setSaidas(mapped.filter((r: RegistroEstoque) => r.tipo === 'saida'))
      setDevolucoes(mapped.filter((r: RegistroEstoque) => r.tipo === 'entrada'))
    }
    if (error) alert(mensagemErro(error, 'Não foi possível atualizar a lista de saídas'))
  }

  // ── totais ────────────────────────────────────────
  const totalSaidas = saidas.reduce((s, r) => s + (r.valor_total || 0), 0)
  const totalDevolucoes = devolucoes.reduce((s, r) => s + (r.valor_total || 0), 0)
  const custoEstoque = totalSaidas - totalDevolucoes
  const devolvidoMap = new Map<string, number>()
  for (const d of devolucoes) {
    if (d.registro_origem_id) devolvidoMap.set(d.registro_origem_id, (devolvidoMap.get(d.registro_origem_id) ?? 0) + d.quantidade)
  }

  // Agrupar materiais por orçamento — mesma chave da lista de materiais da obra
  // (url do arquivo, nº da NF + fornecedor, ou lote com 2+ itens). Frete/ICMS
  // (custos_extras) ficam copiados em cada item e contam uma vez por grupo.
  const porChave = agruparMateriais(materiais)
  const grupos = new Map<string, MaterialObra[]>()
  const avulsos: MaterialObra[] = []
  for (const [k, itens] of Array.from(porChave.entries())) {
    if (!k.startsWith('lote|') || itens.length > 1) grupos.set(k, itens)
    else avulsos.push(...itens)
  }
  const custoMateriaisReal = custoMateriaisObra(materiais)
  // Quanto de cada material já voltou ao estoque como sobra
  const enviadoMap = new Map<string, number>()
  for (const d of devolucoes) {
    const id = d.observacoes?.match(/\[material ([^\]]+)\]/)?.[1]
    if (id) enviadoMap.set(id, (enviadoMap.get(id) ?? 0) + d.quantidade)
  }
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

  if (erroCarregar) return (
    <div className="p-4 md:p-6">
      <div className="card text-center py-10">
        <AlertTriangle size={22} className="mx-auto text-red-500 mb-2" />
        <p className="text-sm text-[#374151] mb-4">{erroCarregar}</p>
        <button onClick={() => setTentativa(t => t + 1)} className="btn-primary text-sm px-4 py-2 mx-auto">Tentar de novo</button>
      </div>
    </div>
  )

  const botaoEnviar = (m: MaterialObra, desktop = false) => (
    <button onClick={() => setEnviandoEstoque(m)} aria-label={`Enviar sobra de ${m.descricao} ao estoque`} title="Enviar sobra ao estoque"
      className={`${desktop ? 'opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus:opacity-100 transition-opacity ' : ''}p-2 rounded hover:bg-blue-50 text-[#94A3B8] hover:text-blue-600`}>
      <ArrowUpCircle size={desktop ? 14 : 16} />
    </button>
  )

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* ── Cards resumo ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 border-l-4 border-l-blue-500">
          <p className="text-xs text-[#64748B] font-medium mb-1">Contrato</p>
          <p className="font-syne font-bold text-lg text-[#0F172A]">{moeda(valorContrato)}</p>
          {valorContrato === 0 && <p className="text-xs text-amber-500 mt-0.5">Cadastre OCs em Medições</p>}
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
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-[#F1F5F9]">
          <p className="text-xs text-[#94A3B8]">Para devolver item separado, use ↩ na saída. Sobra misturada: pese e lance por kg.</p>
          <button onClick={() => setShowSobraMista(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9]">
            <Scale size={13} /> Devolver sobra mista (kg)
          </button>
        </div>
        {saidas.length === 0 && devolucoes.length === 0 ? (
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
                    {(devolvidoMap.get(r.id) ?? 0) < r.quantidade && (
                      <button onClick={() => setDevolvendoRegistro(r)} title="Registrar devolução" aria-label={`Registrar devolução de ${r.produto_nome}`} className="p-2 rounded hover:bg-emerald-50 text-[#94A3B8] hover:text-emerald-600"><Undo2 size={16} /></button>
                    )}
                  </div>
                </div>
              ))}
              <div className="px-4 py-2.5 bg-[#F8FAFC] flex justify-between text-xs font-semibold text-[#374151]">
                <span>Saídas</span><span className="text-red-600">{moeda(totalSaidas)}</span>
              </div>
              {devolucoes.filter(d => !d.registro_origem_id).map(d => (
                <div key={d.id} className="px-4 py-2.5 flex items-start justify-between gap-3 bg-[#F7FEF9]">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#0F172A] truncate">↩ {d.produto_nome}</p>
                    <p className="text-xs text-[#94A3B8]">{d.quantidade} {d.unidade ?? ''} · {dataBR(d.data)}</p>
                  </div>
                  <span className="text-sm font-semibold text-green-600 shrink-0">−{moeda(d.valor_total || 0)}</span>
                </div>
              ))}
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
                      <Td bold>
                        {r.produto_nome}
                        {(devolvidoMap.get(r.id) ?? 0) > 0 && <span className="block text-[10px] font-semibold text-amber-700">↩ {devolvidoMap.get(r.id)} de {r.quantidade} devolvido</span>}
                      </Td>
                      <Td>{r.estoque_nome ?? '—'}</Td>
                      <Td>{r.quantidade} {r.unidade ?? ''}</Td>
                      <Td>{r.preco_unitario_custo ? moeda(r.preco_unitario_custo) : '—'}</Td>
                      <td className="px-4 py-3 text-sm font-semibold text-red-600">{r.valor_total ? moeda(r.valor_total) : '—'}</td>
                      <Td>{dataBR(r.data)}</Td>
                      <td className="px-3 py-3">
                        {(devolvidoMap.get(r.id) ?? 0) < r.quantidade && (
                          <button onClick={() => setDevolvendoRegistro(r)} title="Registrar devolução" aria-label={`Registrar devolução de ${r.produto_nome}`} className="opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus:opacity-100 transition-opacity p-2 rounded hover:bg-emerald-50 text-[#94A3B8] hover:text-emerald-600"><Undo2 size={14} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {devolucoes.filter(d => !d.registro_origem_id).map(d => (
                    <tr key={d.id} className="border-b border-[#F1F5F9] bg-[#F7FEF9]">
                      <Td bold>↩ {d.produto_nome}</Td>
                      <Td>{d.estoque_nome ?? '—'}</Td>
                      <Td>{d.quantidade} {d.unidade ?? ''}</Td>
                      <Td>{d.preco_unitario_custo ? moeda(d.preco_unitario_custo) : '—'}</Td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-600">−{moeda(d.valor_total || 0)}</td>
                      <Td>{dataBR(d.data)}</Td>
                      <td />
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
                const custoGrupo = itens.reduce((s, m) => s + (m.valor_total ?? 0), 0) + totalExtras(extras)
                const vendaGrupo = itens.reduce((s, m) => s + (m.valor_venda_total ?? 0), 0)
                const orcNum = itens[0].oc?.numero_oc ?? itens[0].numero_oc ?? itens[0].nota_fiscal_url?.split('/').pop()?.substring(0, 10)
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
                        <div className="flex items-start gap-1 shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-blue-700">{m.valor_total ? moeda(m.valor_total) : '—'}</p>
                            {m.valor_venda_total ? <p className="text-xs text-emerald-600">OC {moeda(m.valor_venda_total)}</p> : null}
                          </div>
                          {botaoEnviar(m)}
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
                <Fragment key={m.id}>
                  <div className="px-4 py-3 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#0F172A] truncate">{m.descricao}</p>
                      {m.quantidade != null && <p className="text-xs text-[#94A3B8]">{m.quantidade} {m.unidade ?? ''}{m.valor_unitario ? ` · ${moeda(m.valor_unitario)}/un` : ''}</p>}
                    </div>
                    <div className="flex items-start gap-1 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-blue-700">{m.valor_total ? moeda(m.valor_total) : '—'}</p>
                        {m.valor_venda_total ? <p className="text-xs text-emerald-600">OC {moeda(m.valor_venda_total)}</p> : null}
                      </div>
                      {botaoEnviar(m)}
                    </div>
                  </div>
                  {(m.custos_extras ?? []).map((c, i) => (
                    <div key={i} className="px-4 py-1.5 bg-[#FAFAFA] flex justify-between">
                      <span className="text-xs italic text-[#94A3B8]">{c.descricao}</span>
                      <span className="text-xs text-[#64748B]">{moeda(c.valor)}</span>
                    </div>
                  ))}
                </Fragment>
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
                    const custoGrupo = itens.reduce((s, m) => s + (m.valor_total ?? 0), 0) + totalExtras(extras)
                    const vendaGrupo = itens.reduce((s, m) => s + (m.valor_venda_total ?? 0), 0)
                    const mg = vendaGrupo - custoGrupo
                    const orcNum = itens[0].oc?.numero_oc ?? itens[0].numero_oc ?? itens[0].nota_fiscal_url?.split('/').pop()?.substring(0, 12)
                    return (
                      <Fragment key={`grupo-${url}`}>
                        <tr className="bg-[#F0F4FF] border-b border-[#E2E8F0]">
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
                              <td className="px-3 py-2.5">{botaoEnviar(m, true)}</td>
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
                      </Fragment>
                    )
                  })}
                  {avulsos.map(m => {
                    const margem = (m.valor_venda_total ?? 0) - (m.valor_total ?? 0)
                    return (
                      <Fragment key={m.id}>
                      <tr className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors group">
                        <Td bold>{m.descricao}</Td>
                        <Td>{m.quantidade != null ? `${m.quantidade} ${m.unidade ?? ''}` : '—'}</Td>
                        <Td>{m.valor_unitario ? moeda(m.valor_unitario) : '—'}</Td>
                        <Td>{m.valor_total ? moeda(m.valor_total) : '—'}</Td>
                        <td className="px-4 py-2.5 text-sm font-medium text-emerald-700">{m.valor_venda_total ? moeda(m.valor_venda_total) : '—'}</td>
                        <td className={`px-4 py-2.5 text-xs font-semibold ${margem >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{m.valor_venda_total ? moeda(margem) : '—'}</td>
                        <td className="px-3 py-2.5">{botaoEnviar(m, true)}</td>
                      </tr>
                      {(m.custos_extras ?? []).map((c, i) => (
                        <tr key={`extra-${m.id}-${i}`} className="border-b border-[#F1F5F9] bg-[#FAFAFA]">
                          <td className="px-4 py-1.5 pl-8 text-xs italic text-[#94A3B8]">{c.descricao}</td>
                          <td colSpan={2} /><td className="px-4 py-1.5 text-xs text-[#64748B]">{moeda(c.valor)}</td><td colSpan={3} />
                        </tr>
                      ))}
                      </Fragment>
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

      {/* ── Análise de materiais: por categoria, índice e previsto x realizado ── */}
      <ObraMateriaisAnalise obraId={obraId} saidas={saidas} devolucoes={devolucoes} custoComprasDiretas={custoMateriaisReal} />

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
          <EmptyState text="Nenhum funcionário alocado. Use o Quadro de Alocação para vincular dias desta obra." />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-[#F1F5F9]">
              {equipe.map(e => (
                <div key={e.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#0F172A]">{e.funcionario?.nome ?? '—'}</p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{e.funcionario?.cargo ?? '—'} · {Number.isInteger(e.dias_trabalhados) ? e.dias_trabalhados : e.dias_trabalhados.toFixed(1)}d · {moeda(e.custo_diario_epoca)}/dia</p>
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
                      <Td>{Number.isInteger(e.dias_trabalhados) ? e.dias_trabalhados : e.dias_trabalhados.toFixed(1)}d</Td>
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
            <span className="text-xs text-[#64748B] pl-3">OCs + contrato + aditivos</span>
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
            Cadastre as OCs (ou o valor do contrato) na aba <strong>Medições</strong> para calcular o resultado.
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
          jaDevolvido={devolvidoMap.get(devolvendoRegistro.id) ?? 0}
          onClose={() => setDevolvendoRegistro(null)}
          onSaved={() => { setDevolvendoRegistro(null); recarregarRegistros() }}
        />
      )}

      {showSobraMista && (
        <ModalSobraMista
          obraId={obraId}
          onClose={() => setShowSobraMista(false)}
          onSaved={() => { setShowSobraMista(false); recarregarRegistros() }}
        />
      )}

      {enviandoEstoque && (
        <ModalEnviarEstoque
          material={enviandoEstoque}
          obraId={obraId}
          jaEnviado={enviadoMap.get(enviandoEstoque.id) ?? 0}
          onClose={() => setEnviandoEstoque(null)}
          onSaved={() => { setEnviandoEstoque(null); recarregarRegistros() }}
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
function ModalDevolucao({ registro, jaDevolvido, onClose, onSaved }: {
  registro: RegistroEstoque; jaDevolvido: number; onClose: () => void; onSaved: () => void
}) {
  const [qtd, setQtd] = useState('')
  const [responsavel, setResponsavel] = useState(registro.responsavel)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const qtdNum = parseFloat(qtd) || 0
  const precoAtual = registro.preco_unitario_custo || 0
  const valorCredito = qtdNum * precoAtual
  const restante = registro.quantidade - jaDevolvido

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!qtdNum || qtdNum <= 0) { setError('Informe a quantidade.'); return }
    if (qtdNum > restante) { setError(`Máximo: ${restante} ${registro.unidade ?? ''} (ainda não devolvido)`); return }
    setSaving(true); setError('')
    const supabase = createClient()

    // Lê o produto antes, para o custo médio (CMP)
    let prod: { quantidade_atual: number; preco_unitario: number | null; controla_saldo?: boolean } | null = null
    if (registro.produto_id) {
      const { data, error: errProd } = await supabase.from('estoque_produtos').select('quantidade_atual, preco_unitario, controla_saldo').eq('id', registro.produto_id).maybeSingle()
      if (errProd) { setError(mensagemErro(errProd, 'Não foi possível ler o produto')); setSaving(false); return }
      prod = data
    }

    const { data: reg, error: errReg } = await supabase.from('estoque_registros').insert({
      estoque_id: registro.estoque_id,
      produto_id: registro.produto_id ?? null,
      produto_nome: registro.produto_nome,
      tipo: 'entrada',
      quantidade: qtdNum,
      unidade: registro.unidade ?? 'un',
      responsavel: responsavel.trim(),
      data: hojeLocal(),
      obra_id: registro.obra_id ?? null,
      preco_unitario_custo: precoAtual || null,
      valor_total: valorCredito || null,
      registro_origem_id: registro.id,
      observacoes: `Devolução de saída de ${dataBR(registro.data)}`,
    }).select('id').single()
    // Registro não gravou: não mexe no saldo
    if (errReg) { setError(mensagemErro(errReg, 'Não foi possível registrar a devolução')); setSaving(false); return }

    if (registro.produto_id && prod) {
      const { saldo, error: errSaldo } = await ajustarSaldo(supabase, registro.produto_id, qtdNum, { pisoZero: !controlaSaldo(prod) })
      if (errSaldo) {
        // Desfaz o registro para não ficar devolução sem saldo
        await supabase.from('estoque_registros').delete().eq('id', reg.id)
        setError(mensagemErro(errSaldo, 'Não foi possível atualizar o saldo do estoque'))
        setSaving(false)
        return
      }
      const antes = (saldo ?? 0) - qtdNum
      if (controlaSaldo(prod) && antes > 0 && precoAtual > 0 && saldo) {
        const novoCMP = (antes * (prod.preco_unitario || 0) + qtdNum * precoAtual) / saldo
        const { error: errCmp } = await supabase.from('estoque_produtos').update({ preco_unitario: novoCMP }).eq('id', registro.produto_id)
        if (errCmp) alert(mensagemErro(errCmp, 'Devolução registrada, mas o custo médio do produto não foi atualizado'))
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
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -m-2 rounded-lg hover:bg-[#F1F5F9]"><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="bg-[#FFF7ED] border border-orange-100 rounded-lg px-3 py-2.5 text-xs text-orange-800">
            <p>Saída original: <strong>{registro.quantidade} {registro.unidade ?? ''}</strong> em {dataBR(registro.data)}</p>
            {jaDevolvido > 0 && <p>Já devolvido: <strong>{jaDevolvido} {registro.unidade ?? ''}</strong> · restante: <strong>{restante} {registro.unidade ?? ''}</strong></p>}
            {precoAtual > 0 && <p>Custo unitário da saída: <strong>{moeda(precoAtual)}</strong></p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Quantidade a devolver *</label>
            <input type="number" inputMode="decimal" step="any" min="0" max={restante} className="field" autoFocus
              value={qtd} onChange={e => setQtd(e.target.value)} />
            {qtdNum > 0 && precoAtual > 0 && <p className="text-xs text-emerald-600 mt-1">Crédito à obra: {moeda(valorCredito)}</p>}
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
function ModalEnviarEstoque({ material, obraId, jaEnviado, onClose, onSaved }: {
  material: MaterialObra; obraId: string; jaEnviado: number; onClose: () => void; onSaved: () => void
}) {
  const [estoques, setEstoques] = useState<Estoque[]>([])
  const [produtos, setProdutos] = useState<EstoqueProduto[]>([])
  const [estoqueId, setEstoqueId] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [nomeProduto, setNomeProduto] = useState(material.descricao)
  const [quantidade, setQuantidade] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('estoques').select('*').order('nome').then(({ data, error }) => {
      if (error) setErro(mensagemErro(error, 'Não foi possível carregar os estoques'))
      if (data) setEstoques((data as (Estoque & { ativo?: boolean })[]).filter(e => e.ativo !== false))
    })
  }, [])

  useEffect(() => {
    if (!estoqueId) { setProdutos([]); return }
    createClient().from('estoque_produtos').select('id, nome, estoque_id, quantidade_atual, unidade, preco_unitario, controla_saldo').eq('estoque_id', estoqueId).eq('ativo', true).order('nome')
      .then(({ data, error }) => {
        if (error) setErro(mensagemErro(error, 'Não foi possível carregar os produtos'))
        if (data) setProdutos(data as EstoqueProduto[])
      })
  }, [estoqueId])

  const qtdNum = parseFloat(quantidade) || 0
  const custoUnit = material.valor_unitario ?? 0
  // Não deixa enviar mais do que foi comprado (menos o que já voltou)
  const maximo = material.quantidade != null ? Math.max(0, Number(material.quantidade) - jaEnviado) : null
  const acimaDoMaximo = maximo != null && qtdNum > maximo + 1e-9

  async function salvar() {
    if (!estoqueId || !qtdNum || !responsavel.trim()) return
    if (acimaDoMaximo) { setErro(`Máximo: ${maximo} ${material.unidade ?? ''}${jaEnviado > 0 ? ' (descontado o que já foi enviado)' : ''}.`); return }
    if (!produtoId && !nomeProduto.trim()) { setErro('Informe o nome do produto.'); return }
    setSaving(true); setErro('')
    const supabase = createClient()

    let prodSelecionado = produtoId ? produtos.find(p => p.id === produtoId) ?? null : null
    let prodId = produtoId
    let produtoCriado = false

    // "Criar novo produto com este nome": cria de fato no estoque escolhido
    if (!prodId) {
      const { data: novo, error: errNovo } = await supabase.from('estoque_produtos').insert({
        estoque_id: estoqueId, nome: nomeProduto.trim(), unidade: material.unidade ?? 'un',
        quantidade_atual: 0, quantidade_minima: 0, preco_unitario: custoUnit || null,
      }).select('id, nome, estoque_id, quantidade_atual, unidade, preco_unitario, controla_saldo').single()
      if (errNovo || !novo) { setErro(mensagemErro(errNovo, 'Não foi possível criar o produto')); setSaving(false); return }
      prodSelecionado = novo as EstoqueProduto
      prodId = novo.id
      produtoCriado = true
    }

    const { data: reg, error: errReg } = await supabase.from('estoque_registros').insert({
      estoque_id: estoqueId,
      produto_id: prodId,
      produto_nome: prodSelecionado?.nome ?? nomeProduto.trim(),
      tipo: 'entrada',
      quantidade: qtdNum,
      unidade: material.unidade ?? 'un',
      responsavel: responsavel.trim(),
      data: hojeLocal(),
      obra_id: obraId,
      preco_unitario_custo: custoUnit || null,
      valor_total: custoUnit ? qtdNum * custoUnit : null,
      observacoes: `Sobra de material da obra ${marcaSobra(material.id)}`,
    }).select('id').single()
    if (errReg) {
      if (produtoCriado) await supabase.from('estoque_produtos').delete().eq('id', prodId)
      setErro(mensagemErro(errReg, 'Não foi possível registrar a entrada'))
      setSaving(false)
      return
    }

    const { saldo, error: errSaldo } = await ajustarSaldo(supabase, prodId, qtdNum, { pisoZero: !controlaSaldo(prodSelecionado) })
    if (errSaldo) {
      await supabase.from('estoque_registros').delete().eq('id', reg.id)
      if (produtoCriado) await supabase.from('estoque_produtos').delete().eq('id', prodId)
      setErro(mensagemErro(errSaldo, 'Não foi possível atualizar o saldo do estoque'))
      setSaving(false)
      return
    }

    // Custo médio ponderado com o preço real do produto (antes ficava 0 e derrubava o CMP)
    if (!produtoCriado && prodSelecionado && custoUnit > 0) {
      const precoAtual = Number(prodSelecionado.preco_unitario || 0)
      const antes = (saldo ?? 0) - qtdNum
      let novoCMP: number | null = null
      if (!precoAtual) novoCMP = custoUnit
      else if (controlaSaldo(prodSelecionado) && antes > 0 && saldo) novoCMP = (antes * precoAtual + qtdNum * custoUnit) / saldo
      if (novoCMP != null) {
        const { error: errCmp } = await supabase.from('estoque_produtos').update({ preco_unitario: novoCMP }).eq('id', prodId)
        if (errCmp) alert(mensagemErro(errCmp, 'Sobra enviada, mas o custo médio do produto não foi atualizado'))
      }
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
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -m-2 rounded-lg hover:bg-[#F1F5F9]"><X size={16} className="text-[#64748B]" /></button>
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
              <input type="number" inputMode="decimal" min="0.01" step="0.01" max={maximo ?? undefined} className="field" value={quantidade} onChange={e => setQuantidade(e.target.value)}
                placeholder={maximo != null ? `máx. ${maximo} ${material.unidade ?? ''}` : ''} />
              {jaEnviado > 0 && <p className="text-xs text-[#94A3B8] mt-1">Já enviado: {jaEnviado} {material.unidade ?? ''}</p>}
              {acimaDoMaximo && <p className="text-xs text-red-500 mt-1">Acima do disponível ({maximo} {material.unidade ?? ''})</p>}
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
          {erro && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg">Cancelar</button>
            <button onClick={salvar} disabled={saving || !estoqueId || !qtdNum || !responsavel.trim() || acimaDoMaximo}
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
