import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Bird, CalendarDays, Home, Plus, Scale, Search } from 'lucide-react'
import api from '@/services/api'
import { Modal } from '@/components/Modal'
import { BatchForm } from '@/features/farm/BatchForm'

interface Batch {
  id: number
  batch_number: string
  house_id: number
  breed: string
  source?: string | null
  arrival_date: string
  initial_quantity: number
  active_quantity: number
  status: 'active' | 'depleted' | 'slaughtered' | 'sold'
  house?: {
    id: number
    name: string
    capacity: number
  } | null
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function BatchesPage() {
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['farm-batches'],
    queryFn: () => api.get<Batch[]>('/farm/batches').then((response) => response.data),
  })

  const filteredBatches = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return batches
    }

    return batches.filter((batch) =>
      [batch.batch_number, batch.breed, batch.house?.name, batch.source]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    )
  }, [batches, search])

  const activeBatches = batches.filter((batch) => batch.status === 'active')
  const totalBirds = activeBatches.reduce((sum, batch) => sum + batch.active_quantity, 0)

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="section-title">Bird batches</h1>
          <p className="section-subtitle">
            Track every live flock by house, breed, source, and remaining active bird count.
          </p>
        </div>

        <button type="button" onClick={() => setIsModalOpen(true)} className="btn-primary">
          <Plus className="h-4.5 w-4.5" />
          New batch
        </button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="kpi-card">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-ink-500">
            <Bird className="h-4 w-4 text-brand-600" />
            Active batches
          </div>
          <div className="text-3xl font-semibold text-ink-900">{activeBatches.length.toLocaleString()}</div>
          <p className="text-sm text-ink-500">Batches currently available for live farm operations.</p>
        </div>

        <div className="kpi-card">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-ink-500">
            <Scale className="h-4 w-4 text-brand-600" />
            Active birds
          </div>
          <div className="text-3xl font-semibold text-ink-900">{totalBirds.toLocaleString()}</div>
          <p className="text-sm text-ink-500">Current live bird count across active batches.</p>
        </div>

        <div className="kpi-card">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-ink-500">
            <Search className="h-4 w-4 text-brand-600" />
            Search register
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="form-input"
            placeholder="Search by batch, breed, or house"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Batch</th>
                <th>House</th>
                <th>Breed / source</th>
                <th>Arrival</th>
                <th>Birds</th>
                <th className="pr-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="pl-6 py-16 text-center text-sm text-ink-500" colSpan={6}>
                    Loading batch register...
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td className="pl-6 py-16 text-center" colSpan={6}>
                    <div className="mx-auto max-w-sm">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                        <Bird className="h-8 w-8" />
                      </div>
                      <h2 className="mt-5 text-2xl font-semibold text-ink-900">
                        {batches.length === 0 ? 'No batches recorded yet' : 'No batches match this search'}
                      </h2>
                      <p className="mt-2 text-sm text-ink-500">
                        {batches.length === 0
                          ? 'Create a batch to connect houses, mortality, vaccination, growth tracking, and downstream production.'
                          : 'Try a different search term to find the batch you need.'}
                      </p>
                      {batches.length === 0 ? (
                        <button type="button" onClick={() => setIsModalOpen(true)} className="btn-primary mt-6">
                          <Plus className="h-4.5 w-4.5" />
                          Create first batch
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch, index) => {
                  const houseCapacity = batch.house?.capacity ?? 0
                  const occupancy = houseCapacity > 0 ? Math.min((batch.active_quantity / houseCapacity) * 100, 100) : 0
                  return (
                    <motion.tr
                      key={batch.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <td className="pl-6">
                        <div className="font-semibold text-ink-900">{batch.batch_number}</div>
                        <div className="text-xs text-ink-500">Initial quantity: {batch.initial_quantity.toLocaleString()}</div>
                      </td>
                      <td>
                        <div className="inline-flex items-center gap-2 rounded-full bg-neutral-50 px-3 py-1 text-sm font-medium text-ink-700 ring-1 ring-neutral-150">
                          <Home className="h-3.5 w-3.5 text-brand-600" />
                          {batch.house?.name ?? 'Unassigned'}
                        </div>
                      </td>
                      <td>
                        <div className="font-medium text-ink-800">{batch.breed}</div>
                        <div className="text-xs text-ink-500">{batch.source || 'Source not recorded'}</div>
                      </td>
                      <td>
                        <div className="inline-flex items-center gap-2 text-sm text-ink-600">
                          <CalendarDays className="h-4 w-4 text-brand-600" />
                          {formatDate(batch.arrival_date)}
                        </div>
                      </td>
                      <td>
                        <div className="min-w-[180px]">
                          <div className="flex items-center justify-between text-sm font-medium text-ink-700">
                            <span>{batch.active_quantity.toLocaleString()} birds</span>
                            <span>{occupancy.toFixed(0)}%</span>
                          </div>
                          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-100">
                            <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${occupancy}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="pr-6">
                        <span
                          className={
                            batch.status === 'active'
                              ? 'badge badge-success'
                              : batch.status === 'slaughtered'
                                ? 'badge badge-brand'
                                : 'badge badge-neutral'
                          }
                        >
                          {batch.status}
                        </span>
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create batch"
        description="Register a new flock against a real house so it can flow into mortality, feed, slaughter, sales, and reporting."
      >
        <BatchForm onSuccess={() => setIsModalOpen(false)} />
      </Modal>
    </div>
  )
}
