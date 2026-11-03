'use client'

import { useState } from 'react'
import { ArrowRight, ArrowRightLeft, Loader2, Pencil, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mensagemErro } from '@/lib/erros'
import { hojeLocal } from '@/lib/datas'
import { useAccess } from '@/lib/useAccess'
import { StatusMaterial, useStatusMaterial } from '@/components/StatusMaterial'

// Movimentação de parte da quantidade de um material da obra entre status
// (ex.: 14 de "Recebido" para "Em obra"). Tabela obra_material_movimentos.
export type MovimentoMaterial = {
  id: string
  material_id: string
  obra_id: string
  data: string
  quantidade: number
  de_status: string
  para_status: string
  responsavel?: string | null
  observacao?: string | null
  created_at: string
}

type MaterialBase = { id: string; obra_id: string; descricao: string; quantidade?: number | null; unidade?: string | null; status: string }

const arred = (v: number) => Math.round(v * 1000) / 1000
export const fmtQtd = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

function ordenar(movs: MovimentoMaterial[]) {
  return [...movs].sort((a, b) => a.data.localeCompare(b.data) || a.created_at.localeCompare(b.created_at))
}

// Onde estava tudo antes de movimentar: origem da primeira movimentação gravada
// (sem movimentações, o status da linha)
export function statusBaseMaterial(status: string, movs: MovimentoMaterial[]) {
  return ordenar(movs)[0]?.de_status ?? status
}

// Quantidade por status: tudo em `base` e as movimentações aplicadas em ordem de data.
// `erro` aponta a primeira movimentação que tira mais do que havia.
export function distribuicaoMaterial(quantidade: number, base: string, movs: MovimentoMaterial[]) {
  const ordem = ordenar(movs)
  const dist: Record<string, number> = { [base]: quantidade }
  let erro: { mov: MovimentoMaterial; saldo: number } | null = null
  for (const mv of ordem) {
    const saldo = arred(dist[mv.de_status] ?? 0)
    if (!erro && mv.quantidade > saldo) erro = { mov: mv, saldo }
    dist[mv.de_status] = arred(saldo - mv.quantidade)
    dist[mv.para_status] = arred((dist[mv.para_status] ?? 0) + mv.quantidade)
  }
  return { dist, erro }
}

// Status menos avançado (pela ordem das tags) que ainda tem saldo
export function statusResumo(dist: Record<string, number>, lista: StatusMaterial[], padrao: string) {
  const ordem = (c: string) => lista.find(s => s.chave === c)?.ordem ?? 0
  const comSaldo = Object.keys(dist).filter(c => dist[c] > 0).sort((a, b) => ordem(a) - ordem(b))
  return comSaldo[0] ?? padrao
}

// Partes com saldo, na ordem das tags
function partes(dist: Record<string, number>, lista: StatusMaterial[]) {
  const ordem = (c: string) => lista.find(s => s.chave === c)?.ordem ?? 0
  return Object.entries(dist).filter(([, q]) => q > 0).sort((a, b) => ordem(a[0]) - ordem(b[0]))
}

// Etiquetas "14 Recebido · 14 Em obra" quando o item está dividido; senão a etiqueta única
export function DistribuicaoMaterialBadges({ material, movimentos, className = '' }: {
  material: MaterialBase; movimentos: MovimentoMaterial[]; className?: string
}) {
  const { lista, info } = useStatusMaterial()
  const { dist } = distribuicaoMaterial(material.quantidade ?? 0, statusBaseMaterial(material.status, movimentos), movimentos)
  const ps = movimentos.length ? partes(dist, lista) : []
  if (ps.length <= 1) {
    const s = info(ps[0]?.[0] ?? material.status)
    return <span className={`inline-flex font-bold px-2 py-0.5 rounded-full text-[10px] ${className}`} style={{ backgroundColor: `${s.cor}1A`, color: s.cor }}>{s.label}</span>
  }
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {ps.map(([c, q]) => {
        const s = info(c)
        return (
          <span key={c} className="font-bold px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap" style={{ backgroundColor: `${s.cor}1A`, color: s.cor }}>
            {fmtQtd(q)} {s.label}
          </span>
        )
      })}
    </span>
  )
}

export function ModalMovimentarMaterial({ material, movimentos, onClose, onChanged }: {
  material: MaterialBase
  movimentos: MovimentoMaterial[]
  onClose: () => void
  onChanged: () => void
}) {
  const { lista, info } = useStatusMaterial()
  const { profile } = useAccess()
  const total = material.quantidade ?? 0
  const un = material.unidade ?? ''
  const [movs, setMovs] = useState<MovimentoMaterial[]>(movimentos)
  const [editando, setEditando] = useState<MovimentoMaterial | null>(null)
  const [salvando, setSalvando] = useState(false)
  // Onde estava tudo antes da primeira movimentação; sobrevive à exclusão de todas
  const [statusBase, setStatusBase] = useState(statusBaseMaterial(material.status, movimentos))

  // Saldo disponível para o formulário: sem a movimentação em edição
  const base = editando ? movs.filter(m => m.id !== editando.id) : movs
  const distBase = distribuicaoMaterial(total, statusBase, base).dist
  const distAtual = distribuicaoMaterial(total, statusBase, movs).dist
  const origens = partes(distBase, lista).map(([c]) => c)

  const proxima = (de: string) => {
    const i = lista.findIndex(s => s.chave === de)
    return lista[i + 1]?.chave ?? lista.find(s => s.chave !== de)?.chave ?? ''
  }
  const deInicial = origens.find(c => c === 'recebido') ?? origens[0] ?? statusBase
  const [de, setDe] = useState(deInicial)
  const [para, setPara] = useState(proxima(deInicial))
  const [quantidade, setQuantidade] = useState('')
  const [data, setData] = useState(hojeLocal())
  const [responsavel, setResponsavel] = useState('')
  const [observacao, setObservacao] = useState('')

  const saldoDe = distBase[de] ?? 0

  function limpar() {
    setEditando(null)
    const d = partes(distAtual, lista).map(([c]) => c)
    const novoDe = d.includes(de) ? de : (d[0] ?? statusBase)
    setDe(novoDe); setPara(proxima(novoDe))
    setQuantidade(''); setData(hojeLocal()); setResponsavel(''); setObservacao('')
  }

  function editar(m: MovimentoMaterial) {
    setEditando(m)
    setDe(m.de_status); setPara(m.para_status); setQuantidade(String(m.quantidade))
    setData(m.data); setResponsavel(m.responsavel ?? ''); setObservacao(m.observacao ?? '')
  }

  async function recarregar() {
    const sb = createClient()
    const { data: novos } = await sb.from('obra_material_movimentos').select('*').eq('material_id', material.id)
    const lista2 = (novos ?? []) as MovimentoMaterial[]
    const novaBase = statusBaseMaterial(statusBase, lista2)
    setMovs(lista2)
    setStatusBase(novaBase)
    // Status da linha = o menos avançado com saldo, para pendências e filtros que leem obra_materiais.status
    const resumo = statusResumo(distribuicaoMaterial(total, novaBase, lista2).dist, lista, novaBase)
    const { error } = await sb.from('obra_materiais').update({ status: resumo }).eq('id', material.id)
    if (error) alert(mensagemErro(error, 'Movimentação salva, mas não foi possível atualizar o status do material'))
    onChanged()
  }

  // Confere a sequência inteira (por data) antes de gravar
  function validar(candidatos: MovimentoMaterial[]) {
    const { erro } = distribuicaoMaterial(total, statusBase, candidatos)
    if (!erro) return true
    const d = new Date(erro.mov.data + 'T00:00:00').toLocaleDateString('pt-BR')
    alert(`Em ${d} só havia ${fmtQtd(erro.saldo)} ${un} em "${info(erro.mov.de_status).label}", mas a movimentação leva ${fmtQtd(erro.mov.quantidade)}.`)
    return false
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const q = parseFloat(quantidade.replace(',', '.'))
    if (!(q > 0)) { alert('Informe a quantidade.'); return }
    if (de === para) { alert('Escolha um destino diferente da origem.'); return }
    const payload = {
      material_id: material.id, obra_id: material.obra_id, data, quantidade: q,
      de_status: de, para_status: para,
      responsavel: responsavel.trim() || null, observacao: observacao.trim() || null,
    }
    const candidato: MovimentoMaterial = { ...payload, id: editando?.id ?? 'novo', created_at: editando?.created_at ?? new Date().toISOString() }
    if (!validar([...base, candidato])) return
    setSalvando(true)
    const sb = createClient()
    const { error } = editando
      ? await sb.from('obra_material_movimentos').update(payload).eq('id', editando.id)
      : await sb.from('obra_material_movimentos').insert(payload)
    if (error) { setSalvando(false); alert(mensagemErro(error, 'Erro ao salvar a movimentação')); return }
    await recarregar()
    setSalvando(false)
    limpar()
  }

  async function excluir(m: MovimentoMaterial) {
    if (!validar(movs.filter(x => x.id !== m.id))) return
    if (!confirm(`Excluir a movimentação de ${fmtQtd(m.quantidade)} ${un} (${info(m.de_status).label} → ${info(m.para_status).label})?`)) return
    const { error } = await createClient().from('obra_material_movimentos').delete().eq('id', m.id)
    if (error) { alert(mensagemErro(error, 'Erro ao excluir a movimentação')); return }
    if (editando?.id === m.id) limpar()
    await recarregar()
  }

  const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
  const partesAtual = partes(distAtual, lista)
  const historico = ordenar(movs).reverse()

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <h2 className="font-syne font-semibold text-[#0F172A] flex items-center gap-2"><ArrowRightLeft size={16} className="text-[#4F7CFF] shrink-0" /> Movimentar material</h2>
            <p className="text-xs text-[#64748B] mt-0.5 break-words">{material.descricao} · {fmtQtd(total)} {un}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -m-2 rounded-lg hover:bg-[#F1F5F9] shrink-0"><X size={16} className="text-[#64748B]" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Onde está agora */}
          <div>
            <p className="text-xs font-medium text-[#64748B] mb-2">Onde está agora</p>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-[#F1F5F9]">
              {total > 0 && partesAtual.map(([c, q]) => (
                <div key={c} style={{ width: `${(q / total) * 100}%`, backgroundColor: info(c).cor }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {partesAtual.map(([c, q]) => {
                const s = info(c)
                return (
                  <span key={c} className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${s.cor}1A`, color: s.cor }}>
                    {fmtQtd(q)} {un} · {s.label}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Formulário */}
          <form onSubmit={salvar} className="rounded-xl border border-[#E2E8F0] p-4 space-y-3">
            <p className="text-sm font-semibold text-[#0F172A]">{editando ? 'Editar movimentação' : 'Nova movimentação'}</p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">De</label>
                <select className="field" value={de} onChange={e => { setDe(e.target.value); if (e.target.value === para) setPara(proxima(e.target.value)) }}>
                  {origens.map(c => <option key={c} value={c}>{info(c).label} ({fmtQtd(distBase[c])})</option>)}
                  {!origens.includes(de) && <option value={de}>{info(de).label} (0)</option>}
                </select>
              </div>
              <ArrowRight size={16} className="text-[#94A3B8] mb-3" />
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Para</label>
                <select className="field" value={para} onChange={e => setPara(e.target.value)}>
                  {lista.filter(s => s.chave !== de).map(s => <option key={s.chave} value={s.chave}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Quantidade ({un || 'un'})</label>
                <div className="flex gap-1.5">
                  <input className="field" inputMode="decimal" required value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" />
                  {saldoDe > 0 && (
                    <button type="button" onClick={() => setQuantidade(String(saldoDe))} title="Usar todo o saldo"
                      className="shrink-0 text-xs font-medium text-[#4F7CFF] bg-[#EEF2FF] hover:bg-[#dce8ff] px-2.5 rounded-lg">
                      Tudo ({fmtQtd(saldoDe)})
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Data</label>
                <input type="date" className="field" required value={data} onChange={e => setData(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Responsável</label>
                <input className="field" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder={profile?.nome ? `Ex: ${profile.nome}` : 'Quem levou / recebeu'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Observação</label>
                <input className="field" value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Romaneio, veículo, pavimento..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              {editando && <button type="button" onClick={limpar} className="px-4 py-2 rounded-xl text-sm font-medium text-[#64748B] hover:bg-[#F1F5F9]">Cancelar edição</button>}
              <button type="submit" disabled={salvando} className="btn-primary text-sm">
                {salvando && <Loader2 size={14} className="animate-spin" />}
                {editando ? 'Salvar alteração' : 'Registrar movimentação'}
              </button>
            </div>
          </form>

          {/* Histórico */}
          <div>
            <p className="text-xs font-medium text-[#64748B] mb-2">Histórico</p>
            {historico.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">Nenhuma movimentação ainda. Hoje {fmtQtd(total)} {un} estão em &quot;{info(statusBase).label}&quot;.</p>
            ) : (
              <ul className="divide-y divide-[#F1F5F9] border border-[#E2E8F0] rounded-xl">
                {historico.map(m => (
                  <li key={m.id} className={`flex items-start gap-3 px-3 py-2.5 ${editando?.id === m.id ? 'bg-[#EEF2FF]' : ''}`}>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-[#94A3B8]">{fmtData(m.data)}</span>
                        <span className="font-semibold text-[#0F172A]">{fmtQtd(m.quantidade)} {un}</span>
                        <span className="text-xs font-semibold" style={{ color: info(m.de_status).cor }}>{info(m.de_status).label}</span>
                        <ArrowRight size={12} className="text-[#94A3B8]" />
                        <span className="text-xs font-semibold" style={{ color: info(m.para_status).cor }}>{info(m.para_status).label}</span>
                      </div>
                      {(m.responsavel || m.observacao) && (
                        <p className="text-xs text-[#64748B] mt-0.5">{[m.responsavel, m.observacao].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                    <button onClick={() => editar(m)} aria-label="Editar movimentação" title="Editar" className="p-2 -my-1 rounded text-[#94A3B8] hover:text-[#4F7CFF] hover:bg-[#EEF2FF]"><Pencil size={13} /></button>
                    <button onClick={() => excluir(m)} aria-label="Excluir movimentação" title="Excluir" className="p-2 -my-1 rounded text-[#94A3B8] hover:text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
