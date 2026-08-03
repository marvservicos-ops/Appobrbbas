'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Pencil, Thermometer, User, DollarSign, Users, Wrench, X, ExternalLink, Upload, CheckCircle2, XCircle, ChevronDown, ChevronRight, MapPin, Package, AlertTriangle, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ContratoManutencao, ManutencaoAditivo, ManutencaoNF, ManutencaoFuncionario, Equipamento, ManutencaoEstoqueProduto, ManutencaoEstoqueRegistro, EstoqueProduto } from '@/lib/types'
import Link from 'next/link'
import { useAccess } from '@/lib/useAccess'

type Tab = 'financeiro' | 'equipe' | 'equipamentos' | 'estoque'

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtDate(d?: string | null) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—' }
function competenciaLabel(c: string) {
  const [ano, mes] = c.split('-')
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${meses[parseInt(mes) - 1]}/${ano}`
}

// ── Aba Financeiro ────────────────────────────────────
function AbaFinanceiro({ contratoId, valorMensal }: { contratoId: string; valorMensal: number }) {
  const [aditivos, setAditivos] = useState<ManutencaoAditivo[]>([])
  const [nfs, setNfs] = useState<ManutencaoNF[]>([])
  const [showFormAditivo, setShowFormAditivo] = useState(false)
  const [showFormNF, setShowFormNF] = useState(false)
  const [fAditivo, setFAditivo] = useState({ descricao: '', valor: '', data: '' })
  const [fNF, setFNF] = useState({ competencia: '', valor: '', numero_nf: '', status: 'pendente' as ManutencaoNF['status'], observacoes: '' })
  const [uploadingNF, setUploadingNF] = useState<string | null>(null)

  async function load() {
    const sb = createClient()
    const [{ data: a }, { data: n }] = await Promise.all([
      sb.from('manutencao_aditivos').select('*').eq('contrato_id', contratoId).order('data', { ascending: false }),
      sb.from('manutencao_nfs').select('*').eq('contrato_id', contratoId).order('competencia', { ascending: false }),
    ])
    setAditivos((a ?? []) as ManutencaoAditivo[])
    setNfs((n ?? []) as ManutencaoNF[])
  }

  useEffect(() => { load() }, [contratoId])

  async function salvarAditivo() {
    if (!fAditivo.descricao || !fAditivo.valor || !fAditivo.data) return
    await createClient().from('manutencao_aditivos').insert({ contrato_id: contratoId, ...fAditivo, valor: parseFloat(fAditivo.valor) })
    setFAditivo({ descricao: '', valor: '', data: '' })
    setShowFormAditivo(false)
    load()
  }

  async function excluirAditivo(id: string) {
    if (!confirm('Excluir aditivo?')) return
    await createClient().from('manutencao_aditivos').delete().eq('id', id)
    load()
  }

  async function salvarNF() {
    if (!fNF.competencia || !fNF.valor) return
    await createClient().from('manutencao_nfs').insert({ contrato_id: contratoId, ...fNF, valor: parseFloat(fNF.valor), numero_nf: fNF.numero_nf || null, observacoes: fNF.observacoes || null })
    setFNF({ competencia: '', valor: '', numero_nf: '', status: 'pendente', observacoes: '' })
    setShowFormNF(false)
    load()
  }

  async function excluirNF(id: string) {
    if (!confirm('Excluir NF?')) return
    await createClient().from('manutencao_nfs').delete().eq('id', id)
    load()
  }

  async function uploadNF(nfId: string, file: File) {
    setUploadingNF(nfId)
    const ext = file.name.split('.').pop()
    const path = `nfs/${nfId}.${ext}`
    const sb = createClient()
    await sb.storage.from('marv-manutencao').upload(path, file, { upsert: true })
    const { data: urlData } = sb.storage.from('marv-manutencao').getPublicUrl(path)
    await sb.from('manutencao_nfs').update({ arquivo_url: urlData.publicUrl, status: 'emitida' }).eq('id', nfId)
    setUploadingNF(null)
    load()
  }

  async function toggleStatusNF(nf: ManutencaoNF) {
    await createClient().from('manutencao_nfs').update({ status: nf.status === 'emitida' ? 'pendente' : 'emitida' }).eq('id', nf.id)
    load()
  }

  const totalAditivos = aditivos.reduce((s, a) => s + a.valor, 0)
  const totalNFs = nfs.filter(n => n.status === 'emitida').reduce((s, n) => s + n.valor, 0)

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card py-4">
          <p className="text-xs text-[#94A3B8]">Mensalidade base</p>
          <p className="text-xl font-syne font-bold text-[#0F172A] mt-1">{fmt(valorMensal)}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-[#94A3B8]">Total aditivos</p>
          <p className="text-xl font-syne font-bold text-[#F59E0B] mt-1">{fmt(totalAditivos)}</p>
        </div>
        <div className="card py-4 hidden md:block">
          <p className="text-xs text-[#94A3B8]">NFs emitidas</p>
          <p className="text-xl font-syne font-bold text-[#10B981] mt-1">{fmt(totalNFs)}</p>
        </div>
      </div>

      {/* Aditivos */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-syne font-semibold text-[#0F172A]">Aditivos</h3>
          <button onClick={() => setShowFormAditivo(v => !v)} className="flex items-center gap-1 text-xs text-[#4F7CFF] hover:underline">
            <Plus size={13} /> Novo aditivo
          </button>
        </div>

        {showFormAditivo && (
          <div className="bg-[#F8FAFC] rounded-xl p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#64748B] block mb-1">Valor (R$) *</label>
                <input type="number" className="field text-sm" value={fAditivo.valor} onChange={e => setFAditivo(f => ({ ...f, valor: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] block mb-1">Data *</label>
                <input type="date" className="field text-sm" value={fAditivo.data} onChange={e => setFAditivo(f => ({ ...f, data: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[#64748B] block mb-1">Descrição *</label>
              <input className="field text-sm" placeholder="Ex: Inclusão de 2 equipamentos" value={fAditivo.descricao} onChange={e => setFAditivo(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowFormAditivo(false)} className="text-xs text-[#64748B] px-3 py-1.5 hover:bg-white rounded-lg">Cancelar</button>
              <button onClick={salvarAditivo} className="text-xs bg-[#4F7CFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#3D68F0]">Salvar</button>
            </div>
          </div>
        )}

        {aditivos.length === 0 ? (
          <p className="text-sm text-[#94A3B8] text-center py-4">Nenhum aditivo registrado</p>
        ) : (
          <div className="space-y-2">
            {aditivos.map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 px-3 bg-[#F8FAFC] rounded-lg">
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">{a.descricao}</p>
                  <p className="text-xs text-[#94A3B8]">{fmtDate(a.data)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-[#F59E0B]">{fmt(a.valor)}</span>
                  <button onClick={() => excluirAditivo(a.id)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-[#94A3B8] hover:text-red-400">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notas Fiscais */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-syne font-semibold text-[#0F172A]">Notas Fiscais</h3>
          <button onClick={() => setShowFormNF(v => !v)} className="flex items-center gap-1 text-xs text-[#4F7CFF] hover:underline">
            <Plus size={13} /> Nova NF
          </button>
        </div>

        {showFormNF && (
          <div className="bg-[#F8FAFC] rounded-xl p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#64748B] block mb-1">Competência * (mês/ano)</label>
                <input type="month" className="field text-sm" value={fNF.competencia} onChange={e => setFNF(f => ({ ...f, competencia: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] block mb-1">Valor (R$) *</label>
                <input type="number" className="field text-sm" value={fNF.valor} onChange={e => setFNF(f => ({ ...f, valor: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#64748B] block mb-1">Nº da NF</label>
                <input className="field text-sm" placeholder="000001" value={fNF.numero_nf} onChange={e => setFNF(f => ({ ...f, numero_nf: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] block mb-1">Status</label>
                <select className="field text-sm" value={fNF.status} onChange={e => setFNF(f => ({ ...f, status: e.target.value as ManutencaoNF['status'] }))}>
                  <option value="pendente">Pendente</option>
                  <option value="emitida">Emitida</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[#64748B] block mb-1">Observações</label>
              <input className="field text-sm" placeholder="Ex: NF de corretiva" value={fNF.observacoes} onChange={e => setFNF(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowFormNF(false)} className="text-xs text-[#64748B] px-3 py-1.5 hover:bg-white rounded-lg">Cancelar</button>
              <button onClick={salvarNF} className="text-xs bg-[#4F7CFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#3D68F0]">Salvar</button>
            </div>
          </div>
        )}

        {nfs.length === 0 ? (
          <p className="text-sm text-[#94A3B8] text-center py-4">Nenhuma NF registrada</p>
        ) : (
          <div className="space-y-2">
            {nfs.map(nf => (
              <div key={nf.id} className="flex items-center gap-3 py-2 px-3 bg-[#F8FAFC] rounded-lg">
                <button onClick={() => toggleStatusNF(nf)} title="Alternar status">
                  {nf.status === 'emitida'
                    ? <CheckCircle2 size={16} className="text-[#10B981]" />
                    : <XCircle size={16} className="text-[#94A3B8]" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#0F172A]">{competenciaLabel(nf.competencia)}</p>
                    {nf.numero_nf && <span className="text-xs text-[#94A3B8]">#{nf.numero_nf}</span>}
                    {nf.observacoes && <span className="text-xs text-[#64748B] truncate">{nf.observacoes}</span>}
                  </div>
                  <span className={`text-xs font-medium ${nf.status === 'emitida' ? 'text-[#10B981]' : 'text-[#F59E0B]'}`}>
                    {nf.status === 'emitida' ? 'Emitida' : 'Pendente'}
                  </span>
                </div>
                <span className="text-sm font-semibold text-[#0F172A] shrink-0">{fmt(nf.valor)}</span>
                {nf.arquivo_url ? (
                  <a href={nf.arquivo_url} target="_blank" rel="noreferrer" className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#EEF2FF] text-[#4F7CFF]">
                    <ExternalLink size={13} />
                  </a>
                ) : (
                  <label className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#4F7CFF] cursor-pointer" title="Anexar NF">
                    <Upload size={13} />
                    <input type="file" className="hidden" accept=".pdf,.xml" onChange={e => { const f = e.target.files?.[0]; if (f) uploadNF(nf.id, f) }} />
                  </label>
                )}
                <button onClick={() => excluirNF(nf.id)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-[#94A3B8] hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Aba Equipe ────────────────────────────────────────
function AbaEquipe({ contratoId }: { contratoId: string }) {
  const [equipe, setEquipe] = useState<ManutencaoFuncionario[]>([])
  const [todos, setTodos] = useState<{ id: string; nome: string; cargo: string | null }[]>([])
  const [showForm, setShowForm] = useState(false)
  const [fForm, setFForm] = useState({ funcionario_id: '', tipo: 'fixo' as ManutencaoFuncionario['tipo'] })

  async function load() {
    const sb = createClient()
    const { data } = await sb.from('manutencao_funcionarios').select('*, funcionario:funcionarios(id, nome, cargo)').eq('contrato_id', contratoId)
    setEquipe((data ?? []) as ManutencaoFuncionario[])
    const { data: funcs } = await sb.from('funcionarios').select('id, nome, cargo').order('nome')
    setTodos((funcs ?? []) as { id: string; nome: string; cargo: string | null }[])
  }

  useEffect(() => { load() }, [contratoId])

  async function adicionar() {
    if (!fForm.funcionario_id) return
    await createClient().from('manutencao_funcionarios').insert({ contrato_id: contratoId, ...fForm })
    setFForm({ funcionario_id: '', tipo: 'fixo' })
    setShowForm(false)
    load()
  }

  async function remover(id: string) {
    if (!confirm('Remover funcionário?')) return
    await createClient().from('manutencao_funcionarios').delete().eq('id', id)
    load()
  }

  const disponíveis = todos.filter(f => !equipe.some(e => e.funcionario_id === f.id))

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-syne font-semibold text-[#0F172A]">Equipe alocada</h3>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1 text-xs text-[#4F7CFF] hover:underline">
          <Plus size={13} /> Adicionar
        </button>
      </div>

      {showForm && (
        <div className="bg-[#F8FAFC] rounded-xl p-4 mb-4 flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-[#64748B] block mb-1">Funcionário</label>
            <select className="field text-sm" value={fForm.funcionario_id} onChange={e => setFForm(f => ({ ...f, funcionario_id: e.target.value }))}>
              <option value="">Selecione...</option>
              {disponíveis.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div className="w-32">
            <label className="text-xs font-medium text-[#64748B] block mb-1">Tipo</label>
            <select className="field text-sm" value={fForm.tipo} onChange={e => setFForm(f => ({ ...f, tipo: e.target.value as ManutencaoFuncionario['tipo'] }))}>
              <option value="fixo">Fixo</option>
              <option value="eventual">Eventual</option>
            </select>
          </div>
          <button onClick={adicionar} className="text-xs bg-[#4F7CFF] text-white px-3 py-2 rounded-lg hover:bg-[#3D68F0] mb-0.5">Adicionar</button>
        </div>
      )}

      {equipe.length === 0 ? (
        <p className="text-sm text-[#94A3B8] text-center py-6">Nenhum funcionário alocado</p>
      ) : (
        <div className="space-y-2">
          {equipe.map(e => (
            <div key={e.id} className="flex items-center gap-3 py-2 px-3 bg-[#F8FAFC] rounded-lg">
              <div className="w-8 h-8 rounded-full bg-[#EEF2FF] flex items-center justify-center shrink-0">
                <User size={14} className="text-[#4F7CFF]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#0F172A]">{e.funcionario?.nome ?? '—'}</p>
                <p className="text-xs text-[#94A3B8]">{e.funcionario?.cargo ?? ''}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${e.tipo === 'fixo' ? 'bg-[#EEF2FF] text-[#4F7CFF]' : 'bg-[#FEF3C7] text-[#D97706]'}`}>
                {e.tipo === 'fixo' ? 'Fixo' : 'Eventual'}
              </span>
              <button onClick={() => remover(e.id)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-[#94A3B8] hover:text-red-400">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Aba Equipamentos ──────────────────────────────────
interface Grupo { id: string; nome: string; ordem: number }
interface EquipamentoComGrupo extends Equipamento { grupo_id: string | null }

const TIPO_COLOR: Record<string, string> = {
  Split: 'bg-[#EEF2FF] text-[#4F7CFF]',
  Cassete: 'bg-[#D1FAE5] text-[#059669]',
  VRF: 'bg-[#FEF3C7] text-[#D97706]',
  Janela: 'bg-[#FCE7F3] text-[#DB2777]',
  'Piso-teto': 'bg-[#E0E7FF] text-[#4338CA]',
  Outro: 'bg-[#F1F5F9] text-[#64748B]',
}

const TIPOS_EQUIP = ['Split', 'Cassete', 'VRF', 'Janela', 'Piso-teto', 'Chiller', 'Fan Coil', 'Condensadora', 'Outro']

let _formEquipId = 0

function FormEquipamento({ contratoId, grupos, grupoIdInicial, equipamento, onSaved, onCancel }: {
  contratoId: string; grupos: Grupo[]; grupoIdInicial?: string | null
  equipamento?: EquipamentoComGrupo | null
  onSaved: () => void; onCancel: () => void
}) {
  const datalistId = useState(() => `tipos-equip-${++_formEquipId}`)[0]

  function emptyForm() {
    return {
      nome: '', tipo: 'Split',
      marca: '', modelo: '', capacidade_btu: '',
      numero_serie: '', localizacao: '', data_instalacao: '',
      grupo_id: grupoIdInicial ?? '',
    }
  }

  const [form, setForm] = useState(() => equipamento ? {
    nome: equipamento.nome, tipo: equipamento.tipo ?? 'Split',
    marca: equipamento.marca ?? '', modelo: equipamento.modelo ?? '',
    capacidade_btu: equipamento.capacidade_btu ? String(equipamento.capacidade_btu) : '',
    numero_serie: equipamento.numero_serie ?? '', localizacao: equipamento.localizacao ?? '',
    data_instalacao: equipamento.data_instalacao ?? '',
    grupo_id: equipamento.grupo_id ?? grupoIdInicial ?? '',
  } : emptyForm())

  async function salvar() {
    if (!form.nome) return
    const payload = {
      nome: form.nome, tipo: form.tipo || 'Outro',
      marca: form.marca || null, modelo: form.modelo || null,
      capacidade_btu: form.capacidade_btu ? parseInt(form.capacidade_btu) : null,
      numero_serie: form.numero_serie || null,
      localizacao: form.localizacao || null,
      data_instalacao: form.data_instalacao || null,
      grupo_id: form.grupo_id || null,
    }
    if (equipamento) {
      await createClient().from('equipamentos').update(payload).eq('id', equipamento.id)
      onSaved()
    } else {
      await createClient().from('equipamentos').insert({ ...payload, contrato_id: contratoId, ativo: true })
      setForm(emptyForm())
      onSaved()
    }
  }

  return (
    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium text-[#64748B] block mb-1">Nome / Identificação *</label>
          <input autoFocus className="field text-sm" placeholder="Ex: Split Sala de Reuniões" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-[#64748B] block mb-1">Tipo</label>
          <input list={datalistId} className="field text-sm" placeholder="Ex: Split, VRF, Chiller..." value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} />
          <datalist id={datalistId}>
            {TIPOS_EQUIP.map(t => <option key={t} value={t} />)}
          </datalist>
        </div>
        <div>
          <label className="text-xs font-medium text-[#64748B] block mb-1">Capacidade (BTU)</label>
          <input type="number" className="field text-sm" placeholder="Ex: 12000" value={form.capacidade_btu} onChange={e => setForm(f => ({ ...f, capacidade_btu: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-[#64748B] block mb-1">Marca</label>
          <input className="field text-sm" placeholder="Ex: Daikin" value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-[#64748B] block mb-1">Modelo</label>
          <input className="field text-sm" placeholder="Ex: FTXS12LVMA" value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-[#64748B] block mb-1">Nº de Série</label>
          <input className="field text-sm" value={form.numero_serie} onChange={e => setForm(f => ({ ...f, numero_serie: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-[#64748B] block mb-1">Data de Instalação</label>
          <input type="date" className="field text-sm" value={form.data_instalacao} onChange={e => setForm(f => ({ ...f, data_instalacao: e.target.value }))} />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-[#64748B] block mb-1">Grupo</label>
          <select className="field text-sm" value={form.grupo_id} onChange={e => setForm(f => ({ ...f, grupo_id: e.target.value }))}>
            <option value="">Sem grupo</option>
            {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-xs text-[#64748B] px-3 py-1.5 hover:bg-white rounded-lg">Cancelar</button>
        <button onClick={salvar} disabled={!form.nome} className="text-xs bg-[#4F7CFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#3D68F0] disabled:opacity-50">{equipamento ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </div>
  )
}

function GrupoSection({ grupo, equipamentos, contratoId, grupos, onReload, collapsed, onToggle }: {
  grupo: Grupo | null; equipamentos: EquipamentoComGrupo[]; contratoId: string
  grupos: Grupo[]; onReload: () => void; collapsed: boolean; onToggle: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [editandoEquip, setEditandoEquip] = useState<EquipamentoComGrupo | null>(null)
  const [editandoNome, setEditandoNome] = useState(false)
  const [novoNome, setNovoNome] = useState(grupo?.nome ?? '')

  async function excluirEquip(id: string) {
    if (!confirm('Excluir equipamento?')) return
    await createClient().from('equipamentos').delete().eq('id', id)
    onReload()
  }

  async function moverEquip(equipId: string, grupoId: string | null) {
    await createClient().from('equipamentos').update({ grupo_id: grupoId }).eq('id', equipId)
    onReload()
  }

  async function salvarNomeGrupo() {
    if (!grupo || !novoNome.trim()) return
    await createClient().from('grupos_equipamentos').update({ nome: novoNome.trim() }).eq('id', grupo.id)
    setEditandoNome(false)
    onReload()
  }

  async function excluirGrupo() {
    if (!grupo) return
    if (!confirm('Excluir grupo? Os equipamentos ficarão sem grupo.')) return
    await createClient().from('equipamentos').update({ grupo_id: null }).eq('grupo_id', grupo.id)
    await createClient().from('grupos_equipamentos').delete().eq('id', grupo.id)
    onReload()
  }

  const isUngrouped = grupo === null

  return (
    <div className="border border-[#E2E8F0] rounded-2xl overflow-hidden">
      {/* Header do grupo */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors
          ${isUngrouped ? 'bg-[#F8FAFC] hover:bg-[#F1F5F9]' : 'bg-white hover:bg-[#F8FAFC]'}`}
        onClick={onToggle}
      >
        <span className="text-[#94A3B8] shrink-0">
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </span>
        <div className="w-7 h-7 rounded-lg bg-[#EEF2FF] flex items-center justify-center shrink-0">
          <MapPin size={13} className="text-[#4F7CFF]" />
        </div>

        {/* Nome editável */}
        {!isUngrouped && editandoNome ? (
          <input
            autoFocus
            className="flex-1 text-sm font-semibold text-[#0F172A] bg-transparent border-b border-[#4F7CFF] focus:outline-none"
            value={novoNome}
            onClick={e => e.stopPropagation()}
            onChange={e => setNovoNome(e.target.value)}
            onBlur={salvarNomeGrupo}
            onKeyDown={e => { if (e.key === 'Enter') salvarNomeGrupo(); if (e.key === 'Escape') setEditandoNome(false) }}
          />
        ) : (
          <span className="flex-1 text-sm font-semibold text-[#0F172A]">
            {isUngrouped ? 'Sem grupo' : grupo!.nome}
          </span>
        )}

        <span className="text-xs text-[#94A3B8] shrink-0">{equipamentos.length} máq.</span>

        {/* Ações do grupo */}
        {!isUngrouped && (
          <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setEditandoNome(true); setNovoNome(grupo!.nome) }}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#4F7CFF]">
              <Pencil size={11} />
            </button>
            <button onClick={excluirGrupo}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-[#94A3B8] hover:text-red-400">
              <Trash2 size={11} />
            </button>
          </div>
        )}

        <button
          onClick={e => { e.stopPropagation(); setShowForm(v => !v) }}
          className="flex items-center gap-1 text-xs text-[#4F7CFF] hover:text-[#3D68F0] font-medium shrink-0 px-2 py-1 rounded-lg hover:bg-[#EEF2FF] transition-colors">
          <Plus size={12} /> Máquina
        </button>
      </div>

      {/* Corpo */}
      {!collapsed && (
        <div className="border-t border-[#E2E8F0]">
          {showForm && (
            <div className="p-4 border-b border-[#E2E8F0]">
              <FormEquipamento
                contratoId={contratoId}
                grupos={grupos}
                grupoIdInicial={grupo?.id ?? null}
                onSaved={() => { setShowForm(false); onReload() }}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}

          {equipamentos.length === 0 && !showForm ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[#94A3B8]">Nenhuma máquina neste grupo</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {equipamentos.map(eq => (
                <div key={eq.id}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFC] group transition-colors">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${TIPO_COLOR[eq.tipo] ?? TIPO_COLOR['Outro']}`}>
                      {eq.tipo}
                    </span>
                    <Link href={`/manutencoes/${contratoId}/equipamentos/${eq.id}`} className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F172A] hover:text-[#4F7CFF] transition-colors truncate">{eq.nome}</p>
                      <p className="text-xs text-[#94A3B8] truncate">
                        {[eq.marca, eq.modelo, eq.capacidade_btu ? `${eq.capacidade_btu.toLocaleString()} BTU` : null].filter(Boolean).join(' · ')}
                      </p>
                    </Link>

                    {/* Mover de grupo */}
                    <select
                      className="text-xs border border-[#E2E8F0] rounded-lg px-2 py-1 text-[#64748B] bg-white opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                      value={eq.grupo_id ?? ''}
                      onChange={e => moverEquip(eq.id, e.target.value || null)}
                      onClick={e => e.preventDefault()}
                    >
                      <option value="">Sem grupo</option>
                      {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                    </select>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => setEditandoEquip(editandoEquip?.id === eq.id ? null : eq)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#4F7CFF]">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => excluirEquip(eq.id)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-[#94A3B8] hover:text-red-400">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  {editandoEquip?.id === eq.id && (
                    <div className="px-4 pb-4">
                      <FormEquipamento
                        contratoId={contratoId}
                        grupos={grupos}
                        equipamento={eq}
                        onSaved={() => { setEditandoEquip(null); onReload() }}
                        onCancel={() => setEditandoEquip(null)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AbaEquipamentos({ contratoId }: { contratoId: string }) {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [equipamentos, setEquipamentos] = useState<EquipamentoComGrupo[]>([])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [novoGrupo, setNovoGrupo] = useState('')
  const [showNovoGrupo, setShowNovoGrupo] = useState(false)

  async function load() {
    const sb = createClient()
    const [{ data: gs }, { data: eqs }] = await Promise.all([
      sb.from('grupos_equipamentos').select('*').eq('contrato_id', contratoId).order('ordem').order('created_at'),
      sb.from('equipamentos').select('*').eq('contrato_id', contratoId).order('created_at'),
    ])
    setGrupos((gs ?? []) as Grupo[])
    setEquipamentos((eqs ?? []) as EquipamentoComGrupo[])
  }

  useEffect(() => { load() }, [contratoId])

  async function criarGrupo() {
    if (!novoGrupo.trim()) return
    await createClient().from('grupos_equipamentos').insert({
      contrato_id: contratoId,
      nome: novoGrupo.trim(),
      ordem: grupos.length,
    })
    setNovoGrupo('')
    setShowNovoGrupo(false)
    load()
  }

  function toggleCollapse(key: string) {
    setCollapsed(p => ({ ...p, [key]: !p[key] }))
  }

  const semGrupo = equipamentos.filter(e => !e.grupo_id)
  const total = equipamentos.length

  return (
    <div className="space-y-3">
      {/* Barra de ações */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#64748B]">{total} equipamento{total !== 1 ? 's' : ''} no total</p>
        <div className="flex gap-2">
          {showNovoGrupo ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="field text-sm py-1.5 w-44"
                placeholder="Nome do grupo..."
                value={novoGrupo}
                onChange={e => setNovoGrupo(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') criarGrupo(); if (e.key === 'Escape') setShowNovoGrupo(false) }}
              />
              <button onClick={criarGrupo} disabled={!novoGrupo.trim()}
                className="px-3 py-1.5 text-xs bg-[#4F7CFF] text-white rounded-lg hover:bg-[#3D68F0] disabled:opacity-50">
                Criar
              </button>
              <button onClick={() => setShowNovoGrupo(false)} className="text-xs text-[#64748B] hover:text-[#0F172A]">✕</button>
            </div>
          ) : (
            <button onClick={() => setShowNovoGrupo(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] text-sm text-[#64748B] rounded-xl hover:bg-[#F1F5F9] transition-colors">
              <MapPin size={13} /> Novo grupo
            </button>
          )}
        </div>
      </div>

      {/* Grupos */}
      {grupos.map(g => (
        <GrupoSection
          key={g.id}
          grupo={g}
          equipamentos={equipamentos.filter(e => e.grupo_id === g.id)}
          contratoId={contratoId}
          grupos={grupos}
          onReload={load}
          collapsed={!!collapsed[g.id]}
          onToggle={() => toggleCollapse(g.id)}
        />
      ))}

      {/* Sem grupo */}
      {(semGrupo.length > 0 || grupos.length === 0) && (
        <GrupoSection
          grupo={null}
          equipamentos={semGrupo}
          contratoId={contratoId}
          grupos={grupos}
          onReload={load}
          collapsed={!!collapsed['__none__']}
          onToggle={() => toggleCollapse('__none__')}
        />
      )}

      {total === 0 && grupos.length === 0 && (
        <div className="card text-center py-12">
          <Wrench size={36} className="text-[#E2E8F0] mx-auto mb-2" />
          <p className="text-[#94A3B8]">Nenhum equipamento cadastrado</p>
          <p className="text-xs text-[#CBD5E1] mt-1">Crie um grupo ou adicione máquinas diretamente</p>
        </div>
      )}
    </div>
  )
}

// ── Aba Estoque (mini-estoque local do cliente) ────────
function ModalAdicionarProdutoEstoque({ contratoId, jaRastreados, onClose, onSaved }: {
  contratoId: string; jaRastreados: string[]; onClose: () => void; onSaved: () => void
}) {
  const [catalogo, setCatalogo] = useState<EstoqueProduto[]>([])
  const [produtoId, setProdutoId] = useState('')
  const [quantidadeMinima, setQuantidadeMinima] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    createClient().from('estoque_produtos').select('*').eq('ativo', true).order('nome')
      .then(({ data }) => setCatalogo((data ?? []) as EstoqueProduto[]))
  }, [])

  const disponiveis = catalogo.filter(p => !jaRastreados.includes(p.id))

  async function salvar() {
    if (!produtoId) return
    setSaving(true)
    await createClient().from('manutencao_estoque_produtos').insert({
      contrato_id: contratoId, produto_id: produtoId, quantidade_minima: parseFloat(quantidadeMinima) || 0,
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-syne font-semibold text-[#0F172A]">Adicionar produto</h3>
          <button onClick={onClose}><X size={18} className="text-[#94A3B8]" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[#64748B] block mb-1">Produto do catálogo *</label>
            <select className="field text-sm" value={produtoId} onChange={e => setProdutoId(e.target.value)}>
              <option value="">Selecione...</option>
              {disponiveis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[#64748B] block mb-1">Quantidade mínima</label>
            <input type="number" min="0" step="any" className="field text-sm" value={quantidadeMinima} onChange={e => setQuantidadeMinima(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-xs text-[#64748B] px-3 py-1.5 hover:bg-[#F1F5F9] rounded-lg">Cancelar</button>
          <button onClick={salvar} disabled={!produtoId || saving} className="text-xs bg-[#4F7CFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#3D68F0] disabled:opacity-50">Adicionar</button>
        </div>
      </div>
    </div>
  )
}

function ModalMovimentacaoEstoque({ contratoId, produtos, onClose, onSaved }: {
  contratoId: string; produtos: ManutencaoEstoqueProduto[]; onClose: () => void; onSaved: () => void
}) {
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('saida')
  const [produtoId, setProdutoId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [observacoes, setObservacoes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const produto = produtos.find(p => p.produto_id === produtoId)

  async function salvar() {
    setError('')
    const qtd = parseFloat(quantidade)
    if (!produtoId) { setError('Selecione o produto.'); return }
    if (!qtd || qtd <= 0) { setError('Informe a quantidade.'); return }
    if (!responsavel.trim()) { setError('Informe o responsável.'); return }
    if (tipo === 'saida' && produto && produto.quantidade_atual - qtd < 0) {
      setError(`Saldo insuficiente. Disponível: ${produto.quantidade_atual}.`); return
    }
    setSaving(true)
    const sb = createClient()
    await sb.from('manutencao_estoque_registros').insert({
      contrato_id: contratoId, produto_id: produtoId, tipo, quantidade: qtd,
      responsavel: responsavel.trim(), data, observacoes: observacoes || null,
    })
    if (produto) {
      const novaQtd = produto.quantidade_atual + (tipo === 'entrada' ? qtd : -qtd)
      await sb.from('manutencao_estoque_produtos').update({ quantidade_atual: novaQtd }).eq('id', produto.id)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-syne font-semibold text-[#0F172A]">Nova movimentação</h3>
          <button onClick={onClose}><X size={18} className="text-[#94A3B8]" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(['saida', 'entrada'] as const).map(t => (
              <button key={t} type="button" onClick={() => setTipo(t)}
                className={`py-2 rounded-lg text-xs font-medium border-2 transition-all ${tipo === t
                  ? t === 'saida' ? 'border-red-400 bg-red-50 text-red-600' : 'border-green-400 bg-green-50 text-green-600'
                  : 'border-[#E2E8F0] text-[#64748B]'}`}>
                {t === 'saida' ? 'Saída' : 'Entrada'}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs font-medium text-[#64748B] block mb-1">Produto *</label>
            <select className="field text-sm" value={produtoId} onChange={e => setProdutoId(e.target.value)}>
              <option value="">Selecione...</option>
              {produtos.map(p => <option key={p.produto_id} value={p.produto_id}>{p.produto?.nome} ({p.quantidade_atual} {p.produto?.unidade})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#64748B] block mb-1">Quantidade *</label>
              <input type="number" min="0" step="any" className="field text-sm" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#64748B] block mb-1">Data</label>
              <input type="date" className="field text-sm" value={data} onChange={e => setData(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[#64748B] block mb-1">Responsável *</label>
            <input className="field text-sm" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#64748B] block mb-1">Observações</label>
            <input className="field text-sm" value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-xs text-[#64748B] px-3 py-1.5 hover:bg-[#F1F5F9] rounded-lg">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="text-xs bg-[#4F7CFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#3D68F0] disabled:opacity-50">Salvar</button>
        </div>
      </div>
    </div>
  )
}

function AbaEstoque({ contratoId }: { contratoId: string }) {
  const [produtos, setProdutos] = useState<ManutencaoEstoqueProduto[]>([])
  const [registros, setRegistros] = useState<ManutencaoEstoqueRegistro[]>([])
  const [showAdicionar, setShowAdicionar] = useState(false)
  const [showMovimentacao, setShowMovimentacao] = useState(false)

  async function load() {
    const sb = createClient()
    const [{ data: p }, { data: r }] = await Promise.all([
      sb.from('manutencao_estoque_produtos').select('*, produto:estoque_produtos(nome, unidade)').eq('contrato_id', contratoId).order('created_at'),
      sb.from('manutencao_estoque_registros').select('*, produto:estoque_produtos(nome, unidade)').eq('contrato_id', contratoId).order('created_at', { ascending: false }).limit(30),
    ])
    setProdutos((p ?? []) as ManutencaoEstoqueProduto[])
    setRegistros((r ?? []) as ManutencaoEstoqueRegistro[])
  }

  useEffect(() => { load() }, [contratoId])

  const abaixoMinimo = produtos.filter(p => p.quantidade_atual <= p.quantidade_minima && p.quantidade_minima > 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#64748B]">{produtos.length} produto{produtos.length !== 1 ? 's' : ''} rastreado{produtos.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <button onClick={() => setShowAdicionar(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] text-sm text-[#64748B] rounded-xl hover:bg-[#F1F5F9] transition-colors">
            <Plus size={13} /> Adicionar produto
          </button>
          <button onClick={() => setShowMovimentacao(true)} disabled={produtos.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4F7CFF] text-white text-sm rounded-xl hover:bg-[#3D68F0] transition-colors disabled:opacity-50">
            <Plus size={13} /> Nova movimentação
          </button>
        </div>
      </div>

      {abaixoMinimo.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">{abaixoMinimo.length} produto{abaixoMinimo.length > 1 ? 's' : ''} abaixo do estoque mínimo</p>
            <p className="text-xs text-amber-700 mt-0.5">{abaixoMinimo.map(p => p.produto?.nome).join(', ')}</p>
          </div>
        </div>
      )}

      <div className="card">
        {produtos.length === 0 ? (
          <div className="text-center py-10">
            <Package size={32} className="text-[#E2E8F0] mx-auto mb-2" />
            <p className="text-sm text-[#94A3B8]">Nenhum produto rastreado neste cliente ainda</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {produtos.map(p => {
              const negativo = p.quantidade_atual < 0
              const critico = !negativo && p.quantidade_atual <= p.quantidade_minima && p.quantidade_minima > 0
              return (
                <div key={p.id} className={`flex items-center justify-between py-2.5 px-1 ${negativo ? 'bg-red-50' : critico ? 'bg-amber-50' : ''}`}>
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">{p.produto?.nome}</p>
                    <p className="text-xs text-[#94A3B8]">Mínimo: {p.quantidade_minima} {p.produto?.unidade}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {negativo && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Negativo</span>}
                    {critico && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Crítico</span>}
                    <span className="text-sm font-semibold text-[#0F172A]">{p.quantidade_atual} {p.produto?.unidade}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="font-syne font-semibold text-[#0F172A] mb-3 text-sm">Histórico recente</h3>
        {registros.length === 0 ? (
          <p className="text-sm text-[#94A3B8] text-center py-4">Nenhuma movimentação ainda</p>
        ) : (
          <div className="space-y-2">
            {registros.map(r => (
              <div key={r.id} className="flex items-center gap-3 py-2 px-3 bg-[#F8FAFC] rounded-lg">
                {r.tipo === 'entrada'
                  ? <ArrowDownCircle size={16} className="text-green-500 shrink-0" />
                  : <ArrowUpCircle size={16} className="text-red-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0F172A] truncate">{r.produto?.nome}</p>
                  <p className="text-xs text-[#94A3B8]">{r.responsavel ?? '—'} · {fmtDate(r.data)}</p>
                </div>
                <span className={`text-sm font-semibold ${r.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                  {r.tipo === 'entrada' ? '+' : '-'}{r.quantidade}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdicionar && (
        <ModalAdicionarProdutoEstoque contratoId={contratoId} jaRastreados={produtos.map(p => p.produto_id)}
          onClose={() => setShowAdicionar(false)} onSaved={() => { setShowAdicionar(false); load() }} />
      )}
      {showMovimentacao && (
        <ModalMovimentacaoEstoque contratoId={contratoId} produtos={produtos}
          onClose={() => setShowMovimentacao(false)} onSaved={() => { setShowMovimentacao(false); load() }} />
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────
export default function ManutencaoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { isAdmin } = useAccess()
  const [contrato, setContrato] = useState<ContratoManutencao | null>(null)
  const [tab, setTab] = useState<Tab>('financeiro')
  const [loading, setLoading] = useState(true)
  const [criticosEstoque, setCriticosEstoque] = useState(0)

  useEffect(() => {
    createClient().from('manutencao_estoque_produtos').select('quantidade_atual, quantidade_minima').eq('contrato_id', id)
      .then(({ data }) => setCriticosEstoque((data ?? []).filter((p: any) => p.quantidade_atual <= p.quantidade_minima && p.quantidade_minima > 0).length))
  }, [id])

  useEffect(() => {
    createClient()
      .from('contratos_manutencao')
      .select('*, empresa:empresas(id, razao_social, apelido)')
      .eq('id', id)
      .single()
      .then(({ data }) => { setContrato(data as ContratoManutencao); setLoading(false) })
  }, [id])

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-6 h-6 border-2 border-[#4F7CFF] border-t-transparent rounded-full animate-spin" /></div>
  if (!contrato) return <div className="p-8 text-center text-[#94A3B8]">Contrato não encontrado.</div>

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'financeiro', label: 'Financeiro', icon: <DollarSign size={15} /> },
    { key: 'equipe', label: 'Equipe', icon: <Users size={15} /> },
    { key: 'equipamentos', label: 'Equipamentos', icon: <Wrench size={15} /> },
    { key: 'estoque', label: 'Estoque', icon: <Package size={15} /> },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 md:px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => router.push('/manutencoes')} className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A] mb-3 transition-colors">
            <ArrowLeft size={15} /> Manutenções
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0">
                <Thermometer size={18} className="text-[#4F7CFF]" />
              </div>
              <div>
                <h1 className="font-syne font-bold text-xl text-[#0F172A]">{(contrato.empresa as any)?.apelido ?? (contrato.empresa as any)?.razao_social ?? '—'}</h1>
                <div className="flex items-center gap-3 mt-0.5">
                  {contrato.numero_contrato && <span className="text-xs text-[#94A3B8]">{contrato.numero_contrato}</span>}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${contrato.ativo ? 'bg-[#D1FAE5] text-[#059669]' : 'bg-[#F1F5F9] text-[#94A3B8]'}`}>
                    {contrato.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                  <span className="text-xs text-[#64748B]">Desde {new Date(contrato.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-[#94A3B8]">Mensalidade</p>
              <p className="text-lg font-bold font-syne text-[#10B981]">{(contrato.valor_mensal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                  ${tab === t.key ? 'bg-[#4F7CFF] text-white' : 'text-[#64748B] hover:bg-[#F1F5F9]'}`}>
                {t.icon} {t.label}
                {t.key === 'estoque' && criticosEstoque > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/25 text-white' : 'bg-red-100 text-red-600'}`}>
                    {criticosEstoque}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full">
        {tab === 'financeiro' && <AbaFinanceiro contratoId={id} valorMensal={contrato.valor_mensal} />}
        {tab === 'equipe' && <AbaEquipe contratoId={id} />}
        {tab === 'equipamentos' && <AbaEquipamentos contratoId={id} />}
        {tab === 'estoque' && <AbaEstoque contratoId={id} />}
      </main>
    </div>
  )
}
