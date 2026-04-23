import { useMemo, useState, type ElementType } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  Bird,
  ChevronDown,
  DollarSign,
  LayoutDashboard,
  Package,
  Scissors,
  Settings,
  ShoppingCart,
  Wheat,
} from 'lucide-react'
import { clsx } from 'clsx'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/features/auth/AuthContext'
import { ROLE_LABELS } from '@/lib/branding'

interface SubItem {
  label: string
  path: string
  permission: string
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
    title: 'Overview',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', permission: 'dashboard:read' },
      { label: 'Reports', icon: BarChart3, path: '/analytics', permission: 'reports:read' },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        label: 'Farm',
        icon: Bird,
        subItems: [
          { label: 'Houses', path: '/farm/houses', permission: 'farm:read' },
          { label: 'Batches', path: '/farm/batches', permission: 'farm:read' },
          { label: 'Mortality', path: '/farm/mortality', permission: 'farm:read' },
          { label: 'Vaccination', path: '/farm/vaccination', permission: 'farm:read' },
          { label: 'Growth', path: '/farm/growth', permission: 'farm:read' },
        ],
      },
      {
        label: 'Feed',
        icon: Wheat,
        subItems: [
          { label: 'Stock', path: '/feed/stock', permission: 'feed:read' },
          { label: 'Purchases', path: '/feed/purchases', permission: 'feed:read' },
          { label: 'Consumption', path: '/feed/consumption', permission: 'feed:read' },
          { label: 'Suppliers', path: '/feed/suppliers', permission: 'feed:read' },
        ],
      },
      {
        label: 'Slaughter',
        icon: Scissors,
        subItems: [
          { label: 'Records', path: '/slaughter/records', permission: 'slaughter:read' },
          { label: 'Outputs', path: '/slaughter/outputs', permission: 'slaughter:read' },
        ],
      },
      {
        label: 'Inventory',
        icon: Package,
        subItems: [
          { label: 'Items', path: '/inventory/items', permission: 'inventory:read' },
          { label: 'Movements', path: '/inventory/movements', permission: 'inventory:read' },
        ],
      },
    ],
  },
  {
    title: 'Commercial',
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
        icon: DollarSign,
        subItems: [
          { label: 'Expenses', path: '/finance/expenses', permission: 'finance:read' },
          { label: 'Income', path: '/finance/incomes', permission: 'finance:read' },
        ],
      },
    ],
  },
  {
    title: 'Admin',
    items: [
      {
        label: 'Settings',
        icon: Settings,
        subItems: [
          { label: 'Users', path: '/settings/users', permission: 'users:read' },
          { label: 'System', path: '/settings/config', permission: 'settings:read' },
        ],
      },
    ],
  },
]

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const location = useLocation()
  const { hasPermission, user } = useAuth()
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})

  const sections = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items
          .map((item) => {
            if (item.subItems) {
              const subItems = item.subItems.filter((subItem) => hasPermission(subItem.permission))
              return subItems.length ? { ...item, subItems } : null
            }

            return item.permission && !hasPermission(item.permission) ? null : item
          })
          .filter(Boolean) as NavItem[],
      })).filter((section) => section.items.length > 0),
    [hasPermission]
  )

  const roleLabel = user?.role?.name ? ROLE_LABELS[user.role.name] ?? user.role.name : 'Team Member'

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-ink-950/20 lg:hidden"
          onClick={onClose}
        />
      ) : null}

      <motion.aside
        className={clsx(
          'sidebar no-scrollbar transition-transform duration-300 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="border-b border-neutral-200 px-5 py-6">
          <BrandMark />
          <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-ink-400">Role</div>
            <div className="mt-1 text-sm font-semibold text-ink-900">{roleLabel}</div>
          </div>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto px-3 py-5">
          {sections.map((section) => (
            <div key={section.title} className="mb-6">
              <div className="px-3 pb-2 text-[0.68rem] font-bold uppercase tracking-[0.24em] text-ink-400">
                {section.title}
              </div>

              <div className="space-y-1.5">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const hasActiveSubItem = item.subItems?.some((subItem) => location.pathname.startsWith(subItem.path))
                  const isLeafActive = item.path ? location.pathname.startsWith(item.path) : false
                  const isActive = hasActiveSubItem || isLeafActive
                  const isExpanded = expandedMenus[item.label] ?? hasActiveSubItem

                  if (item.subItems) {
                    return (
                      <div key={item.label}>
                        <button
                          type="button"
                          onClick={() => setExpandedMenus((current) => ({ ...current, [item.label]: !isExpanded }))}
                          className={clsx(
                            'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors',
                            isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-700 hover:bg-neutral-100'
                          )}
                        >
                          <div
                            className={clsx(
                              'flex h-10 w-10 items-center justify-center rounded-2xl',
                              isActive ? 'bg-brand-100 text-brand-700' : 'bg-neutral-100 text-ink-500'
                            )}
                          >
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0 flex-1 truncate text-sm font-semibold">{item.label}</div>
                          <ChevronDown className={clsx('h-4 w-4 text-ink-400 transition-transform', isExpanded ? 'rotate-180' : '')} />
                        </button>

                        <AnimatePresence initial={false}>
                          {isExpanded ? (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.18 }}
                              className="overflow-hidden"
                            >
                              <div className="ml-12 mt-1 space-y-1 pl-3">
                                {item.subItems.map((subItem) => {
                                  const isSubActive = location.pathname.startsWith(subItem.path)
                                  return (
                                    <NavLink
                                      key={subItem.path}
                                      to={subItem.path}
                                      onClick={() => {
                                        if (window.innerWidth < 1024) onClose()
                                      }}
                                      className={clsx(
                                        'block rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                                        isSubActive ? 'bg-brand-50 text-brand-800' : 'text-ink-600 hover:bg-neutral-100 hover:text-ink-900'
                                      )}
                                    >
                                      {subItem.label}
                                    </NavLink>
                                  )
                                })}
                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    )
                  }

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path!}
                      onClick={() => {
                        if (window.innerWidth < 1024) onClose()
                      }}
                      className={clsx(
                        'flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors',
                        isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-700 hover:bg-neutral-100'
                      )}
                    >
                      <div
                        className={clsx(
                          'flex h-10 w-10 items-center justify-center rounded-2xl',
                          isActive ? 'bg-brand-100 text-brand-700' : 'bg-neutral-100 text-ink-500'
                        )}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <span className="flex-1 text-sm font-semibold">{item.label}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </motion.aside>
    </>
  )
}
