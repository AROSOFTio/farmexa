import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, X, Calendar, User, Search, Download } from 'lucide-react'
import { toast } from 'sonner'
import { hrService, AttendanceRecord } from '@/services/hrService'
import { branchService } from '@/services/branchService'

export function AttendancePage() {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  })

  // Fetch active employees
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => hrService.getEmployees({ is_active: true }),
  })

  // Fetch attendance records
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance', selectedDate, selectedBranch],
    queryFn: () => hrService.getAttendance({
      date: selectedDate,
      branch_id: selectedBranch ? Number(selectedBranch) : undefined
    }),
  })

  // Form Setup
  const { register, handleSubmit, reset } = useForm<Partial<AttendanceRecord>>()

  // Mutation
  const recordMutation = useMutation({
    mutationFn: (payload: Partial<AttendanceRecord>) => hrService.recordAttendance(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      toast.success('Attendance recorded successfully')
      setIsModalOpen(false)
      reset()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to record attendance')
    }
  })

  // Handlers
  const onSubmitForm = (data: Partial<AttendanceRecord>) => {
    const formatted = {
      ...data,
      employee_id: Number(data.employee_id),
      branch_id: data.branch_id ? Number(data.branch_id) : undefined,
      hours_worked: data.hours_worked ? Number(data.hours_worked) : undefined,
      clock_in: data.clock_in ? `${selectedDate}T${data.clock_in}:00Z` : undefined,
      clock_out: data.clock_out ? `${selectedDate}T${data.clock_out}:00Z` : undefined,
      date: selectedDate
    }
    recordMutation.mutate(formatted)
  }

  const handleExportCSV = () => {
    const headers = 'Employee,Department,Date,Clock In,Clock Out,Hours Worked,Notes\n'
    const rows = records
      .map((r) =>
        [
          r.employee?.full_name,
          r.employee?.department || '—',
          r.date,
          r.clock_in ? new Date(r.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
          r.clock_out ? new Date(r.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
          r.hours_worked || '—',
          r.notes || '—',
        ]
          .map((val) => `"${String(val).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n')

    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `attendance-${selectedDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex-1 space-y-6 p-8 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Attendance</h1>
          <p className="text-sm text-slate-500">Record and track daily employee check-ins and hours.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            disabled={records.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Record Attendance
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Branch Filter */}
        <div className="w-[180px]">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500">
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4 text-center">Clock In</th>
                <th className="px-6 py-4 text-center">Clock Out</th>
                <th className="px-6 py-4 text-center">Hours Worked</th>
                <th className="px-6 py-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Loading attendance records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No attendance recorded for this date and branch.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {r.employee?.full_name}
                      <div className="text-[10px] text-slate-500 font-mono">{r.employee?.employee_number}</div>
                    </td>
                    <td className="px-6 py-4">
                      {r.employee?.department || '—'}
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-xs text-slate-600">
                      {r.clock_in ? new Date(r.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-xs text-slate-600">
                      {r.clock_out ? new Date(r.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-emerald-700">
                      {r.hours_worked ? `${r.hours_worked} hrs` : '—'}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 max-w-[200px] truncate">
                      {r.notes || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Attendance Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-sm w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-lg">Record Attendance</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmitForm)} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Employee *</label>
                <select
                  required
                  {...register('employee_id')}
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">Branch</label>
                <select
                  {...register('branch_id')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                >
                  <option value="">No Branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Clock In Time</label>
                  <input
                    type="time"
                    {...register('clock_in')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Clock Out Time</label>
                  <input
                    type="time"
                    {...register('clock_out')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Hours Worked</label>
                <input
                  type="number"
                  step="0.01"
                  {...register('hours_worked')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                <textarea
                  rows={2}
                  {...register('notes')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
