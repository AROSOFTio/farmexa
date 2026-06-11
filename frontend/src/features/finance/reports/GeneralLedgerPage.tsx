import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { financeReportsService } from '@/services/financeReportsService'
import { api } from '@/services/api'
import { FileText, Loader2, RefreshCcw, Search } from 'lucide-react'

export function GeneralLedgerPage() {
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))
  const [accountId, setAccountId] = useState<number | ''>('')
  
  // Fetch all active accounts for dropdown
  const { data: accounts } = useQuery({
    queryKey: ['accounts-list'],
    queryFn: async () => {
      const res = await api.get('/accounting/accounts')
      return res.data as { id: number, account_code: string, name: string }[]
    }
  })

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['general-ledger', accountId, fromDate, toDate],
    queryFn: () => financeReportsService.getGeneralLedger({ account_id: accountId as number, from_date: fromDate, to_date: toDate }),
    enabled: !!accountId,
  })

  return (
    <div className="animate-fade-in space-y-5 pb-10">
      <div className="section-header">
        <div>
          <h1 className="section-title">General Ledger</h1>
          <p className="section-subtitle">Detailed transaction history and running balance for a specific account.</p>
        </div>
      </div>

      <div className="card p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="form-label">Account</label>
            <select className="form-input" value={accountId} onChange={e => setAccountId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">-- Select Account --</option>
              {accounts?.map(a => (
                <option key={a.id} value={a.id}>{a.account_code} - {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">From Date</label>
            <input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="form-label">To Date</label>
              <input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>
            <button type="button" className="btn-secondary self-end" onClick={() => refetch()} disabled={isFetching || !accountId}>
              <RefreshCcw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden min-h-[400px]">
        {!accountId ? (
          <div className="p-16 flex flex-col items-center justify-center text-ink-500">
            <Search className="h-10 w-10 mb-3 text-ink-300" />
            <p>Select an account to view its ledger</p>
          </div>
        ) : isLoading ? (
          <div className="p-16 flex justify-center items-center text-ink-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading ledger...
          </div>
        ) : data ? (
          <div>
            <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-b border-[var(--border-subtle)]">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-ink-900">{data.account.code} - {data.account.name}</h3>
                  <p className="text-sm text-ink-500 capitalize">{data.account.type.replace('_', ' ')} • Normal Balance: {data.account.normal_balance}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-ink-500">Closing Balance</p>
                  <p className="text-2xl font-bold text-ink-900">{data.closing_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Entry #</th>
                    <th>Description</th>
                    <th>Ref</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                    <td colSpan={6} className="font-medium text-ink-600 text-right">Opening Balance</td>
                    <td className="text-right font-semibold text-ink-900">{data.opening_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                  {data.entries.map((entry, idx) => (
                    <tr key={idx}>
                      <td className="whitespace-nowrap">{entry.date}</td>
                      <td className="font-mono text-sm text-ink-600">{entry.entry_number}</td>
                      <td>{entry.description || '-'}</td>
                      <td className="text-ink-500 text-sm">{entry.reference_type ? `${entry.reference_type} #${entry.reference_id}` : '-'}</td>
                      <td className="text-right text-ink-900">{entry.debit > 0 ? entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}</td>
                      <td className="text-right text-ink-900">{entry.credit > 0 ? entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}</td>
                      <td className="text-right font-medium text-ink-900">{entry.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  {data.entries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-ink-500">No transactions found for this period.</td>
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
