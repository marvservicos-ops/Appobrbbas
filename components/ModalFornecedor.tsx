'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mensagemErro } from '@/lib/erros'
import { type Fornecedor, formatarDocumento, somenteDigitos } from '@/lib/fornecedores'

// Cadastro e edição de fornecedor. `nomeInicial` vem do cadastro rápido
// (o que foi digitado na busca de fornecedor).
export default function ModalFornecedor({ fornecedor, nomeInicial, onClose, onSaved }: {
  fornecedor: Fornecedor | null
  nomeInicial?: string
  onClose: () => void
  onSaved: (f: Fornecedor) => void
}) {
  const [nome, setNome] = useState(fornecedor?.nome ?? nomeInicial ?? '')
  const [fantasia, setFantasia] = useState(fornecedor?.nome_fantasia ?? '')
  const [cnpj, setCnpj] = useState(formatarDocumento(fornecedor?.cnpj))
  const [telefone, setTelefone] = useState(fornecedor?.telefone ?? '')
  const [email, setEmail] = useState(fornecedor?.email ?? '')
  const [observacao, setObservacao] = useState(fornecedor?.observacao ?? '')
  const [ativo, setAtivo] = useState(fornecedor?.ativo ?? true)
  const [saving, setSaving] = useState(false)

  async function salvar() {
    const doc = somenteDigitos(cnpj)
    if (!nome.trim()) return
    if (doc && doc.length !== 14 && doc.length !== 11) { alert('O CNPJ precisa ter 14 dígitos (ou 11, se for CPF).'); return }
    setSaving(true)
    const sb = createClient()
    const payload = {
      nome: nome.trim(),
      nome_fantasia: fantasia.trim() || null,
      cnpj: doc || null,
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      observacao: observacao.trim() || null,
      ativo,
    }
    const { data, error } = fornecedor
      ? await sb.from('fornecedores').update(payload).eq('id', fornecedor.id).select().single()
      : await sb.from('fornecedores').insert(payload).select().single()
    setSaving(false)
    if (error) {
      alert(error.code === '23505' ? 'Já existe um fornecedor com este CNPJ.' : mensagemErro(error, 'Erro ao salvar o fornecedor'))
      return
    }
    onSaved(data as Fornecedor)
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="font-syne font-semibold text-[#0F172A]">{fornecedor ? 'Editar fornecedor' : 'Novo fornecedor'}</h2>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -mr-2"><X size={16} className="text-[#64748B]" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Razão social *</label>
            <input className="field" value={nome} onChange={e => setNome(e.target.value)} placeholder="Como aparece na NF e no DDA" autoFocus />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Nome fantasia</label>
              <input className="field" value={fantasia} onChange={e => setFantasia(e.target.value)} placeholder="Como a equipe chama" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">CNPJ</label>
              <input className="field font-mono" inputMode="numeric" value={cnpj} onChange={e => setCnpj(formatarDocumento(e.target.value))} placeholder="00.000.000/0000-00" />
            </div>
          </div>
          <p className="text-[11px] text-[#94A3B8] -mt-2">O DDA identifica o beneficiário pelo CNPJ — com ele a conferência fica mais segura.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Telefone</label>
              <input className="field" inputMode="tel" value={telefone} onChange={e => setTelefone(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">E-mail</label>
              <input className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Observação</label>
            <input className="field" value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex: vendedor, condição de pagamento..." />
          </div>
          {fornecedor && (
            <label className="flex items-center gap-2 text-sm text-[#374151]">
              <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="w-4 h-4 accent-[#4F7CFF]" />
              Ativo (inativo some da lista ao lançar notas)
            </label>
          )}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9]">Cancelar</button>
            <button onClick={salvar} disabled={saving || !nome.trim()}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
