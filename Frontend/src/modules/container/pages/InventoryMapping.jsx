import React, { useMemo, useState } from 'react'
import { FiMapPin, FiPackage, FiGrid, FiLayers, FiCheckCircle, FiRefreshCw } from 'react-icons/fi'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
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
  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-[0.12em] mb-2">
    <Icon className="text-[#0e4a78]" />
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
      className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <div className="w-full max-w-3xl mx-auto space-y-6">

            {/* Page Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0e4a78] flex items-center justify-center shadow">
                <FiMapPin className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#0e4a78]">Inventory Mapping</h1>
                <p className="text-slate-500 text-sm">Assign or re-shift a container's yard location</p>
              </div>
            </div>

            {/* Form Card */}
            <section className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4">
                <h2 className="text-white font-bold text-base tracking-wide uppercase">Mapping</h2>
              </div>

              <div className="p-6 sm:p-8 space-y-6">

                {/* Container No */}
                <div>
                  <FieldLabel icon={FiPackage}>Container No</FieldLabel>
                  <input
                    type="text"
                    value={containerNo}
                    onChange={(e) => setContainerNo(e.target.value.toUpperCase())}
                    placeholder="e.g. MSDU8022011"
                    className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] text-sm font-semibold text-slate-800 uppercase tracking-wide transition-colors shadow-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Block / Yard */}
                  <div>
                    <FieldLabel icon={FiGrid}>Block / Yard</FieldLabel>
                    <select
                      value={blockName}
                      onChange={(e) => handleBlockChange(e.target.value)}
                      disabled={isBlockListLoading}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] text-sm font-medium text-slate-800 transition-colors shadow-sm disabled:bg-slate-100"
                    >
                      <option value="">{isBlockListLoading ? 'Loading blocks…' : '— Select Block —'}</option>
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
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] text-sm font-medium text-slate-800 transition-colors shadow-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                    >
                      <option value="">{blockName ? '— Select Row —' : 'Select a block first'}</option>
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
                        (range {selectedBlock.minColumn}–{selectedBlock.maxColumn})
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
                    className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] text-sm font-medium text-slate-800 transition-colors shadow-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Height */}
                <div>
                  <FieldLabel icon={FiLayers}>Height</FieldLabel>
                  <div className="grid grid-cols-4 gap-3">
                    {HEIGHTS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setHeight(h)}
                        className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-bold text-sm transition-all ${
                          height === h
                            ? 'border-[#0e4a78] bg-[#0e4a78] text-white shadow-md'
                            : 'border-slate-300 bg-white text-slate-600 hover:border-[#0e4a78]/50 hover:bg-slate-50'
                        }`}
                      >
                        {height === h && <FiCheckCircle className="text-xs" />}
                        H{h}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Save Bar */}
              <div className="px-6 sm:px-8 py-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-semibold hover:bg-white transition-colors shadow-sm"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white font-bold hover:from-[#0a3b61] hover:to-[#083153] transition-all shadow-md hover:shadow-lg disabled:opacity-60"
                >
                  {isSubmitting ? <FiRefreshCw className="animate-spin" /> : <FiCheckCircle />}
                  {isSubmitting ? 'Saving…' : 'Save Mapping'}
                </button>
              </div>
            </section>

          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default InventoryMapping
