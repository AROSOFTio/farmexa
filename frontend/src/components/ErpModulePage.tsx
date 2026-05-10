import { ClipboardList } from 'lucide-react'

interface ErpModulePageProps {
  title: string
  description?: string
  actions?: string[]
  rows?: string[]
}

export function ErpModulePage({ title, description, actions = [], rows = [] }: ErpModulePageProps) {
  return (
    <div className="animate-fade-in space-y-5 pb-5">
      <div className="section-header">
        <div>
          <div className="page-eyebrow">ERP Workspace</div>
          <h1 className="section-title">{title}</h1>
          <p className="section-subtitle">
            {description ?? 'Tenant-scoped Farmexa workspace. This page does not show sample records.'}
          </p>
        </div>
        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button key={action} type="button" className={action === actions[0] ? 'btn-primary' : 'btn-secondary'}>
                {action}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <section className="card overflow-hidden">
        <div className="surface-header">
          <div>
            <div className="surface-title">{title}</div>
            <div className="surface-subtitle">
              {rows.length > 0 ? 'Configured records for this workspace.' : 'No records have been entered for this workspace yet.'}
            </div>
          </div>
          <ClipboardList className="h-5 w-5 text-[var(--brand-primary)]" />
        </div>
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Record</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row}>
                    <td>{row}</td>
                    <td><span className="badge badge-neutral">Configured</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-14 text-center text-sm font-medium text-neutral-500">
            Enter real records in the working Farmexa modules. Dashboards and reports read from the database only.
          </div>
        )}
      </section>
    </div>
  )
}
