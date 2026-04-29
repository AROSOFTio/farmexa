import { type ElementType, useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Activity,
  Bird,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Droplets,
  Egg,
  FileBadge2,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  Scale,
  Scissors,
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
  tenantOnly?: boolean
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
      { label: 'Slaughter Planning', path: '/slaughter/planning', permission: 'slaughter:read', moduleKey: 'slaughter_planning', icon: CalendarDays },
      { label: 'Slaughter Records', path: '/slaughter/records', permission: 'slaughter:read', moduleKey: 'slaughter_records', icon: ClipboardList },
      { label: 'Cut Parts', path: '/slaughter/cuts', permission: 'slaughter:read', moduleKey: 'slaughter_cut_parts', icon: Scissors },
      { label: 'Byproducts', path: '/slaughter/byproducts', permission: 'slaughter:read', moduleKey: 'slaughter_byproducts', icon: Package },
      { label: 'Slaughter Outputs', path: '/slaughter/outputs', permission: 'slaughter:read', moduleKey: 'slaughter_outputs', icon: Package },
      { label: 'Yield Analysis', path: '/slaughter/yield', permission: 'slaughter:read', moduleKey: 'yield_analysis', icon: Scale },
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
    title: 'Compliance',
    items: [
      { label: 'Documents', path: '/compliance/documents', permission: 'farm:read', moduleKey: 'compliance_documents', icon: FileBadge2 },
      { label: 'Alerts', path: '/compliance/alerts', permission: 'farm:read', moduleKey: 'compliance_alerts', icon: Shield },
    ],
  },
  {
    title: 'Subscription',
    items: [
      { label: 'Upgrade / Modules', path: '/upgrade/modules', permission: 'dashboard:read', tenantOnly: true, icon: CreditCard },
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
        items: section.items.filter(
          (item) =>
            hasPermission(item.permission) &&
            (!item.moduleKey || hasModuleAccess(item.moduleKey)) &&
            (!item.tenantOnly || (!!tenant && !['super_manager', 'developer_admin'].includes(user?.role?.name ?? '')))
        ),
      })).filter((section) => section.items.length > 0),
    [hasModuleAccess, hasPermission, tenant, user?.role?.name]
  )

  const roleLabel = user?.role?.name ? ROLE_LABELS[user.role.name] ?? user.role.name : 'Team'

  return (
    <>
      {isOpen ? <button type="button" className="fixed inset-0 z-40 bg-black/45 lg:hidden" onClick={onClose} /> : null}

      <aside
        className={clsx(
          'sidebar fixed inset-y-0 left-0 z-50 flex w-[228px] flex-col overflow-hidden transition-transform duration-300 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between border-b px-3.5 py-3">
          <BrandMark light showTagline />
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b px-3.5 py-2">
          <div className="inline-flex rounded-full border border-[var(--sidebar-panel-border)] bg-[var(--sidebar-panel)] px-3 py-1 text-[8.5px] font-semibold uppercase tracking-[0.18em] text-[var(--sidebar-text-muted)]">
            {roleLabel}
          </div>
          {tenant ? (
            <div className="mt-2 rounded-[13px] border border-[var(--sidebar-panel-border)] bg-[var(--sidebar-panel)] px-3 py-2">
              <div className="truncate text-[11.5px] font-semibold text-[var(--sidebar-heading)]">{tenant.name}</div>
              <div className="mt-1 truncate text-[9.5px] tracking-[0.02em] text-[var(--sidebar-text-muted)]">
                {tenant.plan} {tenant.primary_domain ? `| ${tenant.primary_domain}` : ''}
              </div>
            </div>
          ) : null}
        </div>

        <nav className="sidebar-scroll flex-1 overflow-y-auto px-2 py-2.5">
          {sections.map((section) => (
            <div key={section.title} className="mb-3">
              <div className="mb-1 px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--sidebar-heading)]">{section.title}</div>
              <div className="space-y-0.5">
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
                        'group flex items-center gap-1.5 rounded-[10px] px-2 py-1.25 transition-colors',
                        active
                          ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)]'
                          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-heading)]'
                      )}
                    >
                      <span
                        className={clsx(
                          'flex h-[22px] w-[22px] items-center justify-center rounded-md transition-colors',
                          active ? 'bg-black/10 text-white' : 'bg-transparent text-[var(--sidebar-icon)] group-hover:text-[var(--brand-primary)]'
                        )}
                      >
                        <Icon className="h-[13px] w-[13px] stroke-[2.05]" />
                      </span>
                      <span className="flex-1 text-[12px] font-medium leading-[1.15rem] tracking-[0.003em]">{item.label}</span>
                      <ChevronRight
                        className={clsx(
                          'h-[13px] w-[13px] transition-opacity',
                          active ? 'text-white opacity-100' : 'text-[var(--sidebar-text-muted)] opacity-0 group-hover:opacity-70'
                        )}
                      />
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t px-3.5 py-2">
          <div className="flex items-center gap-2.5 rounded-[13px] border border-[var(--sidebar-panel-border)] bg-[var(--sidebar-panel)] px-3 py-2">
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--surface-muted)] text-[10px] font-semibold text-[var(--sidebar-heading)]">
              {user?.full_name?.slice(0, 2).toUpperCase() ?? 'FX'}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[11.5px] font-semibold text-[var(--sidebar-heading)]">{user?.full_name ?? 'Loading...'}</div>
              <div className="truncate text-[9.5px] text-[var(--sidebar-text-muted)]">{user?.email ?? ''}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
