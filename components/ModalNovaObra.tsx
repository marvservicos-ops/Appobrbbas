'use client'

import { useState, useEffect } from 'react'
import { X, Wrench, Settings, Plus, Pencil, Trash2, Check, Building2, Phone, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Cliente, Obra, TipoServico, StatusObra } from '@/lib/types'

interface Props {
  onClose: () => void
  onCreated: () => void
  obra?: Obra
}

const statusOpcoes: StatusObra[] = ['Em Orçamento', 'Aprovada', 'Em Andamento', 'Concluída']

// ─── Painel de gerenciamento de tipos de serviço ────────────────────────────
function PainelTipos({ onClose }: { onClose: () => void }) {
  const [tipos, setTipos] = useState<TipoServico[]>([])
  const [novoNome, setNovoNome] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    const { data } = await createClient().from('tipos_servico').select('*').order('ordem')
    if (data) setTipos(data as TipoServico[])
  }

  useEffect(() => { load() }, [])

  async function adicionar() {
    if (!novoNome.trim()) return
    setLoading(true)
    await createClient().from('tipos_servico').insert({ nome: novoNome.trim(), ordem: tipos.length + 1 })
    setNovoNome('')
    await load()
    setLoading(false)
  }

  async function salvarEdit(id: string) {
    if (!editNome.trim()) return
    await createClient().from('tipos_servico').update({ nome: editNome.trim() }).eq('id', id)
    setEditId(null)
    await load()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este tipo de serviço?')) return
    await createClient().from('tipos_servico').delete().eq('id', id)
    await load()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[380px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-syne font-semibold text-[#0F172A] text-sm">Gerenciar Tipos de Serviço</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9]">
            <X size={14} className="text-[#64748B]" />
          </button>
        </div>
        <div className="p-5 space-y-2 max-h-[340px] overflow-y-auto">
          {tipos.map(t => (
            <div key={t.id} className="flex items-center gap-2 group">
              {editId === t.id ? (
                <>
                  <input
                    autoFocus
                    value={editNome}
                    onChange={e => setEditNome(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && salvarEdit(t.id)}
                    className="flex-1 field text-sm py-1.5"
                  />
                  <button onClick={() => salvarEdit(t.id)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#4F7CFF] hover:bg-[#3D68F0]">
                    <Check size={13} className="text-white" />
                  </button>
                  <button onClick={() => setEditId(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9]">
                    <X size={13} className="text-[#64748B]" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-[#374151] py-1.5 px-2 rounded-lg group-hover:bg-[#F8FAFC]">{t.nome}</span>
                  <button onClick={() => { setEditId(t.id); setEditNome(t.nome) }} className="w-7 h-7 hidden group-hover:flex items-center justify-center rounded-lg hover:bg-[#EEF2FF]">
                    <Pencil size={12} className="text-[#4F7CFF]" />
                  </button>
                  <button onClick={() => excluir(t.id)} className="w-7 h-7 hidden group-hover:flex items-center justify-center rounded-lg hover:bg-red-50">
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="px-5 pb-5 pt-2 border-t border-[#E2E8F0]">
          <div className="flex gap-2">
            <input
              placeholder="Novo tipo de serviço..."
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && adicionar()}
              className="flex-1 field text-sm"
            />
            <button
              onClick={adicionar}
              disabled={loading || !novoNome.trim()}
              className="px-3 py-2 bg-[#4F7CFF] hover:bg-[#3D68F0] disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-1"
            >
              <Plus size={14} /> Adicionar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Card de preview do cliente selecionado ──────────────────────────────────
function ClienteCard({ cliente, empresas }: { cliente: Cliente; empresas: Record<string, string> }) {
  return (
    <div className="mt-2 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-1">
      <p className="font-medium text-[#0F172A] text-sm">{cliente.nome}</p>
      {cliente.empresa_id && empresas[cliente.empresa_id] && (
        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <Building2 size={11} /> {empresas[cliente.empresa_id]}
        </div>
      )}
      {cliente.telefone && (
        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <Phone size={11} /> {cliente.telefone}
        </div>
      )}
      {cliente.email && (
        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <Mail size={11} /> {cliente.email}
        </div>
      )}
    </div>
  )
}

// ─── Modal principal ──────────────────────────────────────────────────────────
export default function ModalNovaObra({ onClose, onCreated, obra }: Props) {
  const editing = !!obra
  const [tiposServico, setTiposServico] = useState<TipoServico[]>([])
  const [gestores, setGestores] = useState<Cliente[]>([])
  const [compradores, setCompradores] = useState<Cliente[]>([])
  const [empresasMap, setEmpresasMap] = useState<Record<string, string>>({})
  const [showGerenciarTipos, setShowGerenciarTipos] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    titulo: obra?.titulo ?? '',
    tipo_servico: obra?.tipo_servico ?? '',
    status: (obra?.status ?? 'Em Orçamento') as StatusObra,
    engenheiro_responsavel: obra?.engenheiro_responsavel ?? '',
    numero_contrato: obra?.numero_contrato ?? '',
    endereco: obra?.endereco ?? '',
    pavimento: obra?.pavimento ?? '',
    data_inicio: obra?.data_inicio ?? '',
    previsao_termino: obra?.previsao_termino ?? '',
    data_aprovacao_contrato: obra?.data_aprovacao_contrato ?? '',
    descricao: obra?.descricao ?? '',
    gestor_id: obra?.gestor_id ?? '',
    comprador_id: obra?.comprador_id ?? '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function loadData() {
    const supabase = createClient()
    const [tiposRes, clientesRes, empresasRes] = await Promise.all([
      supabase.from('tipos_servico').select('*').order('ordem'),
      supabase.from('clientes').select('*').order('nome'),
      supabase.from('empresas').select('id, razao_social, apelido'),
    ])
    if (tiposRes.data) {
      const ts = tiposRes.data as TipoServico[]
      setTiposServico(ts)
      if (!form.tipo_servico && ts.length > 0) {
        setForm(f => ({ ...f, tipo_servico: f.tipo_servico || ts[0].nome }))
      }
    }
    if (clientesRes.data) {
      const todos = clientesRes.data as Cliente[]
      setGestores(todos.filter(c => c.tipo === 'Gestor'))
      setCompradores(todos.filter(c => c.tipo === 'Comprador'))
    }
    if (empresasRes.data) {
      const m: Record<string, string> = {}
      empresasRes.data.forEach((e: { id: string; razao_social: string; apelido?: string }) => {
        m[e.id] = e.apelido || e.razao_social
      })
      setEmpresasMap(m)
    }
  }

  useEffect(() => { loadData() }, [])

  const gestorSelecionado = gestores.find(g => g.id === form.gestor_id) ?? null
  const compradorSelecionado = compradores.find(c => c.id === form.comprador_id) ?? null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const payload = {
      titulo: form.titulo,
      tipo_servico: form.tipo_servico,
      status: form.status,
      engenheiro_responsavel: form.engenheiro_responsavel || null,
      numero_contrato: form.numero_contrato || null,
      endereco: form.endereco || null,
      pavimento: form.pavimento || null,
      data_inicio: form.data_inicio || null,
      previsao_termino: form.previsao_termino || null,
      data_aprovacao_contrato: form.data_aprovacao_contrato || null,
      descricao: form.descricao || null,
      gestor_id: form.gestor_id || null,
      comprador_id: form.comprador_id || null,
      cliente_id: form.gestor_id || form.comprador_id || null,
    }
    const { error: err } = editing
      ? await supabase.from('obras').update(payload).eq('id', obra!.id)
      : await supabase.from('obras').insert(payload)
    if (err) { setError(err.message); setLoading(false); return }
    onCreated()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-[640px] max-h-[calc(100dvh-env(safe-area-inset-top))] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#EEF2FF] rounded-lg flex items-center justify-center">
                <Wrench size={16} className="text-[#4F7CFF]" />
              </div>
              <h2 className="font-syne font-semibold text-[#0F172A]">{editing ? 'Editar Obra' : 'Nova Obra'}</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] transition-colors">
              <X size={16} className="text-[#64748B]" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Bloco 1: Identificação */}
            <div>
              <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">Identificação</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Título do Projeto *</label>
                  <input required type="text" placeholder="Ex: Manutenção Chiller Prédio A"
                    value={form.titulo} onChange={e => set('titulo', e.target.value)} className="field" />
                </div>

                {/* Tipo de Serviço */}
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Tipo de Serviço</label>
                  <div className="flex gap-2">
                    <select value={form.tipo_servico} onChange={e => set('tipo_servico', e.target.value)} className="field flex-1">
                      {tiposServico.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowGerenciarTipos(true)}
                      title="Gerenciar tipos"
                      className="w-10 h-10 flex items-center justify-center rounded-lg border border-[#E2E8F0] hover:bg-[#EEF2FF] hover:border-[#4F7CFF] transition-colors">
                      <Settings size={15} className="text-[#64748B]" />
                    </button>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Status</label>
                  <select value={form.status} onChange={e => set('status', e.target.value)} className="field">
                    {statusOpcoes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Engenheiro */}
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Engenheiro Responsável</label>
                  <input type="text" placeholder="Nome do responsável"
                    value={form.engenheiro_responsavel} onChange={e => set('engenheiro_responsavel', e.target.value)} className="field" />
                </div>

                {/* Contrato */}
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Nº do Contrato</label>
                  <input type="text" placeholder="0000/2024"
                    value={form.numero_contrato} onChange={e => set('numero_contrato', e.target.value)} className="field" />
                </div>
              </div>
            </div>

            {/* Bloco 2: Localização */}
            <div>
              <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">Localização</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Endereço da Obra</label>
                  <input type="text" placeholder="Rua, Número, Bairro, Cidade – UF"
                    value={form.endereco} onChange={e => set('endereco', e.target.value)} className="field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Pavimento</label>
                  <input type="text" placeholder="Ex: 5º andar, Térreo, Subsolo"
                    value={form.pavimento} onChange={e => set('pavimento', e.target.value)} className="field" />
                </div>
              </div>
            </div>

            {/* Bloco 3: Datas */}
            <div>
              <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">Datas</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Aprovação do Contrato</label>
                  <input type="date" value={form.data_aprovacao_contrato}
                    onChange={e => set('data_aprovacao_contrato', e.target.value)} className="field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Data de Início</label>
                  <input type="date" value={form.data_inicio}
                    onChange={e => set('data_inicio', e.target.value)} className="field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Previsão de Término</label>
                  <input type="date" value={form.previsao_termino}
                    onChange={e => set('previsao_termino', e.target.value)} className="field" />
                </div>
              </div>
            </div>

            {/* Bloco 4: Contatos */}
            <div>
              <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">Contatos do Projeto</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Gestor */}
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Gestor Responsável</label>
                  <select value={form.gestor_id} onChange={e => set('gestor_id', e.target.value)} className="field">
                    <option value="">Selecione um gestor</option>
                    {gestores.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                  </select>
                  {gestorSelecionado && <ClienteCard cliente={gestorSelecionado} empresas={empresasMap} />}
                </div>

                {/* Comprador */}
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Comprador</label>
                  <select value={form.comprador_id} onChange={e => set('comprador_id', e.target.value)} className="field">
                    <option value="">Selecione um comprador</option>
                    {compradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  {compradorSelecionado && <ClienteCard cliente={compradorSelecionado} empresas={empresasMap} />}
                </div>
              </div>
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Descrição e Escopo</label>
              <textarea rows={3} placeholder="Detalhes técnicos sobre a execução da obra..."
                value={form.descricao} onChange={e => set('descricao', e.target.value)} className="field resize-none" />
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E2E8F0]">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                className="px-5 py-2 bg-[#4F7CFF] hover:bg-[#3D68F0] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
                {loading ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Salvar Obra'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showGerenciarTipos && (
        <PainelTipos onClose={() => { setShowGerenciarTipos(false); loadData() }} />
      )}
    </>
  )
}
