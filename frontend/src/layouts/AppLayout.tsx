import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/layouts/Sidebar'
import { Topbar } from '@/layouts/Topbar'
import { applyTheme, resolveInitialTheme, THEME_STORAGE_KEY, type ThemeMode } from '@/lib/theme'

const SIDEBAR_WIDTH = 240

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(() => resolveInitialTheme())

  useEffect(() => {
    applyTheme(theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  return (
    <div className="app-shell min-h-screen" style={{ background: 'var(--app-bg)' }}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main content — offset by sidebar width on lg+ */}
      <div
        className="flex min-h-screen flex-col transition-all duration-300"
        style={{ paddingLeft: 0 }}
      >
        {/* Override topbar left offset based on sidebar width */}
        <style>{`
          @media (min-width: 1024px) {
            .topbar { left: ${SIDEBAR_WIDTH}px !important; }
            .main-offset { padding-left: ${SIDEBAR_WIDTH}px; }
          }
        `}</style>

        <Topbar
          onOpenSidebar={() => setIsSidebarOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <main
          className="main-offset relative flex-1"
          style={{ paddingTop: '3.75rem', minHeight: '100vh' }}
        >
          <div className="relative mx-auto w-full max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
