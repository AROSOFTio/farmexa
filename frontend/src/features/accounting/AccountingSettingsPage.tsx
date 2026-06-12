import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, PlayCircle, Lock, Key, Calendar, Scale, Save, Search, Settings } from 'lucide-react'
import { toast } from 'sonner'
import clsx from 'clsx'
import { accountingService, FiscalYear, Account } from '@/services/accountingService'
import { UGX } from '@/lib/money'

interface OpeningBalanceValues {
  opening_debit: number
  opening_credit: number
  notes: string
}

export function AccountingSettingsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'general' | 'opening-balances'>('general')
  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState<number | ''>('')
  
  // Search query for opening balances
  const [searchQuery, setSearchQuery] = useState('')

  // Opening balances state mapping: account_id -> OpeningBalanceValues
  const [formBalances, setFormBalances] = useState<Record<number, OpeningBalanceValues>>({})

  // Close-year confirmation dialog
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const [yearToClose, setYearToClose] = useState<FiscalYear | null>(null)

  // Fetch fiscal years
  const { data: fiscalYears = [], isLoading: isLoadingFY } = useQuery({
    queryKey: ['accounting-fiscal-years'],
    queryFn: () => accountingService.getFiscalYears(),
  })

  // Fetch chart of accounts
  const { data: accounts = [], isLoading: isLoadingCoa } = useQuery({
    queryKey: ['accounting-coa-flat-settings'],
    queryFn: () => accountingService.getCoaFlat()
  })

  // Fetch existing opening balances
  const { data: dbOpeningBalances = [], isLoading: isLoadingOB } = useQuery({
    queryKey: ['accounting-opening-balances'],
    queryFn: () => accountingService.getOpeningBalances(),
  })

  // Populate local form state when fiscal year or DB balances change
  React.useEffect(() => {
    if (!selectedFiscalYearId || !dbOpeningBalances.length) {
      setFormBalances({})
      return
    }

    const initialBalances: Record<number, OpeningBalanceValues> = {}
    dbOpeningBalances.forEach((ob: any) => {
      if (ob.fiscal_year_id === selectedFiscalYearId) {
        initialBalances[ob.account_id] = {
          opening_debit: Number(ob.opening_debit) || 0,
          opening_credit: Number(ob.opening_credit) || 0,
          notes: ob.notes || ''
        }
      }
    })
    setFormBalances(initialBalances)
  }, [selectedFiscalYearId, dbOpeningBalances])

  // Select first open fiscal year by default if possible
  React.useEffect(() => {
    if (fiscalYears.length > 0 && selectedFiscalYearId === '') {
      const openYear = fiscalYears.find(y => y.status === 'open')
      if (openYear) {
        setSelectedFiscalYearId(openYear.id)
      } else {
        setSelectedFiscalYearId(fiscalYears[0].id)
      }
    }
  }, [fiscalYears, selectedFiscalYearId])

  // Mutations
  const initializeMutation = useMutation({
    mutationFn: () => accountingService.initializeTenant(),
    onSuccess: () => {
      toast.success('Accounting system initialized successfully')
      queryClient.invalidateQueries({ queryKey: ['accounting-fiscal-years'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-coa-flat-settings'] })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to initialize accounting')
    }
  })

  const closeYearMutation = useMutation({
    mutationFn: (id: number) => accountingService.closeFiscalYear(id),
    onSuccess: () => {
      toast.success('Fiscal year closed successfully')
      queryClient.invalidateQueries({ queryKey: ['accounting-fiscal-years'] })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to close fiscal year')
    }
  })

  const saveOpeningBalancesMutation = useMutation({
    mutationFn: (payload: any) => accountingService.setOpeningBalances(payload),
    onSuccess: () => {
      toast.success('Opening balances saved successfully')
      queryClient.invalidateQueries({ queryKey: ['accounting-opening-balances'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-coa-flat-settings'] })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to save opening balances')
    }
  })

  // Filter accounts for opening balances tab
  const filteredAccounts = useMemo(() => {
    return accounts.filter(a => 
      a.is_active && a.allow_manual_entries && (
        a.account_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    )
  }, [accounts, searchQuery])

  // Group filtered accounts by account type
  const accountsByType = useMemo(() => {
    const grouped: Record<string, Account[]> = {
      asset: [],
      liability: [],
      equity: [],
      revenue: [],
      cost_of_sales: [],
      expense: []
    }
    filteredAccounts.forEach(a => {
      if (grouped[a.account_type]) {
        grouped[a.account_type].push(a)
      }
    })
    return grouped
  }, [filteredAccounts])

  // Calculate Running totals of form input balances
  const { totalDebits, totalCredits, balanced } = useMemo(() => {
    let debits = 0
    let credits = 0
    
    // We sum entries for postable manual accounts
    accounts.forEach(a => {
      if (a.is_active && a.allow_manual_entries) {
        const val = formBalances[a.id]
        if (val) {
          debits += val.opening_debit || 0
          credits += val.opening_credit || 0
        }
      }
    })

    return {
      totalDebits: debits,
      totalCredits: credits,
      balanced: Math.abs(debits - credits) < 0.01
    }
  }, [formBalances, accounts])

  const handleInputChange = (accountId: number, field: 'debit' | 'credit' | 'notes', val: string | number) => {
    setFormBalances(prev => {
      const existing = prev[accountId] || { opening_debit: 0, opening_credit: 0, notes: '' }
      
      let updated = { ...existing }
      if (field === 'debit') {
        updated.opening_debit = Math.max(0, Number(val) || 0)
      } else if (field === 'credit') {
        updated.opening_credit = Math.max(0, Number(val) || 0)
      } else if (field === 'notes') {
        updated.notes = String(val)
      }

      return {
        ...prev,
        [accountId]: updated
      }
    })
  }

  const handleSaveOpeningBalances = () => {
    if (!selectedFiscalYearId) {
      toast.error('Please select a fiscal year first')
      return
    }

    // Prepare array of non-zero entries
    const entriesPayload: any[] = []
    accounts.forEach(a => {
      const balance = formBalances[a.id]
      if (balance) {
        if (balance.opening_debit > 0 || balance.opening_credit > 0) {
          entriesPayload.push({
            account_id: a.id,
            opening_debit: balance.opening_debit,
            opening_credit: balance.opening_credit,
            notes: balance.notes || 'Opening balance batch update'
          })
        }
      }
    })

    if (entriesPayload.length === 0) {
      toast.error('No non-zero opening balances entered')
      return
    }

    saveOpeningBalancesMutation.mutate({
      fiscal_year_id: selectedFiscalYearId,
      entries: entriesPayload
    })
  }

  if (isLoadingFY || isLoadingCoa || isLoadingOB) {
    return <div className="p-6 text-ink-500">Loading settings configuration...</div>
  }

  const hasFiscalYears = fiscalYears.length > 0
  const activeYearName = fiscalYears.find(y => y.id === selectedFiscalYearId)?.name || 'Selected Year'

  return (
    <div className="animate-fade-in space-y-5 pb-10">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="section-title">Accounting Settings</h1>
          <p className="section-subtitle">Manage fiscal periods and configure opening balances.</p>
        </div>
      </div>

      {/* Tabs */}
      {hasFiscalYears && (
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1 max-w-md">
          <button
            onClick={() => setActiveTab('general')}
            className={clsx(
              "flex-1 py-1.5 text-xs font-bold rounded-md transition-all",
              activeTab === 'general' ? "bg-white dark:bg-slate-700 shadow-sm text-brand-700" : "text-ink-500 hover:text-ink-700"
            )}
          >
            General & Fiscal Years
          </button>
          <button
            onClick={() => setActiveTab('opening-balances')}
            className={clsx(
              "flex-1 py-1.5 text-xs font-bold rounded-md transition-all",
              activeTab === 'opening-balances' ? "bg-white dark:bg-slate-700 shadow-sm text-brand-700" : "text-ink-500 hover:text-ink-700"
            )}
          >
            Opening Balances
          </button>
        </div>
      )}

      {/* Tab: General Settings / Initialization */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {!hasFiscalYears ? (
            <div className="card p-8 text-center border-brand-200 bg-brand-50/10">
              <PlayCircle className="h-12 w-12 text-brand-600 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-ink-950 mb-2">Initialize Enterprise Accounting</h2>
              <p className="text-xs text-ink-500 max-w-md mx-auto mb-6">
                Your workspace is not yet configured for Enterprise Accounting. 
                Initialize to automatically load the standard Poultry Chart of Accounts and create your first Fiscal Year.
              </p>
              <button
                onClick={() => {
                  if (window.confirm('This will load the default Enterprise Chart of Accounts. Continue?')) {
                    initializeMutation.mutate()
                  }
                }}
                disabled={initializeMutation.isPending}
                className="btn-primary mx-auto text-xs py-2 px-4"
              >
                {initializeMutation.isPending ? 'Initializing...' : 'Initialize Accounting Now'}
              </button>
            </div>
          ) : (
            <div className="card overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-5">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">Fiscal Periods</h2>
                <p className="text-xs text-slate-500 mt-1">Review, create, and close accounting fiscal years.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800">
                      <th className="pl-6 font-bold text-slate-750 dark:text-slate-350">Period Name</th>
                      <th className="font-bold text-slate-750 dark:text-slate-350">Start Date</th>
                      <th className="font-bold text-slate-750 dark:text-slate-350">End Date</th>
                      <th className="font-bold text-slate-750 dark:text-slate-350">Status</th>
                      <th className="pr-6 text-right font-bold text-slate-750 dark:text-slate-350">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {fiscalYears.map((year) => (
                      <tr key={year.id} className="hover:bg-slate-50/25">
                        <td className="pl-6 font-bold text-slate-900 dark:text-slate-100 font-sans">{year.name}</td>
                        <td className="font-mono">{formatDate(year.start_date)}</td>
                        <td className="font-mono">{formatDate(year.end_date)}</td>
                        <td>
                          <span
                            className={clsx(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border',
                              year.status === 'open' 
                                ? 'bg-green-50 text-green-700 border-green-200' 
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            )}
                          >
                            {year.status}
                          </span>
                        </td>
                        <td className="pr-6 text-right">
                          {year.status === 'open' && (
                            <button
                              onClick={() => {
                                setYearToClose(year)
                                setCloseConfirmOpen(true)
                              }}
                              className="text-red-650 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 px-2.5 py-1.5 border border-red-200 rounded font-semibold text-xs inline-flex items-center gap-1"
                              disabled={closeYearMutation.isPending}
                            >
                              <Lock className="h-3.5 w-3.5" /> Close Fiscal Year
                            </button>
                          )}
                          {year.status === 'closed' && (
                            <span className="text-slate-400 text-xs inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Closed on {formatDate(year.closed_at || '')}
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
      )}

      {/* Tab: Opening Balances */}
      {activeTab === 'opening-balances' && (
        <div className="space-y-5">
          {/* Header configuration */}
          <div className="card p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="form-label text-xs font-bold text-slate-400 uppercase">Select Fiscal Year</label>
              <select
                className="form-input text-xs mt-1 w-full"
                value={selectedFiscalYearId}
                onChange={e => setSelectedFiscalYearId(e.target.value ? Number(e.target.value) : '')}
              >
                {fiscalYears.map(fy => (
                  <option key={fy.id} value={fy.id}>{fy.name} ({fy.status})</option>
                ))}
              </select>
            </div>
            
            <div className="md:col-span-2">
              <label className="form-label text-xs font-bold text-slate-400 uppercase">Search Accounts</label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  className="form-input pl-9 text-xs py-2 w-full"
                  placeholder="Filter accounts by code or name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={handleSaveOpeningBalances}
              disabled={saveOpeningBalancesMutation.isPending || !selectedFiscalYearId || !balanced}
              className="btn-primary text-xs py-2.5 w-full flex items-center justify-center gap-1.5"
            >
              <Save className="h-4 w-4" /> Save Balances
            </button>
          </div>

          {/* Running Balance Difference Panel */}
          <div className={clsx(
            "card p-4 border flex items-center justify-between text-xs transition-all",
            balanced 
              ? "bg-green-50/50 border-green-200 text-green-800 dark:bg-green-950/10 dark:border-green-800 dark:text-green-300"
              : "bg-red-50/50 border-red-200 text-red-800 dark:bg-red-950/10 dark:border-red-850 dark:text-red-300"
          )}>
            <div className="flex items-center gap-2 font-medium">
              <Scale className="h-4 w-4" />
              {balanced ? (
                <span>Opening debits equal opening credits. Opening balances are balanced.</span>
              ) : (
                <span>
                  Trial balance offset error: Total Debits must equal Total Credits. Offset:{" "}
                  <strong>{UGX(Math.abs(totalDebits - totalCredits))}</strong>
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs font-mono font-bold">
              <span>Dr: {UGX(totalDebits)}</span>
              <span>Cr: {UGX(totalCredits)}</span>
              <span className={clsx("badge px-2 py-0.5 rounded text-[10px]", balanced ? "bg-green-600 text-white" : "bg-red-600 text-white")}>
                {balanced ? "Balanced" : "Offset"}
              </span>
            </div>
          </div>

          {/* Grouped Accounts Form */}
          <div className="space-y-6">
            {Object.keys(accountsByType).map(type => {
              const list = accountsByType[type]
              if (list.length === 0) return null

              return (
                <div key={type} className="card overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="bg-slate-50 dark:bg-slate-850 px-4 py-2 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wide">
                      {type.replace('_', ' ')} Accounts
                    </h3>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/50 border-b border-slate-200">
                          <th className="px-4 py-2 font-bold text-slate-550 w-28">Code</th>
                          <th className="px-4 py-2 font-bold text-slate-550">Account Name</th>
                          <th className="px-4 py-2 font-bold text-slate-550 w-44 text-right">Opening Debit (UGX)</th>
                          <th className="px-4 py-2 font-bold text-slate-550 w-44 text-right">Opening Credit (UGX)</th>
                          <th className="px-4 py-2 font-bold text-slate-550 pr-4">Memo Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {list.map(account => {
                          const stateVal = formBalances[account.id] || { opening_debit: 0, opening_credit: 0, notes: '' }
                          return (
                            <tr key={account.id} className="hover:bg-slate-50/25">
                              <td className="px-4 py-2 font-mono font-bold text-slate-900">{account.account_code}</td>
                              <td className="px-4 py-2 font-semibold text-slate-800">{account.name}</td>
                              
                              {/* Debit Input */}
                              <td className="px-4 py-1.5 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="form-input py-1 px-2 text-xs text-right font-mono w-full"
                                  value={stateVal.opening_debit || ''}
                                  placeholder="0.00"
                                  onChange={e => handleInputChange(account.id, 'debit', e.target.value)}
                                />
                              </td>

                              {/* Credit Input */}
                              <td className="px-4 py-1.5 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="form-input py-1 px-2 text-xs text-right font-mono w-full"
                                  value={stateVal.opening_credit || ''}
                                  placeholder="0.00"
                                  onChange={e => handleInputChange(account.id, 'credit', e.target.value)}
                                />
                              </td>

                              {/* Notes Input */}
                              <td className="px-4 py-1.5 pr-4">
                                <input
                                  type="text"
                                  className="form-input py-1 px-2 text-xs w-full"
                                  placeholder="e.g. Audit balance load"
                                  value={stateVal.notes || ''}
                                  onChange={e => handleInputChange(account.id, 'notes', e.target.value)}
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Close fiscal year confirmation */}
      {closeConfirmOpen && yearToClose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-[var(--border-subtle)] p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-ink-900">Close Fiscal Year</h3>
                <p className="text-sm text-ink-500">{yearToClose.name}</p>
              </div>
            </div>
            <div className="space-y-3 mb-6">
              <p className="text-sm text-ink-700">This will:</p>
              <ul className="text-sm text-ink-600 space-y-1.5 list-none">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  Post a closing journal entry transferring net income to Retained Earnings
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  Lock all journal entries in this period (no new postings)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  This action cannot be undone
                </li>
              </ul>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Ensure all transactions for this period are posted before closing.
                  Draft journal entries will block the close.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 btn-secondary"
                onClick={() => { setCloseConfirmOpen(false); setYearToClose(null) }}
              >Cancel</button>
              <button
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-[10px] border border-transparent bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={closeYearMutation.isPending}
                onClick={() => {
                  closeYearMutation.mutate(yearToClose.id, {
                    onSuccess: () => { setCloseConfirmOpen(false); setYearToClose(null) }
                  })
                }}
              >
                {closeYearMutation.isPending ? 'Closing...' : 'Close Year'}
              </button>
            </div>
          </div>
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
