import { motion } from 'framer-motion'
import { Construction, Sparkles, Sprout } from 'lucide-react'

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <motion.div 
      className="animate-fade-in"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">{title}</h1>
          <p className="text-sm text-neutral-500 mt-1 font-medium">Platform Extension Module</p>
        </div>
      </div>
      
      <div className="card p-20 text-center flex flex-col items-center justify-center bg-white shadow-card overflow-hidden relative">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-48 h-48 bg-gold-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 rounded-[2.5rem] bg-neutral-50 flex items-center justify-center mb-8 shadow-sm ring-1 ring-neutral-100">
            <Construction className="w-10 h-10 text-brand-600 opacity-80" />
          </div>
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-50 border border-gold-100 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-gold-600" />
            <span className="text-[10px] font-bold text-gold-700 uppercase tracking-widest">Coming Soon</span>
          </div>
          
          <h3 className="text-2xl font-black text-neutral-900 tracking-tight">Under Construction</h3>
          <p className="text-sm font-medium text-neutral-500 mt-3 max-w-sm leading-relaxed">
            We are working hard to bring the <span className="text-neutral-900 font-bold">{title}</span> functionality to your dashboard. 
            This module will be part of the Phase 2 rollout.
          </p>
          
          <div className="mt-10 flex items-center gap-2 text-neutral-400 font-bold text-[10px] uppercase tracking-widest">
            <Sprout className="w-3 h-3 text-brand-500" />
            Building for precision agriculture
          </div>
        </div>
      </div>
    </motion.div>
  )
}
