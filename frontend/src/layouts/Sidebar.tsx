import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Leaf,
  Bird,
  Wheat,
  Scissors,
  ShoppingCart,
  Package,
  DollarSign,
  BarChart3,
  Settings,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useState } from 'react'

interface SubItem {
  label: string
  path: string
  permission?: string
}

interface NavItem {
  label: string
  icon: React.ElementType
  path?: string // optional if it has subItems
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
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        label: 'Farm Management',
        icon: Bird,
        subItems: [
          { label: 'Poultry Houses', path: '/farm/houses' },
          { label: 'Batches', path: '/farm/batches' },
          { label: 'Mortality', path: '/farm/mortality' },
          { label: 'Vaccination', path: '/farm/vaccination' },
          { label: 'Growth Tracking', path: '/farm/growth' },
        ],
      },
      {
        label: 'Feed Management',
        icon: Wheat,
        subItems: [
          { label: 'Feed Stock', path: '/feed/stock' },
          { label: 'Purchases', path: '/feed/purchases' },
          { label: 'Consumption', path: '/feed/consumption' },
          { label: 'Suppliers', path: '/feed/suppliers' },
        ],
      },
      {
        label: 'Slaughter',
        icon: Scissors,
        subItems: [
          { label: 'Slaughter Records', path: '/slaughter/records' },
          { label: 'Product Outputs', path: '/slaughter/outputs' },
        ],
      },
      {
        label: 'Inventory',
        icon: Package,
        subItems: [
          { label: 'Stock Items', path: '/inventory/items' },
          { label: 'Movements', path: '/inventory/movements' },
        ],
      },
    ],
  },
  {
    title: 'Commerce',
    items: [
      {
        label: 'Sales & Customers',
        icon: ShoppingCart,
        subItems: [
          { label: 'Customers', path: '/sales/customers' },
          { label: 'Orders', path: '/sales/orders' },
          { label: 'Invoices', path: '/sales/invoices' },
          { label: 'Payments', path: '/sales/payments' },
        ],
      },
      {
        label: 'Finance',
        icon: DollarSign,
        subItems: [
          { label: 'Expenses', path: '/finance/expenses' },
          { label: 'Incomes', path: '/finance/incomes' },
          { label: 'Profit Reports', path: '/finance/profit' },
        ],
      },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { label: 'Reports & Analytics', icon: BarChart3, path: '/analytics', permission: 'reports:read' },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        label: 'Settings',
        icon: Settings,
        subItems: [
          { label: 'Users & Roles', path: '/settings/users' },
          { label: 'System Config', path: '/settings/config' },
        ],
      },
    ],
  },
]

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const location = useLocation()
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})

  const toggleMenu = (label: string) => {
    setExpandedMenus((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-neutral-900/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <motion.nav
        className={clsx(
          "sidebar overflow-y-auto no-scrollbar fixed top-0 bottom-0 left-0 z-50 w-64 bg-neutral-900 flex flex-col transition-transform duration-300 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5 flex-shrink-0">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center shadow-md">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-lg tracking-tight leading-none">PERP</div>
            <div className="text-neutral-500 text-2xs mt-0.5">Poultry ERP</div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 py-3 overflow-y-auto no-scrollbar">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="mb-4">
              <div className="px-5 text-2xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                {section.title}
              </div>
              {section.items.map((item) => {
                const isExpanded = expandedMenus[item.label]
                const isPathActive = item.path && location.pathname.startsWith(item.path)
                const hasActiveSubItem = item.subItems?.some((sub) => location.pathname.startsWith(sub.path))
                const isActive = isPathActive || hasActiveSubItem

                const Icon = item.icon

                if (item.subItems) {
                  return (
                    <div key={item.label}>
                      <button
                        onClick={() => toggleMenu(item.label)}
                        className={clsx(
                          'w-full flex items-center px-5 py-2.5 text-sm transition-colors hover:bg-white/5',
                          isActive ? 'text-white font-medium' : 'text-neutral-400'
                        )}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0 mr-3" />
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        <ChevronDown
                          className={clsx(
                            "w-4 h-4 transition-transform duration-200",
                            isExpanded || isActive ? "rotate-180" : ""
                          )}
                        />
                      </button>
                      {(isExpanded || isActive) && (
                        <div className="flex flex-col mt-1 mb-2 space-y-1">
                          {item.subItems.map((subItem) => {
                            const isSubActive = location.pathname.startsWith(subItem.path)
                            return (
                              <NavLink
                                key={subItem.path}
                                to={subItem.path}
                                onClick={() => { if (window.innerWidth < 1024) onClose() }}
                                className={clsx(
                                  'flex items-center pl-12 pr-5 py-2 text-sm transition-colors relative',
                                  isSubActive ? 'text-white font-medium' : 'text-neutral-400 hover:text-neutral-200'
                                )}
                              >
                                {isSubActive && (
                                  <div className="absolute left-6 w-1.5 h-1.5 rounded-full bg-brand-500" />
                                )}
                                <span className="truncate">{subItem.label}</span>
                              </NavLink>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                }

                return (
                  <NavLink key={item.path!} to={item.path!} onClick={() => { if (window.innerWidth < 1024) onClose() }}>
                    <div
                      className={clsx(
                        'flex items-center px-5 py-2.5 text-sm transition-colors hover:bg-white/5',
                        isActive ? 'text-white font-medium border-r-2 border-brand-500 bg-white/5' : 'text-neutral-400'
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0 mr-3" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
                    </div>
                  </NavLink>
                )
              })}
            </div>
          ))}
        </div>

      {/* Version */}
      <div className="px-5 py-4 border-t border-white/5 flex-shrink-0">
        <div className="text-neutral-600 text-2xs">v1.0.0 — Phase 1</div>
      </div>
    </motion.nav>
    </>
  )
}
