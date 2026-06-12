import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { accountingService } from '@/services/accountingService'
import { branchService, Branch } from '@/services/branchService'
import { reportsService } from '@/services/reportsService'
import { FileText, Loader2, RefreshCcw, Download, Printer, Wallet, Building2 } from 'lucide-react'
import { UGX } from '@/lib/money'
import clsx from 'clsx'

export function CashbookPage() {
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))
  const [activeTab, setActiveTab] = useState<number | null>(null)
  
  // Filters
  const [branchId, setBranchId] = useState<number | undefined>(undefined)

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['settings-branches'],
    queryFn: () => branchService.getBranches()
  })

  // Fetch cash accounts (bank, cash, mobile money)
  const { data: accounts = [], isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['cash-accounts-list'],
    queryFn: () => accountingService.getCashAccounts(),
  })

  // Set the first account as active by default
  useEffect(() => {
    if (accounts && accounts.length > 0 && activeTab === null) {
      setActiveTab(accounts[0].id)
    }
  }, [accounts, activeTab])

  // Fetch cashbook ledger report
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['cashbook-report', activeTab, fromDate, toDate, branchId],
    queryFn: () => accountingService.getCashbook({ 
      account_id: activeTab as number, 
      from_date: fromDate, 
      to_date: toDate,
      branch_id: branchId 
    }),
    enabled: !!activeTab,
  })

  const handleExport = async (format: 'pdf' | 'xlsx' | 'csv') => {
    if (!data) return
    try {
      await reportsService.export(
        'cashbook',
        {
          selected_fields: [],
          filters: {
            account_id: activeTab,
            from_date: fromDate,
            end_date: toDate,
            branch_id: branchId || null,
          }
        },
        format
      )
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const selectedAccount = accounts.find(a => a.id === activeTab)

  return (
    <div className="animate-fade-in space-y-5 pb-10">
      {/* Print Friendly Style */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; color: black !important; }
          .no-print, header, nav, aside, button, .section-header, .filter-card, .accounts-sidebar { display: none !important; }
          .main-content { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          .print-header { display: block !important; margin-bottom: 20px; text-align: center; }
          .report-container { width: 100% !important; grid-column: span 12 / span 12 !important; }
          .card { border: none !important; box-shadow: none !important; padding: 0 !important; background: transparent !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          td, th { padding: 8px !important; border-bottom: 1px solid #e2e8f0 !important; }
        }
      `}} />

      {/* Screen Header */}
      <div className="section-header no-print">
        <div>
          <h1 className="section-title">Cashbooks</h1>
          <p className="section-subtitle">Track cash inflows and outflows across your bank, cash, and mobile money accounts.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 font-bold" disabled={!data}>
            <Printer className="h-4 w-4" /> Print
          </button>
          <button onClick={() => handleExport('pdf')} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 font-bold" disabled={!data}>
            <FileText className="h-4 w-4" /> PDF
          </button>
          <button onClick={() => handleExport('xlsx')} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 font-bold" disabled={!data}>
            <Download className="h-4 w-4" /> Excel
          </button>
          <button onClick={() => handleExport('csv')} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 font-bold" disabled={!data}>
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      {/* Print Header */}
      {data && (
        <div className="hidden print-header text-center pb-4 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-900">Farmexa Enterprise</h1>
          <p className="text-sm font-semibold text-slate-500">Cashbook Statement: {data.account.name} ({data.account.code})</p>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Period: {formatDate(fromDate)} to {formatDate(toDate)}
            {branchId && ` | Branch: ${branches.find(b => b.id === branchId)?.name}`}
          </p>
        </div>
      )}

      {/* Filters (Screen Only) */}
      <div className="card p-5 no-print filter-card">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="form-label text-xs font-bold text-slate-400 uppercase">From Date</label>
            <input type="date" className="form-input text-xs mt-1" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label text-xs font-bold text-slate-400 uppercase">To Date</label>
            <input type="date" className="form-input text-xs mt-1" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>

          <div>
            <label className="form-label text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              Branch Filter
            </label>
            <select
              className="form-input text-xs mt-1 min-w-[160px]"
              value={branchId || ''}
              onChange={e => setBranchId(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <button 
            type="button" 
            className="btn-secondary text-xs py-2" 
            onClick={() => refetch()} 
            disabled={isFetching || !activeTab}
          >
            <RefreshCcw className={clsx("h-3.5 w-3.5", isFetching && "animate-spin")} /> Refresh
          </button>
        </div>
      </div>

      {isLoadingAccounts ? (
        <div className="card p-16 flex justify-center text-ink-400">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600 mr-2" /> Loading accounts...
        </div>
      ) : accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* Accounts List Sidebar (Screen Only) */}
          <div className="md:col-span-4 space-y-2 no-print accounts-sidebar">
            <h3 className="text-xs font-bold text-slate-450 uppercase tracking-wider mb-3 px-1">Cash & Bank Accounts</h3>
            {accounts.map(account => (
              <button
                key={account.id}
                onClick={() => setActiveTab(account.id)}
                className={clsx(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all border",
                  activeTab === account.id 
                    ? 'bg-brand-50 border-brand-200 text-brand-900 dark:bg-brand-950/20 dark:border-brand-800' 
                    : 'bg-white border-slate-200 text-ink-700 hover:bg-slate-50/50 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800/50'
                )}
              >
                <div className={clsx(
                  "p-2 rounded-md",
                  activeTab === account.id ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'
                )}>
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{account.name}</div>
                  <div className="text-xs font-mono opacity-70 mt-0.5">{account.account_code}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Report Detail Panel */}
          <div className="md:col-span-8 card overflow-hidden min-h-[400px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 report-container">
            {isLoading ? (
              <div className="p-16 flex flex-col justify-center items-center text-ink-400">
                <Loader2 className="h-8 w-8 animate-spin text-brand-600 mb-2" /> 
                <span>Compiling cashbook transactions...</span>
              </div>
            ) : data ? (
              <div>
                {/* Header Summary */}
                <div className="p-5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {data.account.name} ({data.account.code})
                    </h3>
                    <p className="text-[10px] text-slate-450 uppercase font-semibold mt-1 tracking-wider">
                      Cashbook Registry
                    </p>
                  </div>
                  <div className="text-left sm:text-right bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-xs">
                    <p className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Running Cash Balance</p>
                    <p className="text-lg font-mono font-bold text-slate-950 dark:text-slate-100 mt-0.5">{UGX(data.closing_balance)}</p>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="data-table text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800">
                        <th className="pl-6 w-28 font-bold text-slate-700 dark:text-slate-350">Date</th>
                        <th className="font-bold text-slate-700 dark:text-slate-350">Description</th>
                        <th className="text-right font-bold text-emerald-600 dark:text-emerald-400 w-32">Money In (Dr)</th>
                        <th className="text-right font-bold text-rose-600 dark:text-rose-400 w-32">Money Out (Cr)</th>
                        <th className="text-right font-bold text-slate-700 dark:text-slate-350 w-32 pr-6">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {/* Opening Balance Row */}
                      <tr className="bg-slate-50/50 dark:bg-slate-800/10 font-bold">
                        <td colSpan={4} className="pl-6 py-3 text-slate-500 uppercase tracking-wider text-[10px]">Opening Period Balance</td>
                        <td className="text-right font-mono text-slate-900 dark:text-slate-100 pr-6">{UGX(data.opening_balance)}</td>
                      </tr>

                      {/* Entries */}
                      {data.entries.map((entry: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/25 font-mono">
                          <td className="pl-6 whitespace-nowrap font-sans text-slate-500">{formatDate(entry.date)}</td>
                          <td>
                            <div className="font-semibold text-slate-850 dark:text-slate-100 font-sans">{entry.description || '-'}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{entry.entry_number}</div>
                          </td>
                          <td className="text-right text-emerald-600 dark:text-emerald-450 font-bold">
                            {entry.debit > 0 ? UGX(entry.debit) : ''}
                          </td>
                          <td className="text-right text-rose-600 dark:text-rose-450 font-bold">
                            {entry.credit > 0 ? UGX(entry.credit) : ''}
                          </td>
                          <td className="text-right text-slate-900 dark:text-slate-100 font-bold pr-6">
                            {UGX(entry.balance)}
                          </td>
                        </tr>
                      ))}
                      
                      {data.entries.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-16 text-slate-400 font-sans">
                            No cash movements recorded during the selected period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-16 flex flex-col justify-center items-center text-ink-400">
                <FileText className="h-8 w-8 mb-2 opacity-50 text-slate-400" />
                <span>Select a cash or bank account from the sidebar.</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card p-16 flex flex-col justify-center items-center text-ink-500 border border-slate-200 dark:border-slate-800">
          <Wallet className="h-12 w-12 mb-3 text-ink-300 stroke-[1.25]" />
          <p className="font-semibold">No Cash/Bank Accounts Found</p>
          <p className="text-xs text-ink-500 mt-1 max-w-xs text-center">
            Create or map an asset account under group code 111x in the Chart of Accounts to enable cashbook logging.
          </p>
        </div>
      )}
    </div>
  )
}

function formatDate(value: string) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
