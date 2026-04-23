import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Plus, Search, Filter, MoreHorizontal,
  Edit2, Trash2, ShieldCheck, X, CheckCircle, XCircle, Loader2,
  Mail, Phone, Briefcase, Lock, User as UserIcon
} from 'lucide-react'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import { usersService } from '@/services/usersService'
import { useAuth } from '@/features/auth/AuthContext'
import { User, Role, ApiError } from '@/types'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import { ROLE_LABELS } from '@/lib/branding'

// ── Schemas ───────────────────────────────────────────────────

const createUserSchema = z.object({
  email: z.string().email('Valid email required'),
  full_name: z.string().min(2, 'Full name required'),
  password: z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/, 'Must include uppercase')
    .regex(/[0-9]/, 'Must include number'),
  phone: z.string().optional(),
  role_id: z.coerce.number({ required_error: 'Select a role' }),
})
type CreateUserForm = z.infer<typeof createUserSchema>

// ── Role badge ────────────────────────────────────────────────

function RoleBadge({ name }: { name: string }) {
  const colors: Record<string, string> = {
    super_manager: 'bg-ink-900 text-white ring-1 ring-ink-900/10',
    farm_manager: 'bg-brand-100 text-brand-800 ring-1 ring-brand-200',
    inventory_officer: 'bg-brand-50 text-brand-700 ring-1 ring-brand-150',
    sales_officer: 'bg-neutral-100 text-ink-700 ring-1 ring-neutral-200',
    finance_officer: 'bg-neutral-200 text-ink-800 ring-1 ring-neutral-300',
  }
  return (
    <span className={clsx('badge', colors[name] ?? 'badge-neutral')}>
      {ROLE_LABELS[name] ?? name}
    </span>
  )
}

// ── Add User Modal ────────────────────────────────────────────

function AddUserModal({
  open,
  onClose,
  roles,
}: {
  open: boolean
  onClose: () => void
  roles: Role[]
}) {
  const qc = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserForm>({ resolver: zodResolver(createUserSchema) })

  const mutation = useMutation({
    mutationFn: usersService.create,
    onSuccess: () => {
      toast.success('User created successfully.')
      qc.invalidateQueries({ queryKey: ['users'] })
      reset()
      onClose()
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.detail ?? 'Failed to create user.')
    },
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative bg-white rounded-3xl shadow-modal w-full max-w-lg overflow-hidden"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="px-8 py-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 tracking-tight">Add New User</h2>
            <p className="text-xs font-medium text-neutral-400 mt-1">Configure access for a new team member</p>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-white hover:shadow-sm text-neutral-400 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form
          onSubmit={handleSubmit((d) => mutation.mutate(d))}
          className="px-8 py-7 flex flex-col gap-5"
        >
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="form-label flex items-center gap-2"><UserIcon className="w-3.5 h-3.5 opacity-50" /> Full Name</label>
              <input className="form-input" placeholder="e.g. John Doe" {...register('full_name')} />
              {errors.full_name && <p className="form-error">{errors.full_name.message}</p>}
            </div>
            <div>
              <label className="form-label flex items-center gap-2"><Mail className="w-3.5 h-3.5 opacity-50" /> Email Address</label>
              <input className="form-input" type="email" placeholder="john@farm.com" {...register('email')} />
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="form-label flex items-center gap-2"><Lock className="w-3.5 h-3.5 opacity-50" /> Password</label>
              <input className="form-input" type="password" placeholder="••••••••" {...register('password')} />
              {errors.password && <p className="form-error">{errors.password.message}</p>}
            </div>
            <div>
              <label className="form-label flex items-center gap-2"><Phone className="w-3.5 h-3.5 opacity-50" /> Phone <span className="text-neutral-300 font-normal ml-auto">(optional)</span></label>
              <input className="form-input" placeholder="+256..." {...register('phone')} />
            </div>
          </div>

          <div>
            <label className="form-label flex items-center gap-2"><Briefcase className="w-3.5 h-3.5 opacity-50" /> System Role</label>
            <select className="form-input" {...register('role_id')}>
              <option value="">Select a role…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{ROLE_LABELS[r.name] ?? r.name}</option>
              ))}
            </select>
            {errors.role_id && <p className="form-error">{errors.role_id.message}</p>}
          </div>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 rounded-xl py-3 font-bold">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1 rounded-xl py-3 font-bold shadow-glow">
              {mutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
              ) : (
                <><Plus className="w-4 h-4" /> Create User</>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Users Page ────────────────────────────────────────────────

export function UsersPage() {
  const { hasPermission, user: me } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)

  // Debounce search
  const handleSearchChange = (v: string) => {
    setSearch(v)
    clearTimeout((window as any)._searchTimer)
    ;(window as any)._searchTimer = setTimeout(() => {
      setDebouncedSearch(v)
      setPage(1)
    }, 300)
  }

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', page, debouncedSearch],
    queryFn: () => usersService.list({ page, size: 15, search: debouncedSearch || undefined }),
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: usersService.getRoles,
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      usersService.update(id, { is_active }),
    onSuccess: () => {
      toast.success('User status updated.')
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => toast.error('Failed to update user.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersService.delete(id),
    onSuccess: () => {
      toast.success('User removed.')
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => toast.error('Failed to remove user.'),
  })

  const totalPages = usersData?.pages ?? 1

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Users & Access</h1>
          <p className="text-sm text-neutral-500 mt-1 font-medium">Manage team members and their platform access levels</p>
        </div>
        {hasPermission('users:write') && (
          <button
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-glow"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4" />
            Add New User
          </button>
        )}
      </div>

      <div className="card mb-6 px-6 py-4 flex items-center gap-4 bg-white/50 backdrop-blur-sm border-neutral-150">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            className="form-input pl-10 bg-white"
            placeholder="Search team members..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-500 text-xs font-bold uppercase tracking-wider ml-auto">
          <Users className="w-3.5 h-3.5" />
          {usersData ? `${usersData.total} Total` : '…'}
        </div>
      </div>

      <div className="card overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Team Member</th>
                <th>Email Address</th>
                <th>System Role</th>
                <th>Status</th>
                <th>Joined On</th>
                {hasPermission('users:write') && <th className="pr-6 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: hasPermission('users:write') ? 6 : 5 }).map((_, j) => (
                      <td key={j} className={j === 0 ? "pl-6" : ""}>
                        <div className="h-4 bg-neutral-50 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : usersData?.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3 max-w-xs mx-auto">
                      <div className="w-16 h-16 rounded-3xl bg-neutral-50 flex items-center justify-center">
                        <Users className="w-8 h-8 text-neutral-200" />
                      </div>
                      <p className="text-sm font-bold text-neutral-800">No team members found</p>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        {debouncedSearch ? "Try adjusting your search criteria to find who you're looking for." : "Start by adding your first user to the system."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                usersData?.items.map((user: User, idx: number) => (
                  <motion.tr 
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="group"
                  >
                    <td className="pl-6">
                      <div className="flex items-center gap-3 py-1">
                        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0 group-hover:bg-brand-100 transition-colors">
                          {user.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-neutral-900">{user.full_name}</div>
                          {user.id === me?.id && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">You</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-sm text-neutral-500 font-medium">{user.email}</td>
                    <td>
                      {user.role ? <RoleBadge name={user.role.name} /> : <span className="text-neutral-300">—</span>}
                    </td>
                    <td>
                      <div className={clsx(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        user.is_active ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-neutral-50 text-neutral-400 border border-neutral-150"
                      )}>
                        <span className={clsx("w-1.5 h-1.5 rounded-full", user.is_active ? "bg-emerald-500" : "bg-neutral-300")} />
                        {user.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </td>
                    <td className="text-neutral-400 text-xs font-medium">
                      {format(new Date(user.created_at), 'MMM dd, yyyy')}
                    </td>
                    {hasPermission('users:write') && (
                      <td className="pr-6 text-right">
                        <div className="relative inline-block">
                          <button
                            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-400 transition-colors"
                            onClick={() => setMenuOpenId(menuOpenId === user.id ? null : user.id)}
                          >
                            <MoreHorizontal className="w-4.5 h-4.5" />
                          </button>
                          <AnimatePresence>
                            {menuOpenId === user.id && (
                              <>
                                <div className="fixed inset-0 z-30" onClick={() => setMenuOpenId(null)} />
                                <motion.div 
                                  className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-2xl shadow-modal border border-neutral-150 z-40 py-2 overflow-hidden"
                                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                >
                                  <button
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                                    onClick={() => {
                                      setMenuOpenId(null)
                                      toggleActiveMutation.mutate({ id: user.id, is_active: !user.is_active })
                                    }}
                                  >
                                    {user.is_active ? (
                                      <><XCircle className="w-4 h-4 text-neutral-400" /> Deactivate User</>
                                    ) : (
                                      <><CheckCircle className="w-4 h-4 text-emerald-500" /> Activate User</>
                                    )}
                                  </button>
                                  {hasPermission('users:delete') && user.id !== me?.id && (
                                    <button
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                                      onClick={() => {
                                        setMenuOpenId(null)
                                        if (confirm(`Remove ${user.full_name}? This cannot be undone.`)) {
                                          deleteMutation.mutate(user.id)
                                        }
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4" /> Remove Access
                                    </button>
                                  )}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </td>
                    )}
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-neutral-50/50 border-t border-neutral-100 flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary btn-sm rounded-lg font-bold"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                className="btn-secondary btn-sm rounded-lg font-bold"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <AddUserModal
            open={showAddModal}
            onClose={() => setShowAddModal(false)}
            roles={roles}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
