export const UGX = (amount: number | string | null | undefined): string => {
  const n = Number(amount ?? 0)
  if (isNaN(n)) return 'UGX 0.00'
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

export const formatBalance = (
  amount: number,
  normalBalance: 'debit' | 'credit'
): { display: string; isNegative: boolean } => {
  const isNegative = normalBalance === 'debit' ? amount < 0 : amount > 0
  return { display: UGX(Math.abs(amount)), isNegative }
}

export const accountTypeColor = (type: string): string => {
  const map: Record<string, string> = {
    asset: 'text-blue-600 dark:text-blue-400',
    liability: 'text-red-600 dark:text-red-400',
    equity: 'text-purple-600 dark:text-purple-400',
    revenue: 'text-green-600 dark:text-green-400',
    cost_of_sales: 'text-orange-600 dark:text-orange-400',
    expense: 'text-rose-600 dark:text-rose-400',
  }
  return map[type] ?? 'text-ink-600'
}

export const accountTypeBadge = (type: string): string => {
  const map: Record<string, string> = {
    asset: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
    liability: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300',
    equity: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300',
    revenue: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300',
    cost_of_sales: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300',
    expense: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300',
  }
  return map[type] ?? 'bg-slate-100 text-slate-700 border-slate-200'
}
