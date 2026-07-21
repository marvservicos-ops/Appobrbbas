'use client'

import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { ReceiptText, TrendingDown } from 'lucide-react'
import ObraPagamentos from '@/components/ObraPagamentos'
import ObraCentroCustos from '@/components/ObraCentroCustos'

type SubTab = 'medicoes' | 'centro-custos'

function FinanceiroContent() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const subTab = (searchParams.get('aba') ?? 'medicoes') as SubTab

  function setSubTab(t: SubTab) {
    router.replace(`/obras/${id}/financeiro?aba=${t}`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-navegação */}
      <div className="flex gap-1 px-4 md:px-6 pt-4 pb-0 border-b border-[#E2E8F0] bg-white">
        {([
          { key: 'medicoes', label: 'Medições', icon: ReceiptText },
          { key: 'centro-custos', label: 'Centro de Custos', icon: TrendingDown },
        ] as { key: SubTab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
              subTab === key
                ? 'border-[#4F7CFF] text-[#4F7CFF]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {subTab === 'medicoes' && <ObraPagamentos obraId={id} />}
        {subTab === 'centro-custos' && <ObraCentroCustos obraId={id} />}
      </div>
    </div>
  )
}

export default function ObraFinanceiroPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-[#4F7CFF] border-t-transparent rounded-full animate-spin" /></div>}>
      <FinanceiroContent />
    </Suspense>
  )
}
