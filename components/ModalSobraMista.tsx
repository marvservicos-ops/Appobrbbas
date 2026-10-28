'use client'

import { useEffect, useState } from 'react'
import { Scale, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EstoqueProduto } from '@/lib/types'
import { hojeLocal } from '@/lib/datas'
import { mensagemErro } from '@/lib/erros'
import { ajustarSaldo, controlaSaldo } from '@/lib/estoque/saldo'

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Sobra misturada que volta da obra: pesa o balde, credita a obra pelo R$/kg
// e soma os kg no item de sobra mista (sem precisar separar parafuso por tipo).
export default function ModalSobraMista({ obraId, produtosSobra, onClose, onSaved }: {
  obraId?: string
  produtosSobra?: EstoqueProduto[]
  onClose: () => void
  onSaved: () => void
}) {
  const [itens, setItens] = useState<EstoqueProduto[]>(produtosSobra ?? [])
  const [obras, setObras] = useState<{ id: string; titulo: string }[]>([])
  const [produtoId, setProdutoId] = useState(produtosSobra?.[0]?.id ?? '')
  const [obraSel, setObraSel] = useState(obraId ?? '')
  const [kg, setKg] = useState('')
  const [precoKg, setPrecoKg] = useState(produtosSobra?.[0]?.preco_unitario ? String(produtosSobra[0].preco_unitario) : '')
  const [responsavel, setResponsavel] = useState('')
  const [data, setData] = useState(hojeLocal())
  const [loading, setLoading] = useState(!produtosSobra || !obraId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [prodRes, obrasRes] = await Promise.all([
        produtosSobra ? Promise.resolve({ data: produtosSobra }) : supabase.from('estoque_produtos').select('*').eq('sobra_mista', true).eq('ativo', true).order('nome'),
        obraId ? Promise.resolve({ data: [] }) : supabase.from('obras').select('id, titulo').order('titulo'),
      ])
      const prods = (prodRes.data ?? []) as EstoqueProduto[]
      setItens(prods)
      if (!produtosSobra && prods[0]) {
        setProdutoId(prods[0].id)
        if (prods[0].preco_unitario) setPrecoKg(String(prods[0].preco_unitario))
      }
      setObras((obrasRes.data ?? []) as { id: string; titulo: string }[])
      setLoading(false)
    }
    if (!produtosSobra || !obraId) load()
  }, [obraId, produtosSobra])

  const produto = itens.find(p => p.id === produtoId)
  const kgNum = parseFloat(kg) || 0
  const precoNum = parseFloat(precoKg) || 0
  const credito = kgNum * precoNum

  function trocarProduto(id: string) {
    setProdutoId(id)
    const p = itens.find(x => x.id === id)
    setPrecoKg(p?.preco_unitario ? String(p.preco_unitario) : '')
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!produto) { setError('Cadastre um item de sobra mista no estoque (Produtos → editar → "Item de sobra mista").'); return }
    if (!obraSel) { setError('Selecione a obra de onde a sobra voltou.'); return }
    if (kgNum <= 0) { setError('Informe o peso em kg.'); return }
    if (precoNum <= 0) { setError('Informe o valor do kg.'); return }
    if (!responsavel.trim()) { setError('Informe o responsável.'); return }
    setSaving(true); setError('')
    const supabase = createClient()

    const { data: reg, error: regErr } = await supabase.from('estoque_registros').insert({
      estoque_id: produto.estoque_id,
      produto_id: produto.id,
      produto_nome: produto.nome,
      tipo: 'entrada',
      quantidade: kgNum,
      unidade: produto.unidade || 'kg',
      responsavel: responsavel.trim(),
      data,
      obra_id: obraSel,
      preco_unitario_custo: precoNum,
      valor_total: credito,
      observacoes: 'Sobra mista devolvida da obra (pesada)',
    }).select('id').single()
    if (regErr) { setError(mensagemErro(regErr, 'Não foi possível registrar a sobra')); setSaving(false); return }

    // Soma no banco (sem sobrescrever outra movimentação feita ao mesmo tempo)
    const { error: saldoErr } = await ajustarSaldo(supabase, produto.id, kgNum, { pisoZero: !controlaSaldo(produto) })
    if (saldoErr) {
      await supabase.from('estoque_registros').delete().eq('id', reg.id)
      setError(mensagemErro(saldoErr, 'Não foi possível atualizar o saldo do item de sobra'))
      setSaving(false)
      return
    }
    if (precoNum !== (produto.preco_unitario ?? 0)) {
      const { error: precoErr } = await supabase.from('estoque_produtos').update({ preco_unitario: precoNum }).eq('id', produto.id)
      if (precoErr) alert(mensagemErro(precoErr, 'Sobra registrada, mas o valor do kg não foi atualizado'))
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[440px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div>
            <h3 className="font-syne font-semibold text-[#0F172A]">Devolver sobra mista</h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">Pese o balde de sobra misturada da obra. Não precisa separar.</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -m-2 rounded-lg hover:bg-[#F1F5F9]"><X size={16} className="text-[#64748B]" /></button>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-[#4F7CFF]" /></div>
        ) : (
          <form onSubmit={salvar} className="p-5 space-y-4">
            {itens.length === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                Nenhum item de sobra mista cadastrado. No estoque de materiais, crie um produto em kg sem controle de saldo e marque &quot;Item de sobra mista&quot;.
              </p>
            )}
            {!obraId && (
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Obra *</label>
                <select className="field" value={obraSel} onChange={e => setObraSel(e.target.value)}>
                  <option value="">Selecione a obra...</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                </select>
              </div>
            )}
            {itens.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Item de sobra</label>
                <select className="field" value={produtoId} onChange={e => trocarProduto(e.target.value)}>
                  {itens.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Peso (kg) *</label>
                <input type="number" inputMode="decimal" step="0.001" min="0" className="field" autoFocus value={kg} onChange={e => setKg(e.target.value)} placeholder="0,000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">R$ por kg *</label>
                <input type="number" inputMode="decimal" step="0.01" min="0" className="field" value={precoKg} onChange={e => setPrecoKg(e.target.value)} placeholder="0,00" />
              </div>
            </div>
            {produto && precoNum > 0 && precoNum !== (produto.preco_unitario ?? 0) && (
              <p className="text-xs text-[#64748B]">O valor do kg do item será atualizado para {moeda(precoNum)}.</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Responsável *</label>
                <input className="field" value={responsavel} onChange={e => setResponsavel(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Data</label>
                <input type="date" className="field" value={data} onChange={e => setData(e.target.value)} />
              </div>
            </div>
            {credito > 0 && (
              <p className="text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
                Crédito à obra: <strong>{moeda(credito)}</strong> ({kgNum} kg × {moeda(precoNum)})
              </p>
            )}
            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg">Cancelar</button>
              <button type="submit" disabled={saving || itens.length === 0} className="btn-primary text-sm flex items-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Scale size={14} />}
                {saving ? 'Registrando...' : 'Registrar sobra'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
