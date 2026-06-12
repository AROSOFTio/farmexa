import api from './api'

export interface Account {
  id: number
  account_code: string
  name: string
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'cost_of_sales' | 'expense'
  normal_balance: 'debit' | 'credit'
  parent_account_id: number | null
  description: string | null
  is_active: boolean
  is_system: boolean
  allow_manual_entries: boolean
  current_balance: number
  created_at: string
  children?: Account[]
}

export interface JournalLine {
  id?: number
  account_id: number
  account_code?: string
  account_name?: string
  memo?: string
  debit: number
  credit: number
  branch_id?: number
}

export interface JournalEntry {
  id: number
  entry_number: string
  description: string
  notes?: string
  entry_date: string
  reference_type?: string
  reference_id?: number
  status: 'draft' | 'posted' | 'cancelled'
  is_reversed: boolean
  reversal_of_id?: number
  created_at: string
  posted_at?: string
  lines: JournalLine[]
  total_debit: number
  total_credit: number
}

export interface FiscalYear {
  id: number
  name: string
  start_date: string
  end_date: string
  status: 'open' | 'closed'
  closed_at?: string
}

export interface AccountMapping {
  id: number
  operation_key: string
  account_id: number
  account_code: string
  account_name: string
}

export interface TrialBalanceRow {
  account_code: string
  account_name: string
  account_type: string
  total_debit: number
  total_credit: number
  balance?: number
}

export interface TrialBalanceReport {
  as_of_date?: string
  rows: TrialBalanceRow[]
  total_debit: number
  total_credit: number
  is_balanced: boolean
}

export interface ReportRow {
  account_code: string
  account_name: string
  amount: number
}

export interface ProfitLossReport {
  from_date?: string
  to_date?: string
  revenue: ReportRow[]
  total_revenue: number
  cost_of_sales: ReportRow[]
  total_cost_of_sales: number
  gross_profit: number
  gross_margin_pct?: number
  expenses: ReportRow[]
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

export const accountingService = {
  // CoA
  getCoaFlat: (params?: { include_inactive?: boolean; account_type?: string }) =>
    api.get<Account[]>('/accounting/chart-of-accounts', { params }).then(r => r.data),

  getCoaTree: (as_of_date?: string) =>
    api.get<Account[]>('/accounting/chart-of-accounts/tree', {
      params: as_of_date ? { as_of_date } : {}
    }).then(r => r.data),

  searchAccounts: (q: string) =>
    api.get<Account[]>('/accounting/chart-of-accounts/search', { params: { q } }).then(r => r.data),

  createAccount: (data: Partial<Account>) =>
    api.post<Account>('/accounting/chart-of-accounts', data).then(r => r.data),

  updateAccount: (id: number, data: Partial<Account>) =>
    api.patch<Account>(`/accounting/chart-of-accounts/${id}`, data).then(r => r.data),

  deleteAccount: (id: number) =>
    api.delete(`/accounting/chart-of-accounts/${id}`),

  // Account Mappings
  getMappings: () =>
    api.get<AccountMapping[]>('/accounting/account-mappings').then(r => r.data),

  updateMapping: (id: number, account_id: number) =>
    api.patch(`/accounting/account-mappings/${id}`, { account_id }).then(r => r.data),

  // Journal Entries
  getJournals: (params?: Record<string, any>) =>
    api.get<JournalEntry[]>('/accounting/journal-entries', { params }).then(r => r.data),

  getJournal: (id: number) =>
    api.get<JournalEntry>(`/accounting/journal-entries/${id}`).then(r => r.data),

  createJournal: (data: any) =>
    api.post<JournalEntry>('/accounting/journal-entries', data).then(r => r.data),

  postJournal: (id: number) =>
    api.post<JournalEntry>(`/accounting/journal-entries/${id}/post`).then(r => r.data),

  reverseJournal: (id: number, reversal_date: string, reason: string) =>
    api.post<JournalEntry>(`/accounting/journal-entries/${id}/reverse`, {
      reversal_date,
      description: reason
    }).then(r => r.data),

  // Reports
  getTrialBalance: (params?: Record<string, any>) =>
    api.get<TrialBalanceReport>('/accounting/trial-balance', { params }).then(r => r.data),

  getProfitLoss: (params?: Record<string, any>) =>
    api.get<ProfitLossReport>('/accounting/profit-loss', { params }).then(r => r.data),

  getBalanceSheet: (params?: Record<string, any>) =>
    api.get<BalanceSheetReport>('/accounting/balance-sheet', { params }).then(r => r.data),

  getCashFlow: (params?: Record<string, any>) =>
    api.get<CashFlowReport>('/finance/reports/cash-flow', { params }).then(r => r.data),

  getLedger: (params: { account_id: number; from_date?: string; to_date?: string; branch_id?: number; batch_id?: number }) =>
    api.get('/accounting/ledger', { params }).then(r => r.data),

  getCashbook: (params: { account_id: number; from_date?: string; to_date?: string; branch_id?: number }) =>
    api.get('/accounting/cashbook', { params }).then(r => r.data),

  getCashAccounts: () =>
    api.get<Account[]>('/accounting/cash-accounts').then(r => r.data),

  // Fiscal Years
  getFiscalYears: () =>
    api.get<FiscalYear[]>('/accounting/fiscal-years').then(r => r.data),

  createFiscalYear: (data: any) =>
    api.post<FiscalYear>('/accounting/fiscal-years', data).then(r => r.data),

  closeFiscalYear: (id: number) =>
    api.post<FiscalYear>(`/accounting/fiscal-years/${id}/close`).then(r => r.data),

  // Opening Balances
  getOpeningBalances: () =>
    api.get('/accounting/opening-balances').then(r => r.data),

  setOpeningBalances: (data: any) =>
    api.post('/accounting/opening-balances', data).then(r => r.data),

  initializeTenant: () =>
    api.post('/accounting/initialize').then(r => r.data),
}
