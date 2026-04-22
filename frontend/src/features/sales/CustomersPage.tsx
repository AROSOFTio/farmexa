import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Mail, Phone, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'

interface Customer {
  id: number
  name: string
  customer_type: 'retail' | 'wholesale'
  email?: string | null
  phone?: string | null
  address?: string | null
  balance: number
  is_active: boolean
  created_at: string
}

const customerSchema = z.object({
  name: z.string().min(2, 'Customer name is required'),
  customer_type: z.enum(['retail', 'wholesale']),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  is_active: z.boolean().default(true),
})

type CustomerFormValues = z.infer<typeof customerSchema>

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function CustomersPage() {
  const qc = useQueryClient()
  const { data: customers = [] } = useQuery({
    queryKey: ['sales-customers'],
    queryFn: () => api.get<Customer[]>('/sales/customers').then((response) => response.data),
  })

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', customer_type: 'retail', email: '', phone: '', address: '', is_active: true },
  })

  const mutation = useMutation({
    mutationFn: (values: CustomerFormValues) => api.post('/sales/customers', values),
    onSuccess: () => {
      toast.success('Customer account created.')
      qc.invalidateQueries({ queryKey: ['sales-customers'] })
      form.reset({ name: '', customer_type: 'retail', email: '', phone: '', address: '', is_active: true })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to create customer.')
    },
  })

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Customer Accounts</h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-neutral-500">
            Manage retail and wholesale customers with outstanding balance visibility.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
          <Users className="h-3.5 w-3.5" />
          Sales CRM
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="card p-6">
          <h2 className="text-lg font-bold text-neutral-900">Add customer</h2>
          <p className="mt-1 text-sm text-neutral-500">Create a real customer account for order, invoice, and payment workflows.</p>
          <form className="mt-5 space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <div>
              <label className="form-label">Customer name</label>
              <input className="form-input" {...form.register('name')} />
            </div>
            <div>
              <label className="form-label">Customer type</label>
              <select className="form-input" {...form.register('customer_type')}>
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" {...form.register('email')} />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input className="form-input" {...form.register('phone')} />
              </div>
            </div>
            <div>
              <label className="form-label">Address</label>
              <textarea className="form-input min-h-[120px]" {...form.register('address')} />
            </div>
            <button className="btn-primary w-full" disabled={mutation.isPending} type="submit">
              <Plus className="h-4 w-4" />
              {mutation.isPending ? 'Saving...' : 'Save customer'}
            </button>
          </form>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-neutral-100 px-6 py-5">
            <h2 className="text-lg font-bold text-neutral-900">Customer directory</h2>
            <p className="mt-1 text-sm text-neutral-500">Live customer accounts and their current balances.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-6">Customer</th>
                  <th>Type</th>
                  <th>Balance</th>
                  <th className="pr-6">Joined</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={4}>
                      No customer accounts have been created yet.
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr key={customer.id}>
                      <td className="pl-6">
                        <div className="font-semibold text-neutral-900">{customer.name}</div>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-neutral-500">
                          <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {customer.email || 'No email'}</span>
                          <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {customer.phone || 'No phone'}</span>
                        </div>
                      </td>
                      <td>
                        <span className={customer.customer_type === 'wholesale' ? 'badge badge-brand' : 'badge badge-neutral'}>
                          {customer.customer_type}
                        </span>
                      </td>
                      <td className="font-semibold text-neutral-900">UGX {customer.balance.toLocaleString()}</td>
                      <td className="pr-6 text-sm text-neutral-500">{formatDate(customer.created_at)}</td>
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
