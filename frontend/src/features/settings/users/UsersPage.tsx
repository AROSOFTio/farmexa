import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Plus, Search, Filter, MoreHorizontal,
  Edit2, Trash2, ShieldCheck, X, CheckCircle, XCircle, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import { usersService } from '@/services/usersService'
import { useAuth } from '@/features/auth/AuthContext'
import { User, Role, ApiError } from '@/types'
import { format } from 'date-fns'

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

const ROLE_LABELS: Record<string, string> = {
  super_manager:     'Super Manager',
  farm_manager:      'Farm Manager',
  inventory_officer: 'Inventory Officer',
  sales_officer:     'Sales Officer',
  finance_officer:   'Finance Officer',
}

function RoleBadge({ name }: { name: string }) {
  const colors: Record<string, string> = {
    super_manager:     'bg-violet-100 text-violet-700',
    farm_manager:      'bg-emerald-100 text-emerald-700',
    inventory_officer: 'bg-sky-100 text-sky-700',
    sales_officer:     'bg-amber-100 text-amber-700',
    finance_officer:   'bg-rose-100 text-rose-700',
  }
  return (
    <span className={`badge ${colors[name] ?? 'badge-neutral'}`}>
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative bg-white rounded-2xl shadow-modal w-full max-w-lg"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Add New User</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Create a user account and assign a role</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form
          onSubmit={handleSubmit((d) => mutation.mutate(d))}
          className="px-6 py-5 flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Full Name</label>
              <input className="form-input" placeholder="John Doe" {...register('full_name')} />
              {errors.full_name && <p className="form-error">{errors.full_name.message}</p>}
            </div>
            <div>
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="john@farm.com" {...register('email')} />
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="Min 8 chars, A+1" {...register('password')} />
              {errors.password && <p className="form-error">{errors.password.message}</p>}
            </div>
            <div>
              <label className="form-label">Phone <span className="text-neutral-400">(optional)</span></label>
              <input className="form-input" placeholder="+256 700 000 000" {...register('phone')} />
            </div>
          </div>

          <div>
            <label className="form-label">Role</label>
            <select className="form-input" {...register('role_id')}>
              <option value="">Select a role…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{ROLE_LABELS[r.name] ?? r.name}</option>
              ))}
            </select>
            {errors.role_id && <p className="form-error">{errors.role_id.message}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
              {mutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
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
    clearTimeout((window as unknown as { _searchTimer?: ReturnType<typeof setTimeout> })._searchTimer)
    ;(window as unknown as { _searchTimer?: ReturnType<typeof setTimeout> })._searchTimer = setTimeout(() => {
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
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="section-title">Users & Access</h1>
          <p className="section-subtitle">Manage team members and their platform roles</p>
        </div>
        {hasPermission('users:write') && (
          <button
            className="btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        )}
      </div>

      {/* Search + Filters */}
      <div className="card mb-5 px-4 py-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="form-input pl-9"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <div className="text-xs text-neutral-400 ml-auto">
          {usersData ? `${usersData.total} user${usersData.total !== 1 ? 's' : ''}` : '…'}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                {hasPermission('users:write') && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: hasPermission('users:write') ? 6 : 5 }).map((_, j) => (
                      <td key={j}>
                        <div className="h-4 bg-neutral-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : usersData?.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-8 h-8 text-neutral-200" />
                      <p className="text-sm font-medium text-neutral-400">No users found</p>
                      {debouncedSearch && (
                        <p className="text-xs text-neutral-400">
                          Try a different search term
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                usersData?.items.map((user: User) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-600/10 flex items-center justify-center text-brand-700 text-xs font-semibold flex-shrink-0">
                          {user.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-neutral-800">{user.full_name}</div>
                          {user.id === me?.id && (
                            <div className="text-2xs text-brand-600 font-medium">You</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-neutral-500">{user.email}</td>
                    <td>
                      {user.role ? <RoleBadge name={user.role.name} /> : <span className="text-neutral-300">—</span>}
                    </td>
                    <td>
                      {user.is_active ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-success" />
                          <span className="text-xs text-success font-medium">Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                          <span className="text-xs text-neutral-400 font-medium">Inactive</span>
                        </div>
                      )}
                    </td>
                    <td className="text-neutral-500 text-xs">
                      {format(new Date(user.created_at), 'dd MMM yyyy')}
                    </td>
                    {hasPermission('users:write') && (
                      <td className="text-right">
                        <div className="relative inline-block">
                          <button
                            className="btn-ghost p-1.5 rounded-lg"
                            onClick={() => setMenuOpenId(menuOpenId === user.id ? null : user.id)}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {menuOpenId === user.id && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setMenuOpenId(null)} />
                              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-modal border border-neutral-150 z-40 py-1 animate-fade-in">
                                <button
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                                  onClick={() => {
                                    setMenuOpenId(null)
                                    toggleActiveMutation.mutate({ id: user.id, is_active: !user.is_active })
                                  }}
                                >
                                  {user.is_active ? (
                                    <><XCircle className="w-4 h-4 text-neutral-400" /> Deactivate</>
                                  ) : (
                                    <><CheckCircle className="w-4 h-4 text-success" /> Activate</>
                                  )}
                                </button>
                                {hasPermission('users:delete') && user.id !== me?.id && (
                                  <button
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-danger-light"
                                    onClick={() => {
                                      setMenuOpenId(null)
                                      if (confirm(`Remove ${user.full_name}? This cannot be undone.`)) {
                                        deleteMutation.mutate(user.id)
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" /> Remove
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-neutral-100 flex items-center justify-between">
            <span className="text-xs text-neutral-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                className="btn-secondary btn-sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                className="btn-secondary btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal */}
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
