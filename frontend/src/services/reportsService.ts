import api from '@/services/api'

export interface ReportField {
  key: string
  label: string
  default: boolean
}

export interface ReportFilter {
  key: string
  label: string
  type: 'date' | 'text' | 'select'
}

export interface ReportCatalogItem {
  key: string
  title: string
  category: string
  description: string
  fields: ReportField[]
  filters: ReportFilter[]
}

export interface ReportRequest {
  start_date?: string | null
  end_date?: string | null
  search?: string | null
  selected_fields: string[]
  limit?: number
}

export interface ReportPreview {
  report: ReportCatalogItem
  selected_fields: string[]
  filters_applied: Record<string, string | null>
  rows: Array<Record<string, string | number | boolean | null>>
  totals: Record<string, string | number>
  row_count: number
}

export const reportsService = {
  catalog: () => api.get<ReportCatalogItem[]>('/reports/catalog').then((response) => response.data),
  preview: (reportKey: string, payload: ReportRequest) =>
    api.post<ReportPreview>(`/reports/${reportKey}/preview`, payload).then((response) => response.data),
  export: async (reportKey: string, payload: ReportRequest, format: 'pdf' | 'csv' | 'xlsx') => {
    const response = await api.post(`/reports/${reportKey}/export`, payload, {
      params: { format },
      responseType: 'blob',
    })
    const disposition = response.headers['content-disposition'] as string | undefined
    const match = disposition?.match(/filename="?(.*?)"?$/)
    const filename = match?.[1] || `farmexa-${reportKey}.${format}`
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  },
}
