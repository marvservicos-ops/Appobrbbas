'use client'

import { useState } from 'react'
import { X, Pencil, Trash2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mensagemErro } from '@/lib/erros'

interface ModeloBase {
  id: string
  nome: string
}

interface Props {
  titulo: string
  tabela: 'pt_modelos' | 'apr_modelos'
  modelos: ModeloBase[]
  onClose: () => void
  onChanged: () => void
}

export default function ModalGerenciarModelos({ titulo, tabela, modelos, onClose, onChanged }: Props) {
  const [editId, setEditId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')

  async function renomear(id: string) {
    if (!editNome.trim()) return
    const { error } = await createClient().from(tabela).update({ nome: editNome.trim(), updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { alert(mensagemErro(error, 'Erro ao renomear o modelo')); return }
    setEditId(null)
    onChanged()
  }

  async function excluir(id: string) {
    const nome = modelos.find(m => m.id === id)?.nome
    if (!confirm(`Excluir o modelo "${nome ?? ''}"? Essa ação não pode ser desfeita.`)) return
    const { error } = await createClient().from(tabela).delete().eq('id', id)
    if (error) { alert(mensagemErro(error, 'Erro ao excluir o modelo')); return }
    onChanged()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[420px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-syne font-semibold text-[#0F172A] text-sm">{titulo}</h3>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9]">
            <X size={14} className="text-[#64748B]" />
          </button>
        </div>
        <div className="p-5 space-y-2 max-h-[400px] overflow-y-auto">
          {modelos.length === 0 && (
            <p className="text-sm text-[#94A3B8] text-center py-6">Nenhum modelo salvo ainda.</p>
          )}
          {modelos.map(m => (
            <div key={m.id} className="flex items-center gap-2 group">
              {editId === m.id ? (
                <>
                  <input
                    autoFocus
                    value={editNome}
                    onChange={e => setEditNome(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && renomear(m.id)}
                    className="flex-1 field text-sm py-1.5"
                  />
                  <button onClick={() => renomear(m.id)} aria-label="Salvar nome" title="Salvar nome" className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#4F7CFF] hover:bg-[#3D68F0]">
                    <Check size={13} className="text-white" />
                  </button>
                  <button onClick={() => setEditId(null)} aria-label="Cancelar" title="Cancelar" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9]">
                    <X size={13} className="text-[#64748B]" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-[#374151] py-1.5 px-2 rounded-lg group-hover:bg-[#F8FAFC]">{m.nome}</span>
                  <button onClick={() => { setEditId(m.id); setEditNome(m.nome) }} aria-label={`Renomear ${m.nome}`} title="Renomear" className="w-9 h-9 flex [@media(hover:hover)]:hidden [@media(hover:hover)]:group-hover:flex items-center justify-center rounded-lg hover:bg-[#EEF2FF]">
                    <Pencil size={14} className="text-[#4F7CFF]" />
                  </button>
                  <button onClick={() => excluir(m.id)} aria-label={`Excluir ${m.nome}`} title="Excluir" className="w-9 h-9 flex [@media(hover:hover)]:hidden [@media(hover:hover)]:group-hover:flex items-center justify-center rounded-lg hover:bg-red-50">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
