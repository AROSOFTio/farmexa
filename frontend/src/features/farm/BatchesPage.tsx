import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Bird } from 'lucide-react'
import api from '@/services/api'

export function BatchesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['farm-batches'],
    queryFn: () => api.get('/farm/batches').then(r => r.data),
  })

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="section-title">Bird Batches</h1>
          <p className="section-subtitle">Manage poultry batches across all houses</p>
        </div>
        <button className="btn btn-primary">
          <Plus className="w-4 h-4" />
          New Batch
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Batch Number</th>
              <th>House</th>
              <th>Breed</th>
              <th>Arrival Date</th>
              <th>Active Birds</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-8">Loading...</td></tr>
            ) : data?.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-neutral-500">
                  <div className="flex flex-col items-center">
                    <Bird className="w-8 h-8 text-neutral-300 mb-3" />
                    <p>No batches recorded yet.</p>
                  </div>
                </td>
              </tr>
            ) : (
              data?.map((batch: any) => (
                <tr key={batch.id}>
                  <td className="font-medium text-neutral-900">{batch.batch_number}</td>
                  <td>{batch.house?.name || '—'}</td>
                  <td>{batch.breed}</td>
                  <td>{batch.arrival_date}</td>
                  <td className="font-semibold">{batch.active_quantity.toLocaleString()}</td>
                  <td>
                    <span className={`badge ${batch.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                      {batch.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
