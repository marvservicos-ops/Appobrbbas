'use client'

import { useState } from 'react'

export default function PinForm({ token }: { token: string }) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    try {
      const res = await fetch(`/api/portal/${token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErro(data.error || 'Link ou PIN inválido.')
        setLoading(false)
        return
      }
      window.location.reload()
    } catch {
      setErro('Erro ao verificar o PIN. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#F8FAFC', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '32px 24px', boxShadow: '0 1px 4px #0001', maxWidth: 360, width: '100%' }}>
        <img src="/marv-logo.png" alt="MARV" style={{ height: 26, width: 'auto', display: 'block', margin: '0 auto 8px' }} />
        <h1 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#0F172A', textAlign: 'center' }}>
          Acesso ao Portal
        </h1>
        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: 12, color: '#64748B', display: 'block', marginBottom: 6 }}>Digite o PIN recebido</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            style={{
              width: '100%', boxSizing: 'border-box', fontSize: 24, letterSpacing: 8, textAlign: 'center',
              fontFamily: 'monospace', padding: '12px', borderRadius: 10, border: '1px solid #E2E8F0', outline: 'none',
            }}
            placeholder="000000"
          />
          {erro && <p style={{ color: '#DC2626', fontSize: 12, marginTop: 10, textAlign: 'center' }}>{erro}</p>}
          <button
            type="submit"
            disabled={loading || pin.length < 4}
            style={{
              width: '100%', marginTop: 16, background: '#4F7CFF', color: 'white', border: 'none',
              padding: '12px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
              opacity: loading || pin.length < 4 ? 0.6 : 1,
            }}
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
