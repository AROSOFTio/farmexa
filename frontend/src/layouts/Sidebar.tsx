import { type ElementType, useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Activity,
  Bird,
  Building2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Droplets,
  Egg,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  Scale,
  Settings,
  Shield,
  ShoppingCart,
  Skull,
  Syringe,
  Users,
  Warehouse,
  Wheat,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/features/auth/AuthContext'
import { ROLE_LABELS } from '@/lib/branding'

interface NavItem {
  label: string
  path: string
  permission: string
  moduleKey?: string
  icon: ElementType
}

interface NavSection {
  title: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Dashboard',
    items: [{ label: 'Overview', path: '/dashboard', permission: 'dashboard:read', moduleKey: 'dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Farm Setup',
    items: [
      { label: 'Houses / Pens', path: '/farm/houses', permission: 'farm:read', moduleKey: 'houses', icon: Building2 },
      { label: 'Suppliers', path: '/feed/suppliers', permission: 'feed:read', moduleKey: 'feed_suppliers', icon: Users },
    ],
  },
  {
    title: 'Batches / Flocks',
    items: [{ label: 'All Batches', path: '/farm/batches', permission: 'farm:read', moduleKey: 'batches', icon: Bird }],
  },
  {
    title: 'Daily Operations',
    items: [
      { label: 'Egg Collection', path: '/farm/eggs', permission: 'farm:read', moduleKey: 'egg_production', icon: Egg },
      { label: 'Feed Usage', path: '/feed/consumption', permission: 'feed:read', moduleKey: 'feed_consumption', icon: Wheat },
      { label: 'Mortality', path: '/farm/mortality', permission: 'farm:read', moduleKey: 'mortality', icon: Skull },
      { label: 'Vaccination', path: '/farm/vaccination', permission: 'farm:read', moduleKey: 'vaccination', icon: Syringe },
      { label: 'Growth / Weight Checks', path: '/farm/growth', permission: 'farm:read', moduleKey: 'growth_tracking', icon: Scale },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { label: 'Feed Stock', path: '/feed/stock', permission: 'feed:read', moduleKey: 'feed_stock', icon: Warehouse },
      { label: 'Inventory Items', path: '/inventory/items', permission: 'inventory:read', moduleKey: 'inventory_items', icon: Package },
      { label: 'Stock Movements', path: '/inventory/movements', permission: 'inventory:read', moduleKey: 'inventory_movements', icon: Activity },
      { label: 'Medicine Stock', path: '/inventory/medicine', permission: 'inventory:read', moduleKey: 'medicine_supplies', icon: Droplets },
    ],
  },
  {
    title: 'Slaughter',
    items: [
      { label: 'Slaughter Records', path: '/slaughter/records', permission: 'slaughter:read', moduleKey: 'slaughter_records', icon: ClipboardList },
      { label: 'Slaughter Outputs', path: '/slaughter/outputs', permission: 'slaughter:read', moduleKey: 'slaughter_outputs', icon: Package },
      { label: 'Yield Analysis', path: '/slaughter/yield', permission: 'slaughter:read', moduleKey: 'slaughter_records', icon: Scale },
    ],
  },
  {
    title: 'Sales',
    items: [
      { label: 'Customers', path: '/sales/customers', permission: 'sales:read', moduleKey: 'customers', icon: Users },
      { label: 'Orders', path: '/sales/orders', permission: 'sales:read', moduleKey: 'sales_orders', icon: ShoppingCart },
      { label: 'Invoices', path: '/sales/invoices', permission: 'sales:read', moduleKey: 'invoices', icon: Receipt },
      { label: 'Payments', path: '/sales/payments', permission: 'sales:read', moduleKey: 'payments', icon: CreditCard },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Expenses', path: '/finance/expenses', permission: 'finance:read', moduleKey: 'expenses', icon: Receipt },
      { label: 'Income', path: '/finance/incomes', permission: 'finance:read', moduleKey: 'income', icon: CreditCard },
      { label: 'Profit & Loss', path: '/analytics', permission: 'reports:read', moduleKey: 'reports', icon: FileText },
    ],
  },
  {
    title: 'Reports',
    items: [{ label: 'Reports Center', path: '/reports/production', permission: 'reports:read', moduleKey: 'reports', icon: FileText }],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Users', path: '/settings/users', permission: 'users:read', moduleKey: 'users', icon: Users },
      { label: 'Roles', path: '/settings/roles', permission: 'settings:read', moduleKey: 'settings', icon: Shield },
      { label: 'Settings', path: '/settings/config', permission: 'settings:read', moduleKey: 'settings', icon: Settings },
    ],
  },
  {
    title: 'Developer Admin',
    items: [
      { label: 'Vendors', path: '/dev-admin/tenants', permission: 'dev_admin:read', icon: Building2 },
      { label: 'Domains', path: '/dev-admin/domains', permission: 'dev_admin:read', icon: Activity },
      { label: 'Plans', path: '/dev-admin/plans', permission: 'dev_admin:read', icon: CreditCard },
      { label: 'Modules', path: '/dev-admin/modules', permission: 'dev_admin:read', icon: Package },
      { label: 'Billing', path: '/dev-admin/billing', permission: 'dev_admin:read', icon: Receipt },
      { label: 'Tenant Control', path: '/dev-admin/control', permission: 'dev_admin:read', icon: Shield },
    ],
  },
]

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const location = useLocation()
  const { hasPermission, hasModuleAccess, tenant, user } = useAuth()

  const sections = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => hasPermission(item.permission) && (!item.moduleKey || hasModuleAccess(item.moduleKey))),
      })).filter((section) => section.items.length > 0),
    [hasModuleAccess, hasPermission]
  )

  const roleLabel = user?.role?.name ? ROLE_LABELS[user.role.name] ?? user.role.name : 'Team'

  return (
    <>
      {isOpen ? <button type="button" className="fixed inset-0 z-40 bg-black/45 lg:hidden" onClick={onClose} /> : null}

      <aside
        className={clsx(
          'sidebar fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col overflow-hidden transition-transform duration-300 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between border-b border-white/15 px-5 py-5">
          <BrandMark light showTagline />
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white/90 hover:bg-white/15 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-white/15 px-5 py-4">
          <div className="inline-flex rounded-full border border-white/20 bg-white/14 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/92">
            {roleLabel}
          </div>
          {tenant ? (
            <div className="mt-3 rounded-[1.6rem] border border-white/15 bg-white/10 px-4 py-3.5">
              <div className="truncate text-sm font-semibold text-white">{tenant.name}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/78">
                {tenant.plan} {tenant.primary_domain ? `- ${tenant.primary_domain}` : ''}
              </div>
            </div>
          ) : null}
        </div>

        <nav className="sidebar-scroll flex-1 overflow-y-auto px-4 py-5">
          {sections.map((section) => (
            <div key={section.title} className="mb-6">
              <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/70">{section.title}</div>
              <div className="space-y-1">
                {section.items.map((item) => {
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
                        'group flex items-center gap-3 rounded-[1.35rem] px-3 py-3 transition-colors',
                        active ? 'bg-white text-[#202020] shadow-[0_18px_34px_-20px_rgba(255,255,255,0.95)]' : 'text-white/95 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <span
                        className={clsx(
                          'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
                          active ? 'border-[#34a853]/20 bg-[#34a853]/12 text-[#34a853]' : 'border-white/15 bg-white/8 text-white group-hover:bg-white/16'
                        )}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <span className="flex-1 text-[13px] font-bold tracking-[0.01em]">{item.label}</span>
                      <ChevronRight className={clsx('h-4 w-4 transition-opacity', active ? 'text-[#34a853] opacity-100' : 'text-white/80 opacity-0 group-hover:opacity-90')} />
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/15 px-5 py-4">
          <div className="flex items-center gap-3 rounded-[1.55rem] border border-white/15 bg-white/10 px-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/18 text-xs font-bold text-white">
              {user?.full_name?.slice(0, 2).toUpperCase() ?? 'FX'}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{user?.full_name ?? 'Loading...'}</div>
              <div className="truncate text-xs text-white/80">{user?.email ?? ''}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
