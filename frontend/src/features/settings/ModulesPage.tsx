import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ToggleLeft, ToggleRight, Lock } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'
import { useAuth } from '@/features/auth/AuthContext'
import { getErrorMessage } from '@/lib/errors'

interface TenantModuleSetting {
  module_key: string
  name: string
  category: string
  description?: string | null
  is_core: boolean
  is_enabled: boolean
  in_plan: boolean
}

export function ModulesPage() {
  const qc = useQueryClient()
  const { refetchMe, hasPermission } = useAuth()
  const canManage = hasPermission('settings:write')

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ['tenant-modules'],
    queryFn: () => api.get<TenantModuleSetting[]>('/settings/modules').then((r) => r.data),
  })

  const toggle = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      api.put(`/settings/modules/${key}`, { is_enabled: enabled }),
    onSuccess: async (_data, variables) => {
      toast.success(`Feature ${variables.enabled ? 'enabled' : 'disabled'}.`)
      await qc.invalidateQueries({ queryKey: ['tenant-modules'] })
      // Refresh the session so the sidebar/nav reflects the change immediately.
      await refetchMe()
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not update the feature.')),
  })

  const grouped = modules.reduce<Record<string, TenantModuleSetting[]>>((acc, mod) => {
    (acc[mod.category] ||= []).push(mod)
    return acc
  }, {})

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Modules &amp; Features</h1>
          <p className="section-subtitle">
            Turn features your farm doesn&apos;t use on or off. Disabled features are hidden across the app for everyone in your farm.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-ink-400">Loading features…</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="rounded-[12px] border border-neutral-150 bg-white p-4">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-400">{category}</h2>
              <div className="divide-y divide-neutral-100">
                {items.map((mod) => {
                  const locked = mod.is_core || !canManage
                  return (
                    <div key={mod.module_key} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink-700">{mod.name}</span>
                          {mod.is_core && (
                            <span className="badge badge-neutral inline-flex items-center gap-1 text-[10px]">
                              <Lock className="h-3 w-3" /> Core
                            </span>
                          )}
                          {!mod.in_plan && !mod.is_core && (
                            <span className="badge badge-brand text-[10px]">Add-on</span>
                          )}
                        </div>
                        {mod.description && <p className="mt-0.5 text-xs text-ink-400">{mod.description}</p>}
                      </div>
                      <button
                        type="button"
                        disabled={locked || toggle.isPending}
                        onClick={() => toggle.mutate({ key: mod.module_key, enabled: !mod.is_enabled })}
                        className="shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                        title={mod.is_core ? 'Core feature cannot be disabled' : mod.is_enabled ? 'Disable' : 'Enable'}
                      >
                        {mod.is_enabled ? (
                          <ToggleRight className="h-7 w-7 text-emerald-600" />
                        ) : (
                          <ToggleLeft className="h-7 w-7 text-ink-300" />
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {modules.length === 0 && <p className="text-ink-400">No configurable features for your plan.</p>}
        </div>
      )}
    </div>
  )
}
