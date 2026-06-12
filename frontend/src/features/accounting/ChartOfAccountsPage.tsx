import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { 
  Plus, Edit2, ShieldAlert, ChevronDown, ChevronRight, Search, 
  Settings, FolderTree, List, Check, AlertCircle, RefreshCw, LogOut 
} from 'lucide-react'
import { toast } from 'sonner'
import { accountingService, Account, AccountMapping } from '@/services/accountingService'
import { UGX, formatBalance, accountTypeColor, accountTypeBadge } from '@/lib/money'
import clsx from 'clsx'

const accountSchema = z.object({
  account_code: z.string().min(1, 'Account code is required'),
  name: z.string().min(2, 'Name is required'),
  description: z.string().optional().nullable(),
  account_type: z.enum(['asset', 'liability', 'equity', 'revenue', 'cost_of_sales', 'expense']),
  normal_balance: z.enum(['debit', 'credit']),
  parent_account_id: z.coerce.number().optional().nullable(),
  allow_manual_entries: z.boolean().default(true),
  is_active: z.boolean().default(true),
})

type AccountFormValues = z.infer<typeof accountSchema>

const ACCOUNT_TYPES = [
  { value: 'asset', label: 'Assets (1xxx)' },
  { value: 'liability', label: 'Liabilities (2xxx)' },
  { value: 'equity', label: 'Equity (3xxx)' },
  { value: 'revenue', label: 'Revenue (4xxx)' },
  { value: 'cost_of_sales', label: 'Cost of Sales (5xxx)' },
  { value: 'expense', label: 'Expenses (6xxx)' },
]

const getFriendlyMappingLabel = (key: string): string => {
  const map: Record<string, string> = {
    cash: 'Cash on Hand (default cash account)',
    bank: 'Main Bank Account',
    mobile_money: 'Mobile Money Account',
    ar: 'Accounts Receivable',
    ap: 'Accounts Payable',
    feed_inventory: 'Feed Inventory',
    medicine_inventory: 'Medicine & Vaccine Inventory',
    live_bird_inventory: 'Live Bird Inventory',
    finished_goods: 'Finished Goods Inventory',
    egg_inventory: 'Egg Inventory',
    byproduct_inventory: 'Byproduct Inventory',
    goods_in_transit: 'Goods In Transit',
    feed_cost: 'Default Feed Cost',
    layer_feed_cost: 'Layer Feed Cost',
    vaccine_cost: 'Vaccine Cost',
    medicine_cost: 'Medicine Cost',
    doc_cost: 'DOC Procurement Cost',
    mortality_loss: 'Mortality Loss',
    slaughter_processing_cost: 'Slaughter Processing Cost',
    slaughter_labour: 'Direct Slaughter Labour',
    slaughter_overhead: 'Processing Overhead',
    sales_revenue: 'Default Sales Revenue',
    egg_sales: 'Egg Sales Revenue',
    doc_sales: 'DOC Sales Revenue',
    byproduct_sales: 'Byproduct Sales Revenue',
    live_bird_sales: 'Live Bird Sales Revenue',
    cogs: 'Cost of Goods Sold (summary)',
    slaughter_gain: 'Slaughter Gain',
    slaughter_loss: 'Slaughter Loss',
    vat_output: 'VAT Output Tax Payable',
    vat_input: 'VAT Input Tax Recoverable',
    paye_payable: 'PAYE Tax Payable',
    nssf_payable: 'NSSF Payable',
    nhif_payable: 'NHIF Payable',
    accrued_salaries: 'Accrued Salaries Payable',
    salary_expense: 'Salaries & Wages Expense',
    nssf_employer: 'NSSF Employer Contribution',
    nhif_employer: 'NHIF Employer Contribution',
    depreciation_exp: 'Depreciation Expense',
    retained_earnings: 'Retained Earnings',
    current_year_pl: 'Current Year Profit / (Loss)',
  }
  return map[key] ?? key
}

export function ChartOfAccountsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'tree' | 'flat' | 'mappings'>('tree')
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [editingMappingId, setEditingMappingId] = useState<number | null>(null)
  const [selectedMappingAccountId, setSelectedMappingAccountId] = useState<number | null>(null)

  // Fetch accounts
  const { data: accounts = [], isLoading: isLoadingCoa } = useQuery({
    queryKey: ['accounting-coa', asOfDate],
    queryFn: () => accountingService.getCoaFlat(),
  })

  // Fetch mappings
  const { data: mappings = [], isLoading: isLoadingMappings } = useQuery({
    queryKey: ['accounting-mappings'],
    queryFn: () => accountingService.getMappings(),
    enabled: activeTab === 'mappings',
  })

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      account_code: '',
      name: '',
      description: '',
      account_type: 'asset',
      normal_balance: 'debit',
      allow_manual_entries: true,
      is_active: true,
    },
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (values: AccountFormValues) => {
      const payload = { ...values }
      if (!payload.parent_account_id) {
        payload.parent_account_id = null
      }
      return accountingService.createAccount(payload)
    },
    onSuccess: () => {
      toast.success('Account created successfully')
      queryClient.invalidateQueries({ queryKey: ['accounting-coa'] })
      closeModal()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to create account')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: AccountFormValues }) => {
      const payload = { ...values }
      if (!payload.parent_account_id) {
        payload.parent_account_id = null
      }
      return accountingService.updateAccount(id, payload)
    },
    onSuccess: () => {
      toast.success('Account updated successfully')
      queryClient.invalidateQueries({ queryKey: ['accounting-coa'] })
      closeModal()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to update account')
    }
  })

  const updateMappingMutation = useMutation({
    mutationFn: ({ id, accountId }: { id: number; accountId: number }) => {
      return accountingService.updateMapping(id, accountId)
    },
    onSuccess: () => {
      toast.success('System account mapping updated')
      queryClient.invalidateQueries({ queryKey: ['accounting-mappings'] })
      setEditingMappingId(null)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to update mapping')
    }
  })

  const initCoaMutation = useMutation({
    mutationFn: () => accountingService.initializeTenant(),
    onSuccess: () => {
      toast.success('Chart of Accounts successfully initialized')
      queryClient.invalidateQueries({ queryKey: ['accounting-coa'] })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to initialize templates')
    }
  })

  // Build client-side tree with recursive balances
  const { tree, recursiveBalances } = useMemo(() => {
    const buildTreeNodes = (flatList: Account[]): Account[] => {
      const map: Record<number, Account> = {}
      const roots: Account[] = []

      flatList.forEach((a) => {
        map[a.id] = { ...a, children: [] }
      })

      flatList.forEach((a) => {
        const node = map[a.id]
        if (a.parent_account_id && map[a.parent_account_id]) {
          map[a.parent_account_id].children?.push(node)
        } else {
          roots.push(node)
        }
      })

      const sortTree = (nodes: Account[]) => {
        nodes.sort((a, b) => a.account_code.localeCompare(b.account_code))
        nodes.forEach((n) => {
          if (n.children) sortTree(n.children)
        })
      }
      sortTree(roots)
      return roots
    }

    const treeNodes = buildTreeNodes(accounts)

    // Calculate dynamic recursive balances
    const balancesMap: Record<number, number> = {}
    const calculateSum = (node: Account): number => {
      let sum = node.current_balance || 0
      if (node.children && node.children.length > 0) {
        node.children.forEach((c) => {
          sum += calculateSum(c)
        })
      }
      balancesMap[node.id] = sum
      return sum
    }
    treeNodes.forEach(calculateSum)

    // Automatically expand roots on first load
    if (expandedNodes.size === 0 && treeNodes.length > 0) {
      const initialExpanded = new Set<number>()
      treeNodes.forEach((node) => initialExpanded.add(node.id))
      setExpandedNodes(initialExpanded)
    }

    return { tree: treeNodes, recursiveBalances: balancesMap }
  }, [accounts])

  const toggleNode = (nodeId: number) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const openNewModal = (parentId?: number) => {
    setEditingAccount(null)
    form.reset({
      account_code: '',
      name: '',
      description: '',
      account_type: 'asset',
      normal_balance: 'debit',
      parent_account_id: parentId || null,
      allow_manual_entries: true,
      is_active: true,
    })
    setIsModalOpen(true)
  }

  const openEditModal = (account: Account) => {
    setEditingAccount(account)
    form.reset({
      account_code: account.account_code,
      name: account.name,
      description: account.description || '',
      account_type: account.account_type,
      normal_balance: account.normal_balance,
      parent_account_id: account.parent_account_id || null,
      allow_manual_entries: account.allow_manual_entries,
      is_active: account.is_active,
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingAccount(null)
  }

  const onSubmit = (values: AccountFormValues) => {
    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, values })
    } else {
      createMutation.mutate(values)
    }
  }

  const handleInitTemplate = () => {
    if (window.confirm('This will apply the Farmexa Poultry CoA template and initialize accounting. Custom accounts will not be removed. Continue?')) {
      initCoaMutation.mutate()
    }
  }

  // Filter in-place tree nodes
  const filteredTree = useMemo(() => {
    if (!searchQuery) return tree

    const matchesSearch = (node: Account): boolean => {
      return (
        node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.account_code.includes(searchQuery)
      )
    }

    const filterNode = (node: Account): Account | null => {
      const isMatch = matchesSearch(node)
      const filteredChildren: Account[] = []

      if (node.children) {
        node.children.forEach((c) => {
          const childNode = filterNode(c)
          if (childNode) filteredChildren.push(childNode)
        })
      }

      if (isMatch || filteredChildren.length > 0) {
        // Automatically expand node if children match search
        if (filteredChildren.length > 0) {
          setExpandedNodes((prev) => {
            const next = new Set(prev)
            next.add(node.id)
            return next
          })
        }
        return {
          ...node,
          children: filteredChildren
        }
      }
      return null
    }

    return tree.map(filterNode).filter((n): n is Account => n !== null)
  }, [tree, searchQuery])

  // Flat list filtered and sorted
  const flatFilteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      const match = a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    a.account_code.includes(searchQuery)
      return match
    })
  }, [accounts, searchQuery])

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: Account, depth = 0) => {
    const isExpanded = expandedNodes.has(node.id)
    const hasChildren = node.children && node.children.length > 0
    const rawBalance = recursiveBalances[node.id] ?? node.current_balance
    const { display: balanceStr, isNegative } = formatBalance(rawBalance, node.normal_balance)

    return (
      <div key={node.id} className="flex flex-col">
        <div 
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
          className={clsx(
            "group flex items-center justify-between border-b border-slate-100 py-3 hover:bg-slate-50 transition-colors",
            node.parent_account_id === null ? "bg-slate-50/40 font-semibold" : "font-normal"
          )}
        >
          <div className="flex items-center gap-2 max-w-lg truncate">
            {hasChildren ? (
              <button 
                type="button"
                onClick={() => toggleNode(node.id)}
                className="p-1 rounded hover:bg-slate-200 text-slate-500"
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <span className="w-6" />
            )}
            <span className="font-mono text-sm text-slate-500">{node.account_code}</span>
            <span className={clsx(
              "text-slate-800",
              node.parent_account_id === null ? "text-slate-900 font-bold" : "text-slate-700"
            )}>
              {node.name}
            </span>
            {node.is_system && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
                System
              </span>
            )}
            {!node.allow_manual_entries && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                Header
              </span>
            )}
          </div>

          <div className="flex items-center gap-6 pr-4">
            <span className={clsx(
              "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase border",
              accountTypeBadge(node.account_type)
            )}>
              {node.account_type.replace(/_/g, ' ')}
            </span>

            <span className={clsx(
              "font-mono text-sm text-right w-44 font-semibold",
              isNegative ? "text-rose-600" : "text-slate-900"
            )}>
              {balanceStr}
            </span>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => openEditModal(node)}
                disabled={node.is_system}
                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30"
                title={node.is_system ? "System account details cannot be edited" : "Edit account"}
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => openNewModal(node.id)}
                className="p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Add sub-account"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="flex flex-col">
            {node.children?.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Chart of Accounts</h1>
          <p className="text-slate-500 text-sm mt-1">
            Setup and manage GL account codes, groupings, and real-time ledger balances.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleInitTemplate} 
            className="flex items-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Initialize Templates
          </button>
          
          <button 
            onClick={() => openNewModal()} 
            className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Account
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-3 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg w-full md:w-auto">
          <button
            onClick={() => setActiveTab('tree')}
            className={clsx(
              "flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all w-full md:w-auto",
              activeTab === 'tree' 
                ? "bg-white text-indigo-600 shadow-sm font-semibold" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <FolderTree className="h-4 w-4" />
            Tree View
          </button>
          <button
            onClick={() => setActiveTab('flat')}
            className={clsx(
              "flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all w-full md:w-auto",
              activeTab === 'flat' 
                ? "bg-white text-indigo-600 shadow-sm font-semibold" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <List className="h-4 w-4" />
            Flat List
          </button>
          <button
            onClick={() => setActiveTab('mappings')}
            className={clsx(
              "flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all w-full md:w-auto",
              activeTab === 'mappings' 
                ? "bg-white text-indigo-600 shadow-sm font-semibold" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Settings className="h-4 w-4" />
            Account Mappings
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {activeTab !== 'mappings' && (
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search code or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {activeTab === 'tree' && (
          <div className="flex flex-col">
            {/* Header row */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 py-3 text-xs font-bold text-slate-500 uppercase">
              <span className="pl-6">Account Code & Name</span>
              <div className="flex items-center gap-6 pr-4">
                <span className="w-24 text-center mr-8">Type</span>
                <span className="w-44 text-right">Running Balance</span>
                <span className="w-14" />
              </div>
            </div>

            {isLoadingCoa ? (
              <div className="p-12 text-center text-slate-500">Loading hierarchy...</div>
            ) : filteredTree.length === 0 ? (
              <div className="p-12 text-center text-slate-500">No accounts match your query.</div>
            ) : (
              <div className="flex flex-col">
                {filteredTree.map((root) => renderTreeNode(root))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'flat' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Account Name</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Normal</th>
                  <th className="px-6 py-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Balance</th>
                  <th className="px-6 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {isLoadingCoa ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">Loading accounts...</td>
                  </tr>
                ) : flatFilteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">No accounts found.</td>
                  </tr>
                ) : (
                  flatFilteredAccounts.map((account) => {
                    const { display, isNegative } = formatBalance(account.current_balance, account.normal_balance)
                    return (
                      <tr key={account.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-slate-600 font-semibold">{account.account_code}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{account.name}</span>
                            {account.is_system && (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
                                System
                              </span>
                            )}
                          </div>
                          {account.description && <p className="text-slate-400 text-xs mt-0.5 truncate max-w-xs">{account.description}</p>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={clsx(
                            "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium uppercase border",
                            accountTypeBadge(account.account_type)
                          )}>
                            {account.account_type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 capitalize">{account.normal_balance}</td>
                        <td className={clsx(
                          "px-6 py-4 whitespace-nowrap text-right font-mono text-sm font-semibold",
                          isNegative ? "text-rose-600" : "text-slate-900"
                        )}>
                          {display}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={clsx(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
                            account.is_active 
                              ? "bg-green-50 text-green-700 border-green-200" 
                              : "bg-slate-50 text-slate-500 border-slate-200"
                          )}>
                            {account.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditModal(account)}
                              disabled={account.is_system}
                              className="text-indigo-600 hover:text-indigo-900 disabled:opacity-30"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'mappings' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Operation Key / Purpose</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Mapped Account</th>
                  <th className="px-6 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {isLoadingMappings ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-500">Loading mappings...</td>
                  </tr>
                ) : mappings.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-500">No account mappings found.</td>
                  </tr>
                ) : (
                  mappings.map((m) => {
                    const isEditing = editingMappingId === m.id
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">{getFriendlyMappingLabel(m.operation_key)}</div>
                          <span className="font-mono text-xs text-slate-400">key: {m.operation_key}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isEditing ? (
                            <select
                              value={selectedMappingAccountId ?? m.account_id}
                              onChange={(e) => setSelectedMappingAccountId(Number(e.target.value))}
                              className="form-input text-sm rounded-lg max-w-sm"
                            >
                              {accounts
                                .filter((a) => a.allow_manual_entries)
                                .map((a) => (
                                  <option key={a.id} value={a.id}>
                                    [{a.account_code}] - {a.name} ({a.account_type})
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <div className="flex items-center gap-2">
                              {m.account_code ? (
                                <>
                                  <span className="font-mono text-sm font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                    {m.account_code}
                                  </span>
                                  <span className="text-slate-800 font-medium">{m.account_name}</span>
                                </>
                              ) : (
                                <span className="text-rose-500 flex items-center gap-1.5 text-sm font-medium">
                                  <AlertCircle className="h-4 w-4" />
                                  Not Configured
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-3">
                              <button
                                onClick={() => {
                                  updateMappingMutation.mutate({
                                    id: m.id,
                                    accountId: selectedMappingAccountId ?? m.account_id
                                  })
                                }}
                                className="text-green-600 hover:text-green-900"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingMappingId(null)}
                                className="text-slate-500 hover:text-slate-900"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingMappingId(m.id)
                                setSelectedMappingAccountId(m.account_id)
                              }}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Change Account
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Account Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden transform transition-all">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900">
                {editingAccount ? 'Edit GL Account' : 'Create GL Account'}
              </h2>
              <button 
                onClick={closeModal} 
                className="text-slate-400 hover:text-slate-600 text-2xl font-semibold focus:outline-none"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
              {editingAccount?.is_system && (
                <div className="flex items-start gap-3 rounded-lg bg-indigo-50 p-4 border border-indigo-100 text-indigo-900">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
                  <div className="text-sm">
                    <strong className="block font-semibold">System Managed Account</strong>
                    This is a core system account. The Account Type and Normal Balance settings are locked to ensure double-entry integrity.
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Account Code</label>
                  <input
                    type="text"
                    className="form-input font-mono text-sm rounded-lg"
                    placeholder="e.g. 1115"
                    disabled={editingAccount?.is_system}
                    {...form.register('account_code')}
                  />
                  {form.formState.errors.account_code && (
                    <p className="mt-1 text-xs text-rose-500 font-medium">{form.formState.errors.account_code.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Account Name</label>
                  <input
                    type="text"
                    className="form-input text-sm rounded-lg font-medium text-slate-800"
                    placeholder="e.g. MTN Branch Wallet"
                    {...form.register('name')}
                  />
                  {form.formState.errors.name && (
                    <p className="mt-1 text-xs text-rose-500 font-medium">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Account Type</label>
                  <select
                    className="form-input text-sm rounded-lg"
                    {...form.register('account_type')}
                    disabled={editingAccount?.is_system}
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Normal Balance</label>
                  <select
                    className="form-input text-sm rounded-lg"
                    {...form.register('normal_balance')}
                    disabled={editingAccount?.is_system}
                  >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Parent Account (Optional)</label>
                  <select
                    className="form-input text-sm rounded-lg"
                    {...form.register('parent_account_id')}
                  >
                    <option value="">None (Top Level)</option>
                    {accounts
                      .filter((a) => a.id !== editingAccount?.id)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.account_code} - {a.name} ({a.account_type})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Description (Optional)</label>
                  <textarea
                    className="form-input text-sm rounded-lg"
                    rows={2}
                    placeholder="Brief description of the account's purpose..."
                    {...form.register('description')}
                  />
                </div>

                <div className="sm:col-span-2 pt-2 space-y-2.5">
                  <label className="flex items-center gap-2.5 text-sm text-slate-700 font-medium select-none cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4.5 w-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-colors"
                      {...form.register('allow_manual_entries')}
                    />
                    Allow manual journal entry postings
                  </label>
                  
                  <label className="flex items-center gap-2.5 text-sm text-slate-700 font-medium select-none cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4.5 w-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-colors"
                      {...form.register('is_active')}
                    />
                    Account is active
                  </label>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
