import Link from 'next/link'
import { ShieldPlus } from 'lucide-react'
import Topbar from '@/components/Topbar'

export default function DocumentosPage() {
  return (
    <div>
      <Topbar />
      <div className="p-6">
        <h1 className="font-syne text-2xl font-bold text-[#0F172A]">Documentos</h1>
        <p className="text-[#64748B] mt-1">Acesse os documentos por obra na aba Documentos de cada projeto.</p>

        <Link href="/documentos/novo" className="card mt-6 flex items-center gap-4 max-w-md hover:border-[#4F7CFF] transition-colors">
          <div className="w-11 h-11 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0">
            <ShieldPlus size={20} className="text-[#4F7CFF]" />
          </div>
          <div>
            <p className="font-semibold text-[#0F172A] text-sm">Gerar PT / APR</p>
            <p className="text-xs text-[#64748B] mt-0.5">Permissão de Trabalho e Análise Preliminar de Risco</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
