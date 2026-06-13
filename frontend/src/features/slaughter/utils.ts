import { SlaughterSection, StockItem, productionOutputCatalog, saleableOutputTypes, byproductOutputTypes } from './types'

export function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatUGX(value: number | null | undefined) {
  return `UGX ${Number(value || 0).toLocaleString()}`
}

export function outputLabel(outputType: string) {
  return productionOutputCatalog.find((entry) => entry.value === outputType)?.label ?? outputType.replace(/_/g, ' ')
}

export function statusBadge(status: string) {
  if (status === 'completed' || status === 'approved' || status === 'passed') return 'badge badge-success'
  if (status === 'cancelled' || status === 'failed' || status === 'rejected') return 'badge badge-danger'
  if (status === 'in_progress' || status === 'rework') return 'badge badge-brand'
  return 'badge badge-neutral'
}

export function isSaleableOutput(outputType: string) {
  return saleableOutputTypes.has(outputType)
}

export function isByproductOutput(outputType: string) {
  return byproductOutputTypes.has(outputType)
}

export function inferOutputType(item?: StockItem | null) {
  const sku = item?.sku?.trim().toLowerCase()
  if (sku) {
    const skuMatch = productionOutputCatalog.find((entry) => entry.stockSku.toLowerCase() === sku)
    if (skuMatch) return skuMatch.value
  }
  const key = item?.name.trim().toLowerCase()
  if (!key) return null
  const match = productionOutputCatalog.find((entry) => entry.stockName.toLowerCase() === key)
  return match?.value ?? null
}

export function getSectionCopy(section: SlaughterSection) {
  const copies: Record<SlaughterSection, { title: string; description: string; actionLabel?: string; actionDescription?: string }> = {
    planning: {
      title: 'Slaughter Planning',
      description: 'Schedule and prepare one processing run at a time before final yield approval.',
      actionLabel: 'Plan slaughter run',
      actionDescription: 'Capture the date, batch, live birds, and pre-processing checks in a clean planning dialog.',
    },
    records: {
      title: 'Slaughter Records',
      description: 'Capture one slaughter run at a time, then finalize yield and approval in a separate step.',
      actionLabel: 'Enter slaughter record',
      actionDescription: 'Record live birds, weight, waste classes, inspection details, and storage notes in one modal.',
    },
    cuts: {
      title: 'Cut Parts',
      description: 'Track saleable poultry cuts such as dressed chicken, breast, thighs, wings, drumsticks, liver, and gizzards.',
      actionLabel: 'Post cut part output',
      actionDescription: 'Push approved cut-part quantities into inventory for later sales fulfillment.',
    },
    byproducts: {
      title: 'Byproducts',
      description: 'Track manure and reusable byproducts separately so disposal and reusable stock stay visible.',
      actionLabel: 'Post byproduct output',
      actionDescription: 'Record manure, head, and feet quantities from an approved run.',
    },
    outputs: {
      title: 'Product Outputs',
      description: 'Post approved finished products and reusable byproducts into inventory from completed runs.',
      actionLabel: 'Post product output',
      actionDescription: 'Select one approved run and transfer finished products into stock for sales and reporting.',
    },
    yield: {
      title: 'Yield Analysis',
      description: 'Review approved slaughter performance, loss drivers, waste totals, and storage posting history.',
    },
  }
  return copies[section]
}
