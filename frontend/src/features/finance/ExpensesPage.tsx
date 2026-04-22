import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Receipt, Wallet, Banknote } from 'lucide-react'
import api from '@/services/api'

export function ExpensesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['finance-expenses'],
    queryFn: () => api.get('/finance/expenses').then(r => r.data).catch(() => []),
  })

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Farm Expenses</h1>
          <p className="text-sm text-neutral-500 mt-1 font-medium">Record and track operational costs</p>
        </div>
        <button className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-glow">
          <Plus className="w-4 h-4" />
          Record Expense
        </button>
      </div>

      <div className="card overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 bg-white">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Date</th>
                <th>Category</th>
                <th>Description</th>
                <th className="pr-6 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading ? (
                <tr><td colSpan={4} className="text-center py-20 text-neutral-400">Loading...</td></tr>
              ) : data?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-24">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-3xl bg-neutral-50 flex items-center justify-center mb-4">
                        <Receipt className="w-8 h-8 text-neutral-300" />
                      </div>
                      <h3 className="text-base font-bold text-neutral-800">No Expenses Recorded</h3>
                      <p className="text-xs text-neutral-400 mt-2">Log your first expense to track your outflow.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data?.map((expense: any, idx: number) => (
                  <motion.tr key={expense.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                    <td className="pl-6 text-sm text-neutral-500">{new Date(expense.expense_date).toLocaleDateString()}</td>
                    <td className="font-bold text-neutral-700">{expense.category?.name || 'Uncategorized'}</td>
                    <td className="text-neutral-500 text-sm max-w-[200px] truncate">{expense.description || '—'}</td>
                    <td className="pr-6 text-right font-black text-neutral-900">UGX {expense.amount.toLocaleString()}</td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
