import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Package, Settings2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'

interface SystemConfig {
  id: number
  key: string
  value: string
  description?: string | null
}

interface ProductCatalog {
  id: number
  name: string
  sku?: string | null
  description?: string | null
  base_price: number
  wholesale_price: number
  is_active: boolean
}

const configSchema = z.object({
  key: z.string().min(2, 'Config key is required'),
  value: z.string().min(1, 'Config value is required'),
  description: z.string().optional(),
})

const productSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  sku: z.string().optional(),
  description: z.string().optional(),
  base_price: z.coerce.number().min(0, 'Base price must be zero or more'),
  wholesale_price: z.coerce.number().min(0, 'Wholesale price must be zero or more'),
  is_active: z.boolean().default(true),
})

type ConfigFormValues = z.infer<typeof configSchema>
type ProductFormValues = z.infer<typeof productSchema>

export function SettingsConfigPage() {
  const qc = useQueryClient()
  const { data: configs = [] } = useQuery({
    queryKey: ['settings-config'],
    queryFn: () => api.get<SystemConfig[]>('/settings/config').then((response) => response.data),
  })

  const { data: products = [] } = useQuery({
    queryKey: ['settings-products'],
    queryFn: () => api.get<ProductCatalog[]>('/settings/products').then((response) => response.data),
  })

  const configForm = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: { key: '', value: '', description: '' },
  })

  const productForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: '', sku: '', description: '', base_price: 0, wholesale_price: 0, is_active: true },
  })

  const createConfig = useMutation({
    mutationFn: (values: ConfigFormValues) => api.post('/settings/config', values),
    onSuccess: () => {
      toast.success('System config saved.')
      qc.invalidateQueries({ queryKey: ['settings-config'] })
      configForm.reset({ key: '', value: '', description: '' })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to save system config.')
    },
  })

  const createProduct = useMutation({
    mutationFn: (values: ProductFormValues) => api.post('/settings/products', values),
    onSuccess: () => {
      toast.success('Catalog product saved.')
      qc.invalidateQueries({ queryKey: ['settings-products'] })
      productForm.reset({ name: '', sku: '', description: '', base_price: 0, wholesale_price: 0, is_active: true })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to save catalog product.')
    },
  })

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">System Configuration</h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-neutral-500">
            Manage runtime config keys and baseline product pricing from one settings surface.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
          <ShieldCheck className="h-3.5 w-3.5" />
          Admin Settings
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_420px_minmax(0,1fr)]">
        <div className="card p-6">
          <h2 className="text-lg font-bold text-neutral-900">Save config key</h2>
          <p className="mt-1 text-sm text-neutral-500">Add or update a system-level preference value.</p>
          <form className="mt-5 space-y-4" onSubmit={configForm.handleSubmit((values) => createConfig.mutate(values))}>
            <div>
              <label className="form-label">Key</label>
              <input className="form-input" {...configForm.register('key')} />
            </div>
            <div>
              <label className="form-label">Value</label>
              <input className="form-input" {...configForm.register('value')} />
            </div>
            <div>
              <label className="form-label">Description</label>
              <textarea className="form-input min-h-[120px]" {...configForm.register('description')} />
            </div>
            <button className="btn-primary w-full" disabled={createConfig.isPending} type="submit">
              <Settings2 className="h-4 w-4" />
              {createConfig.isPending ? 'Saving...' : 'Save config'}
            </button>
          </form>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-bold text-neutral-900">Add priced product</h2>
          <p className="mt-1 text-sm text-neutral-500">Store a baseline selling product and pricing pair for downstream operations.</p>
          <form className="mt-5 space-y-4" onSubmit={productForm.handleSubmit((values) => createProduct.mutate(values))}>
            <div>
              <label className="form-label">Product name</label>
              <input className="form-input" {...productForm.register('name')} />
            </div>
            <div>
              <label className="form-label">SKU</label>
              <input className="form-input" {...productForm.register('sku')} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Base price</label>
                <input className="form-input" type="number" min={0} step="0.01" {...productForm.register('base_price')} />
              </div>
              <div>
                <label className="form-label">Wholesale price</label>
                <input className="form-input" type="number" min={0} step="0.01" {...productForm.register('wholesale_price')} />
              </div>
            </div>
            <div>
              <label className="form-label">Description</label>
              <textarea className="form-input min-h-[120px]" {...productForm.register('description')} />
            </div>
            <button className="btn-primary w-full" disabled={createProduct.isPending} type="submit">
              <Package className="h-4 w-4" />
              {createProduct.isPending ? 'Saving...' : 'Save product'}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="border-b border-neutral-100 px-6 py-5">
              <h2 className="text-lg font-bold text-neutral-900">Runtime config</h2>
              <p className="mt-1 text-sm text-neutral-500">Active keys currently stored in the ERP database.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-6">Key</th>
                    <th>Value</th>
                    <th className="pr-6">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.length === 0 ? (
                    <tr>
                      <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={3}>
                        No system config records stored yet.
                      </td>
                    </tr>
                  ) : (
                    configs.map((config) => (
                      <tr key={config.id}>
                        <td className="pl-6 font-semibold text-neutral-900">{config.key}</td>
                        <td>{config.value}</td>
                        <td className="pr-6">{config.description || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-neutral-100 px-6 py-5">
              <h2 className="text-lg font-bold text-neutral-900">Priced products</h2>
              <p className="mt-1 text-sm text-neutral-500">Product catalog values available for future pricing and sales flows.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-6">Product</th>
                    <th>Base price</th>
                    <th>Wholesale</th>
                    <th className="pr-6">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={4}>
                        No catalog products stored yet.
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id}>
                        <td className="pl-6">
                          <div className="font-semibold text-neutral-900">{product.name}</div>
                          <div className="text-xs text-neutral-500">{product.sku || 'No SKU'}</div>
                        </td>
                        <td>UGX {product.base_price.toLocaleString()}</td>
                        <td>UGX {product.wholesale_price.toLocaleString()}</td>
                        <td className="pr-6">
                          <span className={product.is_active ? 'badge badge-success' : 'badge badge-neutral'}>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
