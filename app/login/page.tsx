'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wrench, Mail, Lock, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'forgot' | 'reset' | 'reset_ok'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const router = useRouter()

  // Detecta token de recovery na URL (link do email)
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      const supabase = createClient()
      // O Supabase client detecta o hash e estabelece a sessão automaticamente
      supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setMode('reset')
        }
      })
      // Fallback: se já passou pelo onAuthStateChange antes de montar
      supabase.auth.getSession().then(({ data }) => {
        if (data.session && hash.includes('type=recovery')) {
          setMode('reset')
        }
      })
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
    } else {
      router.push('/obras')
      router.refresh()
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setInfo('Link de redefinição enviado! Verifique sua caixa de entrada.')
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }
    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (error) {
      setError('Erro ao redefinir senha. O link pode ter expirado.')
    } else {
      setMode('reset_ok')
    }
  }

  const bg = (
    <>
      <div className="absolute top-[-120px] left-[-100px] w-[500px] h-[500px] rounded-full bg-[#4F7CFF]/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-80px] w-[400px] h-[400px] rounded-full bg-[#2DD4BF]/10 blur-3xl pointer-events-none" />
      <div className="absolute top-[40%] right-[15%] w-[200px] h-[200px] rounded-full bg-[#4F7CFF]/6 blur-2xl pointer-events-none" />
    </>
  )

  const logo = (
    <div className="flex flex-col items-center mb-8">
      <div className="w-14 h-14 bg-[#4F7CFF] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
        <Wrench size={28} className="text-white" />
      </div>
      <h1 className="font-syne text-2xl font-bold text-[#0F172A] tracking-tight">MARV Gestão</h1>
      <p className="text-sm text-[#64748B] mt-1">Mechanical Engineering</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center relative overflow-hidden">
      {bg}

      <div className="w-full max-w-[400px] mx-4">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 shadow-sm">

          {/* ── LOGIN ── */}
          {mode === 'login' && (
            <>
              {logo}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">E-mail</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input type="email" placeholder="exemplo@marv.com.br" value={email}
                      onChange={e => setEmail(e.target.value)} required
                      className="w-full pl-9 pr-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF] focus:ring-1 focus:ring-[#4F7CFF]/20 transition-colors placeholder:text-[#CBD5E1]" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-[#374151]">Senha</label>
                    <button type="button" onClick={() => { setMode('forgot'); setError(''); setInfo('') }}
                      className="text-xs text-[#4F7CFF] hover:underline">Esqueceu a senha?</button>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input type="password" placeholder="••••••••" value={password}
                      onChange={e => setPassword(e.target.value)} required
                      className="w-full pl-9 pr-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF] focus:ring-1 focus:ring-[#4F7CFF]/20 transition-colors placeholder:text-[#CBD5E1]" />
                  </div>
                </div>
                {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full bg-[#4F7CFF] hover:bg-[#3D68F0] disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm">
                  {loading ? 'Entrando...' : <>Entrar <ArrowRight size={16} /></>}
                </button>
              </form>
              <p className="text-center text-sm text-[#94A3B8] mt-6">
                Não possui uma conta?{' '}
                <a href="#" className="text-[#4F7CFF] hover:underline font-medium">Solicitar acesso</a>
              </p>
            </>
          )}

          {/* ── ESQUECEU A SENHA ── */}
          {mode === 'forgot' && (
            <>
              {logo}
              <div className="mb-6 text-center">
                <h2 className="font-semibold text-[#0F172A] mb-1">Redefinir senha</h2>
                <p className="text-sm text-[#64748B]">Digite seu e-mail e enviaremos um link para criar uma nova senha.</p>
              </div>
              {info ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <CheckCircle2 size={36} className="text-emerald-500" />
                  <p className="text-sm text-[#374151] text-center">{info}</p>
                  <button onClick={() => { setMode('login'); setInfo('') }}
                    className="text-sm text-[#4F7CFF] hover:underline mt-2">Voltar ao login</button>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1.5">E-mail</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                      <input type="email" placeholder="seu@email.com" value={email}
                        onChange={e => setEmail(e.target.value)} required
                        className="w-full pl-9 pr-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF] focus:ring-1 focus:ring-[#4F7CFF]/20 transition-colors placeholder:text-[#CBD5E1]" />
                    </div>
                  </div>
                  {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
                  <button type="submit" disabled={loading}
                    className="w-full bg-[#4F7CFF] hover:bg-[#3D68F0] disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm">
                    {loading ? 'Enviando...' : 'Enviar link de redefinição'}
                  </button>
                  <button type="button" onClick={() => { setMode('login'); setError('') }}
                    className="w-full flex items-center justify-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A] transition-colors">
                    <ArrowLeft size={14} /> Voltar ao login
                  </button>
                </form>
              )}
            </>
          )}

          {/* ── NOVA SENHA (veio do link do email) ── */}
          {mode === 'reset' && (
            <>
              {logo}
              <div className="mb-6 text-center">
                <h2 className="font-semibold text-[#0F172A] mb-1">Criar nova senha</h2>
                <p className="text-sm text-[#64748B]">Digite e confirme sua nova senha.</p>
              </div>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Nova senha</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input type="password" placeholder="Mínimo 6 caracteres" value={newPassword}
                      onChange={e => setNewPassword(e.target.value)} required
                      className="w-full pl-9 pr-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF] focus:ring-1 focus:ring-[#4F7CFF]/20 transition-colors placeholder:text-[#CBD5E1]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Confirmar nova senha</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input type="password" placeholder="Repita a senha" value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)} required
                      className="w-full pl-9 pr-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF] focus:ring-1 focus:ring-[#4F7CFF]/20 transition-colors placeholder:text-[#CBD5E1]" />
                  </div>
                </div>
                {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full bg-[#4F7CFF] hover:bg-[#3D68F0] disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm">
                  {loading ? 'Salvando...' : <>Salvar nova senha <ArrowRight size={16} /></>}
                </button>
              </form>
            </>
          )}

          {/* ── SENHA REDEFINIDA COM SUCESSO ── */}
          {mode === 'reset_ok' && (
            <div className="flex flex-col items-center gap-4 py-6">
              {logo}
              <CheckCircle2 size={40} className="text-emerald-500" />
              <div className="text-center">
                <h2 className="font-semibold text-[#0F172A] mb-1">Senha redefinida!</h2>
                <p className="text-sm text-[#64748B]">Sua senha foi atualizada com sucesso.</p>
              </div>
              <button onClick={() => router.push('/obras')}
                className="w-full bg-[#4F7CFF] hover:bg-[#3D68F0] text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm mt-2">
                Ir para o app <ArrowRight size={16} />
              </button>
            </div>
          )}

        </div>
        <p className="text-center text-xs text-[#CBD5E1] mt-6">
          MARV Gestão © 2024 — Mechanical Engineering Platform
        </p>
      </div>
    </div>
  )
}
