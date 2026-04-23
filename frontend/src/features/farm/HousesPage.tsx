import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Bird, Home, Layers3, PencilLine, Plus, Users } from 'lucide-react'
import { Modal } from '@/components/Modal'
import api from '@/services/api'
import { HouseForm } from '@/features/farm/HouseForm'

interface PoultryHouse {
  id: number
  name: string
  capacity: number
  status: 'active' | 'maintenance' | 'inactive'
}

interface BatchSummary {
  id: number
  house_id: number
  active_quantity: number
  status: string
}

export function HousesPage() {
  const [selectedHouse, setSelectedHouse] = useState<PoultryHouse | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const { data: houses = [], isLoading } = useQuery({
    queryKey: ['farm-houses'],
    queryFn: () => api.get<PoultryHouse[]>('/farm/houses').then((response) => response.data),
  })

  const { data: batches = [] } = useQuery({
    queryKey: ['farm-batches'],
    queryFn: () => api.get<BatchSummary[]>('/farm/batches').then((response) => response.data),
  })

  const portfolio = useMemo(() => {
    return houses.map((house) => {
      const houseBatches = batches.filter((batch) => batch.house_id === house.id && batch.status === 'active')
      const activeBirds = houseBatches.reduce((sum, batch) => sum + batch.active_quantity, 0)
      const occupancy = house.capacity > 0 ? Math.min((activeBirds / house.capacity) * 100, 100) : 0

      return {
        ...house,
        activeBirds,
        activeBatches: houseBatches.length,
        occupancy,
      }
    })
  }, [batches, houses])

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="section-title">Poultry houses</h1>
          <p className="section-subtitle">
            Manage physical housing capacity and keep active bird occupancy tied to live batch data.
          </p>
        </div>

        <button type="button" onClick={() => setIsCreateModalOpen(true)} className="btn-primary">
          <Plus className="h-4.5 w-4.5" />
          Add house
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="card h-64 animate-pulse bg-neutral-100/70" />
          ))}
        </div>
      ) : portfolio.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <Home className="h-8 w-8" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold text-ink-900">No houses configured yet</h2>
          <p className="mt-2 max-w-md text-base text-ink-500">
            Create your first poultry house to start assigning batches and monitoring occupancy.
          </p>
          <button type="button" onClick={() => setIsCreateModalOpen(true)} className="btn-primary mt-8">
            <Plus className="h-4.5 w-4.5" />
            Create first house
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {portfolio.map((house, index) => (
            <motion.div
              key={house.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: index * 0.04 }}
              className="card-hover overflow-hidden"
            >
              <div className="border-b border-neutral-150 bg-brand-fade px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-brand-700">
                      Farm structure
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold text-ink-900">{house.name}</h2>
                  </div>
                  <span className={house.status === 'active' ? 'badge badge-success' : house.status === 'maintenance' ? 'badge badge-warning' : 'badge badge-neutral'}>
                    {house.status}
                  </span>
                </div>
              </div>

              <div className="px-6 py-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-neutral-150 bg-neutral-50 px-4 py-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-ink-500">
                      <Bird className="h-4 w-4 text-brand-600" />
                      Active birds
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-ink-900">{house.activeBirds.toLocaleString()}</div>
                  </div>

                  <div className="rounded-2xl border border-neutral-150 bg-neutral-50 px-4 py-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-ink-500">
                      <Layers3 className="h-4 w-4 text-brand-600" />
                      Active batches
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-ink-900">{house.activeBatches.toLocaleString()}</div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-sm font-medium text-ink-600">
                    <span>Occupancy</span>
                    <span>
                      {house.activeBirds.toLocaleString()} / {house.capacity.toLocaleString()} birds
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${house.occupancy}%` }} />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-neutral-150 px-6 py-4">
                <div className="text-sm text-ink-500">
                  Capacity <span className="font-semibold text-ink-800">{house.capacity.toLocaleString()}</span>
                </div>
                <button type="button" onClick={() => setSelectedHouse(house)} className="btn-secondary btn-sm">
                  <PencilLine className="h-4 w-4" />
                  Manage house
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create poultry house"
        description="Set the capacity and operating status for a real production house."
      >
        <HouseForm onSuccess={() => setIsCreateModalOpen(false)} />
      </Modal>

      <Modal
        isOpen={Boolean(selectedHouse)}
        onClose={() => setSelectedHouse(null)}
        title={selectedHouse ? `Manage ${selectedHouse.name}` : 'Manage poultry house'}
        description="Update the house profile used by live farm batches and occupancy reporting."
      >
        {selectedHouse ? (
          <HouseForm
            houseId={selectedHouse.id}
            initialValues={{
              name: selectedHouse.name,
              capacity: selectedHouse.capacity,
              status: selectedHouse.status,
            }}
            onSuccess={() => setSelectedHouse(null)}
          />
        ) : null}
      </Modal>
    </div>
  )
}
