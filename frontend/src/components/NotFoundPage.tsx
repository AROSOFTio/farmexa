import { Link } from 'react-router-dom'
import { Home, Compass, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'

export function NotFoundPage() {
  return (
    <motion.div 
      className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="relative mb-12">
        <div className="text-[12rem] font-black text-neutral-100/60 leading-none select-none tracking-tighter">404</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-white shadow-xl flex items-center justify-center">
            <Compass className="w-12 h-12 text-brand-600 animate-pulse-soft" />
          </div>
        </div>
      </div>

      <h2 className="text-3xl font-black text-neutral-900 tracking-tight mb-3">Lost in the farm?</h2>
      <p className="text-base font-medium text-neutral-500 mb-10 max-w-sm leading-relaxed">
        The page you are looking for has either migrated or doesn&apos;t exist in this system environment.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Link to="/dashboard" className="btn-primary px-8 py-3.5 rounded-xl font-bold shadow-glow flex items-center gap-2">
          <Home className="w-4.5 h-4.5" />
          Back to Dashboard
        </Link>
        <button 
          onClick={() => window.history.back()}
          className="btn-secondary px-8 py-3.5 rounded-xl font-bold flex items-center gap-2"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
          Go Back
        </button>
      </div>
    </motion.div>
  )
}
