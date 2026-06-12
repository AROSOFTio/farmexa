import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { accountingService } from '@/services/accountingService'
import { branchService, Branch } from '@/services/branchService'
import { reportsService } from '@/services/reportsService'
import { FileText, Loader2, RefreshCcw, Download, Printer, Filter, CheckCircle2, AlertTriangle } from 'lucide-react'
import { UGX } from '@/lib/money'
import clsx from 'clsx'

export function TrialBalancePage() {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10))
  const [branchId, setBranchId] = useState<number | undefined>(undefined)
  const [hideZeroBalances, setHideZeroBalances] = useState(true)

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['settings-branches'],
    queryFn: () => branchService.getBranches()
  })

  // Fetch trial balance
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['trial-balance-report', asOfDate, branchId],
    queryFn: () => accountingService.getTrialBalance({ 
      as_of_date: asOfDate,
      branch_id: branchId 
    }),
  })

  // Filter out zero balance rows if toggle active
  const filteredRows = useMemo(() => {
    if (!data?.rows) return []
    if (!hideZeroBalances) return data.rows
    return data.rows.filter((row: any) => 
      Math.abs(row.total_debit) > 0.01 || Math.abs(row.total_credit) > 0.01 || Math.abs(row.balance) > 0.01
    )
  }, [data, hideZeroBalances])

  const handleExport = async (format: 'pdf' | 'xlsx' | 'csv') => {
    if (!data) return
    try {
      await reportsService.export(
        'trial-balance',
        {
          selected_fields: [],
          filters: {
            as_of_date: asOfDate,
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

  return (
    <div className="animate-fade-in space-y-5 pb-10">
      {/* Print Friendly Style */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; color: black !important; }
          .no-print, header, nav, aside, button, .section-header, .filter-card { display: none !important; }
          .main-content { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          .print-header { display: block !important; margin-bottom: 20px; text-align: center; }
          .card { border: none !important; box-shadow: none !important; padding: 0 !important; background: transparent !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          td, th { padding: 8px !important; border-bottom: 1px solid #e2e8f0 !important; }
        }
      `}} />

      {/* Screen Header */}
      <div className="section-header no-print">
        <div>
          <h1 className="section-title">Trial Balance</h1>
          <p className="section-subtitle">Verify that total debits equal total credits across all ledger accounts.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5">
            <Printer className="h-4 w-4" /> Print
          </button>
          <button onClick={() => handleExport('pdf')} className="btn-primary flex items-center gap-1.5 text-xs py-1.5" disabled={!data}>
            <FileText className="h-4 w-4" /> PDF
          </button>
          <button onClick={() => handleExport('xlsx')} className="btn-primary flex items-center gap-1.5 text-xs py-1.5" disabled={!data}>
            <Download className="h-4 w-4" /> Excel
          </button>
          <button onClick={() => handleExport('csv')} className="btn-primary flex items-center gap-1.5 text-xs py-1.5" disabled={!data}>
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print-header text-center pb-4 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900">Farmexa Enterprise</h1>
        <p className="text-sm font-semibold text-slate-500">Trial Balance Statement</p>
        <p className="text-xs text-slate-400 mt-1 font-mono">
          As of Date: {formatDate(asOfDate)} {branchId && ` | Branch: ${branches.find(b => b.id === branchId)?.name}`}
        </p>
      </div>

      {/* Filters (Screen Only) */}
      <div className="card p-5 no-print filter-card">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="form-label text-xs font-bold text-slate-400 uppercase">As of Date</label>
            <input 
              type="date" 
              className="form-input text-xs mt-1" 
              value={asOfDate} 
              onChange={e => setAsOfDate(e.target.value)} 
            />
          </div>

          <div>
            <label className="form-label text-xs font-bold text-slate-400 uppercase">Branch Filter</label>
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

          <div className="flex items-center h-10">
            <label className="inline-flex items-center cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-400 select-none">
              <input 
                type="checkbox" 
                className="form-checkbox h-4 w-4 text-brand-650 rounded border-slate-300 mr-2"
                checked={hideZeroBalances}
                onChange={e => setHideZeroBalances(e.target.checked)}
              />
              Hide Zero-Balance Accounts
            </label>
          </div>

          <button 
            type="button" 
            className="btn-secondary text-xs py-2" 
            onClick={() => refetch()} 
            disabled={isFetching}
          >
            <RefreshCcw className={clsx("h-3.5 w-3.5", isFetching && "animate-spin")} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Card Strip */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4 flex items-center justify-between border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div>
              <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Total Debits</p>
              <p className="text-lg font-mono font-bold text-slate-850 dark:text-slate-100 mt-1">{UGX(data.total_debit)}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 p-2 rounded-lg text-blue-600">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="card p-4 flex items-center justify-between border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div>
              <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Total Credits</p>
              <p className="text-lg font-mono font-bold text-slate-850 dark:text-slate-100 mt-1">{UGX(data.total_credit)}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950/20 p-2 rounded-lg text-purple-600">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className={clsx(
            "card p-4 flex items-center justify-between border",
            data.is_balanced 
              ? "bg-green-50/50 border-green-200 text-green-800 dark:bg-green-950/10 dark:border-green-800 dark:text-green-300"
              : "bg-red-50/50 border-red-200 text-red-800 dark:bg-red-950/10 dark:border-red-800 dark:text-red-300"
          )}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-75">Status Alignment</p>
              <p className="text-base font-bold mt-1 uppercase flex items-center gap-1.5">
                {data.is_balanced ? (
                  <>
                    <CheckCircle2 className="h-4.5 w-4.5 text-green-600 dark:text-green-400" />
                    Balanced
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4.5 w-4.5 text-red-650 dark:text-red-400" />
                    Imbalanced ({UGX(Math.abs(data.total_debit - data.total_credit))})
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Trial Balance Table Card */}
      <div className="card overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {isLoading ? (
          <div className="p-16 flex flex-col justify-center items-center text-ink-400">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600 mb-2" /> 
            <span>Computing trial balances...</span>
          </div>
        ) : data ? (
          <div>
            <div className="overflow-x-auto">
              <table className="data-table text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800">
                    <th className="pl-6 w-32 font-bold text-slate-700 dark:text-slate-300">Account Code</th>
                    <th className="font-bold text-slate-700 dark:text-slate-300">Account Name</th>
                    <th className="font-bold text-slate-700 dark:text-slate-300">Account Type</th>
                    <th className="text-right font-bold text-slate-700 dark:text-slate-300 w-36">Debit Balance</th>
                    <th className="text-right font-bold text-slate-700 dark:text-slate-300 w-36 pr-6">Credit Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRows.map((row: any) => (
                    <tr key={row.account_code} className="hover:bg-slate-50/25 font-mono">
                      <td className="pl-6 text-slate-900 dark:text-slate-100 font-bold">{row.account_code}</td>
                      <td className="text-slate-800 dark:text-slate-200 font-sans font-medium">{row.account_name}</td>
                      <td className="capitalize text-slate-450 font-sans">{row.account_type.replace('_', ' ')}</td>
                      <td className="text-right text-slate-900 dark:text-slate-100">
                        {row.total_debit > 0 ? UGX(row.total_debit) : '-'}
                      </td>
                      <td className="text-right text-slate-900 dark:text-slate-100 pr-6">
                        {row.total_credit > 0 ? UGX(row.total_credit) : '-'}
                      </td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-16 text-slate-400 font-sans">
                        No non-zero balance accounts found. Try untoggling "Hide Zero-Balance Accounts".
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-850 font-bold border-t border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200">
                  <tr>
                    <td colSpan={3} className="pl-6 py-3 text-right font-sans">Totals:</td>
                    <td className="py-3 text-right font-mono text-brand-700 dark:text-brand-400">{UGX(data.total_debit)}</td>
                    <td className="py-3 text-right font-mono text-brand-700 dark:text-brand-400 pr-6">{UGX(data.total_credit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-16 flex flex-col justify-center items-center text-ink-400">
            <FileText className="h-8 w-8 mb-2 opacity-50 text-red-500" />
            <span>Could not generate trial balance report. Check filters or try again.</span>
          </div>
        )}
      </div>
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
