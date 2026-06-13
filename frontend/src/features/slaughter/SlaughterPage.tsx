import { useEffect, useMemo, useState } from 'react'
import { Boxes, CalendarDays, ClipboardList, PackagePlus, Scissors, TrendingUp } from 'lucide-react'
import { Modal } from '@/components/Modal'
import {
  useSlaughterRecords,
  useBatches,
  useStockItems,
  useCreateRecord,
  useCompleteRecord,
  useCreateOutput,
  emptyOutputValues,
} from './hooks'
import { RecordForm } from './forms/RecordForm'
import { CompletionForm } from './forms/CompletionForm'
import { OutputForm } from './forms/OutputForm'
import { RecordFormValues, CompletionFormValues, OutputFormValues } from './schemas'
import {
  SlaughterSection,
  SlaughterRecord,
  StockItem,
  productionOutputCatalog,
  productionOutputStockSkus,
  productionOutputStockNames,
  saleableOutputTypes,
  byproductOutputTypes,
} from './types'
import {
  formatDate,
  formatUGX,
  statusBadge,
  outputLabel,
  isSaleableOutput,
  isByproductOutput,
  inferOutputType,
  getSectionCopy,
} from './utils'

function SlaughterMetrics({ records, completedRecords, allOutputs }: { records: SlaughterRecord[]; completedRecords: SlaughterRecord[]; allOutputs: any[] }) {
  const averageYield =
    completedRecords.filter((record) => record.yield_percentage != null).length > 0
      ? `${(
          completedRecords
            .filter((record) => record.yield_percentage != null)
            .reduce((sum, record) => sum + Number(record.yield_percentage || 0), 0) /
          completedRecords.filter((record) => record.yield_percentage != null).length
        ).toFixed(1)}%`
      : 'No data'

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="metric-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="metric-label">Records</div>
            <div className="metric-value">{records.length.toLocaleString()}</div>
            <div className="metric-note">Slaughter runs captured across planning and completion stages.</div>
          </div>
          <div className="metric-icon">
            <ClipboardList className="h-5 w-5" />
          </div>
        </div>
      </div>
      <div className="metric-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="metric-label">Average Yield</div>
            <div className="metric-value">{averageYield}</div>
            <div className="metric-note">Based on completed runs with dressed-weight approvals.</div>
          </div>
          <div className="metric-icon">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
      </div>
      <div className="metric-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="metric-label">Outputs</div>
            <div className="metric-value">{allOutputs.length.toLocaleString()}</div>
            <div className="metric-note">Approved output lines already transferred into inventory.</div>
          </div>
          <div className="metric-icon">
            <Boxes className="h-5 w-5" />
          </div>
        </div>
      </div>
    </div>
  )
}

function RecordsSection({ section, records, batches, planningRecords, onFinalizeClick, onRecordClick }: any) {
  const copy = getSectionCopy(section)
  const recordRows = section === 'planning' ? planningRecords : records

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-neutral-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">
              {section === 'planning' ? 'Scheduled and active runs' : 'Processing runs'}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {section === 'planning'
                ? 'Monitor scheduled and in-progress batches before they reach yield approval.'
                : 'Finalize yield, approval, and cold-room posting one record at a time.'}
            </p>
          </div>
          <button type="button" className="btn-primary shrink-0" onClick={onRecordClick}>
            <CalendarDays className="h-4 w-4" />
            {copy.actionLabel}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Date</th>
                <th>Batch / House</th>
                <th>Status</th>
                <th>Live birds</th>
                <th>Yield</th>
                <th>Approval</th>
                <th>Outputs</th>
                <th className="pr-6">Action</th>
              </tr>
            </thead>
            <tbody>
              {recordRows.length === 0 ? (
                <tr>
                  <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={8}>
                    {section === 'planning' ? 'No scheduled slaughter runs yet.' : 'No slaughter records.'}
                  </td>
                </tr>
              ) : (
                recordRows.map((record: SlaughterRecord) => {
                  const batch = batches.find((entry: any) => entry.id === record.batch_id)
                  return (
                    <tr key={record.id}>
                      <td className="pl-6">{formatDate(record.slaughter_date)}</td>
                      <td>
                        <div className="font-semibold text-neutral-900">{batch?.batch_number || `Batch #${record.batch_id}`}</div>
                        <div className="mt-1 text-xs text-neutral-500">{batch?.house?.name || 'No house assigned'}</div>
                      </td>
                      <td>
                        <span className={statusBadge(record.status)}>{record.status.replace(/_/g, ' ')}</span>
                      </td>
                      <td>
                        <div>{record.live_birds_count.toLocaleString()} birds</div>
                        <div className="mt-1 text-xs text-neutral-500">{record.total_live_weight.toLocaleString()} kg live</div>
                      </td>
                      <td>{record.yield_percentage != null ? `${record.yield_percentage.toFixed(1)}%` : 'Pending'}</td>
                      <td>
                        <span className={statusBadge(record.approval_status)}>{record.approval_status}</span>
                      </td>
                      <td>{record.outputs?.length?.toLocaleString() ?? 0}</td>
                      <td className="pr-6">
                        <button type="button" className="btn-secondary btn-sm" onClick={() => onFinalizeClick(record)}>
                          Finalize Yield
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function OutputsSection({ section, visibleOutputs, stockItems, approvedRecords, onOutputClick }: any) {
  const copy = getSectionCopy(section)

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-neutral-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">
              {section === 'cuts' ? 'Cut-part ledger' : section === 'byproducts' ? 'Byproduct ledger' : 'Output ledger'}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {section === 'cuts'
                ? 'Saleable cut parts and processed poultry products already moved into stock.'
                : section === 'byproducts'
                  ? 'Manure and reusable byproducts captured from approved runs.'
                  : 'Finished product, cut-part, and byproduct lines transferred into inventory.'}
            </p>
          </div>
          <button type="button" className="btn-primary shrink-0" onClick={onOutputClick} disabled={approvedRecords.length === 0}>
            <PackagePlus className="h-4 w-4" />
            {copy.actionLabel}
          </button>
        </div>
        {approvedRecords.length === 0 ? (
          <div className="border-b border-neutral-100 bg-amber-50/60 px-6 py-3 text-sm text-amber-700">
            Approve at least one completed slaughter run before posting inventory outputs.
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Date</th>
                <th>Record</th>
                <th>Type</th>
                <th>Stock item</th>
                <th>Quantity</th>
                <th className="pr-6">Total cost</th>
              </tr>
            </thead>
            <tbody>
              {visibleOutputs.length === 0 ? (
                <tr>
                  <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={6}>
                    {section === 'cuts' ? 'No cut parts posted yet.' : section === 'byproducts' ? 'No byproducts posted yet.' : 'No slaughter outputs posted yet.'}
                  </td>
                </tr>
              ) : (
                visibleOutputs.map((output: any) => (
                  <tr key={`${output.record_id}-${output.id}`}>
                    <td className="pl-6">{formatDate(output.slaughter_date)}</td>
                    <td>Record #{output.record_id}</td>
                    <td>{outputLabel(output.output_type)}</td>
                    <td>{stockItems.find((item: StockItem) => item.id === output.stock_item_id)?.name || `Item #${output.stock_item_id}`}</td>
                    <td>
                      {output.quantity.toLocaleString()} {stockItems.find((item: StockItem) => item.id === output.stock_item_id)?.unit_of_measure || ''}
                    </td>
                    <td className="pr-6 font-semibold text-neutral-900">UGX {(output.total_cost || 0).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function YieldSection({ completedRecords, batches, yieldSummary }: any) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
      <div className="card overflow-hidden">
        <div className="border-b border-neutral-100 px-6 py-5">
          <h2 className="text-lg font-bold text-neutral-900">Yield and loss report</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Completed runs with dressing performance, quality inspection, approval, and storage posting status.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Run</th>
                <th>Live</th>
                <th>Dressed</th>
                <th>Yield</th>
                <th>Loss</th>
                <th>Quality</th>
                <th className="pr-6">Storage / Inventory</th>
              </tr>
            </thead>
            <tbody>
              {completedRecords.length === 0 ? (
                <tr>
                  <td className="pl-6 py-14 text-sm text-neutral-500" colSpan={7}>
                    No completed slaughter records to analyze yet.
                  </td>
                </tr>
              ) : (
                completedRecords.map((record: SlaughterRecord) => {
                  const batch = batches.find((entry: any) => entry.id === record.batch_id)
                  return (
                    <tr key={`yield-${record.id}`}>
                      <td className="pl-6">
                        <div className="font-semibold text-neutral-900">Record #{record.id}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {batch?.batch_number || `Batch #${record.batch_id}`} | {formatDate(record.slaughter_date)}
                        </div>
                      </td>
                      <td>
                        <div>{record.live_birds_count.toLocaleString()} birds</div>
                        <div className="mt-1 text-xs text-neutral-500">{record.total_live_weight.toLocaleString()} kg live</div>
                      </td>
                      <td>
                        <div>{Number(record.total_dressed_weight || 0).toLocaleString()} kg</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          Avg {record.average_dressed_weight != null ? record.average_dressed_weight.toFixed(3) : '-'} kg/bird
                        </div>
                      </td>
                      <td>{record.yield_percentage != null ? `${record.yield_percentage.toFixed(1)}%` : 'Pending'}</td>
                      <td>
                        <div>{record.loss_percentage != null ? `${record.loss_percentage.toFixed(1)}%` : '-'}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          Condemned {record.condemned_birds_count} | Mortality {record.mortality_birds_count}
                        </div>
                      </td>
                      <td>
                        <span className={statusBadge(record.quality_inspection_status)}>{record.quality_inspection_status}</span>
                        <div className="mt-1 text-xs text-neutral-500">{record.approval_status}</div>
                      </td>
                      <td className="pr-6">
                        <div>{record.cold_room_location || 'No cold-room assigned'}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {record.inventory_posted_at ? `Posted ${formatDate(record.inventory_posted_at)}` : 'Inventory not posted'}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-6">
        <div className="card p-6">
          <h2 className="text-lg font-bold text-neutral-900">Processing totals</h2>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3">
              <span className="text-sm text-neutral-600">Completed runs</span>
              <span className="text-sm font-semibold text-neutral-900">{completedRecords.length}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3">
              <span className="text-sm text-neutral-600">Live birds processed</span>
              <span className="text-sm font-semibold text-neutral-900">{yieldSummary.liveBirds.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3">
              <span className="text-sm text-neutral-600">Total dressed weight</span>
              <span className="text-sm font-semibold text-neutral-900">{yieldSummary.dressedWeight.toLocaleString()} kg</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3">
              <span className="text-sm text-neutral-600">Waste recorded</span>
              <span className="text-sm font-semibold text-neutral-900">{yieldSummary.wasteWeight.toLocaleString()} kg</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3">
              <span className="text-sm text-neutral-600">Condemned birds</span>
              <span className="text-sm font-semibold text-neutral-900">{yieldSummary.condemnedBirds.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-bold text-neutral-900">Waste and byproduct breakdown</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              Blood: <span className="font-semibold text-neutral-900">{yieldSummary.bloodWeight.toLocaleString()} kg</span>
            </div>
            <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              Feathers: <span className="font-semibold text-neutral-900">{yieldSummary.feathersWeight.toLocaleString()} kg</span>
            </div>
            <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              Offal: <span className="font-semibold text-neutral-900">{yieldSummary.offalWeight.toLocaleString()} kg</span>
            </div>
            <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              Head: <span className="font-semibold text-neutral-900">{yieldSummary.headWeight.toLocaleString()} kg</span>
            </div>
            <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              Feet: <span className="font-semibold text-neutral-900">{yieldSummary.feetWeight.toLocaleString()} kg</span>
            </div>
            <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              Reusable byproducts: <span className="font-semibold text-neutral-900">{yieldSummary.reusableByproductsWeight.toLocaleString()} kg</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SlaughterPage({ section }: { section: SlaughterSection }) {
  const copy = getSectionCopy(section)
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false)
  const [isOutputModalOpen, setIsOutputModalOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<SlaughterRecord | null>(null)

  const { data: records = [] } = useSlaughterRecords()
  const { data: batches = [] } = useBatches()
  const { data: stockItems = [] } = useStockItems()

  const outputInventoryItems = useMemo(() => {
    const matched = stockItems.filter((item: StockItem) => {
      const normalizedSku = item.sku?.trim().toLowerCase()
      if (normalizedSku && productionOutputStockSkus.has(normalizedSku)) return true
      return productionOutputStockNames.has(item.name.trim().toLowerCase())
    })
    return matched.length > 0 ? matched : stockItems
  }, [stockItems])

  const createRecord = useCreateRecord()
  const completeRecord = useCompleteRecord()
  const createOutput = useCreateOutput(outputInventoryItems)

  const completedRecords = useMemo(() => records.filter((record) => record.status === 'completed'), [records])
  const planningRecords = useMemo(() => records.filter((record) => record.status === 'scheduled' || record.status === 'in_progress'), [records])
  const approvedRecords = useMemo(() => records.filter((record) => record.status === 'completed' && record.approval_status === 'approved'), [records])

  const allOutputs = useMemo(
    () =>
      records.flatMap((record) =>
        (record.outputs || []).map((output) => ({
          ...output,
          record_id: record.id,
          slaughter_date: record.slaughter_date,
        }))
      ),
    [records]
  )

  const outputCatalogForSection = useMemo(() => {
    if (section === 'cuts') return productionOutputCatalog.filter((entry) => isSaleableOutput(entry.value))
    if (section === 'byproducts') return productionOutputCatalog.filter((entry) => isByproductOutput(entry.value))
    return productionOutputCatalog
  }, [section])

  const visibleOutputs = useMemo(() => {
    if (section === 'cuts') return allOutputs.filter((output) => isSaleableOutput(output.output_type))
    if (section === 'byproducts') return allOutputs.filter((output) => isByproductOutput(output.output_type))
    return allOutputs
  }, [allOutputs, section])

  const yieldSummary = useMemo(
    () =>
      completedRecords.reduce(
        (summary, record) => ({
          liveBirds: summary.liveBirds + record.live_birds_count,
          dressedWeight: summary.dressedWeight + Number(record.total_dressed_weight || 0),
          wasteWeight: summary.wasteWeight + Number(record.waste_weight || 0),
          condemnedBirds: summary.condemnedBirds + Number(record.condemned_birds_count || 0),
          bloodWeight: summary.bloodWeight + Number(record.blood_weight || 0),
          feathersWeight: summary.feathersWeight + Number(record.feathers_weight || 0),
          offalWeight: summary.offalWeight + Number(record.offal_weight || 0),
          headWeight: summary.headWeight + Number(record.head_weight || 0),
          feetWeight: summary.feetWeight + Number(record.feet_weight || 0),
          reusableByproductsWeight: summary.reusableByproductsWeight + Number(record.reusable_byproducts_weight || 0),
        }),
        {
          liveBirds: 0,
          dressedWeight: 0,
          wasteWeight: 0,
          condemnedBirds: 0,
          bloodWeight: 0,
          feathersWeight: 0,
          offalWeight: 0,
          headWeight: 0,
          feetWeight: 0,
          reusableByproductsWeight: 0,
        }
      ),
    [completedRecords]
  )

  const isOutputSection = section === 'outputs' || section === 'cuts' || section === 'byproducts'

  const handleRecordSubmit = (values: RecordFormValues) => {
    createRecord.mutate(values, {
      onSuccess: () => {
        setIsRecordModalOpen(false)
      },
    })
  }

  const handleCompletionSubmit = (values: CompletionFormValues) => {
    completeRecord.mutate(values, {
      onSuccess: () => {
        setSelectedRecord(null)
      },
    })
  }

  const handleOutputSubmit = (values: OutputFormValues) => {
    createOutput.mutate(values, {
      onSuccess: () => {
        setIsOutputModalOpen(false)
      },
    })
  }

  const availableOutputItems = useMemo(
    () =>
      outputInventoryItems.filter((item) => {
        const outputType = inferOutputType(item)
        return !!outputType && outputCatalogForSection.some((entry) => entry.value === outputType)
      }),
    [outputCatalogForSection, outputInventoryItems]
  )

  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">{copy.title}</h1>
          <p className="section-subtitle">{copy.description}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
          <Scissors className="h-3.5 w-3.5" />
          Processing Workflow
        </div>
      </div>

      <SlaughterMetrics records={records} completedRecords={completedRecords} allOutputs={allOutputs} />

      {(section === 'planning' || section === 'records') && (
        <RecordsSection
          section={section}
          records={records}
          batches={batches}
          planningRecords={planningRecords}
          onFinalizeClick={(record: SlaughterRecord) => setSelectedRecord(record)}
          onRecordClick={() => setIsRecordModalOpen(true)}
        />
      )}

      {isOutputSection && (
        <OutputsSection
          section={section}
          visibleOutputs={visibleOutputs}
          stockItems={stockItems}
          approvedRecords={approvedRecords}
          onOutputClick={() => setIsOutputModalOpen(true)}
        />
      )}

      {section === 'yield' && <YieldSection completedRecords={completedRecords} batches={batches} yieldSummary={yieldSummary} />}

      <Modal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title={section === 'planning' ? 'Plan slaughter run' : 'Enter slaughter record'}
        description={copy.actionDescription}
      >
        <RecordForm
          batches={batches}
          section={section}
          onSubmit={handleRecordSubmit}
          isLoading={createRecord.isPending}
          onCancel={() => setIsRecordModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isOutputModalOpen}
        onClose={() => setIsOutputModalOpen(false)}
        title={
          section === 'cuts' ? 'Post cut part output' : section === 'byproducts' ? 'Post byproduct output' : 'Post product output'
        }
        description={copy.actionDescription}
      >
        <OutputForm
          approvedRecords={approvedRecords}
          stockItems={outputInventoryItems}
          section={section}
          onSubmit={handleOutputSubmit}
          isLoading={createOutput.isPending}
          onCancel={() => setIsOutputModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={selectedRecord ? `Finalize Yield - Record #${selectedRecord.id}` : 'Finalize Yield'}
        description="Update dressed weight, inspection result, approval status, storage location, and loss categories for one record."
      >
        {selectedRecord && (
          <CompletionForm
            record={selectedRecord}
            onSubmit={handleCompletionSubmit}
            onCancel={() => setSelectedRecord(null)}
            isLoading={completeRecord.isPending}
          />
        )}
      </Modal>
    </div>
  )
}
