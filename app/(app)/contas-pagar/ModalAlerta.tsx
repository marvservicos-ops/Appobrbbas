'use client'

import { useEffect, useState } from 'react'
import { Loader2, Send, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mensagemErro } from '@/lib/erros'
import { CHAVE_ALERTA, type ConfigAlerta } from '@/lib/contasPagar'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Alerta de segunda às 08:00: quem recebe a lista de boletos esperados no DDA.
// Salvar é só para admin (configuracoes_empresa); enviar agora, para quem usa a tela.
export default function ModalAlerta({ isAdmin, onClose }: { isAdmin: boolean; onClose: () => void }) {
  const [carregando, setCarregando] = useState(true)
  const [ativo, setAtivo] = useState(true)
  const [emails, setEmails] = useState('')
  const [salvo, setSalvo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    createClient().from('configuracoes_empresa').select('valor').eq('chave', CHAVE_ALERTA).maybeSingle()
      .then(({ data }) => {
        const v = data?.valor as Partial<ConfigAlerta> | undefined
        if (v) { setAtivo(v.ativo !== false); setEmails((v.emails ?? []).join('\n')); setSalvo(true) }
        setCarregando(false)
      })
  }, [])

  const lista = emails.split(/[\s,;]+/).map(e => e.trim()).filter(Boolean)
  const invalidos = lista.filter(e => !EMAIL.test(e))

  async function salvar() {
    if (invalidos.length) { setMsg(`E-mail inválido: ${invalidos.join(', ')}`); return }
    setSaving(true); setMsg('')
    const { error } = await createClient().from('configuracoes_empresa').upsert({
      chave: CHAVE_ALERTA,
      descricao: 'Contas a pagar — alerta semanal do DDA (segunda 08:00)',
      valor: { ativo, emails: lista },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'chave' })
    setSaving(false)
    if (error) { setMsg(mensagemErro(error, 'Não foi possível salvar')); return }
    setSalvo(true)
    setMsg('Salvo.')
  }

  async function enviarAgora() {
    setEnviando(true); setMsg('')
    try {
      const res = await fetch('/api/contas-pagar/alerta-semana', { method: 'POST' })
      const r = await res.json()
      setMsg(r.enviado ? `Enviado para ${(r.para ?? []).join(', ')}.` : (r.error ?? r.motivo ?? 'Não foi enviado.'))
    } catch (err) {
      setMsg(mensagemErro(err as Error, 'Erro ao enviar'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">Alerta semanal do DDA</h2>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -mr-2"><X size={16} className="text-[#64748B]" /></button>
        </div>
        {carregando ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={22} className="animate-spin text-[#4F7CFF]" /></div>
        ) : (
          <div className="p-6 space-y-4">
            <p className="text-sm text-[#64748B]">Toda segunda às 08:00 o sistema manda por e-mail a lista de boletos em aberto que vencem na semana — e os vencidos que ficaram para trás — para conferir com o DDA do banco.</p>
            {!salvo && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Ainda não configurado: por enquanto vai para o mesmo e-mail das pendências do dia.</p>}

            <label className="flex items-center gap-2 text-sm text-[#374151]">
              <input type="checkbox" checked={ativo} disabled={!isAdmin} onChange={e => setAtivo(e.target.checked)} className="w-4 h-4 accent-[#4F7CFF]" />
              Enviar toda segunda às 08:00
            </label>

            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Quem recebe</label>
              <textarea className="field min-h-[90px] font-mono text-xs" value={emails} disabled={!isAdmin}
                onChange={e => setEmails(e.target.value)} placeholder={'financeiro@marvservicos.com.br\noutro@marvservicos.com.br'} />
              <p className="text-[11px] text-[#94A3B8] mt-1">Um por linha (ou separados por vírgula).{!isAdmin && ' Só o administrador altera.'}</p>
            </div>

            {msg && <p className="text-xs text-[#374151] bg-[#F8FAFC] rounded-lg px-3 py-2">{msg}</p>}

            <div className="flex gap-3 pt-1">
              <button onClick={enviarAgora} disabled={enviando}
                className="flex-1 py-2.5 text-sm font-medium text-[#4F7CFF] border border-[#C7D2FE] rounded-xl hover:bg-[#EEF2FF] flex items-center justify-center gap-2 disabled:opacity-50">
                {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />} Enviar agora
              </button>
              {isAdmin && (
                <button onClick={salvar} disabled={saving}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              )}
            </div>
            <p className="text-[11px] text-[#94A3B8]">“Enviar agora” usa os destinatários já salvos.</p>
          </div>
        )}
      </div>
    </div>
  )
}
