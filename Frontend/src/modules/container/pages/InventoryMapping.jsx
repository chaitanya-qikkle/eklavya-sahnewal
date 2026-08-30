import React, { useMemo, useState } from 'react'
import { FiMapPin, FiPackage, FiGrid, FiLayers, FiCheckCircle, FiRefreshCw } from 'react-icons/fi'
import { notify } from '../../../utils/notify'
import {
  useGetInventoryEntryBlockListQuery,
  useUpdatePhysicalLocationMutation,
} from '../../../store/api/ymsApi'

const HEIGHTS = [1, 2, 3, 4]

// Used only if the get-block-list API call fails or returns no data.
const FALLBACK_BLOCKS = [
  { Block: 'RAIL',   MinRow: 'A', MaxRow: 'C', MinColumn: '1', MaxColumn: '99' },
  { Block: 'EXP-EX', MinRow: 'C', MaxRow: 'I', MinColumn: '1', MaxColumn: '9' },
  { Block: 'EMT',    MinRow: 'A', MaxRow: 'V', MinColumn: '1', MaxColumn: '9' },
  { Block: 'IMP',    MinRow: 'A', MaxRow: 'H', MinColumn: '1', MaxColumn: '9' },
  { Block: 'IMP-EX', MinRow: 'A', MaxRow: 'R', MinColumn: '1', MaxColumn: '9' },
  { Block: 'TG',     MinRow: 'A', MaxRow: 'D', MinColumn: '1', MaxColumn: '9' },
]

const letterRange = (min, max) => {
  const start = String(min || 'A').toUpperCase().charCodeAt(0)
  const end = String(max || 'A').toUpperCase().charCodeAt(0)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return []
  const out = []
  for (let c = start; c <= end; c++) out.push(String.fromCharCode(c))
  return out
}

const FieldLabel = ({ icon: Icon, children }) => (
  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-1">
    <Icon className="text-[#0e4a78] text-xs" />
    {children}
  </label>
)

const InventoryMapping = () => {
  const { data: blockListData, isFetching: isBlockListLoading } = useGetInventoryEntryBlockListQuery()
  const [updateLocation, { isLoading: isSubmitting }] = useUpdatePhysicalLocationMutation()

  const [containerNo, setContainerNo] = useState('')
  const [blockName, setBlockName] = useState('')
  const [rowNo, setRowNo] = useState('')
  const [columnNo, setColumnNo] = useState('')
  const [height, setHeight] = useState(1)

  const blocks = useMemo(() => {
    const apiList = Array.isArray(blockListData?.data) ? blockListData.data : []
    const list = apiList.length > 0 ? apiList : FALLBACK_BLOCKS
    return list
      .map((b) => ({
        block: String(b?.Block ?? b?.block ?? '').trim(),
        minRow: b?.MinRow ?? b?.minRow,
        maxRow: b?.MaxRow ?? b?.maxRow,
        minColumn: Number(b?.MinColumn ?? b?.minColumn) || 1,
        maxColumn: Number(b?.MaxColumn ?? b?.maxColumn) || 1,
      }))
      .filter((b) => b.block)
  }, [blockListData])

  const selectedBlock = useMemo(
    () => blocks.find((b) => b.block === blockName) || null,
    [blocks, blockName]
  )

  const rowOptions = useMemo(
    () => (selectedBlock ? letterRange(selectedBlock.minRow, selectedBlock.maxRow) : []),
    [selectedBlock]
  )

  const handleBlockChange = (value) => {
    setBlockName(value)
    setRowNo('')
    setColumnNo('')
  }

  const resetForm = () => {
    setContainerNo('')
    setBlockName('')
    setRowNo('')
    setColumnNo('')
    setHeight(1)
  }

  const handleSave = async () => {
    if (!containerNo.trim()) {
      notify.warning('Validation', 'Container No is required')
      return
    }
    if (!blockName) {
      notify.warning('Validation', 'Please select a Block / Yard')
      return
    }
    if (!rowNo) {
      notify.warning('Validation', 'Please select a Row')
      return
    }
    const colNum = Number(columnNo)
    if (!columnNo || !Number.isFinite(colNum)) {
      notify.warning('Validation', 'Column is required')
      return
    }
    if (selectedBlock && (colNum < selectedBlock.minColumn || colNum > selectedBlock.maxColumn)) {
      notify.warning('Validation', `Column must be between ${selectedBlock.minColumn} and ${selectedBlock.maxColumn} for block ${blockName}`)
      return
    }

    try {
      const location = `${blockName}:${rowNo}:${columnNo}:${height}`
      const result = await updateLocation({
        container_no: containerNo.trim().toUpperCase(),
        location,
      }).unwrap()

      if (result?.status !== 'success') {
        throw new Error(result?.message || 'Failed to save mapping')
      }

      notify.success('Saved', result?.message || 'Container location mapped successfully')
      resetForm()
    } catch (err) {
      notify.error('Save failed', err?.data?.detail || err?.data?.message || err?.message || 'Something went wrong')
    }
  }

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')", height: '100dvh' }}
    >
      <div className="absolute inset-0 bg-white/80" />

      <div className="relative z-10 flex flex-col h-full w-full max-w-md mx-auto">

        {/* Compact Header */}
        <div className="flex items-center gap-2.5 px-4 pt-3 pb-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#0e4a78] flex items-center justify-center shadow shrink-0">
            <FiMapPin className="text-white text-sm" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-[#0e4a78] leading-tight">Inventory Mapping</h1>
            <p className="text-[11px] text-slate-500 leading-tight truncate">Assign container yard location</p>
          </div>
        </div>

        {/* Form Card — fills remaining space, no internal scroll */}
        <div className="flex-1 min-h-0 flex flex-col mx-3 mb-3 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-4 py-2 shrink-0">
            <h2 className="text-white font-bold text-xs tracking-wide uppercase">Mapping</h2>
          </div>

          <div className="flex-1 min-h-0 flex flex-col justify-between px-4 py-3 gap-2.5">

            <div className="space-y-2.5">
              {/* Container No */}
              <div>
                <FieldLabel icon={FiPackage}>Container No</FieldLabel>
                <input
                  type="text"
                  value={containerNo}
                  onChange={(e) => setContainerNo(e.target.value.toUpperCase())}
                  placeholder="e.g. MSDU8022011"
                  autoComplete="off"
                  className="w-full px-3 py-2 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] text-sm font-semibold text-slate-800 uppercase tracking-wide transition-colors shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Block / Yard */}
                <div>
                  <FieldLabel icon={FiGrid}>Block</FieldLabel>
                  <select
                    value={blockName}
                    onChange={(e) => handleBlockChange(e.target.value)}
                    disabled={isBlockListLoading}
                    className="w-full px-3 py-2 rounded-lg border-2 border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] text-sm font-medium text-slate-800 transition-colors shadow-sm disabled:bg-slate-100"
                  >
                    <option value="">{isBlockListLoading ? 'Loading…' : 'Select'}</option>
                    {blocks.map((b) => (
                      <option key={b.block} value={b.block}>{b.block}</option>
                    ))}
                  </select>
                </div>

                {/* Row */}
                <div>
                  <FieldLabel icon={FiLayers}>Row</FieldLabel>
                  <select
                    value={rowNo}
                    onChange={(e) => setRowNo(e.target.value)}
                    disabled={!blockName}
                    className="w-full px-3 py-2 rounded-lg border-2 border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] text-sm font-medium text-slate-800 transition-colors shadow-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    <option value="">{blockName ? 'Select' : '—'}</option>
                    {rowOptions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Column */}
              <div>
                <FieldLabel icon={FiGrid}>
                  Column {selectedBlock && (
                    <span className="normal-case text-slate-400 font-medium">
                      ({selectedBlock.minColumn}–{selectedBlock.maxColumn})
                    </span>
                  )}
                </FieldLabel>
                <input
                  type="number"
                  value={columnNo}
                  onChange={(e) => setColumnNo(e.target.value)}
                  min={selectedBlock?.minColumn}
                  max={selectedBlock?.maxColumn}
                  disabled={!blockName}
                  placeholder={selectedBlock ? `${selectedBlock.minColumn}–${selectedBlock.maxColumn}` : 'Select a block first'}
                  className="w-full px-3 py-2 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] text-sm font-medium text-slate-800 transition-colors shadow-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Height */}
              <div>
                <FieldLabel icon={FiLayers}>Height</FieldLabel>
                <div className="grid grid-cols-4 gap-2">
                  {HEIGHTS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHeight(h)}
                      className={`flex items-center justify-center gap-1 py-2 rounded-lg border-2 font-bold text-xs transition-all ${
                        height === h
                          ? 'border-[#0e4a78] bg-[#0e4a78] text-white shadow-md'
                          : 'border-slate-300 bg-white text-slate-600'
                      }`}
                    >
                      {height === h && <FiCheckCircle className="text-[10px]" />}
                      H{h}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Save Bar */}
            <div className="flex items-center gap-2 pt-1 shrink-0">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors shadow-sm"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white font-bold text-sm hover:from-[#0a3b61] hover:to-[#083153] transition-all shadow-md disabled:opacity-60"
              >
                {isSubmitting ? <FiRefreshCw className="animate-spin" /> : <FiCheckCircle />}
                {isSubmitting ? 'Saving…' : 'Save Mapping'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InventoryMapping
