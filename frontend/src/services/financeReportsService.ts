import api from './api'

export interface AccountInfo {
  id: number
  code: string
  name: string
  type: string
  normal_balance: string
}

export interface LedgerEntry {
  date: string
  entry_number: string
  description?: string
  reference_type?: string
  reference_id?: number
  debit: number
  credit: number
  balance: number
}

export interface LedgerReport {
  account: AccountInfo
  from_date?: string
  to_date?: string
  opening_balance: number
  closing_balance: number
  entries: LedgerEntry[]
}

export interface TrialBalanceRow {
  account_code: string
  account_name: string
  account_type: string
  total_debit: number
  total_credit: number
}

export interface TrialBalanceReport {
  as_of_date?: string
  rows: TrialBalanceRow[]
  total_debit: number
  total_credit: number
  is_balanced: boolean
}

export interface ProfitLossRow {
  account_code: string
  account_name: string
  amount: number
}

export interface ProfitLossReport {
  from_date?: string
  to_date?: string
  revenue: ProfitLossRow[]
  total_revenue: number
  cost_of_sales: ProfitLossRow[]
  total_cost_of_sales: number
  gross_profit: number
  expenses: ProfitLossRow[]
  total_expenses: number
  net_profit: number
}

export interface BalanceSheetRow {
  account_code: string
  account_name: string
  balance: number
}

export interface BalanceSheetReport {
  as_of_date?: string
  assets: BalanceSheetRow[]
  total_assets: number
  liabilities: BalanceSheetRow[]
  total_liabilities: number
  equity: BalanceSheetRow[]
  total_equity: number
  total_liabilities_and_equity: number
  is_balanced: boolean
}

export interface CashFlowRow {
  category: string
  amount: number
}

export interface CashFlowReport {
  from_date?: string
  to_date?: string
  operating: CashFlowRow[]
  total_operating: number
  investing: CashFlowRow[]
  total_investing: number
  financing: CashFlowRow[]
  total_financing: number
  net_cash_flow: number
}

export interface ReportFilters {
  from_date?: string
  to_date?: string
  as_of_date?: string
  branch_id?: number
  account_id?: number
}

export const financeReportsService = {
  getCashAccounts: async (): Promise<AccountInfo[]> => {
    const res = await api.get('/finance/reports/cash-accounts')
    return res.data
  },

  getCashbook: async (filters: ReportFilters): Promise<LedgerReport> => {
    const res = await api.get('/finance/reports/cashbook', { params: filters })
    return res.data
  },

  getGeneralLedger: async (filters: ReportFilters): Promise<LedgerReport> => {
    const res = await api.get('/finance/reports/general-ledger', { params: filters })
    return res.data
  },

  getTrialBalance: async (filters: Omit<ReportFilters, 'from_date' | 'to_date'>): Promise<TrialBalanceReport> => {
    const res = await api.get('/finance/reports/trial-balance', { params: filters })
    return res.data
  },

  getProfitAndLoss: async (filters: Omit<ReportFilters, 'as_of_date'>): Promise<ProfitLossReport> => {
    const res = await api.get('/finance/reports/profit-and-loss', { params: filters })
    return res.data
  },

  getBalanceSheet: async (filters: Omit<ReportFilters, 'from_date' | 'to_date'>): Promise<BalanceSheetReport> => {
    const res = await api.get('/finance/reports/balance-sheet', { params: filters })
    return res.data
  },

  getCashFlow: async (filters: Omit<ReportFilters, 'as_of_date'>): Promise<CashFlowReport> => {
    const res = await api.get('/finance/reports/cash-flow', { params: filters })
    return res.data
  },
}
