import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react'
import api from '@/services/api'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts'

export function ProfitDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-profit'],
    queryFn: () => api.get('/analytics/profit').then(r => r.data).catch(() => ({ summary: {}, timeline: [] })),
  })

  const fmt = (n: number) => `UGX ${(n || 0).toLocaleString()}`

  return (
    <div className="animate-fade-in pb-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Profit & Loss Analysis</h1>
          <p className="text-sm text-neutral-500 mt-1 font-medium">Financial performance over the last 30 days</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6 bg-white shadow-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><TrendingUp className="w-4 h-4" /></div>
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Total Revenue</span>
          </div>
          <div className="text-3xl font-black text-neutral-900 mt-4">{fmt(data?.summary?.total_revenue)}</div>
        </div>
        
        <div className="card p-6 bg-white shadow-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center"><TrendingDown className="w-4 h-4" /></div>
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Total Expenses</span>
          </div>
          <div className="text-3xl font-black text-neutral-900 mt-4">{fmt(data?.summary?.total_expenses)}</div>
        </div>

        <div className="card p-6 bg-gradient-to-br from-brand-900 to-brand-800 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><DollarSign className="w-4 h-4 text-gold-400" /></div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-200">Net Profit</span>
          </div>
          <div className="text-3xl font-black mt-4 relative z-10">{fmt(data?.summary?.net_profit)}</div>
        </div>
      </div>

      <div className="card p-8 bg-white shadow-card">
        <h3 className="text-lg font-bold text-neutral-900 mb-6">Revenue vs Expenses</h3>
        <div className="h-[400px] w-full">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center text-neutral-400">Loading chart data...</div>
          ) : data?.timeline?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.timeline} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#379b71" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#379b71" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a3a3a3' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a3a3a3' }} dx={-10} tickFormatter={(val) => `UGX ${(val/1000)}k`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: number) => [`UGX ${value.toLocaleString()}`, '']}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }}/>
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#379b71" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExp)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400">
              <Activity className="w-8 h-8 mb-3 opacity-20" />
              <p>No financial data available for this period.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
