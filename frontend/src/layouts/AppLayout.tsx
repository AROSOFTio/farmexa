import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/layouts/Sidebar'
import { Topbar } from '@/layouts/Topbar'

const SIDEBAR_WIDTH = 232
const BREAKPOINT_LG = 1024

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= BREAKPOINT_LG
  })
  const [screenWidth, setScreenWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  )

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth
      setScreenWidth(w)
      if (w >= BREAKPOINT_LG) setIsSidebarOpen(true)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isDesktop = screenWidth >= BREAKPOINT_LG
  const showOffset = isDesktop && isSidebarOpen

  return (
    <div className="app-shell min-h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div
        className="flex min-h-screen flex-col transition-all duration-300"
        style={{ paddingLeft: showOffset ? SIDEBAR_WIDTH : 0 }}
      >
        <Topbar
          isSidebarOpen={isSidebarOpen}
          leftOffset={showOffset ? SIDEBAR_WIDTH : 0}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />

        <main className="relative flex-1" style={{ paddingTop: '56px', minHeight: '100vh' }}>
          <div className="relative mx-auto w-full max-w-[1760px] px-3 py-3 sm:px-4 lg:px-4 lg:py-3">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
