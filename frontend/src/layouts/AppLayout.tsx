import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/layouts/Sidebar'
import { Topbar } from '@/layouts/Topbar'

const SIDEBAR_WIDTH = 272

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="app-shell min-h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex min-h-screen flex-col transition-all duration-300" style={{ paddingLeft: 0 }}>
        <style>{`
          @media (min-width: 1024px) {
            .topbar { left: ${SIDEBAR_WIDTH}px !important; }
            .main-offset { padding-left: ${SIDEBAR_WIDTH}px; }
          }
        `}</style>

        <Topbar onOpenSidebar={() => setIsSidebarOpen(true)} />

        <main className="main-offset relative flex-1" style={{ paddingTop: '4.5rem', minHeight: '100vh' }}>
          <div className="relative mx-auto w-full max-w-[1720px] px-4 py-4 sm:px-5 lg:px-6 lg:py-5">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
