import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'

import App from './App'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import './index.css'
import { applyTheme, resolveInitialTheme } from '@/lib/theme'
import { captureReferralFromUrl } from '@/lib/referrals'

applyTheme(resolveInitialTheme())
captureReferralFromUrl()

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => undefined)
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: 'Inter, Manrope, "Segoe UI", system-ui, sans-serif',
              fontSize: '0.9rem',
            },
            classNames: {
              toast: 'shadow-modal',
            },
          }}
          closeButton
        />
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
