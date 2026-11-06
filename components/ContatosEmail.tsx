'use client'

// Atalhos de contatos para os modais de envio de e-mail (RDO, relatórios da
// obra e da manutenção). Agrupa em Equipe MARV (usuários ativos do app),
// Gestores, Fiscais, Compradores e Outros. Cada pessoa tem "Para" e "Cc";
// clicar de novo tira o e-mail do campo.

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, ChevronDown, Check } from 'lucide-react'

type Grupo = 'marv' | 'Gestor' | 'Fiscal' | 'Comprador' | 'outros'

interface Contato { nome: string; email: string; grupo: Grupo; detalhe: string | null }

const GRUPOS: { id: Grupo; rotulo: string; chip: string; ativo: string; ponto: string }[] = [
  { id: 'Gestor',    rotulo: 'Gestores',    chip: 'bg-[#EEF2FF] text-[#4F7CFF]', ativo: 'bg-[#4F7CFF] text-white', ponto: 'bg-[#4F7CFF]' },
  { id: 'Fiscal',    rotulo: 'Fiscais',     chip: 'bg-amber-50 text-amber-700',  ativo: 'bg-amber-500 text-white',  ponto: 'bg-amber-500' },
  { id: 'Comprador', rotulo: 'Compradores', chip: 'bg-emerald-50 text-emerald-700', ativo: 'bg-emerald-600 text-white', ponto: 'bg-emerald-600' },
  { id: 'marv',      rotulo: 'Equipe MARV', chip: 'bg-violet-50 text-violet-700', ativo: 'bg-violet-600 text-white', ponto: 'bg-violet-600' },
  { id: 'outros',    rotulo: 'Outros contatos', chip: 'bg-[#F1F5F9] text-[#475569]', ativo: 'bg-[#475569] text-white', ponto: 'bg-[#94A3B8]' },
]

export function separarEmails(valor: string) {
  return valor.split(/[,;\n]/).map(e => e.trim()).filter(Boolean)
}

export function ContatosEmail({ destinatarios, cc, onChange }: {
  destinatarios: string
  cc: string
  onChange: (campo: 'destinatarios' | 'cc', valor: string) => void
}) {
  const [contatos, setContatos] = useState<Contato[]>([])
  const [busca, setBusca] = useState('')
  const [fechados, setFechados] = useState<Set<Grupo>>(new Set())

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('clientes').select('nome, email, tipo, empresa:empresas(apelido, razao_social)').not('email', 'is', null).order('nome'),
      fetch('/api/usuarios/contatos').then(r => (r.ok ? r.json() : { usuarios: [] })).catch(() => ({ usuarios: [] })) as Promise<{ usuarios?: { nome: string | null; email: string; cargo: string | null }[] }>,
    ]).then(([cli, usu]) => {
      const lista: Contato[] = []
      for (const c of cli.data ?? []) {
        if (!c.email) continue
        const tipo = c.tipo as string | null
        const emp = (Array.isArray(c.empresa) ? c.empresa[0] : c.empresa) as { apelido?: string | null; razao_social?: string | null } | null
        lista.push({
          nome: c.nome as string, email: (c.email as string).trim(),
          grupo: tipo === 'Gestor' || tipo === 'Fiscal' || tipo === 'Comprador' ? tipo : 'outros',
          detalhe: emp?.apelido || emp?.razao_social || null,
        })
      }
      for (const u of usu.usuarios ?? []) {
        if (!u.email) continue
        lista.push({ nome: u.nome || u.email.split('@')[0], email: u.email.trim(), grupo: 'marv', detalhe: u.cargo || null })
      }
      setContatos(lista)
    })
  }, [])

  const para = useMemo(() => new Set(separarEmails(destinatarios).map(e => e.toLowerCase())), [destinatarios])
  const comCc = useMemo(() => new Set(separarEmails(cc).map(e => e.toLowerCase())), [cc])

  const termo = busca.trim().toLowerCase()
  const filtrados = termo
    ? contatos.filter(c => `${c.nome} ${c.email} ${c.detalhe ?? ''}`.toLowerCase().includes(termo))
    : contatos

  if (contatos.length === 0) return null

  function alternar(campo: 'destinatarios' | 'cc', email: string) {
    const valor = campo === 'destinatarios' ? destinatarios : cc
    const outro = campo === 'destinatarios' ? cc : destinatarios
    const atuais = separarEmails(valor)
    const existe = atuais.some(e => e.toLowerCase() === email.toLowerCase())
    if (existe) {
      onChange(campo, atuais.filter(e => e.toLowerCase() !== email.toLowerCase()).join(', '))
      return
    }
    onChange(campo, [...atuais, email].join(', '))
    // Mesma pessoa não fica em Para e Cc ao mesmo tempo.
    const noOutro = separarEmails(outro)
    if (noOutro.some(e => e.toLowerCase() === email.toLowerCase())) {
      onChange(campo === 'destinatarios' ? 'cc' : 'destinatarios', noOutro.filter(e => e.toLowerCase() !== email.toLowerCase()).join(', '))
    }
  }

  function alternarGrupo(g: Grupo) {
    setFechados(prev => {
      const n = new Set(prev)
      if (n.has(g)) n.delete(g); else n.add(g)
      return n
    })
  }

  return (
    <div className="border border-[#E2E8F0] rounded-xl">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#F1F5F9]">
        <span className="text-xs font-medium text-[#64748B] shrink-0">Contatos salvos</span>
        <div className="relative flex-1 min-w-0">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nome, e-mail ou empresa"
            className="w-full text-xs pl-7 pr-2 py-1.5 rounded-lg bg-[#F8FAFC] border border-transparent focus:border-[#CBD5E1] outline-none" />
        </div>
      </div>
      <div className="max-h-56 overflow-y-auto px-3 py-2 space-y-2">
        {GRUPOS.map(g => {
          const doGrupo = filtrados.filter(c => c.grupo === g.id)
          if (doGrupo.length === 0) return null
          const aberto = termo !== '' || !fechados.has(g.id)
          const marcados = doGrupo.filter(c => para.has(c.email.toLowerCase()) || comCc.has(c.email.toLowerCase())).length
          return (
            <div key={g.id}>
              <button type="button" onClick={() => alternarGrupo(g.id)} className="w-full flex items-center gap-2 py-1 text-left">
                <span className={`w-2 h-2 rounded-full ${g.ponto}`} />
                <span className="text-xs font-semibold text-[#334155]">{g.rotulo}</span>
                <span className="text-[11px] text-[#94A3B8]">{doGrupo.length}{marcados > 0 ? ` · ${marcados} selecionado${marcados > 1 ? 's' : ''}` : ''}</span>
                <ChevronDown size={13} className={`ml-auto text-[#94A3B8] transition-transform ${aberto ? '' : '-rotate-90'}`} />
              </button>
              {aberto && (
                <div className="flex flex-wrap gap-1.5 pt-1 pb-1">
                  {doGrupo.map((c, i) => {
                    const emPara = para.has(c.email.toLowerCase())
                    const emCc = comCc.has(c.email.toLowerCase())
                    return (
                      <span key={`${c.email}-${i}`} title={`${c.email}${c.detalhe ? ` — ${c.detalhe}` : ''}`}
                        className={`inline-flex items-center rounded-full overflow-hidden ${g.chip}`}>
                        <button type="button" onClick={() => alternar('destinatarios', c.email)}
                          className={`text-xs pl-2 pr-1.5 py-1 inline-flex items-center gap-1 transition-colors ${emPara ? g.ativo : 'hover:brightness-95'}`}>
                          {emPara ? <Check size={11} /> : '+'} {c.nome}
                          {c.detalhe && <span className="opacity-60">· {c.detalhe}</span>}
                        </button>
                        <button type="button" onClick={() => alternar('cc', c.email)} title={emCc ? 'Tirar do Cc' : 'Adicionar em Cc'}
                          className={`text-[10px] font-semibold px-1.5 py-1 border-l border-white/60 transition-colors ${emCc ? g.ativo : 'hover:brightness-95'}`}>
                          Cc
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {filtrados.length === 0 && <p className="text-xs text-[#94A3B8] py-1">Nenhum contato encontrado.</p>}
      </div>
    </div>
  )
}
