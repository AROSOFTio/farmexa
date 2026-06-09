import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit2, Trash2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'
import clsx from 'clsx'

export interface Account {
  id: number
  account_code: string
  name: string
  description?: string
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'cost_of_sales' | 'expense'
  normal_balance: 'debit' | 'credit'
  parent_account_id?: number
  is_active: boolean
  is_system: boolean
  allow_manual_entries: boolean
  current_balance: number
}

const accountSchema = z.object({
  account_code: z.string().min(1, 'Account code is required'),
  name: z.string().min(2, 'Name is required'),
  description: z.string().optional(),
  account_type: z.enum(['asset', 'liability', 'equity', 'revenue', 'cost_of_sales', 'expense']),
  normal_balance: z.enum(['debit', 'credit']),
  parent_account_id: z.coerce.number().optional().nullable(),
  allow_manual_entries: z.boolean().default(true),
  is_active: z.boolean().default(true),
})

type AccountFormValues = z.infer<typeof accountSchema>

const ACCOUNT_TYPES = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'cost_of_sales', label: 'Cost of Sales' },
  { value: 'expense', label: 'Expense' },
]

export function ChartOfAccountsPage() {
  const queryClient = useQueryClient()
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounting-coa'],
    queryFn: () => api.get<Account[]>('/accounting/chart-of-accounts').then((res) => res.data),
  })

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      account_code: '',
      name: '',
      description: '',
      account_type: 'asset',
      normal_balance: 'debit',
      allow_manual_entries: true,
      is_active: true,
    },
  })

  const createMutation = useMutation({
    mutationFn: (values: AccountFormValues) => api.post('/accounting/chart-of-accounts', values),
    onSuccess: () => {
      toast.success('Account created successfully')
      queryClient.invalidateQueries({ queryKey: ['accounting-coa'] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to create account')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: AccountFormValues }) =>
      api.patch(`/accounting/chart-of-accounts/${id}`, values),
    onSuccess: () => {
      toast.success('Account updated successfully')
      queryClient.invalidateQueries({ queryKey: ['accounting-coa'] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to update account')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/accounting/chart-of-accounts/${id}`),
    onSuccess: () => {
      toast.success('Account deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['accounting-coa'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to delete account')
    },
  })

  const openNewModal = () => {
    setEditingAccount(null)
    form.reset({
      account_code: '',
      name: '',
      description: '',
      account_type: 'asset',
      normal_balance: 'debit',
      allow_manual_entries: true,
      is_active: true,
    })
    setIsModalOpen(true)
  }

  const openEditModal = (account: Account) => {
    setEditingAccount(account)
    form.reset({
      account_code: account.account_code,
      name: account.name,
      description: account.description || '',
      account_type: account.account_type,
      normal_balance: account.normal_balance,
      parent_account_id: account.parent_account_id,
      allow_manual_entries: account.allow_manual_entries,
      is_active: account.is_active,
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingAccount(null)
  }

  const onSubmit = (values: AccountFormValues) => {
    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, values })
    } else {
      createMutation.mutate(values)
    }
  }

  // Group accounts by type
  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.account_type]) {
      acc[account.account_type] = []
    }
    acc[account.account_type].push(account)
    return acc
  }, {} as Record<string, Account[]>)

  if (isLoading) {
    return <div className="p-6 text-ink-500">Loading chart of accounts...</div>
  }

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="section-title">Chart of Accounts</h1>
          <p className="section-subtitle">Manage your enterprise general ledger structure.</p>
        </div>
        <button onClick={openNewModal} className="btn-primary">
          <Plus className="h-4 w-4" />
          Add Account
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6 w-32">Code</th>
                <th>Account Name</th>
                <th>Type</th>
                <th>Status</th>
                <th className="text-right">Balance</th>
                <th className="pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ACCOUNT_TYPES.map((typeGroup) => {
                const groupAccounts = groupedAccounts[typeGroup.value] || []
                if (groupAccounts.length === 0) return null

                // Sort by account code
                groupAccounts.sort((a, b) => a.account_code.localeCompare(b.account_code))

                return (
                  <React.Fragment key={typeGroup.value}>
                    <tr className="bg-ink-50/50">
                      <td colSpan={6} className="px-6 py-2 text-xs font-bold uppercase tracking-wider text-ink-500">
                        {typeGroup.label}
                      </td>
                    </tr>
                    {groupAccounts.map((account) => (
                      <tr key={account.id}>
                        <td className="pl-6 font-mono text-sm text-ink-600">{account.account_code}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-ink-900">{account.name}</span>
                            {account.is_system && (
                              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                System
                              </span>
                            )}
                          </div>
                          {account.description && (
                            <div className="mt-0.5 text-xs text-ink-500">{account.description}</div>
                          )}
                        </td>
                        <td className="text-sm">
                          <span className="capitalize">{account.normal_balance}</span>
                        </td>
                        <td>
                          <span
                            className={clsx(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                              account.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            )}
                          >
                            {account.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="text-right font-mono text-sm font-semibold text-ink-900">
                          {account.current_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="pr-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(account)}
                              className="p-1.5 text-ink-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
                              title="Edit account"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            {!account.is_system && (
                              <button
                                onClick={() => {
                                  if (window.confirm('Are you sure you want to delete this account?')) {
                                    deleteMutation.mutate(account.id)
                                  }
                                }}
                                className="p-1.5 text-ink-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Delete account"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                )
              })}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-ink-500">
                    No accounts found. Create a new account or initialize the default Chart of Accounts.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
              <h2 className="text-lg font-bold text-ink-900">
                {editingAccount ? 'Edit Account' : 'New Account'}
              </h2>
              <button onClick={closeModal} className="text-ink-400 hover:text-ink-600">
                &times;
              </button>
            </div>
            
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6">
              {editingAccount?.is_system && (
                <div className="mb-6 flex items-start gap-3 rounded-lg bg-blue-50 p-4 text-blue-800">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <div className="text-sm">
                    <strong className="block font-semibold">System Account</strong>
                    This is a core system account. Some fields like Account Type and Normal Balance cannot be changed safely without affecting reports.
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">Account Code</label>
                  <input
                    className="form-input font-mono"
                    placeholder="e.g. 1010"
                    {...form.register('account_code')}
                  />
                  {form.formState.errors.account_code && (
                    <p className="mt-1 text-xs text-red-500">{form.formState.errors.account_code.message}</p>
                  )}
                </div>
                <div>
                  <label className="form-label">Account Name</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Main Bank Account"
                    {...form.register('name')}
                  />
                  {form.formState.errors.name && (
                    <p className="mt-1 text-xs text-red-500">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="form-label">Account Type</label>
                  <select
                    className="form-input"
                    {...form.register('account_type')}
                    disabled={editingAccount?.is_system}
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Normal Balance</label>
                  <select
                    className="form-input"
                    {...form.register('normal_balance')}
                    disabled={editingAccount?.is_system}
                  >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="form-label">Description (Optional)</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    {...form.register('description')}
                  />
                </div>

                <div className="sm:col-span-2 mt-2 flex flex-col gap-3">
                  <label className="flex items-center gap-2 text-sm text-ink-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-600"
                      {...form.register('allow_manual_entries')}
                    />
                    Allow manual journal entries
                  </label>
                  
                  <label className="flex items-center gap-2 text-sm text-ink-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-600"
                      {...form.register('is_active')}
                    />
                    Account is active
                  </label>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
