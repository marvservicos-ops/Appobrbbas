'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Wrench, Building2, Search, Loader2, DollarSign, PackageCheck, HandCoins, Hammer, FileText, Briefcase } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Ferramenta, FerramentaEmprestimoItem } from '@/lib/types'
import ModalNovaFerramenta from './ModalNovaFerramenta'
import ModalNovoEmprestimo from './ModalNovoEmprestimo'
import FerramentaDetalheModal from './FerramentaDetalheModal'
import ModalEmprestimos from './ModalEmprestimos'

const STATUS_LABEL: Record<string, string> = {
  disponivel: 'Disponível',
  emprestada: 'Emprestada',
  em_manutencao: 'Em manutenção',
  baixada: 'Baixada',
}
const STATUS_COLOR: Record<string, string> = {
  disponivel: 'bg-emerald-50 text-emerald-700',
  emprestada: 'bg-amber-50 text-amber-700',
  em_manutencao: 'bg-red-50 text-red-700',
  baixada: 'bg-[#F1F5F9] text-[#64748B]',
}

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function FerramentasPanel({ estoqueId, modoPatrimonio = false }: { estoqueId: string; modoPatrimonio?: boolean }) {
  const [ferramentas, setFerramentas] = useState<Ferramenta[]>([])
  const [custodiaAtual, setCustodiaAtual] = useState<Record<string, FerramentaEmprestimoItem>>({})
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [ordenarPor, setOrdenarPor] = useState<'nome' | 'codigo_interno'>('nome')
  const [showNova, setShowNova] = useState(false)
  const [showEmprestimo, setShowEmprestimo] = useState(false)
  const [showEmprestimos, setShowEmprestimos] = useState(false)
  const [detalheId, setDetalheId] = useState<string | null>(null)

  async function load() {
    const supabase = createClient()
    const { data: ferrs } = await supabase
      .from('ferramentas')
      .select('*, responsavel_atual:funcionarios(id, nome)')
      .eq('estoque_id', estoqueId)
      .order('nome')
    setFerramentas((ferrs ?? []) as unknown as Ferramenta[])

    const emprestadas = (ferrs ?? []).filter(f => f.status === 'emprestada').map(f => f.id)
    if (emprestadas.length > 0) {
      const { data: itens } = await supabase
        .from('ferramenta_emprestimo_itens')
        .select('*, emprestimo:ferramenta_emprestimos(*, funcionario:funcionarios(id, nome))')
        .in('ferramenta_id', emprestadas)
        .is('data_devolucao', null)
      const map: Record<string, FerramentaEmprestimoItem> = {}
      for (const it of itens ?? []) map[it.ferramenta_id] = it as unknown as FerramentaEmprestimoItem
      setCustodiaAtual(map)
    } else {
      setCustodiaAtual({})
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [estoqueId])

  const topLevel = useMemo(() => ferramentas.filter(f => !f.mala_id), [ferramentas])

  const filtradas = useMemo(() => {
    return topLevel.filter(f => {
      if (filtroStatus !== 'todos' && f.status !== filtroStatus) return false
      if (busca.trim()) {
        const q = busca.toLowerCase()
        if (!f.nome.toLowerCase().includes(q)
          && !(f.codigo_interno ?? '').toLowerCase().includes(q)
          && !(f.marca ?? '').toLowerCase().includes(q)
          && !(f.modelo ?? '').toLowerCase().includes(q)
          && !(f.numero_serie ?? '').toLowerCase().includes(q)) return false
      }
      return true
    }).sort((a, b) => {
      if (ordenarPor === 'codigo_interno') {
        if (!a.codigo_interno && !b.codigo_interno) return a.nome.localeCompare(b.nome)
        if (!a.codigo_interno) return 1
        if (!b.codigo_interno) return -1
        return a.codigo_interno.localeCompare(b.codigo_interno, undefined, { numeric: true })
      }
      return a.nome.localeCompare(b.nome)
    })
  }, [topLevel, filtroStatus, busca, ordenarPor])

  const valorTotal = ferramentas.filter(f => f.status !== 'baixada').reduce((s, f) => s + (f.valor_aquisicao ?? 0), 0)
  const contagem = {
    disponivel: ferramentas.filter(f => f.status === 'disponivel').length,
    emprestada: ferramentas.filter(f => f.status === 'emprestada').length,
    em_manutencao: ferramentas.filter(f => f.status === 'em_manutencao').length,
    baixada: ferramentas.filter(f => f.status === 'baixada').length,
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 size={24} className="animate-spin text-[#4F7CFF]" />
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Cards de resumo */}
      <div className={`grid grid-cols-2 gap-3 ${modoPatrimonio ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center text-[#4F7CFF]"><DollarSign size={18} /></div>
          <div>
            <p className="text-xs text-[#64748B]">Patrimônio total</p>
            <p className="font-syne font-bold text-[#0F172A]">{moeda(valorTotal)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><PackageCheck size={18} /></div>
          <div>
            <p className="text-xs text-[#64748B]">Disponíveis</p>
            <p className="font-syne font-bold text-[#0F172A]">{contagem.disponivel}</p>
          </div>
        </div>
        {!modoPatrimonio && (
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><HandCoins size={18} /></div>
            <div>
              <p className="text-xs text-[#64748B]">Emprestadas</p>
              <p className="font-syne font-bold text-[#0F172A]">{contagem.emprestada}</p>
            </div>
          </div>
        )}
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600"><Hammer size={18} /></div>
          <div>
            <p className="text-xs text-[#64748B]">Em manutenção</p>
            <p className="font-syne font-bold text-[#0F172A]">{contagem.em_manutencao}</p>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input className="field pl-9 text-sm" placeholder="Buscar por código, nome, marca, modelo ou nº série..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <select className="field text-sm w-auto py-2" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="disponivel">Disponível</option>
          <option value="emprestada">Emprestada</option>
          <option value="em_manutencao">Em manutenção</option>
          <option value="baixada">Baixada</option>
        </select>
        <select className="field text-sm w-auto py-2" value={ordenarPor} onChange={e => setOrdenarPor(e.target.value as 'nome' | 'codigo_interno')}>
          <option value="nome">Ordenar por nome</option>
          <option value="codigo_interno">Ordenar por código</option>
        </select>
        {!modoPatrimonio && (
          <>
            <button onClick={() => setShowEmprestimos(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] transition-colors">
              <FileText size={14} /> Ver Empréstimos
            </button>
            <button onClick={() => setShowEmprestimo(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#4F7CFF] border border-[#4F7CFF] rounded-lg hover:bg-[#EEF2FF] transition-colors">
              <HandCoins size={14} /> Novo Empréstimo
            </button>
          </>
        )}
        <button onClick={() => setShowNova(true)} className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2">
          <Plus size={14} /> {modoPatrimonio ? 'Novo Item' : 'Nova Ferramenta'}
        </button>
      </div>

      {/* Grid */}
      {filtradas.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center">
            {modoPatrimonio ? <Building2 size={24} className="text-[#94A3B8]" /> : <Wrench size={24} className="text-[#94A3B8]" />}
          </div>
          <p className="font-medium text-[#374151]">{modoPatrimonio ? 'Nenhum item cadastrado' : 'Nenhuma ferramenta encontrada'}</p>
          <p className="text-sm text-[#94A3B8]">Clique em &quot;{modoPatrimonio ? 'Novo Item' : 'Nova Ferramenta'}&quot; para cadastrar o patrimônio</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtradas.map(f => {
            const custodia = custodiaAtual[f.id]
            const qtdItens = f.eh_mala ? ferramentas.filter(x => x.mala_id === f.id).length : 0
            return (
              <button key={f.id} onClick={() => setDetalheId(f.id)}
                className="card text-left hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {f.foto_url
                      ? <img src={f.foto_url} alt="" className="w-11 h-11 rounded-xl object-cover border border-[#E2E8F0]" />
                      : <div className="w-11 h-11 rounded-xl bg-[#F1F5F9] flex items-center justify-center text-[#94A3B8]">
                          {f.eh_mala ? <Briefcase size={18} /> : modoPatrimonio ? <Building2 size={18} /> : <Wrench size={18} />}
                        </div>}
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-syne font-semibold text-[#0F172A] leading-tight">{f.nome}</h3>
                        {f.codigo_interno && <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">{f.codigo_interno}</span>}
                        {f.eh_mala && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#EEF2FF] text-[#4F7CFF]">Mala · {qtdItens} {qtdItens === 1 ? 'item' : 'itens'}</span>}
                      </div>
                      {(f.marca || f.modelo) && <p className="text-xs text-[#64748B] mt-0.5">{[f.marca, f.modelo].filter(Boolean).join(' · ')}</p>}
                    </div>
                  </div>
                  {!f.eh_mala && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOR[f.status]}`}>
                      {STATUS_LABEL[f.status]}
                    </span>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs">
                  <span className="text-[#64748B]">{f.valor_aquisicao ? moeda(f.valor_aquisicao) : 'Sem valor cadastrado'}</span>
                  {f.eh_mala
                    ? (f.responsavel_atual
                        ? <span className="text-[#4F7CFF] font-medium">com {f.responsavel_atual.nome}</span>
                        : <span className="text-[#94A3B8]">sem responsável</span>)
                    : (custodia?.emprestimo?.funcionario && (
                        <span className="text-amber-700 font-medium">com {custodia.emprestimo.funcionario.nome}</span>
                      ))}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {showNova && <ModalNovaFerramenta estoqueId={estoqueId} modoPatrimonio={modoPatrimonio} onClose={() => setShowNova(false)} onCreated={() => { setShowNova(false); load() }} />}
      {showEmprestimo && <ModalNovoEmprestimo ferramentasDisponiveis={ferramentas.filter(f => f.status === 'disponivel' && !f.eh_mala && !f.mala_id)} onClose={() => setShowEmprestimo(false)} onCreated={() => { setShowEmprestimo(false); load() }} />}
      {detalheId && (
        <FerramentaDetalheModal
          ferramentaId={detalheId}
          onClose={() => setDetalheId(null)}
          onChanged={() => { load() }}
        />
      )}
      {showEmprestimos && <ModalEmprestimos estoqueId={estoqueId} onClose={() => setShowEmprestimos(false)} />}
    </div>
  )
}
