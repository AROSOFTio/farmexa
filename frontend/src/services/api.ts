import axios, { AxiosError, AxiosInstance } from 'axios'
import { ApiError } from '@/types'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
})

// ── Auth token injection ──────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Token refresh on 401 ──────────────────────────────────────
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: string) => void
  reject: (reason?: unknown) => void
}> = []

function shouldBypassRefresh(url?: string) {
  if (!url) return false

  return ['/auth/login', '/auth/refresh', '/auth/register-vendor'].some((path) => url.includes(path))
}

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error)
    } else {
      promise.resolve(token!)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean }

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !shouldBypassRefresh(originalRequest.url)
    ) {
      const refreshToken = localStorage.getItem('refresh_token')

      if (!refreshToken) {
        clearAuthAndRedirect()
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest!.headers!.Authorization = `Bearer ${token}`
            return api(originalRequest!)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const response = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })
        const { access_token, refresh_token: newRefresh } = response.data
        localStorage.setItem('access_token', access_token)
        localStorage.setItem('refresh_token', newRefresh)
        api.defaults.headers.Authorization = `Bearer ${access_token}`
        processQueue(null, access_token)
        originalRequest!.headers!.Authorization = `Bearer ${access_token}`
        return api(originalRequest!)
      } catch (refreshError) {
        processQueue(refreshError, null)
        clearAuthAndRedirect()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

function clearAuthAndRedirect() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  if (window.location.pathname !== '/login') {
    window.location.replace('/login')
  }
}

export default api
