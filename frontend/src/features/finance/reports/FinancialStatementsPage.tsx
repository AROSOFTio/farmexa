import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { accountingService } from '@/services/accountingService'
import { branchService, Branch } from '@/services/branchService'
import { reportsService } from '@/services/reportsService'
import api from '@/services/api'
import { FileText, Loader2, RefreshCcw, Download, Printer, Filter, Building2, Bird } from 'lucide-react'
import { UGX } from '@/lib/money'
import clsx from 'clsx'

interface Batch {
  id: number
  batch_number: string
  breed: string
  status: string
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function FinancialStatementsPage() {
  const [statementType, setStatementType] = useState<'pnl' | 'balance-sheet' | 'cash-flow'>('pnl')
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10))
  
  // Filters
  const [branchId, setBranchId] = useState<number | undefined>(undefined)
  const [batchId, setBatchId] = useState<number | undefined>(undefined)

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

  // Queries
  const pnlQuery = useQuery({
    queryKey: ['pnl-statement', fromDate, toDate, branchId, batchId],
    queryFn: () => accountingService.getProfitLoss({ 
      from_date: fromDate, 
      to_date: toDate,
      branch_id: branchId,
      batch_id: batchId
    }),
    enabled: statementType === 'pnl',
  })

  const bsQuery = useQuery({
    queryKey: ['balance-sheet-statement', asOfDate, branchId],
    queryFn: () => accountingService.getBalanceSheet({ 
      as_of_date: asOfDate,
      branch_id: branchId
    }),
    enabled: statementType === 'balance-sheet',
  })

  const cfQuery = useQuery({
    queryKey: ['cash-flow-statement', fromDate, toDate, branchId],
    queryFn: () => accountingService.getCashFlow({ 
      from_date: fromDate, 
      to_date: toDate,
      branch_id: branchId
    }),
    enabled: statementType === 'cash-flow',
  })

  const handleExport = async (format: 'pdf' | 'xlsx' | 'csv') => {
    let reportKey = ''
    let filters: Record<string, any> = {}

    if (statementType === 'pnl') {
      reportKey = 'profit-loss'
      filters = {
        start_date: fromDate,
        end_date: toDate,
        branch_id: branchId || null,
        batch_id: batchId || null,
      }
    } else if (statementType === 'balance-sheet') {
      reportKey = 'balance-sheet'
      filters = {
        as_of_date: asOfDate,
        branch_id: branchId || null,
      }
    } else if (statementType === 'cash-flow') {
      reportKey = 'cash-flow'
      filters = {
        from_date: fromDate,
        end_date: toDate,
        branch_id: branchId || null,
      }
    }

    if (!reportKey) return
    try {
      await reportsService.export(
        reportKey,
        {
          selected_fields: [],
          filters,
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
      {/* Print Friendly CSS Injection */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; color: black !important; }
          .no-print, header, nav, aside, button, .section-header, .filter-card, .tabs-container { display: none !important; }
          .main-content { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          .print-header { display: block !important; margin-bottom: 20px; text-align: center; }
          .card { border: none !important; box-shadow: none !important; padding: 0 !important; background: transparent !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          td, th { padding: 8px !important; border-bottom: 1px solid #e2e8f0 !important; }
        }
      `}} />

      {/* Screen-Only Header */}
      <div className="section-header no-print">
        <div>
          <h1 className="section-title">Financial Statements</h1>
          <p className="section-subtitle">Core financial reports for enterprise performance analysis.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5">
            <Printer className="h-4 w-4" /> Print
          </button>
          <button onClick={() => handleExport('pdf')} className="btn-primary flex items-center gap-1.5 text-xs py-1.5">
            <FileText className="h-4 w-4" /> PDF
          </button>
          <button onClick={() => handleExport('xlsx')} className="btn-primary flex items-center gap-1.5 text-xs py-1.5">
            <Download className="h-4 w-4" /> Excel
          </button>
          <button onClick={() => handleExport('csv')} className="btn-primary flex items-center gap-1.5 text-xs py-1.5">
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      {/* Printable Header Info */}
      <div className="hidden print-header text-center pb-4 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900">Farmexa Enterprise</h1>
        <p className="text-sm font-semibold text-slate-500">
          {statementType === 'pnl' && `Profit & Loss Statement (Comprehensive Income)`}
          {statementType === 'balance-sheet' && `Balance Sheet (Statement of Financial Position)`}
          {statementType === 'cash-flow' && `Statement of Cash Flows`}
        </p>
        <p className="text-xs text-slate-400 mt-1 font-mono">
          {statementType === 'balance-sheet' ? `As of: ${formatDate(asOfDate)}` : `Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`}
          {branchId && ` | Branch: ${branches.find(b => b.id === branchId)?.name}`}
          {statementType === 'pnl' && batchId && ` | Batch: ${batches.find(b => b.id === batchId)?.batch_number}`}
        </p>
      </div>

      {/* Tab Selectors (Screen Only) */}
      <div className="card p-1 no-print tabs-container">
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
          <button
            className={clsx(
              "flex-1 py-2 text-sm font-bold rounded-md transition-all",
              statementType === 'pnl' ? "bg-white dark:bg-slate-700 shadow-sm text-brand-700" : "text-ink-500 hover:text-ink-700"
            )}
            onClick={() => setStatementType('pnl')}
          >
            Profit & Loss
          </button>
          <button
            className={clsx(
              "flex-1 py-2 text-sm font-bold rounded-md transition-all",
              statementType === 'balance-sheet' ? "bg-white dark:bg-slate-700 shadow-sm text-brand-700" : "text-ink-500 hover:text-ink-700"
            )}
            onClick={() => setStatementType('balance-sheet')}
          >
            Balance Sheet
          </button>
          <button
            className={clsx(
              "flex-1 py-2 text-sm font-bold rounded-md transition-all",
              statementType === 'cash-flow' ? "bg-white dark:bg-slate-700 shadow-sm text-brand-700" : "text-ink-500 hover:text-ink-700"
            )}
            onClick={() => setStatementType('cash-flow')}
          >
            Cash Flow
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <div className="card p-5 no-print filter-card">
        <div className="flex flex-wrap items-end gap-4">
          {statementType === 'balance-sheet' ? (
            <div>
              <label className="form-label text-xs font-bold text-slate-400 uppercase">As of Date</label>
              <input type="date" className="form-input text-xs mt-1" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} />
            </div>
          ) : (
            <>
              <div>
                <label className="form-label text-xs font-bold text-slate-400 uppercase">From Date</label>
                <input type="date" className="form-input text-xs mt-1" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div>
                <label className="form-label text-xs font-bold text-slate-400 uppercase">To Date</label>
                <input type="date" className="form-input text-xs mt-1" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            </>
          )}

          {/* Branch Filter Selector */}
          <div>
            <label className="form-label text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
              <Building2 className="h-3 w-3 text-slate-400" />
              Branch Filter
            </label>
            <select
              className="form-input text-xs mt-1 min-w-[150px]"
              value={branchId || ''}
              onChange={e => setBranchId(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Batch Filter Selector (P&L only) */}
          {statementType === 'pnl' && (
            <div>
              <label className="form-label text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                <Bird className="h-3 w-3 text-slate-400" />
                Batch Filter
              </label>
              <select
                className="form-input text-xs mt-1 min-w-[150px]"
                value={batchId || ''}
                onChange={e => setBatchId(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">All Batches</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.batch_number} ({b.breed})</option>
                ))}
              </select>
            </div>
          )}

          <button 
            type="button" 
            className="btn-secondary text-xs py-2" 
            onClick={() => {
              if (statementType === 'pnl') pnlQuery.refetch()
              else if (statementType === 'balance-sheet') bsQuery.refetch()
              else cfQuery.refetch()
            }}
          >
            <RefreshCcw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Reports Render Area */}
      <div className="card overflow-hidden bg-white dark:bg-slate-900 min-h-[500px] border border-slate-200 dark:border-slate-800">
        
        {/* PROFIT & LOSS TAB */}
        {statementType === 'pnl' && (
          <div className="p-8">
            <h2 className="text-lg font-bold text-center text-slate-900 dark:text-slate-100 mb-6 uppercase tracking-wider no-print">
              Profit & Loss Statement (Comprehensive Income)
            </h2>
            {pnlQuery.isLoading ? (
              <div className="flex justify-center p-16">
                <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
              </div>
            ) : pnlQuery.data ? (
              <div className="max-w-3xl mx-auto space-y-6">
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="bg-slate-50 dark:bg-slate-850 font-bold border-b border-slate-200 dark:border-slate-800">
                      <td className="p-3 text-slate-800 dark:text-slate-200 uppercase tracking-wider">Revenue Accounts</td>
                      <td className="p-3 text-right text-slate-800 dark:text-slate-200 uppercase tracking-wider w-36">Amount (UGX)</td>
                    </tr>
                    {pnlQuery.data.revenue.map((r: any) => (
                      <tr key={r.account_code} className="border-b border-slate-100 dark:border-slate-850/50 hover:bg-slate-50/25 font-mono">
                        <td className="p-2.5 pl-6 text-slate-700 dark:text-slate-300 font-sans">{r.account_name} ({r.account_code})</td>
                        <td className="p-2.5 text-right text-slate-900 dark:text-slate-100">{UGX(r.amount)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold border-t border-slate-350 dark:border-slate-650 bg-slate-50/50">
                      <td className="p-3 pl-6 text-slate-800 dark:text-slate-200">Total Revenue</td>
                      <td className="p-3 text-right text-brand-700 dark:text-brand-400 font-mono">{UGX(pnlQuery.data.total_revenue)}</td>
                    </tr>

                    <tr><td colSpan={2} className="h-6"></td></tr>
                    <tr className="bg-slate-50 dark:bg-slate-850 font-bold border-b border-slate-200 dark:border-slate-800">
                      <td className="p-3 text-slate-800 dark:text-slate-200 uppercase tracking-wider">Cost of Sales Accounts</td>
                      <td className="p-3 text-right text-slate-800 dark:text-slate-200 uppercase tracking-wider w-36">Amount (UGX)</td>
                    </tr>
                    {pnlQuery.data.cost_of_sales.map((c: any) => (
                      <tr key={c.account_code} className="border-b border-slate-100 dark:border-slate-850/50 hover:bg-slate-50/25 font-mono">
                        <td className="p-2.5 pl-6 text-slate-700 dark:text-slate-300 font-sans">{c.account_name} ({c.account_code})</td>
                        <td className="p-2.5 text-right text-slate-900 dark:text-slate-100">{UGX(c.amount)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold border-t border-slate-350 dark:border-slate-650 bg-slate-50/50">
                      <td className="p-3 pl-6 text-slate-800 dark:text-slate-200">Total Cost of Sales</td>
                      <td className="p-3 text-right text-slate-900 dark:text-slate-100 font-mono">{UGX(pnlQuery.data.total_cost_of_sales)}</td>
                    </tr>

                    <tr><td colSpan={2} className="h-6"></td></tr>
                    <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t border-b border-slate-300 dark:border-slate-700 text-sm">
                      <td className="p-3 text-slate-900 dark:text-slate-100 uppercase tracking-wider">Gross Profit</td>
                      <td className="p-3 text-right text-slate-900 dark:text-slate-100 font-mono">{UGX(pnlQuery.data.gross_profit)}</td>
                    </tr>

                    <tr><td colSpan={2} className="h-6"></td></tr>
                    <tr className="bg-slate-50 dark:bg-slate-850 font-bold border-b border-slate-200 dark:border-slate-800">
                      <td className="p-3 text-slate-800 dark:text-slate-200 uppercase tracking-wider">Operating Expenses</td>
                      <td className="p-3 text-right text-slate-800 dark:text-slate-200 uppercase tracking-wider w-36">Amount (UGX)</td>
                    </tr>
                    {pnlQuery.data.expenses.map((e: any) => (
                      <tr key={e.account_code} className="border-b border-slate-100 dark:border-slate-850/50 hover:bg-slate-50/25 font-mono">
                        <td className="p-2.5 pl-6 text-slate-700 dark:text-slate-300 font-sans">{e.account_name} ({e.account_code})</td>
                        <td className="p-2.5 text-right text-slate-900 dark:text-slate-100">{UGX(e.amount)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold border-t border-slate-350 dark:border-slate-650 bg-slate-50/50">
                      <td className="p-3 pl-6 text-slate-800 dark:text-slate-200">Total Operating Expenses</td>
                      <td className="p-3 text-right text-slate-900 dark:text-slate-100 font-mono">{UGX(pnlQuery.data.total_expenses)}</td>
                    </tr>

                    <tr><td colSpan={2} className="h-8"></td></tr>
                    <tr className={clsx(
                      "font-bold text-sm border-double border-t-4 border-b-4 border-slate-950 dark:border-slate-200/80",
                      pnlQuery.data.net_profit >= 0 
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300' 
                        : 'bg-rose-50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-300'
                    )}>
                      <td className="p-4 text-base uppercase tracking-wider">Net {pnlQuery.data.net_profit >= 0 ? 'Profit' : 'Loss'}</td>
                      <td className="p-4 text-right text-base font-mono">
                        {UGX(pnlQuery.data.net_profit)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center p-8 text-ink-400">Failed to render Profit & Loss statement</div>
            )}
          </div>
        )}

        {/* BALANCE SHEET TAB */}
        {statementType === 'balance-sheet' && (
          <div className="p-8">
            <h2 className="text-lg font-bold text-center text-slate-900 dark:text-slate-100 mb-6 uppercase tracking-wider no-print">
              Balance Sheet (Statement of Financial Position)
            </h2>
            {bsQuery.isLoading ? (
              <div className="flex justify-center p-16">
                <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
              </div>
            ) : bsQuery.data ? (
              <div className="max-w-5xl mx-auto space-y-6">
                
                {/* Balance Checker Banner (Screen Only) */}
                <div className={clsx(
                  "p-3 rounded-lg border text-xs flex items-center justify-between no-print",
                  bsQuery.data.is_balanced 
                    ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-800 dark:text-green-300"
                    : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-800 dark:text-red-300"
                )}>
                  <span className="font-semibold">
                    {bsQuery.data.is_balanced 
                      ? "Assets equal Liabilities + Equity. The balance sheet is in perfect alignment."
                      : "Balance sheet out of alignment! Debits do not equal Credits."
                    }
                  </span>
                  <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold uppercase", bsQuery.data.is_balanced ? "bg-green-600 text-white" : "bg-red-600 text-white")}>
                    {bsQuery.data.is_balanced ? "Balanced" : "Unbalanced"}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* ASSETS COLUMN */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b-2 border-slate-800 dark:border-slate-350 pb-2 uppercase tracking-wide">
                      Assets
                    </h3>
                    <table className="w-full text-xs">
                      <tbody>
                        {bsQuery.data.assets.map((a: any) => (
                          <tr key={a.account_code} className="border-b border-slate-100 dark:border-slate-850/50 hover:bg-slate-50/25 font-mono">
                            <td className="p-2.5 text-slate-700 dark:text-slate-300 font-sans">{a.account_name} ({a.account_code})</td>
                            <td className="p-2.5 text-right text-slate-900 dark:text-slate-100">{UGX(a.balance)}</td>
                          </tr>
                        ))}
                        {bsQuery.data.assets.length === 0 && (
                          <tr><td colSpan={2} className="p-4 text-center text-slate-400">No Asset records found</td></tr>
                        )}
                        <tr className="font-bold border-t-2 border-slate-400 dark:border-slate-600 bg-slate-50">
                          <td className="p-3 text-slate-850 dark:text-slate-200">Total Assets</td>
                          <td className="p-3 text-right text-brand-700 dark:text-brand-400 font-mono">{UGX(bsQuery.data.total_assets)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* LIABILITIES & EQUITY COLUMN */}
                  <div className="space-y-6">
                    {/* LIABILITIES */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b-2 border-slate-800 dark:border-slate-350 pb-2 uppercase tracking-wide">
                        Liabilities
                      </h3>
                      <table className="w-full text-xs">
                        <tbody>
                          {bsQuery.data.liabilities.map((l: any) => (
                            <tr key={l.account_code} className="border-b border-slate-100 dark:border-slate-850/50 hover:bg-slate-50/25 font-mono">
                              <td className="p-2.5 text-slate-700 dark:text-slate-300 font-sans">{l.account_name} ({l.account_code})</td>
                              <td className="p-2.5 text-right text-slate-900 dark:text-slate-100">{UGX(l.balance)}</td>
                            </tr>
                          ))}
                          {bsQuery.data.liabilities.length === 0 && (
                            <tr><td colSpan={2} className="p-4 text-center text-slate-400">No Liability records found</td></tr>
                          )}
                          <tr className="font-bold border-t border-slate-300 bg-slate-50/30">
                            <td className="p-2.5 text-slate-800">Total Liabilities</td>
                            <td className="p-2.5 text-right text-slate-900 font-mono">{UGX(bsQuery.data.total_liabilities)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* EQUITY */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b-2 border-slate-800 dark:border-slate-350 pb-2 uppercase tracking-wide">
                        Equity
                      </h3>
                      <table className="w-full text-xs">
                        <tbody>
                          {bsQuery.data.equity.map((e: any) => (
                            <tr key={e.account_code} className="border-b border-slate-100 dark:border-slate-850/50 hover:bg-slate-50/25 font-mono">
                              <td className="p-2.5 text-slate-700 dark:text-slate-300 font-sans">{e.account_name} ({e.account_code})</td>
                              <td className="p-2.5 text-right text-slate-900 dark:text-slate-100">{UGX(e.balance)}</td>
                            </tr>
                          ))}
                          <tr className="font-bold border-t border-slate-300 bg-slate-50/30">
                            <td className="p-2.5 text-slate-800">Total Equity</td>
                            <td className="p-2.5 text-right text-slate-900 font-mono">{UGX(bsQuery.data.total_equity)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* LIABILITIES + EQUITY TOTAL */}
                    <div className="border-t-2 border-slate-400 dark:border-slate-600 bg-slate-50 p-3 flex justify-between font-bold text-xs">
                      <span className="text-slate-850 dark:text-slate-200">Total Liabilities & Equity</span>
                      <span className="text-brand-700 dark:text-brand-400 font-mono">{UGX(bsQuery.data.total_liabilities_and_equity)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 text-ink-400">Failed to render Balance Sheet</div>
            )}
          </div>
        )}

        {/* CASH FLOW TAB */}
        {statementType === 'cash-flow' && (
          <div className="p-8">
            <h2 className="text-lg font-bold text-center text-slate-900 dark:text-slate-100 mb-6 uppercase tracking-wider no-print">
              Statement of Cash Flows (Direct Method)
            </h2>
            {cfQuery.isLoading ? (
              <div className="flex justify-center p-16">
                <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
              </div>
            ) : cfQuery.data ? (
              <div className="max-w-3xl mx-auto space-y-6">
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="bg-slate-50 dark:bg-slate-850 font-bold border-b border-slate-200 dark:border-slate-800">
                      <td className="p-3 text-slate-800 dark:text-slate-200 uppercase tracking-wider">Operating Activities</td>
                      <td className="p-3 text-right text-slate-800 dark:text-slate-200 uppercase tracking-wider w-36">Amount (UGX)</td>
                    </tr>
                    {cfQuery.data.operating.map((o: any) => (
                      <tr key={o.category} className="border-b border-slate-100 dark:border-slate-850/50 hover:bg-slate-50/25 font-mono">
                        <td className="p-2.5 pl-6 text-slate-700 dark:text-slate-300 font-sans">{o.category}</td>
                        <td className="p-2.5 text-right text-slate-900 dark:text-slate-100">{UGX(o.amount)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold border-t border-slate-350 dark:border-slate-650 bg-slate-50/50">
                      <td className="p-3 pl-6 text-slate-800 dark:text-slate-200">Net Cash from Operating Activities</td>
                      <td className="p-3 text-right text-slate-900 dark:text-slate-100 font-mono">{UGX(cfQuery.data.total_operating)}</td>
                    </tr>

                    <tr><td colSpan={2} className="h-6"></td></tr>
                    <tr className="bg-slate-50 dark:bg-slate-850 font-bold border-b border-slate-200 dark:border-slate-800">
                      <td className="p-3 text-slate-800 dark:text-slate-200 uppercase tracking-wider">Investing Activities</td>
                      <td className="p-3 text-right text-slate-800 dark:text-slate-200 uppercase tracking-wider w-36">Amount (UGX)</td>
                    </tr>
                    {cfQuery.data.investing.map((i: any) => (
                      <tr key={i.category} className="border-b border-slate-100 dark:border-slate-850/50 hover:bg-slate-50/25 font-mono">
                        <td className="p-2.5 pl-6 text-slate-700 dark:text-slate-300 font-sans">{i.category}</td>
                        <td className="p-2.5 text-right text-slate-900 dark:text-slate-100">{UGX(i.amount)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold border-t border-slate-350 dark:border-slate-650 bg-slate-50/50">
                      <td className="p-3 pl-6 text-slate-800 dark:text-slate-200">Net Cash from Investing Activities</td>
                      <td className="p-3 text-right text-slate-900 dark:text-slate-100 font-mono">{UGX(cfQuery.data.total_investing)}</td>
                    </tr>

                    <tr><td colSpan={2} className="h-6"></td></tr>
                    <tr className="bg-slate-50 dark:bg-slate-850 font-bold border-b border-slate-200 dark:border-slate-800">
                      <td className="p-3 text-slate-800 dark:text-slate-200 uppercase tracking-wider">Financing Activities</td>
                      <td className="p-3 text-right text-slate-800 dark:text-slate-200 uppercase tracking-wider w-36">Amount (UGX)</td>
                    </tr>
                    {cfQuery.data.financing.map((f: any) => (
                      <tr key={f.category} className="border-b border-slate-100 dark:border-slate-850/50 hover:bg-slate-50/25 font-mono">
                        <td className="p-2.5 pl-6 text-slate-700 dark:text-slate-300 font-sans">{f.category}</td>
                        <td className="p-2.5 text-right text-slate-900 dark:text-slate-100">{UGX(f.amount)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold border-t border-slate-350 dark:border-slate-650 bg-slate-50/50">
                      <td className="p-3 pl-6 text-slate-800 dark:text-slate-200">Net Cash from Financing Activities</td>
                      <td className="p-3 text-right text-slate-900 dark:text-slate-100 font-mono">{UGX(cfQuery.data.total_financing)}</td>
                    </tr>

                    <tr><td colSpan={2} className="h-8"></td></tr>
                    <tr className="font-bold text-sm border-double border-t-4 border-b-4 border-slate-950 dark:border-slate-200/80 bg-slate-50 p-4">
                      <td className="p-4 text-base uppercase tracking-wider text-slate-900 dark:text-slate-100">Net Increase (Decrease) in Cash</td>
                      <td className="p-4 text-right text-base text-brand-700 dark:text-brand-400 font-mono">
                        {UGX(cfQuery.data.net_cash_flow)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center p-8 text-ink-400">Failed to render Cash Flow statement</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
