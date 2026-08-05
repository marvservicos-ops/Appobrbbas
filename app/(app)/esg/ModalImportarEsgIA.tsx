'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sparkles, Upload, Loader2, X, AlertTriangle, CheckCircle2 } from 'lucide-react'

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

const CATEGORIA_LABEL: Record<Categoria, string> = {
  combustivel: 'Combustível', investimento: 'Investimento', destinacao: 'Destinação de Materiais', gas: 'Reciclagem de Gás',
}

export default function ModalImportarEsgIA({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [processando, setProcessando] = useState(false)
  const [erroApi, setErroApi] = useState('')
  const [extraido, setExtraido] = useState<Extraido | null>(null)
  const [categoria, setCategoria] = useState<Categoria | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [veiculos, setVeiculos] = useState<{ id: string; nome: string; placa: string | null }[]>([])
  const [contratos, setContratos] = useState<{ id: string; numero_contrato: string | null; empresa?: { razao_social: string; apelido?: string | null } | null }[]>([])

  // campos editáveis
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [veiculoId, setVeiculoId] = useState('')
  const [combustivelTipo, setCombustivelTipo] = useState('Gasolina')
  const [litros, setLitros] = useState('')
  const [valorCombustivel, setValorCombustivel] = useState('')
  const [item, setItem] = useState('')
  const [categoriaInvestimento, setCategoriaInvestimento] = useState('Ferramental')
  const [quantidade, setQuantidade] = useState('1')
  const [valorInvestimento, setValorInvestimento] = useState('')
  const [cliente, setCliente] = useState('')
  const [material, setMaterial] = useState('')
  const [quantidadeKg, setQuantidadeKg] = useState('')
  const [valorDestinacao, setValorDestinacao] = useState('')
  const [empresaEmissora, setEmpresaEmissora] = useState('')
  const [tipoGas, setTipoGas] = useState('')
  const [quantidadeGasKg, setQuantidadeGasKg] = useState('')
  const [valorGas, setValorGas] = useState('')
  const [contratoId, setContratoId] = useState('')

  useEffect(() => {
    const sb = createClient()
    sb.from('veiculos').select('id, nome, placa').eq('ativo', true).order('nome').then(({ data }) => setVeiculos(data ?? []))
    sb.from('contratos_manutencao').select('id, numero_contrato, empresa:empresas(razao_social, apelido)').eq('ativo', true).then(({ data }) => setContratos((data ?? []) as any))
  }, [])

  async function analisar() {
    if (!file) return
    setProcessando(true); setErroApi('')
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/parse-esg', { method: 'POST', body: fd })
      const parsed = await res.json()
      if (!res.ok) { setErroApi(parsed?.error ?? 'Não foi possível analisar o documento.'); setProcessando(false); return }
      setExtraido(parsed)
      aplicarExtraido(parsed)
      setCategoria(parsed.categoria ?? null)
    } catch (err) {
      setErroApi('Erro ao analisar: ' + String(err))
    }
    setProcessando(false)
  }

  function aplicarExtraido(p: Extraido) {
    if (p.data) setData(p.data)
    if (p.combustivel_tipo) setCombustivelTipo(p.combustivel_tipo)
    if (p.combustivel_litros != null) setLitros(String(p.combustivel_litros))
    if (p.combustivel_valor != null) setValorCombustivel(String(p.combustivel_valor))
    if (p.investimento_item) setItem(p.investimento_item)
    if (p.investimento_categoria) setCategoriaInvestimento(p.investimento_categoria)
    if (p.investimento_quantidade != null) setQuantidade(String(p.investimento_quantidade))
    if (p.investimento_valor != null) setValorInvestimento(String(p.investimento_valor))
    if (p.destinacao_cliente) setCliente(p.destinacao_cliente)
    if (p.destinacao_material) setMaterial(p.destinacao_material)
    if (p.destinacao_quantidade_kg != null) setQuantidadeKg(String(p.destinacao_quantidade_kg))
    if (p.destinacao_valor != null) setValorDestinacao(String(p.destinacao_valor))
    if (p.gas_empresa_emissora) setEmpresaEmissora(p.gas_empresa_emissora)
    if (p.gas_tipo) setTipoGas(p.gas_tipo)
    if (p.gas_quantidade_kg != null) setQuantidadeGasKg(String(p.gas_quantidade_kg))
    if (p.gas_valor_recebido != null) setValorGas(String(p.gas_valor_recebido))

    if (p.combustivel_veiculo_placa) {
      const v = veiculos.find(v => (v.placa ?? '').toLowerCase().replace(/[-\s]/g, '') === p.combustivel_veiculo_placa!.toLowerCase().replace(/[-\s]/g, ''))
      if (v) setVeiculoId(v.id)
    }
  }

  async function salvar() {
    setError('')
    if (!categoria) { setError('Selecione a categoria.'); return }
    setSaving(true)
    const supabase = createClient()
    let err = null

    if (categoria === 'combustivel') {
      if (!veiculoId) { setError('Selecione o veículo.'); setSaving(false); return }
      if (!litros || !valorCombustivel) { setError('Preencha litros e valor.'); setSaving(false); return }
      const r = await supabase.from('esg_combustivel').insert({
        data, veiculo_id: veiculoId, combustivel: combustivelTipo, litros: parseFloat(litros), valor: parseFloat(valorCombustivel),
      })
      err = r.error
    } else if (categoria === 'investimento') {
      if (!item.trim() || !valorInvestimento) { setError('Preencha o item e o valor.'); setSaving(false); return }
      const r = await supabase.from('esg_investimentos').insert({
        data, item: item.trim(), categoria: categoriaInvestimento, quantidade: parseFloat(quantidade) || 1, valor: parseFloat(valorInvestimento),
      })
      err = r.error
    } else if (categoria === 'destinacao') {
      if (!cliente.trim() || !material.trim() || !quantidadeKg) { setError('Preencha cliente, material e quantidade.'); setSaving(false); return }
      const r = await supabase.from('esg_destinacao_materiais').insert({
        data, cliente: cliente.trim(), material: material.trim(), quantidade: parseFloat(quantidadeKg), valor: valorDestinacao ? parseFloat(valorDestinacao) : null,
      })
      err = r.error
    } else if (categoria === 'gas') {
      if (!empresaEmissora.trim() || !tipoGas.trim() || !quantidadeGasKg) { setError('Preencha empresa, tipo de gás e quantidade.'); setSaving(false); return }
      const r = await supabase.from('esg_reciclagem_gas').insert({
        data, manutencao_contrato_id: contratoId || null, empresa_emissora: empresaEmissora.trim(), tipo_gas: tipoGas.trim(),
        quantidade: parseFloat(quantidadeGasKg), valor_recebido: valorGas ? parseFloat(valorGas) : null,
      })
      err = r.error
    }

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

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
          {!extraido && (
            <>
              <p className="text-sm text-[#64748B]">
                Envie uma foto ou PDF de nota fiscal, cupom, comprovante ou romaneio. A IA identifica se é
                combustível, investimento, destinação de material ou reciclagem de gás, e já preenche os campos —
                você confere e salva.
              </p>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#C7D2FE] rounded-xl py-8 cursor-pointer hover:bg-[#F8FAFF] transition-colors">
                <Upload size={22} className="text-[#4F7CFF]" />
                <span className="text-sm text-[#4F7CFF] font-medium">{file ? file.name : 'Escolher arquivo (imagem ou PDF)'}</span>
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>
              {erroApi && <p className="text-sm text-red-500">{erroApi}</p>}
              <button onClick={analisar} disabled={!file || processando} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                {processando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {processando ? 'Analisando...' : 'Analisar com IA'}
              </button>
            </>
          )}

          {extraido && (
            <>
              {categoria ? (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-[#EEF2FF] border border-[#C7D2FE] rounded-lg text-sm text-[#4338CA]">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  <span>Identificado como <strong>{CATEGORIA_LABEL[categoria]}</strong>{extraido.confianca ? ` (confiança ${extraido.confianca})` : ''}. Confira os dados abaixo antes de salvar.</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>Não consegui identificar automaticamente. Selecione a categoria manualmente.</span>
                </div>
              )}
              {extraido.observacao && <p className="text-xs text-[#94A3B8]">{extraido.observacao}</p>}

              {!categoria && (
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(CATEGORIA_LABEL) as Categoria[]).map(c => (
                    <button key={c} type="button" onClick={() => setCategoria(c)}
                      className="text-sm font-medium border border-[#E2E8F0] rounded-lg py-2 hover:bg-[#F8FAFC]">
                      {CATEGORIA_LABEL[c]}
                    </button>
                  ))}
                </div>
              )}

              {categoria && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#64748B] mb-1">Data</label>
                    <input type="date" className="field text-sm" value={data} onChange={e => setData(e.target.value)} />
                  </div>

                  {categoria === 'combustivel' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[#64748B] mb-1">Veículo *</label>
                          <select className="field text-sm" value={veiculoId} onChange={e => setVeiculoId(e.target.value)}>
                            <option value="">Selecione...</option>
                            {veiculos.map(v => <option key={v.id} value={v.id}>{v.nome}{v.placa ? ` — ${v.placa}` : ''}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#64748B] mb-1">Combustível</label>
                          <select className="field text-sm" value={combustivelTipo} onChange={e => setCombustivelTipo(e.target.value)}>
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
                          <input type="number" min="0" step="any" className="field text-sm" value={litros} onChange={e => setLitros(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#64748B] mb-1">Valor (R$) *</label>
                          <input type="number" min="0" step="any" className="field text-sm" value={valorCombustivel} onChange={e => setValorCombustivel(e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}

                  {categoria === 'investimento' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-[#64748B] mb-1">Item *</label>
                        <input className="field text-sm" value={item} onChange={e => setItem(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[#64748B] mb-1">Categoria</label>
                          <select className="field text-sm" value={categoriaInvestimento} onChange={e => setCategoriaInvestimento(e.target.value)}>
                            <option value="Ambiental">Ambiental</option>
                            <option value="Social">Social</option>
                            <option value="Ferramental">Ferramental</option>
                            <option value="SST">SST</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#64748B] mb-1">Quantidade</label>
                          <input type="number" min="0" step="any" className="field text-sm" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#64748B] mb-1">Valor (R$) *</label>
                          <input type="number" min="0" step="any" className="field text-sm" value={valorInvestimento} onChange={e => setValorInvestimento(e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}

                  {categoria === 'destinacao' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[#64748B] mb-1">Material *</label>
                          <input className="field text-sm" value={material} onChange={e => setMaterial(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#64748B] mb-1">Cliente / Destino *</label>
                          <input className="field text-sm" value={cliente} onChange={e => setCliente(e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[#64748B] mb-1">Quantidade (kg) *</label>
                          <input type="number" min="0" step="any" className="field text-sm" value={quantidadeKg} onChange={e => setQuantidadeKg(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#64748B] mb-1">Valor recebido (R$)</label>
                          <input type="number" min="0" step="any" className="field text-sm" value={valorDestinacao} onChange={e => setValorDestinacao(e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}

                  {categoria === 'gas' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[#64748B] mb-1">Tipo de gás *</label>
                          <input className="field text-sm" value={tipoGas} onChange={e => setTipoGas(e.target.value)} placeholder="Ex: R-410A" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#64748B] mb-1">Empresa emissora *</label>
                          <input className="field text-sm" value={empresaEmissora} onChange={e => setEmpresaEmissora(e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#64748B] mb-1">Contrato de manutenção (opcional)</label>
                        <select className="field text-sm" value={contratoId} onChange={e => setContratoId(e.target.value)}>
                          <option value="">Nenhum / cliente avulso</option>
                          {contratos.map(c => (
                            <option key={c.id} value={c.id}>{(c.empresa?.apelido || c.empresa?.razao_social || 'Sem empresa')}{c.numero_contrato ? ` · ${c.numero_contrato}` : ''}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[#64748B] mb-1">Quantidade (kg) *</label>
                          <input type="number" min="0" step="any" className="field text-sm" value={quantidadeGasKg} onChange={e => setQuantidadeGasKg(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#64748B] mb-1">Valor recebido (R$)</label>
                          <input type="number" min="0" step="any" className="field text-sm" value={valorGas} onChange={e => setValorGas(e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}

                  {error && <p className="text-sm text-red-500">{error}</p>}
                </div>
              )}
            </>
          )}
        </div>

        {extraido && categoria && (
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#E2E8F0]">
            <button onClick={onClose} className="text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg px-3 py-1.5">Cancelar</button>
            <button onClick={salvar} disabled={saving} className="btn-primary">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
