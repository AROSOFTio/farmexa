import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthContext'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { AppLayout } from '@/layouts/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { UsersPage } from '@/features/settings/users/UsersPage'
import { NotFoundPage } from '@/components/NotFoundPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Shell */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />

          {/* Settings */}
          <Route path="settings">
            <Route index element={<Navigate to="/settings/users" replace />} />
            <Route
              path="users"
              element={
                <ProtectedRoute permission="users:read">
                  <UsersPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Phase 2+ routes added here */}

          {/* 404 inside shell */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Catch-all → login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
