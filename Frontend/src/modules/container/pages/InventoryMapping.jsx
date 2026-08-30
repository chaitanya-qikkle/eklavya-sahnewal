import React, { useEffect, useMemo, useState } from 'react'
import { FiMapPin, FiPackage, FiGrid, FiLayers, FiCheckCircle, FiRefreshCw } from 'react-icons/fi'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { notify } from '../../../utils/notify'
import {
  useLazyGetInventoryEntryDropdownQuery,
  useSubmitInventoryEntryMutation,
} from '../../../store/api/ymsApi'

const HEIGHTS = [1, 2, 3, 4]

const FieldLabel = ({ icon: Icon, children }) => (
  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-[0.12em] mb-2">
    <Icon className="text-[#0e4a78]" />
    {children}
  </label>
)

const InventoryMapping = () => {
  const [fetchDropdown, { data: dropdownData, isFetching: isDropdownLoading }] = useLazyGetInventoryEntryDropdownQuery()
  const [submitEntry, { isLoading: isSubmitting }] = useSubmitInventoryEntryMutation()

  const [containerNo, setContainerNo] = useState('')
  const [blockName, setBlockName] = useState('')
  const [rowNo, setRowNo] = useState('')
  const [columnName, setColumnName] = useState('')
  const [height, setHeight] = useState(1)

  const blocks = useMemo(() => {
    const rows = dropdownData?.data?.blocks || []
    return rows
      .map((r) => String(r?.BlockName ?? r?.blockName ?? '').trim())
      .filter(Boolean)
  }, [dropdownData])

  const rows = useMemo(() => {
    const list = dropdownData?.data?.rows || []
    return list
      .map((r) => String(r?.RowNo ?? r?.rowNo ?? '').trim())
      .filter(Boolean)
  }, [dropdownData])

  const columns = useMemo(() => {
    const list = dropdownData?.data?.columns || []
    return list
      .map((r) => String(r?.ColumnName ?? r?.columnName ?? '').trim())
      .filter(Boolean)
  }, [dropdownData])

  useEffect(() => { fetchDropdown() }, []) // eslint-disable-line

  const handleBlockChange = (value) => {
    setBlockName(value)
    setRowNo('')
    setColumnName('')
    if (value) fetchDropdown(value)
  }

  const resetForm = () => {
    setContainerNo('')
    setBlockName('')
    setRowNo('')
    setColumnName('')
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
    if (!columnName.trim()) {
      notify.warning('Validation', 'Column is required')
      return
    }

    try {
      const result = await submitEntry({
        container_no: containerNo.trim().toUpperCase(),
        block_name: blockName,
        row_no: rowNo,
        column_name: columnName.trim(),
        height,
      }).unwrap()

      if (result?.status !== 'success') {
        throw new Error(result?.message || 'Failed to save mapping')
      }

      notify.success('Saved', result?.message || 'Container location mapped successfully')
      resetForm()
    } catch (err) {
      notify.error('Save failed', err?.data?.message || err?.message || 'Something went wrong')
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
                      disabled={isDropdownLoading && !blocks.length}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] text-sm font-medium text-slate-800 transition-colors shadow-sm disabled:bg-slate-100"
                    >
                      <option value="">— Select Block —</option>
                      {blocks.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  {/* Row */}
                  <div>
                    <FieldLabel icon={FiLayers}>Row</FieldLabel>
                    <select
                      value={rowNo}
                      onChange={(e) => setRowNo(e.target.value)}
                      disabled={!blockName || isDropdownLoading}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] text-sm font-medium text-slate-800 transition-colors shadow-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                    >
                      <option value="">{blockName ? '— Select Row —' : 'Select a block first'}</option>
                      {rows.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Column */}
                <div>
                  <FieldLabel icon={FiGrid}>Column</FieldLabel>
                  {columns.length > 0 ? (
                    <select
                      value={columnName}
                      onChange={(e) => setColumnName(e.target.value)}
                      disabled={!blockName || isDropdownLoading}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] text-sm font-medium text-slate-800 transition-colors shadow-sm disabled:bg-slate-100"
                    >
                      <option value="">— Select Column —</option>
                      {columns.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={columnName}
                      onChange={(e) => setColumnName(e.target.value)}
                      placeholder="Enter column"
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] text-sm font-medium text-slate-800 transition-colors shadow-sm"
                    />
                  )}
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
