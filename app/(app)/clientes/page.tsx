'use client'
import { useState, useEffect } from 'react'
import Topbar from '@/components/Topbar'
import { createClient } from '@/lib/supabase/client'
import { Cliente, Empresa, TipoCliente } from '@/lib/types'
import { Plus, X, Pencil, Building2, ShoppingCart, Trash2, ChevronRight, MapPin, Phone, Mail, Hash, ShieldCheck } from 'lucide-react'

// ─── Modal Empresa ───────────────────────────────────────────────────────────
function ModalEmpresa({ empresa, onClose, onSaved }: {
  empresa: Empresa | null; onClose: () => void; onSaved: () => void
}) {
  const editing = !!empresa
  const [razaoSocial, setRazaoSocial] = useState(empresa?.razao_social ?? '')
  const [apelido, setApelido] = useState(empresa?.apelido ?? '')
  const [cnpj, setCnpj] = useState(empresa?.cnpj ?? '')
  const [endereco, setEndereco] = useState(empresa?.endereco ?? '')
  const [cidade, setCidade] = useState(empresa?.cidade ?? '')
  const [estado, setEstado] = useState(empresa?.estado ?? '')
  const [cep, setCep] = useState(empresa?.cep ?? '')
  const [telefone, setTelefone] = useState(empresa?.telefone ?? '')
  const [email, setEmail] = useState(empresa?.email ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const payload = {
      razao_social: razaoSocial.trim(),
      apelido: apelido.trim() || null,
      cnpj: cnpj.trim() || null,
      endereco: endereco.trim() || null,
      cidade: cidade.trim() || null,
      estado: estado.trim() || null,
      cep: cep.trim() || null,
      telefone: telefone.trim() || null,
      email: email.trim() || null,
    }
    const { error: err } = editing
      ? await supabase.from('empresas').update(payload).eq('id', empresa!.id)
      : await supabase.from('empresas').insert(payload)
    setLoading(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] shrink-0">
          <h2 className="font-semibold text-[#0F172A]">{editing ? 'Editar Empresa' : 'Nova Empresa'}</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#64748B] mb-1">Razão Social *</label>
              <input required className="field" value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} placeholder="Nome jurídico da empresa" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Apelido / Nome Fantasia</label>
              <input className="field" value={apelido} onChange={e => setApelido(e.target.value)} placeholder="Como a empresa é conhecida" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">CNPJ</label>
              <input className="field font-mono" value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Endereço</label>
            <input className="field" value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, complemento" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#64748B] mb-1">Cidade</label>
              <input className="field" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="São Paulo" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Estado</label>
              <input className="field" value={estado} onChange={e => setEstado(e.target.value)} placeholder="SP" maxLength={2} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">CEP</label>
              <input className="field font-mono" value={cep} onChange={e => setCep(e.target.value)} placeholder="00000-000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Telefone</label>
              <input className="field" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">E-mail</label>
            <input type="email" className="field" value={email} onChange={e => setEmail(e.target.value)} placeholder="contato@empresa.com.br" />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-3 pt-2 border-t border-[#E2E8F0]">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Criar Empresa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Cliente ────────────────────────────────────────────────────────────
function ModalCliente({ cliente, empresas, onClose, onSaved }: {
  cliente: Cliente | null; empresas: Empresa[]; onClose: () => void; onSaved: () => void
}) {
  const editing = !!cliente
  const [nome, setNome] = useState(cliente?.nome ?? '')
  const [email, setEmail] = useState(cliente?.email ?? '')
  const [telefone, setTelefone] = useState(cliente?.telefone ?? '')
  const [tipo, setTipo] = useState<TipoCliente>(cliente?.tipo ?? 'Comprador')
  const [empresaId, setEmpresaId] = useState<string>(cliente?.empresa_id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const payload = {
      nome,
      email: email || null,
      telefone: telefone || null,
      tipo,
      empresa_id: empresaId || null,
    }
    const { error: err } = editing
      ? await supabase.from('clientes').update(payload).eq('id', cliente!.id)
      : await supabase.from('clientes').insert(payload)
    setLoading(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-semibold text-[#0F172A]">{editing ? 'Editar Pessoa' : 'Nova Pessoa'}</h2>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Tipo *</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Gestor', 'Comprador', 'Fiscal'] as TipoCliente[]).map(t => (
                <button key={t} type="button" onClick={() => setTipo(t)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    tipo === t
                      ? t === 'Gestor' ? 'border-[#4F7CFF] bg-[#EEF2FF] text-[#4F7CFF]'
                        : t === 'Comprador' ? 'border-[#10B981] bg-emerald-50 text-emerald-700'
                        : 'border-[#F59E0B] bg-amber-50 text-amber-700'
                      : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                  }`}>
                  {t === 'Gestor' ? <Building2 size={15} /> : t === 'Comprador' ? <ShoppingCart size={15} /> : <ShieldCheck size={15} />}
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome *</label>
            <input required className="field" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Empresa</label>
            <select className="field" value={empresaId} onChange={e => setEmpresaId(e.target.value)}>
              <option value="">— Sem empresa vinculada —</option>
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.apelido || emp.razao_social}{emp.cnpj ? ` · ${emp.cnpj}` : ''}
                </option>
              ))}
            </select>
            {empresas.length === 0 && (
              <p className="text-[11px] text-[#94A3B8] mt-1">Cadastre empresas na aba "Empresas" primeiro.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">E-mail</label>
              <input type="email" className="field" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@empresa.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Telefone</label>
              <input className="field" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-3 pt-2 border-t border-[#E2E8F0]">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Criar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Tabela de clientes ───────────────────────────────────────────────────────
function TabelaClientes({ clientes, empresas, onEdit, onDelete }: {
  clientes: Cliente[]; empresas: Empresa[]; onEdit: (c: Cliente) => void; onDelete: (c: Cliente) => void
}) {
  if (clientes.length === 0) return (
    <tr><td colSpan={5} className="text-center py-8 text-sm text-[#94A3B8]">Nenhum cadastrado neste grupo.</td></tr>
  )
  return (
    <>
      {clientes.map(c => {
        const emp = empresas.find(e => e.id === c.empresa_id)
        return (
          <tr key={c.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] group">
            <td className="px-4 py-3 text-sm font-medium text-[#0F172A]">
              <div>{c.nome}</div>
              {emp && <div className="text-[11px] text-[#94A3B8] mt-0.5">{emp.apelido || emp.razao_social}</div>}
            </td>
            <td className="hidden sm:table-cell px-4 py-3 text-sm text-[#64748B]">{c.email || '—'}</td>
            <td className="hidden md:table-cell px-4 py-3 text-sm text-[#64748B]">{c.telefone || '—'}</td>
            <td className="px-4 py-3">
              {c.tipo === 'Gestor'
                ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#4F7CFF]"><Building2 size={10} /> Gestor</span>
                : c.tipo === 'Fiscal'
                ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700"><ShieldCheck size={10} /> Fiscal</span>
                : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700"><ShoppingCart size={10} /> Comprador</span>}
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(c)} className="p-1.5 rounded-lg hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#4F7CFF] transition-colors"><Pencil size={13} /></button>
                <button onClick={() => onDelete(c)} className="p-1.5 rounded-lg hover:bg-red-50 text-[#94A3B8] hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
              </div>
            </td>
          </tr>
        )
      })}
    </>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ClientesPage() {
  const [aba, setAba] = useState<'pessoas' | 'empresas'>('pessoas')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [search, setSearch] = useState('')
  const [showModalCliente, setShowModalCliente] = useState(false)
  const [editCliente, setEditCliente] = useState<Cliente | null>(null)
  const [showModalEmpresa, setShowModalEmpresa] = useState(false)
  const [editEmpresa, setEditEmpresa] = useState<Empresa | null>(null)

  async function load() {
    const supabase = createClient()
    const [{ data: c }, { data: e }] = await Promise.all([
      supabase.from('clientes').select('*').order('nome'),
      supabase.from('empresas').select('*').order('razao_social'),
    ])
    if (c) setClientes(c as Cliente[])
    if (e) setEmpresas(e as Empresa[])
  }
  useEffect(() => { load() }, [])

  async function excluirCliente(c: Cliente) {
    if (!confirm(`Excluir "${c.nome}"? Obras vinculadas a este cliente serão desvinculadas.`)) return
    const supabase = createClient()
    // Desvincular obras antes de excluir (FK obras.cliente_id)
    const { error: errObras } = await supabase.from('obras').update({ cliente_id: null }).eq('cliente_id', c.id)
    if (errObras) { alert('Erro ao desvincular obras: ' + errObras.message); return }
    const { error } = await supabase.from('clientes').delete().eq('id', c.id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    load()
  }

  async function excluirEmpresa(e: Empresa) {
    if (!confirm(`Excluir "${e.razao_social}"? As pessoas vinculadas a ela serão desvinculadas.`)) return
    const { error } = await createClient().from('empresas').delete().eq('id', e.id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    load()
  }

  const q = search.toLowerCase()
  const filteredClientes = clientes.filter(c =>
    c.nome.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
  )
  const filteredEmpresas = empresas.filter(e =>
    e.razao_social.toLowerCase().includes(q) ||
    (e.apelido || '').toLowerCase().includes(q) ||
    (e.cnpj || '').includes(q)
  )

  const gestores = filteredClientes.filter(c => c.tipo === 'Gestor')
  const compradores = filteredClientes.filter(c => c.tipo === 'Comprador' || !c.tipo)
  const fiscais = filteredClientes.filter(c => c.tipo === 'Fiscal')

  const thCls = 'text-left text-xs font-semibold text-[#64748B] px-4 py-2.5'

  return (
    <div>
      <Topbar searchPlaceholder={aba === 'pessoas' ? 'Buscar pessoa...' : 'Buscar empresa...'} onSearch={setSearch} />
      <div className="p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-syne text-xl md:text-2xl font-bold text-[#0F172A]">Clientes</h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              {clientes.length} pessoa{clientes.length !== 1 ? 's' : ''} · {empresas.length} empresa{empresas.length !== 1 ? 's' : ''}
            </p>
          </div>
          {aba === 'pessoas' ? (
            <button onClick={() => { setEditCliente(null); setShowModalCliente(true) }} className="btn-primary text-sm px-3 py-2">
              <Plus size={15} /> <span className="hidden sm:inline">Nova </span>Pessoa
            </button>
          ) : (
            <button onClick={() => { setEditEmpresa(null); setShowModalEmpresa(true) }} className="btn-primary text-sm px-3 py-2">
              <Plus size={15} /> <span className="hidden sm:inline">Nova </span>Empresa
            </button>
          )}
        </div>

        {/* Abas */}
        <div className="flex gap-1 border-b border-[#E2E8F0]">
          {([['pessoas', 'Pessoas'], ['empresas', 'Empresas']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setAba(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                aba === key ? 'border-[#4F7CFF] text-[#4F7CFF]' : 'border-transparent text-[#64748B] hover:text-[#374151]'
              }`}>
              {label}
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B]">
                {key === 'pessoas' ? clientes.length : empresas.length}
              </span>
            </button>
          ))}
        </div>

        {/* ── ABA PESSOAS ── */}
        {aba === 'pessoas' && (
          <div className="space-y-5">
            {/* Gestores */}
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <Building2 size={14} className="text-[#4F7CFF]" />
                <span className="font-semibold text-sm text-[#0F172A]">Gestores</span>
                <span className="text-xs text-[#94A3B8]">{gestores.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px]">
                  <thead><tr className="border-b border-[#F1F5F9]">
                    <th className={thCls}>Nome</th>
                    <th className={`hidden sm:table-cell ${thCls}`}>E-mail</th>
                    <th className={`hidden md:table-cell ${thCls}`}>Telefone</th>
                    <th className={thCls}>Tipo</th>
                    <th className="w-16" />
                  </tr></thead>
                  <tbody><TabelaClientes clientes={gestores} empresas={empresas} onEdit={c => { setEditCliente(c); setShowModalCliente(true) }} onDelete={excluirCliente} /></tbody>
                </table>
              </div>
            </div>

            {/* Compradores */}
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <ShoppingCart size={14} className="text-emerald-600" />
                <span className="font-semibold text-sm text-[#0F172A]">Compradores</span>
                <span className="text-xs text-[#94A3B8]">{compradores.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px]">
                  <thead><tr className="border-b border-[#F1F5F9]">
                    <th className={thCls}>Nome</th>
                    <th className={`hidden sm:table-cell ${thCls}`}>E-mail</th>
                    <th className={`hidden md:table-cell ${thCls}`}>Telefone</th>
                    <th className={thCls}>Tipo</th>
                    <th className="w-16" />
                  </tr></thead>
                  <tbody><TabelaClientes clientes={compradores} empresas={empresas} onEdit={c => { setEditCliente(c); setShowModalCliente(true) }} onDelete={excluirCliente} /></tbody>
                </table>
              </div>
            </div>

            {/* Fiscais */}
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <ShieldCheck size={14} className="text-amber-600" />
                <span className="font-semibold text-sm text-[#0F172A]">Fiscais</span>
                <span className="text-xs text-[#94A3B8]">{fiscais.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px]">
                  <thead><tr className="border-b border-[#F1F5F9]">
                    <th className={thCls}>Nome</th>
                    <th className={`hidden sm:table-cell ${thCls}`}>E-mail</th>
                    <th className={`hidden md:table-cell ${thCls}`}>Telefone</th>
                    <th className={thCls}>Tipo</th>
                    <th className="w-16" />
                  </tr></thead>
                  <tbody><TabelaClientes clientes={fiscais} empresas={empresas} onEdit={c => { setEditCliente(c); setShowModalCliente(true) }} onDelete={excluirCliente} /></tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── ABA EMPRESAS ── */}
        {aba === 'empresas' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmpresas.length === 0 && (
              <div className="col-span-3 card text-center py-12">
                <Building2 size={32} className="text-[#CBD5E1] mx-auto mb-3" />
                <p className="text-sm text-[#94A3B8] mb-3">Nenhuma empresa cadastrada.</p>
                <button onClick={() => { setEditEmpresa(null); setShowModalEmpresa(true) }} className="btn-primary mx-auto">
                  <Plus size={14} /> Cadastrar primeira empresa
                </button>
              </div>
            )}
            {filteredEmpresas.map(emp => {
              const vinculados = clientes.filter(c => c.empresa_id === emp.id).length
              return (
                <div key={emp.id} className="card group hover:border-[#4F7CFF]/30 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0">
                      <Building2 size={18} className="text-[#4F7CFF]" />
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditEmpresa(emp); setShowModalEmpresa(true) }}
                        className="p-1.5 rounded-lg hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#4F7CFF] transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => excluirEmpresa(emp)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-[#94A3B8] hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>

                  <h3 className="font-semibold text-sm text-[#0F172A] leading-tight">{emp.razao_social}</h3>
                  {emp.apelido && <p className="text-xs text-[#64748B] mt-0.5">{emp.apelido}</p>}

                  <div className="mt-3 space-y-1.5">
                    {emp.cnpj && (
                      <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                        <Hash size={11} className="text-[#94A3B8]" /> {emp.cnpj}
                      </div>
                    )}
                    {(emp.cidade || emp.estado) && (
                      <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                        <MapPin size={11} className="text-[#94A3B8]" /> {[emp.cidade, emp.estado].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {emp.telefone && (
                      <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                        <Phone size={11} className="text-[#94A3B8]" /> {emp.telefone}
                      </div>
                    )}
                    {emp.email && (
                      <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                        <Mail size={11} className="text-[#94A3B8]" /> {emp.email}
                      </div>
                    )}
                  </div>

                  {vinculados > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex items-center gap-1.5">
                      <ChevronRight size={11} className="text-[#94A3B8]" />
                      <span className="text-[11px] text-[#64748B]">{vinculados} pessoa{vinculados !== 1 ? 's' : ''} vinculada{vinculados !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModalCliente && (
        <ModalCliente
          cliente={editCliente}
          empresas={empresas}
          onClose={() => setShowModalCliente(false)}
          onSaved={() => { setShowModalCliente(false); load() }}
        />
      )}
      {showModalEmpresa && (
        <ModalEmpresa
          empresa={editEmpresa}
          onClose={() => setShowModalEmpresa(false)}
          onSaved={() => { setShowModalEmpresa(false); load() }}
        />
      )}
    </div>
  )
}
