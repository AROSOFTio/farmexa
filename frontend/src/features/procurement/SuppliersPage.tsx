import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Edit2, Search, Trash2, Truck, Mail, Phone, MapPin, DollarSign,
  Briefcase, ShieldAlert, FileText, CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner'
import clsx from 'clsx'

import api from '@/services/api'
import { Modal } from '@/components/Modal'
import { UGX } from '@/lib/money'
import {
  procurementService,
  type Supplier,
  type SupplierItemPrice,
  type SupplierCreate,
  type SupplierUpdate,
  type SupplierItemPriceCreate
} from '@/services/procurementService'

interface StockItemOption {
  id: number
  name: string
  unit_of_measure: string
  unit_price?: number
}

const supplierSchema = z.object({
  name: z.string().min(2, 'Supplier name is required'),
  supplier_type: z.string().optional().nullable(),
  products_supplied: z.string().optional().nullable(),
  contact_person: z.string().optional().nullable(),
  supplier_officer: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  alternate_phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  payment_terms: z.string().optional().nullable(),
  lead_time_days: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
})

type SupplierFormValues = z.infer<typeof supplierSchema>

const itemPriceSchema = z.object({
  stock_item_id: z.coerce.number().optional().nullable(),
  item_name: z.string().min(1, 'Item name is required'),
  unit_of_measure: z.string().optional().nullable(),
  unit_price: z.coerce.number().min(0, 'Unit price must be zero or more'),
  notes: z.string().optional().nullable(),
})

type ItemPriceFormValues = z.infer<typeof itemPriceSchema>

export function SuppliersPage() {
  const qc = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  
  // Modals state
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  
  const [pricingSupplier, setPricingSupplier] = useState<Supplier | null>(null)
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false)

  // React hook forms
  const { register: registerSupplier, handleSubmit: handleSubmitSupplier, reset: resetSupplier } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { is_active: true }
  })

  const { register: registerPrice, handleSubmit: handleSubmitPrice, reset: resetPrice, setValue: setValuePrice } = useForm<ItemPriceFormValues>({
    resolver: zodResolver(itemPriceSchema)
  })

  // Queries
  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: procurementService.listSuppliers,
  })

  const { data: stockItems = [] } = useQuery({
    queryKey: ['procurement-stock-items'],
    queryFn: () => api.get<StockItemOption[]>('/inventory/items').then(r => r.data),
  })

  const { data: tentativePrices = [], refetch: refetchPrices } = useQuery({
    queryKey: ['supplier-prices', pricingSupplier?.id],
    queryFn: () => pricingSupplier ? procurementService.listSupplierItemPrices(pricingSupplier.id) : Promise.resolve([]),
    enabled: !!pricingSupplier,
  })

  // Mutations
  const createSupplierMutation = useMutation({
    mutationFn: procurementService.createSupplier,
    onSuccess: () => {
      toast.success('Supplier profile created successfully.')
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      closeSupplierModal()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to create supplier'),
  })

  const updateSupplierMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SupplierUpdate }) => procurementService.updateSupplier(id, data),
    onSuccess: () => {
      toast.success('Supplier profile updated successfully.')
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      closeSupplierModal()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to update supplier'),
  })

  const addPriceMutation = useMutation({
    mutationFn: ({ supplierId, data }: { supplierId: number; data: SupplierItemPriceCreate }) =>
      procurementService.createOrUpdateSupplierItemPrice(supplierId, data),
    onSuccess: () => {
      toast.success('Tentative item price saved.')
      refetchPrices()
      resetPrice({ item_name: '', unit_price: 0, notes: '', stock_item_id: null, unit_of_measure: '' })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to save tentative price'),
  })

  const deletePriceMutation = useMutation({
    mutationFn: ({ supplierId, priceId }: { supplierId: number; priceId: number }) =>
      procurementService.deleteSupplierItemPrice(supplierId, priceId),
    onSuccess: () => {
      toast.success('Tentative price deleted.')
      refetchPrices()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to delete price'),
  })

  // Handlers
  const openNewSupplierModal = () => {
    setEditingSupplier(null)
    resetSupplier({
      name: '', supplier_type: '', products_supplied: '', contact_person: '',
      supplier_officer: '', phone: '', alternate_phone: '', email: '',
      address: '', tax_id: '', payment_terms: '', lead_time_days: 0, notes: '', is_active: true
    })
    setIsSupplierModalOpen(true)
  }

  const openEditSupplierModal = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    resetSupplier({
      name: supplier.name,
      supplier_type: supplier.supplier_type ?? '',
      products_supplied: supplier.products_supplied ?? '',
      contact_person: supplier.contact_person ?? '',
      supplier_officer: supplier.supplier_officer ?? '',
      phone: supplier.phone ?? '',
      alternate_phone: supplier.alternate_phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
      tax_id: supplier.tax_id ?? '',
      payment_terms: supplier.payment_terms ?? '',
      lead_time_days: supplier.lead_time_days ?? 0,
      notes: supplier.notes ?? '',
      is_active: supplier.is_active,
    })
    setIsSupplierModalOpen(true)
  }

  const closeSupplierModal = () => {
    setIsSupplierModalOpen(false)
    setEditingSupplier(null)
  }

  const handleSupplierSubmit = (values: SupplierFormValues) => {
    const data: SupplierCreate = {
      ...values,
      lead_time_days: values.lead_time_days ? Number(values.lead_time_days) : null,
      supplier_type: values.supplier_type || null,
      products_supplied: values.products_supplied || null,
      contact_person: values.contact_person || null,
      supplier_officer: values.supplier_officer || null,
      phone: values.phone || null,
      alternate_phone: values.alternate_phone || null,
      email: values.email || null,
      address: values.address || null,
      tax_id: values.tax_id || null,
      payment_terms: values.payment_terms || null,
      notes: values.notes || null,
    }

    if (editingSupplier) {
      updateSupplierMutation.mutate({ id: editingSupplier.id, data })
    } else {
      createSupplierMutation.mutate(data)
    }
  }

  const openPricingModal = (supplier: Supplier) => {
    setPricingSupplier(supplier)
    resetPrice({ item_name: '', unit_price: 0, notes: '', stock_item_id: null, unit_of_measure: '' })
    setIsPricingModalOpen(true)
  }

  const handlePriceSubmit = (values: ItemPriceFormValues) => {
    if (!pricingSupplier) return
    addPriceMutation.mutate({
      supplierId: pricingSupplier.id,
      data: {
        stock_item_id: values.stock_item_id ? Number(values.stock_item_id) : null,
        item_name: values.item_name,
        unit_of_measure: values.unit_of_measure || null,
        unit_price: Number(values.unit_price) || 0,
        notes: values.notes || null,
      }
    })
  }

  const handleStockItemSelect = (val: string) => {
    const id = val ? Number(val) : null
    const stock = stockItems.find(s => s.id === id)
    if (stock) {
      setValuePrice('item_name', stock.name)
      setValuePrice('unit_of_measure', stock.unit_of_measure)
      setValuePrice('unit_price', stock.unit_price || 0)
    }
  }

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.contact_person?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (s.phone || '').includes(searchQuery)
      const matchesType = !typeFilter || s.supplier_type === typeFilter
      return matchesSearch && matchesType
    })
  }, [suppliers, searchQuery, typeFilter])

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Suppliers Directory</h1>
          <p className="section-subtitle">
            Manage vendor profiles, payment terms, contact details, and tentative product pricing.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openNewSupplierModal}>
          <Plus className="h-4 w-4" />
          Add Supplier
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="form-label">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              className="form-input pl-9"
              placeholder="Search by supplier name, contact person, phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="w-full md:w-52">
          <label className="form-label">Supplier Type</label>
          <select className="form-input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="Feed mill">Feed mill</option>
            <option value="Raw materials">Raw materials</option>
            <option value="Medicine">Medicine</option>
            <option value="Equipment">Equipment</option>
            <option value="Transport">Transport</option>
            <option value="General">General</option>
          </select>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Supplier Details</th>
                <th>Products Supplied</th>
                <th>Payment Terms</th>
                <th>Lead Time</th>
                <th>Status</th>
                <th className="pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="py-12 pl-6 text-sm text-neutral-500">Loading suppliers...</td></tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr><td colSpan={6} className="py-12 pl-6 text-sm text-neutral-500">No suppliers found.</td></tr>
              ) : (
                filteredSuppliers.map(s => (
                  <tr key={s.id}>
                    <td className="pl-6 py-4">
                      <div className="font-semibold text-neutral-900">{s.name}</div>
                      <div className="text-xs text-neutral-500 flex flex-col gap-1 mt-1">
                        {s.supplier_type && <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" /> {s.supplier_type}</span>}
                        {s.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {s.phone}</span>}
                        {s.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {s.email}</span>}
                        {s.address && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.address}</span>}
                      </div>
                    </td>
                    <td className="text-sm max-w-xs truncate">{s.products_supplied || '—'}</td>
                    <td className="text-sm">{s.payment_terms || '—'}</td>
                    <td className="text-sm">{s.lead_time_days != null ? `${s.lead_time_days} days` : '—'}</td>
                    <td>
                      <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border',
                        s.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                      )}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="pr-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => openPricingModal(s)}
                        >
                          <DollarSign className="h-3.5 w-3.5" /> Pricing
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => openEditSupplierModal(s)}
                        >
                          <Edit2 className="h-3.5 w-3.5" /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Create/Edit Modal */}
      <Modal
        isOpen={isSupplierModalOpen}
        onClose={closeSupplierModal}
        title={editingSupplier ? 'Edit Supplier Details' : 'Add New Supplier'}
        description="Enter general vendor profile details, products, payment terms, and contact details."
      >
        <form onSubmit={handleSubmitSupplier(handleSupplierSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">Supplier Name*</label>
              <input className="form-input" {...registerSupplier('name')} required />
            </div>
            <div>
              <label className="form-label">Supplier Type</label>
              <select className="form-input" {...registerSupplier('supplier_type')}>
                <option value="">Choose type...</option>
                <option value="Feed mill">Feed mill</option>
                <option value="Raw materials">Raw materials</option>
                <option value="Medicine">Medicine</option>
                <option value="Equipment">Equipment</option>
                <option value="Transport">Transport</option>
                <option value="General">General</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Products Supplied</label>
            <textarea
              className="form-input min-h-[60px]"
              placeholder="e.g. Maize, Concentrates, Premixes, Vaccines..."
              {...registerSupplier('products_supplied')}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">Contact Person</label>
              <input className="form-input" {...registerSupplier('contact_person')} />
            </div>
            <div>
              <label className="form-label">Supplier Officer / Representative</label>
              <input className="form-input" placeholder="Account manager/officer name" {...registerSupplier('supplier_officer')} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="form-label">Primary Phone</label>
              <input className="form-input" {...registerSupplier('phone')} />
            </div>
            <div>
              <label className="form-label">Alternate Phone</label>
              <input className="form-input" {...registerSupplier('alternate_phone')} />
            </div>
            <div>
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" {...registerSupplier('email')} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="form-label">Tax ID / TIN</label>
              <input className="form-input" {...registerSupplier('tax_id')} />
            </div>
            <div>
              <label className="form-label">Payment Terms</label>
              <input className="form-input" placeholder="Cash, Net 15, Net 30..." {...registerSupplier('payment_terms')} />
            </div>
            <div>
              <label className="form-label">Lead Time (Days)</label>
              <input className="form-input" type="number" min={0} {...registerSupplier('lead_time_days')} />
            </div>
          </div>

          <div>
            <label className="form-label">Physical Address</label>
            <textarea className="form-input min-h-[60px]" {...registerSupplier('address')} />
          </div>

          <div>
            <label className="form-label">Notes / Instructions</label>
            <textarea className="form-input min-h-[60px]" {...registerSupplier('notes')} />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 rounded border-neutral-300" id="is_active_chk" {...registerSupplier('is_active')} />
            <label htmlFor="is_active_chk" className="text-sm font-semibold text-neutral-700">Active supplier</label>
          </div>

          <div className="flex justify-end gap-3 border-t pt-4">
            <button type="button" className="btn-secondary" onClick={closeSupplierModal}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createSupplierMutation.isPending || updateSupplierMutation.isPending}>
              {createSupplierMutation.isPending || updateSupplierMutation.isPending ? 'Saving...' : 'Save Supplier'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Pricing / Tentative Prices Modal */}
      <Modal
        isOpen={isPricingModalOpen}
        onClose={() => { setIsPricingModalOpen(false); setPricingSupplier(null) }}
        title={pricingSupplier ? `Tentative Item Prices — ${pricingSupplier.name}` : 'Tentative Item Prices'}
        description="Review and record quoted prices from this supplier for standard inventory/stock items."
      >
        <div className="space-y-6">
          <form onSubmit={handleSubmitPrice(handlePriceSubmit)} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 space-y-4">
            <div className="text-sm font-semibold text-neutral-800">Add or Update Quoted Price</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Link Stock Item (Optional)</label>
                <select className="form-input bg-white" {...registerPrice('stock_item_id')} onChange={e => handleStockItemSelect(e.target.value)}>
                  <option value="">Choose item...</option>
                  {stockItems.map(item => (
                    <option key={item.id} value={item.id}>{item.name} ({item.unit_of_measure})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Item Name*</label>
                <input className="form-input bg-white" placeholder="e.g. Broken Maize" {...registerPrice('item_name')} required />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Unit of Measure</label>
                <input className="form-input bg-white" placeholder="e.g. kg, 50kg bag" {...registerPrice('unit_of_measure')} />
              </div>
              <div>
                <label className="form-label">Quoted Price (UGX)*</label>
                <input className="form-input bg-white" type="number" min={0} step="0.01" {...registerPrice('unit_price')} required />
              </div>
            </div>
            <div>
              <label className="form-label">Notes</label>
              <input className="form-input bg-white" placeholder="e.g. Quoted on June 2026, bulk discount applies" {...registerPrice('notes')} />
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-primary" disabled={addPriceMutation.isPending}>
                <Plus className="h-4 w-4" /> Save Quoted Price
              </button>
            </div>
          </form>

          {/* Pricing list */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-neutral-800">Active Price Catalog ({tentativePrices.length})</div>
            {tentativePrices.length === 0 ? (
              <div className="text-sm text-neutral-500 py-6 text-center bg-neutral-50 rounded-xl border">No tentative pricing catalogued yet.</div>
            ) : (
              <div className="max-h-60 overflow-y-auto rounded-xl border border-neutral-200">
                <table className="w-full text-sm text-left">
                  <thead className="bg-neutral-50 text-xs font-semibold text-neutral-500 uppercase tracking-wider border-b">
                    <tr>
                      <th className="px-4 py-2.5">Item</th>
                      <th className="px-4 py-2.5">Unit</th>
                      <th className="px-4 py-2.5 text-right">Price</th>
                      <th className="px-4 py-2.5 text-right w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tentativePrices.map(price => (
                      <tr key={price.id} className="hover:bg-neutral-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-neutral-800">{price.item_name}</div>
                          {price.notes && <div className="text-xs text-neutral-500">{price.notes}</div>}
                        </td>
                        <td className="px-4 py-3">{price.unit_of_measure || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-neutral-900">{UGX(price.unit_price)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="p-1 text-neutral-400 hover:text-red-600 rounded"
                            onClick={() => pricingSupplier && deletePriceMutation.mutate({ supplierId: pricingSupplier.id, priceId: price.id })}
                            disabled={deletePriceMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end border-t pt-4">
            <button type="button" className="btn-secondary" onClick={() => { setIsPricingModalOpen(false); setPricingSupplier(null) }}>Close</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
