'use client'
import { useState, useEffect } from 'react'
import Topbar from '@/components/Topbar'
import { createClient } from '@/lib/supabase/client'
import { Cliente } from '@/lib/types'
import { Plus, X } from 'lucide-react'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [showModal, setShowModal] = useState(false)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('clientes').select('*').order('nome')
    if (data) setClientes(data)
  }
  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.from('clientes').insert({ nome, email: email || null, telefone: telefone || null })
    setShowModal(false); setNome(''); setEmail(''); setTelefone(''); setLoading(false)
    load()
  }

  return (
    <div>
      <Topbar />
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-syne text-xl md:text-2xl font-bold text-[#0F172A]">Clientes</h1>
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm px-3 py-2"><Plus size={15} /> <span className="hidden sm:inline">Novo </span>Cliente</button>
        </div>
        <div className="card p-0 overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[320px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Nome</th>
                <th className="hidden sm:table-cell text-left text-xs font-semibold text-[#64748B] px-4 py-3">E-mail</th>
                <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Telefone</th>
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-10 text-sm text-[#94A3B8]">Nenhum cliente cadastrado.</td></tr>
              ) : clientes.map(c => (
                <tr key={c.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3 text-sm font-medium text-[#0F172A]">{c.nome}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-sm text-[#64748B]">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-sm text-[#64748B]">{c.telefone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <h2 className="font-syne font-semibold text-[#0F172A]">Novo Cliente</h2>
              <button onClick={() => setShowModal(false)}><X size={16} className="text-[#64748B]" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome *</label>
                <input required className="field" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome da empresa ou pessoa" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">E-mail</label>
                <input type="email" className="field" value={email} onChange={e => setEmail(e.target.value)} placeholder="contato@empresa.com.br" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Telefone</label>
                <input className="field" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : 'Salvar Cliente'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
