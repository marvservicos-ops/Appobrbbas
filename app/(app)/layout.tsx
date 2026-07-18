import Sidebar from '@/components/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-[#F8FAFC] md:h-dvh md:overflow-hidden">
      <Sidebar />
      {/* pt-14 = mobile top bar height, pb-16 = mobile bottom nav height */}
      <main className="min-w-0 flex-1 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))] md:h-full md:overflow-y-auto md:pt-0 md:pb-0">
        {children}
      </main>
    </div>
  )
}
