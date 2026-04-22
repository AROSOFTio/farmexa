import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/layouts/Sidebar'
import { Topbar } from '@/layouts/Topbar'

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="lg:pl-64 transition-all duration-300">
        <Topbar onOpenSidebar={() => setIsSidebarOpen(true)} />
        <main
          className="transition-all duration-200"
          style={{
            marginTop: '3.75rem',      // topbar height
            minHeight: 'calc(100vh - 3.75rem)',
          }}
        >
          <div className="page-container py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
