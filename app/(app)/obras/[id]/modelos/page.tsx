'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, X, Loader2, Upload, Check, ChevronDown, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface RDOModelo {
  id: string
  obra_id: string
  nome: string
  logo_empresa_url?: string
  logo_empresa_path?: string
  logo_relatorio_url?: string
  logo_relatorio_path?: string
  logo_relatorio2_url?: string
  logo_relatorio2_path?: string
  itens: string[]
  tipo_assinatura: 'manual' | 'digital'
  assinaturas: string[]
  ativo: boolean
  created_at: string
}

const ITENS_DISPONIVEIS = [
  { key: 'clima', label: 'Condição climática' },
  { key: 'mao_obra', label: 'Mão de obra' },
  { key: 'equipamento', label: 'Equipamento' },
  { key: 'atividade', label: 'Atividade' },
  { key: 'ocorrencia', label: 'Ocorrência' },
  { key: 'comentario', label: 'Comentário' },
  { key: 'foto', label: 'Foto' },
  { key: 'assinatura', label: 'Assinatura' },
]

const DEFAULT_ITENS = ['clima', 'mao_obra', 'equipamento', 'atividade', 'ocorrencia', 'comentario', 'foto', 'assinatura']
const DEFAULT_ASSINATURAS = ['MARV', 'Cliente', 'Fiscal']

export default function ModelosPage() {
  const { id: obraId } = useParams<{ id: string }>()
  const router = useRouter()
  const [modelos, setModelos] = useState<RDOModelo[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<RDOModelo | null>(null)
  const [criando, setCriando] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState<string | null>(null)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('rdo_modelos').select('*').eq('obra_id', obraId).order('created_at')
    setModelos((data as RDOModelo[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [obraId])

  function novoModelo(): RDOModelo {
    return {
      id: '',
      obra_id: obraId,
      nome: 'Relatório Diário de Obra (RDO)',
      itens: DEFAULT_ITENS,
      tipo_assinatura: 'manual',
      assinaturas: DEFAULT_ASSINATURAS,
      ativo: true,
      created_at: '',
    }
  }

  async function salvar(modelo: RDOModelo) {
    setSaving(true)
    const supabase = createClient()
    const payload = {
      obra_id: obraId,
      nome: modelo.nome,
      logo_empresa_url: modelo.logo_empresa_url ?? null,
      logo_empresa_path: modelo.logo_empresa_path ?? null,
      logo_relatorio_url: modelo.logo_relatorio_url ?? null,
      logo_relatorio_path: modelo.logo_relatorio_path ?? null,
      logo_relatorio2_url: modelo.logo_relatorio2_url ?? null,
      logo_relatorio2_path: modelo.logo_relatorio2_path ?? null,
      itens: modelo.itens,
      tipo_assinatura: modelo.tipo_assinatura,
      assinaturas: modelo.assinaturas,
      ativo: modelo.ativo,
    }
    if (modelo.id) {
      await supabase.from('rdo_modelos').update(payload).eq('id', modelo.id)
    } else {
      await supabase.from('rdo_modelos').insert(payload)
    }
    await load()
    setEditando(null)
    setCriando(false)
    setSaving(false)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este modelo?')) return
    const supabase = createClient()
    await supabase.from('rdo_modelos').delete().eq('id', id)
    setModelos(prev => prev.filter(m => m.id !== id))
  }

  async function uploadLogo(campo: 'empresa' | 'relatorio' | 'relatorio2', file: File, modelo: RDOModelo, setModelo: (m: RDOModelo) => void) {
    setUploadingLogo(campo)
    const supabase = createClient()
    const path = `modelos/${obraId}/${campo}_${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('documentos').getPublicUrl(path)
      if (campo === 'empresa') setModelo({ ...modelo, logo_empresa_url: data.publicUrl, logo_empresa_path: path })
      if (campo === 'relatorio') setModelo({ ...modelo, logo_relatorio_url: data.publicUrl, logo_relatorio_path: path })
      if (campo === 'relatorio2') setModelo({ ...modelo, logo_relatorio2_url: data.publicUrl, logo_relatorio2_path: path })
    }
    setUploadingLogo(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 size={28} className="animate-spin text-[#4F7CFF]" />
    </div>
  )

  const modeloParaEditar = editando ?? (criando ? novoModelo() : null)

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <header className="h-14 bg-white border-b border-[#E2E8F0] flex items-center px-4 gap-3 sticky top-14 md:top-0 z-20">
        <Link href={`/obras/${obraId}?tab=relatorios`} className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A]">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="font-syne font-semibold text-[#0F172A] text-sm flex-1">Personalizar Relatórios</h1>
        <button onClick={() => { setCriando(true); setEditando(null) }}
          className="btn-primary text-sm flex items-center gap-1.5">
          <Plus size={15} /> Novo modelo
        </button>
      </header>

      <div className="flex-1 p-4 md:p-6 max-w-3xl mx-auto w-full space-y-4">

        {modelos.length === 0 && !criando && (
          <div className="card text-center py-16">
            <p className="font-medium text-[#374151]">Nenhum modelo ainda</p>
            <p className="text-sm text-[#94A3B8] mt-1 mb-4">Crie um modelo para personalizar seus relatórios</p>
            <button onClick={() => setCriando(true)} className="btn-primary mx-auto text-sm">
              <Plus size={14} /> Criar primeiro modelo
            </button>
          </div>
        )}

        {/* Lista de modelos existentes */}
        {modelos.map(m => (
          <div key={m.id} className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {m.ativo ? 'Ativo' : 'Inativo'}
                </span>
                <h3 className="font-syne font-semibold text-sm text-[#0F172A]">{m.nome}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setEditando(m); setCriando(false) }}
                  className="text-[#64748B] hover:text-[#4F7CFF] p-1.5 rounded hover:bg-[#EEF2FF] transition-colors">
                  <Pencil size={14} />
                </button>
                <button onClick={() => excluir(m.id)}
                  className="text-[#94A3B8] hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Preview logos */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              {[
                { url: m.logo_empresa_url, label: 'Logomarca Empresa' },
                { url: m.logo_relatorio_url, label: 'Logomarca Relatório' },
                { url: m.logo_relatorio2_url, label: 'Logomarca Relatório 2' },
              ].map(({ url, label }) => (
                <div key={label} className="border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] aspect-video flex items-center justify-center overflow-hidden">
                  {url
                    ? <img src={url} alt={label} className="w-full h-full object-contain p-1" />
                    : <p className="text-[10px] text-[#94A3B8] text-center px-1">{label}</p>
                  }
                </div>
              ))}
            </div>

            <div className="text-xs text-[#64748B]">
              <span className="font-medium text-[#374151]">Itens: </span>
              {m.itens.map(i => ITENS_DISPONIVEIS.find(d => d.key === i)?.label ?? i).join(', ')}
            </div>
            <div className="text-xs text-[#64748B] mt-1">
              <span className="font-medium text-[#374151]">Assinaturas: </span>
              {m.assinaturas.join(', ')}
            </div>
          </div>
        ))}

        {/* Formulário de criação/edição */}
        {modeloParaEditar && (
          <ModeloForm
            inicial={modeloParaEditar}
            obraId={obraId}
            saving={saving}
            uploadingLogo={uploadingLogo}
            onSalvar={salvar}
            onCancelar={() => { setEditando(null); setCriando(false) }}
            onUploadLogo={uploadLogo}
          />
        )}
      </div>
    </div>
  )
}

function ModeloForm({ inicial, obraId, saving, uploadingLogo, onSalvar, onCancelar, onUploadLogo }: {
  inicial: RDOModelo
  obraId: string
  saving: boolean
  uploadingLogo: string | null
  onSalvar: (m: RDOModelo) => void
  onCancelar: () => void
  onUploadLogo: (campo: 'empresa' | 'relatorio' | 'relatorio2', file: File, modelo: RDOModelo, setModelo: (m: RDOModelo) => void) => void
}) {
  const [modelo, setModelo] = useState<RDOModelo>(inicial)
  const [novaAss, setNovaAss] = useState('')

  function toggleItem(key: string) {
    setModelo(m => ({
      ...m,
      itens: m.itens.includes(key) ? m.itens.filter(i => i !== key) : [...m.itens, key]
    }))
  }

  function addAssinatura() {
    if (!novaAss.trim()) return
    setModelo(m => ({ ...m, assinaturas: [...m.assinaturas, novaAss.trim()] }))
    setNovaAss('')
  }

  function removeAssinatura(idx: number) {
    setModelo(m => ({ ...m, assinaturas: m.assinaturas.filter((_, i) => i !== idx) }))
  }

  return (
    <div className="card border-2 border-[#4F7CFF]">
      <h3 className="font-syne font-semibold text-[#0F172A] mb-4">
        {inicial.id ? 'Editar modelo' : 'Novo modelo'}
      </h3>

      {/* Nome */}
      <div className="mb-4">
        <label className="text-xs font-medium text-[#64748B] mb-1 block">Nome do modelo</label>
        <input className="field" value={modelo.nome} onChange={e => setModelo(m => ({ ...m, nome: e.target.value }))} />
      </div>

      {/* Status */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-xs font-medium text-[#64748B]">Status</label>
        <button onClick={() => setModelo(m => ({ ...m, ativo: !m.ativo }))}
          className={`text-xs font-semibold px-3 py-1 rounded-full ${modelo.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
          {modelo.ativo ? 'Ativo' : 'Inativo'}
        </button>
      </div>

      {/* Logos */}
      <div className="mb-4">
        <label className="text-xs font-medium text-[#64748B] mb-2 block">Logomarcas</label>
        <div className="grid grid-cols-3 gap-3">
          {([
            { campo: 'empresa' as const, label: 'Logomarca Empresa' },
            { campo: 'relatorio' as const, label: 'Logomarca Relatório' },
            { campo: 'relatorio2' as const, label: 'Logomarca Relatório 2' },
          ]).map(({ campo, label }) => {
            const url = campo === 'empresa' ? modelo.logo_empresa_url : campo === 'relatorio' ? modelo.logo_relatorio_url : modelo.logo_relatorio2_url
            return (
              <label key={campo} className="cursor-pointer group">
                <div className="border-2 border-dashed border-[#E2E8F0] rounded-lg aspect-video flex items-center justify-center overflow-hidden hover:border-[#4F7CFF] transition-colors relative">
                  {uploadingLogo === campo
                    ? <Loader2 size={18} className="animate-spin text-[#4F7CFF]" />
                    : url
                      ? <>
                          <img src={url} alt={label} className="w-full h-full object-contain p-1" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Upload size={16} className="text-white" />
                          </div>
                        </>
                      : <div className="text-center p-2">
                          <Upload size={14} className="text-[#94A3B8] mx-auto mb-1" />
                          <p className="text-[10px] text-[#94A3B8]">{label}</p>
                        </div>
                  }
                </div>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) onUploadLogo(campo, f, modelo, setModelo) }} />
              </label>
            )
          })}
        </div>
      </div>

      {/* Itens */}
      <div className="mb-4">
        <label className="text-xs font-medium text-[#64748B] mb-2 block">Itens do relatório</label>
        <div className="grid grid-cols-2 gap-2">
          {ITENS_DISPONIVEIS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={modelo.itens.includes(key)} onChange={() => toggleItem(key)} className="rounded" />
              <span className="text-sm text-[#374151]">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Tipo de assinatura */}
      <div className="mb-4">
        <label className="text-xs font-medium text-[#64748B] mb-2 block">Tipo de assinatura</label>
        <div className="flex gap-4">
          {(['manual', 'digital'] as const).map(t => (
            <label key={t} className="flex items-center gap-2 cursor-pointer text-sm text-[#374151]">
              <input type="radio" name="tipo_assinatura" value={t} checked={modelo.tipo_assinatura === t}
                onChange={() => setModelo(m => ({ ...m, tipo_assinatura: t }))} />
              {t === 'manual' ? 'Assinatura manual' : 'Assinatura digital'}
            </label>
          ))}
        </div>
      </div>

      {/* Assinaturas */}
      <div className="mb-6">
        <label className="text-xs font-medium text-[#64748B] mb-2 block">Assinaturas necessárias</label>
        <div className="space-y-2 mb-2">
          {modelo.assinaturas.map((a, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-[#F8FAFC] rounded-lg">
              <span className="flex-1 text-sm text-[#374151]">{a}</span>
              <button onClick={() => removeAssinatura(i)} className="text-[#94A3B8] hover:text-red-500"><X size={13} /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="field text-sm flex-1" placeholder="Ex: Engenheiro responsável"
            value={novaAss} onChange={e => setNovaAss(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addAssinatura()} />
          <button onClick={addAssinatura} className="px-3 py-2 bg-[#EEF2FF] text-[#4F7CFF] rounded-lg text-sm hover:bg-[#4F7CFF] hover:text-white transition-colors">
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => onSalvar(modelo)} disabled={saving || !modelo.nome.trim()}
          className="btn-primary flex items-center gap-2">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {inicial.id ? 'Salvar alterações' : 'Criar modelo'}
        </button>
        <button onClick={onCancelar} className="text-sm text-[#64748B] hover:text-[#374151] px-3 py-2">Cancelar</button>
      </div>
    </div>
  )
}
