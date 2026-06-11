import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { financeReportsService } from '@/services/financeReportsService'
import { FileText, Loader2, RefreshCcw } from 'lucide-react'

export function FinancialStatementsPage() {
  const [statementType, setStatementType] = useState<'pnl' | 'balance-sheet' | 'cash-flow'>('pnl')
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10))

  const pnlQuery = useQuery({
    queryKey: ['pnl', fromDate, toDate],
    queryFn: () => financeReportsService.getProfitAndLoss({ from_date: fromDate, to_date: toDate }),
    enabled: statementType === 'pnl',
  })

  const bsQuery = useQuery({
    queryKey: ['balance-sheet', asOfDate],
    queryFn: () => financeReportsService.getBalanceSheet({ as_of_date: asOfDate }),
    enabled: statementType === 'balance-sheet',
  })

  const cfQuery = useQuery({
    queryKey: ['cash-flow', fromDate, toDate],
    queryFn: () => financeReportsService.getCashFlow({ from_date: fromDate, to_date: toDate }),
    enabled: statementType === 'cash-flow',
  })

  return (
    <div className="animate-fade-in space-y-5 pb-10">
      <div className="section-header">
        <div>
          <h1 className="section-title">Financial Statements</h1>
          <p className="section-subtitle">Core financial reports for enterprise performance analysis.</p>
        </div>
      </div>

      <div className="card p-1">
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${statementType === 'pnl' ? 'bg-white dark:bg-slate-700 shadow-sm text-ink-900' : 'text-ink-500 hover:text-ink-700'}`}
            onClick={() => setStatementType('pnl')}
          >
            Profit & Loss
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${statementType === 'balance-sheet' ? 'bg-white dark:bg-slate-700 shadow-sm text-ink-900' : 'text-ink-500 hover:text-ink-700'}`}
            onClick={() => setStatementType('balance-sheet')}
          >
            Balance Sheet
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${statementType === 'cash-flow' ? 'bg-white dark:bg-slate-700 shadow-sm text-ink-900' : 'text-ink-500 hover:text-ink-700'}`}
            onClick={() => setStatementType('cash-flow')}
          >
            Cash Flow
          </button>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-end gap-4">
          {statementType === 'balance-sheet' ? (
            <div>
              <label className="form-label">As of Date</label>
              <input type="date" className="form-input" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} />
            </div>
          ) : (
            <>
              <div>
                <label className="form-label">From Date</label>
                <input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div>
                <label className="form-label">To Date</label>
                <input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            </>
          )}
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => statementType === 'pnl' ? pnlQuery.refetch() : statementType === 'balance-sheet' ? bsQuery.refetch() : cfQuery.refetch()}
          >
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="card overflow-hidden bg-white dark:bg-slate-900 min-h-[500px]">
        {statementType === 'pnl' && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-center text-ink-900 mb-6">Statement of Comprehensive Income (P&L)</h2>
            {pnlQuery.isLoading ? (
              <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-ink-400" /></div>
            ) : pnlQuery.data ? (
              <div className="max-w-3xl mx-auto">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="bg-slate-50 dark:bg-slate-800"><td colSpan={2} className="p-2 font-bold text-ink-900">Revenue</td></tr>
                    {pnlQuery.data.revenue.map(r => (
                      <tr key={r.account_code} className="border-b border-slate-100 dark:border-slate-800/50">
                        <td className="p-2 pl-6 text-ink-700">{r.account_name}</td>
                        <td className="p-2 text-right text-ink-900">{r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="p-2 font-semibold text-ink-800 pl-6">Total Revenue</td>
                      <td className="p-2 text-right font-semibold text-ink-900 border-t border-slate-300 dark:border-slate-600">{pnlQuery.data.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>

                    <tr><td colSpan={2} className="h-4"></td></tr>
                    <tr className="bg-slate-50 dark:bg-slate-800"><td colSpan={2} className="p-2 font-bold text-ink-900">Cost of Sales</td></tr>
                    {pnlQuery.data.cost_of_sales.map(c => (
                      <tr key={c.account_code} className="border-b border-slate-100 dark:border-slate-800/50">
                        <td className="p-2 pl-6 text-ink-700">{c.account_name}</td>
                        <td className="p-2 text-right text-ink-900">{c.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="p-2 font-semibold text-ink-800 pl-6">Total Cost of Sales</td>
                      <td className="p-2 text-right font-semibold text-ink-900 border-t border-slate-300 dark:border-slate-600">{pnlQuery.data.total_cost_of_sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>

                    <tr><td colSpan={2} className="h-4"></td></tr>
                    <tr className="bg-slate-100 dark:bg-slate-800/80">
                      <td className="p-3 font-bold text-ink-900 text-base">Gross Profit</td>
                      <td className="p-3 text-right font-bold text-ink-900 text-base">{pnlQuery.data.gross_profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>

                    <tr><td colSpan={2} className="h-6"></td></tr>
                    <tr className="bg-slate-50 dark:bg-slate-800"><td colSpan={2} className="p-2 font-bold text-ink-900">Operating Expenses</td></tr>
                    {pnlQuery.data.expenses.map(e => (
                      <tr key={e.account_code} className="border-b border-slate-100 dark:border-slate-800/50">
                        <td className="p-2 pl-6 text-ink-700">{e.account_name}</td>
                        <td className="p-2 text-right text-ink-900">{e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="p-2 font-semibold text-ink-800 pl-6">Total Expenses</td>
                      <td className="p-2 text-right font-semibold text-ink-900 border-t border-slate-300 dark:border-slate-600">{pnlQuery.data.total_expenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>

                    <tr><td colSpan={2} className="h-6"></td></tr>
                    <tr className={`${pnlQuery.data.net_profit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-100' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-900 dark:text-rose-100'}`}>
                      <td className="p-4 font-bold text-lg">Net {pnlQuery.data.net_profit >= 0 ? 'Profit' : 'Loss'}</td>
                      <td className="p-4 text-right font-bold text-lg border-double border-t-4 border-b-4 border-current">
                        {pnlQuery.data.net_profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}

        {statementType === 'balance-sheet' && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-center text-ink-900 mb-6">Statement of Financial Position (Balance Sheet)</h2>
            {bsQuery.isLoading ? (
              <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-ink-400" /></div>
            ) : bsQuery.data ? (
              <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* ASSETS */}
                <div>
                  <h3 className="text-lg font-bold text-ink-900 border-b-2 border-slate-800 dark:border-slate-200 pb-2 mb-4">Assets</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {bsQuery.data.assets.map(a => (
                        <tr key={a.account_code} className="border-b border-slate-100 dark:border-slate-800/50">
                          <td className="p-2 text-ink-700">{a.account_name}</td>
                          <td className="p-2 text-right text-ink-900">{a.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                      <tr><td colSpan={2} className="h-4"></td></tr>
                      <tr>
                        <td className="p-2 font-bold text-ink-900">Total Assets</td>
                        <td className="p-2 text-right font-bold text-ink-900 border-t-2 border-slate-300 dark:border-slate-600">{bsQuery.data.total_assets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* LIABILITIES & EQUITY */}
                <div>
                  <h3 className="text-lg font-bold text-ink-900 border-b-2 border-slate-800 dark:border-slate-200 pb-2 mb-4">Liabilities & Equity</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="bg-slate-50 dark:bg-slate-800"><td colSpan={2} className="p-2 font-bold text-ink-900">Liabilities</td></tr>
                      {bsQuery.data.liabilities.map(l => (
                        <tr key={l.account_code} className="border-b border-slate-100 dark:border-slate-800/50">
                          <td className="p-2 pl-4 text-ink-700">{l.account_name}</td>
                          <td className="p-2 text-right text-ink-900">{l.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                      <tr>
                        <td className="p-2 font-semibold text-ink-800 pl-4">Total Liabilities</td>
                        <td className="p-2 text-right font-semibold text-ink-900 border-t border-slate-300 dark:border-slate-600">{bsQuery.data.total_liabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>

                      <tr><td colSpan={2} className="h-4"></td></tr>
                      <tr className="bg-slate-50 dark:bg-slate-800"><td colSpan={2} className="p-2 font-bold text-ink-900">Equity</td></tr>
                      {bsQuery.data.equity.map(e => (
                        <tr key={e.account_code} className="border-b border-slate-100 dark:border-slate-800/50">
                          <td className="p-2 pl-4 text-ink-700">{e.account_name}</td>
                          <td className="p-2 text-right text-ink-900">{e.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                      <tr>
                        <td className="p-2 font-semibold text-ink-800 pl-4">Total Equity</td>
                        <td className="p-2 text-right font-semibold text-ink-900 border-t border-slate-300 dark:border-slate-600">{bsQuery.data.total_equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>

                      <tr><td colSpan={2} className="h-8"></td></tr>
                      <tr>
                        <td className="p-2 font-bold text-ink-900">Total Liabilities & Equity</td>
                        <td className="p-2 text-right font-bold text-ink-900 border-t-2 border-slate-300 dark:border-slate-600">{bsQuery.data.total_liabilities_and_equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                  
                  {!bsQuery.data.is_balanced && (
                    <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
                      <strong>Imbalance Detected:</strong> Assets do not equal Liabilities + Equity. Check trial balance.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {statementType === 'cash-flow' && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-center text-ink-900 mb-6">Statement of Cash Flows</h2>
            {cfQuery.isLoading ? (
              <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-ink-400" /></div>
            ) : cfQuery.data ? (
              <div className="max-w-3xl mx-auto">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="bg-slate-50 dark:bg-slate-800"><td colSpan={2} className="p-2 font-bold text-ink-900">Operating Activities</td></tr>
                    {cfQuery.data.operating.map(o => (
                      <tr key={o.category} className="border-b border-slate-100 dark:border-slate-800/50">
                        <td className="p-2 pl-6 text-ink-700">{o.category}</td>
                        <td className="p-2 text-right text-ink-900">{o.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="p-2 font-semibold text-ink-800 pl-6">Net Cash from Operating Activities</td>
                      <td className="p-2 text-right font-semibold text-ink-900 border-t border-slate-300 dark:border-slate-600">{cfQuery.data.total_operating.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>

                    <tr><td colSpan={2} className="h-4"></td></tr>
                    <tr className="bg-slate-50 dark:bg-slate-800"><td colSpan={2} className="p-2 font-bold text-ink-900">Investing Activities</td></tr>
                    {cfQuery.data.investing.map(i => (
                      <tr key={i.category} className="border-b border-slate-100 dark:border-slate-800/50">
                        <td className="p-2 pl-6 text-ink-700">{i.category}</td>
                        <td className="p-2 text-right text-ink-900">{i.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="p-2 font-semibold text-ink-800 pl-6">Net Cash from Investing Activities</td>
                      <td className="p-2 text-right font-semibold text-ink-900 border-t border-slate-300 dark:border-slate-600">{cfQuery.data.total_investing.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>

                    <tr><td colSpan={2} className="h-4"></td></tr>
                    <tr className="bg-slate-50 dark:bg-slate-800"><td colSpan={2} className="p-2 font-bold text-ink-900">Financing Activities</td></tr>
                    {cfQuery.data.financing.map(f => (
                      <tr key={f.category} className="border-b border-slate-100 dark:border-slate-800/50">
                        <td className="p-2 pl-6 text-ink-700">{f.category}</td>
                        <td className="p-2 text-right text-ink-900">{f.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="p-2 font-semibold text-ink-800 pl-6">Net Cash from Financing Activities</td>
                      <td className="p-2 text-right font-semibold text-ink-900 border-t border-slate-300 dark:border-slate-600">{cfQuery.data.total_financing.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>

                    <tr><td colSpan={2} className="h-6"></td></tr>
                    <tr className="bg-slate-100 dark:bg-slate-800/80">
                      <td className="p-4 font-bold text-lg text-ink-900">Net Increase (Decrease) in Cash</td>
                      <td className="p-4 text-right font-bold text-lg text-ink-900 border-double border-t-4 border-b-4 border-current">
                        {cfQuery.data.net_cash_flow.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
