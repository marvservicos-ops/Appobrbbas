'use client'

import { useEffect, useState } from 'react'
import { User, Building2, Bell, Shield, Save, Loader2, Check, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface RegraExtra {
  chave: string
  descricao: string
  valor: { percentual: number }
}

function SecaoExtras() {
  const [regras, setRegras] = useState<RegraExtra[]>([])
  const [editando, setEditando] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    createClient()
      .from('configuracoes_empresa')
      .select('chave, descricao, valor')
      .like('chave', 'adicional_%')
      .order('chave')
      .then(({ data }) => {
        if (data) {
          setRegras(data as RegraExtra[])
          const init: Record<string, string> = {}
          for (const r of data as RegraExtra[]) init[r.chave] = String(r.valor.percentual)
          setEditando(init)
        }
      })
  }, [])

  async function salvarRegra(chave: string) {
    const pct = parseFloat(editando[chave])
    if (isNaN(pct) || pct < 0) return
    setSalvando(chave)
    await createClient()
      .from('configuracoes_empresa')
      .update({ valor: { percentual: pct }, updated_at: new Date().toISOString() })
      .eq('chave', chave)
    setSalvando(null)
    setSaved(chave)
    setTimeout(() => setSaved(null), 2000)
  }

  async function adicionarRegra() {
    const chave = `adicional_custom_${Date.now()}`
    const { data } = await createClient()
      .from('configuracoes_empresa')
      .insert({ chave, descricao: 'Nova regra', valor: { percentual: 0 } })
      .select()
      .single()
    if (data) {
      setRegras(r => [...r, data as RegraExtra])
      setEditando(e => ({ ...e, [chave]: '0' }))
    }
  }

  async function removerRegra(chave: string) {
    if (!confirm('Remover esta regra?')) return
    await createClient().from('configuracoes_empresa').delete().eq('chave', chave)
    setRegras(r => r.filter(x => x.chave !== chave))
  }

  async function salvarDescricao(chave: string, descricao: string) {
    await createClient().from('configuracoes_empresa').update({ descricao }).eq('chave', chave)
    setRegras(r => r.map(x => x.chave === chave ? { ...x, descricao } : x))
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
            <Clock size={18} className="text-violet-600" />
          </div>
          <div>
            <h2 className="font-syne font-semibold text-[#0F172A]">Adicionais de Mão de Obra</h2>
            <p className="text-xs text-[#94A3B8]">Percentuais aplicados sobre o custo/hora do funcionário</p>
          </div>
        </div>
        <button onClick={adicionarRegra}
          className="text-xs text-[#4F7CFF] hover:text-blue-700 font-medium px-3 py-1.5 border border-[#C7D2FE] rounded-lg hover:bg-[#EEF2FF] transition-colors">
          + Adicionar
        </button>
      </div>

      <div className="space-y-3">
        {regras.map(r => (
          <div key={r.chave} className="flex items-center gap-3 p-3 bg-[#F8FAFC] rounded-xl">
            <div className="flex-1 min-w-0">
              <input
                className="text-sm font-medium text-[#374151] bg-transparent border-b border-transparent hover:border-[#E2E8F0] focus:border-[#4F7CFF] focus:outline-none w-full pb-0.5"
                defaultValue={r.descricao}
                onBlur={e => { if (e.target.value !== r.descricao) salvarDescricao(r.chave, e.target.value) }}
              />
              <p className="text-xs text-[#94A3B8] mt-0.5">Custo hora × (1 + {editando[r.chave] ?? r.valor.percentual}%)</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 bg-white border border-[#E2E8F0] rounded-lg px-2 py-1.5">
                <input
                  type="number" min="0" max="500" step="5"
                  className="w-14 text-sm font-semibold text-[#0F172A] text-right bg-transparent outline-none"
                  value={editando[r.chave] ?? r.valor.percentual}
                  onChange={e => setEditando(ed => ({ ...ed, [r.chave]: e.target.value }))}
                />
                <span className="text-sm text-[#64748B]">%</span>
              </div>
              <button onClick={() => salvarRegra(r.chave)} disabled={salvando === r.chave}
                className="p-1.5 rounded-lg bg-[#4F7CFF] text-white hover:bg-blue-600 transition-colors">
                {salvando === r.chave ? <Loader2 size={13} className="animate-spin" /> : saved === r.chave ? <Check size={13} /> : <Save size={13} />}
              </button>
              <button onClick={() => removerRegra(r.chave)}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-colors text-xs font-bold">
                ×
              </button>
            </div>
          </div>
        ))}
        {regras.length === 0 && (
          <p className="text-xs text-[#94A3B8] text-center py-4">Nenhuma regra cadastrada. Clique em "+ Adicionar" para criar.</p>
        )}
      </div>
    </section>
  )
}

export default function ConfiguracoesPage() {
  const [perfil, setPerfil] = useState({ nome: '', email: '', cargo: '' })
  const [empresa, setEmpresa] = useState({ razao_social: '', cnpj: '', telefone: '', endereco: '' })
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setPerfil(p => ({
          ...p,
          email: user.email ?? '',
          nome: user.user_metadata?.nome ?? user.user_metadata?.full_name ?? '',
          cargo: user.user_metadata?.cargo ?? '',
        }))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function salvarPerfil(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const supabase = createClient()
    await supabase.auth.updateUser({
      data: { nome: perfil.nome, cargo: perfil.cargo }
    })
    setSalvando(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 size={24} className="animate-spin text-[#4F7CFF]" />
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <h1 className="font-syne font-bold text-xl md:text-2xl text-[#0F172A] mb-6 md:mb-8">Configurações</h1>

      <div className="space-y-6">
        {/* Perfil */}
        <section className="card">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] flex items-center justify-center">
              <User size={18} className="text-[#4F7CFF]" />
            </div>
            <h2 className="font-syne font-semibold text-[#0F172A]">Meu Perfil</h2>
          </div>
          <form onSubmit={salvarPerfil} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome</label>
                <input className="field" value={perfil.nome} onChange={e => setPerfil(p => ({ ...p, nome: e.target.value }))} placeholder="Seu nome" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Cargo</label>
                <input className="field" value={perfil.cargo} onChange={e => setPerfil(p => ({ ...p, cargo: e.target.value }))} placeholder="Ex: Engenheiro, Técnico..." />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">E-mail</label>
              <input className="field bg-[#F8FAFC] text-[#94A3B8] cursor-not-allowed" value={perfil.email} readOnly />
              <p className="text-xs text-[#94A3B8] mt-1">O e-mail não pode ser alterado aqui.</p>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={salvando} className="btn-primary flex items-center gap-2">
                {salvando ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
                {salvando ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar perfil'}
              </button>
            </div>
          </form>
        </section>

        {/* Empresa */}
        <section className="card">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] flex items-center justify-center">
              <Building2 size={18} className="text-[#10B981]" />
            </div>
            <h2 className="font-syne font-semibold text-[#0F172A]">Dados da Empresa</h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Razão Social</label>
                <input className="field" value={empresa.razao_social} onChange={e => setEmpresa(p => ({ ...p, razao_social: e.target.value }))} placeholder="MARV Serviços Ltda." />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">CNPJ</label>
                <input className="field" value={empresa.cnpj} onChange={e => setEmpresa(p => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Telefone</label>
                <input className="field" value={empresa.telefone} onChange={e => setEmpresa(p => ({ ...p, telefone: e.target.value }))} placeholder="(11) 99999-9999" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Endereço</label>
                <input className="field" value={empresa.endereco} onChange={e => setEmpresa(p => ({ ...p, endereco: e.target.value }))} placeholder="Rua, número, cidade" />
              </div>
            </div>
            <p className="text-xs text-[#94A3B8]">Esses dados aparecem nos relatórios exportados.</p>
          </div>
        </section>

        {/* Adicionais Mão de Obra */}
        <SecaoExtras />

        {/* Segurança */}
        <section className="card">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF7ED] flex items-center justify-center">
              <Shield size={18} className="text-[#F97316]" />
            </div>
            <h2 className="font-syne font-semibold text-[#0F172A]">Segurança</h2>
          </div>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-[#F1F5F9]">
              <div>
                <p className="text-sm font-medium text-[#374151]">Senha</p>
                <p className="text-xs text-[#94A3B8]">Altere sua senha de acesso</p>
              </div>
              <button
                onClick={async () => {
                  const supabase = createClient()
                  const { data: { user } } = await supabase.auth.getUser()
                  if (user?.email) {
                    await supabase.auth.resetPasswordForEmail(user.email)
                    alert('Link de redefinição enviado para ' + user.email)
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-[#4F7CFF] border border-[#C7D2FE] rounded-lg hover:bg-[#EEF2FF] transition-colors">
                Enviar link de redefinição
              </button>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-[#374151]">Sair da conta</p>
                <p className="text-xs text-[#94A3B8]">Encerra a sessão atual</p>
              </div>
              <button
                onClick={async () => {
                  const supabase = createClient()
                  await supabase.auth.signOut()
                  window.location.href = '/login'
                }}
                className="px-4 py-2 text-sm font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                Sair
              </button>
            </div>
          </div>
        </section>

        {/* Leitor QR/Barcode */}
        <section className="card border-dashed border-[#E2E8F0]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#F8FAFC] flex items-center justify-center">
              <Bell size={18} className="text-[#64748B]" />
            </div>
            <h2 className="font-syne font-semibold text-[#0F172A]">Leitor de QR Code / Código de Barras</h2>
          </div>
          <p className="text-sm text-[#64748B] mb-3">
            Para usar um leitor de código de barras USB ou Bluetooth com o sistema, configure o leitor para o modo <strong>teclado HID</strong> (padrão de fábrica na maioria dos leitores). Ao escanear um produto na tela de Novo Registro, o código será automaticamente digitado no campo ativo.
          </p>
          <div className="bg-[#F8FAFC] rounded-xl p-4 text-sm text-[#374151] space-y-1.5">
            <p className="font-medium text-[#0F172A]">Como usar:</p>
            <p>1. Abra a tela <strong>Novo Registro</strong> do estoque desejado</p>
            <p>2. Clique no campo <strong>Produto</strong></p>
            <p>3. Aponte o leitor para o código de barras/QR do item</p>
            <p>4. O código será digitado automaticamente e buscará o produto cadastrado</p>
          </div>
        </section>
      </div>
    </div>
  )
}
