'use client'

import { useEffect, useState } from 'react'
import { User, Building2, Bell, Shield, Save, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="font-syne font-bold text-2xl text-[#0F172A] mb-8">Configurações</h1>

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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Razão Social</label>
                <input className="field" value={empresa.razao_social} onChange={e => setEmpresa(p => ({ ...p, razao_social: e.target.value }))} placeholder="MARV Serviços Ltda." />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">CNPJ</label>
                <input className="field" value={empresa.cnpj} onChange={e => setEmpresa(p => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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

        {/* Segurança */}
        <section className="card">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF7ED] flex items-center justify-center">
              <Shield size={18} className="text-[#F97316]" />
            </div>
            <h2 className="font-syne font-semibold text-[#0F172A]">Segurança</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-b border-[#F1F5F9]">
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
            <div className="flex items-center justify-between py-3">
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
