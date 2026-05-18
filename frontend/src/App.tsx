import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider } from '@/features/auth/AuthContext'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterModalPage } from '@/features/auth/RegisterModalPage'
import { RegistrationSuccessPage } from '@/features/auth/RegistrationSuccessPage'
import { ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from '@/features/auth/AuthActionPages'
import { PublicHomePage } from '@/features/public/PublicHomePage'
import { PricingPage } from '@/features/public/PricingPage'
import { AffiliateProgramPage } from '@/features/public/AffiliateProgramPage'
import { ReportCenterPage } from '@/features/reports/ReportCenterPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { FeedManagementPage } from '@/features/feed/FeedManagementPage'
import { FeedMillProductionPage } from '@/features/feed/FeedMillProductionPage'
import { ExpensesPage } from '@/features/finance/ExpensesPage'
import { IncomesPage } from '@/features/finance/IncomesPage'
import { BatchesPage } from '@/features/farm/BatchesPage'
import { FarmProfilePage } from '@/features/farm/FarmProfilePage'
import { FarmOperationsPage } from '@/features/farm/FarmOperationsPage'
import { HousesPage } from '@/features/farm/HousesPage'
import { InventoryPage } from '@/features/inventory/InventoryPage'
import { InventoryTransfersPage } from '@/features/inventory/InventoryTransfersPage'
import { CustomersPage } from '@/features/sales/CustomersPage'
import { InvoicesPage } from '@/features/sales/InvoicesPage'
import { OrdersPage } from '@/features/sales/OrdersPage'
import { PosPage } from '@/features/sales/PosPage'
import { SettingsConfigPage } from '@/features/settings/SettingsConfigPage'
import { UsersPage } from '@/features/settings/users/UsersPage'
import { RolesPage } from '@/features/settings/users/RolesPage'
import { SlaughterPage } from '@/features/slaughter/SlaughterPage'
import { AppLayout } from '@/layouts/AppLayout'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { NotFoundPage } from '@/components/NotFoundPage'
import { WorkspaceNotFoundPage } from '@/components/WorkspaceNotFoundPage'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'
import { EggProductionPage } from '@/features/farm/EggProductionPage'
import { TenantsPage } from '@/features/developer_admin/TenantsPage'
import { AffiliatesPage } from '@/features/developer_admin/AffiliatesPage'
import { ModuleGuard, ModuleDisabledPage } from '@/components/ModuleGuard'
import { SEO } from '@/components/SEO'
import { CompliancePage } from '@/features/compliance/CompliancePage'
import { UpgradeModulesPage } from '@/features/subscriptions/UpgradeModulesPage'
import { SubscriptionExpiredPage } from '@/features/subscriptions/SubscriptionExpiredPage'
import { BillingPage, SubscriptionPage, SupportPage } from '@/features/subscriptions/AccountPages'

export default function App() {
  return (
    <HostValidationGate>
      <AuthProvider>
      <Routes>
        <Route path="/login" element={<><SEO title="Sign in to Farmexa" description="Sign in to your Farmexa workspace." canonicalPath="/login" robots="noindex,nofollow" /><LoginPage /></>} />
        <Route path="/" element={<PublicHomePage />} />
        <Route path="/register" element={<><SEO title="Register Farmexa" description="Create a Farmexa trial workspace." canonicalPath="/register" robots="noindex,nofollow" /><RegisterModalPage /></>} />
        <Route path="/register-tenant" element={<><SEO title="Register Farmexa Tenant" description="Create a Farmexa trial workspace." canonicalPath="/register-tenant" robots="noindex,nofollow" /><RegisterModalPage /></>} />
        <Route path="/register-vendor" element={<><SEO title="Register Farmexa Tenant" description="Create a Farmexa trial workspace." canonicalPath="/register-vendor" robots="noindex,nofollow" /><RegisterModalPage /></>} />
        <Route path="/registration-success" element={<><SEO title="Farmexa Registration Success" description="Farmexa registration confirmation." canonicalPath="/registration-success" robots="noindex,nofollow" /><RegistrationSuccessPage /></>} />
        <Route path="/forgot-password" element={<><SEO title="Forgot Farmexa Password" description="Request a Farmexa password reset." canonicalPath="/forgot-password" robots="noindex,nofollow" /><ForgotPasswordPage /></>} />
        <Route path="/reset-password" element={<><SEO title="Reset Farmexa Password" description="Reset your Farmexa password." canonicalPath="/reset-password" robots="noindex,nofollow" /><ResetPasswordPage /></>} />
        <Route path="/verify-email" element={<><SEO title="Verify Farmexa Email" description="Verify your Farmexa account email." canonicalPath="/verify-email" robots="noindex,nofollow" /><VerifyEmailPage /></>} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/affiliates" element={<AffiliateProgramPage />} />
        <Route path="/affiliate-program" element={<AffiliateProgramPage />} />
        <Route path="/features" element={<PublicHomePage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
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
            <Route path="profile" element={<ProtectedRoute><ModuleGuard moduleKey="farm_profile"><FarmProfilePage /></ModuleGuard></ProtectedRoute>} />
            <Route path="staff" element={<ProtectedRoute permission="users:read"><ModuleGuard moduleKey="users"><UsersPage /></ModuleGuard></ProtectedRoute>} />
            <Route path="suppliers" element={<ProtectedRoute permission="feed:read"><ModuleGuard moduleKey="feed_suppliers"><FeedManagementPage section="suppliers" /></ModuleGuard></ProtectedRoute>} />
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
            <Route path="medication" element={<ProtectedRoute permission="inventory:read"><ModuleGuard moduleKey="medicine_supplies"><InventoryPage section="medicine" /></ModuleGuard></ProtectedRoute>} />
            <Route path="feed-usage" element={<ProtectedRoute permission="feed:read"><ModuleGuard moduleKey="feed_consumption"><FeedManagementPage section="consumption" /></ModuleGuard></ProtectedRoute>} />
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
                    <InventoryPage section="medicine" />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="slaughter">
            <Route index element={<Navigate to="/slaughter/records" replace />} />
            <Route
              path="planning"
              element={
                <ProtectedRoute permission="slaughter:read">
                  <ModuleGuard moduleKey="slaughter_planning">
                    <SlaughterPage section="planning" />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
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
              path="cuts"
              element={
                <ProtectedRoute permission="slaughter:read">
                  <ModuleGuard moduleKey="slaughter_cut_parts">
                    <SlaughterPage section="cuts" />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route path="meat-cuts" element={<ProtectedRoute permission="slaughter:read"><ModuleGuard moduleKey="slaughter_cut_parts"><SlaughterPage section="cuts" /></ModuleGuard></ProtectedRoute>} />
            <Route
              path="byproducts"
              element={
                <ProtectedRoute permission="slaughter:read">
                  <ModuleGuard moduleKey="slaughter_byproducts">
                    <SlaughterPage section="byproducts" />
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
                  <ModuleGuard moduleKey="yield_analysis">
                    <SlaughterPage section="yield" />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route path="blast-room" element={<ProtectedRoute permission="inventory:read"><ModuleGuard moduleKey="inventory_items"><InventoryPage section="items" /></ModuleGuard></ProtectedRoute>} />
            <Route path="cold-room" element={<ProtectedRoute permission="inventory:read"><ModuleGuard moduleKey="inventory_items"><InventoryPage section="items" /></ModuleGuard></ProtectedRoute>} />
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

          <Route path="compliance">
            <Route index element={<Navigate to="/compliance/documents" replace />} />
            <Route
              path="documents"
              element={
                <ProtectedRoute permission="farm:read">
                  <ModuleGuard moduleKey="compliance_documents">
                    <CompliancePage section="documents" />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="alerts"
              element={
                <ProtectedRoute permission="farm:read">
                  <ModuleGuard moduleKey="compliance_alerts">
                    <CompliancePage section="alerts" />
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
            <Route index element={<ProtectedRoute permission="reports:read"><ModuleGuard moduleKey="reports"><ReportCenterPage /></ModuleGuard></ProtectedRoute>} />
            <Route path=":reportKey" element={
              <ProtectedRoute permission="reports:read">
                <ModuleGuard moduleKey="reports">
                  <ReportCenterPage />
                </ModuleGuard>
              </ProtectedRoute>
            } />
          </Route>

          <Route path="feed-mill">
            <Route path="raw-materials" element={<ProtectedRoute permission="feed:read"><ModuleGuard moduleKey="feed_stock"><FeedManagementPage section="stock" /></ModuleGuard></ProtectedRoute>} />
            <Route path="formulations" element={<ProtectedRoute permission="feed:read"><ModuleGuard moduleKey="feed_stock"><FeedMillProductionPage section="formulations" /></ModuleGuard></ProtectedRoute>} />
            <Route path="production" element={<ProtectedRoute permission="feed:write"><ModuleGuard moduleKey="feed_purchases"><FeedMillProductionPage section="production" /></ModuleGuard></ProtectedRoute>} />
            <Route path="stock" element={<ProtectedRoute permission="feed:read"><ModuleGuard moduleKey="feed_stock"><FeedManagementPage section="stock" /></ModuleGuard></ProtectedRoute>} />
            <Route path="transfers" element={<ProtectedRoute permission="inventory:read"><ModuleGuard moduleKey="inventory_movements"><InventoryTransfersPage view="transfers" /></ModuleGuard></ProtectedRoute>} />
          </Route>

          <Route path="inventory">
            <Route path="transfers" element={<ProtectedRoute permission="inventory:read"><ModuleGuard moduleKey="inventory_movements"><InventoryTransfersPage view="transfers" /></ModuleGuard></ProtectedRoute>} />
            <Route path="grn" element={<ProtectedRoute permission="inventory:read"><ModuleGuard moduleKey="inventory_movements"><InventoryTransfersPage view="grn" /></ModuleGuard></ProtectedRoute>} />
            <Route path="giv" element={<ProtectedRoute permission="inventory:read"><ModuleGuard moduleKey="inventory_movements"><InventoryTransfersPage view="giv" /></ModuleGuard></ProtectedRoute>} />
            <Route path="low-stock" element={<ProtectedRoute permission="inventory:read"><ModuleGuard moduleKey="inventory_items"><InventoryTransfersPage view="low-stock" /></ModuleGuard></ProtectedRoute>} />
          </Route>

          <Route path="sales">
            <Route path="pos" element={<ProtectedRoute permission="sales:write"><ModuleGuard moduleKey="sales_orders"><PosPage /></ModuleGuard></ProtectedRoute>} />
            <Route path="receipts" element={<ProtectedRoute permission="sales:read"><ModuleGuard moduleKey="payments"><InvoicesPage section="payments" /></ModuleGuard></ProtectedRoute>} />
            <Route path="store-stock" element={<ProtectedRoute permission="inventory:read"><ModuleGuard moduleKey="inventory_items"><InventoryPage section="items" /></ModuleGuard></ProtectedRoute>} />
          </Route>

          <Route path="finance">
            <Route path="income" element={<ProtectedRoute permission="finance:read"><ModuleGuard moduleKey="income"><IncomesPage /></ModuleGuard></ProtectedRoute>} />
            <Route path="profit-loss" element={<Navigate to="/reports/profit-loss" replace />} />
            <Route path="cash-flow" element={<Navigate to="/reports/profit-loss" replace />} />
          </Route>

          <Route path="compliance">
            <Route path="quality-control" element={<ProtectedRoute permission="farm:read"><ModuleGuard moduleKey="compliance_documents"><CompliancePage section="documents" /></ModuleGuard></ProtectedRoute>} />
          </Route>

          <Route path="settings">
            <Route path="profile" element={<ProtectedRoute><ModuleGuard moduleKey="farm_profile"><FarmProfilePage /></ModuleGuard></ProtectedRoute>} />
            <Route path="subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
            <Route path="company" element={<ProtectedRoute permission="settings:read"><ModuleGuard moduleKey="settings"><SettingsConfigPage /></ModuleGuard></ProtectedRoute>} />
          </Route>

          <Route path="subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
          <Route path="subscription/upgrade" element={<ProtectedRoute><UpgradeModulesPage /></ProtectedRoute>} />
          <Route path="subscription/expired" element={<ProtectedRoute><SubscriptionExpiredPage /></ProtectedRoute>} />
          <Route path="billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
          <Route path="support" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />
          
          <Route path="dev-admin">
            <Route
              path="dashboard"
              element={
                <ProtectedRoute permission="dev_admin:read">
                  <TenantsPage section="dashboard" />
                </ProtectedRoute>
              }
            />
            <Route
              index
              element={
                <ProtectedRoute permission="dev_admin:read">
                  <TenantsPage section="dashboard" />
                </ProtectedRoute>
              }
            />
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
            <Route path="trials" element={<ProtectedRoute permission="dev_admin:read"><TenantsPage section="dashboard" /></ProtectedRoute>} />
            <Route path="modules" element={<ProtectedRoute permission="dev_admin:read"><TenantsPage section="plans" /></ProtectedRoute>} />
            <Route path="emails" element={<ProtectedRoute permission="dev_admin:read"><TenantsPage section="activity" /></ProtectedRoute>} />
            <Route path="billing" element={<ProtectedRoute permission="dev_admin:read"><TenantsPage section="settings" /></ProtectedRoute>} />
            <Route path="affiliates" element={<ProtectedRoute permission="dev_admin:read"><AffiliatesPage /></ProtectedRoute>} />
            <Route path="system-health" element={<ProtectedRoute permission="dev_admin:read"><TenantsPage section="settings" /></ProtectedRoute>} />
            <Route path="audit-logs" element={<ProtectedRoute permission="dev_admin:read"><TenantsPage section="activity" /></ProtectedRoute>} />
            <Route
              path="plans"
              element={
                <ProtectedRoute permission="dev_admin:read">
                  <TenantsPage section="plans" />
                </ProtectedRoute>
              }
            />
            <Route
              path="activity"
              element={
                <ProtectedRoute permission="dev_admin:read">
                  <TenantsPage section="activity" />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute permission="dev_admin:read">
                  <TenantsPage section="settings" />
                </ProtectedRoute>
              }
            />
            <Route
              path="*"
              element={
                <ProtectedRoute permission="dev_admin:read">
                  <TenantsPage section="dashboard" />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route
            path="analytics"
            element={
              <ProtectedRoute permission="reports:read">
                <ModuleGuard moduleKey="reports">
                  <ReportCenterPage />
                </ModuleGuard>
              </ProtectedRoute>
            }
          />

          <Route path="module-disabled" element={<ModuleDisabledPage />} />
          <Route
            path="upgrade/modules"
            element={
              <ProtectedRoute>
                <UpgradeModulesPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </AuthProvider>
    </HostValidationGate>
  )
}

function HostValidationGate({ children }: { children: ReactNode }) {
  const { isLoading, isWorkspaceUnknown } = usePlatformSettings()

  if (isWorkspaceUnknown) {
    return <WorkspaceNotFoundPage />
  }

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--app-bg)]" />
  }

  return <>{children}</>
}
