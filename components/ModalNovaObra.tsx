'use client'

import { useState } from 'react'
import { X, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Cliente, TipoServico, StatusObra } from '@/lib/types'

interface Props {
  clientes: Cliente[]
  onClose: () => void
  onCreated: () => void
}

const tiposServico: TipoServico[] = ['HVAC', 'Elétrico', 'Hidráulico', 'Civil']
const statusOpcoes: StatusObra[] = ['Em Planejamento', 'Em Andamento', 'Paralisada', 'Concluída']

export default function ModalNovaObra({ clientes, onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    titulo: '',
    cliente_id: '',
    tipo_servico: 'HVAC' as TipoServico,
    status: 'Em Planejamento' as StatusObra,
    engenheiro_responsavel: '',
    numero_contrato: '',
    endereco: '',
    valor_estimado: '',
    data_inicio: '',
    previsao_termino: '',
    descricao: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.from('obras').insert({
      titulo: form.titulo,
      cliente_id: form.cliente_id || null,
      tipo_servico: form.tipo_servico,
      status: form.status,
      engenheiro_responsavel: form.engenheiro_responsavel || null,
      numero_contrato: form.numero_contrato || null,
      endereco: form.endereco || null,
      valor_estimado: form.valor_estimado ? parseFloat(form.valor_estimado) : null,
      data_inicio: form.data_inicio || null,
      previsao_termino: form.previsao_termino || null,
      descricao: form.descricao || null,
    })
    if (error) { setError(error.message); setLoading(false); return }
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#EEF2FF] rounded-lg flex items-center justify-center">
              <Wrench size={16} className="text-[#4F7CFF]" />
            </div>
            <h2 className="font-syne font-semibold text-[#0F172A]">Nova Obra</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] transition-colors">
            <X size={16} className="text-[#64748B]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Título */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Título do Projeto *</label>
              <input
                required
                type="text"
                placeholder="Ex: Manutenção Chiller Prédio A"
                value={form.titulo}
                onChange={e => set('titulo', e.target.value)}
                className="field"
              />
            </div>

            {/* Cliente */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Cliente</label>
              <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)} className="field">
                <option value="">Selecione um cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Tipo do Serviço</label>
              <select value={form.tipo_servico} onChange={e => set('tipo_servico', e.target.value)} className="field">
                {tiposServico.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Status Inicial</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="field">
                {statusOpcoes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Engenheiro */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Engenheiro Responsável</label>
              <input type="text" placeholder="Nome do responsável" value={form.engenheiro_responsavel} onChange={e => set('engenheiro_responsavel', e.target.value)} className="field" />
            </div>

            {/* Contrato */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Nº do Contrato</label>
              <input type="text" placeholder="0000/2024" value={form.numero_contrato} onChange={e => set('numero_contrato', e.target.value)} className="field" />
            </div>

            {/* Endereço */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Endereço da Obra</label>
              <input type="text" placeholder="Rua, Número, Bairro, Cidade – UF" value={form.endereco} onChange={e => set('endereco', e.target.value)} className="field" />
            </div>

            {/* Valor */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Valor Estimado</label>
              <input type="number" placeholder="R$ 0,00" value={form.valor_estimado} onChange={e => set('valor_estimado', e.target.value)} className="field" />
            </div>

            {/* Data inicio */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Data Início</label>
              <input type="date" value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)} className="field" />
            </div>

            {/* Data fim */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Previsão Término</label>
              <input type="date" value={form.previsao_termino} onChange={e => set('previsao_termino', e.target.value)} className="field" />
            </div>

            {/* Descrição */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Descrição e Escopo</label>
              <textarea
                rows={3}
                placeholder="Detalhes técnicos sobre a execução da obra..."
                value={form.descricao}
                onChange={e => set('descricao', e.target.value)}
                className="field resize-none"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#E2E8F0]">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-5 py-2 bg-[#4F7CFF] hover:bg-[#3D68F0] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
              {loading ? 'Salvando...' : 'Salvar Obra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
