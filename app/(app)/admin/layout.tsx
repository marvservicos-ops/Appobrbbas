import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProfile } from '@/lib/access'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  if (!profile?.active || profile.role !== 'admin') redirect('/obras')

  return (
    <div className="min-h-full">
      <div className="bg-[#0F172A] text-white px-4 md:px-8 py-3 flex items-center gap-2 overflow-x-auto">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400 mr-2">Admin</span>
        <Link href="/admin" className="whitespace-nowrap text-sm px-3 py-2 rounded-lg hover:bg-white/10">Financeiro</Link>
        <Link href="/admin/usuarios" className="whitespace-nowrap text-sm px-3 py-2 rounded-lg hover:bg-white/10">Usuários e permissões</Link>
      </div>
      {children}
    </div>
  )
}
