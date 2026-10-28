'use client'

import { useEffect, useState } from 'react'
import { XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ContratoManutencao } from '@/lib/types'
import { mensagemErro } from '@/lib/erros'
import { parseNumeroBR } from '@/lib/numero'

// Formulário de contrato de manutenção (criar e editar) — usado na lista e no detalhe do contrato

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

export default function ModalContrato({ contrato, onClose, onSaved }: ModalContratoProps) {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [form, setForm] = useState<FormContrato>(contrato ? {
    empresa_id: (contrato.empresa as any)?.id ?? contrato.empresa_id ?? '',
    numero_contrato: contrato.numero_contrato ?? '',
    valor_mensal: String(contrato.valor_mensal).replace('.', ','),
    data_inicio: contrato.data_inicio,
    observacoes: contrato.observacoes ?? '',
    ativo: contrato.ativo,
  } : emptyForm())
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    createClient().from('empresas').select('id, razao_social, apelido').order('razao_social').then(({ data }) => setEmpresas(data ?? []))
  }, [])

  async function salvar() {
    const faltando = [!form.empresa_id && 'Empresa', !form.valor_mensal && 'Valor mensal', !form.data_inicio && 'Início do contrato'].filter(Boolean)
    if (faltando.length) { setErro(`Preencha: ${faltando.join(', ')}.`); return }
    const valor = parseNumeroBR(form.valor_mensal)
    if (Number.isNaN(valor)) { setErro('Valor mensal inválido.'); return }
    setSalvando(true)
    setErro('')
    const payload = {
      empresa_id: form.empresa_id,
      numero_contrato: form.numero_contrato || null,
      valor_mensal: valor,
      data_inicio: form.data_inicio,
      observacoes: form.observacoes || null,
      ativo: form.ativo,
    }
    const { error } = contrato
      ? await createClient().from('contratos_manutencao').update(payload).eq('id', contrato.id)
      : await createClient().from('contratos_manutencao').insert(payload)
    setSalvando(false)
    if (error) { setErro(mensagemErro(error, 'Erro ao salvar contrato')); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">{contrato ? 'Editar Contrato' : 'Novo Contrato de Manutenção'}</h2>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9]">
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
              <input type="text" inputMode="decimal" className="field text-sm" placeholder="0,00" value={form.valor_mensal} onChange={e => setForm(f => ({ ...f, valor_mensal: e.target.value }))} />
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
          {erro && <p className="text-xs text-red-500">{erro}</p>}
        </div>
        <div className="px-6 pb-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#64748B] hover:bg-[#F1F5F9] rounded-lg">Cancelar</button>
          <button onClick={salvar} disabled={salvando}
            className="px-4 py-2 text-sm font-medium bg-[#4F7CFF] text-white rounded-lg hover:bg-[#3D68F0] disabled:opacity-50">
            {salvando ? 'Salvando...' : contrato ? 'Salvar' : 'Criar Contrato'}
          </button>
        </div>
      </div>
    </div>
  )
}
