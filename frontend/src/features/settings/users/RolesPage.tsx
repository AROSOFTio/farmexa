import { useQuery } from '@tanstack/react-query'
import { Shield, ShieldCheck } from 'lucide-react'
import { usersService } from '@/services/usersService'
import { ROLE_LABELS } from '@/lib/branding'

export function RolesPage() {
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: usersService.getRoles,
  })

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Users & Roles</h1>
          <p className="section-subtitle">Live role catalog and permission coverage from the backend.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">System Roles</h2>
              <p className="text-sm text-[var(--text-muted)]">Roles seeded in the current environment.</p>
            </div>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />
              ))
            ) : (
              roles.map((role) => (
                <div key={role.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                  <div className="font-semibold text-[var(--text-strong)]">{ROLE_LABELS[role.name] ?? role.name}</div>
                  <div className="mt-1 text-sm text-[var(--text-muted)]">{role.description ?? 'No description provided.'}</div>
                  <div className="mt-3 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
                    {role.permissions.length} permissions
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-info/10 p-3 text-info">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Permission Matrix</h2>
              <p className="text-sm text-[var(--text-muted)]">Current permission grants per role.</p>
            </div>
          </div>

          <div className="space-y-4">
            {roles.map((role) => (
              <div key={role.id} className="rounded-2xl border border-[var(--border-subtle)] p-4">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {ROLE_LABELS[role.name] ?? role.name}
                </div>
                <div className="flex flex-wrap gap-2">
                  {role.permissions.length ? (
                    role.permissions.map((permission) => (
                      <span key={permission.code} className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-medium text-[var(--text-strong)]">
                        {permission.code}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-[var(--text-muted)]">No permissions assigned.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
