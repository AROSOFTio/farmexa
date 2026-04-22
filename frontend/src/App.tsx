import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthContext'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { AppLayout } from '@/layouts/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { UsersPage } from '@/features/settings/users/UsersPage'
import { NotFoundPage } from '@/components/NotFoundPage'
import { PlaceholderPage } from '@/components/PlaceholderPage'
import { HousesPage } from '@/features/farm/HousesPage'
import { BatchesPage } from '@/features/farm/BatchesPage'

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

          {/* Phase 2: Farm */}
          <Route path="farm">
            <Route index element={<Navigate to="/farm/houses" replace />} />
            <Route path="houses" element={<HousesPage />} />
            <Route path="batches" element={<BatchesPage />} />
            <Route path="mortality" element={<PlaceholderPage title="Mortality Tracking" />} />
            <Route path="vaccination" element={<PlaceholderPage title="Vaccination Log" />} />
            <Route path="growth" element={<PlaceholderPage title="Growth Tracking" />} />
          </Route>

          {/* Phase 2: Feed */}
          <Route path="feed">
            <Route index element={<Navigate to="/feed/stock" replace />} />
            <Route path="stock" element={<PlaceholderPage title="Feed Stock Inventory" />} />
            <Route path="purchases" element={<PlaceholderPage title="Feed Purchases" />} />
            <Route path="consumption" element={<PlaceholderPage title="Feed Consumption" />} />
            <Route path="suppliers" element={<PlaceholderPage title="Feed Suppliers" />} />
          </Route>
          {/* 404 inside shell */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Catch-all → login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
