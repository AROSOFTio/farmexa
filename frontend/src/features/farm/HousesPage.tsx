import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Bird, Home, Layers3, PencilLine, Plus, Users } from 'lucide-react'
import { Modal } from '@/components/Modal'
import api from '@/services/api'
import { HouseForm } from '@/features/farm/HouseForm'
import { useAuth } from '@/features/auth/AuthContext'

interface PoultryHouse {
  id: number
  name: string
  capacity: number
  status: 'active' | 'maintenance' | 'inactive'
  sections?: Array<{
    id?: number
    name: string
    section_type: 'broilers' | 'layers' | 'chicks' | 'quarantine' | 'general'
    capacity: number
    status: 'active' | 'maintenance' | 'inactive'
  }>
}

interface BatchSummary {
  id: number
  house_id: number
  active_quantity: number
  status: string
}

export function HousesPage() {
  const { hasPermission } = useAuth()
  const [selectedHouse, setSelectedHouse] = useState<PoultryHouse | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const canManageFarm = hasPermission('farm:write')

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

  const totalCapacity = useMemo(
    () => portfolio.reduce((sum, house) => sum + house.capacity, 0),
    [portfolio]
  )

  const totalBirds = useMemo(
    () => portfolio.reduce((sum, house) => sum + house.activeBirds, 0),
    [portfolio]
  )

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="section-title">Poultry houses</h1>
          <p className="section-subtitle">Monitor available space, active birds, and occupancy by house in one clean view.</p>
        </div>

        {canManageFarm ? (
          <button type="button" onClick={() => setIsCreateModalOpen(true)} className="btn-primary">
            <Plus className="h-4.5 w-4.5" />
            Add house
          </button>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="metric-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="metric-label">Configured Houses</div>
              <div className="metric-value">{portfolio.length.toLocaleString()}</div>
              <div className="metric-note">All active, maintenance, and inactive farm houses.</div>
            </div>
            <div className="metric-icon"><Home className="h-5 w-5" /></div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="metric-label">Active Birds</div>
              <div className="metric-value">{totalBirds.toLocaleString()}</div>
              <div className="metric-note">Birds currently assigned to active house batches.</div>
            </div>
            <div className="metric-icon"><Bird className="h-5 w-5" /></div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="metric-label">Total Capacity</div>
              <div className="metric-value">{totalCapacity.toLocaleString()}</div>
              <div className="metric-note">Combined configured house capacity across the farm.</div>
            </div>
            <div className="metric-icon"><Users className="h-5 w-5" /></div>
          </div>
        </div>
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
          {canManageFarm ? (
            <button type="button" onClick={() => setIsCreateModalOpen(true)} className="btn-primary mt-8">
              <Plus className="h-4.5 w-4.5" />
              Add house
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {portfolio.map((house, index) => (
            <motion.div
              key={house.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.04 }}
              className="card-hover overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 border-b border-neutral-150 px-4 py-3">
                <h2 className="text-[15px] font-bold text-ink-900 truncate">{house.name}</h2>
                <span className={house.status === 'active' ? 'badge badge-success' : house.status === 'maintenance' ? 'badge badge-warning' : 'badge badge-neutral'}>
                  {house.status}
                </span>
              </div>

              <div className="px-4 py-3">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="rounded-lg bg-neutral-50 border border-neutral-150 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400 mb-0.5">
                      <Bird className="h-3 w-3 text-brand-500" />
                      Birds
                    </div>
                    <div className="text-lg font-bold text-ink-900 leading-tight">{house.activeBirds.toLocaleString()}</div>
                  </div>
                  <div className="rounded-lg bg-neutral-50 border border-neutral-150 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400 mb-0.5">
                      <Layers3 className="h-3 w-3 text-brand-500" />
                      Batches
                    </div>
                    <div className="text-lg font-bold text-ink-900 leading-tight">{house.activeBatches.toLocaleString()}</div>
                  </div>
                </div>

                <div className="mb-2.5">
                  <div className="flex items-center justify-between text-[11px] text-ink-500 mb-1">
                    <span>Occupancy</span>
                    <span className="font-medium text-ink-700">{house.activeBirds.toLocaleString()} / {house.capacity.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${house.occupancy}%` }} />
                  </div>
                </div>

                {house.sections?.length ? (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-neutral-100">
                    {house.sections.slice(0, 5).map((section) => (
                      <span key={section.id ?? section.name} className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-ink-600">
                        {section.name} · {section.capacity.toLocaleString()}
                      </span>
                    ))}
                    {house.sections.length > 5 ? <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-ink-500">+{house.sections.length - 5}</span> : null}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between border-t border-neutral-150 px-4 py-2.5">
                <div className="text-[11px] text-ink-400">
                  Cap: <span className="font-semibold text-ink-700">{house.capacity.toLocaleString()}</span>
                </div>
                {canManageFarm ? (
                  <button type="button" onClick={() => setSelectedHouse(house)} className="btn-secondary btn-sm">
                    <PencilLine className="h-3.5 w-3.5" />
                    Edit
                  </button>
                ) : null}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {canManageFarm ? (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="New house"
        >
          <HouseForm onSuccess={() => setIsCreateModalOpen(false)} />
        </Modal>
      ) : null}

      {canManageFarm ? (
        <Modal
          isOpen={Boolean(selectedHouse)}
          onClose={() => setSelectedHouse(null)}
          title={selectedHouse ? selectedHouse.name : 'House'}
        >
          {selectedHouse ? (
            <HouseForm
              houseId={selectedHouse.id}
              initialValues={{
                name: selectedHouse.name,
                capacity: selectedHouse.capacity,
                status: selectedHouse.status,
                sections: selectedHouse.sections ?? [],
              }}
              onSuccess={() => setSelectedHouse(null)}
            />
          ) : null}
        </Modal>
      ) : null}
    </div>
  )
}
