import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Bird, Plus, Home } from 'lucide-react'
import api from '@/services/api'

interface PoultryHouse {
  id: int
  name: string
  capacity: number
  status: string
}

function fetchHouses(): Promise<PoultryHouse[]> {
  return api.get('/farm/houses').then((res) => res.data)
}

export function HousesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['farm-houses'],
    queryFn: fetchHouses,
  })

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="section-title">Poultry Houses</h1>
          <p className="section-subtitle">Manage farm structures and capacities</p>
        </div>
        <button className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Add House
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20 text-neutral-400">Loading...</div>
      ) : data?.length === 0 ? (
        <div className="card p-12 text-center flex flex-col items-center justify-center border-dashed border-2 bg-neutral-50/50">
          <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center mb-4">
            <Home className="w-6 h-6 text-neutral-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-800">No Poultry Houses</h3>
          <p className="text-sm text-neutral-500 max-w-sm mt-1">Get started by adding your first poultry house to track your batches.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.map((house, idx) => (
            <motion.div
              key={house.id}
              className="bg-white rounded-xl border border-neutral-150 shadow-sm p-6 hover:shadow-card transition-shadow"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Home className="w-5 h-5" />
                </div>
                <span className={`badge ${house.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                  {house.status.toUpperCase()}
                </span>
              </div>
              <h3 className="text-lg font-bold text-neutral-900 mb-1">{house.name}</h3>
              <p className="text-sm text-neutral-500 mb-4">Capacity: {house.capacity.toLocaleString()} birds</p>
              
              <div className="border-t border-neutral-100 pt-4 flex justify-between items-center">
                <span className="text-xs font-medium text-brand-600 cursor-pointer hover:underline">View details</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
