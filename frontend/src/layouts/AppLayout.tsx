import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/layouts/Sidebar'
import { Topbar } from '@/layouts/Topbar'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar />
      <Topbar />
      <main
        className="transition-all duration-200"
        style={{
          marginLeft: '15rem',       // sidebar width
          marginTop: '3.5rem',       // topbar height
          minHeight: 'calc(100vh - 3.5rem)',
        }}
      >
        <div className="page-container py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
