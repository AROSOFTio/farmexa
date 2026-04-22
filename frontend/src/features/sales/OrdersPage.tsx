import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Package, Calendar, Tag, CheckCircle } from 'lucide-react'
import api from '@/services/api'
import { clsx } from 'clsx'

export function OrdersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: () => api.get('/sales/orders').then(r => r.data).catch(() => []),
  })

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Sales Orders</h1>
          <p className="text-sm text-neutral-500 mt-1 font-medium">Manage customer orders and fulfillment</p>
        </div>
        <button className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-glow">
          <Plus className="w-4 h-4" />
          Create Order
        </button>
      </div>

      <div className="card overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 bg-white">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Order ID</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total Amount</th>
                <th className="pr-6 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-20 text-neutral-400">Loading...</td></tr>
              ) : data?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-24">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-3xl bg-neutral-50 flex items-center justify-center mb-4">
                        <Package className="w-8 h-8 text-neutral-300" />
                      </div>
                      <h3 className="text-base font-bold text-neutral-800">No Orders Found</h3>
                      <p className="text-xs text-neutral-400 mt-2">Start selling by creating your first order.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data?.map((order: any, idx: number) => (
                  <motion.tr key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                    <td className="pl-6 font-bold text-neutral-900">#{order.id.toString().padStart(5, '0')}</td>
                    <td className="font-medium text-neutral-700">Customer {order.customer_id}</td>
                    <td>
                      <span className={clsx("badge uppercase", order.status === 'completed' ? "badge-success" : "badge-neutral")}>
                        {order.status}
                      </span>
                    </td>
                    <td className="font-bold text-neutral-900">UGX {order.total_amount.toLocaleString()}</td>
                    <td className="pr-6 text-right text-xs text-neutral-500">{new Date(order.created_at).toLocaleDateString()}</td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
