'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Wrench, QrCode, Undo2, Hammer, Ban, CheckCircle2, Pencil, Briefcase, UserCheck, Plus, ChevronLeft, Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Ferramenta, FerramentaEmprestimoItem, FerramentaDefeito } from '@/lib/types'
import ModalDevolverItem from './ModalDevolverItem'
import ModalDefeito from './ModalDefeito'
import ModalEditarFerramenta from './ModalEditarFerramenta'
import ModalAtribuirMala from './ModalAtribuirMala'
import ModalNovaFerramenta from './ModalNovaFerramenta'

const STATUS_LABEL: Record<string, string> = {
  disponivel: 'Disponível', emprestada: 'Emprestada', em_manutencao: 'Em manutenção', baixada: 'Baixada',
}
const STATUS_COLOR: Record<string, string> = {
  disponivel: 'bg-emerald-50 text-emerald-700', emprestada: 'bg-amber-50 text-amber-700',
  em_manutencao: 'bg-red-50 text-red-700', baixada: 'bg-[#F1F5F9] text-[#64748B]',
}
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

export default function FerramentaDetalheModal({ ferramentaId, onClose, onChanged }: {
  ferramentaId: string; onClose: () => void; onChanged: () => void
}) {
  const [currentId, setCurrentId] = useState(ferramentaId)
  const [voltarPara, setVoltarPara] = useState<string | null>(null)
  const [ferramenta, setFerramenta] = useState<Ferramenta | null>(null)
  const [conteudoMala, setConteudoMala] = useState<Ferramenta[]>([])
  const [historicoEmprestimos, setHistoricoEmprestimos] = useState<FerramentaEmprestimoItem[]>([])
  const [defeitos, setDefeitos] = useState<FerramentaDefeito[]>([])
  const [loading, setLoading] = useState(true)
  const [showQr, setShowQr] = useState(false)
  const [showDevolver, setShowDevolver] = useState(false)
  const [showDefeito, setShowDefeito] = useState(false)
  const [showEditar, setShowEditar] = useState(false)
  const [showAtribuir, setShowAtribuir] = useState(false)
  const [showNovoItemMala, setShowNovoItemMala] = useState(false)
  const [processando, setProcessando] = useState(false)

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const [{ data: f }, { data: hist }, { data: defs }] = await Promise.all([
      supabase.from('ferramentas').select('*, mala:mala_id(id, nome, codigo_interno), responsavel_atual:funcionarios(id, nome)').eq('id', currentId).single(),
      supabase.from('ferramenta_emprestimo_itens').select('*, emprestimo:ferramenta_emprestimos(*, funcionario:funcionarios(id, nome))').eq('ferramenta_id', currentId).order('created_at', { ascending: false }),
      supabase.from('ferramenta_defeitos').select('*').eq('ferramenta_id', currentId).order('data', { ascending: false }),
    ])
    setFerramenta(f as unknown as Ferramenta)
    setHistoricoEmprestimos((hist ?? []) as unknown as FerramentaEmprestimoItem[])
    setDefeitos(defs ?? [])

    if ((f as any)?.eh_mala) {
      const { data: itens } = await supabase.from('ferramentas').select('*').eq('mala_id', currentId).order('nome')
      setConteudoMala(itens ?? [])
    } else {
      setConteudoMala([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [currentId])

  function abrirFilho(id: string) {
    setVoltarPara(currentId)
    setCurrentId(id)
  }
  function voltar() {
    if (voltarPara) { setCurrentId(voltarPara); setVoltarPara(null) }
  }

  const itemAberto = historicoEmprestimos.find(h => !h.data_devolucao)

  async function concluirManutencao() {
    if (!ferramenta) return
    setProcessando(true)
    const supabase = createClient()
    const defeitoAberto = defeitos.find(d => !d.resolvido)
    if (defeitoAberto) {
      await supabase.from('ferramenta_defeitos').update({ resolvido: true, data_resolucao: new Date().toISOString().split('T')[0] }).eq('id', defeitoAberto.id)
    }
    await supabase.from('ferramentas').update({ status: 'disponivel' }).eq('id', ferramenta.id)
    setProcessando(false)
    load(); onChanged()
  }

  async function darBaixa() {
    if (!ferramenta) return
    if (!confirm('Dar baixa nesta ferramenta? Essa ação é definitiva e ela deixará de contar no patrimônio ativo.')) return
    setProcessando(true)
    const supabase = createClient()
    await supabase.from('ferramentas').update({ status: 'baixada' }).eq('id', ferramenta.id)
    setProcessando(false)
    load(); onChanged()
  }

  const url = typeof window !== 'undefined' && ferramenta ? `${window.location.origin}/pub/ferramenta/${ferramenta.id}` : ''
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(url)}`

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[calc(100dvh-env(safe-area-inset-top))] overflow-y-auto mt-auto sm:mt-0">
        {loading || !ferramenta ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={24} className="animate-spin text-[#4F7CFF]" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                {voltarPara && (
                  <button onClick={voltar} className="text-[#94A3B8] hover:text-[#4F7CFF] transition-colors" title="Voltar para a mala">
                    <ChevronLeft size={16} />
                  </button>
                )}
                <h2 className="font-syne font-semibold text-[#0F172A]">{ferramenta.nome}</h2>
                {ferramenta.codigo_interno && <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">{ferramenta.codigo_interno}</span>}
                <button onClick={() => setShowEditar(true)} className="text-[#94A3B8] hover:text-[#4F7CFF] transition-colors" title="Editar ferramenta">
                  <Pencil size={14} />
                </button>
              </div>
              <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
            </div>

            <div className="p-4 md:p-6 space-y-5">
              {ferramenta.mala_id && ferramenta.mala && (
                <button onClick={() => abrirFilho(ferramenta.mala!.id)}
                  className="w-full text-left flex items-center gap-2 text-xs text-[#4F7CFF] bg-[#EEF2FF] px-3 py-2 rounded-lg hover:bg-[#E0E7FF] transition-colors">
                  <Briefcase size={13} /> Faz parte da mala <strong>{ferramenta.mala.nome}</strong>{ferramenta.mala.codigo_interno ? ` (${ferramenta.mala.codigo_interno})` : ''}
                </button>
              )}

              <div className="flex items-center gap-4">
                {ferramenta.foto_url
                  ? <img src={ferramenta.foto_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-[#E2E8F0]" />
                  : <div className="w-16 h-16 rounded-xl bg-[#F1F5F9] flex items-center justify-center text-[#94A3B8]">
                      {ferramenta.eh_mala ? <Briefcase size={22} /> : <Wrench size={22} />}
                    </div>}
                <div>
                  {ferramenta.eh_mala ? (
                    ferramenta.responsavel_atual
                      ? <p className="text-sm font-medium text-[#4F7CFF]">Com {ferramenta.responsavel_atual.nome}</p>
                      : <p className="text-sm text-[#94A3B8]">Sem responsável definido</p>
                  ) : (
                    <>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[ferramenta.status]}`}>
                        {STATUS_LABEL[ferramenta.status]}
                      </span>
                      {itemAberto?.emprestimo?.funcionario && (
                        <p className="text-xs text-amber-700 font-medium mt-1">com {itemAberto.emprestimo.funcionario.nome} desde {fmtData(itemAberto.emprestimo.data_emprestimo)}</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-[#94A3B8]">Código interno</p><p className="text-[#374151] font-mono">{ferramenta.codigo_interno || '—'}</p></div>
                <div><p className="text-xs text-[#94A3B8]">Categoria</p><p className="text-[#374151]">{ferramenta.categoria || '—'}</p></div>
                <div><p className="text-xs text-[#94A3B8]">Marca / Modelo</p><p className="text-[#374151]">{[ferramenta.marca, ferramenta.modelo].filter(Boolean).join(' · ') || '—'}</p></div>
                <div><p className="text-xs text-[#94A3B8]">Nº de série</p><p className="text-[#374151]">{ferramenta.numero_serie || '—'}</p></div>
                <div><p className="text-xs text-[#94A3B8]">Valor de aquisição</p><p className="text-[#374151]">{ferramenta.valor_aquisicao ? moeda(ferramenta.valor_aquisicao) : '—'}</p></div>
              </div>

              {/* Ações */}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowQr(true)}
                  className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0] px-3 py-1.5 rounded-xl hover:bg-[#F8FAFC] transition-colors">
                  <QrCode size={13} /> QR Code
                </button>
                {ferramenta.eh_mala && (
                  <button onClick={() => setShowAtribuir(true)}
                    className="flex items-center gap-1.5 text-xs text-[#4F7CFF] border border-[#C7D2FE] px-3 py-1.5 rounded-xl hover:bg-[#EEF2FF] transition-colors">
                    <UserCheck size={13} /> {ferramenta.responsavel_atual ? 'Trocar responsável' : 'Atribuir responsável'}
                  </button>
                )}
                {ferramenta.eh_mala && (
                  <a href={`/print/mala/${ferramenta.id}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0] px-3 py-1.5 rounded-xl hover:bg-[#F8FAFC] transition-colors">
                    <Printer size={13} /> Imprimir contrato
                  </a>
                )}
                {!ferramenta.eh_mala && !ferramenta.mala_id && ferramenta.status === 'emprestada' && itemAberto && (
                  <button onClick={() => setShowDevolver(true)}
                    className="flex items-center gap-1.5 text-xs text-amber-700 border border-amber-200 px-3 py-1.5 rounded-xl hover:bg-amber-50 transition-colors">
                    <Undo2 size={13} /> Devolver
                  </button>
                )}
                {!ferramenta.eh_mala && ferramenta.status !== 'emprestada' && ferramenta.status !== 'baixada' && ferramenta.status !== 'em_manutencao' && (
                  <button onClick={() => setShowDefeito(true)}
                    className="flex items-center gap-1.5 text-xs text-red-700 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors">
                    <Hammer size={13} /> Registrar defeito
                  </button>
                )}
                {!ferramenta.eh_mala && ferramenta.status === 'em_manutencao' && (
                  <button onClick={concluirManutencao} disabled={processando}
                    className="flex items-center gap-1.5 text-xs text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl hover:bg-emerald-50 transition-colors">
                    <CheckCircle2 size={13} /> Concluir manutenção
                  </button>
                )}
                {!ferramenta.eh_mala && (ferramenta.status === 'disponivel' || ferramenta.status === 'em_manutencao') && (
                  <button onClick={darBaixa} disabled={processando}
                    className="flex items-center gap-1.5 text-xs text-[#64748B] border border-[#E2E8F0] px-3 py-1.5 rounded-xl hover:bg-[#F1F5F9] transition-colors ml-auto">
                    <Ban size={13} /> Dar baixa
                  </button>
                )}
              </div>

              {/* Conteúdo da mala */}
              {ferramenta.eh_mala && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#374151]">Conteúdo da mala</h3>
                    <button onClick={() => setShowNovoItemMala(true)} className="flex items-center gap-1 text-xs font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] px-2 py-1 rounded-lg transition-colors">
                      <Plus size={12} /> Adicionar item
                    </button>
                  </div>
                  {conteudoMala.length === 0 ? (
                    <p className="text-xs text-[#94A3B8]">Nenhuma ferramenta cadastrada nesta mala ainda.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {conteudoMala.map(item => (
                        <button key={item.id} onClick={() => abrirFilho(item.id)}
                          className="w-full flex items-center justify-between text-xs bg-[#F8FAFC] hover:bg-[#F1F5F9] rounded-lg px-3 py-2 transition-colors text-left">
                          <span className="text-[#374151] font-medium">{item.nome}{item.codigo_interno ? ` · ${item.codigo_interno}` : ''}</span>
                          <span className={`px-1.5 py-0.5 rounded-full font-semibold ${STATUS_COLOR[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Histórico de empréstimos */}
              {!ferramenta.eh_mala && !ferramenta.mala_id && (
                <div>
                  <h3 className="text-sm font-semibold text-[#374151] mb-2">Histórico de empréstimos</h3>
                  {historicoEmprestimos.length === 0 ? (
                    <p className="text-xs text-[#94A3B8]">Nenhum empréstimo registrado.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {historicoEmprestimos.map(h => (
                        <div key={h.id} className="flex items-center justify-between text-xs bg-[#F8FAFC] rounded-lg px-3 py-2">
                          <span className="text-[#374151]">{h.emprestimo?.funcionario?.nome ?? '—'}</span>
                          <span className="text-[#94A3B8]">{fmtData(h.emprestimo?.data_emprestimo)} → {h.data_devolucao ? fmtData(h.data_devolucao) : 'em aberto'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Histórico de defeitos */}
              <div>
                <h3 className="text-sm font-semibold text-[#374151] mb-2">Histórico de defeitos</h3>
                {defeitos.length === 0 ? (
                  <p className="text-xs text-[#94A3B8]">Nenhum defeito registrado.</p>
                ) : (
                  <div className="space-y-1.5">
                    {defeitos.map(d => (
                      <div key={d.id} className="text-xs bg-[#F8FAFC] rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[#374151] font-medium">{d.descricao}</span>
                          <span className={d.resolvido ? 'text-emerald-600' : 'text-red-600'}>{d.resolvido ? 'Resolvido' : 'Em aberto'}</span>
                        </div>
                        <span className="text-[#94A3B8]">{fmtData(d.data)}{d.custo ? ` · ${moeda(d.custo)}` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {showQr && ferramenta && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => setShowQr(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-col items-center gap-4 max-w-xs w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-syne font-semibold text-[#0F172A]">QR Code da Ferramenta</h3>
            <img src={qrSrc} alt="QR Code" className="w-56 h-56 rounded-xl" />
            <p className="text-xs text-[#94A3B8] text-center">Escaneie para ver a ficha pública desta ferramenta</p>
            <div className="flex gap-2 w-full">
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center text-xs text-[#4F7CFF] border border-[#C7D2FE] px-3 py-2 rounded-lg hover:bg-[#EEF2FF] transition-colors">
                Abrir ficha
              </a>
              <a href={`/pub/etiqueta-ferramenta/${ferramenta.id}`} target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center text-xs bg-[#4F7CFF] text-white px-3 py-2 rounded-lg hover:bg-[#3D68F0] transition-colors">
                Imprimir etiqueta
              </a>
            </div>
            <button onClick={() => setShowQr(false)} className="text-xs text-[#94A3B8] hover:text-[#64748B]">Fechar</button>
          </div>
        </div>
      )}

      {showDevolver && itemAberto && (
        <ModalDevolverItem item={itemAberto} onClose={() => setShowDevolver(false)} onSaved={() => { setShowDevolver(false); load(); onChanged() }} />
      )}
      {showDefeito && ferramenta && (
        <ModalDefeito ferramentaId={ferramenta.id} onClose={() => setShowDefeito(false)} onSaved={() => { setShowDefeito(false); load(); onChanged() }} />
      )}
      {showEditar && ferramenta && (
        <ModalEditarFerramenta ferramenta={ferramenta} onClose={() => setShowEditar(false)} onSaved={() => { setShowEditar(false); load(); onChanged() }} />
      )}
      {showAtribuir && ferramenta && (
        <ModalAtribuirMala ferramentaId={ferramenta.id} responsavelAtualId={ferramenta.responsavel_atual_id}
          onClose={() => setShowAtribuir(false)}
          onSaved={() => { setShowAtribuir(false); load(); onChanged(); window.open(`/print/mala/${ferramenta.id}`, '_blank') }} />
      )}
      {showNovoItemMala && ferramenta && (
        <ModalNovaFerramenta estoqueId={ferramenta.estoque_id} malaIdPadrao={ferramenta.id}
          onClose={() => setShowNovoItemMala(false)}
          onCreated={() => { setShowNovoItemMala(false); load(); onChanged(); window.open(`/print/mala/${ferramenta.id}`, '_blank') }} />
      )}
    </div>
  )
}
