import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/layouts/Sidebar'
import { Topbar } from '@/layouts/Topbar'

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-shell-gradient">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="min-h-screen transition-all duration-300 lg:pl-[18rem]">
        <Topbar onOpenSidebar={() => setIsSidebarOpen(true)} />

        <main
          className="relative min-h-screen"
          style={{
            marginTop: '4.5rem',
            minHeight: 'calc(100vh - 4.5rem)',
          }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-[-8rem] top-[-6rem] h-64 w-64 rounded-full bg-brand-100/60 blur-3xl" />
            <div className="absolute bottom-[-8rem] right-[-4rem] h-72 w-72 rounded-full bg-brand-50 blur-3xl" />
          </div>

          <div className="relative page-container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
