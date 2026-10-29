'use client'

// Lançar quantidade pela balança: o produto guarda o peso de 1 peça (peso_unitario_g)
// e o peso pesado vira quantidade de peças (peso ÷ peso da peça).

import { useState } from 'react'
import { Scale, X } from 'lucide-react'
import { arred, formatarQtd } from '@/lib/numero'

const fmtGramas = (g: number) =>
  g >= 1000 ? `${formatarQtd(g / 1000, 3)} kg` : `${formatarQtd(g, 3)} g`

// Converte o peso pesado em peças. Aparece só para produtos com peso por peça cadastrado.
export function PesoParaQuantidade({ pesoUnitarioG, unidade, onQuantidade, onEnter, compacto }: {
  pesoUnitarioG?: number | null
  unidade?: string | null
  onQuantidade: (qtd: string) => void
  onEnter?: () => void
  compacto?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [peso, setPeso] = useState('')
  const [unPeso, setUnPeso] = useState<'kg' | 'g'>('kg')

  if (!pesoUnitarioG || pesoUnitarioG <= 0) return null

  const pesoG = (parseFloat(peso) || 0) * (unPeso === 'kg' ? 1000 : 1)
  const qtdExata = pesoG / pesoUnitarioG
  const qtd = Math.round(qtdExata)
  const un = unidade || 'peças'

  function aplicar(novoPeso: string, novaUn: 'kg' | 'g') {
    setPeso(novoPeso); setUnPeso(novaUn)
    const g = (parseFloat(novoPeso) || 0) * (novaUn === 'kg' ? 1000 : 1)
    onQuantidade(g > 0 ? String(Math.round(g / pesoUnitarioG!)) : '')
  }

  if (!aberto) return (
    <button type="button" onClick={() => setAberto(true)}
      className={`flex items-center gap-1.5 font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors ${compacto ? 'text-xs px-2 py-1' : 'text-xs px-2.5 py-1.5 border border-[#C7D2FE]'}`}>
      <Scale size={13} /> Lançar por peso (balança)
    </button>
  )

  return (
    <div className="px-3 py-2.5 bg-[#F5F7FF] border border-[#C7D2FE] rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-[#4F7CFF]"><Scale size={13} /> Por peso · 1 peça = {fmtGramas(pesoUnitarioG)}</span>
        <button type="button" onClick={() => { setAberto(false); setPeso('') }} aria-label="Voltar a lançar por quantidade" title="Voltar a lançar por quantidade"
          className="text-[#94A3B8] hover:text-[#374151]"><X size={14} /></button>
      </div>
      <div className="flex items-center gap-2">
        <input type="number" min="0" step="any" inputMode="decimal" autoFocus className="field text-sm flex-1 min-w-0" placeholder="Peso na balança"
          value={peso} onChange={e => aplicar(e.target.value, unPeso)}
          onKeyDown={onEnter ? e => { if (e.key === 'Enter') { e.preventDefault(); onEnter() } } : undefined} />
        <select className="field text-sm w-20" value={unPeso} onChange={e => aplicar(peso, e.target.value as 'kg' | 'g')}>
          <option value="kg">kg</option>
          <option value="g">g</option>
        </select>
      </div>
      {pesoG > 0 && (
        <p className="text-xs text-[#374151]">
          = <strong>{qtd.toLocaleString('pt-BR')} {un}</strong>
          {Math.abs(qtdExata - qtd) >= 0.05 && <span className="text-[#94A3B8]"> (cálculo exato {formatarQtd(qtdExata, 1)}, arredondado)</span>}
        </p>
      )}
    </div>
  )
}

// Campo "peso de 1 peça" do cadastro, com calculadora: pesa N peças juntas e divide.
export function CampoPesoPeca({ value, onChange, compacto }: {
  value: string
  onChange: (v: string) => void
  compacto?: boolean
}) {
  const [calc, setCalc] = useState(false)
  const [nPecas, setNPecas] = useState('')
  const [pesoTotal, setPesoTotal] = useState('')
  const [unPeso, setUnPeso] = useState<'g' | 'kg'>('g')

  const n = parseFloat(nPecas) || 0
  const totalG = (parseFloat(pesoTotal) || 0) * (unPeso === 'kg' ? 1000 : 1)
  const resultado = n > 0 && totalG > 0 ? arred(totalG / n, 4) : 0
  const lbl = compacto ? 'block text-xs font-medium text-[#64748B] mb-1' : 'block text-sm font-medium text-[#374151] mb-1.5'

  return (
    <div>
      <label className={lbl}>Peso de 1 peça (g)</label>
      <div className="flex gap-2">
        <input type="number" min="0" step="any" inputMode="decimal" className={`field flex-1 min-w-0 ${compacto ? 'text-sm' : ''}`} placeholder="Opcional"
          value={value} onChange={e => onChange(e.target.value)} />
        <button type="button" onClick={() => setCalc(c => !c)} title="Calcular pesando várias peças"
          className={`shrink-0 h-10 px-2.5 flex items-center gap-1 rounded-lg border text-xs font-medium transition-colors ${calc ? 'border-[#4F7CFF] bg-[#EEF2FF] text-[#4F7CFF]' : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#4F7CFF]'}`}>
          <Scale size={14} /> Calcular
        </button>
      </div>
      {calc && (
        <div className="mt-2 px-3 py-2.5 bg-[#F5F7FF] border border-[#C7D2FE] rounded-lg space-y-2">
          <p className="text-xs text-[#64748B]">Conte algumas peças (ex.: 50 ou 100), pese juntas e informe abaixo. Quanto mais peças, mais preciso.</p>
          <div className="grid grid-cols-[1fr_1fr_4.5rem] gap-2">
            <input type="number" min="0" step="1" inputMode="numeric" className="field text-sm" placeholder="Nº de peças"
              value={nPecas} onChange={e => setNPecas(e.target.value)} />
            <input type="number" min="0" step="any" inputMode="decimal" className="field text-sm" placeholder="Peso total"
              value={pesoTotal} onChange={e => setPesoTotal(e.target.value)} />
            <select className="field text-sm" value={unPeso} onChange={e => setUnPeso(e.target.value as 'g' | 'kg')}>
              <option value="g">g</option>
              <option value="kg">kg</option>
            </select>
          </div>
          {resultado > 0 && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[#374151]">1 peça = <strong>{formatarQtd(resultado, 4)} g</strong></span>
              <button type="button" onClick={() => { onChange(String(resultado)); setCalc(false); setNPecas(''); setPesoTotal('') }}
                className="btn-primary text-xs py-1.5 px-3">Usar este peso</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
