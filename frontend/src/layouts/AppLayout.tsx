import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/layouts/Sidebar'
import { Topbar } from '@/layouts/Topbar'
import { applyTheme, resolveInitialTheme, THEME_STORAGE_KEY, type ThemeMode } from '@/lib/theme'

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(() => resolveInitialTheme())

  useEffect(() => {
    applyTheme(theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  return (
    <div className="app-shell min-h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="min-h-screen transition-all duration-300 lg:pl-sidebar">
        <Topbar
          onOpenSidebar={() => setIsSidebarOpen(true)}
          theme={theme}
          onToggleTheme={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
        />

        <main
          className="page-backdrop relative min-h-screen"
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
