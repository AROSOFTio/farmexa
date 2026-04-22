import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Bird, Calendar, Hash, Home, Activity } from 'lucide-react'
import { clsx } from 'clsx'
import api from '@/services/api'

export function BatchesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['farm-batches'],
    queryFn: () => api.get('/farm/batches').then(r => r.data),
  })

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Bird Batches</h1>
          <p className="text-sm text-neutral-500 mt-1 font-medium">Manage poultry batches across all houses</p>
        </div>
        <button className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-glow">
          <Plus className="w-4 h-4" />
          New Batch
        </button>
      </div>

      <div className="card overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6"><div className="flex items-center gap-2"><Hash className="w-3.5 h-3.5" /> Batch No.</div></th>
                <th><div className="flex items-center gap-2"><Home className="w-3.5 h-3.5" /> House</div></th>
                <th><div className="flex items-center gap-2"><Activity className="w-3.5 h-3.5" /> Breed</div></th>
                <th><div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> Arrival Date</div></th>
                <th><div className="flex items-center gap-2"><Bird className="w-3.5 h-3.5" /> Active Birds</div></th>
                <th className="pr-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm font-medium text-neutral-400">Loading batches...</span>
                    </div>
                  </td>
                </tr>
              ) : data?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-24">
                    <div className="flex flex-col items-center max-w-xs mx-auto">
                      <div className="w-16 h-16 rounded-3xl bg-neutral-100 flex items-center justify-center mb-4">
                        <Bird className="w-8 h-8 text-neutral-300" />
                      </div>
                      <h3 className="text-base font-bold text-neutral-800">No Batches Recorded</h3>
                      <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                        Start tracking your poultry by creating your first batch of birds.
                      </p>
                      <button className="mt-6 btn-secondary text-xs">
                        Learn how to start
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                data?.map((batch: any, idx: number) => (
                  <motion.tr 
                    key={batch.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="group"
                  >
                    <td className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-500 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                          <Hash className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-neutral-900">{batch.batch_number}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-sm font-medium text-neutral-700 px-2 py-1 rounded-md bg-neutral-50 border border-neutral-150">
                        {batch.house?.name || 'Unassigned'}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-neutral-800">{batch.breed}</span>
                        <span className="text-[10px] text-neutral-400 font-medium">Poultry Type</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2 text-neutral-500">
                        <Calendar className="w-3.5 h-3.5 opacity-60" />
                        <span className="text-sm">{batch.arrival_date}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-neutral-100 rounded-full max-w-[60px] overflow-hidden">
                          <div 
                            className="h-full bg-brand-500 rounded-full" 
                            style={{ width: `${Math.min(100, (batch.active_quantity / 5000) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-neutral-900">{batch.active_quantity.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="pr-6 text-right">
                      <span className={clsx(
                        "badge uppercase tracking-wider",
                        batch.status === 'active' ? "badge-success" : "badge-neutral"
                      )}>
                        {batch.status}
                      </span>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Table Footer / Pagination Placeholder */}
        <div className="px-6 py-4 bg-neutral-50/50 border-t border-neutral-100 flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-400">
            Showing {data?.length || 0} batches
          </span>
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm opacity-50" disabled>Previous</button>
            <button className="btn-secondary btn-sm opacity-50" disabled>Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}
