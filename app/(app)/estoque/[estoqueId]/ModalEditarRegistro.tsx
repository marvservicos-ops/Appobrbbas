'use client'

import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Estoque, EstoqueProduto, EstoqueRegistro } from '@/lib/types'
import { ajustarSaldo, controlaSaldo } from '@/lib/estoque/saldo'
import { arred, numeroOuPadrao } from '@/lib/numero'
import { mensagemErro } from '@/lib/erros'
import { acharCustoVinculado, geraCustoAdministrativo } from './registroVinculos'

// Corrige um registro já lançado (obra/destino, quantidade, data, responsável, observação).
// Mudou a quantidade → o saldo do produto é ajustado pela diferença, e os lançamentos
// gerados junto (estoque da manutenção, custo administrativo) acompanham.
export default function ModalEditarRegistro({ registro, estoque, produtos, onClose, onSaved }: {
  registro: EstoqueRegistro; estoque: Estoque; produtos: EstoqueProduto[]
  onClose: () => void; onSaved: () => void
}) {
  const ehSaida = registro.tipo === 'saida'
  const produto = produtos.find(p => p.id === registro.produto_id)
  const semControleSaida = ehSaida && !!produto && !controlaSaldo(produto)
  // Limpeza/Copa: "uso interno" gera custo administrativo, então o tipo de destino não muda aqui
  const geraCusto = estoque.icone === 'sparkles' || estoque.nome === 'Copa/Escritório'
  const podeTrocarTipoDestino = ehSaida && !geraCusto && (registro.destino_tipo === 'obra' || registro.destino_tipo === 'uso_interno')
  const mostraObra = registro.destino_tipo === 'obra' || (!registro.destino_tipo && !!registro.obra_id)

  const [data, setData] = useState(registro.data)
  const [quantidade, setQuantidade] = useState(String(registro.quantidade))
  const [responsavel, setResponsavel] = useState(registro.responsavel)
  const [observacoes, setObservacoes] = useState(registro.observacoes ?? '')
  const [destinoTipo, setDestinoTipo] = useState(registro.destino_tipo ?? null)
  const [obraId, setObraId] = useState(registro.obra_id ?? '')
  const [funcionarioId, setFuncionarioId] = useState(registro.funcionario_id ?? '')
  const [obras, setObras] = useState<{ id: string; titulo: string }[]>([])
  const [funcionarios, setFuncionarios] = useState<{ id: string; nome: string }[]>([])
  const [jaDevolvido, setJaDevolvido] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    if (mostraObra || podeTrocarTipoDestino) {
      // Todas as obras (não só as em andamento): o registro pode ser de uma obra já concluída
      supabase.from('obras').select('id, titulo').order('titulo').then(({ data }) => setObras(data ?? []))
    }
    if (registro.funcionario_id) {
      supabase.from('funcionarios').select('id, nome').order('nome').then(({ data }) => setFuncionarios(data ?? []))
    }
    if (ehSaida) {
      supabase.from('estoque_registros').select('quantidade').eq('registro_origem_id', registro.id)
        .then(({ data }) => setJaDevolvido(arred((data ?? []).reduce((s, r) => s + Number(r.quantidade), 0))))
    }
  }, [registro.id])

  const qtdNova = numeroOuPadrao(quantidade, NaN)
  const diff = Number.isNaN(qtdNova) ? 0 : arred(qtdNova - registro.quantidade)
  // Saída maior baixa mais saldo; entrada maior soma mais
  const deltaSaldo = ehSaida ? -diff : diff

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (Number.isNaN(qtdNova) || qtdNova <= 0) { setError('Informe uma quantidade maior que zero.'); return }
    if (!responsavel.trim()) { setError('Informe o responsável.'); return }
    if (!data) { setError('Informe a data.'); return }
    if (ehSaida && qtdNova < jaDevolvido) { setError(`Já foram devolvidos ${jaDevolvido} ${registro.unidade ?? ''} desta saída; a quantidade não pode ser menor.`); return }
    if (ehSaida && diff > 0 && produto && controlaSaldo(produto) && produto.quantidade_atual - diff < 0) {
      setError(`Saldo insuficiente para aumentar a saída: há ${produto.quantidade_atual} ${produto.unidade} em estoque.`); return
    }
    const destinoFinal = podeTrocarTipoDestino ? destinoTipo : registro.destino_tipo
    if (destinoFinal === 'obra' && (mostraObra || podeTrocarTipoDestino) && !obraId) { setError('Selecione a obra.'); return }

    setSaving(true); setError('')
    const supabase = createClient()
    const custoVinculado = diff !== 0 || data !== registro.data
      ? geraCustoAdministrativo(registro, estoque) ? await acharCustoVinculado(supabase, registro) : null
      : null

    const valorTotal = registro.preco_unitario_custo ? arred(qtdNova * registro.preco_unitario_custo, 2) : registro.valor_total ?? null
    const payload: Record<string, unknown> = {
      data, quantidade: qtdNova, responsavel: responsavel.trim(), observacoes: observacoes.trim() || null,
      valor_total: valorTotal,
    }
    if (podeTrocarTipoDestino) {
      payload.destino_tipo = destinoTipo
      payload.obra_id = destinoTipo === 'obra' ? obraId || null : null
    } else if (mostraObra) {
      payload.obra_id = obraId || null
    }
    if (registro.funcionario_id) payload.funcionario_id = funcionarioId || null

    const { error: errReg } = await supabase.from('estoque_registros').update(payload).eq('id', registro.id)
    if (errReg) { setError(mensagemErro(errReg, 'Erro ao salvar o registro')); setSaving(false); return }

    const avisos: string[] = []
    if (deltaSaldo !== 0 && registro.produto_id && !semControleSaida) {
      const { error: errSaldo } = await ajustarSaldo(supabase, registro.produto_id, deltaSaldo, { pisoZero: produto ? !controlaSaldo(produto) : false })
      if (errSaldo) avisos.push(`saldo do produto (${mensagemErro(errSaldo)})`)
    }

    // Entrada no estoque do contrato de manutenção gerada por esta saída
    if (ehSaida && registro.destino_tipo === 'manutencao' && (diff !== 0 || data !== registro.data)) {
      const { data: mRegs, error: errM } = await supabase.from('manutencao_estoque_registros')
        .select('id, contrato_id, produto_id').eq('origem_estoque_registro_id', registro.id)
      if (errM) avisos.push(`estoque da manutenção (${mensagemErro(errM)})`)
      for (const m of mRegs ?? []) {
        const { error: errUp } = await supabase.from('manutencao_estoque_registros').update({ quantidade: qtdNova, data }).eq('id', m.id)
        if (errUp) { avisos.push(`estoque da manutenção (${mensagemErro(errUp)})`); continue }
        if (diff !== 0) {
          const { data: mp } = await supabase.from('manutencao_estoque_produtos')
            .select('id').eq('contrato_id', m.contrato_id).eq('produto_id', m.produto_id).maybeSingle()
          const errAj = mp ? (await ajustarSaldo(supabase, mp.id, diff, { tabela: 'manutencao_estoque_produtos' })).error : null
          if (errAj) avisos.push(`saldo no contrato de manutenção (${mensagemErro(errAj)})`)
        }
      }
    }

    // Custo administrativo (Limpeza uso interno / Copa)
    if (custoVinculado) {
      if (custoVinculado.id) {
        const { error: errC } = await supabase.from('custos_administrativos').update({
          descricao: `${registro.produto_nome} (${qtdNova} ${registro.unidade ?? 'un'})`,
          valor: valorTotal ?? 0, data,
        }).eq('id', custoVinculado.id)
        if (errC) avisos.push(`custo administrativo (${mensagemErro(errC)})`)
      } else {
        avisos.push('custo administrativo (não foi possível identificá-lo com segurança — corrija em Administrativo)')
      }
    }

    setSaving(false)
    if (avisos.length > 0) alert(`Registro salvo, mas não foi possível atualizar:\n• ${avisos.join('\n• ')}`)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[440px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div>
            <h3 className="font-syne font-semibold text-[#0F172A]">Editar registro</h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">{ehSaida ? 'Saída' : 'Entrada'} · {registro.produto_nome}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2"><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={salvar} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Data *</label>
              <input type="date" required className="field" value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Quantidade * <span className="text-[#94A3B8] font-normal">({registro.unidade ?? 'un'})</span></label>
              <input type="text" inputMode="decimal" required className="field" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
            </div>
          </div>
          {diff !== 0 && registro.produto_id && (
            <p className="text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-lg">
              {semControleSaida
                ? 'Produto sem controle de saldo: o saldo não muda.'
                : <>O saldo de {produto?.nome ?? registro.produto_nome} será ajustado em <strong>{deltaSaldo > 0 ? '+' : ''}{deltaSaldo} {registro.unidade ?? ''}</strong>.</>}
              {registro.preco_unitario_custo ? ' O valor do registro é recalculado pelo mesmo preço unitário.' : ''}
            </p>
          )}

          {podeTrocarTipoDestino && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Destino</label>
              <div className="grid grid-cols-2 gap-2">
                {(['obra', 'uso_interno'] as const).map(d => (
                  <button key={d} type="button" onClick={() => setDestinoTipo(d)}
                    className={`py-2 rounded-lg text-xs font-medium border-2 transition-all ${destinoTipo === d ? 'border-[#4F7CFF] bg-[#EEF2FF] text-[#4F7CFF]' : 'border-[#E2E8F0] text-[#64748B]'}`}>
                    {d === 'obra' ? 'Obra' : 'Uso Interno'}
                  </button>
                ))}
              </div>
            </div>
          )}
          {((podeTrocarTipoDestino && destinoTipo === 'obra') || (!podeTrocarTipoDestino && mostraObra)) && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Obra *</label>
              <select className="field" value={obraId} onChange={e => setObraId(e.target.value)}>
                <option value="">{obras.length === 0 ? 'Carregando…' : 'Selecione a obra...'}</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
              </select>
            </div>
          )}
          {ehSaida && registro.destino_tipo === 'manutencao' && (
            <p className="text-xs text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2 rounded-lg">
              Destino Manutenção: para trocar o contrato, exclua este registro e lance de novo. A quantidade e a data acompanham no estoque do contrato.
            </p>
          )}
          {registro.funcionario_id && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Funcionário</label>
              <select className="field" value={funcionarioId} onChange={e => setFuncionarioId(e.target.value)}>
                <option value="">{funcionarios.length === 0 ? 'Carregando…' : 'Selecione...'}</option>
                {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Responsável *</label>
            <input required className="field" value={responsavel} onChange={e => setResponsavel(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Observações</label>
            <textarea className="field resize-none" rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" />
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
