import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthContext'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProfitDashboard } from '@/features/analytics/ProfitDashboard'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { FeedManagementPage } from '@/features/feed/FeedManagementPage'
import { ExpensesPage } from '@/features/finance/ExpensesPage'
import { IncomesPage } from '@/features/finance/IncomesPage'
import { BatchesPage } from '@/features/farm/BatchesPage'
import { FarmOperationsPage } from '@/features/farm/FarmOperationsPage'
import { HousesPage } from '@/features/farm/HousesPage'
import { InventoryPage } from '@/features/inventory/InventoryPage'
import { CustomersPage } from '@/features/sales/CustomersPage'
import { InvoicesPage } from '@/features/sales/InvoicesPage'
import { OrdersPage } from '@/features/sales/OrdersPage'
import { SettingsConfigPage } from '@/features/settings/SettingsConfigPage'
import { UsersPage } from '@/features/settings/users/UsersPage'
import { SlaughterPage } from '@/features/slaughter/SlaughterPage'
import { AppLayout } from '@/layouts/AppLayout'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { NotFoundPage } from '@/components/NotFoundPage'

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

          <Route
            path="dashboard"
            element={
              <ProtectedRoute permission="dashboard:read">
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route path="farm">
            <Route index element={<Navigate to="/farm/houses" replace />} />
            <Route
              path="houses"
              element={
                <ProtectedRoute permission="farm:read">
                  <HousesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="batches"
              element={
                <ProtectedRoute permission="farm:read">
                  <BatchesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="mortality"
              element={
                <ProtectedRoute permission="farm:read">
                  <FarmOperationsPage mode="mortality" />
                </ProtectedRoute>
              }
            />
            <Route
              path="vaccination"
              element={
                <ProtectedRoute permission="farm:read">
                  <FarmOperationsPage mode="vaccination" />
                </ProtectedRoute>
              }
            />
            <Route
              path="growth"
              element={
                <ProtectedRoute permission="farm:read">
                  <FarmOperationsPage mode="growth" />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="feed">
            <Route index element={<Navigate to="/feed/stock" replace />} />
            <Route
              path="stock"
              element={
                <ProtectedRoute permission="feed:read">
                  <FeedManagementPage section="stock" />
                </ProtectedRoute>
              }
            />
            <Route
              path="purchases"
              element={
                <ProtectedRoute permission="feed:read">
                  <FeedManagementPage section="purchases" />
                </ProtectedRoute>
              }
            />
            <Route
              path="consumption"
              element={
                <ProtectedRoute permission="feed:read">
                  <FeedManagementPage section="consumption" />
                </ProtectedRoute>
              }
            />
            <Route
              path="suppliers"
              element={
                <ProtectedRoute permission="feed:read">
                  <FeedManagementPage section="suppliers" />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="inventory">
            <Route index element={<Navigate to="/inventory/items" replace />} />
            <Route
              path="items"
              element={
                <ProtectedRoute permission="inventory:read">
                  <InventoryPage section="items" />
                </ProtectedRoute>
              }
            />
            <Route
              path="movements"
              element={
                <ProtectedRoute permission="inventory:read">
                  <InventoryPage section="movements" />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="slaughter">
            <Route index element={<Navigate to="/slaughter/records" replace />} />
            <Route
              path="records"
              element={
                <ProtectedRoute permission="slaughter:read">
                  <SlaughterPage section="records" />
                </ProtectedRoute>
              }
            />
            <Route
              path="outputs"
              element={
                <ProtectedRoute permission="slaughter:read">
                  <SlaughterPage section="outputs" />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="sales">
            <Route index element={<Navigate to="/sales/orders" replace />} />
            <Route
              path="customers"
              element={
                <ProtectedRoute permission="sales:read">
                  <CustomersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="orders"
              element={
                <ProtectedRoute permission="sales:read">
                  <OrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="invoices"
              element={
                <ProtectedRoute permission="sales:read">
                  <InvoicesPage section="invoices" />
                </ProtectedRoute>
              }
            />
            <Route
              path="payments"
              element={
                <ProtectedRoute permission="sales:read">
                  <InvoicesPage section="payments" />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="finance">
            <Route index element={<Navigate to="/finance/expenses" replace />} />
            <Route
              path="expenses"
              element={
                <ProtectedRoute permission="finance:read">
                  <ExpensesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="incomes"
              element={
                <ProtectedRoute permission="finance:read">
                  <IncomesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="profit"
              element={
                <ProtectedRoute permission="reports:read">
                  <Navigate to="/analytics" replace />
                </ProtectedRoute>
              }
            />
          </Route>

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
            <Route
              path="config"
              element={
                <ProtectedRoute permission="settings:read">
                  <SettingsConfigPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route
            path="analytics"
            element={
              <ProtectedRoute permission="reports:read">
                <ProfitDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
