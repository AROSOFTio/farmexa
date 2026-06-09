import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, PlayCircle, Lock } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'
import clsx from 'clsx'

interface FiscalYear {
  id: number
  year_name: string
  start_date: string
  end_date: string
  status: 'open' | 'closed'
  created_at: string
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function AccountingSettingsPage() {
  const queryClient = useQueryClient()

  const { data: fiscalYears = [], isLoading } = useQuery({
    queryKey: ['accounting-fiscal-years'],
    queryFn: () => api.get<FiscalYear[]>('/accounting/fiscal-years').then(res => res.data),
  })

  const initializeMutation = useMutation({
    mutationFn: () => api.post('/accounting/initialize'),
    onSuccess: () => {
      toast.success('Accounting initialized successfully with Enterprise Template')
      queryClient.invalidateQueries({ queryKey: ['accounting-fiscal-years'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-coa'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to initialize accounting')
    },
  })

  const closeYearMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/accounting/fiscal-years/${id}`, { status: 'closed' }),
    onSuccess: () => {
      toast.success('Fiscal year closed')
      queryClient.invalidateQueries({ queryKey: ['accounting-fiscal-years'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to close fiscal year')
    },
  })

  if (isLoading) {
    return <div className="p-6 text-ink-500">Loading settings...</div>
  }

  const hasFiscalYears = fiscalYears.length > 0

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Accounting Settings</h1>
          <p className="section-subtitle">Manage fiscal years and accounting initialization.</p>
        </div>
      </div>

      {!hasFiscalYears && (
        <div className="card p-8 text-center border-brand-200 bg-brand-50/30">
          <PlayCircle className="h-12 w-12 text-brand-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-ink-900 mb-2">Initialize Enterprise Accounting</h2>
          <p className="text-ink-600 max-w-md mx-auto mb-6">
            Your tenant workspace is not yet configured for Enterprise Accounting. 
            Click the button below to load the standard Poultry Enterprise Chart of Accounts and create your first Fiscal Year.
          </p>
          <button
            onClick={() => {
              if (window.confirm('This will load the default Enterprise Chart of Accounts. Continue?')) {
                initializeMutation.mutate()
              }
            }}
            disabled={initializeMutation.isPending}
            className="btn-primary mx-auto"
          >
            {initializeMutation.isPending ? 'Initializing...' : 'Initialize Accounting Now'}
          </button>
        </div>
      )}

      {hasFiscalYears && (
        <div className="card overflow-hidden">
          <div className="border-b border-ink-150 px-6 py-5">
            <h2 className="text-xl font-semibold text-ink-900">Fiscal Years</h2>
            <p className="mt-1 text-sm text-ink-500">Manage your financial periods.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-6">Year Name</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th className="pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fiscalYears.map((year) => (
                  <tr key={year.id}>
                    <td className="pl-6 font-semibold text-ink-900">{year.year_name}</td>
                    <td>{formatDate(year.start_date)}</td>
                    <td>{formatDate(year.end_date)}</td>
                    <td>
                      <span
                        className={clsx(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide',
                          year.status === 'open' ? 'bg-green-50 text-green-700' : 'bg-ink-100 text-ink-600'
                        )}
                      >
                        {year.status}
                      </span>
                    </td>
                    <td className="pr-6 text-right">
                      {year.status === 'open' && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to close ${year.year_name}? This cannot be undone easily.`)) {
                              closeYearMutation.mutate(year.id)
                            }
                          }}
                          className="text-ink-500 hover:text-ink-900 flex items-center justify-end gap-1 ml-auto text-sm"
                        >
                          <Lock className="h-4 w-4" /> Close Year
                        </button>
                      )}
                      {year.status === 'closed' && (
                        <span className="text-ink-400 text-sm flex items-center justify-end gap-1">
                          <CheckCircle2 className="h-4 w-4" /> Closed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
