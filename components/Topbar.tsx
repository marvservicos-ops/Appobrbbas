'use client'

import { Search, Bell, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

interface TopbarProps {
  searchPlaceholder?: string
  onSearch?: (q: string) => void
}

export default function Topbar({ searchPlaceholder = 'Buscar obra ou projeto...', onSearch }: TopbarProps) {
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center px-6 gap-4 sticky top-0 z-10">
      <div className="flex-1 max-w-md relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          onChange={e => onSearch?.(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#4F7CFF] transition-colors"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] transition-colors">
          <Bell size={18} className="text-[#64748B]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#4F7CFF] rounded-full" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#4F7CFF] text-white text-xs font-semibold flex items-center justify-center">
              MG
            </div>
            <ChevronDown size={14} className="text-[#64748B]" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#E2E8F0] rounded-lg shadow-lg py-1 z-50">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
