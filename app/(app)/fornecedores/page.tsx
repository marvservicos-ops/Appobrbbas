'use client'

import { useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import ModalFornecedor from '@/components/ModalFornecedor'
import { mensagemErro } from '@/lib/erros'
import { type Fornecedor, fornecedorCombina, formatarDocumento } from '@/lib/fornecedores'

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [modal, setModal] = useState<{ fornecedor: Fornecedor | null } | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setErro(null)
    const { data, error } = await createClient().from('fornecedores').select('*').order('nome')
    if (error) setErro(mensagemErro(error, 'Erro ao carregar os fornecedores'))
    else setFornecedores((data ?? []) as Fornecedor[])
    setLoading(false)
  }

  async function excluir(f: Fornecedor) {
    if (!confirm(`Excluir o fornecedor "${f.nome}"?`)) return
    const { error } = await createClient().from('fornecedores').delete().eq('id', f.id)
    if (error) {
      // FK: tem nota ou conta lançada → só dá para inativar
      alert(error.code === '23503'
        ? 'Este fornecedor tem notas ou contas lançadas e não pode ser excluído. Edite e desmarque "Ativo" para escondê-lo.'
        : mensagemErro(error, 'Erro ao excluir o fornecedor'))
      return
    }
    load()
  }

  const lista = fornecedores.filter(f => (mostrarInativos || f.ativo) && fornecedorCombina(f, busca))
  const inativos = fornecedores.filter(f => !f.ativo).length

  return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="p-4 md:p-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="font-syne text-xl font-bold text-[#0F172A]">Fornecedores</h1>
            <p className="text-sm text-[#64748B] mt-0.5">Quem emite as notas e os boletos que chegam no DDA</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} aria-label="Atualizar" title="Atualizar" className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#E2E8F0] hover:bg-[#F1F5F9]">
              <RefreshCw size={14} className="text-[#94A3B8]" />
            </button>
            <button onClick={() => setModal({ fornecedor: null })} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={15} /> Novo fornecedor
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap mb-4">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input className="field !pl-9" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou CNPJ" />
          </div>
          {inativos > 0 && (
            <label className="flex items-center gap-2 text-xs text-[#64748B]">
              <input type="checkbox" checked={mostrarInativos} onChange={e => setMostrarInativos(e.target.checked)} className="w-4 h-4 accent-[#4F7CFF]" />
              Mostrar inativos ({inativos})
            </label>
          )}
        </div>

        {erro ? (
          <div className="card flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm font-medium text-red-600">{erro}</p>
            <button onClick={load} className="btn-primary mt-4 text-sm">Tentar de novo</button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#4F7CFF]" /></div>
        ) : lista.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-[#374151]">{busca ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}</p>
            <p className="text-xs text-[#94A3B8] mt-1">Cadastre aqui ou direto ao lançar uma nota em Contas a pagar.</p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden divide-y divide-[#F8FAFC]">
            {lista.map(f => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFA] group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{f.nome_fantasia || f.nome}</p>
                    {!f.ativo && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Inativo</span>}
                  </div>
                  <p className="text-xs text-[#94A3B8] truncate">
                    {[f.nome_fantasia ? f.nome : null, f.cnpj ? formatarDocumento(f.cnpj) : 'sem CNPJ', f.telefone, f.email].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex gap-1 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setModal({ fornecedor: f })} aria-label="Editar fornecedor" title="Editar fornecedor" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#EEF2FF]">
                    <Pencil size={14} className="text-[#4F7CFF]" />
                  </button>
                  <button onClick={() => excluir(f)} aria-label="Excluir fornecedor" title="Excluir fornecedor" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <ModalFornecedor fornecedor={modal.fornecedor}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }} />
      )}
    </div>
  )
}
