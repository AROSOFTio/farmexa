import React, { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { 
  Plus, CheckCircle2, FileText, Ban, Trash2, Search, ArrowRight, 
  Printer, AlertCircle, X, ChevronDown, RefreshCw, CalendarDays, 
  User, Layers, MapPin, BadgePercent, Check, Undo2
} from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'
import clsx from 'clsx'
import { accountingService, JournalEntry, JournalLine, Account } from '@/services/accountingService'
import { branchService, Branch } from '@/services/branchService'
import { UGX } from '@/lib/money'

interface Batch {
  id: number
  batch_number: string
  breed: string
  status: string
}

// Zod schema for validation
const journalLineSchema = z.object({
  account_id: z.coerce.number().int().positive('Account is required'),
  memo: z.string().optional().nullable(),
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
  branch_id: z.coerce.number().optional().nullable(),
  batch_id: z.coerce.number().optional().nullable(),
}).refine(data => data.debit > 0 || data.credit > 0, {
  message: 'Must have either debit or credit',
  path: ['debit']
}).refine(data => !(data.debit > 0 && data.credit > 0), {
  message: 'Cannot have both on the same line',
  path: ['credit']
})

const journalEntrySchema = z.object({
  entry_date: z.string().min(1, 'Date is required'),
  description: z.string().min(3, 'Description must be at least 3 characters'),
  notes: z.string().optional().nullable(),
  lines: z.array(journalLineSchema).min(2, 'At least two lines are required')
}).refine(data => {
  const totalDebits = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0)
  const totalCredits = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0)
  return Math.abs(totalDebits - totalCredits) < 0.01
}, {
  message: 'Total debits must equal total credits',
  path: ['lines']
})

type JournalEntryFormValues = z.infer<typeof journalEntrySchema>

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value: string) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Custom Searchable Autocomplete Dropdown for GL Accounts
interface AccountSearchSelectProps {
  accounts: Account[]
  value: number
  onChange: (id: number) => void
  error?: string
}

function AccountSearchSelect({ accounts, value, onChange, error }: AccountSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedAccount = useMemo(() => {
    return accounts.find(a => a.id === value)
  }, [accounts, value])

  const filteredAccounts = useMemo(() => {
    return accounts.filter(a => 
      a.allow_manual_entries && a.is_active && (
        a.account_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }, [accounts, searchTerm])

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative w-full" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "w-full flex items-center justify-between form-input py-1.5 px-3 text-xs cursor-pointer bg-white dark:bg-slate-900 border",
          error ? "border-red-350" : "border-slate-200 dark:border-slate-800"
        )}
      >
        <span className={clsx("truncate font-mono", selectedAccount ? "text-ink-950 font-medium" : "text-ink-400")}>
          {selectedAccount ? `${selectedAccount.account_code} - ${selectedAccount.name}` : "Select Account..."}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-400 flex-shrink-0 ml-1" />
      </div>
      
      {isOpen && (
        <div className="absolute left-0 mt-1 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
            <input
              type="text"
              className="w-full form-input py-1 px-2 text-xs"
              placeholder="Search code or name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onClick={e => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="p-1">
            {filteredAccounts.length === 0 ? (
              <div className="p-2 text-xs text-ink-400 text-center">No postable accounts found</div>
            ) : (
              filteredAccounts.map(a => (
                <div
                  key={a.id}
                  onClick={() => {
                    onChange(a.id)
                    setIsOpen(false)
                    setSearchTerm('')
                  }}
                  className={clsx(
                    "p-2 text-xs rounded cursor-pointer flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800",
                    a.id === value && "bg-brand-50 dark:bg-brand-900/30 text-brand-700 font-semibold"
                  )}
                >
                  <span className="font-mono">{a.account_code} - {a.name}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 ml-2">{a.account_type}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-0.5 text-[10px] text-red-500">{error}</p>}
    </div>
  )
}

export function JournalsPage() {
  const queryClient = useQueryClient()
  const printAreaRef = useRef<HTMLDivElement>(null)

  // Selection states
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isReversalModalOpen, setIsReversalModalOpen] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Reversal Form States
  const [reversalDate, setReversalDate] = useState(todayValue())
  const [reversalReason, setReversalReason] = useState('')

  // Fetch journal entries
  const { data: entries = [], isLoading: isLoadingEntries } = useQuery({
    queryKey: ['accounting-journals', statusFilter, fromDate, toDate],
    queryFn: () => {
      const params: Record<string, any> = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      return accountingService.getJournals(params)
    }
  })

  // Fetch chart of accounts
  const { data: accounts = [] } = useQuery({
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

  // Get selected entry details
  const { data: selectedEntry = null, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['accounting-journal-detail', selectedId],
    queryFn: () => selectedId ? accountingService.getJournal(selectedId) : Promise.resolve(null),
    enabled: !!selectedId
  })

  // Form setup
  const form = useForm<JournalEntryFormValues>({
    resolver: zodResolver(journalEntrySchema),
    defaultValues: {
      entry_date: todayValue(),
      description: '',
      notes: '',
      lines: [
        { account_id: 0, debit: 0, credit: 0, memo: '', branch_id: null, batch_id: null },
        { account_id: 0, debit: 0, credit: 0, memo: '', branch_id: null, batch_id: null }
      ]
    }
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines'
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (values: JournalEntryFormValues) => accountingService.createJournal(values),
    onSuccess: (newEntry) => {
      toast.success('Journal draft created successfully')
      queryClient.invalidateQueries({ queryKey: ['accounting-journals'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-coa'] })
      setIsCreating(false)
      setSelectedId(newEntry.id)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to create journal entry')
    }
  })

  const postMutation = useMutation({
    mutationFn: (id: number) => accountingService.postJournal(id),
    onSuccess: (updatedEntry) => {
      toast.success('Journal entry posted successfully to GL')
      queryClient.invalidateQueries({ queryKey: ['accounting-journals'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-journal-detail', updatedEntry.id] })
      queryClient.invalidateQueries({ queryKey: ['accounting-coa'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to post journal entry')
    }
  })

  const reverseMutation = useMutation({
    mutationFn: ({ id, date, reason }: { id: number, date: string, reason: string }) => 
      accountingService.reverseJournal(id, date, reason),
    onSuccess: (reversedEntry) => {
      toast.success('Journal entry reversed successfully')
      setIsReversalModalOpen(false)
      setReversalReason('')
      queryClient.invalidateQueries({ queryKey: ['accounting-journals'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-journal-detail', selectedId] })
      queryClient.invalidateQueries({ queryKey: ['accounting-coa'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to reverse journal entry')
    }
  })

  // Filter entries locally by search string
  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return entries
    return entries.filter(e => 
      e.entry_number.toLowerCase().includes(query) ||
      (e.description && e.description.toLowerCase().includes(query)) ||
      (e.notes && e.notes.toLowerCase().includes(query))
    )
  }, [entries, search])

  // Watch for totals and balance
  const watchLines = form.watch('lines')
  const totalDebits = useMemo(() => {
    return (watchLines || []).reduce((sum, line) => sum + (Number(line?.debit) || 0), 0)
  }, [watchLines])

  const totalCredits = useMemo(() => {
    return (watchLines || []).reduce((sum, line) => sum + (Number(line?.credit) || 0), 0)
  }, [watchLines])

  const isBalanced = useMemo(() => {
    return Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0
  }, [totalDebits, totalCredits])

  const handleStartCreate = () => {
    form.reset({
      entry_date: todayValue(),
      description: '',
      notes: '',
      lines: [
        { account_id: 0, debit: 0, credit: 0, memo: '', branch_id: null, batch_id: null },
        { account_id: 0, debit: 0, credit: 0, memo: '', branch_id: null, batch_id: null }
      ]
    })
    setIsCreating(true)
    setSelectedId(null)
  }

  const onSubmit = (values: JournalEntryFormValues) => {
    createMutation.mutate(values)
  }

  const handleReverseSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId) return
    if (reversalReason.trim().length < 3) {
      toast.error('Reason must be at least 3 characters long')
      return
    }
    reverseMutation.mutate({
      id: selectedId,
      date: reversalDate,
      reason: reversalReason
    })
  }

  const handlePrint = () => {
    const content = printAreaRef.current?.innerHTML
    if (!content) return
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow?.document
    if (doc) {
      doc.write(`
        <html>
          <head>
            <title>Journal Entry ${selectedEntry?.entry_number}</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 20px; }
              .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; }
              .title { font-size: 20px; font-weight: bold; margin: 0; }
              .meta-grid { display: grid; grid-template-cols: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; font-size: 13px; }
              .meta-label { color: #64748b; font-weight: 500; margin-bottom: 4px; }
              .meta-val { font-weight: 600; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
              th { background: #f8fafc; border-bottom: 1.5px solid #cbd5e1; padding: 10px; font-weight: 650; text-align: left; }
              td { padding: 10px; border-bottom: 1px solid #f1f5f9; }
              .num { text-align: right; font-family: monospace; }
              .totals { font-weight: bold; background: #f8fafc; border-top: 1.5px solid #cbd5e1; }
            </style>
          </head>
          <body>
            ${content}
          </body>
        </html>
      `)
      doc.close()
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 500)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] overflow-hidden animate-fade-in space-y-4">
      {/* Page Header */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="section-title">Manual Journals</h1>
          <p className="section-subtitle">Manage draft and posted manual journal entries</p>
        </div>
        <button 
          onClick={handleStartCreate} 
          disabled={isCreating}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" />
          New Journal
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0">
        
        {/* Left Panel: Journals List */}
        <div className="lg:col-span-5 flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden h-full">
          
          {/* List Filters */}
          <div className="p-4 border-b border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
              <input
                type="text"
                className="w-full form-input pl-9 py-2 text-xs"
                placeholder="Search by entry #, description, notes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Status</label>
                <select 
                  className="w-full form-input py-1 px-2 text-xs mt-0.5"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="draft">Draft</option>
                  <option value="posted">Posted</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">From Date</label>
                <input
                  type="date"
                  className="w-full form-input py-1 px-2 text-xs mt-0.5"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">To Date</label>
                <input
                  type="date"
                  className="w-full form-input py-1 px-2 text-xs mt-0.5"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* List View */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {isLoadingEntries ? (
              <div className="p-8 text-center text-xs text-ink-400">Loading entries...</div>
            ) : filteredEntries.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-400">No journal entries found</div>
            ) : (
              filteredEntries.map(entry => {
                const total = entry.lines?.reduce((sum, l) => sum + (Number(l.debit) || 0), 0) || 0
                return (
                  <div
                    key={entry.id}
                    onClick={() => {
                      setIsCreating(false)
                      setSelectedId(entry.id)
                    }}
                    className={clsx(
                      "p-4 cursor-pointer transition-all hover:bg-slate-50/75 dark:hover:bg-slate-800/30",
                      selectedId === entry.id && "bg-brand-50/50 dark:bg-brand-950/20 border-l-4 border-brand-600"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono text-xs font-bold text-ink-950 block">
                          {entry.entry_number}
                        </span>
                        <span className="text-[10px] text-ink-400 block font-medium mt-0.5">
                          {formatDate(entry.entry_date)}
                        </span>
                      </div>
                      <span className={clsx(
                        "badge text-[9px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full border",
                        entry.status === 'posted' ? "bg-green-50 text-green-700 border-green-200" :
                        entry.status === 'draft' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                        "bg-slate-50 text-slate-600 border-slate-200"
                      )}>
                        {entry.status}
                      </span>
                    </div>

                    <p className="text-xs text-ink-600 mt-2 truncate font-medium">
                      {entry.description || entry.notes || "-"}
                    </p>

                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/50">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Amount
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                        {UGX(total)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Panel: Detail OR Form */}
        <div className="lg:col-span-7 flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden h-full">
          
          {isCreating ? (
            /* CREATE MANUAL JOURNAL FORM */
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-bold text-ink-900">New Manual Journal Entry</h2>
                  <p className="text-[10px] text-ink-500">Draft entries can be edited before posting to the general ledger</p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsCreating(false)} 
                  className="text-ink-400 hover:text-ink-600 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Form Scrollable Area */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label text-xs">Date *</label>
                    <input 
                      type="date"
                      className="form-input text-xs"
                      {...form.register('entry_date')}
                    />
                    {form.formState.errors.entry_date && (
                      <p className="mt-1 text-xs text-red-500">{form.formState.errors.entry_date.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="form-label text-xs">Description *</label>
                    <input 
                      type="text"
                      className="form-input text-xs"
                      placeholder="e.g. Adjust office supplies ledger balance"
                      {...form.register('description')}
                    />
                    {form.formState.errors.description && (
                      <p className="mt-1 text-xs text-red-500">{form.formState.errors.description.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="form-label text-xs">Internal Notes / Memo</label>
                  <textarea 
                    className="form-input text-xs min-h-[50px] py-1.5"
                    placeholder="Provide detailed context for this audit log..."
                    {...form.register('notes')}
                  />
                </div>

                {/* Journal Lines Table */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-ink-950 uppercase tracking-wider">Journal Lines</h3>
                    {form.formState.errors.lines?.root && (
                      <span className="text-[10px] font-semibold text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {form.formState.errors.lines.root.message}
                      </span>
                    )}
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-3 py-2 text-ink-600 font-semibold w-1/3">Account</th>
                          <th className="px-3 py-2 text-ink-600 font-semibold w-1/4">Line Memo</th>
                          <th className="px-3 py-2 text-ink-600 font-semibold w-24 text-right">Debit (UGX)</th>
                          <th className="px-3 py-2 text-ink-600 font-semibold w-24 text-right">Credit (UGX)</th>
                          <th className="px-3 py-2 text-center w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {fields.map((field, index) => (
                          <tr key={field.id} className="hover:bg-slate-50/50">
                            {/* Account Autocomplete select */}
                            <td className="p-1">
                              <Controller
                                control={form.control}
                                name={`lines.${index}.account_id`}
                                render={({ field: { value, onChange }, fieldState: { error } }) => (
                                  <AccountSearchSelect 
                                    accounts={accounts} 
                                    value={value} 
                                    onChange={onChange} 
                                    error={error?.message}
                                  />
                                )}
                              />
                            </td>
                            {/* Memo input */}
                            <td className="p-1">
                              <input
                                type="text"
                                className="w-full form-input py-1.5 px-2 text-xs"
                                placeholder="Optional line memo"
                                {...form.register(`lines.${index}.memo`)}
                              />
                            </td>
                            {/* Debit input */}
                            <td className="p-1">
                              <input
                                type="number"
                                step="0.01"
                                className="w-full form-input py-1.5 px-2 text-xs text-right font-mono"
                                {...form.register(`lines.${index}.debit`)}
                              />
                            </td>
                            {/* Credit input */}
                            <td className="p-1">
                              <input
                                type="number"
                                step="0.01"
                                className="w-full form-input py-1.5 px-2 text-xs text-right font-mono"
                                {...form.register(`lines.${index}.credit`)}
                              />
                            </td>
                            {/* Trash button */}
                            <td className="p-1 text-center">
                              <button
                                type="button"
                                onClick={() => remove(index)}
                                className="text-slate-400 hover:text-red-500 p-1"
                                disabled={fields.length <= 2}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 dark:bg-slate-800 font-mono font-bold text-xs border-t border-slate-200 dark:border-slate-800">
                        <tr>
                          <td colSpan={2} className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => append({ account_id: 0, debit: 0, credit: 0, memo: '', branch_id: null, batch_id: null })}
                              className="text-brand-600 hover:text-brand-700 flex items-center gap-1 font-semibold"
                            >
                              <Plus className="h-3.5 w-3.5" /> Add Line
                            </button>
                            Totals:
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Balancing Check Panel */}
                  <div className={clsx(
                    "p-3 rounded-lg border flex items-center justify-between text-xs transition-all",
                    isBalanced 
                      ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-850 dark:text-green-300"
                      : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-850 dark:text-red-300"
                  )}>
                    <div className="flex items-center gap-2 font-medium">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {isBalanced ? (
                        <span>Double-entry balances match perfectly. Ready to save.</span>
                      ) : (
                        <span>
                          Debits and Credits are out of balance. Difference:{" "}
                          <strong>{UGX(Math.abs(totalDebits - totalCredits))}</strong>
                        </span>
                      )}
                    </div>
                    <span className={clsx(
                      "badge px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                      isBalanced ? "bg-green-600 text-white" : "bg-red-600 text-white"
                    )}>
                      {isBalanced ? "Balanced" : "Unbalanced"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form Actions Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="btn-secondary text-xs py-1.5 px-3"
                  disabled={createMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs py-1.5 px-3"
                  disabled={createMutation.isPending || !isBalanced}
                >
                  {createMutation.isPending ? 'Saving...' : 'Save Draft'}
                </button>
              </div>
            </form>
          ) : selectedEntry ? (
            /* DETAILED VIEW MODE */
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-brand-600" />
                  <div>
                    <h2 className="text-sm font-bold text-ink-950 block uppercase font-mono">{selectedEntry.entry_number}</h2>
                    <span className="text-[10px] text-ink-400 block font-medium">
                      Posted on {formatDate(selectedEntry.posted_at || selectedEntry.created_at)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handlePrint}
                    className="p-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-slate-500"
                    title="Print / PDF Export"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => setSelectedId(null)}
                    className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-slate-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Detail Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Reversal Linkages Banner */}
                {selectedEntry.is_reversed && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-medium">
                      <Undo2 className="h-4 w-4" />
                      <span>This journal entry has been reversed.</span>
                    </div>
                    {selectedEntry.reversal_of_id && (
                      <button 
                        onClick={() => setSelectedId(selectedEntry.reversal_of_id!)}
                        className="text-[10px] bg-rose-600 text-white font-bold px-2 py-0.5 rounded hover:bg-rose-700"
                      >
                        View Reversing Entry
                      </button>
                    )}
                  </div>
                )}

                {selectedEntry.reversal_of_id && !selectedEntry.is_reversed && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-medium">
                      <Undo2 className="h-4 w-4" />
                      <span>This is a Reversal Entry.</span>
                    </div>
                    <button 
                      onClick={() => setSelectedId(selectedEntry.reversal_of_id!)}
                      className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded hover:bg-blue-700"
                    >
                      View Original Entry
                    </button>
                  </div>
                )}

                {/* Printable Area Wrapper */}
                <div ref={printAreaRef}>
                  <div className="header" style={{ display: 'none' }}>
                    <div className="title">Journal Entry: ${selectedEntry.entry_number}</div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs border-b border-slate-100 dark:border-slate-800 pb-5">
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider mb-1">Journal Date</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 font-mono flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5 text-brand-600 inline" />
                        {formatDate(selectedEntry.entry_date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider mb-1">Source Module</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 uppercase font-mono">
                        {selectedEntry.reference_type || 'manual'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-400 font-bold uppercase tracking-wider mb-1">Description / Notes</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {selectedEntry.description || selectedEntry.notes || 'No description recorded'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Double-Entry Lines</h3>
                    <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="px-4 py-2.5 font-bold text-slate-700 dark:text-slate-350">Account</th>
                          <th className="px-4 py-2.5 font-bold text-slate-700 dark:text-slate-350">Memo</th>
                          <th className="px-4 py-2.5 font-bold text-slate-700 dark:text-slate-350 text-right w-28">Debit</th>
                          <th className="px-4 py-2.5 font-bold text-slate-700 dark:text-slate-350 text-right w-28">Credit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {selectedEntry.lines?.map((line, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/25 font-mono">
                            <td className="px-4 py-3">
                              <span className="font-bold text-slate-900 dark:text-slate-100">{line.account_name}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">{line.account_code}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-sans">{line.memo || '-'}</td>
                            <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">
                              {Number(line.debit) > 0 ? Number(line.debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">
                              {Number(line.credit) > 0 ? Number(line.credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold border-t border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                        <tr>
                          <td colSpan={2} className="px-4 py-3 text-right">Totals:</td>
                          <td className="px-4 py-3 text-right">
                            {selectedEntry.lines?.reduce((s, l) => s + Number(l.debit), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {selectedEntry.lines?.reduce((s, l) => s + Number(l.credit), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Additional notes panel */}
                {selectedEntry.notes && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs space-y-1">
                    <span className="font-bold text-slate-400 uppercase tracking-wider block">Additional audit log notes</span>
                    <p className="text-slate-600 dark:text-slate-350">{selectedEntry.notes}</p>
                  </div>
                )}
              </div>

              {/* Detail Footer with Post/Reverse action */}
              {selectedEntry.status === 'draft' && (
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                  <button
                    className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3"
                    onClick={() => postMutation.mutate(selectedEntry.id)}
                    disabled={postMutation.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {postMutation.isPending ? 'Posting...' : 'Post to Ledger'}
                  </button>
                </div>
              )}

              {selectedEntry.status === 'posted' && !selectedEntry.is_reversed && (
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                  <button
                    className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => setIsReversalModalOpen(true)}
                  >
                    <Undo2 className="h-4 w-4" />
                    Reverse Entry
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* EMPTY STATE */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-ink-400">
              <FileText className="h-12 w-12 stroke-[1.25] text-ink-300 mb-3" />
              <h3 className="text-sm font-bold text-ink-900">No Journal Selected</h3>
              <p className="text-xs text-ink-500 max-w-xs mt-1">
                Select a journal entry from the left panel to inspect audit trails, post draft entries, or perform journal reversals.
              </p>
              <button 
                onClick={handleStartCreate} 
                className="btn-primary mt-4 text-xs py-1.5 px-3"
              >
                <Plus className="h-3.5 w-3.5" />
                New Journal Entry
              </button>
            </div>
          )}
        </div>
      </div>

      {/* REVERSAL MODAL */}
      {isReversalModalOpen && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="bg-slate-950 p-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <Undo2 className="h-4 w-4 text-rose-500" />
                <h3 className="font-bold text-sm">Reverse Journal Entry</h3>
              </div>
              <button 
                onClick={() => { setIsReversalModalOpen(false); setReversalReason(''); }}
                className="text-white/60 hover:text-white"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleReverseSubmit} className="p-5 space-y-4">
              <p className="text-xs text-ink-600">
                You are about to reverse <strong>{selectedEntry.entry_number}</strong>. This will post a balanced offsetting draft journal swapping debits and credits, which will then need to be posted to ledger.
              </p>

              <div>
                <label className="form-label text-xs">Reversal Date</label>
                <input
                  type="date"
                  className="form-input text-xs"
                  value={reversalDate}
                  onChange={e => setReversalDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label text-xs">Reason for Reversal *</label>
                <textarea
                  className="form-input text-xs min-h-[70px]"
                  placeholder="e.g. Correcting double entry error in Office Expense line..."
                  value={reversalReason}
                  onChange={e => setReversalReason(e.target.value)}
                  minLength={3}
                  maxLength={255}
                  required
                />
                <span className="text-[10px] text-slate-400 block mt-1 text-right">
                  {reversalReason.length}/255 characters
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsReversalModalOpen(false); setReversalReason(''); }}
                  className="btn-secondary text-xs py-1.5 px-3"
                  disabled={reverseMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary bg-rose-600 hover:bg-rose-700 text-white border-none text-xs py-1.5 px-3"
                  disabled={reverseMutation.isPending || reversalReason.trim().length < 3}
                >
                  {reverseMutation.isPending ? 'Reversing...' : 'Post Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
