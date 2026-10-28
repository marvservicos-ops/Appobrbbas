'use client'

import { useEffect, useState } from 'react'
import { Check, Eye, EyeOff, KeyRound, Loader2, Pencil, Plus, ShieldCheck, UserRound, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { AppProfile, AppRole } from '@/lib/access'
import { mensagemErro } from '@/lib/erros'

const PERMISSOES = [{ id: 'financeiro', label: 'Financeiro e medições' }]

export default function AdminUsuariosPage() {
  const [profiles, setProfiles] = useState<AppProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [newUser, setNewUser] = useState({ nome: '', email: '', password: '', role: 'usuario' as AppRole, financeiro: false })
  const [loadError, setLoadError] = useState('')
  // Edição de nome/e-mail e definição de senha (um usuário por vez)
  const [editando, setEditando] = useState<{ id: string; nome: string; email: string } | null>(null)
  const [senhaPara, setSenhaPara] = useState<{ id: string; senha: string } | null>(null)
  const [editError, setEditError] = useState('')

  async function load() {
    const supabase = createClient()
    const { data, error } = await supabase.from('app_profiles').select('*').order('email')
    if (error) setLoadError(mensagemErro(error, 'Não foi possível carregar os usuários'))
    else { setLoadError(''); setProfiles((data ?? []) as AppProfile[]) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const nomeDe = (p: AppProfile) => p.nome || p.email

  // Perfil e permissões: o RLS deixa o admin gravar direto em app_profiles
  async function update(profile: AppProfile, changes: Partial<AppProfile>) {
    if (changes.role === 'usuario' && profile.role === 'admin' &&
      !confirm(`Rebaixar ${nomeDe(profile)} para Usuário?\n\nEle perde o acesso à administração (usuários, financeiro geral, configurações da empresa).`)) return
    if (changes.role === 'admin' && profile.role !== 'admin' &&
      !confirm(`Tornar ${nomeDe(profile)} Administrador?\n\nEle terá acesso a tudo, inclusive usuários e financeiro.`)) return
    setSaving(profile.id)
    const next = { ...profile, ...changes }
    const supabase = createClient()
    const { error } = await supabase.from('app_profiles').update({ role: next.role, permissions: next.permissions }).eq('id', profile.id)
    if (!error) setProfiles(list => list.map(p => p.id === profile.id ? next : p))
    else alert(mensagemErro(error, 'Não foi possível salvar'))
    setSaving(null)
  }

  // Bloquear/desbloquear, nome/e-mail e senha passam pela API (precisa do Auth admin)
  async function patchUsuario(id: string, dados: Record<string, unknown>): Promise<string | null> {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...dados }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return json.error || 'Não foi possível salvar. Tente de novo.'
      if (json.user) setProfiles(list => list.map(p => p.id === id ? { ...p, ...json.user } : p))
      return null
    } catch (e) {
      return mensagemErro(e as Error, 'Não foi possível salvar')
    }
  }

  async function alternarBloqueio(profile: AppProfile) {
    const bloquear = profile.active
    const ok = confirm(bloquear
      ? `Bloquear ${nomeDe(profile)}?\n\nA pessoa sai do sistema na hora e não consegue mais entrar até ser desbloqueada.`
      : `Desbloquear ${nomeDe(profile)}?\n\nA pessoa volta a conseguir entrar com a senha dela.`)
    if (!ok) return
    setSaving(profile.id)
    const erro = await patchUsuario(profile.id, { active: !profile.active })
    if (erro) alert(erro)
    setSaving(null)
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault()
    if (!editando) return
    setSaving(editando.id); setEditError('')
    const erro = await patchUsuario(editando.id, { nome: editando.nome, email: editando.email })
    setSaving(null)
    if (erro) setEditError(erro)
    else setEditando(null)
  }

  async function salvarSenha(e: React.FormEvent) {
    e.preventDefault()
    if (!senhaPara) return
    setSaving(senhaPara.id); setEditError('')
    const erro = await patchUsuario(senhaPara.id, { password: senhaPara.senha })
    setSaving(null)
    if (erro) setEditError(erro)
    else { setSenhaPara(null); alert('Senha definida. Informe a nova senha à pessoa.') }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: newUser.nome,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        permissions: newUser.financeiro ? ['financeiro'] : [],
      }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) setCreateError(result.error || 'Não foi possível criar o usuário.')
    else {
      setShowNew(false)
      setNewUser({ nome: '', email: '', password: '', role: 'usuario', financeiro: false })
      await load()
    }
    setCreating(false)
  }

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-[#4F7CFF]" /></div>

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4F7CFF]">Acesso</p>
          <h1 className="font-syne text-2xl md:text-3xl font-bold text-[#0F172A] mt-1">Usuários e permissões</h1>
          <p className="text-sm text-[#64748B] mt-1">Crie acessos e defina quem pode visualizar informações financeiras.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary shrink-0"><Plus size={16} /> Novo usuário</button>
      </div>
      {showNew && (
        <form onSubmit={createUser} className="card mb-5 border-[#C7D2FE] shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div><h2 className="font-syne font-semibold text-[#0F172A]">Criar novo usuário</h2><p className="text-xs text-[#64748B] mt-1">A conta poderá entrar imediatamente com a senha definida.</p></div>
            <button type="button" aria-label="Fechar" onClick={() => setShowNew(false)} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9]"><X size={17} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="text-xs text-[#64748B]">Nome completo<input required className="field mt-1" value={newUser.nome} onChange={e => setNewUser(x => ({ ...x, nome: e.target.value }))} placeholder="Nome do usuário" /></label>
            <label className="text-xs text-[#64748B]">E-mail<input required type="email" autoComplete="off" className="field mt-1" value={newUser.email} onChange={e => setNewUser(x => ({ ...x, email: e.target.value }))} placeholder="usuario@empresa.com.br" /></label>
            <label className="text-xs text-[#64748B]">Senha inicial
              <div className="relative mt-1"><input required minLength={8} type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="field pr-11" value={newUser.password} onChange={e => setNewUser(x => ({ ...x, password: e.target.value }))} placeholder="Mínimo 8 caracteres" /><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(v => !v)} className="absolute right-0 top-0 w-11 h-11 flex items-center justify-center text-[#64748B]">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
            </label>
            <label className="text-xs text-[#64748B]">Perfil<select className="field mt-1" value={newUser.role} onChange={e => setNewUser(x => ({ ...x, role: e.target.value as AppRole }))}><option value="usuario">Usuário</option><option value="admin">Administrador</option></select></label>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-[#374151]"><input type="checkbox" disabled={newUser.role === 'admin'} checked={newUser.role === 'admin' || newUser.financeiro} onChange={e => setNewUser(x => ({ ...x, financeiro: e.target.checked }))} className="w-4 h-4 accent-[#4F7CFF]" />Permitir acesso ao financeiro e medições</label>
          {createError && <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{createError}</p>}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-5 pt-4 border-t border-[#E2E8F0]"><button type="button" onClick={() => setShowNew(false)} className="btn-secondary">Cancelar</button><button type="submit" disabled={creating} className="btn-primary">{creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {creating ? 'Criando…' : 'Criar usuário'}</button></div>
        </form>
      )}
      {loadError && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{loadError}</p>}
      <div className="space-y-3">
        {profiles.map(profile => (
          <div key={profile.id} className="card">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${profile.role === 'admin' ? 'bg-violet-50 text-violet-600' : 'bg-slate-100 text-slate-600'}`}>
                {profile.role === 'admin' ? <ShieldCheck size={20} /> : <UserRound size={20} />}
              </div>
              <div className="min-w-0 md:w-64">
                <p className="font-semibold text-sm text-[#0F172A] truncate">{profile.nome || profile.email}</p>
                <p className="text-xs text-[#64748B] truncate">{profile.email}</p>
                <div className="flex gap-1 mt-1">
                  <button type="button" title="Editar nome e e-mail" aria-label={`Editar nome e e-mail de ${nomeDe(profile)}`}
                    onClick={() => { setSenhaPara(null); setEditError(''); setEditando({ id: profile.id, nome: profile.nome ?? '', email: profile.email }) }}
                    className="h-9 px-2 flex items-center gap-1 rounded-lg text-xs text-[#4F7CFF] hover:bg-[#EEF2FF]"><Pencil size={13} /> Editar</button>
                  <button type="button" title="Definir nova senha" aria-label={`Definir nova senha para ${nomeDe(profile)}`}
                    onClick={() => { setEditando(null); setEditError(''); setSenhaPara({ id: profile.id, senha: '' }) }}
                    className="h-9 px-2 flex items-center gap-1 rounded-lg text-xs text-[#4F7CFF] hover:bg-[#EEF2FF]"><KeyRound size={13} /> Nova senha</button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                <label className="text-xs text-[#64748B]">Perfil
                  <select disabled={profile.email.toLowerCase() === 'joaovictor@marvservicos.com.br'} value={profile.role} onChange={e => update(profile, { role: e.target.value as AppRole })} className="field mt-1 disabled:bg-[#F1F5F9] disabled:text-[#64748B]">
                    <option value="usuario">Usuário</option><option value="admin">Administrador</option>
                  </select>
                </label>
                <div className="text-xs text-[#64748B]">Permissões
                  <div className="mt-1 min-h-11 flex items-center gap-2">
                    {PERMISSOES.map(p => {
                      const checked = profile.role === 'admin' || profile.permissions.includes(p.id)
                      return <label key={p.id} className="flex items-center gap-2 text-sm text-[#374151]"><input type="checkbox" checked={checked} disabled={profile.role === 'admin'} onChange={() => update(profile, { permissions: checked ? profile.permissions.filter(x => x !== p.id) : [...profile.permissions, p.id] })} className="w-4 h-4 accent-[#4F7CFF]" />{p.label}</label>
                    })}
                  </div>
                </div>
                <div className="text-xs text-[#64748B]">Situação
                  <button disabled={profile.email.toLowerCase() === 'joaovictor@marvservicos.com.br' || saving === profile.id} onClick={() => alternarBloqueio(profile)} className={`mt-1 min-h-11 w-full rounded-lg border text-sm font-semibold disabled:opacity-60 ${profile.active ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                    {profile.active ? 'Ativo' : 'Bloqueado'}
                  </button>
                </div>
              </div>
              <div className="w-6 shrink-0">{saving === profile.id && <Loader2 size={17} className="animate-spin text-[#4F7CFF]" />}{saving !== profile.id && <Check size={16} className="text-emerald-500" />}</div>
            </div>
            {editando?.id === profile.id && (
              <form onSubmit={salvarEdicao} className="mt-4 pt-4 border-t border-[#E2E8F0] grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <label className="text-xs text-[#64748B]">Nome<input required className="field mt-1" value={editando.nome} onChange={e => setEditando(x => x && ({ ...x, nome: e.target.value }))} /></label>
                <label className="text-xs text-[#64748B]">E-mail de acesso<input required type="email" className="field mt-1" disabled={profile.email.toLowerCase() === 'joaovictor@marvservicos.com.br'} value={editando.email} onChange={e => setEditando(x => x && ({ ...x, email: e.target.value }))} /></label>
                <div className="flex gap-2"><button type="button" onClick={() => setEditando(null)} className="btn-secondary">Cancelar</button><button type="submit" disabled={saving === profile.id} className="btn-primary">{saving === profile.id ? 'Salvando…' : 'Salvar'}</button></div>
                {editError && <p className="sm:col-span-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{editError}</p>}
              </form>
            )}
            {senhaPara?.id === profile.id && (
              <form onSubmit={salvarSenha} className="mt-4 pt-4 border-t border-[#E2E8F0] grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                <label className="text-xs text-[#64748B]">Nova senha para {nomeDe(profile)}<input required minLength={8} type="text" autoComplete="new-password" className="field mt-1" placeholder="Mínimo 8 caracteres" value={senhaPara.senha} onChange={e => setSenhaPara(x => x && ({ ...x, senha: e.target.value }))} /></label>
                <div className="flex gap-2"><button type="button" onClick={() => setSenhaPara(null)} className="btn-secondary">Cancelar</button><button type="submit" disabled={saving === profile.id} className="btn-primary">{saving === profile.id ? 'Salvando…' : 'Definir senha'}</button></div>
                {editError && <p className="sm:col-span-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{editError}</p>}
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
