'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wrench, Mail, Lock, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

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

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-120px] left-[-100px] w-[500px] h-[500px] rounded-full bg-[#4F7CFF]/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-80px] w-[400px] h-[400px] rounded-full bg-[#2DD4BF]/10 blur-3xl pointer-events-none" />
      <div className="absolute top-[40%] right-[15%] w-[200px] h-[200px] rounded-full bg-[#4F7CFF]/6 blur-2xl pointer-events-none" />

      <div className="w-full max-w-[400px] mx-4">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 shadow-sm">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-[#4F7CFF] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
              <Wrench size={28} className="text-white" />
            </div>
            <h1 className="font-syne text-2xl font-bold text-[#0F172A] tracking-tight">MARV Gestão</h1>
            <p className="text-sm text-[#64748B] mt-1">Mechanical Engineering</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">E-mail</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="email"
                  placeholder="exemplo@marv.com.br"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full pl-9 pr-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF] focus:ring-1 focus:ring-[#4F7CFF]/20 transition-colors placeholder:text-[#CBD5E1]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-[#374151]">Senha</label>
                <a href="#" className="text-xs text-[#4F7CFF] hover:underline">Esqueceu a senha?</a>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full pl-9 pr-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#4F7CFF] focus:ring-1 focus:ring-[#4F7CFF]/20 transition-colors placeholder:text-[#CBD5E1]"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#4F7CFF] hover:bg-[#3D68F0] disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
            >
              {loading ? 'Entrando...' : <>Entrar <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="text-center text-sm text-[#94A3B8] mt-6">
            Não possui uma conta?{' '}
            <a href="#" className="text-[#4F7CFF] hover:underline font-medium">Solicitar acesso</a>
          </p>
        </div>

        <p className="text-center text-xs text-[#CBD5E1] mt-6">
          MARV Gestão © 2024 — Mechanical Engineering Platform
        </p>
      </div>
    </div>
  )
}
