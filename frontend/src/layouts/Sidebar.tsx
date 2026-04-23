import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <motion.nav
        className={clsx(
          "sidebar overflow-y-auto no-scrollbar fixed top-0 bottom-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Decorative radial glow */}
        <div
          className="absolute top-0 left-0 w-full h-48 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 30% 0%, rgba(59,130,246,0.1) 0%, transparent 70%)',
          }}
        />

        {/* Logo */}
        <div
          className="flex items-center gap-3 px-5 py-5 flex-shrink-0 relative z-10"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }}
          >
            <Leaf className="w-[18px] h-[18px] text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-lg tracking-tight leading-none">PERP</div>
            <div className="text-xs mt-0.5 font-medium text-slate-400">
              Poultry ERP
            </div>
          </div>
          {/* Live indicator */}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">Live</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 py-4 overflow-y-auto no-scrollbar relative z-10">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="mb-5">
              <div
                className="px-5 mb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-slate-500"
              >
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
                        className="w-full flex items-center px-3 py-2.5 text-base transition-all duration-150"
                        style={{
                          color: isActive ? '#ffffff' : '#94a3b8',
                          fontWeight: isActive ? 700 : 500,
                        }}
                      >
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center mr-3 flex-shrink-0 transition-all duration-150"
                          style={{
                            background: isActive
                              ? 'rgba(59,130,246,0.15)'
                              : 'rgba(255,255,255,0.05)',
                          }}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        <ChevronDown
                          className={clsx(
                            "w-4 h-4 transition-transform duration-200 flex-shrink-0 text-slate-500",
                            isExpanded || isActive ? "rotate-180" : ""
                          )}
                        />
                      </button>

                      <AnimatePresence>
                        {(isExpanded || isActive) && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="flex flex-col mb-1 ml-11 mr-3 space-y-0.5">
                              {item.subItems.map((subItem) => {
                                const isSubActive = location.pathname.startsWith(subItem.path)
                                return (
                                  <NavLink
                                    key={subItem.path}
                                    to={subItem.path}
                                    onClick={() => { if (window.innerWidth < 1024) onClose() }}
                                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg transition-all duration-150 relative"
                                    style={{
                                      color: isSubActive ? '#ffffff' : '#94a3b8',
                                      background: isSubActive ? 'rgba(59,130,246,0.15)' : 'transparent',
                                      fontWeight: isSubActive ? 600 : 500,
                                    }}
                                  >
                                    {isSubActive && (
                                      <span
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-blue-500"
                                      />
                                    )}
                                    <span className="truncate pl-1">{subItem.label}</span>
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
                    key={item.path!}
                    to={item.path!}
                    onClick={() => { if (window.innerWidth < 1024) onClose() }}
                    className="block"
                  >
                    <div
                      className="flex items-center px-3 py-2.5 text-base transition-all duration-150"
                      style={{
                        color: isActive ? '#ffffff' : '#94a3b8',
                        fontWeight: isActive ? 700 : 500,
                      }}
                    >
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center mr-3 flex-shrink-0 transition-all duration-150"
                        style={{
                          background: isActive
                            ? 'rgba(59,130,246,0.15)'
                            : 'rgba(255,255,255,0.05)',
                        }}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {isActive && (
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-blue-500"
                        />
                      )}
                    </div>
                  </NavLink>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 flex-shrink-0 relative z-10"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="text-xs font-bold text-slate-600">
            v1.0.0 - Operations Suite
          </div>
        </div>
      </motion.nav>
    </>
  )
}
