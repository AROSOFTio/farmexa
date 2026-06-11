import { type ElementType, useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Building2,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  Gauge,
  LayoutDashboard,
  PackageCheck,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Users,
  Warehouse,
  Wheat,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '@/features/auth/AuthContext'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'
import { BrandMark } from '@/components/BrandMark'

interface NavLeaf {
  label: string
  path: string
  permission?: string
  moduleKey?: string
}

interface NavGroup {
  label: string
  path?: string
  permission?: string
  moduleKey?: string
  icon: ElementType
  children?: NavLeaf[]
  section?: string
}

const FARM_NAV: NavGroup[] = [
  { label: 'Dashboard', path: '/dashboard', moduleKey: 'dashboard', icon: LayoutDashboard },
  {
    label: 'Farm Operations',
    icon: Gauge,
    section: 'Operations',
    children: [
      { label: 'Houses / Pens', path: '/farm/houses', permission: 'farm:read', moduleKey: 'houses' },
      { label: 'Flocks / Batches', path: '/farm/batches', permission: 'farm:read', moduleKey: 'batches' },
      { label: 'Mortality', path: '/farm/mortality', permission: 'farm:read', moduleKey: 'mortality' },
      { label: 'Vaccination', path: '/farm/vaccination', permission: 'farm:read', moduleKey: 'vaccination' },
      { label: 'Growth / Weight', path: '/farm/growth', permission: 'farm:read', moduleKey: 'growth_tracking' },
      { label: 'Egg Production', path: '/farm/eggs', permission: 'farm:read', moduleKey: 'egg_production' },
    ],
  },
  {
    label: 'Feed',
    icon: Wheat,
    children: [
      { label: 'Feed Stock', path: '/feed/stock', permission: 'feed:read', moduleKey: 'feed_stock' },
      { label: 'Feed Purchases', path: '/feed/purchases', permission: 'feed:read', moduleKey: 'feed_purchases' },
      { label: 'Feed Consumption', path: '/feed/consumption', permission: 'feed:read', moduleKey: 'feed_consumption' },
      { label: 'Feed Mill Formulations', path: '/feed/formulations', permission: 'feed:read', moduleKey: 'feed_stock' },
      { label: 'Feed Mill Production', path: '/feed/production', permission: 'feed:write', moduleKey: 'feed_purchases' },
      { label: 'Suppliers', path: '/feed/suppliers', permission: 'feed:read', moduleKey: 'feed_suppliers' },
    ],
  },
  {
    label: 'Inventory',
    icon: PackageCheck,
    children: [
      { label: 'Stock Items', path: '/inventory/items', permission: 'inventory:read', moduleKey: 'inventory_items' },
      { label: 'Stock Movements', path: '/inventory/movements', permission: 'inventory:read', moduleKey: 'inventory_movements' },
      { label: 'Goods Issue (GIV)', path: '/inventory/giv', permission: 'giv:read', moduleKey: 'inventory_movements' },
      { label: 'Goods Received (GRN)', path: '/inventory/grn', permission: 'grn:read', moduleKey: 'inventory_movements' },
      { label: 'Branch Transfers', path: '/inventory/branch-transfers', permission: 'inventory:read', moduleKey: 'inventory_movements' },
      { label: 'Store Locations', path: '/inventory/store-locations', permission: 'inventory:read', moduleKey: 'inventory_items' },
      { label: 'Low Stock Alerts', path: '/inventory/low-stock', permission: 'inventory:read', moduleKey: 'inventory_items' },
      { label: 'Medicine Stock', path: '/inventory/medicine', permission: 'inventory:read', moduleKey: 'medicine_supplies' },
    ],
  },
  {
    label: 'Slaughter',
    icon: SlidersHorizontal,
    children: [
      { label: 'Planning', path: '/slaughter/planning', permission: 'slaughter:read', moduleKey: 'slaughter_planning' },
      { label: 'Records', path: '/slaughter/records', permission: 'slaughter:read', moduleKey: 'slaughter_records' },
      { label: 'Outputs & Cuts', path: '/slaughter/outputs', permission: 'slaughter:read', moduleKey: 'slaughter_outputs' },
      { label: 'Yield Analysis', path: '/slaughter/yield', permission: 'slaughter:read', moduleKey: 'yield_analysis' },
    ],
  },
  {
    label: 'Sales',
    icon: ShoppingCart,
    section: 'Commercial',
    children: [
      { label: 'POS / Cashier', path: '/sales/pos', permission: 'sales:write', moduleKey: 'sales_orders' },
      { label: 'Customers', path: '/sales/customers', permission: 'sales:read', moduleKey: 'customers' },
      { label: 'Orders', path: '/sales/orders', permission: 'sales:read', moduleKey: 'sales_orders' },
      { label: 'Invoices & Payments', path: '/sales/invoices', permission: 'sales:read', moduleKey: 'invoices' },
    ],
  },
  {
    label: 'Accounting',
    icon: CreditCard,
    children: [
      { label: 'Chart of Accounts', path: '/accounting/coa', permission: 'accounting:read' },
      { label: 'Journal Entries', path: '/accounting/journals', permission: 'accounting:read' },
      { label: 'Fiscal Years', path: '/accounting/settings', permission: 'accounting:write' },
      { label: 'Quick Expenses', path: '/finance/expenses', permission: 'finance:read' },
      { label: 'Quick Income', path: '/finance/incomes', permission: 'finance:read' },
      { label: 'Profit & Loss', path: '/reports/profit-loss', permission: 'reports:read' },
    ],
  },
  {
    label: 'Compliance',
    icon: ShieldCheck,
    section: 'Governance',
    children: [
      { label: 'Documents', path: '/compliance/documents', permission: 'farm:read', moduleKey: 'compliance_documents' },
      { label: 'Expiry Alerts', path: '/compliance/alerts', permission: 'farm:read', moduleKey: 'compliance_alerts' },
    ],
  },
  {
    label: 'Reports',
    icon: BarChart3,
    children: [
      { label: 'Overview', path: '/reports', permission: 'reports:read', moduleKey: 'reports' },
      { label: 'Sales Summary', path: '/reports/sales-summary', permission: 'reports:read', moduleKey: 'reports' },
      { label: 'Inventory Stock', path: '/reports/inventory-stock', permission: 'reports:read', moduleKey: 'reports' },
      { label: 'Feed Stock', path: '/reports/feed-stock', permission: 'reports:read', moduleKey: 'reports' },
      { label: 'Feed Consumption', path: '/reports/feed-consumption', permission: 'reports:read', moduleKey: 'reports' },
      { label: 'Compliance Expiry', path: '/reports/compliance-expiring', permission: 'reports:read', moduleKey: 'reports' },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    children: [
      { label: 'Farm Profile', path: '/settings/profile', moduleKey: 'farm_profile' },
      { label: 'Branches', path: '/settings/branches', permission: 'settings:read', moduleKey: 'settings' },
      { label: 'Users', path: '/settings/users', permission: 'users:read', moduleKey: 'users' },
      { label: 'Roles', path: '/settings/roles', permission: 'settings:read', moduleKey: 'settings' },
      { label: 'Company Settings', path: '/settings/company', permission: 'settings:read', moduleKey: 'settings' },
      { label: 'Subscription', path: '/settings/subscription' },
      { label: 'Custom Domains', path: '/account/domains' },
    ],
  },
]

const DEV_NAV: NavGroup[] = [
  { label: 'Dashboard', path: '/dev-admin/dashboard', permission: 'dev_admin:read', icon: LayoutDashboard },
  { label: 'Tenants / Farms', path: '/dev-admin/tenants', permission: 'dev_admin:read', icon: Building2 },
  { label: 'Trial Management', path: '/dev-admin/trials', permission: 'dev_admin:read', icon: ClipboardCheck },
  { label: 'Domain Management', path: '/dev-admin/domains', permission: 'dev_admin:read', icon: Warehouse },
  { label: 'Plans & Pricing', path: '/dev-admin/plans', permission: 'dev_admin:read', icon: CreditCard },
  { label: 'Modules Management', path: '/dev-admin/modules', permission: 'dev_admin:read', icon: SlidersHorizontal },
  { label: 'Users & Roles', path: '/settings/users', permission: 'dev_admin:read', icon: Users },
  { label: 'Email Automation', path: '/dev-admin/emails', permission: 'dev_admin:read', icon: ClipboardCheck },
  { label: 'Payments & Billing', path: '/dev-admin/billing', permission: 'dev_admin:read', icon: CreditCard },
  { label: 'Affiliates', path: '/dev-admin/affiliates', permission: 'dev_admin:read', icon: Users },
  { label: 'System Health', path: '/dev-admin/system-health', permission: 'dev_admin:read', icon: Gauge },
  { label: 'Audit Logs', path: '/dev-admin/audit-logs', permission: 'dev_admin:read', icon: BarChart3 },
  { label: 'Settings', path: '/dev-admin/settings', permission: 'dev_admin:read', icon: Settings },
]

const PLATFORM_ADMIN_ROLES = new Set(['super_manager', 'developer_admin'])

function isActivePath(currentPath: string, targetPath: string) {
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
}

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { hasPermission, hasModuleAccess, tenant, user } = useAuth()
  const { settings } = usePlatformSettings()
  const isDevAdmin = PLATFORM_ADMIN_ROLES.has(user?.role?.name ?? '')
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set([]))

  const canSee = (item: NavLeaf | NavGroup) => {
    const allowedByPermission = !item.permission || hasPermission(item.permission)
    const allowedByModule = !item.moduleKey || hasModuleAccess(item.moduleKey)
    return allowedByPermission && allowedByModule
  }

  const groups = useMemo(() => {
    const source = isDevAdmin ? DEV_NAV : FARM_NAV
    return source
      .map((group) => ({
        ...group,
        children: group.children?.filter(canSee),
      }))
      .filter((group) => (group.children ? group.children.length > 0 : canSee(group)))
  }, [hasModuleAccess, hasPermission, isDevAdmin])

  useEffect(() => {
    const activeGroup = groups.find((group) =>
      group.children?.some((child) => isActivePath(location.pathname, child.path))
    )
    if (activeGroup) {
      setOpenGroups((current) => new Set(current).add(activeGroup.label))
    }
  }, [groups, location.pathname])

  const workspaceName = tenant?.name ?? (isDevAdmin ? settings.company_name : 'Tenant Workspace')
  const trialDays = tenant?.subscription_expiry
    ? Math.max(Math.ceil((new Date(tenant.subscription_expiry).getTime() - Date.now()) / 86_400_000), 0)
    : 14

  const toggleGroup = (group: NavGroup) => {
    if (!group.children?.length) {
      if (group.path) navigate(group.path)
      if (window.innerWidth < 1024) onClose()
      return
    }
    setOpenGroups((current) => {
      const next = new Set(current)
      if (next.has(group.label)) next.delete(group.label)
      else next.add(group.label)
      return next
    })
  }

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-[232px] flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] text-[var(--sidebar-text)] shadow-[var(--sidebar-shadow)] transition-transform duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* ── Header ── */}
        <div className="shrink-0 border-b border-[var(--sidebar-border)] px-4 py-4">
          <div className="flex items-center gap-3">
            <BrandMark compact />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold leading-5 text-[var(--sidebar-text)]">
                {isDevAdmin ? settings.company_name : workspaceName.split(' ')[0]}
              </div>
              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                {isDevAdmin ? 'SaaS Control Center' : 'Poultry ERP'}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text)] lg:hidden"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 scrollbar-thin">
          {groups.map((group, idx) => {
            const Icon = group.icon
            const hasChildren = Boolean(group.children?.length)
            const open = openGroups.has(group.label)
            const active = hasChildren
              ? group.children!.some((child) => isActivePath(location.pathname, child.path))
              : Boolean(group.path && isActivePath(location.pathname, group.path))

            const showSection = !isDevAdmin && group.section

            return (
              <div key={group.label}>
                {/* Section divider label */}
                {showSection ? (
                  <div className={clsx('px-2 pb-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[var(--sidebar-section)]', idx === 0 ? 'pt-1' : 'pt-5')}>
                    {group.section}
                  </div>
                ) : idx === 0 && !group.section ? null : null}

                <div className="mb-0.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    className={clsx(
                      'group flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[12px] font-semibold transition-all duration-150',
                      active
                        ? 'border border-[rgba(var(--brand-primary-rgb),0.22)] bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)]'
                        : 'border border-transparent text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text)]'
                    )}
                  >
                    <Icon
                      className={clsx(
                        'h-[15px] w-[15px] shrink-0 transition-colors',
                        active ? 'text-[var(--sidebar-active-text)]' : 'text-[var(--sidebar-icon)]'
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{group.label}</span>
                    {hasChildren ? (
                      <ChevronDown
                        className={clsx(
                          'h-3 w-3 shrink-0 transition-transform duration-200',
                          open && 'rotate-180',
                          active ? 'text-[var(--sidebar-active-text)]' : 'text-[var(--sidebar-muted)]'
                        )}
                      />
                    ) : null}
                  </button>

                  {/* Children */}
                  {hasChildren && open ? (
                    <div className="ml-[19px] mt-0.5 border-l border-[var(--sidebar-border)] pl-3 pb-1">
                      {group.children!.map((child) => {
                        const childActive = isActivePath(location.pathname, child.path)
                        return (
                          <NavLink
                            key={child.path}
                            to={child.path}
                            onClick={() => {
                              if (window.innerWidth < 1024) onClose()
                            }}
                            className={clsx(
                              'my-0.5 flex items-center gap-2 rounded-[6px] px-2.5 py-[5px] text-[11.5px] font-medium transition-colors duration-150',
                              childActive
                                ? 'bg-[var(--sidebar-active-bg)] font-semibold text-[var(--sidebar-active-text)]'
                                : 'text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text)]'
                            )}
                          >
                            {childActive ? (
                              <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--brand-primary)]" />
                            ) : (
                              <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--sidebar-muted)] opacity-40" />
                            )}
                            {child.label}
                          </NavLink>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </nav>

        {/* ── Workspace / Trial Panel ── */}
        {!isDevAdmin ? (
          <div className="shrink-0 border-t border-[var(--sidebar-border)] p-3">
            <div className="rounded-[10px] border border-[rgba(var(--brand-primary-rgb),0.24)] bg-[var(--sidebar-panel)] px-3.5 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[11.5px] font-bold text-[var(--sidebar-text)]">{workspaceName}</div>
                  <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-primary)]">
                    {tenant?.subscription_status ?? 'Trial'} plan
                  </div>
                </div>
                <div className="shrink-0 rounded-[7px] border border-[rgba(var(--brand-primary-rgb),0.3)] bg-[rgba(var(--brand-primary-rgb),0.1)] px-2 py-1 text-center">
                  <div className="text-[15px] font-bold leading-none text-[var(--sidebar-text)]">{trialDays}</div>
                  <div className="mt-0.5 text-[8.5px] font-bold uppercase tracking-wider text-[var(--sidebar-muted)]">days</div>
                </div>
              </div>

              <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-[rgba(var(--brand-primary-rgb),0.14)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-hover)] transition-all duration-500"
                  style={{ width: `${Math.max(Math.min((trialDays / 14) * 100, 100), 4)}%` }}
                />
              </div>

              <button
                type="button"
                onClick={() => navigate('/subscription/upgrade')}
                className="mt-3 flex h-8 w-full items-center justify-center rounded-[7px] bg-[var(--brand-primary)] text-[11.5px] font-bold text-white transition-opacity hover:opacity-90"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        ) : null}
      </aside>
    </>
  )
}
