import { useMemo, useState, type ElementType } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  Bird,
  Boxes,
  ChevronDown,
  CircleDot,
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
      { label: 'Reports & Analytics', icon: BarChart3, path: '/analytics', permission: 'reports:read' },
    ],
  },
  {
    title: 'Farm Operations',
    items: [
      {
        label: 'Farm Management',
        icon: Bird,
        subItems: [
          { label: 'Poultry Houses', path: '/farm/houses', permission: 'farm:read' },
          { label: 'Batches', path: '/farm/batches', permission: 'farm:read' },
          { label: 'Mortality', path: '/farm/mortality', permission: 'farm:read' },
          { label: 'Vaccination', path: '/farm/vaccination', permission: 'farm:read' },
          { label: 'Growth Tracking', path: '/farm/growth', permission: 'farm:read' },
        ],
      },
      {
        label: 'Feed Management',
        icon: Wheat,
        subItems: [
          { label: 'Feed Stock', path: '/feed/stock', permission: 'feed:read' },
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
        label: 'Sales & Customers',
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
    title: 'Administration',
    items: [
      {
        label: 'Settings',
        icon: Settings,
        subItems: [
          { label: 'Users & Access', path: '/settings/users', permission: 'users:read' },
          { label: 'Business Settings', path: '/settings/config', permission: 'settings:read' },
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

  const toggleMenu = (label: string) => {
    setExpandedMenus((current) => ({ ...current, [label]: !current[label] }))
  }

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-ink-950/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <motion.aside
        className={clsx(
          'sidebar no-scrollbar fixed left-0 top-0 transition-transform duration-300 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top_left,rgba(37,157,53,0.24),transparent_55%)]" />

        <div className="relative z-10 border-b border-white/10 px-5 pb-5 pt-6">
          <BrandMark light showTagline className="items-start" />
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-white/55">
                  Active Workspace
                </div>
                <div className="mt-1 text-sm font-semibold text-white">{roleLabel}</div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-500/15 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-brand-100">
                <CircleDot className="h-3.5 w-3.5 text-brand-300" />
                Online
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto px-3 py-5">
          {sections.map((section) => (
            <div key={section.title} className="mb-6 last:mb-0">
              <div className="px-3 pb-2 text-[0.68rem] font-bold uppercase tracking-[0.26em] text-white/45">
                {section.title}
              </div>

              <div className="space-y-1.5">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isLeafItemActive = item.path ? location.pathname.startsWith(item.path) : false
                  const hasActiveSubItem = item.subItems?.some((subItem) => location.pathname.startsWith(subItem.path))
                  const isActive = isLeafItemActive || hasActiveSubItem
                  const isExpanded = expandedMenus[item.label] ?? hasActiveSubItem

                  if (item.subItems) {
                    return (
                      <div key={item.label}>
                        <button
                          type="button"
                          onClick={() => toggleMenu(item.label)}
                          className={clsx(
                            'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-150',
                            isActive ? 'bg-white/10 text-white' : 'text-white/72 hover:bg-white/6 hover:text-white'
                          )}
                        >
                          <div
                            className={clsx(
                              'flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-150',
                              isActive ? 'bg-brand-500/18 text-brand-100' : 'bg-white/6 text-white/65'
                            )}
                          >
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">{item.label}</div>
                          </div>
                          <ChevronDown
                            className={clsx(
                              'h-4 w-4 shrink-0 text-white/45 transition-transform duration-200',
                              isExpanded ? 'rotate-180' : ''
                            )}
                          />
                        </button>

                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.18 }}
                              className="overflow-hidden"
                            >
                              <div className="ml-12 mt-1 space-y-1 border-l border-white/8 pl-3">
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
                                        'block rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150',
                                        isSubActive
                                          ? 'bg-brand-500/12 text-white'
                                          : 'text-white/60 hover:bg-white/6 hover:text-white'
                                      )}
                                    >
                                      {subItem.label}
                                    </NavLink>
                                  )
                                })}
                              </div>
                            </motion.div>
                          )}
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
                        'flex items-center gap-3 rounded-2xl px-3 py-3 transition-all duration-150',
                        isActive ? 'bg-white/10 text-white' : 'text-white/72 hover:bg-white/6 hover:text-white'
                      )}
                    >
                      <div
                        className={clsx(
                          'flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-150',
                          isActive ? 'bg-brand-500/18 text-brand-100' : 'bg-white/6 text-white/65'
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

        <div className="relative z-10 border-t border-white/10 px-5 py-4">
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-white/45">
              Farmexa ERP
            </div>
            <div className="mt-1 text-sm font-medium text-white/76">
              Premium poultry operations workspace
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  )
}
