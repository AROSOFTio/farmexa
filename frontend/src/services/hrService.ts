import api from '@/services/api'

export interface Employee {
  id: number
  employee_number: string
  full_name: string
  email?: string
  phone?: string
  national_id?: string
  date_of_birth?: string
  gender?: string
  employment_type: string
  job_title?: string
  department?: string
  date_joined: string
  date_terminated?: string
  basic_salary: number
  bank_name?: string
  bank_account_number?: string
  bank_branch?: string
  nssf_number?: string
  nhif_number?: string
  tin_number?: string
  notes?: string
  is_active: boolean
  branch_id?: number
  user_id?: number
  created_at?: string
  updated_at?: string
}

export interface PayrollPeriod {
  id: number
  tenant_id: number
  branch_id?: number
  period_name: string
  start_date: string
  end_date: string
  status: 'draft' | 'processing' | 'approved' | 'paid' | 'closed'
  approved_by_id?: number
  approved_at?: string
  paid_at?: string
  payment_reference?: string
  created_at?: string
}

export interface PayrollLine {
  id: number
  payroll_period_id: number
  employee_id: number
  employee?: Employee
  basic_salary: number
  allowances_json?: Record<string, any>
  gross_pay: number
  paye_tax: number
  nssf_employee: number
  nssf_employer: number
  nhif_employee: number
  nhif_employer: number
  other_deductions: number
  net_pay: number
  journal_entry_id?: number
}

export interface LeaveType {
  id: number
  tenant_id: number
  name: string
  days_per_year: number
  is_paid: boolean
}

export interface LeaveRequest {
  id: number
  tenant_id: number
  employee_id: number
  leave_type_id: number
  start_date: string
  end_date: string
  days_requested: number
  reason?: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  approved_by_id?: number
  approved_at?: string
  created_at?: string
  employee?: Employee
  leave_type?: LeaveType
}

export interface AttendanceRecord {
  id: number
  tenant_id: number
  employee_id: number
  branch_id?: number
  date: string
  clock_in?: string
  clock_out?: string
  hours_worked?: number
  notes?: string
  employee?: Employee
}

export const hrService = {
  // Employees
  async getEmployees(params?: { branch_id?: number; is_active?: boolean }): Promise<Employee[]> {
    const { data } = await api.get('/hr/employees', { params })
    return data
  },

  async getEmployee(id: number): Promise<Employee> {
    const { data } = await api.get(`/hr/employees/${id}`)
    return data
  },

  async createEmployee(payload: Partial<Employee>): Promise<Employee> {
    const { data } = await api.post('/hr/employees', payload)
    return data
  },

  async updateEmployee(id: number, payload: Partial<Employee>): Promise<Employee> {
    const { data } = await api.patch(`/hr/employees/${id}`, payload)
    return data
  },

  async deactivateEmployee(id: number): Promise<any> {
    const { data } = await api.delete(`/hr/employees/${id}`)
    return data
  },

  // Payroll
  async getPayrollPeriods(branchId?: number): Promise<PayrollPeriod[]> {
    const { data } = await api.get('/hr/payroll/periods', { params: { branch_id: branchId } })
    return data
  },

  async getPayrollPeriod(id: number): Promise<PayrollPeriod> {
    const { data } = await api.get(`/hr/payroll/periods/${id}`)
    return data
  },

  async createPayrollPeriod(payload: Partial<PayrollPeriod>): Promise<PayrollPeriod> {
    const { data } = await api.post('/hr/payroll/periods', payload)
    return data
  },

  async processPayrollPeriod(id: number): Promise<PayrollPeriod> {
    const { data } = await api.post(`/hr/payroll/periods/${id}/process`)
    return data
  },

  async approvePayrollPeriod(id: number): Promise<PayrollPeriod> {
    const { data } = await api.post(`/hr/payroll/periods/${id}/approve`)
    return data
  },

  async postPayrollJournals(id: number): Promise<any> {
    const { data } = await api.post(`/hr/payroll/periods/${id}/post-journals`)
    return data
  },

  async getPayrollLines(periodId: number): Promise<PayrollLine[]> {
    const { data } = await api.get(`/hr/payroll/periods/${periodId}/lines`)
    return data
  },

  getPayslipPdfUrl(periodId: number, employeeId: number): string {
    return `${api.defaults.baseURL || ''}/hr/payroll/periods/${periodId}/payslips/${employeeId}.pdf`
  },

  // Leave Types
  async getLeaveTypes(): Promise<LeaveType[]> {
    const { data } = await api.get('/hr/leave-types')
    return data
  },

  async createLeaveType(payload: Partial<LeaveType>): Promise<LeaveType> {
    const { data } = await api.post('/hr/leave-types', payload)
    return data
  },

  // Leave Requests
  async getLeaveRequests(params?: { employee_id?: number; status?: string }): Promise<LeaveRequest[]> {
    const { data } = await api.get('/hr/leave-requests', { params })
    return data
  },

  async createLeaveRequest(payload: Partial<LeaveRequest>): Promise<LeaveRequest> {
    const { data } = await api.post('/hr/leave-requests', payload)
    return data
  },

  async approveLeaveRequest(id: number): Promise<LeaveRequest> {
    const { data } = await api.patch(`/hr/leave-requests/${id}/approve`)
    return data
  },

  async rejectLeaveRequest(id: number): Promise<LeaveRequest> {
    const { data } = await api.patch(`/hr/leave-requests/${id}/reject`)
    return data
  },

  // Attendance
  async getAttendance(params?: { employee_id?: number; date?: string; branch_id?: number }): Promise<AttendanceRecord[]> {
    const { data } = await api.get('/hr/attendance', { params })
    return data
  },

  async recordAttendance(payload: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    const { data } = await api.post('/hr/attendance', payload)
    return data
  },
}
