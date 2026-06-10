const config: Record<string, { bg: string; text: string; dot: string }> = {
  'Concluída': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'Em Andamento': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'Paralisada': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'Em Planejamento': { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  'Pendente': { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  'Atrasada': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
}

export default function StatusChip({ status, size = 'sm' }: { status: string; size?: 'sm' | 'xs' }) {
  const c = config[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${c.bg} ${c.text} ${size === 'xs' ? 'text-xs' : 'text-xs'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  )
}
