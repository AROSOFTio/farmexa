import { useMemo, type ElementType } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BarChart3,
  Bird,
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
    title: 'Main',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', permission: 'dashboard:read' },
      { label: 'Reports', icon: BarChart3, path: '/analytics', permission: 'reports:read' },
    ],
  },
  {
    title: 'Farm',
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
        icon: DollarSign,
        subItems: [
          { label: 'Expenses', path: '/finance/expenses', permission: 'finance:read' },
          { label: 'Income', path: '/finance/incomes', permission: 'finance:read' },
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

  const roleLabel = user?.role?.name ? ROLE_LABELS[user.role.name] ?? user.role.name : 'Team'

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
          'sidebar transition-transform duration-300 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="border-b border-neutral-200 px-5 py-6">
          <BrandMark />
          <div className="mt-5 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/88">
            {roleLabel}
          </div>
        </div>

        <div className="sidebar-scroll flex-1 overflow-y-auto px-3 py-5">
          {sections.map((section) => (
            <div key={section.title} className="mb-6">
              <div className="px-3 pb-2 text-[0.68rem] font-medium uppercase tracking-[0.24em] text-white/38">
                {section.title}
              </div>

              <div className="space-y-2">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const hasActiveSubItem = item.subItems?.some((subItem) => location.pathname.startsWith(subItem.path))
                  const isLeafActive = item.path ? location.pathname.startsWith(item.path) : false
                  const isActive = hasActiveSubItem || isLeafActive

                  if (item.subItems) {
                    return (
                      <div key={item.label} className="rounded-[24px] border border-white/6 bg-white/[0.03] p-2.5">
                        <div
                          className={clsx(
                            'flex items-center gap-3 rounded-[20px] px-3 py-3',
                            isActive ? 'bg-white/8 text-white' : 'text-white/82'
                          )}
                        >
                          <div
                            className={clsx(
                              'flex h-10 w-10 items-center justify-center rounded-[18px]',
                              isActive ? 'bg-[#20a53a]/18 text-[#20a53a]' : 'bg-white/6 text-white/68'
                            )}
                          >
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0 flex-1 truncate text-sm font-medium tracking-[-0.02em]">{item.label}</div>
                        </div>

                        <div className="ml-[3.4rem] mt-2 space-y-1">
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
                                  'block rounded-2xl px-3 py-2.5 text-[13px] font-medium tracking-[-0.01em] transition-colors',
                                  isSubActive
                                    ? 'bg-[#20a53a]/16 text-[#20a53a]'
                                    : 'text-white/64 hover:bg-white/6 hover:text-white'
                                )}
                              >
                                {subItem.label}
                              </NavLink>
                            )
                          })}
                        </div>
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
                        'flex items-center gap-3 rounded-[22px] px-3 py-3 transition-colors',
                        isActive ? 'bg-white/8 text-white' : 'text-white/82 hover:bg-white/6 hover:text-white'
                      )}
                    >
                      <div
                        className={clsx(
                          'flex h-10 w-10 items-center justify-center rounded-[18px]',
                          isActive ? 'bg-[#20a53a]/18 text-[#20a53a]' : 'bg-white/6 text-white/68'
                        )}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <span className="flex-1 text-sm font-medium tracking-[-0.02em]">{item.label}</span>
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
