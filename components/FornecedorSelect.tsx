'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import ModalFornecedor from '@/components/ModalFornecedor'
import { type Fornecedor, fornecedorCombina, formatarDocumento, nomeFornecedor } from '@/lib/fornecedores'

// Busca de fornecedor por nome ou CNPJ, com cadastro rápido do que não existe.
export default function FornecedorSelect({ fornecedores, value, onChange, onCriado, disabled, buscaInicial }: {
  fornecedores: Fornecedor[]
  value: string
  onChange: (id: string) => void
  onCriado: (f: Fornecedor) => void
  disabled?: boolean
  buscaInicial?: string
}) {
  const [busca, setBusca] = useState(buscaInicial ?? '')
  const [aberto, setAberto] = useState(false)
  const [novo, setNovo] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  const sel = fornecedores.find(f => f.id === value)

  useEffect(() => {
    if (!aberto) return
    const fechar = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [aberto])

  const opcoes = fornecedores.filter(f => f.ativo && fornecedorCombina(f, busca)).slice(0, 30)

  if (sel) {
    return (
      <div className="field flex items-center gap-2 !py-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#0F172A] truncate">{nomeFornecedor(sel)}</p>
          <p className="text-[11px] text-[#94A3B8] truncate">{sel.nome_fantasia ? `${sel.nome} · ` : ''}{sel.cnpj ? formatarDocumento(sel.cnpj) : 'sem CNPJ'}</p>
        </div>
        {!disabled && (
          <button type="button" onClick={() => { onChange(''); setBusca(''); setAberto(true) }} aria-label="Trocar fornecedor" title="Trocar fornecedor" className="p-1.5 rounded-lg hover:bg-[#F1F5F9]">
            <X size={14} className="text-[#64748B]" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={caixa} className="relative">
      <input className="field" value={busca} disabled={disabled}
        onChange={e => { setBusca(e.target.value); setAberto(true) }}
        onFocus={() => setAberto(true)}
        placeholder="Buscar por nome ou CNPJ" />
      {aberto && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto">
          {opcoes.map(f => (
            <button key={f.id} type="button" onClick={() => { onChange(f.id); setAberto(false) }}
              className="w-full text-left px-3 py-2 hover:bg-[#F8FAFC] border-b border-[#F8FAFC] last:border-0">
              <p className="text-sm text-[#0F172A] truncate">{nomeFornecedor(f)}</p>
              <p className="text-[11px] text-[#94A3B8] truncate">{f.nome_fantasia ? `${f.nome} · ` : ''}{f.cnpj ? formatarDocumento(f.cnpj) : 'sem CNPJ'}</p>
            </button>
          ))}
          {opcoes.length === 0 && <p className="px-3 py-2 text-xs text-[#94A3B8]">Nenhum fornecedor encontrado.</p>}
          <button type="button" onClick={() => { setNovo(true); setAberto(false) }}
            className="w-full text-left px-3 py-2.5 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] flex items-center gap-1.5 border-t border-[#E2E8F0]">
            <Plus size={14} /> Cadastrar {busca.trim() ? `"${busca.trim()}"` : 'novo fornecedor'}
          </button>
        </div>
      )}
      {novo && (
        <ModalFornecedor fornecedor={null} nomeInicial={busca.trim()}
          onClose={() => setNovo(false)}
          onSaved={f => { setNovo(false); onCriado(f); onChange(f.id) }} />
      )}
    </div>
  )
}
