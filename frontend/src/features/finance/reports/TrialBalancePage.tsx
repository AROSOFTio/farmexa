import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { financeReportsService } from '@/services/financeReportsService'
import { FileText, Loader2, RefreshCcw } from 'lucide-react'

export function TrialBalancePage() {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10))
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['trial-balance', asOfDate],
    queryFn: () => financeReportsService.getTrialBalance({ as_of_date: asOfDate }),
  })

  return (
    <div className="animate-fade-in space-y-5 pb-10">
      <div className="section-header">
        <div>
          <h1 className="section-title">Trial Balance</h1>
          <p className="section-subtitle">Summary of all account balances to verify debits equal credits.</p>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="form-label">As of Date</label>
            <input type="date" className="form-input" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} />
          </div>
          <button type="button" className="btn-secondary" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCcw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-10 flex justify-center items-center text-ink-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading trial balance...
          </div>
        ) : data ? (
          <div>
            <div className="grid grid-cols-2 gap-4 p-5 bg-slate-50 dark:bg-slate-800/50 border-b border-[var(--border-subtle)]">
              <div className="p-4 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                <p className="text-sm text-ink-500 font-medium">Total Debits</p>
                <p className="text-xl font-semibold text-ink-900 mt-1">{data.total_debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="p-4 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                <p className="text-sm text-ink-500 font-medium">Total Credits</p>
                <p className="text-xl font-semibold text-ink-900 mt-1">{data.total_credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            
            {!data.is_balanced && (
              <div className="p-4 bg-red-50 text-red-700 border-b border-red-200">
                <strong>Warning:</strong> Trial balance is not balanced! Difference: {Math.abs(data.total_debit - data.total_credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Account Code</th>
                    <th>Account Name</th>
                    <th>Type</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map(row => (
                    <tr key={row.account_code}>
                      <td className="font-mono text-sm text-ink-600">{row.account_code}</td>
                      <td className="font-medium text-ink-900">{row.account_name}</td>
                      <td className="capitalize text-ink-500">{row.account_type.replace('_', ' ')}</td>
                      <td className="text-right text-ink-900 font-medium">
                        {row.total_debit > 0 ? row.total_debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="text-right text-ink-900 font-medium">
                        {row.total_credit > 0 ? row.total_credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                      </td>
                    </tr>
                  ))}
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center p-8 text-ink-500">No accounts have balances as of this date.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-10 flex justify-center items-center text-ink-500">
            <FileText className="h-6 w-6 mr-2 opacity-50" /> Failed to load report.
          </div>
        )}
      </div>
    </div>
  )
}
