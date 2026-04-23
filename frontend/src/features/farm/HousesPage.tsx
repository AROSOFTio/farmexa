import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Bird, Plus, Home, MapPin, Users, Info, ArrowRight } from 'lucide-react'
import { clsx } from 'clsx'
import api from '@/services/api'
import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { HouseForm } from './HouseForm'

interface PoultryHouse {
  id: number
  name: string
  capacity: number
  status: string
}

function fetchHouses(): Promise<PoultryHouse[]> {
  return api.get('/farm/houses').then((res) => res.data)
}

export function HousesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['farm-houses'],
    queryFn: fetchHouses,
  })

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Poultry Houses</h1>
          <p className="text-base text-slate-600 mt-1 font-medium">Manage farm structures and house capacities</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add House
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-6 h-48 animate-pulse bg-neutral-100/50" />
          ))}
        </div>
      ) : data?.length === 0 ? (
        <div className="card p-16 text-center flex flex-col items-center justify-center border-dashed border-2 bg-slate-50/50">
          <div className="w-16 h-16 rounded-3xl bg-white shadow-sm flex items-center justify-center mb-6 border-2 border-slate-100">
            <Home className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No Poultry Houses</h3>
          <p className="text-base text-slate-500 max-w-sm mt-2 leading-relaxed">
            Organize your farm by adding poultry houses. Each house helps you track specific batches and their environment.
          </p>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="mt-8 btn-primary btn-md"
          >
            <Plus className="w-4 h-4" />
            Add Your First House
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.map((house, idx) => (
            <motion.div
              key={house.id}
              className="group relative bg-white rounded-2xl border border-neutral-150 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            >
              {/* Status Header */}
              <div className="px-6 py-5">
                <div className="flex justify-between items-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border-2 border-slate-200 flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-all duration-300">
                    <Home className="w-6 h-6" />
                  </div>
                  <span className={clsx(
                    "badge uppercase tracking-wider",
                    house.status === 'active' ? "badge-success" : "badge-neutral"
                  )}>
                    {house.status}
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mb-1.5">{house.name}</h3>
                
                <div className="space-y-3 mt-4">
                  <div className="flex items-center gap-2.5 text-slate-500">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                      <Users className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs uppercase font-bold tracking-tight text-slate-400 leading-none mb-1">Max Capacity</span>
                      <span className="text-base font-bold text-slate-800">{house.capacity.toLocaleString()} Birds</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2.5 text-slate-500">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs uppercase font-bold tracking-tight text-slate-400 leading-none mb-1">Location</span>
                      <span className="text-base font-medium text-slate-700">Main Farm Section</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="mt-4 px-6 py-4 bg-slate-50/50 border-t-2 border-slate-100 flex justify-between items-center group-hover:bg-blue-50/30 transition-colors">
                <div className="flex items-center gap-1.5 text-blue-600 cursor-pointer">
                  <span className="text-sm font-bold uppercase tracking-wider">Manage House</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
                <div className="w-8 h-8 rounded-lg hover:bg-slate-200/50 flex items-center justify-center text-slate-400 transition-colors">
                  <Info className="w-4 h-4" />
                </div>
              </div>
              
              {/* Background Decoration */}
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
            </motion.div>
          ))}
        </div>
      )}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Poultry House"
        description="Create a new structure to house your poultry batches."
      >
        <HouseForm onSuccess={() => setIsModalOpen(false)} />
      </Modal>
    </div>
  )
}
