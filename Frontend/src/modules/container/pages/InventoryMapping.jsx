import React, { useEffect, useMemo, useRef, useState } from 'react'
import { FiMapPin, FiPackage, FiGrid, FiLayers, FiCheckCircle, FiRefreshCw } from 'react-icons/fi'
import { notify } from '../../../utils/notify'
import {
  useGetInventoryEntryBlockListQuery,
  useLazySearchContainerQuery,
  useUpdatePhysicalLocationMutation,
  useLazyGetPhysicalInventoryLogQuery,
} from '../../../store/api/ymsApi'

const fmtLogDate = (val) => {
  if (!val) return '—'
  const d = new Date(String(val).replace(' ', 'T'))
  if (isNaN(d)) return String(val)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const HEIGHTS = [1, 2, 3, 4]

// Used only if the get-block-list API call fails or returns no data.
// NOTE: OWH and EXP have inconsistent/swapped Row-Column axes in the source
// SP data (OWH: Row is numeric 1-9, Column is letters A-D — opposite of every
// other block; EXP: MinColumn "16" vs MaxColumn "G" don't form a valid range)
// — kept as-is per the real GET_BLOCK_LIST output, not corrected here.
const FALLBACK_BLOCKS = [
  { Block: 'RAIL',   MinRow: 'A', MaxRow: 'C', MinColumn: '1',  MaxColumn: '99' },
  { Block: 'EXP-EX', MinRow: 'C', MaxRow: 'I', MinColumn: '1',  MaxColumn: '9' },
  { Block: 'EMT',    MinRow: 'A', MaxRow: 'V', MinColumn: '1',  MaxColumn: '9' },
  { Block: 'EXP',    MinRow: '1', MaxRow: 'G', MinColumn: '16', MaxColumn: 'G' },
  { Block: 'IMP',    MinRow: 'A', MaxRow: 'H', MinColumn: '1',  MaxColumn: '9' },
  { Block: 'OWH',    MinRow: '1', MaxRow: '9', MinColumn: 'A',  MaxColumn: 'D' },
  { Block: 'IMP-EX', MinRow: 'A', MaxRow: 'R', MinColumn: '1',  MaxColumn: '9' },
  { Block: 'TG',     MinRow: 'A', MaxRow: 'D', MinColumn: '1',  MaxColumn: '9' },
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
  const [searchContainer, { data: searchData, isFetching: isSearching }] = useLazySearchContainerQuery()
  const [fetchLog, { data: logData, isFetching: isLogLoading }] = useLazyGetPhysicalInventoryLogQuery()

  const [containerNo, setContainerNo] = useState('')
  const [blockName, setBlockName] = useState('')
  const [rowNo, setRowNo] = useState('')
  const [columnNo, setColumnNo] = useState('')
  const [height, setHeight] = useState(1)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    const term = containerNo.trim()
    clearTimeout(debounceRef.current)
    if (!term) return
    debounceRef.current = setTimeout(() => {
      searchContainer(term)
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [containerNo, searchContainer])

  useEffect(() => { fetchLog({}) }, [] ) // eslint-disable-line

  const recentUpdates = useMemo(
    () => (Array.isArray(logData?.data) ? logData.data.slice(0, 15) : []),
    [logData]
  )

  const containerSuggestions = useMemo(() => {
    if (!containerNo.trim()) return []
    const rows = Array.isArray(searchData?.data) ? searchData.data : []
    return rows
      .map((r) => String(r?.Cont_No ?? r?.cont_no ?? '').trim().toUpperCase())
      .filter(Boolean)
  }, [searchData, containerNo])

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
      // Keep Block/Row/Column/Height as-is so the user can quickly map the
      // next container to the same or nearby spot — only clear the container no.
      setContainerNo('')
      fetchLog({})
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

        {/* Form Card — sized to its content; Recent Updates below takes the rest */}
        <div className="shrink-0 flex flex-col mx-3 mb-3 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-4 py-2 shrink-0">
            <h2 className="text-white font-bold text-xs tracking-wide uppercase">Mapping</h2>
          </div>

          <div className="flex flex-col px-4 py-3 gap-2.5">

            <div className="space-y-2.5">
              {/* Container No */}
              <div className="relative">
                <FieldLabel icon={FiPackage}>Container No</FieldLabel>
                <input
                  type="text"
                  value={containerNo}
                  onChange={(e) => {
                    setContainerNo(e.target.value.toUpperCase())
                    setShowSuggestions(true)
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="e.g. MSDU8022011"
                  autoComplete="off"
                  className="w-full px-3 py-2 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] text-sm font-semibold text-slate-800 uppercase tracking-wide transition-colors shadow-sm"
                />

                {showSuggestions && containerNo.trim() && (isSearching || containerSuggestions.length > 0) && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border-2 border-[#0e4a78]/20 rounded-lg shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                    {isSearching ? (
                      <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-500">
                        <FiRefreshCw className="animate-spin text-xs" /> Searching…
                      </div>
                    ) : (
                      containerSuggestions.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setContainerNo(c)
                            setShowSuggestions(false)
                          }}
                          className="w-full text-left px-3 py-2 text-sm font-mono font-semibold text-slate-700 hover:bg-[#0e4a78]/5 border-b border-slate-100 last:border-b-0 transition-colors"
                        >
                          {c}
                        </button>
                      ))
                    )}
                  </div>
                )}
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
                <FieldLabel icon={FiGrid}>Column</FieldLabel>
                <input
                  type="number"
                  value={columnNo}
                  onChange={(e) => setColumnNo(e.target.value)}
                  disabled={!blockName}
                  placeholder={blockName ? 'Enter column' : 'Select a block first'}
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

        {/* Recent Updates — same data as reports/physical-inventory-log (GET_PHYSICAL_INVENTORY_LOG) */}
        <div className="flex-1 min-h-0 flex flex-col mx-3 mb-3 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-4 py-2 shrink-0 flex items-center justify-between">
            <h2 className="text-white font-bold text-xs tracking-wide uppercase">Recent Updates</h2>
            {isLogLoading && <FiRefreshCw className="animate-spin text-white text-xs" />}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100">
            {recentUpdates.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">
                {isLogLoading ? 'Loading…' : 'No updates yet today'}
              </div>
            ) : (
              recentUpdates.map((r, i) => (
                <div key={i} className="px-4 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-bold text-slate-800 truncate">
                      {r.ContainerNo || '—'}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {r.Location || '—'}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                    {fmtLogDate(r.UpdatedDate)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default InventoryMapping
