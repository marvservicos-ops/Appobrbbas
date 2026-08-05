'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sparkles, Upload, Loader2, X, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

type Categoria = 'combustivel' | 'investimento' | 'destinacao' | 'gas'

interface Extraido {
  categoria: Categoria | null
  data: string | null
  confianca?: string | null
  observacao?: string | null
  combustivel_tipo?: string | null
  combustivel_litros?: number | null
  combustivel_valor?: number | null
  combustivel_veiculo_placa?: string | null
  combustivel_veiculo_nome?: string | null
  investimento_item?: string | null
  investimento_categoria?: string | null
  investimento_quantidade?: number | null
  investimento_valor?: number | null
  destinacao_cliente?: string | null
  destinacao_material?: string | null
  destinacao_quantidade_kg?: number | null
  destinacao_valor?: number | null
  gas_empresa_emissora?: string | null
  gas_tipo?: string | null
  gas_quantidade_kg?: number | null
  gas_valor_recebido?: number | null
}

interface ItemIA {
  nomeArquivo: string
  categoria: Categoria | null
  confianca?: string | null
  observacao?: string | null
  erroAnalise?: string | null
  erroSalvar?: string | null
  salvo: boolean
  aberto: boolean
  // campos editáveis
  data: string
  veiculoId: string
  combustivelTipo: string
  litros: string
  valorCombustivel: string
  item: string
  categoriaInvestimento: string
  quantidade: string
  valorInvestimento: string
  cliente: string
  material: string
  quantidadeKg: string
  valorDestinacao: string
  empresaEmissora: string
  tipoGas: string
  quantidadeGasKg: string
  valorGas: string
  contratoId: string
}

const CATEGORIA_LABEL: Record<Categoria, string> = {
  combustivel: 'Combustível', investimento: 'Investimento', destinacao: 'Destinação de Materiais', gas: 'Reciclagem de Gás',
}

function itemVazio(nomeArquivo: string): ItemIA {
  return {
    nomeArquivo, categoria: null, salvo: false, aberto: true,
    data: new Date().toISOString().split('T')[0],
    veiculoId: '', combustivelTipo: 'Gasolina', litros: '', valorCombustivel: '',
    item: '', categoriaInvestimento: 'Ferramental', quantidade: '1', valorInvestimento: '',
    cliente: '', material: '', quantidadeKg: '', valorDestinacao: '',
    empresaEmissora: '', tipoGas: '', quantidadeGasKg: '', valorGas: '', contratoId: '',
  }
}

export default function ModalImportarEsgIA({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [files, setFiles] = useState<File[]>([])
  const [processando, setProcessando] = useState(false)
  const [progresso, setProgresso] = useState({ feito: 0, total: 0 })
  const [erroApi, setErroApi] = useState('')
  const [itens, setItens] = useState<ItemIA[]>([])
  const [saving, setSaving] = useState(false)

  const [veiculos, setVeiculos] = useState<{ id: string; nome: string; placa: string | null }[]>([])
  const [contratos, setContratos] = useState<{ id: string; numero_contrato: string | null; empresa?: { razao_social: string; apelido?: string | null } | null }[]>([])

  useEffect(() => {
    const sb = createClient()
    sb.from('veiculos').select('id, nome, placa').eq('ativo', true).order('nome').then(({ data }) => setVeiculos(data ?? []))
    sb.from('contratos_manutencao').select('id, numero_contrato, empresa:empresas(razao_social, apelido)').eq('ativo', true).then(({ data }) => setContratos((data ?? []) as any))
  }, [])

  function atualizar(idx: number, patch: Partial<ItemIA>) {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  function aplicarExtraido(base: ItemIA, p: Extraido): ItemIA {
    const patch: Partial<ItemIA> = { categoria: p.categoria ?? null, confianca: p.confianca, observacao: p.observacao }
    if (p.data) patch.data = p.data
    if (p.combustivel_tipo) patch.combustivelTipo = p.combustivel_tipo
    if (p.combustivel_litros != null) patch.litros = String(p.combustivel_litros)
    if (p.combustivel_valor != null) patch.valorCombustivel = String(p.combustivel_valor)
    if (p.investimento_item) patch.item = p.investimento_item
    if (p.investimento_categoria) patch.categoriaInvestimento = p.investimento_categoria
    if (p.investimento_quantidade != null) patch.quantidade = String(p.investimento_quantidade)
    if (p.investimento_valor != null) patch.valorInvestimento = String(p.investimento_valor)
    if (p.destinacao_cliente) patch.cliente = p.destinacao_cliente
    if (p.destinacao_material) patch.material = p.destinacao_material
    if (p.destinacao_quantidade_kg != null) patch.quantidadeKg = String(p.destinacao_quantidade_kg)
    if (p.destinacao_valor != null) patch.valorDestinacao = String(p.destinacao_valor)
    if (p.gas_empresa_emissora) patch.empresaEmissora = p.gas_empresa_emissora
    if (p.gas_tipo) patch.tipoGas = p.gas_tipo
    if (p.gas_quantidade_kg != null) patch.quantidadeGasKg = String(p.gas_quantidade_kg)
    if (p.gas_valor_recebido != null) patch.valorGas = String(p.gas_valor_recebido)
    if (p.combustivel_veiculo_placa) {
      const v = veiculos.find(v => (v.placa ?? '').toLowerCase().replace(/[-\s]/g, '') === p.combustivel_veiculo_placa!.toLowerCase().replace(/[-\s]/g, ''))
      if (v) patch.veiculoId = v.id
    }
    if (!patch.veiculoId && p.combustivel_veiculo_nome) {
      const nome = p.combustivel_veiculo_nome.toLowerCase().trim()
      const v = veiculos.find(v => v.nome.toLowerCase().includes(nome) || nome.includes(v.nome.toLowerCase()))
      if (v) patch.veiculoId = v.id
    }
    return { ...base, ...patch }
  }

  async function analisar() {
    if (files.length === 0) return
    setProcessando(true); setErroApi('')
    setProgresso({ feito: 0, total: files.length })
    const resultados: ItemIA[] = []

    for (const file of files) {
      let base = itemVazio(file.name)
      try {
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch('/api/parse-esg', { method: 'POST', body: fd })
        const parsed = await res.json()
        if (!res.ok) {
          base.erroAnalise = parsed?.error ?? 'Não foi possível analisar.'
        } else {
          base = aplicarExtraido(base, parsed)
        }
      } catch (err) {
        base.erroAnalise = 'Erro ao analisar: ' + String(err)
      }
      resultados.push(base)
      setProgresso(p => ({ ...p, feito: p.feito + 1 }))
    }

    // só o primeiro item fica aberto por padrão, resto colapsado
    resultados.forEach((it, i) => { it.aberto = i === 0 })
    setItens(resultados)
    setProcessando(false)
  }

  function removerItem(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  function toggleAberto(idx: number) {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, aberto: !it.aberto } : it))
  }

  async function salvarItem(idx: number, supabase: ReturnType<typeof createClient>): Promise<boolean> {
    const it = itens[idx]
    if (!it.categoria) { atualizar(idx, { erroSalvar: 'Selecione a categoria.' }); return false }

    let err: { message: string } | null = null

    if (it.categoria === 'combustivel') {
      if (!it.veiculoId || !it.litros || !it.valorCombustivel) { atualizar(idx, { erroSalvar: 'Preencha veículo, litros e valor.' }); return false }
      const r = await supabase.from('esg_combustivel').insert({
        data: it.data, veiculo_id: it.veiculoId, combustivel: it.combustivelTipo, litros: parseFloat(it.litros), valor: parseFloat(it.valorCombustivel),
      })
      err = r.error
    } else if (it.categoria === 'investimento') {
      if (!it.item.trim() || !it.valorInvestimento) { atualizar(idx, { erroSalvar: 'Preencha o item e o valor.' }); return false }
      const r = await supabase.from('esg_investimentos').insert({
        data: it.data, item: it.item.trim(), categoria: it.categoriaInvestimento, quantidade: parseFloat(it.quantidade) || 1, valor: parseFloat(it.valorInvestimento),
      })
      err = r.error
    } else if (it.categoria === 'destinacao') {
      if (!it.cliente.trim() || !it.material.trim() || !it.quantidadeKg) { atualizar(idx, { erroSalvar: 'Preencha cliente, material e quantidade.' }); return false }
      const r = await supabase.from('esg_destinacao_materiais').insert({
        data: it.data, cliente: it.cliente.trim(), material: it.material.trim(), quantidade: parseFloat(it.quantidadeKg), valor: it.valorDestinacao ? parseFloat(it.valorDestinacao) : null,
      })
      err = r.error
    } else if (it.categoria === 'gas') {
      if (!it.empresaEmissora.trim() || !it.tipoGas.trim() || !it.quantidadeGasKg) { atualizar(idx, { erroSalvar: 'Preencha empresa, tipo de gás e quantidade.' }); return false }
      const r = await supabase.from('esg_reciclagem_gas').insert({
        data: it.data, manutencao_contrato_id: it.contratoId || null, empresa_emissora: it.empresaEmissora.trim(), tipo_gas: it.tipoGas.trim(),
        quantidade: parseFloat(it.quantidadeGasKg), valor_recebido: it.valorGas ? parseFloat(it.valorGas) : null,
      })
      err = r.error
    }

    if (err) { atualizar(idx, { erroSalvar: err.message }); return false }
    atualizar(idx, { erroSalvar: null, salvo: true })
    return true
  }

  async function salvarTodos() {
    setSaving(true)
    const supabase = createClient()
    let algumFalhou = false
    for (let i = 0; i < itens.length; i++) {
      if (itens[i].salvo) continue
      const ok = await salvarItem(i, supabase)
      if (!ok) algumFalhou = true
    }
    setSaving(false)
    if (!algumFalhou) onSaved()
  }

  const pendentes = itens.filter(it => !it.salvo)
  const todosResolvidos = itens.length > 0 && itens.every(it => it.categoria)

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-syne font-semibold text-[#0F172A] flex items-center gap-2">
            <Sparkles size={16} className="text-[#4F7CFF]" /> Adicionar com IA
          </h3>
          <button onClick={onClose}><X size={16} className="text-[#64748B]" /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {itens.length === 0 && (
            <>
              <p className="text-sm text-[#64748B]">
                Envie uma ou várias fotos/PDFs de notas, cupons, comprovantes ou romaneios de uma vez. A IA analisa
                cada arquivo, identifica a categoria (combustível, investimento, destinação de material ou
                reciclagem de gás) e já preenche os campos — você confere e salva tudo de uma vez.
              </p>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#C7D2FE] rounded-xl py-8 cursor-pointer hover:bg-[#F8FAFF] transition-colors">
                <Upload size={22} className="text-[#4F7CFF]" />
                <span className="text-sm text-[#4F7CFF] font-medium">
                  {files.length > 0 ? `${files.length} arquivo${files.length > 1 ? 's' : ''} selecionado${files.length > 1 ? 's' : ''}` : 'Escolher arquivos (imagens ou PDFs)'}
                </span>
                <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={e => setFiles(Array.from(e.target.files ?? []))} />
              </label>
              {files.length > 0 && (
                <ul className="text-xs text-[#64748B] space-y-0.5 max-h-24 overflow-y-auto">
                  {files.map((f, i) => <li key={i}>· {f.name}</li>)}
                </ul>
              )}
              {erroApi && <p className="text-sm text-red-500">{erroApi}</p>}
              <button onClick={analisar} disabled={files.length === 0 || processando} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                {processando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {processando ? `Analisando ${progresso.feito}/${progresso.total}...` : `Analisar ${files.length > 1 ? `${files.length} arquivos` : 'com IA'}`}
              </button>
            </>
          )}

          {itens.length > 0 && (
            <div className="space-y-3">
              {itens.map((it, idx) => (
                <div key={idx} className={`border rounded-xl overflow-hidden ${it.salvo ? 'border-emerald-200 bg-emerald-50/40' : 'border-[#E2E8F0]'}`}>
                  <button type="button" onClick={() => toggleAberto(idx)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[#F8FAFC] transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      {it.salvo ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> : it.categoria ? <CheckCircle2 size={15} className="text-[#4F7CFF] shrink-0" /> : <AlertTriangle size={15} className="text-amber-500 shrink-0" />}
                      <span className="text-sm font-medium text-[#0F172A] truncate">{it.nomeArquivo}</span>
                      {it.categoria && <span className="text-xs text-[#94A3B8] shrink-0">· {CATEGORIA_LABEL[it.categoria]}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!it.salvo && (
                        <span onClick={e => { e.stopPropagation(); removerItem(idx) }} className="text-[#CBD5E1] hover:text-red-500 p-1">
                          <Trash2 size={13} />
                        </span>
                      )}
                      {it.aberto ? <ChevronUp size={14} className="text-[#94A3B8]" /> : <ChevronDown size={14} className="text-[#94A3B8]" />}
                    </div>
                  </button>

                  {it.aberto && !it.salvo && (
                    <div className="px-4 pb-4 space-y-3 border-t border-[#F1F5F9] pt-3">
                      {it.erroAnalise && <p className="text-xs text-red-500">{it.erroAnalise}</p>}
                      {it.observacao && <p className="text-xs text-[#94A3B8]">{it.observacao}</p>}

                      {!it.categoria && (
                        <div className="grid grid-cols-2 gap-2">
                          {(Object.keys(CATEGORIA_LABEL) as Categoria[]).map(c => (
                            <button key={c} type="button" onClick={() => atualizar(idx, { categoria: c })}
                              className="text-xs font-medium border border-[#E2E8F0] rounded-lg py-2 hover:bg-[#F8FAFC]">
                              {CATEGORIA_LABEL[c]}
                            </button>
                          ))}
                        </div>
                      )}

                      {it.categoria && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-[#64748B] mb-1">Data</label>
                            <input type="date" className="field text-sm" value={it.data} onChange={e => atualizar(idx, { data: e.target.value })} />
                          </div>

                          {it.categoria === 'combustivel' && (
                            <>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-[#64748B] mb-1">Veículo *</label>
                                  <select className="field text-sm" value={it.veiculoId} onChange={e => atualizar(idx, { veiculoId: e.target.value })}>
                                    <option value="">Selecione...</option>
                                    {veiculos.map(v => <option key={v.id} value={v.id}>{v.nome}{v.placa ? ` — ${v.placa}` : ''}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-[#64748B] mb-1">Combustível</label>
                                  <select className="field text-sm" value={it.combustivelTipo} onChange={e => atualizar(idx, { combustivelTipo: e.target.value })}>
                                    <option value="Gasolina">Gasolina</option>
                                    <option value="Diesel">Diesel</option>
                                    <option value="Etanol">Etanol</option>
                                    <option value="GNV">GNV</option>
                                  </select>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-[#64748B] mb-1">Litros *</label>
                                  <input type="number" min="0" step="any" className="field text-sm" value={it.litros} onChange={e => atualizar(idx, { litros: e.target.value })} />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-[#64748B] mb-1">Valor (R$) *</label>
                                  <input type="number" min="0" step="any" className="field text-sm" value={it.valorCombustivel} onChange={e => atualizar(idx, { valorCombustivel: e.target.value })} />
                                </div>
                              </div>
                            </>
                          )}

                          {it.categoria === 'investimento' && (
                            <>
                              <div>
                                <label className="block text-xs font-medium text-[#64748B] mb-1">Item *</label>
                                <input className="field text-sm" value={it.item} onChange={e => atualizar(idx, { item: e.target.value })} />
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-[#64748B] mb-1">Categoria</label>
                                  <select className="field text-sm" value={it.categoriaInvestimento} onChange={e => atualizar(idx, { categoriaInvestimento: e.target.value })}>
                                    <option value="Ambiental">Ambiental</option>
                                    <option value="Social">Social</option>
                                    <option value="Ferramental">Ferramental</option>
                                    <option value="SST">SST</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-[#64748B] mb-1">Quantidade</label>
                                  <input type="number" min="0" step="any" className="field text-sm" value={it.quantidade} onChange={e => atualizar(idx, { quantidade: e.target.value })} />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-[#64748B] mb-1">Valor (R$) *</label>
                                  <input type="number" min="0" step="any" className="field text-sm" value={it.valorInvestimento} onChange={e => atualizar(idx, { valorInvestimento: e.target.value })} />
                                </div>
                              </div>
                            </>
                          )}

                          {it.categoria === 'destinacao' && (
                            <>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-[#64748B] mb-1">Material *</label>
                                  <input className="field text-sm" value={it.material} onChange={e => atualizar(idx, { material: e.target.value })} />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-[#64748B] mb-1">Cliente / Destino *</label>
                                  <input className="field text-sm" value={it.cliente} onChange={e => atualizar(idx, { cliente: e.target.value })} />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-[#64748B] mb-1">Quantidade (kg) *</label>
                                  <input type="number" min="0" step="any" className="field text-sm" value={it.quantidadeKg} onChange={e => atualizar(idx, { quantidadeKg: e.target.value })} />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-[#64748B] mb-1">Valor recebido (R$)</label>
                                  <input type="number" min="0" step="any" className="field text-sm" value={it.valorDestinacao} onChange={e => atualizar(idx, { valorDestinacao: e.target.value })} />
                                </div>
                              </div>
                            </>
                          )}

                          {it.categoria === 'gas' && (
                            <>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-[#64748B] mb-1">Tipo de gás *</label>
                                  <input className="field text-sm" value={it.tipoGas} onChange={e => atualizar(idx, { tipoGas: e.target.value })} placeholder="Ex: R-410A" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-[#64748B] mb-1">Empresa emissora *</label>
                                  <input className="field text-sm" value={it.empresaEmissora} onChange={e => atualizar(idx, { empresaEmissora: e.target.value })} />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-[#64748B] mb-1">Contrato de manutenção (opcional)</label>
                                <select className="field text-sm" value={it.contratoId} onChange={e => atualizar(idx, { contratoId: e.target.value })}>
                                  <option value="">Nenhum / cliente avulso</option>
                                  {contratos.map(c => (
                                    <option key={c.id} value={c.id}>{(c.empresa?.apelido || c.empresa?.razao_social || 'Sem empresa')}{c.numero_contrato ? ` · ${c.numero_contrato}` : ''}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-[#64748B] mb-1">Quantidade (kg) *</label>
                                  <input type="number" min="0" step="any" className="field text-sm" value={it.quantidadeGasKg} onChange={e => atualizar(idx, { quantidadeGasKg: e.target.value })} />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-[#64748B] mb-1">Valor recebido (R$)</label>
                                  <input type="number" min="0" step="any" className="field text-sm" value={it.valorGas} onChange={e => atualizar(idx, { valorGas: e.target.value })} />
                                </div>
                              </div>
                            </>
                          )}
                        </>
                      )}

                      {it.erroSalvar && <p className="text-xs text-red-500">{it.erroSalvar}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {itens.length > 0 && (
          <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-[#E2E8F0]">
            <span className="text-xs text-[#94A3B8]">{itens.length - pendentes.length}/{itens.length} salvos</span>
            <div className="flex gap-2">
              <button onClick={onClose} className="text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg px-3 py-1.5">
                {pendentes.length === 0 ? 'Fechar' : 'Cancelar'}
              </button>
              {pendentes.length > 0 && (
                <button onClick={salvarTodos} disabled={saving || !todosResolvidos} className="btn-primary disabled:opacity-50">
                  {saving ? 'Salvando...' : `Salvar ${pendentes.length > 1 ? `todos (${pendentes.length})` : ''}`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
