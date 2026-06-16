import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, Edit2, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { branchService, Branch, BranchCreate, BranchUpdate } from '@/services/branchService'
import { useAuth } from '@/features/auth/AuthContext'
import { SEO } from '@/components/SEO'

const BRANCH_TYPES = [
  { value: 'farm', label: 'Farm' },
  { value: 'head_office', label: 'Head Office' },
  { value: 'hatchery', label: 'Hatchery' },
  { value: 'processing_plant', label: 'Processing Plant' },
  { value: 'retail', label: 'Retail' },
  { value: 'warehouse', label: 'Warehouse' },
]

export function BranchesPage() {
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null)

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['settings-branches'],
    queryFn: branchService.getBranches,
  })

  const createForm = useForm<BranchCreate>({ defaultValues: { type: 'farm', is_active: true } })
  const editForm = useForm<BranchUpdate>()

  const createMutation = useMutation({
    mutationFn: branchService.createBranch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-branches'] })
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      toast.success('Branch created successfully.')
      setIsCreateOpen(false)
      createForm.reset({ type: 'farm', is_active: true })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to create branch.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: BranchUpdate }) =>
      branchService.updateBranch(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-branches'] })
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      toast.success('Branch updated successfully.')
      setEditingBranch(null)
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to update branch.'),
  })

  const deleteMutation = useMutation({
    mutationFn: branchService.deleteBranch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-branches'] })
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      toast.success('Branch deleted.')
      setDeletingBranch(null)
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to delete branch.'),
  })

  const openEdit = (branch: Branch) => {
    editForm.reset({
      name: branch.name,
      branch_code: branch.branch_code,
      type: branch.type,
      address: branch.address ?? '',
      contact_person: branch.contact_person ?? '',
      contact_phone: branch.contact_phone ?? '',
      is_active: branch.is_active,
    })
    setEditingBranch(branch)
  }

  const canManage = hasPermission('branches:write')

  return (
    <>
      <SEO title="Branch Management" description="Manage farm branches and locations" />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Branch Management</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage physical locations, branches, or store fronts for this workspace.
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => { createForm.reset({ type: 'farm', is_active: true }); setIsCreateOpen(true) }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              Add Branch
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Address</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                    {canManage && <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
                  {branches.map((branch) => (
                    <tr key={branch.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-mono font-medium text-slate-900 dark:text-white">
                        {branch.branch_code}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
                        {branch.name}
                        {branch.is_default && (
                          <span className="ml-2 inline-flex rounded-full bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">default</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500 dark:text-slate-400 capitalize">
                        {branch.type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {branch.address || '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${branch.is_active ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300' : 'bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-300'}`}>
                          {branch.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {canManage && (
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-3">
                            <button onClick={() => openEdit(branch)} className="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300" title="Edit">
                              <Edit2 className="h-4 w-4" />
                            </button>
                            {!branch.is_default && (
                              <button onClick={() => setDeletingBranch(branch)} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" title="Delete">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {branches.length === 0 && (
                    <tr>
                      <td colSpan={canManage ? 6 : 5} className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        <Building2 className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
                        No branches configured yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
              <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">Add New Branch</h2>
              <form onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Branch Name *</label>
                  <input {...createForm.register('name', { required: true })} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Code (e.g. HQ, WH1) *</label>
                  <input {...createForm.register('branch_code', { required: true })} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Type</label>
                  <select {...createForm.register('type')} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                    {BRANCH_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Address</label>
                  <input {...createForm.register('address')} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Contact Person</label>
                  <input {...createForm.register('contact_person')} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Contact Phone</label>
                  <input {...createForm.register('contact_phone')} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="create_is_active" {...createForm.register('is_active')} defaultChecked className="rounded border-slate-300 text-brand-500 focus:ring-brand-500" />
                  <label htmlFor="create_is_active" className="text-sm text-slate-700 dark:text-slate-300">Active</label>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">Cancel</button>
                  <button type="submit" disabled={createMutation.isPending} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
                    {createMutation.isPending ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingBranch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
              <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">Edit Branch</h2>
              <form onSubmit={editForm.handleSubmit((data) => updateMutation.mutate({ id: editingBranch.id, payload: data }))} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Branch Name *</label>
                  <input {...editForm.register('name', { required: true })} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Code *</label>
                  <input {...editForm.register('branch_code', { required: true })} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Type</label>
                  <select {...editForm.register('type')} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                    {BRANCH_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Address</label>
                  <input {...editForm.register('address')} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Contact Person</label>
                  <input {...editForm.register('contact_person')} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Contact Phone</label>
                  <input {...editForm.register('contact_phone')} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="edit_is_active" {...editForm.register('is_active')} className="rounded border-slate-300 text-brand-500 focus:ring-brand-500" />
                  <label htmlFor="edit_is_active" className="text-sm text-slate-700 dark:text-slate-300">Active</label>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setEditingBranch(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">Cancel</button>
                  <button type="submit" disabled={updateMutation.isPending} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
                    {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirm */}
        {deletingBranch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
              <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">Delete Branch</h2>
              <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
                Are you sure you want to delete <strong>{deletingBranch.name}</strong> ({deletingBranch.branch_code})? This cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setDeletingBranch(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">Cancel</button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(deletingBranch.id)}
                  disabled={deleteMutation.isPending}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
