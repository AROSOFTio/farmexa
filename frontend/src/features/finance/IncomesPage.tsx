import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Banknote, ClipboardList, Landmark, Plus } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'

interface IncomeCategory {
  id: number
  name: string
  description?: string | null
}

interface Income {
  id: number
  category_id: number
  amount: number
  income_date: string
  description?: string | null
  reference?: string | null
  created_at: string
  category: IncomeCategory
}

const categorySchema = z.object({
  name: z.string().min(2, 'Category name is required'),
  description: z.string().optional(),
})

const incomeSchema = z.object({
  category_id: z.coerce.number().int().positive('Category is required'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  income_date: z.string().min(1, 'Income date is required'),
  description: z.string().optional(),
  reference: z.string().optional(),
})

type CategoryFormValues = z.infer<typeof categorySchema>
type IncomeFormValues = z.infer<typeof incomeSchema>

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function IncomesPage() {
  const qc = useQueryClient()
  const { data: categories = [] } = useQuery({
    queryKey: ['finance-income-categories'],
    queryFn: () => api.get<IncomeCategory[]>('/finance/incomes/categories').then((response) => response.data),
  })

  const { data: incomes = [] } = useQuery({
    queryKey: ['finance-incomes'],
    queryFn: () => api.get<Income[]>('/finance/incomes').then((response) => response.data),
  })

  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', description: '' },
  })

  const incomeForm = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeSchema),
    defaultValues: { category_id: 0, amount: 0, income_date: todayValue(), description: '', reference: '' },
  })

  const createCategory = useMutation({
    mutationFn: (values: CategoryFormValues) => api.post('/finance/incomes/categories', values),
    onSuccess: () => {
      toast.success('Income category created.')
      qc.invalidateQueries({ queryKey: ['finance-income-categories'] })
      categoryForm.reset({ name: '', description: '' })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to create income category.')
    },
  })

  const createIncome = useMutation({
    mutationFn: (values: IncomeFormValues) => api.post('/finance/incomes', values),
    onSuccess: () => {
      toast.success('Income recorded.')
      qc.invalidateQueries({ queryKey: ['finance-incomes'] })
      incomeForm.reset({ category_id: 0, amount: 0, income_date: todayValue(), description: '', reference: '' })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to record income.')
    },
  })

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Income Register</h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-neutral-500">
            Capture non-invoice income streams and keep finance reporting grounded in real entries.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
          <Banknote className="h-3.5 w-3.5" />
          Finance Ledger
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_420px_minmax(0,1fr)]">
        <div className="card p-6">
          <h2 className="text-lg font-bold text-neutral-900">Add category</h2>
          <p className="mt-1 text-sm text-neutral-500">Create a reusable income classification.</p>
          <form className="mt-5 space-y-4" onSubmit={categoryForm.handleSubmit((values) => createCategory.mutate(values))}>
            <div>
              <label className="form-label">Category name</label>
              <input className="form-input" {...categoryForm.register('name')} />
            </div>
            <div>
              <label className="form-label">Description</label>
              <textarea className="form-input min-h-[120px]" {...categoryForm.register('description')} />
            </div>
            <button className="btn-primary w-full" disabled={createCategory.isPending} type="submit">
              <Plus className="h-4 w-4" />
              {createCategory.isPending ? 'Saving...' : 'Save category'}
            </button>
          </form>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-bold text-neutral-900">Record income</h2>
          <p className="mt-1 text-sm text-neutral-500">Post a dated income entry into the finance ledger.</p>
          <form className="mt-5 space-y-4" onSubmit={incomeForm.handleSubmit((values) => createIncome.mutate(values))}>
            <div>
              <label className="form-label">Category</label>
              <select className="form-input" {...incomeForm.register('category_id')}>
                <option value={0}>Choose category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Amount</label>
                <input className="form-input" type="number" min={0} step="0.01" {...incomeForm.register('amount')} />
              </div>
              <div>
                <label className="form-label">Income date</label>
                <input className="form-input" type="date" {...incomeForm.register('income_date')} />
              </div>
            </div>
            <div>
              <label className="form-label">Reference</label>
              <input className="form-input" {...incomeForm.register('reference')} />
            </div>
            <div>
              <label className="form-label">Description</label>
              <textarea className="form-input min-h-[120px]" {...incomeForm.register('description')} />
            </div>
            <button className="btn-primary w-full" disabled={createIncome.isPending} type="submit">
              <Landmark className="h-4 w-4" />
              {createIncome.isPending ? 'Saving...' : 'Record income'}
            </button>
          </form>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-neutral-100 px-6 py-5">
            <h2 className="text-lg font-bold text-neutral-900">Income history</h2>
            <p className="mt-1 text-sm text-neutral-500">Live finance entries already stored in the backend ledger.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-6">Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th className="pr-6">Amount</th>
                </tr>
              </thead>
              <tbody>
                {incomes.length === 0 ? (
                  <tr>
                    <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={4}>
                      No income entries recorded yet.
                    </td>
                  </tr>
                ) : (
                  incomes.map((income) => (
                    <tr key={income.id}>
                      <td className="pl-6 text-sm text-neutral-500">{formatDate(income.income_date)}</td>
                      <td className="font-semibold text-neutral-900">{income.category?.name || 'Uncategorized'}</td>
                      <td className="text-sm text-neutral-500">{income.description || income.reference || '—'}</td>
                      <td className="pr-6 font-semibold text-neutral-900">UGX {income.amount.toLocaleString()}</td>
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
