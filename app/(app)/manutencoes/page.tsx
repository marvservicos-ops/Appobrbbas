'use client'

import { useEffect, useState } from 'react'
import { Plus, Thermometer, Calendar, Pencil, Trash2, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ContratoManutencao } from '@/lib/types'
import Topbar from '@/components/Topbar'
import Link from 'next/link'

type Empresa = { id: string; razao_social: string; apelido?: string | null }
type FormContrato = { empresa_id: string; numero_contrato: string; valor_mensal: string; data_inicio: string; observacoes: string; ativo: boolean }

function emptyForm(): FormContrato {
  return { empresa_id: '', numero_contrato: '', valor_mensal: '', data_inicio: '', observacoes: '', ativo: true }
}

interface ModalContratoProps {
  contrato?: ContratoManutencao | null
  onClose: () => void
  onSaved: () => void
}

function ModalContrato({ contrato, onClose, onSaved }: ModalContratoProps) {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [form, setForm] = useState<FormContrato>(contrato ? {
    empresa_id: (contrato.empresa as any)?.id ?? contrato.empresa_id ?? '',
    numero_contrato: contrato.numero_contrato ?? '',
    valor_mensal: String(contrato.valor_mensal),
    data_inicio: contrato.data_inicio,
    observacoes: contrato.observacoes ?? '',
    ativo: contrato.ativo,
  } : emptyForm())
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    createClient().from('empresas').select('id, razao_social, apelido').order('razao_social').then(({ data }) => setEmpresas(data ?? []))
  }, [])

  async function salvar() {
    if (!form.empresa_id || !form.valor_mensal || !form.data_inicio) return
    setSalvando(true)
    const payload = {
      empresa_id: form.empresa_id,
      numero_contrato: form.numero_contrato || null,
      valor_mensal: parseFloat(form.valor_mensal),
      data_inicio: form.data_inicio,
      observacoes: form.observacoes || null,
      ativo: form.ativo,
    }
    if (contrato) {
      await createClient().from('contratos_manutencao').update(payload).eq('id', contrato.id)
    } else {
      await createClient().from('contratos_manutencao').insert(payload)
    }
    setSalvando(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">{contrato ? 'Editar Contrato' : 'Novo Contrato de Manutenção'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9]">
            <XCircle size={16} className="text-[#64748B]" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-[#64748B] block mb-1">Empresa *</label>
            <select className="field text-sm" value={form.empresa_id} onChange={e => setForm(f => ({ ...f, empresa_id: e.target.value }))}>
              <option value="">Selecione...</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.apelido ?? e.razao_social}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[#64748B] block mb-1">Nº do Contrato</label>
            <input className="field text-sm" placeholder="Ex: MANT-001" value={form.numero_contrato} onChange={e => setForm(f => ({ ...f, numero_contrato: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#64748B] block mb-1">Valor Mensal (R$) *</label>
              <input type="number" className="field text-sm" placeholder="0,00" value={form.valor_mensal} onChange={e => setForm(f => ({ ...f, valor_mensal: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-[#64748B] block mb-1">Início do Contrato *</label>
              <input type="date" className="field text-sm" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
            </div>
          </div>
          {contrato && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="ativo" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} className="w-4 h-4 accent-[#4F7CFF]" />
              <label htmlFor="ativo" className="text-sm font-medium text-[#0F172A] cursor-pointer">Contrato ativo</label>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-[#64748B] block mb-1">Observações</label>
            <textarea rows={3} className="field text-sm resize-none" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#64748B] hover:bg-[#F1F5F9] rounded-lg">Cancelar</button>
          <button onClick={salvar} disabled={salvando || !form.empresa_id || !form.valor_mensal || !form.data_inicio}
            className="px-4 py-2 text-sm font-medium bg-[#4F7CFF] text-white rounded-lg hover:bg-[#3D68F0] disabled:opacity-50">
            {salvando ? 'Salvando...' : contrato ? 'Salvar' : 'Criar Contrato'}
          </button>
        </div>
      </div>
    </div>
  )
}

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtDate(d?: string) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—' }

export default function ManutencoesPage() {
  const [contratos, setContratos] = useState<ContratoManutencao[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<ContratoManutencao | null>(null)
  const [search, setSearch] = useState('')

  async function load() {
    const { data } = await createClient()
      .from('contratos_manutencao')
      .select('*, empresa:empresas(id, razao_social, apelido)')
      .order('created_at', { ascending: false })
    setContratos((data ?? []) as ContratoManutencao[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function excluir(c: ContratoManutencao, e: React.MouseEvent) {
    e.preventDefault()
    const nome = (c.empresa as any)?.apelido ?? (c.empresa as any)?.razao_social ?? 'este contrato'
    if (!confirm(`Excluir contrato de ${nome}? Esta ação não pode ser desfeita.`)) return
    await createClient().from('contratos_manutencao').delete().eq('id', c.id)
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
                  <div className="flex items-start justify-between mb-3">
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
                <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1 z-10">
                  <button
                    onClick={e => { e.preventDefault(); setEditando(c) }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white shadow border border-[#E2E8F0] hover:bg-[#EEF2FF] text-[#64748B] hover:text-[#4F7CFF] transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={e => excluir(c, e)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white shadow border border-[#E2E8F0] hover:bg-red-50 text-[#64748B] hover:text-red-500 transition-colors">
                    <Trash2 size={13} />
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
    </div>
  )
}
