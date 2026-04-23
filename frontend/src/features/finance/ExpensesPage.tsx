import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'

interface ExpenseCategory {
  id: number
  name: string
  description?: string | null
}

interface BatchOption {
  id: number
  batch_number: string
}

interface Expense {
  id: number
  category_id: number
  amount: number
  expense_date: string
  description?: string | null
  reference?: string | null
  batch_id?: number | null
  created_at: string
  category: ExpenseCategory
}

const categorySchema = z.object({
  name: z.string().min(2, 'Category name is required'),
  description: z.string().optional(),
})

const expenseSchema = z.object({
  category_id: z.coerce.number().int().positive('Category is required'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  expense_date: z.string().min(1, 'Expense date is required'),
  description: z.string().optional(),
  reference: z.string().optional(),
  batch_id: z.coerce.number().optional(),
})

type CategoryFormValues = z.infer<typeof categorySchema>
type ExpenseFormValues = z.infer<typeof expenseSchema>

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

export function ExpensesPage() {
  const queryClient = useQueryClient()

  const { data: categories = [] } = useQuery({
    queryKey: ['finance-expense-categories'],
    queryFn: () => api.get<ExpenseCategory[]>('/finance/expenses/categories').then((response) => response.data),
  })

  const { data: expenses = [] } = useQuery({
    queryKey: ['finance-expenses'],
    queryFn: () => api.get<Expense[]>('/finance/expenses').then((response) => response.data),
  })

  const { data: batches = [] } = useQuery({
    queryKey: ['finance-batches'],
    queryFn: () => api.get<BatchOption[]>('/farm/batches').then((response) => response.data),
  })

  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', description: '' },
  })

  const expenseForm = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { category_id: 0, amount: 0, expense_date: todayValue(), description: '', reference: '', batch_id: undefined },
  })

  const createCategory = useMutation({
    mutationFn: (values: CategoryFormValues) => api.post('/finance/expenses/categories', values),
    onSuccess: () => {
      toast.success('Expense category created.')
      queryClient.invalidateQueries({ queryKey: ['finance-expense-categories'] })
      categoryForm.reset({ name: '', description: '' })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to create expense category.')
    },
  })

  const createExpense = useMutation({
    mutationFn: (values: ExpenseFormValues) =>
      api.post('/finance/expenses', {
        category_id: values.category_id,
        amount: values.amount,
        expense_date: values.expense_date,
        description: values.description || null,
        reference: values.reference || null,
        batch_id: values.batch_id || null,
      }),
    onSuccess: () => {
      toast.success('Expense recorded.')
      queryClient.invalidateQueries({ queryKey: ['finance-expenses'] })
      expenseForm.reset({ category_id: 0, amount: 0, expense_date: todayValue(), description: '', reference: '', batch_id: undefined })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to record expense.')
    },
  })

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="section-title">Farm expenses</h1>
          <p className="section-subtitle">
            Record operational outflows by category and link batch-specific spend where applicable.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_420px_minmax(0,1fr)]">
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-ink-900">Add category</h2>
          <p className="mt-1 text-sm text-ink-500">Create a reusable expense classification for the finance ledger.</p>
          <form onSubmit={categoryForm.handleSubmit((values) => createCategory.mutate(values))} className="mt-5 space-y-4">
            <div>
              <label className="form-label">Category name</label>
              <input className="form-input" {...categoryForm.register('name')} />
            </div>
            <div>
              <label className="form-label">Description</label>
              <textarea className="form-input min-h-[120px]" {...categoryForm.register('description')} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={createCategory.isPending}>
              <Plus className="h-4.5 w-4.5" />
              {createCategory.isPending ? 'Saving...' : 'Save category'}
            </button>
          </form>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold text-ink-900">Record expense</h2>
          <p className="mt-1 text-sm text-ink-500">Capture a dated expense with reference and optional batch linkage.</p>
          <form onSubmit={expenseForm.handleSubmit((values) => createExpense.mutate(values))} className="mt-5 space-y-4">
            <div>
              <label className="form-label">Category</label>
              <select className="form-input" {...expenseForm.register('category_id')}>
                <option value={0}>Choose category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">Amount</label>
                <input className="form-input" type="number" min={0} step="0.01" {...expenseForm.register('amount')} />
              </div>
              <div>
                <label className="form-label">Expense date</label>
                <input className="form-input" type="date" {...expenseForm.register('expense_date')} />
              </div>
            </div>
            <div>
              <label className="form-label">Batch link</label>
              <select className="form-input" {...expenseForm.register('batch_id')}>
                <option value="">No batch link</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_number}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Reference</label>
              <input className="form-input" {...expenseForm.register('reference')} />
            </div>
            <div>
              <label className="form-label">Description</label>
              <textarea className="form-input min-h-[120px]" {...expenseForm.register('description')} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={createExpense.isPending}>
              <Wallet className="h-4.5 w-4.5" />
              {createExpense.isPending ? 'Saving...' : 'Record expense'}
            </button>
          </form>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-neutral-150 px-6 py-5">
            <h2 className="text-xl font-semibold text-ink-900">Expense history</h2>
            <p className="mt-1 text-sm text-ink-500">Live finance outflows already stored in the Farmexa ledger.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-6">Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th className="pr-6">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td className="pl-6 py-16 text-sm text-ink-500" colSpan={5}>
                      No expenses have been recorded yet.
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td className="pl-6">{formatDate(expense.expense_date)}</td>
                      <td>
                        <div className="font-semibold text-ink-900">{expense.category?.name || 'Uncategorized'}</div>
                        {expense.batch_id ? (
                          <div className="text-xs text-ink-500">
                            Batch {batches.find((batch) => batch.id === expense.batch_id)?.batch_number || expense.batch_id}
                          </div>
                        ) : null}
                      </td>
                      <td>{expense.description || 'No description'}</td>
                      <td>{expense.reference || 'No reference'}</td>
                      <td className="pr-6 font-semibold text-ink-900">UGX {expense.amount.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
