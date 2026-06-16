import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { LoginRequest, TenantSession, User } from '@/types'
import { authService } from '@/services/authService'

interface AuthState {
  user: User | null
  tenant: TenantSession | null
  permissions: string[]
  enabledModules: string[]
  isAuthenticated: boolean
  isLoading: boolean
  activeBranch: { id: number; name: string; branch_code: string } | null
}

interface AuthContextValue extends AuthState {
  login: (payload: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (code: string) => boolean
  hasRole: (role: string) => boolean
  hasModuleAccess: (moduleKey: string) => boolean
  refetchMe: () => Promise<void>
  setActiveBranch: (branch: { id: number; name: string; branch_code: string } | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const PLATFORM_ADMIN_ROLES = new Set(['super_manager', 'developer_admin'])

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [state, setState] = useState<AuthState>({
    user: null,
    tenant: null,
    permissions: [],
    enabledModules: [],
    isAuthenticated: false,
    isLoading: true,
    activeBranch: null,
  })

  const clearSession = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('active_branch')
    setState({ user: null, tenant: null, permissions: [], enabledModules: [], isAuthenticated: false, isLoading: false, activeBranch: null })
  }, [])

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      clearSession()
      return null
    }
    const { user, permissions, enabled_modules, tenant } = await authService.getMe()
    
    // Try to load last active branch from localStorage if not platform admin
    let activeBranch = null
    const savedBranch = localStorage.getItem('active_branch')
    if (savedBranch) {
      try {
        activeBranch = JSON.parse(savedBranch)
      } catch (e) {
        // ignore
      }
    }
    
    setState({ user, tenant, permissions, enabledModules: enabled_modules, isAuthenticated: true, isLoading: false, activeBranch })
    return { user, permissions, enabledModules: enabled_modules, tenant }
  }, [clearSession])

  useEffect(() => {
    loadMe().catch(() => {
      clearSession()
    })
  }, [clearSession, loadMe])

  const login = useCallback(async (payload: LoginRequest) => {
    const tokens = await authService.login(payload)
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
    try {
      const session = await loadMe()
      if (!session) {
        throw new Error('Unable to load the authenticated session.')
      }
      if (PLATFORM_ADMIN_ROLES.has(session.user.role?.name ?? '')) {
        navigate('/dev-admin/dashboard', { replace: true })
        return
      }
      if (session.tenant?.is_profile_only || ['expired', 'cancelled', 'suspended'].includes(session.tenant?.subscription_status ?? '')) {
        navigate('/subscription/expired', { replace: true })
        return
      }
    } catch (error) {
      clearSession()
      throw error
    }
    navigate('/dashboard', { replace: true })
  }, [clearSession, loadMe, navigate])

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refresh_token')
    if (refreshToken) {
      try { await authService.logout(refreshToken) } catch { /* best-effort */ }
    }
    clearSession()
    navigate('/login', { replace: true })
  }, [clearSession, navigate])

  const hasPermission = useCallback(
    (code: string) => state.permissions.includes(code),
    [state.permissions]
  )

  const hasRole = useCallback(
    (role: string) => state.user?.role?.name === role,
    [state.user]
  )

  const hasModuleAccess = useCallback(
    (moduleKey: string) => {
      const roleName = state.user?.role?.name
      if (PLATFORM_ADMIN_ROLES.has(roleName ?? '')) return true
      if (!state.tenant) return true
      if (state.tenant.is_suspended) return false
      if (state.tenant.is_profile_only || (state.tenant.subscription_status && ['expired', 'cancelled', 'suspended'].includes(state.tenant.subscription_status))) {
        return ['dashboard', 'farm_profile', 'settings'].includes(moduleKey)
      }
      return state.enabledModules.includes(moduleKey)
    },
    [state.enabledModules, state.tenant, state.user]
  )

  const refetchMe = useCallback(async () => {
    await loadMe()
  }, [loadMe])

  const setBranch = useCallback((branch: { id: number; name: string; code: string } | null) => {
    if (branch) {
      localStorage.setItem('active_branch', JSON.stringify(branch))
    } else {
      localStorage.removeItem('active_branch')
    }
    setState(prev => ({ ...prev, activeBranch: branch }))
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasPermission, hasRole, hasModuleAccess, refetchMe, setActiveBranch: setBranch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
