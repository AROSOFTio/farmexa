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

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setState((s) => ({ ...s, isLoading: false }))
      return
    }
    try {
      const { user, permissions } = await authService.getMe()
      setState({ user, permissions, isAuthenticated: true, isLoading: false })
    } catch {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      setState({ user: null, permissions: [], isAuthenticated: false, isLoading: false })
    }
  }, [])

  useEffect(() => {
    loadMe()
  }, [loadMe])

  const login = useCallback(async (payload: LoginRequest) => {
    const tokens = await authService.login(payload)
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
    await loadMe()
    navigate('/dashboard', { replace: true })
  }, [loadMe, navigate])

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refresh_token')
    if (refreshToken) {
      try { await authService.logout(refreshToken) } catch { /* best-effort */ }
    }
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setState({ user: null, permissions: [], isAuthenticated: false, isLoading: false })
    navigate('/login', { replace: true })
  }, [navigate])

  const hasPermission = useCallback(
    (code: string) => state.permissions.includes(code),
    [state.permissions]
  )

  const hasRole = useCallback(
    (role: string) => state.user?.role?.name === role,
    [state.user]
  )

  const refetchMe = loadMe

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
