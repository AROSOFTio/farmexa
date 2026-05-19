import { Fragment, type ChangeEvent, type MouseEvent as ReactMouseEvent, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search, ArrowUpRight } from 'lucide-react'

import api from '@/services/api'
import { useAuth } from '@/features/auth/AuthContext'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

interface SearchItem {
  id: string | number
  label: string
  description?: string
  path: string
  group: string
}

interface SearchGroup {
  group: string
  items: SearchItem[]
}

interface BatchResult {
  id: number
  batch_number: string
  breed?: string | null
}

interface CustomerResult {
  id: number
  name: string
  phone?: string | null
}

interface InvoiceResult {
  id: number
  invoice_number: string
  customer?: { name?: string | null } | null
  status?: string
}

interface StockItemResult {
  id: number
  name: string
  category?: string
  unit_of_measure?: string
}

interface SupplierResult {
  id: number
  name: string
  supplier_type?: string | null
}

const MIN_QUERY_LENGTH = 2
const MAX_RESULTS_PER_SECTION = 6

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState<number>(0)

  const canFarm = hasPermission('farm:read')
  const canSales = hasPermission('sales:read')
  const canInventory = hasPermission('inventory:read')
  const canFeed = hasPermission('feed:read')

  const resultsQuery = useQuery<SearchItem[]>({
    queryKey: ['command-palette', query, canFarm, canSales, canInventory, canFeed],
    enabled: open && query.trim().length >= MIN_QUERY_LENGTH,
    staleTime: 30_000,
    queryFn: async () => {
      const trimmed = query.trim()
      if (trimmed.length < MIN_QUERY_LENGTH) return []

      const requests: Array<Promise<SearchItem[]>> = []

      if (canFarm) {
        requests.push(
          api
            .get<BatchResult[]>('/farm/batches', { params: { search: trimmed, limit: MAX_RESULTS_PER_SECTION } })
            .then(({ data }: { data: BatchResult[] }) =>
              data.slice(0, MAX_RESULTS_PER_SECTION).map((batch: BatchResult): SearchItem => ({
                id: batch.id,
                label: batch.batch_number,
                description: batch.breed ? `Batch • ${batch.breed}` : 'Batch',
                path: `/farm/batches?search=${encodeURIComponent(batch.batch_number)}`,
                group: 'Batches',
              }))
            )
            .catch(() => [] as SearchItem[])
        )
      }

      if (canSales) {
        requests.push(
          api
            .get<CustomerResult[]>('/sales/customers', { params: { search: trimmed, limit: MAX_RESULTS_PER_SECTION } })
            .then(({ data }: { data: CustomerResult[] }) =>
              data.slice(0, MAX_RESULTS_PER_SECTION).map((customer: CustomerResult): SearchItem => ({
                id: customer.id,
                label: customer.name,
                description: customer.phone ? `Customer • ${customer.phone}` : 'Customer',
                path: `/sales/customers?search=${encodeURIComponent(customer.name)}`,
                group: 'Customers',
              }))
            )
            .catch(() => [] as SearchItem[])
        )

        requests.push(
          api
            .get<InvoiceResult[]>('/sales/invoices', { params: { search: trimmed, limit: MAX_RESULTS_PER_SECTION } })
            .then(({ data }: { data: InvoiceResult[] }) =>
              data.slice(0, MAX_RESULTS_PER_SECTION).map((invoice: InvoiceResult): SearchItem => ({
                id: invoice.id,
                label: invoice.invoice_number,
                description: invoice.customer?.name
                  ? `Invoice • ${invoice.customer.name}`
                  : `Invoice • ${invoice.status ?? 'Status pending'}`,
                path: `/sales/invoices?search=${encodeURIComponent(invoice.invoice_number)}`,
                group: 'Invoices',
              }))
            )
            .catch(() => [] as SearchItem[])
        )
      }

      if (canInventory) {
        requests.push(
          api
            .get<StockItemResult[]>('/inventory/items', { params: { search: trimmed, limit: MAX_RESULTS_PER_SECTION } })
            .then(({ data }: { data: StockItemResult[] }) =>
              data.slice(0, MAX_RESULTS_PER_SECTION).map((item: StockItemResult): SearchItem => ({
                id: item.id,
                label: item.name,
                description: item.category ? `Stock • ${item.category}` : 'Inventory item',
                path: `/inventory/items?search=${encodeURIComponent(item.name)}`,
                group: 'Stock items',
              }))
            )
            .catch(() => [] as SearchItem[])
        )
      }

      if (canFeed) {
        requests.push(
          api
            .get<SupplierResult[]>('/feed/suppliers', { params: { search: trimmed, limit: MAX_RESULTS_PER_SECTION } })
            .then(({ data }: { data: SupplierResult[] }) =>
              data.slice(0, MAX_RESULTS_PER_SECTION).map((supplier: SupplierResult): SearchItem => ({
                id: supplier.id,
                label: supplier.name,
                description: supplier.supplier_type ? `Supplier • ${supplier.supplier_type}` : 'Feed supplier',
                path: `/feed/suppliers?search=${encodeURIComponent(supplier.name)}`,
                group: 'Suppliers',
              }))
            )
            .catch(() => [] as SearchItem[])
        )
      }

      const settled = await Promise.all(requests)
      return settled.flat()
    },
  })

  const groupedResults: SearchGroup[] = useMemo(() => {
    if (!resultsQuery.data?.length) return []
    const groups = new Map<string, SearchItem[]>()
    for (const item of resultsQuery.data) {
      const list = groups.get(item.group) ?? []
      list.push(item)
      groups.set(item.group, list)
    }
    return Array.from(groups.entries()).map(([group, items]) => ({ group, items }))
  }, [resultsQuery.data])

  const flatResults = useMemo(() => groupedResults.flatMap((entry) => entry.items), [groupedResults])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveIndex(0)
      return
    }

    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((previous: number) => previous + 1)
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((previous: number) => Math.max(previous - 1, 0))
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const item = flatResults[activeIndex]
        if (item) {
          navigate(item.path)
          onClose()
        }
      }
    }

    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [activeIndex, flatResults, navigate, onClose, open])

  useEffect(() => {
    if (activeIndex >= flatResults.length) {
      setActiveIndex(Math.max(flatResults.length - 1, 0))
    }
  }, [activeIndex, flatResults.length])

  if (!open) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-start justify-center bg-black/50 px-4 py-16 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-[var(--surface-card)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => event.stopPropagation()}
      >
        <div className="border-b border-neutral-200 px-5 py-4">
          <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-muted)] px-3">
            <Search className="h-4 w-4 text-neutral-400" />
            <input
              autoFocus
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              placeholder="Search batches, customers, invoices, stock, suppliers"
              className="h-11 flex-1 bg-transparent text-sm text-[var(--text-strong)] outline-none"
            />
            <span className="hidden text-[11px] font-semibold text-neutral-500 sm:block">esc</span>
          </div>
        </div>

        <div className="max-h-[360px] overflow-y-auto px-3 py-2 text-sm">
          {query.trim().length < MIN_QUERY_LENGTH ? (
            <div className="px-3 py-6 text-center text-[13px] text-neutral-500">
              Start typing to search across Farmexa records
            </div>
          ) : resultsQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-6 text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          ) : groupedResults.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px] text-neutral-500">
              No results found for “{query.trim()}”
            </div>
          ) : (
            groupedResults.map(({ group, items }) => (
              <Fragment key={group}>
                <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{group}</div>
                <ul className="space-y-1 pb-2">
                  {items.map((item) => {
                    const index = flatResults.findIndex((candidate) => candidate.id === item.id && candidate.group === item.group)
                    const isActive = index === activeIndex
                    return (
                      <li key={`${item.group}-${item.id}`}>
                        <button
                          type="button"
                          className={`flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition ${
                            isActive ? 'bg-[var(--brand-primary)]/15 text-[var(--text-strong)]' : 'hover:bg-neutral-100'
                          }`}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => {
                            navigate(item.path)
                            onClose()
                          }}
                        >
                          <div>
                            <div className="text-[13px] font-semibold">{item.label}</div>
                            {item.description ? (
                              <div className="mt-0.5 text-[12px] text-neutral-500">{item.description}</div>
                            ) : null}
                          </div>
                          <ArrowUpRight className="h-4 w-4 text-neutral-400" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </Fragment>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
