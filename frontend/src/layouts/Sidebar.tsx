import { useMemo, useState, type ElementType } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Bird,
  Bot,
  Building2,
  ChevronDown,
  CircleDollarSign,
  Clipboard,
  CreditCard,
  Database,
  Egg,
  LayoutDashboard,
  Package,
  PackageSearch,
  PieChart,
  Receipt,
  Scissors,
  Settings,
  ShoppingCart,
  Stethoscope,
  Syringe,
  TrendingUp,
  Users,
  Wheat,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/features/auth/AuthContext'
import { ROLE_LABELS } from '@/lib/branding'

interface SubItem {
  label: string
  path: string
  permission: string
  icon?: ElementType
}

interface NavItem {
  label: string
  icon: ElementType
  path?: string
  permission?: string
  subItems?: SubItem[]
}

interface NavSection {
  title: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', permission: 'dashboard:read' },
    ],
  },
  {
    title: 'Farm Management',
    items: [
      {
        label: 'Farm',
        icon: Bird,
        subItems: [
          { label: 'Houses', path: '/farm/houses', permission: 'farm:read', icon: Building2 },
          { label: 'Batches', path: '/farm/batches', permission: 'farm:read', icon: Clipboard },
          { label: 'Mortality', path: '/farm/mortality', permission: 'farm:read', icon: TrendingUp },
          { label: 'Vaccination', path: '/farm/vaccination', permission: 'farm:read', icon: Syringe },
          { label: 'Growth Tracking', path: '/farm/growth', permission: 'farm:read', icon: BarChart3 },
          { label: 'Egg Production', path: '/farm/eggs', permission: 'farm:read', icon: Egg },
        ],
      },
      {
        label: 'Feed',
        icon: Wheat,
        subItems: [
          { label: 'Feed Stock', path: '/feed/stock', permission: 'feed:read' },
          { label: 'Purchases', path: '/feed/purchases', permission: 'feed:read' },
          { label: 'Consumption', path: '/feed/consumption', permission: 'feed:read' },
          { label: 'Suppliers', path: '/feed/suppliers', permission: 'feed:read' },
        ],
      },
    ],
  },
  {
    title: 'Inventory',
    items: [
      {
        label: 'Inventory',
        icon: Package,
        subItems: [
          { label: 'Stock Items', path: '/inventory/items', permission: 'inventory:read' },
          { label: 'Stock Movements', path: '/inventory/movements', permission: 'inventory:read' },
          { label: 'Medicine & Supplies', path: '/inventory/medicine', permission: 'inventory:read', icon: Stethoscope },
        ],
      },
    ],
  },
  {
    title: 'Slaughter',
    items: [
      {
        label: 'Slaughter',
        icon: Scissors,
        subItems: [
          { label: 'Records', path: '/slaughter/records', permission: 'slaughter:read' },
          { label: 'Outputs', path: '/slaughter/outputs', permission: 'slaughter:read' },
          { label: 'Yield Tracking', path: '/slaughter/yield', permission: 'slaughter:read' },
        ],
      },
    ],
  },
  {
    title: 'Sales',
    items: [
      {
        label: 'Sales',
        icon: ShoppingCart,
        subItems: [
          { label: 'Customers', path: '/sales/customers', permission: 'sales:read' },
          { label: 'Orders', path: '/sales/orders', permission: 'sales:read' },
          { label: 'Invoices', path: '/sales/invoices', permission: 'sales:read' },
          { label: 'Payments', path: '/sales/payments', permission: 'sales:read' },
        ],
      },
      {
        label: 'Finance',
        icon: CircleDollarSign,
        subItems: [
          { label: 'Expenses', path: '/finance/expenses', permission: 'finance:read' },
          { label: 'Income', path: '/finance/incomes', permission: 'finance:read' },
          { label: 'Profit & Loss', path: '/analytics', permission: 'reports:read', icon: PieChart },
        ],
      },
    ],
  },
  {
    title: 'Reports',
    items: [
      {
        label: 'Reports & Analytics',
        icon: BarChart3,
        subItems: [
          { label: 'Production Report', path: '/reports/production', permission: 'reports:read' },
          { label: 'Feed Report', path: '/reports/feed', permission: 'reports:read' },
          { label: 'Mortality Report', path: '/reports/mortality', permission: 'reports:read' },
          { label: 'Sales Report', path: '/reports/sales', permission: 'reports:read' },
          { label: 'Profit Report', path: '/reports/profit', permission: 'reports:read' },
        ],
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        label: 'Settings',
        icon: Settings,
        subItems: [
          { label: 'Users', path: '/settings/users', permission: 'users:read', icon: Users },
          { label: 'Roles & Permissions', path: '/settings/roles', permission: 'settings:read' },
          { label: 'System Config', path: '/settings/config', permission: 'settings:read' },
        ],
      },
    ],
  },
  {
    title: 'Developer',
    items: [
      {
        label: 'Developer Admin',
        icon: Bot,
        subItems: [
          { label: 'Tenants', path: '/dev-admin/tenants', permission: 'dev_admin:read', icon: Database },
          { label: 'Subscription Plans', path: '/dev-admin/plans', permission: 'dev_admin:read', icon: CreditCard },
          { label: 'Module Control', path: '/dev-admin/modules', permission: 'dev_admin:write', icon: PackageSearch },
          { label: 'Billing Status', path: '/dev-admin/billing', permission: 'dev_admin:read', icon: Receipt },
        ],
      },
    ],
  },
]

function NavGroup({
  item,
  location,
  onClose,
}: {
  item: NavItem
  location: ReturnType<typeof useLocation>
  onClose: () => void
}) {
  const Icon = item.icon
  const hasActiveSubItem = item.subItems?.some((sub) => location.pathname.startsWith(sub.path)) ?? false
  const [open, setOpen] = useState(hasActiveSubItem)

  const handleToggle = () => setOpen((o) => !o)

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        className={clsx(
          'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors duration-150',
          hasActiveSubItem ? 'text-white' : 'text-white/60 hover:text-white/90'
        )}
      >
        <span
          className={clsx(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
            hasActiveSubItem ? 'bg-[#1E7A3A]/20 text-[#22c55e]' : 'text-white/40'
          )}
        >
          <Icon className="h-[17px] w-[17px]" />
        </span>
        <span className="flex-1 text-[13px] font-medium tracking-[-0.01em]">{item.label}</span>
        <ChevronDown
          className={clsx(
            'h-3.5 w-3.5 shrink-0 text-white/40 transition-transform duration-200',
            open ? 'rotate-180' : ''
          )}
        />
      </button>

      {open && (
        <div className="mt-0.5 ml-[1.1rem] space-y-0.5 border-l border-white/8 pl-3">
          {item.subItems!.map((sub) => {
            const SubIcon = sub.icon
            const isActive = location.pathname.startsWith(sub.path)
            return (
              <NavLink
                key={sub.path}
                to={sub.path}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose()
                }}
                className={clsx(
                  'flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-[#1E7A3A]/15 text-[#4ade80]'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/90'
                )}
              >
                {SubIcon && (
                  <SubIcon className={clsx('h-3.5 w-3.5 shrink-0', isActive ? 'text-[#4ade80]' : 'text-white/30')} />
                )}
                {sub.label}
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                )}
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const location = useLocation()
  const { hasPermission, user } = useAuth()

  const sections = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items
          .map((item) => {
            if (item.subItems) {
              const subItems = item.subItems.filter((sub) => hasPermission(sub.permission))
              return subItems.length ? { ...item, subItems } : null
            }
            return item.permission && !hasPermission(item.permission) ? null : item
          })
          .filter(Boolean) as NavItem[],
      })).filter((s) => s.items.length > 0),
    [hasPermission]
  )

  const roleLabel = user?.role?.name ? ROLE_LABELS[user.role.name] ?? user.role.name : 'Team'

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col overflow-hidden transition-transform duration-300 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ background: '#111827' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-4">
          <BrandMark />
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:bg-white/8 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Role label */}
        <div className="px-4 py-2.5">
          <span className="inline-flex items-center rounded-md bg-[#1E7A3A]/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4ade80]">
            {roleLabel}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 pb-4 sidebar-scroll">
          {sections.map((section) => (
            <div key={section.title} className="mb-4">
              <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  if (item.subItems) {
                    return (
                      <NavGroup
                        key={item.label}
                        item={item}
                        location={location}
                        onClose={onClose}
                      />
                    )
                  }
                  const Icon = item.icon
                  const isActive = item.path ? location.pathname.startsWith(item.path) : false
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path!}
                      onClick={() => { if (window.innerWidth < 1024) onClose() }}
                      className={clsx(
                        'flex items-center gap-2.5 rounded-xl px-3 py-2 transition-colors duration-150',
                        isActive ? 'bg-[#1E7A3A]/15 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                      )}
                    >
                      <span
                        className={clsx(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                          isActive ? 'bg-[#1E7A3A]/20 text-[#22c55e]' : 'text-white/40'
                        )}
                      >
                        <Icon className="h-[17px] w-[17px]" />
                      </span>
                      <span className="text-[13px] font-medium tracking-[-0.01em]">{item.label}</span>
                      {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#22c55e]" />}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/[0.07] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1E7A3A]/20 text-[11px] font-bold text-[#4ade80]">
              {user?.full_name?.slice(0, 2).toUpperCase() ?? 'FM'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-white/80">{user?.full_name ?? 'Loading…'}</div>
              <div className="truncate text-[11px] text-white/35">{user?.email ?? ''}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
