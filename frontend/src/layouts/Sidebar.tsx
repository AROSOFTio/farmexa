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
}

const FARM_NAV: NavGroup[] = [
  { label: 'Dashboard', path: '/dashboard', permission: 'dashboard:read', moduleKey: 'dashboard', icon: LayoutDashboard },
  {
    label: 'Farm Setup',
    icon: Building2,
    children: [
      { label: 'Farm Profile', path: '/farm/profile', moduleKey: 'farm_profile' },
      { label: 'Houses / Pens', path: '/farm/houses', permission: 'farm:read', moduleKey: 'houses' },
      { label: 'Staff', path: '/farm/staff', permission: 'users:read', moduleKey: 'users' },
      { label: 'Suppliers', path: '/farm/suppliers', permission: 'feed:read', moduleKey: 'feed_suppliers' },
    ],
  },
  {
    label: 'Feed Mill',
    icon: Wheat,
    children: [
      { label: 'Raw Materials', path: '/feed-mill/raw-materials', permission: 'feed:read', moduleKey: 'feed_stock' },
      { label: 'Feed Formulations', path: '/feed-mill/formulations', permission: 'feed:read', moduleKey: 'feed_stock' },
      { label: 'Feed Production', path: '/feed-mill/production', permission: 'feed:write', moduleKey: 'feed_purchases' },
      { label: 'Feed Stock', path: '/feed-mill/stock', permission: 'feed:read', moduleKey: 'feed_stock' },
      { label: 'Feed Transfers', path: '/feed-mill/transfers', permission: 'inventory:read', moduleKey: 'inventory_movements' },
    ],
  },
  {
    label: 'Farm Operations',
    icon: Gauge,
    children: [
      { label: 'Flocks / Batches', path: '/farm/batches', permission: 'farm:read', moduleKey: 'batches' },
      { label: 'Mortality', path: '/farm/mortality', permission: 'farm:read', moduleKey: 'mortality' },
      { label: 'Vaccination', path: '/farm/vaccination', permission: 'farm:read', moduleKey: 'vaccination' },
      { label: 'Medication', path: '/farm/medication', permission: 'inventory:read', moduleKey: 'medicine_supplies' },
      { label: 'Feed Usage', path: '/farm/feed-usage', permission: 'feed:read', moduleKey: 'feed_consumption' },
      { label: 'Growth / Weight', path: '/farm/growth', permission: 'farm:read', moduleKey: 'growth_tracking' },
    ],
  },
  {
    label: 'Inventory & Transfers',
    icon: PackageCheck,
    children: [
      { label: 'Stock Items', path: '/inventory/items', permission: 'inventory:read', moduleKey: 'inventory_items' },
      { label: 'Stock Movements', path: '/inventory/movements', permission: 'inventory:read', moduleKey: 'inventory_movements' },
      { label: 'GRN / GIV Transfers', path: '/inventory/transfers', permission: 'inventory:read', moduleKey: 'inventory_movements' },
      { label: 'Goods Received Notes', path: '/inventory/grn', permission: 'inventory:read', moduleKey: 'inventory_movements' },
      { label: 'Goods Issued Vouchers', path: '/inventory/giv', permission: 'inventory:read', moduleKey: 'inventory_movements' },
      { label: 'Low Stock Alerts', path: '/inventory/low-stock', permission: 'inventory:read', moduleKey: 'inventory_items' },
    ],
  },
  {
    label: 'Slaughter',
    icon: SlidersHorizontal,
    children: [
      { label: 'Slaughter Planning', path: '/slaughter/planning', permission: 'slaughter:read', moduleKey: 'slaughter_planning' },
      { label: 'Slaughter Records', path: '/slaughter/records', permission: 'slaughter:read', moduleKey: 'slaughter_records' },
      { label: 'Meat Cuts', path: '/slaughter/meat-cuts', permission: 'slaughter:read', moduleKey: 'slaughter_cut_parts' },
      { label: 'By-products', path: '/slaughter/byproducts', permission: 'slaughter:read', moduleKey: 'slaughter_byproducts' },
      { label: 'Blast Room', path: '/slaughter/blast-room', permission: 'inventory:read', moduleKey: 'inventory_items' },
      { label: 'Cold Room', path: '/slaughter/cold-room', permission: 'inventory:read', moduleKey: 'inventory_items' },
      { label: 'Yield Analysis', path: '/slaughter/yield', permission: 'slaughter:read', moduleKey: 'yield_analysis' },
    ],
  },
  {
    label: 'Sales & POS',
    icon: ShoppingCart,
    children: [
      { label: 'POS / Cashier', path: '/sales/pos', permission: 'sales:write', moduleKey: 'sales_orders' },
      { label: 'Customers', path: '/sales/customers', permission: 'sales:read', moduleKey: 'customers' },
      { label: 'Orders', path: '/sales/orders', permission: 'sales:read', moduleKey: 'sales_orders' },
      { label: 'Invoices', path: '/sales/invoices', permission: 'sales:read', moduleKey: 'invoices' },
      { label: 'Payments', path: '/sales/payments', permission: 'sales:read', moduleKey: 'payments' },
      { label: 'Receipts', path: '/sales/receipts', permission: 'sales:read', moduleKey: 'payments' },
      { label: 'Sales Store Stock', path: '/sales/store-stock', permission: 'inventory:read', moduleKey: 'inventory_items' },
    ],
  },
  {
    label: 'Finance',
    icon: CreditCard,
    children: [
      { label: 'Expenses', path: '/finance/expenses', permission: 'finance:read', moduleKey: 'expenses' },
      { label: 'Income', path: '/finance/income', permission: 'finance:read', moduleKey: 'income' },
      { label: 'Profit & Loss', path: '/finance/profit-loss', permission: 'reports:read', moduleKey: 'profit_loss' },
      { label: 'Cash Flow', path: '/finance/cash-flow', permission: 'reports:read', moduleKey: 'reports' },
    ],
  },
  {
    label: 'Compliance',
    icon: ShieldCheck,
    children: [
      { label: 'Documents', path: '/compliance/documents', permission: 'farm:read', moduleKey: 'compliance_documents' },
      { label: 'Expiry Alerts', path: '/compliance/alerts', permission: 'farm:read', moduleKey: 'compliance_alerts' },
      { label: 'Quality Control', path: '/compliance/quality-control', permission: 'farm:read', moduleKey: 'compliance_documents' },
    ],
  },
  {
    label: 'Reports',
    icon: BarChart3,
    children: [
      { label: 'Farm Reports', path: '/reports/farm', permission: 'reports:read', moduleKey: 'reports' },
      { label: 'Feed Reports', path: '/reports/feed', permission: 'reports:read', moduleKey: 'reports' },
      { label: 'Slaughter Reports', path: '/reports/slaughter', permission: 'reports:read', moduleKey: 'reports' },
      { label: 'Sales Reports', path: '/reports/sales', permission: 'reports:read', moduleKey: 'reports' },
      { label: 'Finance Reports', path: '/reports/finance', permission: 'reports:read', moduleKey: 'reports' },
      { label: 'Compliance Reports', path: '/reports/compliance', permission: 'reports:read', moduleKey: 'reports' },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    children: [
      { label: 'Profile', path: '/settings/profile', moduleKey: 'farm_profile' },
      { label: 'Subscription', path: '/settings/subscription' },
      { label: 'Users & Roles', path: '/settings/users', permission: 'users:read', moduleKey: 'users' },
      { label: 'Roles', path: '/settings/roles', permission: 'settings:read', moduleKey: 'settings' },
      { label: 'Company Settings', path: '/settings/company', permission: 'settings:read', moduleKey: 'settings' },
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

function isActivePath(currentPath: string, targetPath: string) {
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
}

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { hasPermission, hasModuleAccess, tenant, user } = useAuth()
  const { settings } = usePlatformSettings()
  const isDevAdmin = user?.role?.name === 'developer_admin'
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(['Farm Setup', 'Farm Operations']))

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
      {isOpen ? <button type="button" className="fixed inset-0 z-40 bg-black/45 lg:hidden" onClick={onClose} /> : null}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-[232px] flex-col sidebar text-white shadow-[18px_0_38px_-30px_rgba(0,0,0,.7)] transition-transform duration-300 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <BrandMark compact light />
            <div className="min-w-0">
              <div className="truncate text-[18px] font-extrabold uppercase leading-5 tracking-wide">
                {isDevAdmin ? settings.company_name : workspaceName.split(' ')[0]}
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase leading-3 text-[var(--brand-primary)]">
                {isDevAdmin ? 'SaaS Control Center' : 'Poultry ERP'}
              </div>
            </div>
            <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1 text-white/70 hover:bg-white/10 lg:hidden" aria-label="Close navigation">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-1">
            {groups.map((group) => {
              const Icon = group.icon
              const hasChildren = Boolean(group.children?.length)
              const open = openGroups.has(group.label)
              const active = hasChildren
                ? group.children!.some((child) => isActivePath(location.pathname, child.path))
                : Boolean(group.path && isActivePath(location.pathname, group.path))

              return (
                <div key={group.label}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    className={clsx(
                      'group flex h-10 w-full items-center gap-3 rounded-[7px] px-3 text-left text-[12.5px] font-semibold transition-all',
                      active
                        ? 'bg-[var(--brand-primary)] text-[#111827] shadow-[0_12px_26px_-20px_rgba(226,178,59,.9)]'
                        : 'text-white/88 hover:bg-white/8 hover:text-white'
                    )}
                  >
                      <Icon className={clsx('h-4 w-4', active ? 'text-[#111827]' : 'text-[var(--brand-primary)]')} />
                    <span className="min-w-0 flex-1 truncate">{group.label}</span>
                    {hasChildren ? (
                      <ChevronDown className={clsx('h-3.5 w-3.5 transition-transform', open && 'rotate-180', active ? 'text-[#111827]' : 'text-white/60')} />
                    ) : null}
                  </button>

                  {hasChildren && open ? (
                    <div className="ml-[20px] mt-1 space-y-0.5 border-l border-white/10 pl-3">
                      {group.children!.map((child) => (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          onClick={() => {
                            if (window.innerWidth < 1024) onClose()
                          }}
                          className={({ isActive }) => clsx(
                            'block rounded-[6px] px-3 py-1.5 text-[11.5px] font-semibold transition-colors',
                            isActive || isActivePath(location.pathname, child.path)
                              ? 'bg-[rgba(var(--brand-primary-rgb),0.18)] text-[var(--brand-primary)]'
                              : 'text-white/68 hover:bg-white/8 hover:text-white'
                          )}
                        >
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </nav>

        {!isDevAdmin ? (
          <div className="border-t border-white/10 p-3">
            <div className="rounded-[10px] border border-[rgba(var(--brand-primary-rgb),0.35)] bg-[var(--sidebar-panel)] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[11.5px] font-extrabold text-white">{workspaceName}</div>
                  <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--brand-primary)]">{tenant?.plan ?? 'Trial'} plan</div>
                </div>
                <div className="rounded-[8px] border border-[rgba(var(--brand-primary-rgb),0.35)] bg-[rgba(var(--brand-primary-rgb),0.12)] px-2.5 py-1 text-right">
                  <div className="text-[17px] font-bold leading-none text-white">{trialDays}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wide text-white/60">days</div>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${Math.max(Math.min((trialDays / 14) * 100, 100), 0)}%` }} />
              </div>
              <button type="button" onClick={() => navigate('/subscription/upgrade')} className="mt-3 h-8 w-full rounded-[7px] bg-[var(--brand-primary)] text-[11.5px] font-semibold text-[#111827]">
                Upgrade
              </button>
            </div>
          </div>
        ) : null}
      </aside>
    </>
  )
}
