import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Plus, Calendar, Briefcase, FileText, CheckCircle2, ChevronRight,
  ChevronDown, X, Download, RefreshCw, AlertCircle, Coins
} from 'lucide-react'
import { toast } from 'sonner'
import { hrService, PayrollPeriod, PayrollLine } from '@/services/hrService'
import { branchService } from '@/services/branchService'
import { UGX } from '@/lib/money'

export function PayrollPage() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [expandedPeriodId, setExpandedPeriodId] = useState<number | null>(null)

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  })

  // Fetch payroll periods
  const { data: periods = [], isLoading } = useQuery({
    queryKey: ['payroll-periods'],
    queryFn: () => hrService.getPayrollPeriods(),
  })

  // Fetch lines for expanded period
  const { data: payrollLines = [], isLoading: isLoadingLines } = useQuery({
    queryKey: ['payroll-lines', expandedPeriodId],
    queryFn: () => expandedPeriodId ? hrService.getPayrollLines(expandedPeriodId) : Promise.resolve([]),
    enabled: expandedPeriodId !== null,
  })

  // Form Setup
  const { register, handleSubmit, reset } = useForm<Partial<PayrollPeriod>>()

  // Mutations
  const createPeriodMutation = useMutation({
    mutationFn: (payload: Partial<PayrollPeriod>) => hrService.createPayrollPeriod(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
      toast.success('Payroll period created successfully')
      setIsModalOpen(false)
      reset()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to create period')
    }
  })

  const processMutation = useMutation({
    mutationFn: (id: number) => hrService.processPayrollPeriod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-lines'] })
      toast.success('Payroll processed successfully')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to process payroll')
    }
  })

  const approveMutation = useMutation({
    mutationFn: (id: number) => hrService.approvePayrollPeriod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
      toast.success('Payroll period approved')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to approve period')
    }
  })

  const postJournalsMutation = useMutation({
    mutationFn: (id: number) => hrService.postPayrollJournals(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
      toast.success(data?.message || 'Payroll journals posted and status updated to PAID')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to post journals')
    }
  })

  // Handlers
  const onSubmitForm = (data: Partial<PayrollPeriod>) => {
    const formatted = {
      ...data,
      branch_id: data.branch_id ? Number(data.branch_id) : undefined,
    }
    createPeriodMutation.mutate(formatted)
  }

  const toggleExpandPeriod = (periodId: number) => {
    if (expandedPeriodId === periodId) {
      setExpandedPeriodId(null)
    } else {
      setExpandedPeriodId(periodId)
    }
  }

  const handleDownloadPayslip = (periodId: number, empId: number) => {
    const url = hrService.getPayslipPdfUrl(periodId, empId)
    window.open(url, '_blank')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-slate-100 text-slate-700 border-slate-200'
      case 'processing':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'approved':
        return 'bg-sky-50 text-sky-700 border-sky-200'
      case 'paid':
      case 'closed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="flex-1 space-y-6 p-8 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payroll Periods</h1>
          <p className="text-sm text-slate-500">Run payroll, calculate statutory deductions, and post journals.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Period
        </button>
      </div>

      {/* Main periods table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500">
                <th className="px-6 py-4 w-12"></th>
                <th className="px-6 py-4">Period Name</th>
                <th className="px-6 py-4">Branch</th>
                <th className="px-6 py-4">Dates</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions / Workflows</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Loading payroll periods...
                  </td>
                </tr>
              ) : periods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No periods defined. Create a new one to start.
                  </td>
                </tr>
              ) : (
                periods.map((p) => {
                  const isExpanded = expandedPeriodId === p.id
                  return (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-slate-50/30 transition-colors cursor-pointer" onClick={() => toggleExpandPeriod(p.id)}>
                        <td className="px-6 py-4 text-center">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {p.period_name}
                        </td>
                        <td className="px-6 py-4">
                          {branches.find(b => b.id === p.branch_id)?.name || 'All Branches (Global)'}
                        </td>
                        <td className="px-6 py-4">
                          {p.start_date} to {p.end_date}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium uppercase border ${getStatusBadge(p.status)}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2 items-center">
                            {p.status === 'draft' && (
                              <button
                                onClick={() => processMutation.mutate(p.id)}
                                disabled={processMutation.isPending}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                              >
                                <RefreshCw className="h-3 w-3 animate-spin-slow" />
                                Process
                              </button>
                            )}
                            {p.status === 'processing' && (
                              <button
                                onClick={() => {
                                  if (window.confirm('Approve this payroll? This confirms that the calculations are final.')) {
                                    approveMutation.mutate(p.id)
                                  }
                                }}
                                disabled={approveMutation.isPending}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                              >
                                Approve
                              </button>
                            )}
                            {p.status === 'approved' && (
                              <button
                                onClick={() => {
                                  if (window.confirm('Post general ledger journals for this payroll? This will book salaries, PAYE payables, and NSSF/NHIF accrued amounts.')) {
                                    postJournalsMutation.mutate(p.id)
                                  }
                                }}
                                disabled={postJournalsMutation.isPending}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                              >
                                <Coins className="h-3 w-3" />
                                Post Journals
                              </button>
                            )}
                            {(p.status === 'paid' || p.status === 'closed') && (
                              <span className="text-xs text-slate-500 font-semibold italic flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Complete
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Section */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-slate-50/50 p-6 border-t border-b border-slate-100">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-bold text-slate-800 text-sm">Calculated Payroll Lines</h4>
                                {(p.status === 'processing' || p.status === 'approved') && (
                                  <button
                                    onClick={() => processMutation.mutate(p.id)}
                                    className="text-xs text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-1"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" /> Re-Process
                                  </button>
                                )}
                              </div>
                              <div className="bg-white rounded-lg border border-slate-150 shadow-sm overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/40 text-[10px] font-bold uppercase text-slate-400">
                                      <th className="px-4 py-3">Employee</th>
                                      <th className="px-4 py-3 text-right">Basic Pay</th>
                                      <th className="px-4 py-3 text-right">Gross Pay</th>
                                      <th className="px-4 py-3 text-right text-rose-500">PAYE Tax</th>
                                      <th className="px-4 py-3 text-right text-rose-500">NSSF (5%)</th>
                                      <th className="px-4 py-3 text-right text-rose-500">NHIF</th>
                                      <th className="px-4 py-3 text-right text-emerald-600 font-bold">Net Pay</th>
                                      <th className="px-4 py-3 text-center">GL Journal</th>
                                      <th className="px-4 py-3 text-right">Payslip</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                                    {isLoadingLines ? (
                                      <tr>
                                        <td colSpan={9} className="text-center py-6 text-slate-400">
                                          Loading lines...
                                        </td>
                                      </tr>
                                    ) : payrollLines.length === 0 ? (
                                      <tr>
                                        <td colSpan={9} className="text-center py-6 text-slate-400">
                                          No lines processed. Click 'Process' above.
                                        </td>
                                      </tr>
                                    ) : (
                                      payrollLines.map((line) => (
                                        <tr key={line.id} className="hover:bg-slate-50/40">
                                          <td className="px-4 py-3 font-semibold text-slate-900">
                                            {line.employee?.full_name}
                                            <div className="text-[10px] text-slate-500 font-mono">{line.employee?.employee_number}</div>
                                          </td>
                                          <td className="px-4 py-3 text-right font-mono">{UGX(line.basic_salary)}</td>
                                          <td className="px-4 py-3 text-right font-mono">{UGX(line.gross_pay)}</td>
                                          <td className="px-4 py-3 text-right font-mono text-rose-600">{UGX(line.paye_tax)}</td>
                                          <td className="px-4 py-3 text-right font-mono text-rose-600">{UGX(line.nssf_employee)}</td>
                                          <td className="px-4 py-3 text-right font-mono text-rose-600">{UGX(line.nhif_employee)}</td>
                                          <td className="px-4 py-3 text-right font-mono text-emerald-700 font-bold">{UGX(line.net_pay)}</td>
                                          <td className="px-4 py-3 text-center">
                                            {line.journal_entry_id ? (
                                              <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded border text-slate-600">
                                                Posted JE
                                              </span>
                                            ) : (
                                              <span className="text-[10px] italic text-slate-400">Pending</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-right">
                                            <button
                                              onClick={() => handleDownloadPayslip(p.id, line.employee_id)}
                                              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-800"
                                            >
                                              <Download className="h-3 w-3" /> PDF
                                            </button>
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Period Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-lg">New Payroll Period</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmitForm)} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Period Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. June 2026"
                  {...register('period_name')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    {...register('start_date')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    {...register('end_date')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Branch (Scope)</label>
                <select
                  {...register('branch_id')}
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
                  disabled={createPeriodMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm"
                >
                  Create Period
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
