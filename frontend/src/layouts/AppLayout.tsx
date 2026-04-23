import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/layouts/Sidebar'
import { Topbar } from '@/layouts/Topbar'

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-neutral-50">
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
          <div className="relative page-container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
