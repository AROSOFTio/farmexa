import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, KeyRound, MailCheck, Send } from 'lucide-react'
import { toast } from 'sonner'

import api from '@/services/api'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'

function PublicShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { settings } = usePlatformSettings()
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(218,165,32,0.16),transparent_32%),#f7f8fb] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl items-center">
        <div className="card w-full p-8">
          <div className="mb-8">
            <div className="text-sm font-bold uppercase tracking-[0.24em] text-brand-700">{settings.system_name}</div>
            <h1 className="mt-3 text-3xl font-black text-ink-900">{title}</h1>
            <p className="mt-2 text-base text-ink-500">{subtitle}</p>
          </div>
          {children}
          <p className="mt-8 text-sm text-ink-500">
            Need help? Contact <span className="font-semibold text-ink-900">{settings.support_email}</span>.
          </p>
        </div>
      </div>
    </main>
  )
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const mutation = useMutation({
    mutationFn: () => api.post('/auth/forgot-password', { email }),
    onSuccess: () => toast.success('Password reset email queued.'),
    onError: (error: any) => toast.error(error?.response?.data?.detail ?? 'Unable to request password reset.'),
  })

  return (
    <PublicShell title="Reset your password" subtitle="Enter your account email and Farmexa will send the reset instructions.">
      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
        <div>
          <label className="form-label">Email address</label>
          <input className="form-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <button className="btn-primary w-full" disabled={mutation.isPending} type="submit">
          <Send className="h-4 w-4" />
          {mutation.isPending ? 'Sending...' : 'Send reset link'}
        </button>
      </form>
    </PublicShell>
  )
}

export function ResetPasswordPage() {
  const [form, setForm] = useState({ token: '', password: '', confirm_password: '' })
  const mutation = useMutation({
    mutationFn: () => api.post('/auth/reset-password', form),
    onSuccess: () => toast.success('Password reset completed. You can sign in now.'),
    onError: (error: any) => toast.error(error?.response?.data?.detail ?? 'Unable to reset password.'),
  })

  return (
    <PublicShell title="Set a new password" subtitle="Use the secure reset token from your Farmexa email.">
      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
        <div>
          <label className="form-label">Reset token</label>
          <input className="form-input" value={form.token} onChange={(event) => setForm({ ...form, token: event.target.value })} required />
        </div>
        <div>
          <label className="form-label">New password</label>
          <input className="form-input" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
        </div>
        <div>
          <label className="form-label">Confirm password</label>
          <input className="form-input" type="password" value={form.confirm_password} onChange={(event) => setForm({ ...form, confirm_password: event.target.value })} required />
        </div>
        <button className="btn-primary w-full" disabled={mutation.isPending} type="submit">
          <KeyRound className="h-4 w-4" />
          {mutation.isPending ? 'Saving...' : 'Reset password'}
        </button>
      </form>
    </PublicShell>
  )
}

export function VerifyEmailPage() {
  const [token, setToken] = useState('')
  const mutation = useMutation({
    mutationFn: () => api.post('/auth/verify-email', { token }),
    onSuccess: () => toast.success('Email verified.'),
    onError: (error: any) => toast.error(error?.response?.data?.detail ?? 'Unable to verify email.'),
  })

  return (
    <PublicShell title="Verify email" subtitle="Confirm your email address so your workspace remains secure.">
      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
        <div>
          <label className="form-label">Verification token</label>
          <input className="form-input" value={token} onChange={(event) => setToken(event.target.value)} required />
        </div>
        <button className="btn-primary w-full" disabled={mutation.isPending} type="submit">
          {mutation.isPending ? <MailCheck className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {mutation.isPending ? 'Verifying...' : 'Verify email'}
        </button>
      </form>
    </PublicShell>
  )
}
