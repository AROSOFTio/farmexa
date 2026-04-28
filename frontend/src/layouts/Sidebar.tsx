import { useMemo, useState, type ElementType } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Bird,
  Bot,
  Boxes,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Database,
  Egg,
  LayoutDashboard,
  Receipt,
  Scissors,
  Settings,
  Skull,
  Stethoscope,
  Syringe,
  Users,
  Wallet,
  Wheat,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/features/auth/AuthContext'
import { ROLE_LABELS } from '@/lib/branding'

interface NavLinkItem {
  label: string
  path: string
  permission: string
  moduleKey?: string
  icon: ElementType
}

interface NavGroup {
  label: string
  icon: ElementType
  items: NavLinkItem[]
}

interface NavSection {
  title: string
  items: Array<NavLinkItem | NavGroup>
}

const isGroup = (item: NavLinkItem | NavGroup): item is NavGroup => 'items' in item

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard', path: '/dashboard', permission: 'dashboard:read', moduleKey: 'dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Flocks / Batches', path: '/farm/batches', permission: 'farm:read', moduleKey: 'batches', icon: ClipboardList },
      { label: 'Bird Stock', path: '/farm/houses', permission: 'farm:read', moduleKey: 'houses', icon: Bird },
      { label: 'Age Groups', path: '/farm/growth', permission: 'farm:read', moduleKey: 'growth_tracking', icon: BarChart3 },
      { label: 'Egg Production', path: '/farm/eggs', permission: 'farm:read', moduleKey: 'egg_production', icon: Egg },
      {
        label: 'Feed Management',
        icon: Wheat,
        items: [
          { label: 'Feed Inventory', path: '/feed/stock', permission: 'feed:read', moduleKey: 'feed_stock', icon: Boxes },
          { label: 'Purchases', path: '/feed/purchases', permission: 'feed:read', moduleKey: 'feed_purchases', icon: Receipt },
          { label: 'Consumption', path: '/feed/consumption', permission: 'feed:read', moduleKey: 'feed_consumption', icon: Wheat },
          { label: 'Suppliers', path: '/feed/suppliers', permission: 'feed:read', moduleKey: 'feed_suppliers', icon: Stethoscope },
        ],
      },
      { label: 'Health Records', path: '/farm/vaccination', permission: 'farm:read', moduleKey: 'vaccination', icon: Stethoscope },
      { label: 'Vaccination', path: '/farm/vaccination', permission: 'farm:read', moduleKey: 'vaccination', icon: Syringe },
      { label: 'Mortality Records', path: '/farm/mortality', permission: 'farm:read', moduleKey: 'mortality', icon: Skull },
      {
        label: 'Slaughter Management',
        icon: Scissors,
        items: [
          { label: 'Slaughter Records', path: '/slaughter/records', permission: 'slaughter:read', moduleKey: 'slaughter_records', icon: Scissors },
          { label: 'Outputs', path: '/slaughter/outputs', permission: 'slaughter:read', moduleKey: 'slaughter_outputs', icon: Boxes },
          { label: 'Yield Tracking', path: '/slaughter/yield', permission: 'slaughter:read', moduleKey: 'slaughter_records', icon: BarChart3 },
        ],
      },
    ],
  },
  {
    title: 'Commercial',
    items: [
      { label: 'Sales / Orders', path: '/sales/orders', permission: 'sales:read', moduleKey: 'sales_orders', icon: Receipt },
      { label: 'Expenses', path: '/finance/expenses', permission: 'finance:read', moduleKey: 'expenses', icon: Wallet },
      { label: 'Profit & Loss', path: '/analytics', permission: 'reports:read', moduleKey: 'reports', icon: BarChart3 },
      { label: 'Reports & Analytics', path: '/reports/production', permission: 'reports:read', moduleKey: 'reports', icon: BarChart3 },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Users & Roles', path: '/settings/users', permission: 'users:read', moduleKey: 'users', icon: Users },
      { label: 'Settings', path: '/settings/config', permission: 'settings:read', moduleKey: 'settings', icon: Settings },
    ],
  },
  {
    title: 'Platform',
    items: [
      {
        label: 'Developer Admin',
        icon: Bot,
        items: [
          { label: 'Customers / Tenants', path: '/dev-admin/tenants', permission: 'dev_admin:read', icon: Database },
          { label: 'Subscription Plans', path: '/dev-admin/plans', permission: 'dev_admin:read', icon: CreditCard },
          { label: 'Module Control', path: '/dev-admin/modules', permission: 'dev_admin:write', icon: Boxes },
          { label: 'Billing Status', path: '/dev-admin/billing', permission: 'dev_admin:read', icon: Receipt },
        ],
      },
    ],
  },
]

function GroupItem({
  item,
  pathname,
  onClose,
}: {
  item: NavGroup
  pathname: string
  onClose: () => void
}) {
  const Icon = item.icon
  const [open, setOpen] = useState(item.items.some((entry) => pathname.startsWith(entry.path)))
  const active = item.items.some((entry) => pathname.startsWith(entry.path))

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={clsx(
          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
          active ? 'bg-[#1E7A3A]/14 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
        )}
      >
        <span className={clsx('flex h-9 w-9 items-center justify-center rounded-xl border', active ? 'border-[#1E7A3A]/25 bg-[#1E7A3A]/14 text-[#4ade80]' : 'border-white/5 bg-white/[0.03] text-white/45')}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        <span className="flex-1 text-[13px] font-semibold">{item.label}</span>
        <ChevronDown className={clsx('h-4 w-4 text-white/35 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="ml-5 mt-1 space-y-1 border-l border-white/8 pl-4">
          {item.items.map((entry) => {
            const EntryIcon = entry.icon
            const activeEntry = pathname.startsWith(entry.path)
            return (
              <NavLink
                key={entry.path}
                to={entry.path}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose()
                }}
                className={clsx(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition-colors',
                  activeEntry ? 'border-l-2 border-[#1E7A3A] bg-[#1E7A3A]/10 text-[#4ade80]' : 'text-white/55 hover:bg-white/5 hover:text-white/90'
                )}
              >
                <EntryIcon className="h-3.5 w-3.5 shrink-0" />
                {entry.label}
              </NavLink>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const location = useLocation()
  const { hasPermission, hasModuleAccess, tenant, user } = useAuth()

  const sections = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items
          .map((item) => {
            if (isGroup(item)) {
              const items = item.items.filter((entry) => hasPermission(entry.permission) && (!entry.moduleKey || hasModuleAccess(entry.moduleKey)))
              return items.length ? { ...item, items } : null
            }
            return hasPermission(item.permission) && (!item.moduleKey || hasModuleAccess(item.moduleKey)) ? item : null
          })
          .filter(Boolean) as Array<NavLinkItem | NavGroup>,
      })).filter((section) => section.items.length > 0),
    [hasModuleAccess, hasPermission]
  )

  const roleLabel = user?.role?.name ? ROLE_LABELS[user.role.name] ?? user.role.name : 'Team'

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col overflow-hidden transition-transform duration-300 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ background: '#111827' }}
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-4">
          <BrandMark />
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/8 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 border-b border-white/[0.07] px-4 py-3">
          <span className="inline-flex items-center rounded-md bg-[#1E7A3A]/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4ade80]">
            {roleLabel}
          </span>
          {tenant ? (
            <div className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2">
              <div className="truncate text-[12px] font-semibold text-white/85">{tenant.name}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/35">{tenant.plan} plan</div>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4 pt-3 sidebar-scroll">
          {sections.map((section) => (
            <div key={section.title} className="mb-5">
              <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  if (isGroup(item)) {
                    return <GroupItem key={item.label} item={item} pathname={location.pathname} onClose={onClose} />
                  }

                  const Icon = item.icon
                  const active = location.pathname.startsWith(item.path)
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => {
                        if (window.innerWidth < 1024) onClose()
                      }}
                      className={clsx(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
                        active ? 'border-l-2 border-[#1E7A3A] bg-[#1E7A3A]/12 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <span className={clsx('flex h-9 w-9 items-center justify-center rounded-xl border', active ? 'border-[#1E7A3A]/25 bg-[#1E7A3A]/14 text-[#4ade80]' : 'border-white/5 bg-white/[0.03] text-white/45')}>
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <span className="text-[13px] font-semibold">{item.label}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/[0.07] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1E7A3A]/18 text-[11px] font-bold text-[#4ade80]">
              {user?.full_name?.slice(0, 2).toUpperCase() ?? 'FX'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-white/85">{user?.full_name ?? 'Loading...'}</div>
              <div className="truncate text-[11px] text-white/35">{user?.email ?? ''}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
