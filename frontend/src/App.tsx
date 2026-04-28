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
import { RolesPage } from '@/features/settings/users/RolesPage'
import { SlaughterPage } from '@/features/slaughter/SlaughterPage'
import { AppLayout } from '@/layouts/AppLayout'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { NotFoundPage } from '@/components/NotFoundPage'
import { EggProductionPage } from '@/features/farm/EggProductionPage'
import { TenantsPage } from '@/features/developer_admin/TenantsPage'
import { ModuleGuard, ModuleDisabledPage } from '@/components/ModuleGuard'

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
                <ModuleGuard moduleKey="dashboard">
                  <DashboardPage />
                </ModuleGuard>
              </ProtectedRoute>
            }
          />

          <Route path="farm">
            <Route index element={<Navigate to="/farm/houses" replace />} />
            <Route
              path="houses"
              element={
                <ProtectedRoute permission="farm:read">
                  <ModuleGuard moduleKey="houses">
                    <HousesPage />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="batches"
              element={
                <ProtectedRoute permission="farm:read">
                  <ModuleGuard moduleKey="batches">
                    <BatchesPage />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="mortality"
              element={
                <ProtectedRoute permission="farm:read">
                  <ModuleGuard moduleKey="mortality">
                    <FarmOperationsPage mode="mortality" />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="vaccination"
              element={
                <ProtectedRoute permission="farm:read">
                  <ModuleGuard moduleKey="vaccination">
                    <FarmOperationsPage mode="vaccination" />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="growth"
              element={
                <ProtectedRoute permission="farm:read">
                  <ModuleGuard moduleKey="growth_tracking">
                    <FarmOperationsPage mode="growth" />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="eggs"
              element={
                <ProtectedRoute permission="farm:read">
                  <ModuleGuard moduleKey="egg_production">
                    <EggProductionPage />
                  </ModuleGuard>
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
                  <ModuleGuard moduleKey="feed_stock">
                    <FeedManagementPage section="stock" />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="purchases"
              element={
                <ProtectedRoute permission="feed:read">
                  <ModuleGuard moduleKey="feed_purchases">
                    <FeedManagementPage section="purchases" />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="consumption"
              element={
                <ProtectedRoute permission="feed:read">
                  <ModuleGuard moduleKey="feed_consumption">
                    <FeedManagementPage section="consumption" />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="suppliers"
              element={
                <ProtectedRoute permission="feed:read">
                  <ModuleGuard moduleKey="feed_suppliers">
                    <FeedManagementPage section="suppliers" />
                  </ModuleGuard>
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
                  <ModuleGuard moduleKey="inventory_items">
                    <InventoryPage section="items" />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="movements"
              element={
                <ProtectedRoute permission="inventory:read">
                  <ModuleGuard moduleKey="inventory_movements">
                    <InventoryPage section="movements" />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="medicine"
              element={
                <ProtectedRoute permission="inventory:read">
                  <ModuleGuard moduleKey="medicine_supplies">
                    <InventoryPage section="items" /> {/* using items page for now */}
                  </ModuleGuard>
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
                  <ModuleGuard moduleKey="slaughter_records">
                    <SlaughterPage section="records" />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="outputs"
              element={
                <ProtectedRoute permission="slaughter:read">
                  <ModuleGuard moduleKey="slaughter_outputs">
                    <SlaughterPage section="outputs" />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="yield"
              element={
                <ProtectedRoute permission="slaughter:read">
                  <ModuleGuard moduleKey="slaughter_records">
                    <SlaughterPage section="records" /> {/* mapped to records */}
                  </ModuleGuard>
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
                  <ModuleGuard moduleKey="customers">
                    <CustomersPage />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="orders"
              element={
                <ProtectedRoute permission="sales:read">
                  <ModuleGuard moduleKey="sales_orders">
                    <OrdersPage />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="invoices"
              element={
                <ProtectedRoute permission="sales:read">
                  <ModuleGuard moduleKey="invoices">
                    <InvoicesPage section="invoices" />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="payments"
              element={
                <ProtectedRoute permission="sales:read">
                  <ModuleGuard moduleKey="payments">
                    <InvoicesPage section="payments" />
                  </ModuleGuard>
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
                  <ModuleGuard moduleKey="expenses">
                    <ExpensesPage />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="incomes"
              element={
                <ProtectedRoute permission="finance:read">
                  <ModuleGuard moduleKey="income">
                    <IncomesPage />
                  </ModuleGuard>
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
                  <ModuleGuard moduleKey="users">
                    <UsersPage />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="roles"
              element={
                <ProtectedRoute permission="settings:read">
                  <ModuleGuard moduleKey="settings">
                    <RolesPage />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="config"
              element={
                <ProtectedRoute permission="settings:read">
                  <ModuleGuard moduleKey="settings">
                    <SettingsConfigPage />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="reports">
            <Route index element={<Navigate to="/analytics" replace />} />
            <Route path="*" element={
              <ProtectedRoute permission="reports:read">
                <ModuleGuard moduleKey="reports">
                  <ProfitDashboard />
                </ModuleGuard>
              </ProtectedRoute>
            } />
          </Route>
          
          <Route path="dev-admin">
            <Route index element={<Navigate to="/dev-admin/tenants" replace />} />
            <Route
              path="tenants"
              element={
                <ProtectedRoute permission="dev_admin:read">
                  <TenantsPage section="tenants" />
                </ProtectedRoute>
              }
            />
            <Route
              path="domains"
              element={
                <ProtectedRoute permission="dev_admin:read">
                  <TenantsPage section="domains" />
                </ProtectedRoute>
              }
            />
            <Route
              path="plans"
              element={
                <ProtectedRoute permission="dev_admin:read">
                  <TenantsPage section="plans" />
                </ProtectedRoute>
              }
            />
            <Route
              path="modules"
              element={
                <ProtectedRoute permission="dev_admin:read">
                  <TenantsPage section="modules" />
                </ProtectedRoute>
              }
            />
            <Route
              path="billing"
              element={
                <ProtectedRoute permission="dev_admin:read">
                  <TenantsPage section="billing" />
                </ProtectedRoute>
              }
            />
            <Route
              path="control"
              element={
                <ProtectedRoute permission="dev_admin:read">
                  <TenantsPage section="control" />
                </ProtectedRoute>
              }
            />
            <Route
              path="*"
              element={
                <ProtectedRoute permission="dev_admin:read">
                  <TenantsPage section="tenants" />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route
            path="analytics"
            element={
              <ProtectedRoute permission="reports:read">
                <ModuleGuard moduleKey="reports">
                  <ProfitDashboard />
                </ModuleGuard>
              </ProtectedRoute>
            }
          />

          <Route path="module-disabled" element={<ModuleDisabledPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
