'use client'

import { useMemo, useRef, useState } from 'react'
import { FileUp, Link2, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mensagemErro } from '@/lib/erros'
import { formatarCompetencia, formatarData } from '@/lib/datas'
import { formatarMoeda } from '@/lib/numero'
import {
  SELECT_LANCAMENTO, chaveEstabelecimento, linhaRepetida, mesmoGasto, parcelaAnterior,
  type Lancamento, type LinhaFatura,
} from '@/lib/cartao'

type Acao =
  | { tipo: 'repetida' }
  | { tipo: 'concilia'; com: Lancamento }
  | { tipo: 'nova'; herda?: Lancamento; dispensa?: string }

const somarMeses = (comp: string, n: number) => {
  const [a, m] = comp.split('-').map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Linhas da fatura que não têm nota fiscal
function dispensaAutomatica(l: LinhaFatura): string | undefined {
  if (l.valor < 0) return 'Estorno'
  const e = l.estabelecimento.toUpperCase()
  if (/\bIOF\b/.test(e)) return 'IOF'
  if (/ANUIDADE/.test(e)) return 'Anuidade'
  if (/JUROS|ENCARGO|MULTA|MORA/.test(e)) return 'Juros/encargos'
  if (/TARIFA/.test(e)) return 'Tarifa do banco'
  return undefined
}

// Importa a fatura (OFX, planilha, PDF) do mês: cria uma linha por compra,
// reconhece o gasto já lançado à mão e a linha já importada, e faz a parcela
// herdar a nota e a classificação da parcela anterior.
export default function ModalImportarFatura({ competencia, onClose, onSaved }: {
  competencia: string
  onClose: () => void
  onSaved: (comp: string) => void
}) {
  const [comp, setComp] = useState(competencia)
  const [lendo, setLendo] = useState(false)
  const [linhas, setLinhas] = useState<LinhaFatura[] | null>(null)
  const [vencimento, setVencimento] = useState<string | null>(null)
  const [existentes, setExistentes] = useState<Lancamento[]>([])
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function ler(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return
    setLendo(true)
    const fd = new FormData()
    fd.append('file', file)
    const sb = createClient()
    // Últimos 13 meses: parcelas anteriores e gastos lançados antes da fatura
    const [res, ex] = await Promise.all([
      fetch('/api/cartao/ler-fatura', { method: 'POST', body: fd }).then(async r => ({ ok: r.ok, json: await r.json().catch(() => ({})) })).catch(() => ({ ok: false, json: {} as { error?: string; lancamentos?: LinhaFatura[]; vencimento?: string | null } })),
      sb.from('cartao_lancamentos').select(SELECT_LANCAMENTO).gte('competencia', somarMeses(competencia, -13)).order('data'),
    ])
    setLendo(false)
    if (!res.ok) { alert(res.json.error ?? 'Não consegui ler a fatura. Tente de novo.'); return }
    if (ex.error) { alert(mensagemErro(ex.error, 'Erro ao carregar os gastos já lançados')); return }
    const lidas = (res.json.lancamentos ?? []) as LinhaFatura[]
    if (lidas.length === 0) { alert('Não achei lançamentos neste arquivo.'); return }
    setExistentes((ex.data ?? []) as Lancamento[])
    setLinhas(lidas)
    if (res.json.vencimento) {
      setVencimento(res.json.vencimento)
      setComp(String(res.json.vencimento).slice(0, 7))
    }
  }

  // Decide o que fazer com cada linha (refaz se mudar o mês da fatura)
  const acoes: Acao[] = useMemo(() => {
    if (!linhas) return []
    const usados = new Set<string>()
    return linhas.map(linha => {
      if (existentes.some(l => l.competencia === comp && l.na_fatura && linhaRepetida(linha, l))) return { tipo: 'repetida' }
      const manual = existentes.find(l => !l.na_fatura && !usados.has(l.id) && mesmoGasto(linha, l))
      if (manual) { usados.add(manual.id); return { tipo: 'concilia', com: manual } }
      const anterior = parcelaAnterior(linha, existentes.filter(l => l.competencia < comp))
      // Mesmo estabelecimento de um gasto da empresa: repete a categoria
      const chave = chaveEstabelecimento(linha.estabelecimento)
      const parecido = anterior ? undefined : [...existentes].reverse().find(l => l.destino === 'empresa' && l.categoria_id && chaveEstabelecimento(l.estabelecimento) === chave)
      return { tipo: 'nova', herda: anterior ?? parecido, dispensa: dispensaAutomatica(linha) }
    })
  }, [linhas, existentes, comp])

  // Marca tudo que não é repetido sempre que as ações mudam
  const chaveAcoes = acoes.map(a => a.tipo).join()
  const [chaveMarcada, setChaveMarcada] = useState('')
  if (linhas && chaveAcoes !== chaveMarcada) {
    setChaveMarcada(chaveAcoes)
    setMarcadas(new Set(acoes.flatMap((a, i) => a.tipo === 'repetida' ? [] : [i])))
  }

  async function importar() {
    if (!linhas) return
    setSaving(true)
    const sb = createClient()
    try {
      for (const i of Array.from(marcadas).sort((a, b) => a - b)) {
        const linha = linhas[i], acao = acoes[i]
        if (acao.tipo === 'repetida') continue
        if (acao.tipo === 'concilia') {
          const { error } = await sb.from('cartao_lancamentos').update({
            na_fatura: true, competencia: comp, estabelecimento: linha.estabelecimento,
            parcela: linha.parcela ?? acao.com.parcela, data: linha.data,
          }).eq('id', acao.com.id)
          if (error) throw error
          continue
        }
        const h = acao.herda
        const ehParcela = h && h.parcela && linha.parcela
        const { data: novo, error } = await sb.from('cartao_lancamentos').insert({
          competencia: comp, data: linha.data, estabelecimento: linha.estabelecimento, valor: linha.valor,
          parcela: linha.parcela, na_fatura: true,
          descricao: ehParcela ? h.descricao : null,
          destino: h?.destino ?? null, obra_id: h?.obra_id ?? null, categoria_id: h?.categoria_id ?? null,
          dispensa_comprovante: acao.dispensa ?? null,
        }).select('id').single()
        if (error || !novo) throw error
        if (ehParcela && h.comprovantes.length > 0) {
          const { error: e2 } = await sb.from('cartao_comprovantes').insert(
            h.comprovantes.map(c => ({ lancamento_id: novo.id, path: c.path, nome: c.nome })))
          if (e2) throw e2
        }
      }
    } catch (err) {
      setSaving(false)
      alert(mensagemErro(err as Error, 'A importação parou no meio. O que já entrou está salvo; importe de novo que as linhas repetidas são puladas'))
      onSaved(comp)
      return
    }
    setSaving(false)
    onSaved(comp)
  }

  const total = linhas ? Array.from(marcadas).reduce((s, i) => s + linhas[i].valor, 0) : 0
  const qtd = (t: Acao['tipo']) => acoes.filter((a, i) => a.tipo === t && marcadas.has(i)).length

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">Importar fatura do cartão</h2>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -mr-2"><X size={16} className="text-[#64748B]" /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <input ref={inputRef} type="file" accept=".ofx,.qfx,.csv,.xlsx,.xls,.pdf,image/*" className="hidden" onChange={e => ler(e.target.files?.[0])} />
          {!linhas ? (
            <>
              <p className="text-sm text-[#64748B]">
                Baixe a fatura no site ou app do banco, de preferência em <strong>OFX</strong> (é lido na hora, sem erro).
                Planilha (CSV, Excel) e PDF também servem: a leitura é automática, mas confira as linhas.
              </p>
              <button onClick={() => inputRef.current?.click()} disabled={lendo}
                className="w-full flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-[#CBD5E1] rounded-2xl text-[#4F7CFF] hover:bg-[#F8FAFC] disabled:opacity-60">
                {lendo ? <Loader2 size={22} className="animate-spin" /> : <FileUp size={22} />}
                <span className="text-sm font-medium">{lendo ? 'Lendo a fatura…' : 'Escolher arquivo da fatura'}</span>
              </button>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">Mês da fatura</label>
                  <input type="month" className="field" value={comp} onChange={e => e.target.value && setComp(e.target.value)} />
                </div>
                {vencimento && <p className="text-xs text-[#64748B] pb-2.5">Vencimento lido: {formatarData(vencimento)}</p>}
                <div className="sm:ml-auto text-right pb-1">
                  <p className="text-xs text-[#64748B]">{marcadas.size} de {linhas.length} linhas</p>
                  <p className="font-syne font-bold text-[#0F172A]">{formatarMoeda(total)}</p>
                </div>
              </div>
              <p className="text-[11px] text-[#94A3B8] -mt-2">Confira o total com o valor da fatura no banco.</p>

              <div className="border border-[#E2E8F0] rounded-xl divide-y divide-[#F1F5F9]">
                {linhas.map((linha, i) => {
                  const a = acoes[i]
                  const marcada = marcadas.has(i)
                  return (
                    <label key={i} className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer ${a?.tipo === 'repetida' ? 'bg-[#F8FAFC]' : ''}`}>
                      <input type="checkbox" className="mt-1" checked={marcada}
                        onChange={() => setMarcadas(m => { const n = new Set(m); if (n.has(i)) n.delete(i); else n.add(i); return n })} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${a?.tipo === 'repetida' ? 'text-[#94A3B8]' : 'text-[#0F172A]'}`}>
                          {linha.estabelecimento}{linha.parcela ? <span className="text-[#94A3B8]"> · {linha.parcela}</span> : null}
                        </p>
                        <p className="text-xs text-[#94A3B8]">
                          {formatarData(linha.data)}
                          {a?.tipo === 'repetida' && ' · já importada'}
                          {a?.tipo === 'concilia' && <span className="text-emerald-700"> · <Link2 size={11} className="inline -mt-0.5" /> junta com o gasto lançado “{a.com.descricao || a.com.estabelecimento}”</span>}
                          {a?.tipo === 'nova' && a.herda?.parcela && linha.parcela && ' · herda nota e classificação da parcela anterior'}
                          {a?.tipo === 'nova' && a.herda && !(a.herda.parcela && linha.parcela) && ' · mesma categoria da última vez'}
                          {a?.tipo === 'nova' && a.dispensa && ` · sem comprovante (${a.dispensa})`}
                        </p>
                      </div>
                      <span className={`text-sm font-semibold shrink-0 ${linha.valor < 0 ? 'text-emerald-600' : 'text-[#0F172A]'}`}>{formatarMoeda(linha.valor)}</span>
                    </label>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {linhas && (
          <div className="px-6 py-4 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-xs text-[#64748B] flex-1">
              {qtd('nova')} nova{qtd('nova') !== 1 ? 's' : ''}{qtd('concilia') > 0 ? ` · ${qtd('concilia')} junta${qtd('concilia') !== 1 ? 'm' : ''} com gasto já lançado` : ''} em {formatarCompetencia(comp)}
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setLinhas(null); setVencimento(null) }} className="px-4 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9]">Outro arquivo</button>
              <button onClick={importar} disabled={saving || marcadas.size === 0}
                className="btn-primary flex items-center justify-center gap-2 py-2.5 px-5 disabled:opacity-50">
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? 'Importando…' : 'Importar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
