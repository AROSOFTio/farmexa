import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Briefcase,
  CheckCircle,
  Edit2,
  Loader2,
  Lock,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Trash2,
  User as UserIcon,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import { ROLE_LABELS } from '@/lib/branding'
import { useAuth } from '@/features/auth/AuthContext'
import { usersService } from '@/services/usersService'
import { ApiError, Role, User } from '@/types'

const optionalText = (maxLength: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const trimmed = value.trim()
      return trimmed.length ? trimmed : undefined
    },
    z.string().max(maxLength).optional()
  )

const requiredRoleId = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.coerce.number({ required_error: 'Select an access role' }).int().positive('Select an access role')
)

const baseStaffSchema = {
  full_name: z
    .string()
    .trim()
    .min(2, 'Full name required')
    .max(150, 'Use 150 characters or fewer'),
  phone: optionalText(20),
  job_title: optionalText(120),
  role_id: requiredRoleId,
}

const createStaffSchema = z.object({
  ...baseStaffSchema,
  email: z.string().trim().email('Valid email required'),
  password: z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/, 'Must include uppercase')
    .regex(/[0-9]/, 'Must include number'),
})

const updateStaffSchema = z.object({
  ...baseStaffSchema,
})

type CreateStaffForm = z.infer<typeof createStaffSchema>
type UpdateStaffForm = z.infer<typeof updateStaffSchema>

function roleDescriptionFor(roles: Role[], roleId?: number | null) {
  const selected = roles.find((role) => role.id === roleId)
  return selected?.description ?? 'Access roles control permissions. Job title is the office designation shown to the team.'
}

function RoleBadge({ name }: { name: string }) {
  const colors: Record<string, string> = {
    super_manager: 'bg-ink-900 text-white ring-1 ring-ink-900/10',
    developer_admin: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
    tenant_admin: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
    director: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    farm_manager: 'bg-brand-100 text-brand-800 ring-1 ring-brand-200',
    operations_officer: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200',
    production_officer: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
    slaughter_supervisor: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    veterinary_officer: 'bg-lime-50 text-lime-700 ring-1 ring-lime-200',
    inventory_officer: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    procurement_officer: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
    sales_officer: 'bg-neutral-100 text-ink-700 ring-1 ring-neutral-200',
    cashier: 'bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200',
    finance_officer: 'bg-neutral-200 text-ink-800 ring-1 ring-neutral-300',
    compliance_officer: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
    support_staff: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  }

  return <span className={clsx('badge', colors[name] ?? 'badge-neutral')}>{ROLE_LABELS[name] ?? name}</span>
}

function RegisterStaffModal({
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
    watch,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateStaffForm>({
    resolver: zodResolver(createStaffSchema),
  })

  const selectedRoleId = watch('role_id')

  const mutation = useMutation({
    mutationFn: usersService.create,
    onSuccess: () => {
      toast.success('Staff member registered.')
      qc.invalidateQueries({ queryKey: ['users'] })
      reset()
      onClose()
    },
    onError: (error: AxiosError<ApiError>) => {
      toast.error(error.response?.data?.detail ?? 'Failed to register staff member.')
    },
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/35" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-modal"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="flex items-start justify-between border-b border-neutral-100 bg-neutral-50 px-8 py-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-900">Register staff member</h2>
            <p className="mt-1 text-sm text-neutral-500">Create the login, assign the access role, and capture the office title.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2.5 text-neutral-400 transition-all hover:bg-white hover:shadow-sm">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-5 px-8 py-7">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="form-label flex items-center gap-2"><UserIcon className="h-3.5 w-3.5 opacity-50" /> Full name</label>
              <input className="form-input" {...register('full_name')} />
              {errors.full_name ? <p className="form-error">{errors.full_name.message}</p> : null}
            </div>
            <div>
              <label className="form-label flex items-center gap-2"><Mail className="h-3.5 w-3.5 opacity-50" /> Email</label>
              <input className="form-input" type="email" {...register('email')} />
              {errors.email ? <p className="form-error">{errors.email.message}</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="form-label flex items-center gap-2"><Lock className="h-3.5 w-3.5 opacity-50" /> Password</label>
              <input className="form-input" type="password" {...register('password')} />
              {errors.password ? <p className="form-error">{errors.password.message}</p> : null}
            </div>
            <div>
              <label className="form-label flex items-center gap-2"><Phone className="h-3.5 w-3.5 opacity-50" /> Phone</label>
              <input className="form-input" {...register('phone')} />
              {errors.phone ? <p className="form-error">{errors.phone.message}</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="form-label flex items-center gap-2"><Briefcase className="h-3.5 w-3.5 opacity-50" /> Job title</label>
              <input className="form-input" placeholder="Director, Farm Manager, Cashier..." {...register('job_title')} />
              <p className="mt-1 text-xs text-neutral-400">Optional custom office title shown in the staff directory.</p>
              {errors.job_title ? <p className="form-error">{errors.job_title.message}</p> : null}
            </div>
            <div>
              <label className="form-label flex items-center gap-2"><Briefcase className="h-3.5 w-3.5 opacity-50" /> Access role</label>
              <select className="form-input" {...register('role_id')}>
                <option value="">Select an access role...</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {ROLE_LABELS[role.name] ?? role.name}
                  </option>
                ))}
              </select>
              {errors.role_id ? <p className="form-error">{errors.role_id.message}</p> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            {roleDescriptionFor(roles, Number(selectedRoleId))}
          </div>

          <div className="flex gap-4 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 rounded-xl py-3 font-bold">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1 rounded-xl py-3 font-bold shadow-glow">
              {mutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><Plus className="h-4 w-4" /> Register staff</>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function EditStaffModal({
  open,
  onClose,
  roles,
  user,
}: {
  open: boolean
  onClose: () => void
  roles: Role[]
  user: User | null
}) {
  const qc = useQueryClient()
  const {
    register,
    watch,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateStaffForm>({
    resolver: zodResolver(updateStaffSchema),
    defaultValues: {
      full_name: user?.full_name ?? '',
      phone: user?.phone ?? '',
      job_title: user?.job_title ?? '',
      role_id: user?.role?.id ?? undefined,
    },
  })

  useEffect(() => {
    reset({
      full_name: user?.full_name ?? '',
      phone: user?.phone ?? '',
      job_title: user?.job_title ?? '',
      role_id: user?.role?.id ?? undefined,
    })
  }, [reset, user])

  const selectedRoleId = watch('role_id')

  const mutation = useMutation({
    mutationFn: async (values: UpdateStaffForm) => {
      if (!user) throw new Error('No user selected.')
      return usersService.update(user.id, values)
    },
    onSuccess: () => {
      toast.success('Staff profile updated.')
      qc.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
    onError: (error: AxiosError<ApiError>) => {
      toast.error(error.response?.data?.detail ?? 'Failed to update staff profile.')
    },
  })

  if (!open || !user) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/35" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-modal"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="flex items-start justify-between border-b border-neutral-100 bg-neutral-50 px-8 py-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-900">Edit staff profile</h2>
            <p className="mt-1 text-sm text-neutral-500">Update the staff title, contact details, or assigned access role.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2.5 text-neutral-400 transition-all hover:bg-white hover:shadow-sm">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-5 px-8 py-7">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="form-label flex items-center gap-2"><UserIcon className="h-3.5 w-3.5 opacity-50" /> Full name</label>
              <input className="form-input" {...register('full_name')} />
              {errors.full_name ? <p className="form-error">{errors.full_name.message}</p> : null}
            </div>
            <div>
              <label className="form-label flex items-center gap-2"><Phone className="h-3.5 w-3.5 opacity-50" /> Phone</label>
              <input className="form-input" {...register('phone')} />
              {errors.phone ? <p className="form-error">{errors.phone.message}</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="form-label flex items-center gap-2"><Briefcase className="h-3.5 w-3.5 opacity-50" /> Job title</label>
              <input className="form-input" placeholder="Director, Farm Manager, Cashier..." {...register('job_title')} />
              {errors.job_title ? <p className="form-error">{errors.job_title.message}</p> : null}
            </div>
            <div>
              <label className="form-label flex items-center gap-2"><Briefcase className="h-3.5 w-3.5 opacity-50" /> Access role</label>
              <select className="form-input" {...register('role_id')}>
                <option value="">Select an access role...</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {ROLE_LABELS[role.name] ?? role.name}
                  </option>
                ))}
              </select>
              {errors.role_id ? <p className="form-error">{errors.role_id.message}</p> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            {roleDescriptionFor(roles, Number(selectedRoleId))}
          </div>

          <div className="flex gap-4 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 rounded-xl py-3 font-bold">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1 rounded-xl py-3 font-bold shadow-glow">
              {mutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><Edit2 className="h-4 w-4" /> Save changes</>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export function UsersPage() {
  const { hasPermission, user: me } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)

  const handleSearchChange = (value: string) => {
    setSearch(value)
    clearTimeout((window as { _searchTimer?: number })._searchTimer)
    ;(window as { _searchTimer?: number })._searchTimer = window.setTimeout(() => {
      setDebouncedSearch(value)
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
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => usersService.update(id, { is_active }),
    onSuccess: () => {
      toast.success('User status updated.')
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => toast.error('Failed to update user.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersService.delete(id),
    onSuccess: () => {
      toast.success('Staff member removed.')
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => toast.error('Failed to remove staff member.'),
  })

  const totalPages = usersData?.pages ?? 1
  const columnCount = hasPermission('users:write') ? 6 : 5

  const headerBadge = useMemo(() => {
    if (!usersData) return '...'
    return `${usersData.total} Staff`
  }, [usersData])

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Team &amp; Staff</h1>
          <p className="mt-1 text-sm font-medium text-neutral-500">Register staff members, set access roles, and keep job titles organized per tenant.</p>
        </div>
        {hasPermission('users:write') ? (
          <button
            className="btn-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-glow"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-4 w-4" />
            Register staff
          </button>
        ) : null}
      </div>

      <div className="card mb-6 flex items-center gap-4 border-neutral-150 px-6 py-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            className="form-input bg-white pl-10"
            placeholder="Search staff, email, or title"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
          />
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500">
          <Users className="h-3.5 w-3.5" />
          {headerBadge}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Staff Member</th>
                <th>Job Title</th>
                <th>Access Role</th>
                <th>Status</th>
                <th>Joined On</th>
                {hasPermission('users:write') ? <th className="pr-6 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, rowIndex) => (
                  <tr key={rowIndex}>
                    {Array.from({ length: columnCount }).map((_, cellIndex) => (
                      <td key={cellIndex} className={cellIndex === 0 ? 'pl-6' : ''}>
                        <div className="h-4 animate-pulse rounded bg-neutral-50" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : usersData?.items.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="py-24 text-center">
                    <div className="mx-auto flex max-w-xs flex-col items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-neutral-50">
                        <Users className="h-8 w-8 text-neutral-200" />
                      </div>
                      <p className="text-sm font-bold text-neutral-800">{debouncedSearch ? 'No staff found' : 'No staff registered yet'}</p>
                      <p className="text-xs text-neutral-400">{debouncedSearch ? 'Try another name, title, or email.' : 'Create the first tenant staff account to get started.'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                usersData?.items.map((user: User, index: number) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="group"
                  >
                    <td className="pl-6">
                      <div className="flex items-center gap-3 py-1">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xs font-bold text-brand-700 transition-colors group-hover:bg-brand-100">
                          {user.full_name
                            .split(' ')
                            .map((name) => name[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-neutral-900">{user.full_name}</div>
                          <div className="text-xs font-medium text-neutral-500">{user.email}</div>
                          {user.id === me?.id ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">You</span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="text-sm font-medium text-neutral-600">
                      {user.job_title ? user.job_title : <span className="text-neutral-300">Not set</span>}
                    </td>
                    <td>{user.role ? <RoleBadge name={user.role.name} /> : <span className="text-neutral-300">-</span>}</td>
                    <td>
                      <div
                        className={clsx(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                          user.is_active
                            ? 'border-emerald-100 bg-emerald-50 text-emerald-600'
                            : 'border-neutral-150 bg-neutral-50 text-neutral-400'
                        )}
                      >
                        <span className={clsx('h-1.5 w-1.5 rounded-full', user.is_active ? 'bg-emerald-500' : 'bg-neutral-300')} />
                        {user.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </td>
                    <td className="text-xs font-medium text-neutral-400">{format(new Date(user.created_at), 'MMM dd, yyyy')}</td>
                    {hasPermission('users:write') ? (
                      <td className="pr-6 text-right">
                        <div className="relative inline-block">
                          <button
                            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100"
                            onClick={() => setMenuOpenId(menuOpenId === user.id ? null : user.id)}
                          >
                            <MoreHorizontal className="h-4.5 w-4.5" />
                          </button>
                          <AnimatePresence>
                            {menuOpenId === user.id ? (
                              <>
                                <div className="fixed inset-0 z-30" onClick={() => setMenuOpenId(null)} />
                                <motion.div
                                  className="absolute right-0 top-full z-40 mt-1.5 w-52 overflow-hidden rounded-2xl border border-neutral-150 bg-white py-2 shadow-modal"
                                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                >
                                  <button
                                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                                    onClick={() => {
                                      setMenuOpenId(null)
                                      setEditUser(user)
                                    }}
                                  >
                                    <Edit2 className="h-4 w-4 text-neutral-400" />
                                    Edit details
                                  </button>
                                  <button
                                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                                    onClick={() => {
                                      setMenuOpenId(null)
                                      toggleActiveMutation.mutate({ id: user.id, is_active: !user.is_active })
                                    }}
                                  >
                                    {user.is_active ? (
                                      <>
                                        <XCircle className="h-4 w-4 text-neutral-400" />
                                        Deactivate user
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                                        Activate user
                                      </>
                                    )}
                                  </button>
                                  {hasPermission('users:delete') && user.id !== me?.id ? (
                                    <button
                                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                                      onClick={() => {
                                        setMenuOpenId(null)
                                        if (confirm(`Remove ${user.full_name}? This cannot be undone.`)) {
                                          deleteMutation.mutate(user.id)
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Remove access
                                    </button>
                                  ) : null}
                                </motion.div>
                              </>
                            ) : null}
                          </AnimatePresence>
                        </div>
                      </td>
                    ) : null}
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50/50 px-6 py-4">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button className="btn-secondary btn-sm rounded-lg font-bold" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
                Previous
              </button>
              <button className="btn-secondary btn-sm rounded-lg font-bold" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {showAddModal ? <RegisterStaffModal open={showAddModal} onClose={() => setShowAddModal(false)} roles={roles} /> : null}
      </AnimatePresence>
      <AnimatePresence>
        {editUser ? <EditStaffModal open={!!editUser} onClose={() => setEditUser(null)} roles={roles} user={editUser} /> : null}
      </AnimatePresence>
    </div>
  )
}
