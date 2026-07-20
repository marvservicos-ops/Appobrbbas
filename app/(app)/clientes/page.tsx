'use client'
import { useState, useEffect } from 'react'
import Topbar from '@/components/Topbar'
import { createClient } from '@/lib/supabase/client'
import { Cliente, TipoCliente } from '@/lib/types'
import { Plus, X, Pencil, Building2, ShoppingCart } from 'lucide-react'


function ModalCliente({ cliente, onClose, onSaved }: {
  cliente: Cliente | null
  onClose: () => void
  onSaved: () => void
}) {
  const editing = !!cliente
  const [nome, setNome] = useState(cliente?.nome ?? '')
  const [email, setEmail] = useState(cliente?.email ?? '')
  const [telefone, setTelefone] = useState(cliente?.telefone ?? '')
  const [tipo, setTipo] = useState<TipoCliente>(cliente?.tipo ?? 'Comprador')
  const [empresa, setEmpresa] = useState(cliente?.cargo ?? '')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const payload = {
      nome,
      email: email || null,
      telefone: telefone || null,
      tipo,
      cargo: empresa || null,
    }
    if (editing) {
      await supabase.from('clientes').update(payload).eq('id', cliente!.id)
    } else {
      await supabase.from('clientes').insert(payload)
    }
    setLoading(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-semibold text-[#0F172A]">{editing ? 'Editar Cliente' : 'Novo Cliente'}</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Tipo *</label>
            <div className="grid grid-cols-2 gap-2">
              {(['Gestor', 'Comprador'] as TipoCliente[]).map(t => (
                <button key={t} type="button" onClick={() => setTipo(t)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    tipo === t
                      ? t === 'Gestor'
                        ? 'border-[#4F7CFF] bg-[#EEF2FF] text-[#4F7CFF]'
                        : 'border-[#10B981] bg-emerald-50 text-emerald-700'
                      : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                  }`}>
                  {t === 'Gestor' ? <Building2 size={15} /> : <ShoppingCart size={15} />}
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome *</label>
            <input required className="field" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome da empresa ou pessoa" />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Empresa</label>
            <input className="field" value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Nome da empresa" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">E-mail</label>
              <input type="email" className="field" value={email} onChange={e => setEmail(e.target.value)} placeholder="contato@empresa.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Telefone</label>
              <input className="field" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-[#E2E8F0]">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Criar Cliente'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TipoBadge({ tipo }: { tipo?: TipoCliente }) {
  if (tipo === 'Gestor') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#4F7CFF]">
      <Building2 size={10} /> Gestor
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
      <ShoppingCart size={10} /> Comprador
    </span>
  )
}

function TabelaClientes({ clientes, onEdit }: { clientes: Cliente[], onEdit: (c: Cliente) => void }) {
  if (clientes.length === 0) return (
    <tr><td colSpan={5} className="text-center py-8 text-sm text-[#94A3B8]">Nenhum cadastrado neste grupo.</td></tr>
  )
  return (
    <>
      {clientes.map(c => (
        <tr key={c.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] group">
          <td className="px-4 py-3 text-sm font-medium text-[#0F172A]">
            <div>{c.nome}</div>
            {c.cargo && <div className="text-[11px] text-[#94A3B8] mt-0.5">{c.cargo}</div>}
          </td>
          <td className="hidden sm:table-cell px-4 py-3 text-sm text-[#64748B]">{c.email || '—'}</td>
          <td className="hidden md:table-cell px-4 py-3 text-sm text-[#64748B]">{c.telefone || '—'}</td>
          <td className="px-4 py-3"><TipoBadge tipo={c.tipo} /></td>
          <td className="px-4 py-3">
            <button onClick={() => onEdit(c)}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#4F7CFF] transition-all">
              <Pencil size={13} />
            </button>
          </td>
        </tr>
      ))}
    </>
  )
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editCliente, setEditCliente] = useState<Cliente | null>(null)
  const [search, setSearch] = useState('')

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('clientes').select('*').order('nome')
    if (data) setClientes(data as Cliente[])
  }
  useEffect(() => { load() }, [])

  const filtered = clientes.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  )
  const gestores = filtered.filter(c => c.tipo === 'Gestor')
  const compradores = filtered.filter(c => c.tipo === 'Comprador' || !c.tipo)

  function openEdit(c: Cliente) { setEditCliente(c); setShowModal(true) }
  function openNew() { setEditCliente(null); setShowModal(true) }

  return (
    <div>
      <Topbar searchPlaceholder="Buscar cliente..." onSearch={setSearch} />
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-syne text-xl md:text-2xl font-bold text-[#0F172A]">Clientes</h1>
            <p className="text-xs text-[#64748B] mt-0.5">{clientes.length} cadastrado{clientes.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={openNew} className="btn-primary text-sm px-3 py-2">
            <Plus size={15} /> <span className="hidden sm:inline">Novo </span>Cliente
          </button>
        </div>

        {/* Grupo Gestores */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
            <Building2 size={15} className="text-[#4F7CFF]" />
            <span className="font-semibold text-sm text-[#0F172A]">Gestores</span>
            <span className="text-xs text-[#94A3B8] ml-1">{gestores.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="border-b border-[#F1F5F9]">
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Nome</th>
                  <th className="hidden sm:table-cell text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">E-mail</th>
                  <th className="hidden md:table-cell text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Telefone</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Tipo</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody><TabelaClientes clientes={gestores} onEdit={openEdit} /></tbody>
            </table>
          </div>
        </div>

        {/* Grupo Compradores */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
            <ShoppingCart size={15} className="text-emerald-600" />
            <span className="font-semibold text-sm text-[#0F172A]">Compradores</span>
            <span className="text-xs text-[#94A3B8] ml-1">{compradores.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="border-b border-[#F1F5F9]">
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Nome</th>
                  <th className="hidden sm:table-cell text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">E-mail</th>
                  <th className="hidden md:table-cell text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Telefone</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-2.5">Tipo</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody><TabelaClientes clientes={compradores} onEdit={openEdit} /></tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <ModalCliente
          cliente={editCliente}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
