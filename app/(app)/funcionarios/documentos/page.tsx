'use client'

// Modelos de documento dos funcionários (Política de Jornada, termos, comunicados).
// Cada linha é a versão atual de um modelo; as antigas ficam no histórico do editor.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Pencil, FileSignature, Loader2, Send, Users } from 'lucide-react'
import Topbar from '@/components/Topbar'
import { createClient } from '@/lib/supabase/client'
import { useAccess } from '@/lib/useAccess'
import { formatarData } from '@/lib/datas'
import { mensagemErro } from '@/lib/erros'
import type { DocModelo } from '@/lib/documentosFuncionario'

export default function DocumentosFuncionariosPage() {
  const router = useRouter()
  const { isAdmin, loading: accessLoading } = useAccess()
  const [modelos, setModelos] = useState<DocModelo[]>([])
  const [emitidosPorGrupo, setEmitidosPorGrupo] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)

  useEffect(() => {
    if (!accessLoading && !isAdmin) router.replace('/obras')
  }, [isAdmin, accessLoading, router])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data, error }, { data: emitidos }] = await Promise.all([
        supabase.from('doc_modelos').select('*').eq('atual', true).order('nome'),
        supabase.from('doc_emitidos').select('modelo:modelo_id(grupo_id)'),
      ])
      if (error) setErro(`${mensagemErro(error, 'Erro ao carregar os modelos')} Confira se a migração 2026_10_30_documentos_funcionarios.sql já foi rodada.`)
      setModelos((data ?? []) as DocModelo[])
      const cont: Record<string, number> = {}
      for (const e of (emitidos ?? []) as unknown as { modelo: { grupo_id: string } | null }[]) {
        const g = e.modelo?.grupo_id
        if (g) cont[g] = (cont[g] ?? 0) + 1
      }
      setEmitidosPorGrupo(cont)
      setLoading(false)
    }
    load()
  }, [])

  const visiveis = modelos.filter(m => mostrarInativos || m.ativo)

  return (
    <div>
      <Topbar />
      <div className="p-4 md:p-6 max-w-5xl">
        <Link href="/funcionarios" className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A] mb-3">
          <ArrowLeft size={15} /> Funcionários
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="font-syne text-xl md:text-2xl font-bold text-[#0F172A]">Documentos dos funcionários</h1>
            <p className="text-xs md:text-sm text-[#64748B] mt-0.5">Modelos com nome, CPF e cargo preenchidos pelo cadastro</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/funcionarios/documentos/modelo/novo"
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] transition-colors font-medium whitespace-nowrap">
              <Plus size={15} /> Novo modelo
            </Link>
            <Link href="/funcionarios/documentos/emitir" className="btn-primary flex items-center gap-2 text-sm whitespace-nowrap">
              <Send size={15} /> Emitir documento
            </Link>
          </div>
        </div>

        {erro && <p className="text-sm text-[#EF4444] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3 py-2 mb-4">{erro}</p>}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#4F7CFF]" /></div>
        ) : visiveis.length === 0 && !erro ? (
          <div className="card text-center py-12">
            <FileSignature size={28} className="mx-auto text-[#CBD5E1] mb-2" />
            <p className="text-sm text-[#64748B]">Nenhum modelo cadastrado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visiveis.map(m => (
              <div key={m.id} className={`card flex flex-col sm:flex-row sm:items-center gap-3 ${m.ativo ? '' : 'opacity-60'}`}>
                <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0">
                  <FileSignature size={18} className="text-[#4F7CFF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#0F172A]">{m.nome} <span className="text-[#64748B] font-normal">v{m.versao}</span></p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-[#64748B]">
                    {m.vigencia && <span>Vigente desde {formatarData(m.vigencia)}</span>}
                    <span className={m.exige_assinatura ? 'text-[#B45309]' : ''}>{m.exige_assinatura ? 'Exige assinatura' : 'Sem assinatura do funcionário'}</span>
                    {m.coletivo && <span className="inline-flex items-center gap-1"><Users size={11} /> Coletivo, com lista de recebimento</span>}
                    <span>{emitidosPorGrupo[m.grupo_id] ?? 0} emitido(s)</span>
                    {!m.ativo && <span className="text-[#EF4444]">Inativo</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/funcionarios/documentos/modelo/${m.id}`}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]">
                    <Pencil size={13} /> Editar
                  </Link>
                  {m.ativo && (
                    <Link href={`/funcionarios/documentos/emitir?modelo=${m.id}`}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-[#EEF2FF] text-[#4F7CFF] font-medium hover:bg-[#E0E7FF]">
                      <Send size={13} /> Emitir
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {modelos.some(m => !m.ativo) && (
          <button onClick={() => setMostrarInativos(v => !v)} className="text-xs text-[#64748B] hover:text-[#0F172A] mt-4">
            {mostrarInativos ? 'Esconder modelos inativos' : 'Mostrar modelos inativos'}
          </button>
        )}
      </div>
    </div>
  )
}
