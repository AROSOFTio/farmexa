import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { financeReportsService, AccountInfo } from '@/services/financeReportsService'
import { FileText, Loader2, RefreshCcw, Wallet } from 'lucide-react'

export function CashbookPage() {
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))
  const [activeTab, setActiveTab] = useState<number | null>(null)
  
  // Fetch cash accounts (bank, cash, mobile money)
  const { data: accounts, isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['cash-accounts'],
    queryFn: () => financeReportsService.getCashAccounts(),
  })

  // Set the first account as active by default
  useEffect(() => {
    if (accounts && accounts.length > 0 && activeTab === null) {
      setActiveTab(accounts[0].id)
    }
  }, [accounts, activeTab])

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['cashbook', activeTab, fromDate, toDate],
    queryFn: () => financeReportsService.getCashbook({ account_id: activeTab as number, from_date: fromDate, to_date: toDate }),
    enabled: !!activeTab,
  })

  return (
    <div className="animate-fade-in space-y-5 pb-10">
      <div className="section-header">
        <div>
          <h1 className="section-title">Cashbooks</h1>
          <p className="section-subtitle">Track cash inflows and outflows across your bank, cash, and mobile money accounts.</p>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="form-label">From Date</label>
            <input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label">To Date</label>
            <input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <button type="button" className="btn-secondary" onClick={() => refetch()} disabled={isFetching || !activeTab}>
            <RefreshCcw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {isLoadingAccounts ? (
        <div className="card p-10 flex justify-center text-ink-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading accounts...
        </div>
      ) : accounts && accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 space-y-2">
            <h3 className="font-semibold text-ink-900 mb-3 px-1">Cash Accounts</h3>
            {accounts.map(account => (
              <button
                key={account.id}
                onClick={() => setActiveTab(account.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors border ${
                  activeTab === account.id 
                    ? 'bg-primary-50 border-primary-200 text-primary-900 dark:bg-primary-900/20 dark:border-primary-800' 
                    : 'bg-white border-slate-200 text-ink-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-800/80'
                }`}
              >
                <div className={`p-2 rounded-md ${activeTab === account.id ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'}`}>
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium text-sm">{account.name}</div>
                  <div className="text-xs opacity-70 font-mono mt-0.5">{account.code}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="md:col-span-3 card overflow-hidden min-h-[400px]">
            {isLoading ? (
              <div className="p-16 flex justify-center items-center text-ink-500">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading transactions...
              </div>
            ) : data ? (
              <div>
                <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-b border-[var(--border-subtle)]">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold text-ink-900">{data.account.name}</h3>
                      <p className="text-sm text-ink-500">Running Balance</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-ink-900">{data.closing_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th className="text-right text-emerald-600">Money In</th>
                        <th className="text-right text-rose-600">Money Out</th>
                        <th className="text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                        <td colSpan={4} className="font-medium text-ink-600 text-right">Opening Balance</td>
                        <td className="text-right font-semibold text-ink-900">{data.opening_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                      {data.entries.map((entry, idx) => (
                        <tr key={idx}>
                          <td className="whitespace-nowrap">{entry.date}</td>
                          <td>
                            <div className="font-medium text-ink-900">{entry.description || '-'}</div>
                            <div className="text-xs text-ink-500 font-mono mt-0.5">{entry.entry_number}</div>
                          </td>
                          <td className="text-right text-emerald-600 font-medium">{entry.debit > 0 ? entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}</td>
                          <td className="text-right text-rose-600 font-medium">{entry.credit > 0 ? entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}</td>
                          <td className="text-right font-medium text-ink-900">{entry.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                      {data.entries.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center p-8 text-ink-500">No cash movements for this period.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-10 flex justify-center items-center text-ink-500">
                <FileText className="h-6 w-6 mr-2 opacity-50" /> Select an account to view
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card p-10 flex flex-col justify-center items-center text-ink-500">
          <Wallet className="h-10 w-10 mb-3 text-ink-300" />
          <p>No cash or bank accounts found in the chart of accounts.</p>
        </div>
      )}
    </div>
  )
}
