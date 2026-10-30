'use client'

import { useState } from 'react'
import { FileUp, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mensagemErro } from '@/lib/erros'
import { formatarData, somarDias } from '@/lib/datas'
import { formatarMoeda } from '@/lib/numero'
import { type Fornecedor, formatarDocumento, garantirFornecedor, nomeFornecedor } from '@/lib/fornecedores'
import {
  type BoletoDda, type Conta, conciliarDda, type ItemConciliacao, SELECT_CONTA, STATUS_CONTA,
} from '@/lib/contasPagar'

type Revisao = { itens: ItemConciliacao[]; ausentes: Conta[] }

// Ação proposta para cada linha (null = nada a fazer, só informa)
function acaoDoItem(it: ItemConciliacao): string | null {
  if (it.tipo === 'sem_registro') return 'Lançar como divergente'
  if (it.conta.status === 'pago' || it.conta.status === 'cancelado') return null
  if (it.tipo === 'confere') return it.conta.status === 'conferido_dda' ? null : 'Marcar Conferido DDA'
  return 'Marcar Divergente'
}

// Importa o extrato do DDA (PDF, foto ou planilha), cruza com as contas lançadas
// e propõe as marcações; nada é gravado antes de "Aplicar".
export default function ModalConciliarDda({ fornecedores, onFornecedorCriado, onClose, onDone }: {
  fornecedores: Fornecedor[]
  onFornecedorCriado: (f: Fornecedor) => void
  onClose: () => void
  onDone: () => void
}) {
  const [lendo, setLendo] = useState(false)
  const [revisao, setRevisao] = useState<Revisao | null>(null)
  const [marcados, setMarcados] = useState<Record<string, boolean>>({})
  const [aplicando, setAplicando] = useState(false)
  const [erro, setErro] = useState('')

  async function lerExtrato(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    setLendo(true); setErro('')
    try {
      const fd = new FormData(); fd.append('file', arquivo)
      const res = await fetch('/api/contas-pagar/ler-dda', { method: 'POST', body: fd })
      const r = await res.json()
      if (!res.ok) { setErro(r.error ?? 'Não foi possível ler o extrato.'); return }
      const boletos = (r.boletos ?? []) as BoletoDda[]
      if (boletos.length === 0) { setErro('Nenhum boleto encontrado no arquivo.'); return }

      // Contas perto do período do extrato (folga para vencimento trocado)
      const datas = boletos.map(b => b.vencimento).sort()
      const { data: contas, error } = await createClient().from('contas_pagar').select(SELECT_CONTA)
        .neq('status', 'cancelado')
        .gte('data_vencimento', somarDias(datas[0], -30))
        .lte('data_vencimento', somarDias(datas[datas.length - 1], 30))
      if (error) { setErro(mensagemErro(error, 'Erro ao carregar as contas')); return }

      const rev = conciliarDda(boletos, (contas ?? []) as Conta[], fornecedores)
      setRevisao(rev)
      setMarcados(Object.fromEntries(rev.itens.map((it, i) => [`i${i}`, acaoDoItem(it) !== null])))
    } catch (err) {
      setErro(mensagemErro(err as Error, 'Erro ao ler o extrato'))
    } finally {
      setLendo(false)
    }
  }

  async function aplicar() {
    if (!revisao) return
    setAplicando(true); setErro('')
    const sb = createClient()
    const falhas: string[] = []
    let feitas = 0
    let lista = fornecedores

    for (let i = 0; i < revisao.itens.length; i++) {
      const it = revisao.itens[i]
      if (!marcados[`i${i}`] || !acaoDoItem(it)) continue
      if (it.tipo === 'sem_registro') {
        const b = it.boleto
        let { fornecedor: f, criado } = await garantirFornecedor(sb, { nome: b.beneficiario, cnpj: b.cnpj }, lista)
        if (!f) {
          const { data } = await sb.from('fornecedores').insert({ nome: b.beneficiario || 'Beneficiário não identificado (DDA)' }).select().single()
          f = (data as Fornecedor | null) ?? null
          criado = Boolean(f)
        }
        if (!f) { falhas.push(`${b.beneficiario ?? 'boleto'}: não foi possível cadastrar o fornecedor`); continue }
        if (criado) { onFornecedorCriado(f); lista = [...lista, f] }
        const { error } = await sb.from('contas_pagar').insert({
          fornecedor_id: f.id, data_vencimento: b.vencimento, valor: b.valor, status: 'divergente',
          motivo_divergencia: 'Boleto no DDA sem registro no sistema', descricao: 'Lançado pela importação do DDA',
        })
        if (error) falhas.push(`${b.beneficiario ?? 'boleto'}: ${mensagemErro(error)}`); else feitas++
      } else {
        const payload = it.tipo === 'confere'
          ? { status: 'conferido_dda' }
          : { status: 'divergente', motivo_divergencia: it.diferencas.join(' · ') }
        const { error } = await sb.from('contas_pagar').update(payload).eq('id', it.conta.id)
        if (error) falhas.push(mensagemErro(error)); else feitas++
      }
    }
    for (const c of revisao.ausentes) {
      if (!marcados[`a${c.id}`]) continue
      const { error } = await sb.from('contas_pagar').update({ status: 'divergente', motivo_divergencia: 'Boleto não apareceu no DDA' }).eq('id', c.id)
      if (error) falhas.push(mensagemErro(error)); else feitas++
    }

    setAplicando(false)
    if (falhas.length) { setErro(`${feitas} alteração(ões) feita(s). Falharam:\n• ${falhas.join('\n• ')}`); return }
    onDone()
  }

  const fornecedorDe = (id: string) => fornecedores.find(f => f.id === id)
  const qtdMarcados = revisao
    ? revisao.itens.filter((it, i) => marcados[`i${i}`] && acaoDoItem(it)).length + revisao.ausentes.filter(c => marcados[`a${c.id}`]).length
    : 0

  const grupos: { tipo: ItemConciliacao['tipo']; titulo: string; cor: string }[] = [
    { tipo: 'divergente', titulo: 'Divergentes', cor: 'text-red-600' },
    { tipo: 'sem_registro', titulo: 'No DDA, mas não lançados', cor: 'text-amber-700' },
    { tipo: 'confere', titulo: 'Conferem', cor: 'text-emerald-700' },
  ]

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="font-syne font-semibold text-[#0F172A]">Conferir extrato do DDA</h2>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -mr-2"><X size={16} className="text-[#64748B]" /></button>
        </div>

        <div className="p-6 space-y-4">
          {!revisao && (
            <>
              <p className="text-sm text-[#64748B]">Baixe o extrato do DDA no banco (PDF, planilha ou um print da tela) e envie aqui. O sistema cruza cada boleto com as contas lançadas pelo CNPJ, valor e vencimento — você revisa antes de gravar.</p>
              <label className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-dashed border-[#C7D2FE] hover:bg-[#EEF2FF] cursor-pointer ${lendo ? 'opacity-60 pointer-events-none' : ''}`}>
                {lendo ? <Loader2 size={20} className="text-[#4F7CFF] animate-spin shrink-0" /> : <FileUp size={20} className="text-[#4F7CFF] shrink-0" />}
                <span>
                  <span className="block text-sm font-medium text-[#4F7CFF]">{lendo ? 'Lendo o extrato...' : 'Escolher arquivo do DDA'}</span>
                  <span className="block text-[11px] text-[#94A3B8]">PDF, imagem (PNG/JPG) ou planilha (XLSX, XLS, CSV)</span>
                </span>
                <input type="file" className="hidden" disabled={lendo} onChange={lerExtrato}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.xlsx,.xls,.csv,application/pdf,image/*" />
              </label>
            </>
          )}

          {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 whitespace-pre-line">{erro}</p>}

          {revisao && (
            <>
              <p className="text-sm text-[#64748B]">
                {revisao.itens.length} boleto{revisao.itens.length !== 1 ? 's' : ''} no extrato. Desmarque o que não quiser gravar.
              </p>

              {grupos.map(g => {
                const linhas = revisao.itens.map((it, i) => ({ it, i })).filter(x => x.it.tipo === g.tipo)
                if (linhas.length === 0) return null
                return (
                  <div key={g.tipo} className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                    <p className={`px-3 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold ${g.cor}`}>{g.titulo} ({linhas.length})</p>
                    <div className="divide-y divide-[#F1F5F9]">
                      {linhas.map(({ it, i }) => {
                        const acao = acaoDoItem(it)
                        const b = it.boleto
                        const conta = it.tipo === 'sem_registro' ? null : it.conta
                        return (
                          <label key={i} className={`flex items-start gap-3 px-3 py-2.5 ${acao ? 'cursor-pointer hover:bg-[#FAFAFA]' : ''}`}>
                            <input type="checkbox" className="w-4 h-4 mt-0.5 accent-[#4F7CFF] shrink-0" disabled={!acao}
                              checked={Boolean(acao && marcados[`i${i}`])} onChange={e => setMarcados(m => ({ ...m, [`i${i}`]: e.target.checked }))} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-[#0F172A] truncate flex-1">
                                  {conta ? nomeFornecedor(fornecedorDe(conta.fornecedor_id)) : (b.beneficiario || 'Beneficiário sem nome')}
                                </p>
                                <p className="text-sm font-semibold text-[#0F172A] shrink-0">{formatarMoeda(b.valor)}</p>
                              </div>
                              <p className="text-xs text-[#64748B] truncate">
                                DDA: {b.cnpj ? `${formatarDocumento(b.cnpj)} · ` : ''}vence {formatarData(b.vencimento)}
                                {conta && ` · ${conta.nota?.numero_nf ? `NF ${conta.nota.numero_nf}` : (conta.descricao || 'boleto avulso')} (${STATUS_CONTA[conta.status].label})`}
                              </p>
                              {it.tipo === 'divergente' && it.diferencas.map(d => <p key={d} className="text-xs text-red-600">{d}</p>)}
                              <p className="text-[11px] text-[#94A3B8] mt-0.5">{acao ?? (conta?.status === 'conferido_dda' ? 'Já estava conferido' : `Já está ${conta ? STATUS_CONTA[conta.status].label.toLowerCase() : ''}`)}</p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {revisao.ausentes.length > 0 && (
                <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                  <p className="px-3 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#475569]">Lançados, mas não estão no extrato ({revisao.ausentes.length})</p>
                  <p className="px-3 pt-2 text-[11px] text-[#94A3B8]">Pode ser boleto que ainda não foi registrado no banco. Marque para virar Divergente.</p>
                  <div className="divide-y divide-[#F1F5F9]">
                    {revisao.ausentes.map(c => (
                      <label key={c.id} className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#FAFAFA]">
                        <input type="checkbox" className="w-4 h-4 mt-0.5 accent-[#4F7CFF] shrink-0"
                          checked={Boolean(marcados[`a${c.id}`])} onChange={e => setMarcados(m => ({ ...m, [`a${c.id}`]: e.target.checked }))} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-[#0F172A] truncate flex-1">{nomeFornecedor(fornecedorDe(c.fornecedor_id))}</p>
                            <p className="text-sm font-semibold text-[#0F172A] shrink-0">{formatarMoeda(Number(c.valor))}</p>
                          </div>
                          <p className="text-xs text-[#64748B] truncate">
                            vence {formatarData(c.data_vencimento)} · {c.nota?.numero_nf ? `NF ${c.nota.numero_nf}` : (c.descricao || 'boleto avulso')} ({STATUS_CONTA[c.status].label})
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => { setRevisao(null); setErro('') }} className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9]">Outro arquivo</button>
                <button onClick={aplicar} disabled={aplicando || qtdMarcados === 0}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
                  {aplicando ? <Loader2 size={15} className="animate-spin" /> : null}
                  {aplicando ? 'Gravando...' : `Aplicar (${qtdMarcados})`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
