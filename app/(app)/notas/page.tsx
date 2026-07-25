'use client'

import Topbar from '@/components/Topbar'
import NotasPanel from '@/components/NotasPanel'

export default function NotasPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="flex-1 overflow-hidden">
        <NotasPanel />
      </div>
    </div>
  )
}
