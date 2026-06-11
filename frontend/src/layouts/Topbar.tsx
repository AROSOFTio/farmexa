import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Building2,
  ChevronDown,
  HelpCircle,
  LogOut,
  Menu,
  PanelLeftClose,
  Search,
  UserRound,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '@/features/auth/AuthContext'
import { ThemeSelector } from '@/components/ThemeControls'
import { BranchSwitcher } from '@/components/BranchSwitcher'

interface TopbarProps {
  onToggleSidebar: () => void
  isSidebarOpen: boolean
  leftOffset?: number
  onOpenSearch: () => void
}

export function Topbar({ onToggleSidebar, isSidebarOpen, leftOffset = 0, onOpenSearch }: TopbarProps) {
  const { user, tenant, logout } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const [farmOpen, setFarmOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const initials = useMemo(() => {
    const source = user?.full_name || user?.email || 'NF'
    return source.split(/[ @.]/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  }, [user])

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      console.error('Logout failed')
    }
  }

  // Simplified notifications for the enterprise view
  const notificationCount = 3 // Mock count for UI

  return (
    <header
      className="fixed right-0 top-0 z-30 flex h-[72px] items-center gap-4 border-b border-border bg-card px-4 lg:px-6 transition-all duration-300"
      style={{ left: leftOffset }}
    >
      {/* Sidebar Toggle */}
      <button 
        type="button" 
        onClick={onToggleSidebar} 
        className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-border/50 hover:text-text-primary outline-none"
        aria-label="Toggle navigation"
      >
        {isSidebarOpen ? <PanelLeftClose className="h-[22px] w-[22px]" /> : <Menu className="h-[22px] w-[22px]" />}
      </button>

      {/* Farm Selector */}
      <div className="relative hidden md:block">
        <button
          type="button"
          onClick={() => setFarmOpen((open) => !open)}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-[14px] font-semibold text-text-primary transition-colors hover:bg-border/50 outline-none"
        >
          <Building2 className="h-4 w-4 text-text-secondary" />
          {tenant?.name ?? 'Tenant Workspace'}
          <ChevronDown className={clsx('h-4 w-4 text-text-secondary transition-transform', farmOpen && 'rotate-180')} />
        </button>
        {farmOpen && (
          <>
            <button type="button" className="fixed inset-0 z-30 cursor-default" onClick={() => setFarmOpen(false)} />
            <div className="absolute left-0 top-full z-40 mt-1 w-[280px] overflow-hidden rounded-md border border-border bg-card shadow-card">
              <div className="border-b border-border px-4 py-3 bg-background/50">
                <div className="text-[13px] font-bold text-text-primary">{tenant?.name ?? 'Tenant Workspace'}</div>
                <div className="text-[12px] text-text-secondary capitalize">{tenant?.subscription_status ?? 'active'} plan</div>
              </div>
              <div className="py-1">
                {[
                  { label: 'Farm Profile', path: '/farm/profile', icon: Building2 },
                  { label: 'Support', path: '/support', icon: HelpCircle },
                ].map((item) => (
                  <button
                    key={item.path}
                    onClick={() => {
                      setFarmOpen(false)
                      navigate(item.path)
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-medium text-text-secondary hover:bg-border/30 hover:text-text-primary"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex-1" />

      {/* Global Search */}
      <div className="hidden w-full max-w-[320px] lg:block">
        <button
          type="button"
          onClick={onOpenSearch}
          className="group flex h-[40px] w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-4 text-[13px] text-text-secondary transition-colors hover:border-primary/50 hover:text-text-primary outline-none"
        >
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4 text-text-secondary group-hover:text-primary transition-colors" />
            <span>Search or type a command...</span>
          </span>
          <span className="text-[10px] font-medium tracking-wider bg-border/50 px-1.5 py-0.5 rounded text-text-secondary">Ctrl K</span>
        </button>
      </div>

      <div className="flex-1 lg:flex-none" />

      {/* Branch Selector */}
      <div className="hidden sm:block">
        <BranchSwitcher />
      </div>

      {/* Notifications */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setNotificationsOpen((open) => !open)}
          className="relative flex h-[40px] w-[40px] items-center justify-center rounded-md border border-border bg-background text-text-secondary transition-colors hover:text-text-primary hover:border-primary/50 outline-none"
        >
          <Bell className="h-4 w-4" />
          {notificationCount > 0 && (
            <span className="absolute right-2 top-2 h-[8px] w-[8px] rounded-full bg-danger border border-card" />
          )}
        </button>
        {notificationsOpen && (
          <>
            <button type="button" className="fixed inset-0 z-30 cursor-default" onClick={() => setNotificationsOpen(false)} />
            <div className="absolute right-0 top-full z-40 mt-1 w-[320px] overflow-hidden rounded-md border border-border bg-card shadow-card">
              <div className="border-b border-border px-4 py-3 bg-background/50 flex justify-between items-center">
                <div className="text-[13px] font-bold text-text-primary">Notifications</div>
                <div className="text-[11px] font-medium text-primary cursor-pointer hover:underline">Mark all read</div>
              </div>
              <div className="px-4 py-8 text-center text-[13px] text-text-secondary">
                No new enterprise alerts
              </div>
            </div>
          </>
        )}
      </div>

      {/* User Menu */}
      <div className="relative">
        <button 
          type="button" 
          onClick={() => setProfileOpen((open) => !open)} 
          className="flex h-[40px] items-center gap-3 rounded-md pl-1.5 pr-3 transition-colors hover:bg-border/50 outline-none border border-transparent hover:border-border"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold">
            {initials}
          </span>
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block truncate text-[13px] font-semibold leading-none text-text-primary">
              {user?.full_name ?? 'User'}
            </span>
            <span className="block mt-1 text-[11px] leading-none text-text-secondary">
              {user?.job_title ?? 'Administrator'}
            </span>
          </span>
          <ChevronDown className="hidden h-4 w-4 text-text-secondary sm:block" />
        </button>

        {profileOpen && (
          <>
            <button type="button" className="fixed inset-0 z-30 cursor-default" onClick={() => setProfileOpen(false)} />
            <div className="absolute right-0 top-full z-40 mt-1 w-[260px] overflow-hidden rounded-md border border-border bg-card shadow-card">
              <div className="border-b border-border px-4 py-3 bg-background/50">
                <div className="text-[13px] font-bold text-text-primary">{user?.full_name}</div>
                <div className="text-[12px] text-text-secondary">{user?.email}</div>
              </div>
              <div className="py-1">
                <button type="button" onClick={() => { setProfileOpen(false); navigate('/settings/profile') }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-medium text-text-secondary hover:bg-border/30 hover:text-text-primary">
                  <UserRound className="h-4 w-4" />
                  Profile settings
                </button>
                <div className="px-4 py-2 border-t border-border mt-1">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary/70">Theme</div>
                  <ThemeSelector />
                </div>
                <div className="border-t border-border mt-1 pt-1">
                  <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-medium text-danger hover:bg-danger/10">
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
