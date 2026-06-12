import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { accountingService } from '@/services/accountingService'
import { branchService, Branch } from '@/services/branchService'
import api from '@/services/api'
import { FileText, Loader2, RefreshCcw, Download, Printer, Search, Building2, Bird } from 'lucide-react'
import { UGX } from '@/lib/money'
import clsx from 'clsx'

interface Batch {
  id: number
  batch_number: string
  breed: string
}

export function GeneralLedgerPage() {
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))
  const [accountId, setAccountId] = useState<number | ''>('')
  
  // Filters
  const [branchId, setBranchId] = useState<number | undefined>(undefined)
  const [batchId, setBatchId] = useState<number | undefined>(undefined)

  // Fetch accounts list using the correct service
  const { data: accounts = [], isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['accounting-coa-flat'],
    queryFn: () => accountingService.getCoaFlat()
  })

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['settings-branches'],
    queryFn: () => branchService.getBranches()
  })

  // Fetch batches
  const { data: batches = [] } = useQuery({
    queryKey: ['farm-batches'],
    queryFn: () => api.get<Batch[]>('/farm/batches').then(res => res.data)
  })

  // Fetch general ledger entries
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['general-ledger-report', accountId, fromDate, toDate, branchId, batchId],
    queryFn: () => accountingService.getLedger({ 
      account_id: accountId as number, 
      from_date: fromDate, 
      to_date: toDate,
      branch_id: branchId,
      batch_id: batchId
    }),
    enabled: !!accountId,
  })

  const downloadCSV = (csvContent: string, fileName: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', fileName)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExport = () => {
    if (!data) return
    let csv = `General Ledger Statement: ${data.account.code} - ${data.account.name}\n`
    csv += `Period: ${fromDate} to ${toDate}\n`
    if (branchId) csv += `Branch ID: ${branchId}\n`
    if (batchId) csv += `Batch ID: ${batchId}\n\n`
    csv += 'Date,Entry #,Description,Reference,Debit (UGX),Credit (UGX),Running Balance (UGX)\n'
    
    csv += `,,Opening Balance,,,${data.opening_balance}\n`
    
    data.entries.forEach((entry: any) => {
      const ref = entry.reference_type ? `${entry.reference_type} #${entry.reference_id}` : ''
      csv += `${entry.date},${entry.entry_number},"${entry.description || ''}","${ref}",${entry.debit},${entry.credit},${entry.balance}\n`
    })
    
    csv += `,,Closing Balance,,,${data.closing_balance}\n`
    downloadCSV(csv, `ledger_${data.account.code}_${fromDate}_to_${toDate}.csv`)
  }

  const handlePrint = () => {
    window.print()
  }

  const selectedAccountDetails = accounts.find(a => a.id === accountId)

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
          <h1 className="section-title">General Ledger</h1>
          <p className="section-subtitle">Detailed transaction history and running balances for a specific account.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5" disabled={!data}>
            <Printer className="h-4 w-4" /> Print
          </button>
          <button onClick={handleExport} className="btn-primary flex items-center gap-1.5 text-xs py-1.5" disabled={!data}>
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Print Header */}
      {data && (
        <div className="hidden print-header text-center pb-4 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-900">Farmexa Enterprise</h1>
          <p className="text-sm font-semibold text-slate-500">General Ledger: {data.account.code} - {data.account.name}</p>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Period: {formatDate(fromDate)} to {formatDate(toDate)}
            {branchId && ` | Branch: ${branches.find(b => b.id === branchId)?.name}`}
            {batchId && ` | Batch: ${batches.find(b => b.id === batchId)?.batch_number}`}
          </p>
        </div>
      )}

      {/* Filters (Screen Only) */}
      <div className="card p-5 no-print filter-card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="form-label text-xs font-bold text-slate-400 uppercase">Account</label>
            <select 
              className="form-input text-xs mt-1" 
              value={accountId} 
              onChange={e => setAccountId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">-- Select Account --</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.account_code} - {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label text-xs font-bold text-slate-400 uppercase">From Date</label>
            <input type="date" className="form-input text-xs mt-1" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label text-xs font-bold text-slate-400 uppercase">To Date</label>
            <input type="date" className="form-input text-xs mt-1" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button 
              type="button" 
              className="btn-secondary text-xs py-2 w-full" 
              onClick={() => refetch()} 
              disabled={isFetching || !accountId}
            >
              <RefreshCcw className={clsx("h-3.5 w-3.5 mx-auto", isFetching && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Optional Sub Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="form-label text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              Branch Filter
            </label>
            <select
              className="form-input text-xs mt-1"
              value={branchId || ''}
              onChange={e => setBranchId(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
              <Bird className="h-3 w-3" />
              Batch Filter
            </label>
            <select
              className="form-input text-xs mt-1"
              value={batchId || ''}
              onChange={e => setBatchId(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.batch_number} ({b.breed})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Report Render */}
      <div className="card overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 min-h-[400px]">
        {!accountId ? (
          <div className="p-16 flex flex-col items-center justify-center text-ink-400">
            <Search className="h-12 w-12 stroke-[1.25] text-ink-300 mb-3" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-350">No Account Selected</p>
            <p className="text-xs text-slate-450 mt-1">Select a ledger account from the dropdown filter to retrieve audit trails.</p>
          </div>
        ) : isLoading ? (
          <div className="p-16 flex flex-col justify-center items-center text-ink-400">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600 mb-2" /> 
            <span>Retrieving transaction log...</span>
          </div>
        ) : data ? (
          <div>
            {/* Header summary of selected account */}
            <div className="p-5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                  {data.account.code} - {data.account.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1 uppercase font-semibold tracking-wide">
                  {data.account.type?.replace('_', ' ')} • Normal Balance: {data.account.normal_balance}
                </p>
              </div>
              <div className="text-left sm:text-right bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-xs">
                <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Net Closing Balance</p>
                <p className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">{UGX(data.closing_balance)}</p>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="data-table text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800">
                    <th className="pl-6 w-28 font-bold text-slate-700 dark:text-slate-300">Date</th>
                    <th className="font-bold text-slate-700 dark:text-slate-300 w-32">Entry #</th>
                    <th className="font-bold text-slate-700 dark:text-slate-300">Description</th>
                    <th className="font-bold text-slate-700 dark:text-slate-300 w-32">Reference</th>
                    <th className="text-right font-bold text-slate-700 dark:text-slate-300 w-28">Debit</th>
                    <th className="text-right font-bold text-slate-700 dark:text-slate-300 w-28">Credit</th>
                    <th className="text-right font-bold text-slate-700 dark:text-slate-300 w-28 pr-6">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {/* Opening Balance Row */}
                  <tr className="bg-slate-50/50 dark:bg-slate-800/10 font-bold">
                    <td colSpan={4} className="pl-6 py-3 text-slate-500 uppercase tracking-wider text-[10px]">Opening Period Balance</td>
                    <td></td>
                    <td></td>
                    <td className="text-right font-mono text-slate-900 dark:text-slate-100 pr-6">{UGX(data.opening_balance)}</td>
                  </tr>

                  {/* Transaction Rows */}
                  {data.entries.map((entry: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/25 font-mono">
                      <td className="pl-6 whitespace-nowrap font-sans text-slate-650 dark:text-slate-400">{formatDate(entry.date)}</td>
                      <td className="text-slate-900 dark:text-slate-100 font-bold">{entry.entry_number}</td>
                      <td className="font-sans text-slate-700 dark:text-slate-300 max-w-xs truncate">{entry.description || '-'}</td>
                      <td className="font-sans text-slate-500 text-[11px] truncate">
                        {entry.reference_type ? `${entry.reference_type} #${entry.reference_id}` : '-'}
                      </td>
                      <td className="text-right text-slate-900 dark:text-slate-100">
                        {entry.debit > 0 ? UGX(entry.debit) : ''}
                      </td>
                      <td className="text-right text-slate-900 dark:text-slate-100">
                        {entry.credit > 0 ? UGX(entry.credit) : ''}
                      </td>
                      <td className="text-right text-slate-900 dark:text-slate-100 font-bold pr-6">
                        {UGX(entry.balance)}
                      </td>
                    </tr>
                  ))}
                  
                  {data.entries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-slate-400 font-sans">
                        No transactions recorded for this account during the selected date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-16 flex flex-col justify-center items-center text-ink-400">
            <FileText className="h-8 w-8 mb-2 opacity-50 text-red-500" />
            <span>Could not load the General Ledger statement. Check the selected account.</span>
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
