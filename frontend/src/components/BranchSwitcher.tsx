import { useState, useRef, useEffect } from 'react'
import { Building2, ChevronDown, Check } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { branchService } from '@/services/branchService'
import { useAuth } from '@/features/auth/AuthContext'

export function BranchSwitcher() {
  const { activeBranch, setActiveBranch, hasRole } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch branches
  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: branchService.getBranches,
    staleTime: 5 * 60_000,
  })

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto-select first branch if none is selected and branches are loaded,
  // but wait! Global Admins and Managers might want "All Branches" selected.
  // Actually, if activeBranch is null, it means "All Branches" or "Default".
  // Let's explicitly offer an "All Branches" option for admins/managers.
  
  const isGlobal = hasRole('super_manager') || hasRole('developer_admin') || hasRole('manager') || hasRole('tenant_admin') || hasRole('hr_officer')
  
  useEffect(() => {
    // If not global and no active branch, default to the first available branch
    if (!isGlobal && branches.length > 0 && !activeBranch) {
      setActiveBranch(branches[0])
    }
  }, [isGlobal, branches, activeBranch, setActiveBranch])

  if (isLoading || (branches.length === 0 && !isGlobal)) {
    return null
  }

  const handleSelect = (branch: any | null) => {
    setActiveBranch(branch)
    setIsOpen(false)
    // Reload the page to reset all queries with the new branch context
    window.location.reload()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/50"
      >
        <Building2 className="h-4 w-4 text-slate-400" />
        <span className="hidden max-w-[120px] truncate sm:inline-block">
          {activeBranch ? activeBranch.name : isGlobal ? 'All Branches' : 'Select Branch'}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-56 origin-top-right rounded-lg border border-slate-200 bg-white p-1 shadow-lg outline-none dark:border-slate-700 dark:bg-slate-800">
          {isGlobal && (
            <button
              onClick={() => handleSelect(null)}
              className={clsx(
                'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-left',
                !activeBranch
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50'
              )}
            >
              <span>All Branches</span>
              {!activeBranch && <Check className="h-4 w-4" />}
            </button>
          )}

          {branches.map((branch) => {
            const isSelected = activeBranch?.id === branch.id
            return (
              <button
                key={branch.id}
                onClick={() => handleSelect(branch)}
                className={clsx(
                  'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-left',
                  isSelected
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50'
                )}
              >
                <span className="truncate">{branch.name}</span>
                {isSelected && <Check className="h-4 w-4" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
