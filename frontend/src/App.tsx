import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthContext'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { AppLayout } from '@/layouts/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { UsersPage } from '@/features/settings/users/UsersPage'
import { NotFoundPage } from '@/components/NotFoundPage'
import { HousesPage } from '@/features/farm/HousesPage'
import { BatchesPage } from '@/features/farm/BatchesPage'
import { OrdersPage } from '@/features/sales/OrdersPage'
import { ExpensesPage } from '@/features/finance/ExpensesPage'
import { ProfitDashboard } from '@/features/analytics/ProfitDashboard'
import { FarmOperationsPage } from '@/features/farm/FarmOperationsPage'
import { FeedManagementPage } from '@/features/feed/FeedManagementPage'
import { InventoryPage } from '@/features/inventory/InventoryPage'
import { CustomersPage } from '@/features/sales/CustomersPage'
import { IncomesPage } from '@/features/finance/IncomesPage'
import { SettingsConfigPage } from '@/features/settings/SettingsConfigPage'
import { InvoicesPage } from '@/features/sales/InvoicesPage'
import { SlaughterPage } from '@/features/slaughter/SlaughterPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

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

          <Route path="farm">
            <Route index element={<Navigate to="/farm/houses" replace />} />
            <Route path="houses" element={<HousesPage />} />
            <Route path="batches" element={<BatchesPage />} />
            <Route path="mortality" element={<FarmOperationsPage mode="mortality" />} />
            <Route path="vaccination" element={<FarmOperationsPage mode="vaccination" />} />
            <Route path="growth" element={<FarmOperationsPage mode="growth" />} />
          </Route>

          <Route path="feed">
            <Route index element={<Navigate to="/feed/stock" replace />} />
            <Route path="stock" element={<FeedManagementPage section="stock" />} />
            <Route path="purchases" element={<FeedManagementPage section="purchases" />} />
            <Route path="consumption" element={<FeedManagementPage section="consumption" />} />
            <Route path="suppliers" element={<FeedManagementPage section="suppliers" />} />
          </Route>

          <Route path="sales">
            <Route index element={<Navigate to="/sales/orders" replace />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="invoices" element={<InvoicesPage section="invoices" />} />
            <Route path="payments" element={<InvoicesPage section="payments" />} />
          </Route>

          <Route path="inventory">
            <Route index element={<Navigate to="/inventory/items" replace />} />
            <Route path="items" element={<InventoryPage section="items" />} />
            <Route path="movements" element={<InventoryPage section="movements" />} />
          </Route>

          <Route path="finance">
            <Route index element={<Navigate to="/finance/expenses" replace />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="incomes" element={<IncomesPage />} />
            <Route path="profit" element={<ProfitDashboard />} />
          </Route>

          <Route path="slaughter">
            <Route index element={<Navigate to="/slaughter/records" replace />} />
            <Route path="records" element={<SlaughterPage section="records" />} />
            <Route path="outputs" element={<SlaughterPage section="outputs" />} />
          </Route>

          <Route path="analytics" element={<ProfitDashboard />} />
          <Route path="settings/config" element={<SettingsConfigPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
