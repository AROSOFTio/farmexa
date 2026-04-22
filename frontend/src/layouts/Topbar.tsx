import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  LogOut,
  Settings,
  Menu,
  ChevronDown,
  Sun,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { toast } from 'sonner'

export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    setMenuOpen(false)
    try {
      await logout()
    } catch {
      toast.error('Logout failed. Please try again.')
    }
  }

  const initials = user?.full_name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '??'

  const today = new Date().toLocaleDateString('en-UG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <header className="topbar">
      {/* Mobile Menu Button */}
      <button
        onClick={onOpenSidebar}
        className="lg:hidden p-2 -ml-2 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Date display */}
      <div className="hidden md:flex items-center gap-2 text-neutral-400">
        <Sun className="w-3.5 h-3.5 text-brand-400" />
        <span className="text-xs font-medium">{today}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center gap-1.5">

        {/* Notifications */}
        <button
          className="relative w-9 h-9 rounded-xl flex items-center justify-center text-neutral-500
                     hover:bg-neutral-100 hover:text-neutral-700 transition-all duration-150"
          title="Notifications"
        >
          <Bell className="w-4.5 h-4.5" />
          {/* Notification dot */}
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-white"
            style={{ background: '#166534' }}
          />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-neutral-150 mx-1" />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl
                       hover:bg-neutral-100 transition-all duration-150"
          >
            {/* Avatar with gradient */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #166534 0%, #124227 100%)' }}
            >
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-semibold text-neutral-800 leading-none">
                {user?.full_name ?? 'Loading…'}
              </div>
              <div className="text-2xs text-neutral-400 mt-0.5 capitalize font-medium">
                {user?.role?.name?.replace('_', ' ') ?? '—'}
              </div>
            </div>
            <ChevronDown
              className="w-3.5 h-3.5 text-neutral-400 hidden sm:block"
              style={{ transition: 'transform 0.15s', transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div
                className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl
                           border border-neutral-150 z-50 py-1.5 animate-fade-in overflow-hidden"
                style={{ boxShadow: '0 16px 48px 0 rgb(0 0 0 / 0.14), 0 4px 16px -4px rgb(0 0 0 / 0.10)' }}
              >
                {/* User info header */}
                <div
                  className="px-4 py-3 mb-1"
                  style={{ borderBottom: '1px solid #e7eeea' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #166534 0%, #124227 100%)' }}
                    >
                      {initials}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-neutral-800 leading-tight">
                        {user?.full_name}
                      </div>
                      <div className="text-xs text-neutral-400 truncate mt-0.5">
                        {user?.email}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { setMenuOpen(false); navigate('/settings/users') }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700
                             hover:bg-neutral-50 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                    <Settings className="w-3.5 h-3.5 text-neutral-500" />
                  </div>
                  Settings
                </button>

                <div className="my-1 mx-3" style={{ height: '1px', background: '#e7eeea' }} />

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600
                             hover:bg-red-50 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                    <LogOut className="w-3.5 h-3.5 text-red-500" />
                  </div>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
