import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Check, X, Calendar, User, FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { hrService, LeaveRequest, LeaveType } from '@/services/hrService'

export function LeavePage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'requests' | 'types'>('requests')
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false)

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => hrService.getEmployees({ is_active: true }),
  })

  // Fetch leave types
  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => hrService.getLeaveTypes(),
  })

  // Fetch leave requests
  const { data: leaveRequests = [], isLoading: isLoadingRequests } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => hrService.getLeaveRequests(),
  })

  // Form Setup for Request
  const { register: registerReq, handleSubmit: handleSubmitReq, reset: resetReq, watch: watchReq, setValue: setValueReq } = useForm<Partial<LeaveRequest>>()
  const reqStartDate = watchReq('start_date')
  const reqEndDate = watchReq('end_date')

  // Calculate days automatically when start/end dates change
  useEffect(() => {
    if (reqStartDate && reqEndDate) {
      const start = new Date(reqStartDate)
      const end = new Date(reqEndDate)
      const diffTime = end.getTime() - start.getTime()
      if (diffTime >= 0) {
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        setValueReq('days_requested', diffDays)
      } else {
        setValueReq('days_requested', 0)
      }
    }
  }, [reqStartDate, reqEndDate, setValueReq])

  // Form Setup for Type
  const { register: registerType, handleSubmit: handleSubmitType, reset: resetType } = useForm<Partial<LeaveType>>()

  // Mutations
  const createRequestMutation = useMutation({
    mutationFn: (payload: Partial<LeaveRequest>) => hrService.createLeaveRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
      toast.success('Leave request submitted successfully')
      setIsRequestModalOpen(false)
      resetReq()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to submit leave request')
    }
  })

  const approveRequestMutation = useMutation({
    mutationFn: (id: number) => hrService.approveLeaveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
      toast.success('Leave request approved')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to approve request')
    }
  })

  const rejectRequestMutation = useMutation({
    mutationFn: (id: number) => hrService.rejectLeaveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
      toast.success('Leave request rejected')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to reject request')
    }
  })

  const createTypeMutation = useMutation({
    mutationFn: (payload: Partial<LeaveType>) => hrService.createLeaveType(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] })
      toast.success('Leave type created successfully')
      setIsTypeModalOpen(false)
      resetType()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to create leave type')
    }
  })

  // Handlers
  const onSubmitRequest = (data: Partial<LeaveRequest>) => {
    const formatted = {
      ...data,
      employee_id: Number(data.employee_id),
      leave_type_id: Number(data.leave_type_id),
      days_requested: Number(data.days_requested || 0),
    }
    createRequestMutation.mutate(formatted)
  }

  const onSubmitType = (data: Partial<LeaveType>) => {
    const formatted = {
      ...data,
      days_per_year: Number(data.days_per_year || 21),
      is_paid: !!data.is_paid,
    }
    createTypeMutation.mutate(formatted)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'approved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'rejected':
        return 'bg-rose-50 text-rose-700 border-rose-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="flex-1 space-y-6 p-8 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Leave Management</h1>
          <p className="text-sm text-slate-500">Track and manage employee leave requests and definitions.</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'requests' ? (
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Request
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

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'requests'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Leave Requests
        </button>
        <button
          onClick={() => setActiveTab('types')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'types'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Leave Types
        </button>
      </div>

      {/* Content */}
      {activeTab === 'requests' ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500">
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Leave Type</th>
                  <th className="px-6 py-4">Duration</th>
                  <th className="px-6 py-4 text-center">Days</th>
                  <th className="px-6 py-4">Reason</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {isLoadingRequests ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      Loading requests...
                    </td>
                  </tr>
                ) : leaveRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No leave requests found.
                    </td>
                  </tr>
                ) : (
                  leaveRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {req.employee?.full_name}
                      </td>
                      <td className="px-6 py-4">
                        {req.leave_type?.name}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {req.start_date} to {req.end_date}
                      </td>
                      <td className="px-6 py-4 text-center font-semibold">
                        {req.days_requested}
                      </td>
                      <td className="px-6 py-4 max-w-[200px] truncate text-xs text-slate-500">
                        {req.reason || '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium uppercase border ${getStatusBadge(req.status)}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {req.status === 'pending' ? (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => approveRequestMutation.mutate(req.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded border border-slate-200"
                              title="Approve"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => rejectRequestMutation.mutate(req.id)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded border border-slate-200"
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No action</span>
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
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-slate-400">
                      No leave types configured.
                    </td>
                  </tr>
                ) : (
                  leaveTypes.map((type) => (
                    <tr key={type.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {type.name}
                      </td>
                      <td className="px-6 py-4 text-center font-medium">
                        {type.days_per_year} Days
                      </td>
                      <td className="px-6 py-4 text-center">
                        {type.is_paid ? (
                          <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-100">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 border border-slate-100">
                            Unpaid
                          </span>
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

      {/* New Request Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-lg">Request Leave</h3>
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitReq(onSubmitRequest)} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Employee *</label>
                <select
                  required
                  {...registerReq('employee_id')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Leave Type *</label>
                <select
                  required
                  {...registerReq('leave_type_id')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Leave Type</option>
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    {...registerReq('start_date')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    {...registerReq('end_date')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Days Requested</label>
                <input
                  type="number"
                  readOnly
                  {...registerReq('days_requested')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reason</label>
                <textarea
                  rows={3}
                  {...registerReq('reason')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRequestMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm"
                >
                  Submit Request
                </button>
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
              <button
                onClick={() => setIsTypeModalOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitType(onSubmitType)} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Leave Type Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual Leave, Sick Leave"
                  {...registerType('name')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Days per Year *</label>
                <input
                  type="number"
                  required
                  defaultValue={21}
                  {...registerType('days_per_year')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_paid"
                  defaultChecked
                  {...registerType('is_paid')}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="is_paid" className="text-sm text-slate-700 font-semibold select-none">
                  Is Paid Leave
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTypeModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTypeMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm"
                >
                  Add Leave Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
