import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, Edit2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { branchService, Branch, BranchCreate, BranchUpdate } from '@/services/branchService'
import { useAuth } from '@/features/auth/AuthContext'
import { SEO } from '@/components/SEO'

export function BranchesPage() {
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['settings-branches'],
    queryFn: branchService.getBranches,
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<BranchCreate>()

  const createMutation = useMutation({
    mutationFn: branchService.createBranch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-branches'] })
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      toast.success('Branch created successfully.')
      setIsModalOpen(false)
      reset()
    },
    onError: () => toast.error('Failed to create branch.')
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: BranchUpdate }) => branchService.updateBranch(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-branches'] })
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      toast.success('Branch updated successfully.')
      setEditingBranch(null)
    },
    onError: () => toast.error('Failed to update branch.')
  })

  const onSubmit = (data: BranchCreate) => {
    createMutation.mutate(data)
  }

  const onUpdate = (data: BranchUpdate) => {
    if (editingBranch) {
      updateMutation.mutate({ id: editingBranch.id, payload: data })
    }
  }

  // Use a minimal edit inline form or modal.
  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch)
  }

  const canManageBranches = hasPermission('branches:write')

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
          {canManageBranches ? (
            <button
              onClick={() => { reset(); setIsModalOpen(true) }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              Add Branch
            </button>
          ) : null}
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
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Code</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Location</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Status</th>
                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Edit</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
                  {branches.map((branch) => (
                    <tr key={branch.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
                        {branch.code}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500 dark:text-slate-300">
                        {branch.name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500 dark:text-slate-300">
                        {branch.location || '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${branch.is_active ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300' : 'bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-300'}`}>
                          {branch.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        {canManageBranches ? (
                          <button onClick={() => handleEdit(branch)} className="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300">
                            <Edit2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {branches.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        <Building2 className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
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
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
              <h2 className="mb-4 text-lg font-bold">Add New Branch</h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Branch Name</label>
                  <input {...register('name', { required: true })} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Code (e.g. HQ, WH1)</label>
                  <input {...register('code', { required: true })} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Location (Optional)</label>
                  <input {...register('location')} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="is_active" {...register('is_active')} defaultChecked className="rounded border-slate-300 text-brand-500 focus:ring-brand-500" />
                  <label htmlFor="is_active" className="text-sm text-slate-700 dark:text-slate-300">Active</label>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">Save</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingBranch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
              <h2 className="mb-4 text-lg font-bold">Edit Branch</h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                onUpdate({
                  name: formData.get('name') as string,
                  code: formData.get('code') as string,
                  location: formData.get('location') as string,
                  is_active: formData.get('is_active') === 'on'
                })
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Branch Name</label>
                  <input name="name" defaultValue={editingBranch.name} required className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Code (e.g. HQ, WH1)</label>
                  <input name="code" defaultValue={editingBranch.code} required className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Location (Optional)</label>
                  <input name="location" defaultValue={editingBranch.location || ''} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="is_active" id="edit_is_active" defaultChecked={editingBranch.is_active} className="rounded border-slate-300 text-brand-500 focus:ring-brand-500" />
                  <label htmlFor="edit_is_active" className="text-sm text-slate-700 dark:text-slate-300">Active</label>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setEditingBranch(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">Cancel</button>
                  <button type="submit" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
