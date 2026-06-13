import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Check, X, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { hrService, LeaveRequest, LeaveType } from '@/services/hrService'
import { useAuth } from '@/features/auth/AuthContext'

export function LeavePage() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  // Supervisors/HR can act on other people's requests and file on their behalf.
  const canApprove = hasPermission('hr:leave:approve')
  // HR/admin maintain the leave-type master list.
  const canManageTypes = hasPermission('hr:employee:write')

  const [activeTab, setActiveTab] = useState<'requests' | 'types'>('requests')
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null)
  const [adjustTarget, setAdjustTarget] = useState<LeaveRequest | null>(null)

  // Employees list is only needed (and only permitted) for approvers filing on
  // behalf of staff; self-service users always file for themselves.
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => hrService.getEmployees({ is_active: true }),
    enabled: canApprove,
  })

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => hrService.getLeaveTypes(),
  })

  const { data: leaveRequests = [], isLoading: isLoadingRequests } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => hrService.getLeaveRequests(),
  })

  const { register: registerReq, handleSubmit: handleSubmitReq, reset: resetReq, watch: watchReq, setValue: setValueReq } = useForm<Partial<LeaveRequest>>()
  const reqStartDate = watchReq('start_date')
  const reqEndDate = watchReq('end_date')

  useEffect(() => {
    if (reqStartDate && reqEndDate) {
      const start = new Date(reqStartDate)
      const end = new Date(reqEndDate)
      const diffTime = end.getTime() - start.getTime()
      setValueReq('days_requested', diffTime >= 0 ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 : 0)
    }
  }, [reqStartDate, reqEndDate, setValueReq])

  const { register: registerType, handleSubmit: handleSubmitType, reset: resetType } = useForm<Partial<LeaveType>>()
  const { register: registerReject, handleSubmit: handleSubmitReject, reset: resetReject } = useForm<{ reason: string }>()
  const { register: registerAdjust, handleSubmit: handleSubmitAdjust, reset: resetAdjust } = useForm<{ adjusted_days: number; reason: string }>()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
  const onMutationError = (fallback: string) => (err: any) => toast.error(err.response?.data?.detail || fallback)

  const createRequestMutation = useMutation({
    mutationFn: (payload: Partial<LeaveRequest>) => hrService.createLeaveRequest(payload),
    onSuccess: () => { invalidate(); toast.success('Leave request submitted.'); setIsRequestModalOpen(false); resetReq() },
    onError: onMutationError('Failed to submit leave request'),
  })

  const approveRequestMutation = useMutation({
    mutationFn: (id: number) => hrService.approveLeaveRequest(id),
    onSuccess: () => { invalidate(); toast.success('Leave request approved.') },
    onError: onMutationError('Failed to approve request'),
  })

  const rejectRequestMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => hrService.rejectLeaveRequest(id, reason),
    onSuccess: () => { invalidate(); toast.success('Leave request rejected.'); setRejectTarget(null); resetReject() },
    onError: onMutationError('Failed to reject request'),
  })

  const adjustRequestMutation = useMutation({
    mutationFn: ({ id, adjusted_days, reason }: { id: number; adjusted_days: number; reason: string }) =>
      hrService.adjustLeaveRequest(id, adjusted_days, reason),
    onSuccess: () => { invalidate(); toast.success('Adjustment sent to the employee for acceptance.'); setAdjustTarget(null); resetAdjust() },
    onError: onMutationError('Failed to adjust request'),
  })

  const acceptAdjustmentMutation = useMutation({
    mutationFn: (id: number) => hrService.acceptLeaveAdjustment(id),
    onSuccess: () => { invalidate(); toast.success('Adjusted days accepted — leave approved.') },
    onError: onMutationError('Failed to accept adjustment'),
  })

  const declineAdjustmentMutation = useMutation({
    mutationFn: (id: number) => hrService.declineLeaveAdjustment(id),
    onSuccess: () => { invalidate(); toast.success('Adjustment declined — request cancelled.') },
    onError: onMutationError('Failed to decline adjustment'),
  })

  const createTypeMutation = useMutation({
    mutationFn: (payload: Partial<LeaveType>) => hrService.createLeaveType(payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leave-types'] }); toast.success('Leave type created.'); setIsTypeModalOpen(false); resetType() },
    onError: onMutationError('Failed to create leave type'),
  })

  const onSubmitRequest = (data: Partial<LeaveRequest>) => {
    const formatted: Partial<LeaveRequest> = {
      leave_type_id: Number(data.leave_type_id),
      start_date: data.start_date,
      end_date: data.end_date,
      days_requested: Number(data.days_requested || 0),
      reason: data.reason,
    }
    // Approvers may file on behalf of a selected employee; otherwise the backend
    // pins the request to the caller's own employee record.
    if (canApprove && data.employee_id) formatted.employee_id = Number(data.employee_id)
    createRequestMutation.mutate(formatted)
  }

  const onSubmitType = (data: Partial<LeaveType>) => {
    createTypeMutation.mutate({ ...data, days_per_year: Number(data.days_per_year || 21), is_paid: !!data.is_paid })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'approved': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'rejected': return 'bg-rose-50 text-rose-700 border-rose-200'
      case 'adjusted': return 'bg-sky-50 text-sky-700 border-sky-200'
      default: return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="flex-1 space-y-6 p-8 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Leave Management</h1>
          <p className="text-sm text-slate-500">
            {canApprove
              ? 'Review your team’s leave: approve, reject with a reason, or propose adjusted days.'
              : 'Apply for leave and track the status of your requests.'}
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'requests' ? (
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Apply for Leave
            </button>
          ) : (
            <button
              onClick={() => setIsTypeModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Leave Type
            </button>
          )}
        </div>
      </div>

      {/* Tabs (the leave-type master list is HR/admin only) */}
      {canManageTypes ? (
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${activeTab === 'requests' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Leave Requests
          </button>
          <button
            onClick={() => setActiveTab('types')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${activeTab === 'types' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Leave Types
          </button>
        </div>
      ) : null}

      {/* Content */}
      {activeTab === 'requests' || !canManageTypes ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500">
                  {canApprove ? <th className="px-6 py-4">Employee</th> : null}
                  <th className="px-6 py-4">Leave Type</th>
                  <th className="px-6 py-4">Duration</th>
                  <th className="px-6 py-4 text-center">Days</th>
                  <th className="px-6 py-4">Reason / Note</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {isLoadingRequests ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading requests...</td></tr>
                ) : leaveRequests.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">No leave requests yet.</td></tr>
                ) : (
                  leaveRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/30 transition-colors align-top">
                      {canApprove ? <td className="px-6 py-4 font-semibold text-slate-900">{req.employee?.full_name}</td> : null}
                      <td className="px-6 py-4">{req.leave_type?.name}</td>
                      <td className="px-6 py-4 text-slate-500 text-xs">{req.start_date} to {req.end_date}</td>
                      <td className="px-6 py-4 text-center font-semibold">
                        {req.days_requested}
                        {req.status === 'adjusted' && req.adjusted_days ? (
                          <span className="block text-xs font-medium text-sky-600">&rarr; {req.adjusted_days} proposed</span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 max-w-[240px] text-xs text-slate-500">
                        {req.reason ? <div className="truncate" title={req.reason}>{req.reason}</div> : <span>&mdash;</span>}
                        {req.manager_note ? (
                          <div className="mt-1 text-slate-700"><span className="font-semibold">Supervisor:</span> {req.manager_note}</div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium uppercase border ${getStatusBadge(req.status)}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {/* Supervisor actions on a pending request */}
                        {canApprove && req.status === 'pending' ? (
                          <div className="flex justify-end gap-1">
                            <button onClick={() => approveRequestMutation.mutate(req.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded border border-slate-200" title="Approve">
                              <Check className="h-4 w-4" />
                            </button>
                            <button onClick={() => { resetAdjust({ adjusted_days: req.days_requested, reason: '' }); setAdjustTarget(req) }} className="p-1 text-sky-600 hover:bg-sky-50 rounded border border-slate-200" title="Adjust days">
                              <SlidersHorizontal className="h-4 w-4" />
                            </button>
                            <button onClick={() => { resetReject({ reason: '' }); setRejectTarget(req) }} className="p-1 text-rose-600 hover:bg-rose-50 rounded border border-slate-200" title="Reject">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : canApprove && req.status === 'adjusted' ? (
                          <span className="text-xs text-sky-600 italic">Awaiting employee acceptance</span>
                        ) : !canApprove && req.status === 'adjusted' ? (
                          /* Requester decides on the proposed adjustment */
                          <div className="flex justify-end gap-1">
                            <button onClick={() => acceptAdjustmentMutation.mutate(req.id)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200" title="Accept adjusted days">
                              <Check className="h-3.5 w-3.5" /> Accept
                            </button>
                            <button onClick={() => declineAdjustmentMutation.mutate(req.id)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200" title="Decline adjusted days">
                              <X className="h-3.5 w-3.5" /> Decline
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">{req.status === 'pending' ? 'Awaiting review' : 'No action'}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden max-w-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4 text-center">Days Per Year</th>
                  <th className="px-6 py-4 text-center">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {leaveTypes.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-8 text-slate-400">No leave types configured.</td></tr>
                ) : (
                  leaveTypes.map((type) => (
                    <tr key={type.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{type.name}</td>
                      <td className="px-6 py-4 text-center font-medium">{type.days_per_year} Days</td>
                      <td className="px-6 py-4 text-center">
                        {type.is_paid ? (
                          <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-100">Paid</span>
                        ) : (
                          <span className="inline-flex items-center rounded bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 border border-slate-100">Unpaid</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Apply for Leave Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-lg">Apply for Leave</h3>
              <button onClick={() => setIsRequestModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmitReq(onSubmitRequest)} className="p-6 space-y-4">
              {canApprove ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Employee</label>
                  <select {...registerReq('employee_id')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all">
                    <option value="">Myself</option>
                    {employees.map((e) => (<option key={e.id} value={e.id}>{e.full_name} ({e.employee_number})</option>))}
                  </select>
                  <p className="mt-1 text-xs text-slate-400">Leave blank to file for yourself.</p>
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Leave Type *</label>
                <select required {...registerReq('leave_type_id')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all">
                  <option value="">Select Leave Type</option>
                  {leaveTypes.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date *</label>
                  <input type="date" required {...registerReq('start_date')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">End Date *</label>
                  <input type="date" required {...registerReq('end_date')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Days Requested</label>
                <input type="number" readOnly {...registerReq('days_requested')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 font-semibold focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reason</label>
                <textarea rows={3} {...registerReq('reason')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsRequestModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={createRequestMutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal (reason required) */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-sm w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-lg">Reject Leave</h3>
              <button onClick={() => setRejectTarget(null)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmitReject((data) => rejectRequestMutation.mutate({ id: rejectTarget.id, reason: data.reason }))} className="p-6 space-y-4">
              <p className="text-sm text-slate-500">Let {rejectTarget.employee?.full_name || 'the employee'} know why this request is rejected.</p>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reason *</label>
                <textarea rows={3} required {...registerReject('reason')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setRejectTarget(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={rejectRequestMutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-sm">Reject</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Modal (days + reason; employee must accept) */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-sm w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-lg">Adjust Days</h3>
              <button onClick={() => setAdjustTarget(null)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmitAdjust((data) => adjustRequestMutation.mutate({ id: adjustTarget.id, adjusted_days: Number(data.adjusted_days), reason: data.reason }))} className="p-6 space-y-4">
              <p className="text-sm text-slate-500">Proposing fewer/more days sends it back to {adjustTarget.employee?.full_name || 'the employee'} to accept before it is approved. Original request: {adjustTarget.days_requested} day(s).</p>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Adjusted days *</label>
                <input type="number" min={1} required {...registerAdjust('adjusted_days')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reason *</label>
                <textarea rows={3} required {...registerAdjust('reason')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setAdjustTarget(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={adjustRequestMutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-sm">Send for Acceptance</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Type Modal */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-sm w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-lg">Add Leave Type</h3>
              <button onClick={() => setIsTypeModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmitType(onSubmitType)} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Leave Type Name *</label>
                <input type="text" required placeholder="e.g. Annual Leave, Sick Leave" {...registerType('name')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Days per Year *</label>
                <input type="number" required defaultValue={21} {...registerType('days_per_year')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="is_paid" defaultChecked {...registerType('is_paid')} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <label htmlFor="is_paid" className="text-sm text-slate-700 font-semibold select-none">Is Paid Leave</label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsTypeModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={createTypeMutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm">Add Leave Type</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
