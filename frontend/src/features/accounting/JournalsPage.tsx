import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, CheckCircle2, FileText, Ban, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'
import clsx from 'clsx'
import { Account } from './ChartOfAccountsPage'

interface JournalLine {
  id?: number
  account_id: number
  description?: string
  debit: number
  credit: number
  account?: Account
}

interface JournalEntry {
  id: number
  reference_type?: string
  reference_id?: string
  status: 'draft' | 'posted' | 'cancelled'
  journal_date: string
  notes?: string
  created_at: string
  posted_at?: string
  lines: JournalLine[]
}

const journalLineSchema = z.object({
  account_id: z.coerce.number().int().positive('Account is required'),
  description: z.string().optional(),
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
}).refine(data => data.debit > 0 || data.credit > 0, {
  message: 'Must have either a debit or a credit',
  path: ['debit']
}).refine(data => !(data.debit > 0 && data.credit > 0), {
  message: 'Cannot have both debit and credit on the same line',
  path: ['credit']
})

const journalEntrySchema = z.object({
  journal_date: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
  reference_type: z.string().optional(),
  reference_id: z.string().optional(),
  lines: z.array(journalLineSchema).min(2, 'At least two lines are required')
}).refine(data => {
  const totalDebits = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0)
  const totalCredits = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0)
  // Allow a tiny floating point difference, but generally they must match exactly.
  return Math.abs(totalDebits - totalCredits) < 0.001
}, {
  message: 'Total debits must equal total credits',
  path: ['lines']
})

type JournalEntryFormValues = z.infer<typeof journalEntrySchema>

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function JournalsPage() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['accounting-journals'],
    queryFn: () => api.get<JournalEntry[]>('/accounting/journal-entries').then(res => res.data),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-coa'],
    queryFn: () => api.get<Account[]>('/accounting/chart-of-accounts').then((res) => res.data),
  })

  const form = useForm<JournalEntryFormValues>({
    resolver: zodResolver(journalEntrySchema),
    defaultValues: {
      journal_date: todayValue(),
      notes: '',
      reference_type: 'manual',
      lines: [
        { account_id: 0, debit: 0, credit: 0, description: '' },
        { account_id: 0, debit: 0, credit: 0, description: '' },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  })

  const createMutation = useMutation({
    mutationFn: (values: JournalEntryFormValues) => api.post('/accounting/journal-entries', values),
    onSuccess: () => {
      toast.success('Journal entry created successfully')
      queryClient.invalidateQueries({ queryKey: ['accounting-journals'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-coa'] }) // Update balances
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to create journal entry')
    },
  })

  const postMutation = useMutation({
    mutationFn: (id: number) => api.post(`/accounting/journal-entries/${id}/post`),
    onSuccess: () => {
      toast.success('Journal entry posted successfully')
      queryClient.invalidateQueries({ queryKey: ['accounting-journals'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-coa'] })
      setIsViewModalOpen(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to post journal entry')
    },
  })

  const openNewModal = () => {
    form.reset({
      journal_date: todayValue(),
      notes: '',
      reference_type: 'manual',
      lines: [
        { account_id: 0, debit: 0, credit: 0, description: '' },
        { account_id: 0, debit: 0, credit: 0, description: '' },
      ],
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const openViewModal = (entry: JournalEntry) => {
    setSelectedEntry(entry)
    setIsViewModalOpen(true)
  }

  const onSubmit = (values: JournalEntryFormValues) => {
    createMutation.mutate(values)
  }

  // Calculate form totals
  const watchLines = form.watch('lines')
  const totalDebits = watchLines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0)
  const totalCredits = watchLines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.001

  if (isLoading) {
    return <div className="p-6 text-ink-500">Loading journal entries...</div>
  }

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="section-title">Journal Entries</h1>
          <p className="section-subtitle">View and post manual double-entry journals.</p>
        </div>
        <button onClick={openNewModal} className="btn-primary">
          <Plus className="h-4 w-4" />
          New Journal
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6 w-32">Date</th>
                <th>Reference</th>
                <th>Notes</th>
                <th className="text-right">Total Amount</th>
                <th>Status</th>
                <th className="pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const totalAmount = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0)
                return (
                  <tr key={entry.id} className="cursor-pointer hover:bg-ink-50/50" onClick={() => openViewModal(entry)}>
                    <td className="pl-6 whitespace-nowrap text-sm text-ink-600">
                      {formatDate(entry.journal_date)}
                    </td>
                    <td>
                      <div className="font-medium text-ink-900 uppercase text-xs">
                        {entry.reference_type} {entry.reference_id && `- ${entry.reference_id}`}
                      </div>
                    </td>
                    <td className="text-sm text-ink-600 truncate max-w-xs">
                      {entry.notes || '-'}
                    </td>
                    <td className="text-right font-mono text-sm font-semibold text-ink-900">
                      {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span
                        className={clsx(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                          entry.status === 'posted' ? 'bg-green-50 text-green-700' : 
                          entry.status === 'draft' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'
                        )}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="pr-6 text-right">
                      <button
                        className="text-brand-600 hover:text-brand-700 text-sm font-medium"
                        onClick={(e) => { e.stopPropagation(); openViewModal(entry); }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-ink-500">
                    No journal entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-ink-900">New Journal Entry</h2>
              <button onClick={closeModal} className="text-ink-400 hover:text-ink-600">
                &times;
              </button>
            </div>
            
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                <div>
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    {...form.register('journal_date')}
                  />
                  {form.formState.errors.journal_date && (
                    <p className="mt-1 text-xs text-red-500">{form.formState.errors.journal_date.message}</p>
                  )}
                </div>
                <div>
                  <label className="form-label">Reference Type</label>
                  <input
                    className="form-input bg-ink-50"
                    {...form.register('reference_type')}
                    readOnly
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="form-label">Notes</label>
                  <input
                    className="form-input"
                    placeholder="Reason for journal entry"
                    {...form.register('notes')}
                  />
                </div>
              </div>

              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink-900">Journal Lines</h3>
                {form.formState.errors.lines?.root && (
                  <p className="text-sm font-semibold text-red-500">{form.formState.errors.lines.root.message}</p>
                )}
              </div>

              <div className="border border-ink-200 rounded-lg overflow-hidden mb-6">
                <table className="w-full text-left text-sm">
                  <thead className="bg-ink-50">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-ink-700">Account</th>
                      <th className="px-4 py-3 font-semibold text-ink-700">Description</th>
                      <th className="px-4 py-3 font-semibold text-ink-700 w-32 text-right">Debit</th>
                      <th className="px-4 py-3 font-semibold text-ink-700 w-32 text-right">Credit</th>
                      <th className="px-4 py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {fields.map((field, index) => (
                      <tr key={field.id}>
                        <td className="p-2">
                          <select
                            className="form-input py-1.5 text-sm"
                            {...form.register(`lines.${index}.account_id`)}
                          >
                            <option value={0}>Select Account...</option>
                            {accounts.filter(a => a.allow_manual_entries).map(a => (
                              <option key={a.id} value={a.id}>{a.account_code} - {a.name}</option>
                            ))}
                          </select>
                          {form.formState.errors.lines?.[index]?.account_id && (
                            <p className="mt-0.5 text-[10px] text-red-500">{form.formState.errors.lines[index]?.account_id?.message}</p>
                          )}
                        </td>
                        <td className="p-2">
                          <input
                            className="form-input py-1.5 text-sm"
                            placeholder="Line description"
                            {...form.register(`lines.${index}.description`)}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-input py-1.5 text-sm text-right font-mono"
                            {...form.register(`lines.${index}.debit`)}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-input py-1.5 text-sm text-right font-mono"
                            {...form.register(`lines.${index}.credit`)}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="text-ink-400 hover:text-red-500 p-1"
                            disabled={fields.length <= 2}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-ink-50 font-mono font-semibold">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => append({ account_id: 0, debit: 0, credit: 0, description: '' })}
                          className="text-sm text-brand-600 hover:text-brand-700 float-left flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Add Line
                        </button>
                        Totals:
                      </td>
                      <td className={clsx("px-4 py-3 text-right", !isBalanced && "text-red-600")}>
                        {totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className={clsx("px-4 py-3 text-right", !isBalanced && "text-red-600")}>
                        {totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary"
                  disabled={createMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createMutation.isPending || !isBalanced || totalDebits === 0}
                >
                  {createMutation.isPending ? 'Saving...' : 'Save Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isViewModalOpen && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-ink-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-white/70" />
                <h2 className="text-lg font-bold">Journal Entry Details</h2>
                <span
                  className={clsx(
                    'ml-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide',
                    selectedEntry.status === 'posted' ? 'bg-green-500/20 text-green-300' : 
                    selectedEntry.status === 'draft' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'
                  )}
                >
                  {selectedEntry.status}
                </span>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="text-white/50 hover:text-white">
                &times;
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 text-sm">
                <div>
                  <p className="text-ink-500 mb-1 font-medium">Date</p>
                  <p className="font-semibold text-ink-900">{formatDate(selectedEntry.journal_date)}</p>
                </div>
                <div>
                  <p className="text-ink-500 mb-1 font-medium">Reference</p>
                  <p className="font-semibold text-ink-900 uppercase">{selectedEntry.reference_type} {selectedEntry.reference_id && `- ${selectedEntry.reference_id}`}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-ink-500 mb-1 font-medium">Notes</p>
                  <p className="font-semibold text-ink-900">{selectedEntry.notes || 'None'}</p>
                </div>
              </div>

              <table className="w-full text-left text-sm border border-ink-200 rounded-lg overflow-hidden">
                <thead className="bg-ink-50 border-b border-ink-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-ink-700">Account</th>
                    <th className="px-4 py-3 font-semibold text-ink-700">Description</th>
                    <th className="px-4 py-3 font-semibold text-ink-700 text-right w-32">Debit</th>
                    <th className="px-4 py-3 font-semibold text-ink-700 text-right w-32">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {selectedEntry.lines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink-900">{line.account?.name}</div>
                        <div className="text-xs text-ink-500 font-mono">{line.account?.account_code}</div>
                      </td>
                      <td className="px-4 py-3 text-ink-600">{line.description || '-'}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink-900">
                        {Number(line.debit) > 0 ? Number(line.debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-ink-900">
                        {Number(line.credit) > 0 ? Number(line.credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-ink-50 border-t border-ink-200 font-mono font-bold text-ink-900">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-right">Totals:</td>
                    <td className="px-4 py-3 text-right">
                      {selectedEntry.lines.reduce((s, l) => s + Number(l.debit), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {selectedEntry.lines.reduce((s, l) => s + Number(l.credit), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {selectedEntry.status === 'draft' && (
                <div className="mt-8 flex justify-end gap-3 border-t border-ink-100 pt-6">
                  <button
                    className="btn-primary"
                    onClick={() => postMutation.mutate(selectedEntry.id)}
                    disabled={postMutation.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {postMutation.isPending ? 'Posting...' : 'Post to Ledger'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
