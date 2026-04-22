import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { User, LoginRequest } from '@/types'
import { authService } from '@/services/authService'

interface AuthState {
  user: User | null
  permissions: string[]
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  login: (payload: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (code: string) => boolean
  hasRole: (role: string) => boolean
  refetchMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [state, setState] = useState<AuthState>({
    user: null,
    permissions: [],
    isAuthenticated: false,
    isLoading: true,
  })

  const clearSession = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setState({ user: null, permissions: [], isAuthenticated: false, isLoading: false })
  }, [])

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      clearSession()
      return null
    }
    const { user, permissions } = await authService.getMe()
    setState({ user, permissions, isAuthenticated: true, isLoading: false })
    return { user, permissions }
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

  const refetchMe = useCallback(async () => {
    await loadMe()
  }, [loadMe])

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasPermission, hasRole, refetchMe }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
