import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Settings,
  Menu,
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

  return (
    <header className="topbar">
      {/* Mobile Menu Button */}
      <button
        onClick={onOpenSidebar}
        className="lg:hidden p-2 -ml-2 text-neutral-500 hover:text-neutral-800 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page breadcrumb placeholder — populated by pages */}
      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Notifications — functional in Phase 5 */}
        <button
          className="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-500
                     hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
          title="Notifications"
        >
          <Bell className="w-4.5 h-4.5" />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-neutral-200 mx-1" />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg
                       hover:bg-neutral-100 transition-colors"
          >
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium text-neutral-800 leading-none">
                {user?.full_name ?? 'Loading…'}
              </div>
              <div className="text-2xs text-neutral-400 mt-0.5 capitalize">
                {user?.role?.name?.replace('_', ' ') ?? '—'}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div
                className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl
                           shadow-modal border border-neutral-150 z-50 py-1 animate-fade-in"
              >
                <div className="px-4 py-3 border-b border-neutral-100">
                  <div className="text-sm font-semibold text-neutral-800">{user?.full_name}</div>
                  <div className="text-xs text-neutral-400 truncate">{user?.email}</div>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); navigate('/settings/users') }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-700
                             hover:bg-neutral-50 transition-colors"
                >
                  <Settings className="w-4 h-4 text-neutral-400" />
                  Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-danger
                             hover:bg-danger-light transition-colors"
                >
                  <LogOut className="w-4 h-4" />
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
