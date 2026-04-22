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
} from 'lucide-react'
import { clsx } from 'clsx'

interface NavItem {
  label: string
  icon: React.ElementType
  path: string
  permission?: string
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
      { label: 'Farm Management', icon: Bird, path: '/farm', permission: 'farm:read' },
      { label: 'Feed Management', icon: Wheat, path: '/feed', permission: 'feed:read' },
      { label: 'Slaughter', icon: Scissors, path: '/slaughter', permission: 'slaughter:read' },
      { label: 'Inventory', icon: Package, path: '/inventory', permission: 'inventory:read' },
    ],
  },
  {
    title: 'Commerce',
    items: [
      { label: 'Sales & Customers', icon: ShoppingCart, path: '/sales', permission: 'sales:read' },
      { label: 'Finance', icon: DollarSign, path: '/finance', permission: 'finance:read' },
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
      { label: 'Settings', icon: Settings, path: '/settings', permission: 'settings:read' },
    ],
  },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <motion.nav
      className="sidebar overflow-y-auto no-scrollbar"
      initial={{ x: -240 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
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
          <div key={section.title}>
            <div className="sidebar-section">{section.title}</div>
            {section.items.map((item) => {
              const isActive = location.pathname.startsWith(item.path)
              const Icon = item.icon
              return (
                <NavLink key={item.path} to={item.path}>
                  <div
                    className={clsx(
                      'sidebar-item',
                      isActive && 'sidebar-item-active'
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {isActive && (
                      <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                    )}
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
  )
}
