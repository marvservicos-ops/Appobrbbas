'use client'

import { useEffect, useState } from 'react'
import { Plus, Thermometer, Calendar, Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ContratoManutencao } from '@/lib/types'
import { mensagemErro } from '@/lib/erros'
import { formatarData } from '@/lib/datas'
import Topbar from '@/components/Topbar'
import Link from 'next/link'
import ModalContrato from './ModalContrato'

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtDate(d?: string) { return formatarData(d) || '—' }

type ResumoExclusao = { contrato: ContratoManutencao; nome: string; itens: string[] }

// O que é apagado junto com o contrato (cascade no banco)
async function contarDependencias(contratoId: string): Promise<string[]> {
  const sb = createClient()
  const contar = (tabela: string) => sb.from(tabela).select('id', { count: 'exact', head: true }).eq('contrato_id', contratoId)
  const [eq, nfs, adit, func, prod, movs] = await Promise.all([
    sb.from('equipamentos').select('id').eq('contrato_id', contratoId),
    contar('manutencao_nfs'),
    contar('manutencao_aditivos'),
    contar('manutencao_funcionarios'),
    contar('manutencao_estoque_produtos'),
    contar('manutencao_estoque_registros'),
  ])
  const equipIds = (eq.data ?? []).map((e: { id: string }) => e.id)
  let hist = 0, fotos = 0
  if (equipIds.length) {
    const [h, f] = await Promise.all([
      sb.from('manutencao_historico').select('id', { count: 'exact', head: true }).in('equipamento_id', equipIds),
      sb.from('equipamento_fotos').select('id', { count: 'exact', head: true }).in('equipamento_id', equipIds),
    ])
    hist = h.count ?? 0
    fotos = f.error ? 0 : f.count ?? 0
  }
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
  return [
    equipIds.length && plural(equipIds.length, 'equipamento', 'equipamentos'),
    hist && plural(hist, 'registro de manutenção', 'registros de manutenção'),
    fotos && plural(fotos, 'foto de equipamento', 'fotos de equipamento'),
    (nfs.count ?? 0) && plural(nfs.count ?? 0, 'nota fiscal', 'notas fiscais'),
    (adit.count ?? 0) && plural(adit.count ?? 0, 'aditivo', 'aditivos'),
    (func.count ?? 0) && plural(func.count ?? 0, 'funcionário alocado', 'funcionários alocados'),
    (prod.count ?? 0) && plural(prod.count ?? 0, 'produto no estoque do cliente', 'produtos no estoque do cliente'),
    (movs.count ?? 0) && plural(movs.count ?? 0, 'movimentação de estoque', 'movimentações de estoque'),
  ].filter((x): x is string => !!x)
}

export default function ManutencoesPage() {
  const [contratos, setContratos] = useState<ContratoManutencao[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<ContratoManutencao | null>(null)
  const [search, setSearch] = useState('')
  const [exclusao, setExclusao] = useState<ResumoExclusao | null>(null)
  const [verificando, setVerificando] = useState<string | null>(null)
  const [processando, setProcessando] = useState(false)

  async function load() {
    const { data, error } = await createClient()
      .from('contratos_manutencao')
      .select('*, empresa:empresas(id, razao_social, apelido)')
      .order('created_at', { ascending: false })
    if (error) alert(mensagemErro(error, 'Erro ao carregar contratos'))
    setContratos((data ?? []) as ContratoManutencao[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function excluir(c: ContratoManutencao, e: React.MouseEvent) {
    e.preventDefault()
    const nome = (c.empresa as any)?.apelido ?? (c.empresa as any)?.razao_social ?? 'este contrato'
    setVerificando(c.id)
    const itens = await contarDependencias(c.id)
    setVerificando(null)
    setExclusao({ contrato: c, nome, itens })
  }

  async function inativarContrato() {
    if (!exclusao) return
    setProcessando(true)
    const { error } = await createClient().from('contratos_manutencao').update({ ativo: false }).eq('id', exclusao.contrato.id)
    setProcessando(false)
    if (error) { alert(mensagemErro(error, 'Erro ao inativar contrato')); return }
    setExclusao(null)
    load()
  }

  async function excluirDefinitivo() {
    if (!exclusao) return
    if (!confirm(`Excluir DEFINITIVAMENTE o contrato de ${exclusao.nome}${exclusao.itens.length ? ' e tudo o que está listado' : ''}? Não dá para desfazer.`)) return
    setProcessando(true)
    const { error } = await createClient().from('contratos_manutencao').delete().eq('id', exclusao.contrato.id)
    setProcessando(false)
    if (error) { alert(mensagemErro(error, 'Erro ao excluir contrato')); return }
    setExclusao(null)
    load()
  }

  const filtrados = contratos.filter(c => {
    const nome = (c.empresa as any)?.apelido ?? (c.empresa as any)?.razao_social ?? ''
    return nome.toLowerCase().includes(search.toLowerCase()) ||
      c.numero_contrato?.toLowerCase().includes(search.toLowerCase())
  })

  const ativos = contratos.filter(c => c.ativo).length
  const totalMensal = contratos.filter(c => c.ativo).reduce((s, c) => s + c.valor_mensal, 0)

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <Topbar searchPlaceholder="Buscar contrato..." onSearch={setSearch} />
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-syne font-bold text-2xl text-[#0F172A]">Manutenções</h1>
            <p className="text-sm text-[#64748B] mt-0.5">Contratos de manutenção preventiva</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#4F7CFF] hover:bg-[#3D68F0] text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={16} /> Novo Contrato
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="card py-4">
            <p className="text-xs text-[#94A3B8] font-medium">Contratos ativos</p>
            <p className="text-2xl font-syne font-bold text-[#0F172A] mt-1">{ativos}</p>
          </div>
          <div className="card py-4">
            <p className="text-xs text-[#94A3B8] font-medium">Receita mensal</p>
            <p className="text-2xl font-syne font-bold text-[#10B981] mt-1">{fmt(totalMensal)}</p>
          </div>
          <div className="card py-4 hidden md:block">
            <p className="text-xs text-[#94A3B8] font-medium">Total contratos</p>
            <p className="text-2xl font-syne font-bold text-[#0F172A] mt-1">{contratos.length}</p>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#4F7CFF] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtrados.length === 0 ? (
          <div className="card text-center py-16">
            <Thermometer size={40} className="text-[#E2E8F0] mx-auto mb-3" />
            <p className="text-[#94A3B8] font-medium">Nenhum contrato encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtrados.map(c => (
              <div key={c.id} className="relative group">
                <Link href={`/manutencoes/${c.id}`}
                  className="card hover:shadow-md hover:border-[#4F7CFF]/30 border border-transparent transition-all cursor-pointer block">
                  <div className="flex items-start justify-between mb-3 pr-[88px] [@media(hover:hover)]:pr-0">
                    <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0">
                      <Thermometer size={18} className="text-[#4F7CFF]" />
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.ativo ? 'bg-[#D1FAE5] text-[#059669]' : 'bg-[#F1F5F9] text-[#94A3B8]'}`}>
                      {c.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <h3 className="font-syne font-semibold text-[#0F172A] group-hover:text-[#4F7CFF] transition-colors truncate">
                    {(c.empresa as any)?.apelido ?? (c.empresa as any)?.razao_social ?? '—'}
                  </h3>
                  {c.numero_contrato && (
                    <p className="text-xs text-[#94A3B8] mt-0.5">{c.numero_contrato}</p>
                  )}
                  <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-[#64748B]">
                      <Calendar size={12} />
                      <span>Desde {fmtDate(c.data_inicio)}</span>
                    </div>
                    <p className="text-sm font-bold text-[#10B981]">{fmt(c.valor_mensal)}<span className="text-xs font-normal text-[#94A3B8]">/mês</span></p>
                  </div>
                </Link>
                {/* Ações flutuantes */}
                <div className="absolute top-3 right-3 flex [@media(hover:hover)]:hidden [@media(hover:hover)]:group-hover:flex items-center gap-1 z-10">
                  <button
                    onClick={e => { e.preventDefault(); setEditando(c) }}
                    aria-label="Editar contrato" title="Editar contrato"
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white shadow border border-[#E2E8F0] hover:bg-[#EEF2FF] text-[#64748B] hover:text-[#4F7CFF] transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={e => excluir(c, e)}
                    disabled={verificando === c.id}
                    aria-label="Excluir ou inativar contrato" title="Excluir ou inativar contrato"
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white shadow border border-[#E2E8F0] hover:bg-red-50 text-[#64748B] hover:text-red-500 transition-colors disabled:opacity-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <ModalContrato onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />
      )}
      {editando && (
        <ModalContrato contrato={editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); load() }} />
      )}
      {exclusao && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-syne font-semibold text-[#0F172A]">Excluir contrato de {exclusao.nome}?</h2>
            {exclusao.itens.length > 0 ? (
              <div className="text-sm text-[#64748B] space-y-2">
                <p>Excluir apaga junto, sem como desfazer:</p>
                <ul className="list-disc pl-5 text-[#0F172A]">
                  {exclusao.itens.map(i => <li key={i}>{i}</li>)}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-[#64748B]">Este contrato não tem equipamentos, notas, aditivos nem estoque cadastrados.</p>
            )}
            <p className="text-sm text-[#64748B]">
              {exclusao.contrato.ativo
                ? <>Recomendado: <strong className="text-[#0F172A]">inativar</strong>. O contrato sai dos ativos e da receita mensal, mas o histórico fica guardado.</>
                : 'Este contrato já está inativo.'}
            </p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button onClick={() => setExclusao(null)} disabled={processando} className="px-4 py-2 text-sm text-[#64748B] hover:bg-[#F1F5F9] rounded-lg">Cancelar</button>
              <button onClick={excluirDefinitivo} disabled={processando}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg disabled:opacity-50">
                Excluir tudo
              </button>
              {exclusao.contrato.ativo && (
                <button onClick={inativarContrato} disabled={processando}
                  className="px-4 py-2 text-sm font-medium bg-[#4F7CFF] text-white rounded-lg hover:bg-[#3D68F0] disabled:opacity-50">
                  {processando ? 'Salvando...' : 'Inativar contrato'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
