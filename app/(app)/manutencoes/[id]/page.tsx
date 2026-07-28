'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Pencil, Thermometer, User, DollarSign, Users, Wrench, X, ExternalLink, Upload, CheckCircle2, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ContratoManutencao, ManutencaoAditivo, ManutencaoNF, ManutencaoFuncionario, Equipamento } from '@/lib/types'
import Link from 'next/link'
import { useAccess } from '@/lib/useAccess'

type Tab = 'financeiro' | 'equipe' | 'equipamentos'

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
function AbaEquipamentos({ contratoId }: { contratoId: string }) {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nome: '', tipo: 'Split' as Equipamento['tipo'], marca: '', modelo: '', capacidade_btu: '', numero_serie: '', localizacao: '', data_instalacao: '' })

  async function load() {
    const { data } = await createClient().from('equipamentos').select('*').eq('contrato_id', contratoId).order('created_at')
    setEquipamentos((data ?? []) as Equipamento[])
  }

  useEffect(() => { load() }, [contratoId])

  async function salvar() {
    if (!form.nome) return
    await createClient().from('equipamentos').insert({
      contrato_id: contratoId,
      nome: form.nome,
      tipo: form.tipo,
      marca: form.marca || null,
      modelo: form.modelo || null,
      capacidade_btu: form.capacidade_btu ? parseInt(form.capacidade_btu) : null,
      numero_serie: form.numero_serie || null,
      localizacao: form.localizacao || null,
      data_instalacao: form.data_instalacao || null,
      ativo: true,
    })
    setForm({ nome: '', tipo: 'Split', marca: '', modelo: '', capacidade_btu: '', numero_serie: '', localizacao: '', data_instalacao: '' })
    setShowForm(false)
    load()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir equipamento?')) return
    await createClient().from('equipamentos').delete().eq('id', id)
    load()
  }

  const tipoColor: Record<string, string> = {
    Split: 'bg-[#EEF2FF] text-[#4F7CFF]',
    Cassete: 'bg-[#D1FAE5] text-[#059669]',
    VRF: 'bg-[#FEF3C7] text-[#D97706]',
    Janela: 'bg-[#FCE7F3] text-[#DB2777]',
    'Piso-teto': 'bg-[#E0E7FF] text-[#4338CA]',
    Outro: 'bg-[#F1F5F9] text-[#64748B]',
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 px-4 py-2 bg-[#4F7CFF] hover:bg-[#3D68F0] text-white text-sm font-semibold rounded-xl transition-colors">
          <Plus size={15} /> Novo Equipamento
        </button>
      </div>

      {showForm && (
        <div className="card space-y-3">
          <h3 className="font-syne font-semibold text-[#0F172A] text-sm">Cadastrar equipamento</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-[#64748B] block mb-1">Nome / Identificação *</label>
              <input className="field text-sm" placeholder="Ex: Split Sala de Reuniões" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-[#64748B] block mb-1">Tipo</label>
              <select className="field text-sm" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as Equipamento['tipo'] }))}>
                {['Split', 'Cassete', 'VRF', 'Janela', 'Piso-teto', 'Outro'].map(t => <option key={t}>{t}</option>)}
              </select>
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
              <label className="text-xs font-medium text-[#64748B] block mb-1">Localização no imóvel</label>
              <input className="field text-sm" placeholder="Ex: 2º andar – Sala 201" value={form.localizacao} onChange={e => setForm(f => ({ ...f, localizacao: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-xs text-[#64748B] px-3 py-1.5 hover:bg-[#F1F5F9] rounded-lg">Cancelar</button>
            <button onClick={salvar} disabled={!form.nome} className="text-xs bg-[#4F7CFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#3D68F0] disabled:opacity-50">Salvar</button>
          </div>
        </div>
      )}

      {equipamentos.length === 0 ? (
        <div className="card text-center py-12">
          <Wrench size={36} className="text-[#E2E8F0] mx-auto mb-2" />
          <p className="text-[#94A3B8]">Nenhum equipamento cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {equipamentos.map(eq => (
            <div key={eq.id} className="card group hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tipoColor[eq.tipo] ?? tipoColor['Outro']}`}>{eq.tipo}</span>
                  {eq.capacidade_btu && <span className="text-xs text-[#94A3B8]">{eq.capacidade_btu.toLocaleString()} BTU</span>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link href={`/manutencoes/${contratoId}/equipamentos/${eq.id}`}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#4F7CFF]">
                    <Pencil size={13} />
                  </Link>
                  <button onClick={() => excluir(eq.id)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-[#94A3B8] hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <Link href={`/manutencoes/${contratoId}/equipamentos/${eq.id}`} className="block">
                <h4 className="font-semibold text-[#0F172A] hover:text-[#4F7CFF] transition-colors">{eq.nome}</h4>
                {(eq.marca || eq.modelo) && (
                  <p className="text-xs text-[#64748B] mt-0.5">{[eq.marca, eq.modelo].filter(Boolean).join(' · ')}</p>
                )}
                {eq.localizacao && (
                  <p className="text-xs text-[#94A3B8] mt-0.5">{eq.localizacao}</p>
                )}
              </Link>
            </div>
          ))}
        </div>
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
      </main>
    </div>
  )
}
