import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, Download, FileSpreadsheet, FileText, Loader2, Search, Table2 } from 'lucide-react'
import { toast } from 'sonner'

import { getErrorMessage } from '@/lib/errors'
import { reportsService, type ReportCatalogItem, type ReportPreview, type ReportRequest } from '@/services/reportsService'
import { useAuth } from '@/features/auth/AuthContext'

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartValue() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') return value.toLocaleString()
  return String(value)
}

function defaultFields(report?: ReportCatalogItem) {
  return report?.fields.filter((field) => field.default).map((field) => field.key) ?? []
}

export function ReportCenterPage() {
  const { reportKey } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const catalogQuery = useQuery({ queryKey: ['reports-catalog'], queryFn: reportsService.catalog })
  // Show a report only to roles that can access its underlying domain.
  const REPORT_CATEGORY_PERMISSION: Record<string, string> = {
    'Sales Reports': 'sales:read',
    'Inventory Reports': 'inventory:read',
    'Feed Reports': 'feed:read',
    'Finance Reports': 'finance:read',
    'Accounting Reports': 'accounting:read',
    'Compliance Reports': 'farm:read',
  }
  const catalog = (catalogQuery.data ?? []).filter((report) =>
    hasPermission(REPORT_CATEGORY_PERMISSION[report.category] ?? 'reports:read')
  )
  const selectedReport = reportKey ? catalog.find((report) => report.key === reportKey) : undefined
  const [filters, setFilters] = useState({ start_date: monthStartValue(), end_date: todayValue(), search: '' })
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [preview, setPreview] = useState<ReportPreview | null>(null)

  useEffect(() => {
    if (selectedReport) {
      setSelectedFields(defaultFields(selectedReport))
      setPreview(null)
    }
  }, [selectedReport?.key])

  const payload: ReportRequest = useMemo(
    () => ({
      start_date: filters.start_date || null,
      end_date: filters.end_date || null,
      search: filters.search || null,
      selected_fields: selectedFields,
      limit: 200,
    }),
    [filters, selectedFields]
  )

  const groupedCatalog = useMemo(() => {
    return catalog.reduce<Record<string, ReportCatalogItem[]>>((groups, report) => {
      groups[report.category] = [...(groups[report.category] ?? []), report]
      return groups
    }, {})
  }, [catalog])

  const generateMutation = useMutation({
    mutationFn: () => reportsService.preview(selectedReport!.key, payload),
    onSuccess: (data) => setPreview(data),
    onError: (error) => toast.error(getErrorMessage(error, 'Report could not be generated.')),
  })

  const exportMutation = useMutation({
    mutationFn: (format: 'pdf' | 'csv' | 'xlsx') => reportsService.export(selectedReport!.key, payload, format),
    onError: (error) => toast.error(getErrorMessage(error, 'Report export failed.')),
  })

  if (!reportKey) {
    return (
      <div className="animate-fade-in space-y-5 pb-10">
        <div className="section-header">
          <div>
            <h1 className="section-title">Report Center</h1>
            <p className="section-subtitle">Choose one report, set filters, preview real records, then export a professional document.</p>
          </div>
        </div>

        {catalogQuery.isLoading ? (
          <div className="card flex items-center gap-3 p-5 text-ink-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading reports...</div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {Object.entries(groupedCatalog).map(([category, reports]) => (
            <section key={category} className="card p-5">
              <h2 className="text-[1rem] font-semibold text-ink-900">{category}</h2>
              <div className="mt-4 space-y-2">
                {reports.map((report) => (
                  <button
                    key={report.key}
                    type="button"
                    onClick={() => navigate(`/reports/${report.key}`)}
                    className="flex w-full items-start justify-between gap-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-left transition-colors hover:border-[rgba(var(--brand-primary-rgb),0.35)] hover:bg-[var(--surface-soft)]"
                  >
                    <span>
                      <span className="block text-[14px] font-semibold text-ink-900">{report.title}</span>
                      <span className="mt-1 block text-[12.5px] leading-5 text-ink-500">{report.description}</span>
                    </span>
                    <Table2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    )
  }

  if (!selectedReport && !catalogQuery.isLoading) {
    return (
      <div className="card p-6">
        <h1 className="section-title">Report not found</h1>
        <p className="section-subtitle">Choose a valid report from the report center.</p>
        <Link to="/reports" className="btn-primary mt-4">Back to reports</Link>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-5 pb-10">
      <div className="section-header">
        <div>
          <button type="button" onClick={() => navigate('/reports')} className="btn-ghost btn-sm mb-2">
            <ArrowLeft className="h-4 w-4" /> All reports
          </button>
          <h1 className="section-title">{selectedReport?.title ?? 'Report'}</h1>
          <p className="section-subtitle">{selectedReport?.description}</p>
        </div>
      </div>

      <section className="card p-5">
        <div className="grid gap-4 md:grid-cols-3">
          {selectedReport?.filters.some((filter) => filter.key === 'start_date') ? (
            <div>
              <label className="form-label">Start date</label>
              <input className="form-input" type="date" value={filters.start_date} onChange={(event) => setFilters((current) => ({ ...current, start_date: event.target.value }))} />
            </div>
          ) : null}
          {selectedReport?.filters.some((filter) => filter.key === 'end_date') ? (
            <div>
              <label className="form-label">{selectedReport.filters.find((filter) => filter.key === 'end_date')?.label ?? 'End date'}</label>
              <input className="form-input" type="date" value={filters.end_date} onChange={(event) => setFilters((current) => ({ ...current, end_date: event.target.value }))} />
            </div>
          ) : null}
          {selectedReport?.filters.some((filter) => filter.key === 'search') ? (
            <div>
              <label className="form-label">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
                <input className="form-input pl-9" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Invoice, item, customer..." />
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold text-ink-900">Fields to include</h2>
              <p className="text-[12.5px] text-ink-500">Preview and exports use only selected fields.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setSelectedFields(defaultFields(selectedReport))}>Default</button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setSelectedFields(selectedReport?.fields.map((field) => field.key) ?? [])}>All</button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedReport?.fields.map((field) => {
              const checked = selectedFields.includes(field.key)
              return (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => setSelectedFields((current) => (checked ? current.filter((key) => key !== field.key) : [...current, field.key]))}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-[7px] border px-3 text-[12px] font-semibold ${checked ? 'border-[rgba(var(--brand-primary-rgb),0.35)] bg-[rgba(var(--brand-primary-rgb),0.1)] text-[var(--brand-primary)]' : 'border-[var(--border-subtle)] text-ink-600'}`}
                >
                  {checked ? <Check className="h-3.5 w-3.5" /> : null}
                  {field.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={() => generateMutation.mutate()} disabled={!selectedReport || selectedFields.length === 0 || generateMutation.isPending}>
            {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Table2 className="h-4 w-4" />}
            Generate report
          </button>
          <button type="button" className="btn-secondary" onClick={() => { setPreview(null); setFilters({ start_date: monthStartValue(), end_date: todayValue(), search: '' }) }}>Reset filters</button>
        </div>
      </section>

      {!preview ? (
        <section className="card p-8 text-center">
          <Table2 className="mx-auto h-8 w-8 text-[var(--brand-primary)]" />
          <h2 className="mt-3 text-[1rem] font-semibold text-ink-900">No report generated yet</h2>
          <p className="mx-auto mt-2 max-w-xl text-[13.5px] leading-6 text-ink-500">Set the filters above, choose the fields you need, then generate a preview. Export buttons appear after real data is loaded.</p>
        </section>
      ) : (
        <section className="card overflow-hidden">
          <div className="surface-header">
            <div>
              <h2 className="surface-title">Preview</h2>
              <p className="surface-subtitle">{preview.row_count.toLocaleString()} matching records. Showing up to {preview.rows.length.toLocaleString()} rows.</p>
            </div>
            {hasPermission('reports:export') ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary btn-sm" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate('pdf')}><FileText className="h-4 w-4" /> PDF</button>
                <button type="button" className="btn-secondary btn-sm" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate('xlsx')}><FileSpreadsheet className="h-4 w-4" /> Excel</button>
                <button type="button" className="btn-secondary btn-sm" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate('csv')}><Download className="h-4 w-4" /> CSV</button>
              </div>
            ) : null}
          </div>
          {Object.keys(preview.totals).length ? (
            <div className="grid gap-3 border-b border-[var(--border-subtle)] p-4 sm:grid-cols-3">
              {Object.entries(preview.totals).map(([key, value]) => (
                <div key={key} className="rounded-[8px] bg-[var(--surface-soft)] px-3 py-2">
                  <div className="metric-label">{key.replace(/_/g, ' ')}</div>
                  <div className="mt-1 text-[1rem] font-semibold text-ink-900">{formatCell(value)}</div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>{preview.selected_fields.map((field) => <th key={field}>{field.replace(/_/g, ' ')}</th>)}</tr>
              </thead>
              <tbody>
                {preview.rows.length === 0 ? (
                  <tr><td colSpan={preview.selected_fields.length || 1} className="text-center text-ink-500">No records match this filter.</td></tr>
                ) : (
                  preview.rows.map((row, index) => (
                    <tr key={index}>{preview.selected_fields.map((field) => <td key={field}>{formatCell(row[field])}</td>)}</tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
