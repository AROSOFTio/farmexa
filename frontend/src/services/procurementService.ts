import api from './api'

export type POStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'partially_received'
  | 'fully_received'
  | 'cancelled'
  | 'closed'

export type SupplierInvoiceStatus = 'draft' | 'approved' | 'partial' | 'paid' | 'overdue' | 'cancelled'

export type SupplierPaymentMethod = 'cash' | 'bank_transfer' | 'mobile_money' | 'cheque'

export interface SupplierBrief {
  id: number
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  payment_terms?: string | null
}

export interface POItem {
  id?: number
  stock_item_id?: number | null
  description: string
  quantity_ordered: number
  unit_of_measure?: string | null
  unit_price: number
  total_price?: number
  quantity_received?: number
}

export interface PurchaseOrder {
  id: number
  tenant_id: number
  po_number: string
  supplier_id: number
  branch_id?: number | null
  status: POStatus
  order_date: string
  expected_delivery_date?: string | null
  delivery_address?: string | null
  delivery_branch_id?: number | null
  subtotal: number
  tax_amount: number
  total_amount: number
  notes?: string | null
  terms_and_conditions?: string | null
  approved_at?: string | null
  created_at?: string | null
  supplier?: SupplierBrief | null
  items: POItem[]
}

export interface PurchaseOrderCreate {
  supplier_id: number
  branch_id?: number | null
  order_date: string
  expected_delivery_date?: string | null
  delivery_address?: string | null
  delivery_branch_id?: number | null
  tax_amount?: number
  notes?: string | null
  terms_and_conditions?: string | null
  items: POItem[]
}

export interface ReceiveItem {
  item_id: number
  qty_received: number
  branch_id?: number | null
}

export interface SupplierInvoice {
  id: number
  tenant_id: number
  supplier_id: number
  branch_id?: number | null
  po_id?: number | null
  invoice_number: string
  invoice_date: string
  due_date?: string | null
  subtotal: number
  tax_amount: number
  total_amount: number
  amount_paid: number
  status: SupplierInvoiceStatus
  journal_entry_id?: number | null
  notes?: string | null
  created_at?: string | null
  supplier?: SupplierBrief | null
}

export interface SupplierInvoiceCreate {
  supplier_id: number
  branch_id?: number | null
  po_id?: number | null
  invoice_number: string
  invoice_date: string
  due_date?: string | null
  subtotal?: number
  tax_amount?: number
  total_amount: number
  notes?: string | null
}

export interface SupplierPaymentCreate {
  payment_date: string
  amount: number
  payment_method: SupplierPaymentMethod
  reference?: string | null
  notes?: string | null
}

export interface SupplierPayment extends SupplierPaymentCreate {
  id: number
  supplier_invoice_id: number
  journal_entry_id?: number | null
}

export interface Supplier {
  id: number
  name: string
  supplier_type?: string | null
  products_supplied?: string | null
  contact_person?: string | null
  supplier_officer?: string | null
  phone?: string | null
  alternate_phone?: string | null
  email?: string | null
  address?: string | null
  tax_id?: string | null
  payment_terms?: string | null
  lead_time_days?: number | null
  notes?: string | null
  is_active: boolean
}

export type SupplierCreate = Omit<Supplier, 'id'>
export type SupplierUpdate = Partial<SupplierCreate>

export interface SupplierItemPrice {
  id: number
  supplier_id: number
  stock_item_id?: number | null
  item_name: string
  unit_of_measure?: string | null
  unit_price: number
  notes?: string | null
  updated_at?: string | null
}

export type SupplierItemPriceCreate = Omit<SupplierItemPrice, 'id' | 'supplier_id' | 'updated_at'>

export const procurementService = {
  // Purchase orders
  listPurchaseOrders: (params?: {
    status?: POStatus
    supplier_id?: number
    branch_id?: number
    skip?: number
    limit?: number
  }) => api.get<PurchaseOrder[]>('/procurement/purchase-orders', { params }).then(r => r.data),

  getPurchaseOrder: (id: number) =>
    api.get<PurchaseOrder>(`/procurement/purchase-orders/${id}`).then(r => r.data),

  createPurchaseOrder: (data: PurchaseOrderCreate) =>
    api.post<PurchaseOrder>('/procurement/purchase-orders', data).then(r => r.data),

  submitPurchaseOrder: (id: number) =>
    api.post<PurchaseOrder>(`/procurement/purchase-orders/${id}/submit`).then(r => r.data),

  approvePurchaseOrder: (id: number) =>
    api.post<PurchaseOrder>(`/procurement/purchase-orders/${id}/approve`).then(r => r.data),

  rejectPurchaseOrder: (id: number) =>
    api.post<PurchaseOrder>(`/procurement/purchase-orders/${id}/reject`).then(r => r.data),

  cancelPurchaseOrder: (id: number) =>
    api.post<PurchaseOrder>(`/procurement/purchase-orders/${id}/cancel`).then(r => r.data),

  receiveGoods: (id: number, received_items: ReceiveItem[]) =>
    api.post<PurchaseOrder>(`/procurement/purchase-orders/${id}/receive`, { received_items }).then(r => r.data),

  downloadPurchaseOrderPdf: async (id: number, poNumber: string) => {
    const response = await api.get(`/procurement/purchase-orders/${id}/pdf`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${poNumber}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  },

  // Supplier invoices
  listSupplierInvoices: (params?: {
    status?: SupplierInvoiceStatus
    supplier_id?: number
    skip?: number
    limit?: number
  }) => api.get<SupplierInvoice[]>('/procurement/supplier-invoices', { params }).then(r => r.data),

  getSupplierInvoice: (id: number) =>
    api.get<SupplierInvoice>(`/procurement/supplier-invoices/${id}`).then(r => r.data),

  createSupplierInvoice: (data: SupplierInvoiceCreate) =>
    api.post<SupplierInvoice>('/procurement/supplier-invoices', data).then(r => r.data),

  approveSupplierInvoice: (id: number) =>
    api.post<SupplierInvoice>(`/procurement/supplier-invoices/${id}/approve`).then(r => r.data),

  paySupplierInvoice: (id: number, data: SupplierPaymentCreate) =>
    api.post<SupplierPayment>(`/procurement/supplier-invoices/${id}/pay`, data).then(r => r.data),

  // Suppliers
  listSuppliers: () =>
    api.get<Supplier[]>('/procurement/suppliers').then(r => r.data),

  createSupplier: (data: SupplierCreate) =>
    api.post<Supplier>('/procurement/suppliers', data).then(r => r.data),

  updateSupplier: (id: number, data: SupplierUpdate) =>
    api.put<Supplier>(`/procurement/suppliers/${id}`, data).then(r => r.data),

  listSupplierItemPrices: (supplierId: number) =>
    api.get<SupplierItemPrice[]>(`/procurement/suppliers/${supplierId}/prices`).then(r => r.data),

  createOrUpdateSupplierItemPrice: (supplierId: number, data: SupplierItemPriceCreate) =>
    api.post<SupplierItemPrice>(`/procurement/suppliers/${supplierId}/prices`, data).then(r => r.data),

  deleteSupplierItemPrice: (supplierId: number, priceId: number) =>
    api.delete(`/procurement/suppliers/${supplierId}/prices/${priceId}`).then(r => r.data),
}

