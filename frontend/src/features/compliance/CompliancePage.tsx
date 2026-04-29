import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, FileBadge2, FileText, Upload } from 'lucide-react'
import { toast } from 'sonner'

import api from '@/services/api'
import { useAuth } from '@/features/auth/AuthContext'

type ComplianceSection = 'documents' | 'alerts'

interface ComplianceDocument {
  id: number
  title: string
  document_type: string
  reference_number?: string | null
  issuing_authority?: string | null
  issue_date?: string | null
  expiry_date?: string | null
  renewal_date?: string | null
  responsible_person?: string | null
  file_url?: string | null
  notes?: string | null
  status: string
  days_to_expiry?: number | null
}

interface ComplianceAlert {
  document_id: number
  title: string
  document_type: string
  expiry_date?: string | null
  status: string
  days_to_expiry?: number | null
  reminder_offsets: number[]
}

interface ComplianceSummary {
  total_documents: number
  active_documents: number
  expiring_documents: number
  expired_documents: number
  alerts: ComplianceAlert[]
}

const documentSchema = z.object({
  title: z.string().min(2, 'Document title is required'),
  document_type: z.string().min(1, 'Document type is required'),
  reference_number: z.string().optional(),
  issuing_authority: z.string().optional(),
  issue_date: z.string().optional(),
  expiry_date: z.string().optional(),
  renewal_date: z.string().optional(),
  responsible_person: z.string().optional(),
  notes: z.string().optional(),
})

type DocumentFormValues = z.infer<typeof documentSchema>

const documentTypes = [
  { value: 'ura_tax_document', label: 'URA Tax Document' },
  { value: 'tax_clearance', label: 'Tax Clearance' },
  { value: 'trading_licence', label: 'Trading Licence' },
  { value: 'veterinary_permit', label: 'Veterinary Permit' },
  { value: 'farm_registration', label: 'Farm Registration' },
  { value: 'nssf_paye', label: 'NSSF / PAYE' },
  { value: 'contract', label: 'Contract' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'inspection_report', label: 'Inspection Report' },
  { value: 'other', label: 'Other' },
]

function formatDate(value?: string | null) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ')
}

function alertCopy(daysToExpiry?: number | null) {
  if (daysToExpiry == null) return 'No expiry date'
  if (daysToExpiry < 0) return `Expired ${Math.abs(daysToExpiry)} day(s) ago`
  if (daysToExpiry === 0) return 'Expires today'
  return `${daysToExpiry} day(s) remaining`
}

export function CompliancePage({ section = 'documents' }: { section?: ComplianceSection }) {
  const queryClient = useQueryClient()
  const { hasPermission, hasModuleAccess } = useAuth()
  const canManage = hasPermission('farm:write')
  const canViewAlerts = hasModuleAccess('compliance_alerts')

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      title: '',
      document_type: 'ura_tax_document',
      reference_number: '',
      issuing_authority: '',
      issue_date: '',
      expiry_date: '',
      renewal_date: '',
      responsible_person: '',
      notes: '',
    },
  })

  const { data: documents = [] } = useQuery<ComplianceDocument[]>({
    queryKey: ['compliance-documents'],
    queryFn: () => api.get('/compliance/documents').then((response) => response.data),
    enabled: section === 'documents',
  })

  const { data: summary } = useQuery<ComplianceSummary>({
    queryKey: ['compliance-summary'],
    queryFn: () => api.get('/compliance/summary').then((response) => response.data),
    enabled: canViewAlerts,
  })

  const createDocument = useMutation({
    mutationFn: async (values: DocumentFormValues) => {
      const payload = new FormData()
      Object.entries(values).forEach(([key, value]) => {
        if (value) payload.append(key, value)
      })
      const file = (document.getElementById('compliance-file') as HTMLInputElement | null)?.files?.[0]
      if (file) payload.append('file', file)
      return api.post('/compliance/documents', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      toast.success('Compliance document uploaded.')
      queryClient.invalidateQueries({ queryKey: ['compliance-documents'] })
      queryClient.invalidateQueries({ queryKey: ['compliance-summary'] })
      form.reset({
        title: '',
        document_type: 'ura_tax_document',
        reference_number: '',
        issuing_authority: '',
        issue_date: '',
        expiry_date: '',
        renewal_date: '',
        responsible_person: '',
        notes: '',
      })
      const fileInput = document.getElementById('compliance-file') as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail ?? 'Failed to save compliance document.')
    },
  })

  const visibleAlerts = useMemo(() => summary?.alerts ?? [], [summary?.alerts])
  const totalDocuments = summary?.total_documents ?? documents.length
  const activeDocuments = summary?.active_documents ?? documents.filter((doc) => doc.status === 'active').length
  const expiringDocuments = summary?.expiring_documents ?? documents.filter((doc) => doc.status === 'expiring_soon').length
  const expiredDocuments = summary?.expired_documents ?? documents.filter((doc) => doc.status === 'expired').length

  return (
    <div className="animate-fade-in space-y-6">
      <section className="section-header">
        <div>
          <h1 className="section-title">Compliance</h1>
          <p className="section-subtitle">
            Upload licences and tax documents, then track 30 / 15 / 7-day expiry reminders.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="kpi-card px-5 py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Documents</div>
          <div className="mt-2 text-[1.7rem] font-semibold text-[var(--text-strong)]">{totalDocuments}</div>
        </div>
        <div className="kpi-card px-5 py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Active</div>
          <div className="mt-2 text-[1.7rem] font-semibold text-[var(--text-strong)]">{activeDocuments}</div>
        </div>
        <div className="kpi-card px-5 py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Expiring</div>
          <div className="mt-2 text-[1.7rem] font-semibold text-[var(--text-strong)]">{expiringDocuments}</div>
        </div>
        <div className="kpi-card px-5 py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Expired</div>
          <div className="mt-2 text-[1.7rem] font-semibold text-[var(--text-strong)]">{expiredDocuments}</div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(52,168,83,0.1)] text-[var(--brand-primary)]">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[1rem] font-semibold text-[var(--text-strong)]">Upload Document</h2>
              <p className="text-[13px] text-[var(--text-muted)]">Store tax, licence, permit, and compliance files.</p>
            </div>
          </div>

          {!canManage ? (
            <div className="mt-4 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 text-[13px] text-[var(--text-muted)]">
              Uploading documents requires `farm:write` permission.
            </div>
          ) : null}

          <form className="mt-5 space-y-4" onSubmit={form.handleSubmit((values) => createDocument.mutate(values))}>
            <div>
              <label className="form-label">Document title</label>
              <input className="form-input" {...form.register('title')} />
              {form.formState.errors.title ? <p className="form-error">{form.formState.errors.title.message}</p> : null}
            </div>
            <div>
              <label className="form-label">Document type</label>
              <select className="form-input" {...form.register('document_type')}>
                {documentTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Reference number</label>
                <input className="form-input" {...form.register('reference_number')} />
              </div>
              <div>
                <label className="form-label">Issuing authority</label>
                <input className="form-input" {...form.register('issuing_authority')} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Issue date</label>
                <input type="date" className="form-input" {...form.register('issue_date')} />
              </div>
              <div>
                <label className="form-label">Expiry date</label>
                <input type="date" className="form-input" {...form.register('expiry_date')} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Renewal date</label>
                <input type="date" className="form-input" {...form.register('renewal_date')} />
              </div>
              <div>
                <label className="form-label">Responsible person</label>
                <input className="form-input" {...form.register('responsible_person')} />
              </div>
            </div>
            <div>
              <label className="form-label">Document file</label>
              <input id="compliance-file" type="file" className="form-input px-3 py-2" />
            </div>
            <div>
              <label className="form-label">Notes</label>
              <textarea className="form-input min-h-[110px]" {...form.register('notes')} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={!canManage || createDocument.isPending}>
              <Upload className="h-4 w-4" />
              {createDocument.isPending ? 'Uploading...' : 'Save Document'}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-[18px] w-[18px] text-[var(--brand-primary)]" />
              <h2 className="text-[1rem] font-semibold text-[var(--text-strong)]">Expiry Alerts</h2>
            </div>
            <div className="mt-4 space-y-2.5">
              {visibleAlerts.length ? visibleAlerts.map((alert) => (
                <div key={alert.document_id} className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[14px] font-semibold text-[var(--text-strong)]">{alert.title}</div>
                    <span className="badge badge-brand uppercase">{formatStatus(alert.status)}</span>
                  </div>
                  <div className="mt-1 text-[13px] text-[var(--text-muted)]">
                    {alertCopy(alert.days_to_expiry)} - reminders at {alert.reminder_offsets.join(' / ')} days
                  </div>
                </div>
              )) : (
                <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
                  No compliance alerts.
                </div>
              )}
            </div>
          </div>

          {section === 'documents' ? (
            <div className="card overflow-hidden">
              <div className="border-b border-[var(--border-subtle)] px-5 py-4">
                <h2 className="text-[1rem] font-semibold text-[var(--text-strong)]">Document Register</h2>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">Saved tax, licence, and permit records.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Status</th>
                      <th>Expiry</th>
                      <th>File</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.length ? documents.map((doc) => (
                      <tr key={doc.id}>
                        <td>
                          <div className="font-semibold text-[var(--text-strong)]">{doc.title}</div>
                          <div className="mt-1 text-[12px] text-[var(--text-muted)]">
                            {formatStatus(doc.document_type)} {doc.reference_number ? `- ${doc.reference_number}` : ''}
                          </div>
                        </td>
                        <td><span className="badge badge-brand uppercase">{formatStatus(doc.status)}</span></td>
                        <td>
                          <div>{formatDate(doc.expiry_date)}</div>
                          <div className="mt-1 text-[12px] text-[var(--text-muted)]">{alertCopy(doc.days_to_expiry)}</div>
                        </td>
                        <td>
                          {doc.file_url ? (
                            <a href={doc.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[var(--brand-primary)]">
                              <FileText className="h-4 w-4" />
                              Open
                            </a>
                          ) : (
                            'No file'
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-[var(--text-muted)]">No documents uploaded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card p-5">
              <div className="flex items-center gap-3">
                <FileBadge2 className="h-[18px] w-[18px] text-[var(--brand-primary)]" />
                <h2 className="text-[1rem] font-semibold text-[var(--text-strong)]">Alert Queue</h2>
              </div>
              <div className="mt-4 space-y-3">
                {visibleAlerts.map((alert) => (
                  <div key={`${alert.document_id}-queue`} className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                    <div className="font-semibold text-[var(--text-strong)]">{alert.title}</div>
                    <div className="mt-1 text-[13px] text-[var(--text-muted)]">
                      {formatDate(alert.expiry_date)} - {alertCopy(alert.days_to_expiry)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
