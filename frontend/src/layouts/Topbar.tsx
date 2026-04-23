import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, Menu, Settings, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/features/auth/AuthContext'
import { ROLE_LABELS } from '@/lib/branding'

export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user, logout, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const initials = useMemo(
    () =>
      user?.full_name
        .split(' ')
        .map((name) => name[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() ?? 'FM',
    [user?.full_name]
  )

  const today = new Date().toLocaleDateString('en-UG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const roleLabel = user?.role?.name ? ROLE_LABELS[user.role.name] ?? user.role.name : 'Workspace User'

  const handleLogout = async () => {
    setMenuOpen(false)
    try {
      await logout()
    } catch {
      toast.error('Sign-out failed. Please try again.')
    }
  }

  return (
    <header className="topbar">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="rounded-2xl border border-neutral-200 bg-white p-2.5 text-ink-600 shadow-sm transition-colors hover:bg-neutral-50 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="lg:hidden">
        <BrandMark compact />
      </div>

      <div className="hidden md:flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm shadow-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-ink-500">Workspace date</div>
          <div className="text-sm font-semibold text-ink-800">{today}</div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden lg:block text-right">
          <div className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-ink-500">Signed in as</div>
          <div className="text-sm font-semibold text-ink-800">{roleLabel}</div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-2.5 py-2 shadow-sm transition-all duration-150 hover:border-neutral-300 hover:bg-neutral-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-gradient text-sm font-bold text-white">
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-semibold text-ink-900">{user?.full_name ?? 'Loading...'}</div>
              <div className="text-xs font-medium text-ink-500">{user?.email ?? ''}</div>
            </div>
            <ChevronDown className={`hidden h-4 w-4 text-ink-400 sm:block ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close user menu"
                className="fixed inset-0 z-30"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-modal">
                <div className="border-b border-neutral-150 bg-neutral-50 px-5 py-4">
                  <div className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-ink-500">
                    Farmexa Workspace
                  </div>
                  <div className="mt-1 text-base font-semibold text-ink-900">{user?.full_name}</div>
                  <div className="mt-1 text-sm text-ink-500">{roleLabel}</div>
                </div>

                <div className="p-2">
                  {hasPermission('settings:read') && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        navigate('/settings/config')
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-ink-700 transition-colors hover:bg-neutral-50"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-neutral-100 text-ink-500">
                        <Settings className="h-4 w-4" />
                      </div>
                      Workspace settings
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-danger transition-colors hover:bg-danger-light"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-danger-light text-danger">
                      <LogOut className="h-4 w-4" />
                    </div>
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
