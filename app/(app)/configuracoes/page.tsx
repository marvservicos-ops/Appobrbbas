'use client'

import { useEffect, useState } from 'react'
import { User, Building2, Bell, Shield, Save, Loader2, Check, Clock, Percent, Car, Plus, Trash2, Power, Mail, Pencil, X, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false })

interface Veiculo { id: string; nome: string; placa: string; cor: string; ativo: boolean }

interface EmailTemplate {
  id: string
  nome: string
  assunto: string
  corpo: string
  destinatario_tipo: 'gestor' | 'comprador' | 'manual'
}

const VARIAVEIS = ['{{nome_obra}}', '{{nome_gestor}}', '{{email_gestor}}', '{{numero_contrato}}', '{{data_inicio}}', '{{endereco}}']

function SecaoEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<EmailTemplate | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nome: '', assunto: '', corpo: '', destinatario_tipo: 'gestor' as EmailTemplate['destinatario_tipo'] })
  const [salvando, setSalvando] = useState(false)
  const insertRef = useState<((text: string) => void) | null>(null)

  async function load() {
    const { data } = await createClient().from('email_templates').select('*').order('nome')
    setTemplates((data ?? []) as EmailTemplate[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm({ nome: '', assunto: '', corpo: '', destinatario_tipo: 'gestor' })
    setShowForm(true)
  }

  function abrirEditar(t: EmailTemplate) {
    setEditando(t)
    setForm({ nome: t.nome, assunto: t.assunto, corpo: t.corpo, destinatario_tipo: t.destinatario_tipo })
    setShowForm(true)
  }

  function inserirVariavel(v: string) {
    if (insertRef[0]) {
      insertRef[0](v)
    } else {
      setForm(f => ({ ...f, corpo: f.corpo + v }))
    }
  }

  async function salvar() {
    if (!form.nome.trim() || !form.assunto.trim() || !form.corpo.trim()) return
    setSalvando(true)
    const sb = createClient()
    if (editando) {
      await sb.from('email_templates').update(form).eq('id', editando.id)
    } else {
      await sb.from('email_templates').insert(form)
    }
    setShowForm(false)
    setSalvando(false)
    load()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este modelo?')) return
    await createClient().from('email_templates').delete().eq('id', id)
    load()
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] flex items-center justify-center">
            <Mail size={18} className="text-[#4F7CFF]" />
          </div>
          <div>
            <h2 className="font-syne font-semibold text-[#0F172A]">Modelos de Email</h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">Gatilhos rápidos para envio via Gmail</p>
          </div>
        </div>
        <button onClick={abrirNovo} className="flex items-center gap-1.5 px-3 py-2 bg-[#4F7CFF] hover:bg-[#3D68F0] text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={14} /> Novo modelo
        </button>
      </div>

      {/* Variáveis disponíveis */}
      <div className="bg-[#F8FAFC] rounded-xl p-3 mb-4">
        <p className="text-xs font-semibold text-[#64748B] mb-2">Variáveis disponíveis no assunto e corpo:</p>
        <div className="flex flex-wrap gap-1.5">
          {VARIAVEIS.map(v => (
            <code key={v} className="text-[11px] bg-white border border-[#E2E8F0] text-[#4F7CFF] px-2 py-0.5 rounded font-mono">{v}</code>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="border border-[#E2E8F0] rounded-xl p-5 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0F172A]">{editando ? 'Editar modelo' : 'Novo modelo'}</h3>
            <button onClick={() => setShowForm(false)}><X size={15} className="text-[#94A3B8]" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#64748B] block mb-1">Nome do modelo *</label>
              <input className="field text-sm" placeholder="Ex: Pesquisa de Satisfação" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-[#64748B] block mb-1">Destinatário padrão</label>
              <select className="field text-sm" value={form.destinatario_tipo} onChange={e => setForm(f => ({ ...f, destinatario_tipo: e.target.value as EmailTemplate['destinatario_tipo'] }))}>
                <option value="gestor">Gestor da obra</option>
                <option value="comprador">Comprador</option>
                <option value="manual">Preencher manualmente</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[#64748B] block mb-1">Assunto *</label>
            <input className="field text-sm" placeholder="Ex: Pesquisa de satisfação — {{nome_obra}}" value={form.assunto} onChange={e => setForm(f => ({ ...f, assunto: e.target.value }))} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-[#64748B]">Corpo do email *</label>
              <div className="flex gap-1 flex-wrap justify-end">
                {VARIAVEIS.map(v => (
                  <button key={v} type="button" onClick={() => inserirVariavel(v)}
                    className="text-[10px] font-mono bg-[#EEF2FF] text-[#4F7CFF] hover:bg-[#4F7CFF] hover:text-white px-1.5 py-0.5 rounded transition-colors">
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <RichTextEditor
              value={form.corpo}
              onChange={html => setForm(f => ({ ...f, corpo: html }))}
              onInsertRef={fn => { insertRef[1](fn) }}
              placeholder="Olá {{nome_gestor}}, tudo bem?..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-[#64748B] hover:bg-[#F1F5F9] rounded-lg transition-colors">Cancelar</button>
            <button onClick={salvar} disabled={salvando || !form.nome || !form.assunto || !form.corpo}
              className="px-4 py-2 text-sm font-medium bg-[#4F7CFF] text-white rounded-lg hover:bg-[#3D68F0] disabled:opacity-50 transition-colors">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#4F7CFF]" /></div>
      ) : templates.length === 0 ? (
        <p className="text-sm text-[#94A3B8] text-center py-8">Nenhum modelo criado</p>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="flex items-start gap-3 p-4 border border-[#E2E8F0] rounded-xl group hover:bg-[#F8FAFC] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center shrink-0 mt-0.5">
                <Mail size={14} className="text-[#4F7CFF]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#0F172A]">{t.nome}</p>
                  <span className="text-[10px] bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-full">
                    {t.destinatario_tipo === 'gestor' ? 'Gestor' : t.destinatario_tipo === 'comprador' ? 'Comprador' : 'Manual'}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mt-0.5 truncate">{t.assunto}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => abrirEditar(t)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#4F7CFF] transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => excluir(t.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-[#94A3B8] hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function SecaoVeiculos() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [adicionando, setAdicionando] = useState(false)
  const [novo, setNovo] = useState({ nome: '', placa: '', cor: '' })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    createClient().from('veiculos').select('id, nome, placa, cor, ativo').order('nome')
      .then(({ data }) => { setVeiculos(data ?? []); setLoading(false) })
  }, [])

  async function adicionar() {
    if (!novo.nome.trim() || !novo.placa.trim()) return
    setSalvando(true)
    const { data } = await createClient().from('veiculos')
      .insert({ nome: novo.nome.trim(), placa: novo.placa.trim().toUpperCase(), cor: novo.cor.trim(), ativo: true })
      .select().single()
    if (data) { setVeiculos(v => [...v, data as Veiculo].sort((a, b) => a.nome.localeCompare(b.nome))) }
    setNovo({ nome: '', placa: '', cor: '' })
    setAdicionando(false)
    setSalvando(false)
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await createClient().from('veiculos').update({ ativo: !ativo }).eq('id', id)
    setVeiculos(v => v.map(x => x.id === id ? { ...x, ativo: !ativo } : x))
  }

  async function remover(id: string) {
    if (!confirm('Remover este veículo?')) return
    await createClient().from('veiculos').delete().eq('id', id)
    setVeiculos(v => v.filter(x => x.id !== id))
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center">
            <Car size={18} className="text-sky-600" />
          </div>
          <div>
            <h2 className="font-syne font-semibold text-[#0F172A]">Frota de Veículos</h2>
            <p className="text-xs text-[#94A3B8]">Veículos disponíveis no Quadro de Alocação</p>
          </div>
        </div>
        <button onClick={() => setAdicionando(true)}
          className="text-xs text-[#4F7CFF] hover:text-blue-700 font-medium px-3 py-1.5 border border-[#C7D2FE] rounded-lg hover:bg-[#EEF2FF] transition-colors flex items-center gap-1">
          <Plus size={13} /> Adicionar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-[#4F7CFF]" /></div>
      ) : (
        <div className="space-y-2">
          {veiculos.map(v => (
            <div key={v.id} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${v.ativo ? 'bg-[#F8FAFC]' : 'bg-[#F1F5F9] opacity-60'}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#374151]">{v.nome}</p>
                <p className="text-xs text-[#94A3B8]">{v.placa}{v.cor ? ` · ${v.cor}` : ''}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleAtivo(v.id, v.ativo)} title={v.ativo ? 'Desativar' : 'Ativar'}
                  className={`p-1.5 rounded-lg transition-colors ${v.ativo ? 'text-[#10B981] hover:bg-green-50' : 'text-[#94A3B8] hover:bg-[#F8FAFC]'}`}>
                  <Power size={14} />
                </button>
                <button onClick={() => remover(v.id)}
                  className="p-1.5 rounded-lg text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {veiculos.length === 0 && !adicionando && (
            <p className="text-xs text-[#94A3B8] text-center py-4">Nenhum veículo cadastrado.</p>
          )}

          {adicionando && (
            <div className="border border-[#4F7CFF] rounded-xl p-3 space-y-2 bg-[#F8FAFC]">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Nome</label>
                  <input className="field text-sm py-1.5" placeholder="Ex: Amarok" value={novo.nome} onChange={e => setNovo(n => ({ ...n, nome: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Placa</label>
                  <input className="field text-sm py-1.5" placeholder="KQR9C20" value={novo.placa} onChange={e => setNovo(n => ({ ...n, placa: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Cor (opcional)</label>
                <input className="field text-sm py-1.5" placeholder="Ex: Prata" value={novo.cor} onChange={e => setNovo(n => ({ ...n, cor: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAdicionando(false)} className="flex-1 py-1.5 text-xs text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-white transition-colors">Cancelar</button>
                <button onClick={adicionar} disabled={salvando || !novo.nome.trim() || !novo.placa.trim()}
                  className="flex-1 py-1.5 text-xs font-semibold bg-[#4F7CFF] text-white rounded-lg disabled:opacity-40 hover:bg-blue-600 transition-colors flex items-center justify-center gap-1">
                  {salvando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Salvar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

interface RegraExtra {
  chave: string
  descricao: string
  valor: { percentual: number }
}

function SecaoTributacao() {
  const [aliquota, setAliquota] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    createClient().from('configuracoes_empresa').select('valor').eq('chave', 'aliquota_simples').maybeSingle()
      .then(({ data }) => { if (data) setAliquota(String((data.valor as any).percentual ?? '') ) })
  }, [])

  async function salvar() {
    const pct = parseFloat(aliquota)
    if (isNaN(pct) || pct < 0 || pct > 100) return
    setSalvando(true)
    await createClient().from('configuracoes_empresa').upsert({
      chave: 'aliquota_simples',
      descricao: 'Simples Nacional — alíquota efetiva',
      valor: { percentual: pct },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'chave' })
    setSalvando(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const receitaEx = 100000
  const impostoEx = aliquota ? receitaEx * (parseFloat(aliquota) / 100) : 0

  return (
    <section className="card">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
          <Percent size={18} className="text-amber-600" />
        </div>
        <div>
          <h2 className="font-syne font-semibold text-[#0F172A]">Tributação — Simples Nacional</h2>
          <p className="text-xs text-[#94A3B8]">Alíquota efetiva aplicada sobre a receita bruta de cada obra</p>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Alíquota efetiva (%)</label>
          <div className="flex items-center gap-1 bg-white border border-[#E2E8F0] rounded-xl px-3 py-2.5 focus-within:border-[#4F7CFF]">
            <input
              type="number" min="0" max="100" step="0.01"
              className="flex-1 text-sm font-semibold text-[#0F172A] bg-transparent outline-none"
              value={aliquota}
              onChange={e => setAliquota(e.target.value)}
              placeholder="0,00"
            />
            <span className="text-sm text-[#64748B]">%</span>
          </div>
          <p className="text-xs text-[#94A3B8] mt-1">
            Encontre sua alíquota efetiva no PGDAS-D ou no carnê do Simples.
          </p>
        </div>
        <button onClick={salvar} disabled={salvando}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 shrink-0">
          {salvando ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
          {salvando ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      {aliquota && !isNaN(parseFloat(aliquota)) && parseFloat(aliquota) > 0 && (
        <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-[#374151]">
          <p className="font-medium text-amber-700 mb-1">Exemplo de cálculo:</p>
          <p>Obra de <strong>R$ 100.000,00</strong> → Imposto = <strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(impostoEx)}</strong> ({aliquota}%)</p>
          <p className="text-[#94A3B8] mt-1">O imposto aparece deduzido automaticamente no Centro de Custos de cada obra.</p>
        </div>
      )}
    </section>
  )
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

        {/* Tributação */}
        <SecaoTributacao />

        {/* Adicionais Mão de Obra */}
        <SecaoExtras />

        {/* Frota de Veículos */}
        <SecaoVeiculos />

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

        {/* Modelos de Email */}
        <SecaoEmailTemplates />

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
