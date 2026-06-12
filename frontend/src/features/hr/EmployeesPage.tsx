import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Plus, Edit2, Search, User, Mail, Phone, Calendar, Briefcase,
  Building, CreditCard, FileText, Ban, CheckCircle2, ChevronRight, X
} from 'lucide-react'
import { toast } from 'sonner'
import { hrService, Employee } from '@/services/hrService'
import { branchService } from '@/services/branchService'
import { UGX } from '@/lib/money'

export function EmployeesPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('active')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  })

  // Fetch employees
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees', selectedBranch, selectedStatus],
    queryFn: () => hrService.getEmployees({
      branch_id: selectedBranch ? Number(selectedBranch) : undefined,
      is_active: selectedStatus === 'active' ? true : selectedStatus === 'inactive' ? false : undefined
    }),
  })

  // Form Setup
  const { register, handleSubmit, reset } = useForm<Partial<Employee>>()

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: Partial<Employee>) => hrService.createEmployee(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employee created successfully')
      setIsModalOpen(false)
      reset()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to create employee')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Employee> }) =>
      hrService.updateEmployee(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employee updated successfully')
      setIsModalOpen(false)
      setEditingEmployee(null)
      reset()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to update employee')
    }
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => hrService.deactivateEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employee deactivated successfully')
      if (selectedEmployee) setSelectedEmployee(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to deactivate employee')
    }
  })

  // Handlers
  const handleOpenNewModal = () => {
    setEditingEmployee(null)
    reset({
      full_name: '',
      email: '',
      phone: '',
      national_id: '',
      date_of_birth: undefined,
      gender: 'male',
      employment_type: 'permanent',
      job_title: '',
      department: '',
      date_joined: new Date().toISOString().split('T')[0],
      basic_salary: 0,
      bank_name: '',
      bank_account_number: '',
      bank_branch: '',
      nssf_number: '',
      nhif_number: '',
      tin_number: '',
      notes: '',
      branch_id: undefined
    })
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (emp: Employee, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingEmployee(emp)
    reset({
      full_name: emp.full_name,
      email: emp.email || '',
      phone: emp.phone || '',
      national_id: emp.national_id || '',
      date_of_birth: emp.date_of_birth || undefined,
      gender: emp.gender || 'male',
      employment_type: emp.employment_type || 'permanent',
      job_title: emp.job_title || '',
      department: emp.department || '',
      date_joined: emp.date_joined || '',
      basic_salary: emp.basic_salary || 0,
      bank_name: emp.bank_name || '',
      bank_account_number: emp.bank_account_number || '',
      bank_branch: emp.bank_branch || '',
      nssf_number: emp.nssf_number || '',
      nhif_number: emp.nhif_number || '',
      tin_number: emp.tin_number || '',
      notes: emp.notes || '',
      branch_id: emp.branch_id
    })
    setIsModalOpen(true)
  }

  const handleDeactivate = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to deactivate this employee? This will set their termination date to today.')) {
      deactivateMutation.mutate(id)
    }
  }

  const onSubmitForm = (data: Partial<Employee>) => {
    const formatted = {
      ...data,
      basic_salary: Number(data.basic_salary || 0),
      branch_id: data.branch_id ? Number(data.branch_id) : undefined,
      user_id: data.user_id ? Number(data.user_id) : undefined,
    }
    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, payload: formatted })
    } else {
      createMutation.mutate(formatted)
    }
  }

  // Filter list locally by search name/number
  const filteredEmployees = employees.filter((emp) => {
    const term = searchQuery.toLowerCase()
    return (
      emp.full_name.toLowerCase().includes(term) ||
      emp.employee_number.toLowerCase().includes(term) ||
      (emp.job_title && emp.job_title.toLowerCase().includes(term))
    )
  })

  return (
    <div className="flex-1 space-y-6 p-8 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Employees</h1>
          <p className="text-sm text-slate-500">Manage employee profiles, salaries, and details.</p>
        </div>
        <button
          onClick={handleOpenNewModal}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Employee
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, number or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
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

        {/* Status Filter */}
        <div className="w-[150px]">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All Statuses</option>
          </select>
        </div>
      </div>

      {/* Main Layout (Table + Slide-out) */}
      <div className="flex gap-6 items-start">
        {/* Table */}
        <div className="flex-1 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500">
                  <th className="px-6 py-4">Emp No</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Department & Job</th>
                  <th className="px-6 py-4">Branch</th>
                  <th className="px-6 py-4">Salary (UGX)</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      Loading employees...
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      onClick={() => setSelectedEmployee(emp)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 font-mono font-medium text-xs text-slate-500">
                        {emp.employee_number}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {emp.full_name}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-900 font-medium">{emp.job_title || '—'}</div>
                        <div className="text-xs text-slate-500">{emp.department || '—'}</div>
                      </td>
                      <td className="px-6 py-4">
                        {branches.find(b => b.id === emp.branch_id)?.name || '—'}
                      </td>
                      <td className="px-6 py-4 font-mono font-medium">
                        {UGX(emp.basic_salary)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {emp.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 border border-slate-200">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right animate-none" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={(e) => handleOpenEditModal(emp, e)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {emp.is_active && (
                            <button
                              onClick={(e) => handleDeactivate(emp.id, e)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Deactivate"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Slide-out Panel */}
        {selectedEmployee && (
          <div className="w-[380px] bg-white rounded-xl border border-slate-100 shadow-lg overflow-hidden shrink-0 animate-in slide-in-from-right duration-250">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900">Employee Details</h3>
              <button
                onClick={() => setSelectedEmployee(null)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-280px)]">
              {/* Profile Header */}
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{selectedEmployee.full_name}</h4>
                  <p className="text-xs font-mono text-slate-500">{selectedEmployee.employee_number}</p>
                </div>
              </div>

              {/* Personal Info */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Personal Information</h5>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Email:</span> <span className="text-slate-800">{selectedEmployee.email || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Phone:</span> <span className="text-slate-800">{selectedEmployee.phone || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Gender:</span> <span className="text-slate-800 capitalize">{selectedEmployee.gender || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">DOB:</span> <span className="text-slate-800">{selectedEmployee.date_of_birth || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">National ID:</span> <span className="text-slate-800">{selectedEmployee.national_id || '—'}</span></div>
                </div>
              </div>

              {/* Employment Info */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Employment Details</h5>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Job Title:</span> <span className="text-slate-800">{selectedEmployee.job_title || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Department:</span> <span className="text-slate-800">{selectedEmployee.department || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Type:</span> <span className="text-slate-800 capitalize">{selectedEmployee.employment_type}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Joined Date:</span> <span className="text-slate-800">{selectedEmployee.date_joined}</span></div>
                  {!selectedEmployee.is_active && (
                    <div className="flex justify-between"><span className="text-slate-500 text-rose-600 font-semibold">Terminated:</span> <span className="text-rose-600 font-semibold">{selectedEmployee.date_terminated || '—'}</span></div>
                  )}
                </div>
              </div>

              {/* Bank & Salary Details */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Bank & Salary</h5>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Basic Salary:</span> <span className="text-slate-800 font-mono font-medium">{UGX(selectedEmployee.basic_salary)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Bank Name:</span> <span className="text-slate-800">{selectedEmployee.bank_name || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Account No:</span> <span className="text-slate-800 font-mono">{selectedEmployee.bank_account_number || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Bank Branch:</span> <span className="text-slate-800">{selectedEmployee.bank_branch || '—'}</span></div>
                </div>
              </div>

              {/* Tax Details */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Statutory & Tax</h5>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">NSSF Number:</span> <span className="text-slate-800 font-mono">{selectedEmployee.nssf_number || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">NHIF Number:</span> <span className="text-slate-800 font-mono">{selectedEmployee.nhif_number || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">TIN Number:</span> <span className="text-slate-800 font-mono">{selectedEmployee.tin_number || '—'}</span></div>
                </div>
              </div>

              {/* Notes */}
              {selectedEmployee.notes && (
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Notes</h5>
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg leading-relaxed">{selectedEmployee.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-lg">
                {editingEmployee ? 'Edit Employee Profile' : 'Register New Employee'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmitForm)} className="p-6 space-y-6">
              {/* Section 1: Personal Details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> Personal Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      {...register('full_name')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                    <input
                      type="email"
                      {...register('email')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Phone</label>
                    <input
                      type="text"
                      {...register('phone')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Gender</label>
                    <select
                      {...register('gender')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      {...register('date_of_birth')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">National ID</label>
                    <input
                      type="text"
                      {...register('national_id')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Employment Details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" /> Employment Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Job Title</label>
                    <input
                      type="text"
                      {...register('job_title')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
                    <input
                      type="text"
                      {...register('department')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Employment Type</label>
                    <select
                      {...register('employment_type')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    >
                      <option value="permanent">Permanent</option>
                      <option value="casual">Casual</option>
                      <option value="contract">Contract</option>
                      <option value="intern">Intern</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Branch</label>
                    <select
                      {...register('branch_id')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    >
                      <option value="">No Branch / Global</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Date Joined *</label>
                    <input
                      type="date"
                      required
                      {...register('date_joined')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Salary & Bank details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5" /> Salary & Bank Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Basic Salary (UGX) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      {...register('basic_salary')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Bank Name</label>
                    <input
                      type="text"
                      {...register('bank_name')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Account Number</label>
                    <input
                      type="text"
                      {...register('bank_account_number')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Bank Branch</label>
                    <input
                      type="text"
                      {...register('bank_branch')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Tax and Statutory */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> Statutory & Tax Numbers
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">NSSF Number</label>
                    <input
                      type="text"
                      {...register('nssf_number')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">NHIF Number</label>
                    <input
                      type="text"
                      {...register('nhif_number')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">TIN Number</label>
                    <input
                      type="text"
                      {...register('tin_number')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                <textarea
                  rows={3}
                  {...register('notes')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Submit */}
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
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
