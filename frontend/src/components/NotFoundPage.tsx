import { Link } from 'react-router-dom'
import { ArrowLeft, Compass, Home } from 'lucide-react'
import { motion } from 'framer-motion'

export function NotFoundPage() {
  return (
    <motion.div
      className="flex min-h-[72vh] flex-col items-center justify-center px-4 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="relative mb-12">
        <div className="select-none font-display text-[9rem] font-semibold leading-none tracking-[-0.08em] text-brand-100 sm:text-[11rem]">
          404
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-brand-100 bg-white shadow-card">
            <Compass className="h-11 w-11 text-brand-600 animate-pulse-soft" />
          </div>
        </div>
      </div>

      <h2 className="text-3xl font-semibold text-ink-900">Page not found</h2>
      <p className="mt-3 max-w-md text-base text-ink-500">This page is unavailable.</p>

      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
        <Link to="/dashboard" className="btn-primary btn-lg">
          <Home className="h-4.5 w-4.5" />
          Dashboard
        </Link>
        <button type="button" onClick={() => window.history.back()} className="btn-secondary btn-lg">
          <ArrowLeft className="h-4.5 w-4.5" />
          Back
        </button>
      </div>
    </motion.div>
  )
}
