// ── API Types ─────────────────────────────────────────────────

export interface Permission {
  code: string
  module: string
  description: string | null
}

export interface Role {
  id: number
  name: string
  description: string | null
  permissions: Permission[]
}

export interface User {
  id: number
  email: string
  full_name: string
  phone: string | null
  job_title: string | null
  avatar_url: string | null
  is_active: boolean
  role: Role | null
  created_at: string
  updated_at: string
}

export interface TenantSession {
  id: number
  name: string
  slug: string
  plan: string
  subscription_status: string | null
  primary_domain: string | null
  is_suspended: boolean
  subscription_expiry: string | null
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface MeResponse {
  user: User
  permissions: string[]
  enabled_modules: string[]
  tenant: TenantSession | null
}

// ── Request Types ─────────────────────────────────────────────

export interface LoginRequest {
  email: string
  password: string
}

export interface UserCreateRequest {
  email: string
  full_name: string
  password: string
  phone?: string
  job_title?: string
  role_id: number
  tenant_id?: number | null
}

export interface UserUpdateRequest {
  full_name?: string
  phone?: string
  job_title?: string
  role_id?: number
  is_active?: boolean
  tenant_id?: number | null
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

// ── List Response ─────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export type UserListResponse = PaginatedResponse<User>

// ── Dashboard ─────────────────────────────────────────────────

export interface DashboardSummary {
  users: { total: number; active: number }
  farm: { active_batches: number; total_birds: number; mortality_today: number }
  feed: { stock_items: number; low_stock_alerts: number }
  slaughter: { records_this_month: number; yield_avg_pct: number | null }
  sales: { invoices_outstanding: number; revenue_this_month: number }
  finance: {
    expenses_this_month: number
    income_this_month: number
    net_profit_this_month: number
  }
}

// ── API Error ─────────────────────────────────────────────────

export interface ApiError {
  detail: string
  errors?: { field: string; message: string }[]
}
