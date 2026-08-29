import React, { useState, useMemo } from 'react'
import { FiSearch, FiChevronUp, FiChevronDown, FiCalendar, FiRefreshCw } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { notify } from '../../../utils/notify'
import { useLazyGetRailMovementTatQuery } from '../../../store/api/ymsApi'

const todayStr = () => new Date().toISOString().split('T')[0]

const COLUMNS = [
  { key: 'DocumentNo',    label: 'DOCUMENT NO' },
  { key: 'RailInDate',    label: 'RAILINDATE' },
  { key: 'ContainerCount',label: 'TOTAL' },
  { key: 'ImportCount',   label: 'IMPORT' },
  { key: 'ExportCount',   label: 'EXPORT' },
  { key: 'EmptyCount',    label: 'EMPTY' },
  { key: 'DomesticCount', label: 'DOMESTIC' },
  { key: 'OnRackCount',   label: 'ON RACK' },
  { key: 'ShiftedCount',  label: 'SHIFTED' },
  { key: 'FirstOffload',  label: 'FIRST OFFLOAD' },
  { key: 'LastOffload',   label: 'LAST OFFLOAD' },
  { key: 'ShiftingTAT',   label: 'TAT' },
]

const fmtDate = (v) => {
  if (!v) return '—'
  const d = new Date(String(v).replace(' ', 'T'))
  if (isNaN(d.getTime())) return String(v)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const RailMovementTAT = () => {
  const [fromDate, setFromDate] = useState(todayStr())
  const [toDate, setToDate]     = useState(todayStr())
  const [globalSearch, setGlobalSearch] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null })
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [fetchTat, { data, isFetching, error: apiError }] = useLazyGetRailMovementTatQuery()
  const [hasQueried, setHasQueried] = useState(false)

  const rows = Array.isArray(data?.data) ? data.data : []

  const handleSubmit = () => {
    setCurrentPage(1)
    setHasQueried(true)
    fetchTat({ from_date: fromDate, to_date: toDate })
    notify.info('Fetching', `Fetching data from ${fromDate} to ${toDate}`)
  }

  const handleCancel = () => {
    setFromDate(todayStr())
    setToDate(todayStr())
    setGlobalSearch('')
    setSortConfig({ key: null, direction: null })
    setCurrentPage(1)
  }

  // Filtering Logic
  const filteredData = useMemo(() => {
    let d = [...rows]

    if (globalSearch) {
      const lowerSearch = globalSearch.toLowerCase()
      d = d.filter((item) =>
        Object.values(item).some((val) => String(val ?? '').toLowerCase().includes(lowerSearch))
      )
    }

    if (sortConfig.key) {
      d.sort((a, b) => {
        const av = a[sortConfig.key], bv = b[sortConfig.key]
        if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1
        if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return d
  }, [rows, globalSearch, sortConfig])

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / pageSize)
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const handleExport = () => {
    const exportRows = filteredData.map((r) => {
      const out = {}
      COLUMNS.forEach(({ key, label }) => { out[label] = r[key] ?? '' })
      return out
    })
    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rail Movement TAT")
    XLSX.writeFile(workbook, "rail-movement-tat.xlsx")
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
          <div className="w-full space-y-8">

            {/* Filter Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-3">
                <h2 className="text-lg font-semibold tracking-wide uppercase">RAIL MOVEMENT DETAIL</h2>
              </header>
              <div className="p-6">
                <div className="flex flex-col md:flex-row items-end gap-6">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700 uppercase">FROM</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full md:w-64 px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700 uppercase">TO</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full md:w-64 px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleCancel}
                      className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={isFetching}
                      className="px-8 py-2.5 rounded-lg bg-[#0e4a78] text-white font-bold hover:bg-[#0b3e66] transition uppercase tracking-wide shadow-md disabled:opacity-60"
                      onClick={handleSubmit}
                    >
                      {isFetching ? 'Loading…' : 'Submit'}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Results Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col">
              <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-3">
                <h2 className="text-lg font-semibold tracking-wide uppercase">RAIL MOVEMENT DETAIL WITH TAT</h2>
              </header>

              {/* Toolbar */}
              <div className="px-6 py-3 border-b border-slate-200 flex justify-between items-center gap-4">
                <button
                  onClick={handleExport}
                  disabled={filteredData.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 transition text-white font-semibold shadow-md text-sm disabled:opacity-50"
                >
                  <FaFileExcel /> Export
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-medium">Search:</span>
                  <input
                    type="text"
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    className="px-3 py-1 border border-slate-300 rounded w-48 focus:outline-none focus:border-[#0e4a78]"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto w-full">
                <table className="min-w-full text-xs md:text-sm text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                      {COLUMNS.map(col => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className="px-4 sm:px-5 py-3 text-left font-semibold border-r border-white/30 last:border-r-0 cursor-pointer hover:bg-white/10 whitespace-nowrap"
                        >
                          <div className="flex items-center gap-1">
                            {col.label}
                            <div className="flex flex-col opacity-50">
                              <FiChevronUp className="w-2.5 h-2.5 -mb-0.5" />
                              <FiChevronDown className="w-2.5 h-2.5 -mt-0.5" />
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {isFetching ? (
                      <tr>
                        <td colSpan={COLUMNS.length} className="px-6 py-12 text-center text-slate-400">
                          <FiRefreshCw className="inline animate-spin mr-2" /> Loading rail movement data…
                        </td>
                      </tr>
                    ) : apiError ? (
                      <tr>
                        <td colSpan={COLUMNS.length} className="px-6 py-12 text-center text-red-500 font-semibold">
                          {apiError?.data?.detail || apiError?.data?.message || apiError?.error || 'Failed to fetch data.'}
                        </td>
                      </tr>
                    ) : !hasQueried ? (
                      <tr>
                        <td colSpan={COLUMNS.length} className="px-6 py-12 text-center text-slate-400 italic">
                          Select a date range and click <strong className="text-slate-600 not-italic">Submit</strong> to load data.
                        </td>
                      </tr>
                    ) : paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan={COLUMNS.length} className="px-6 py-12 text-center text-slate-400 italic">
                          No records found for the selected range.
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                          {COLUMNS.map((col) => {
                            const raw = row[col.key]
                            const isDate = col.key === 'FirstOffload' || col.key === 'LastOffload'
                            const display = isDate ? fmtDate(raw) : (raw != null && raw !== '' ? raw : '—')
                            return (
                              <td key={col.key} className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 last:border-r-0 whitespace-nowrap">
                                {display}
                              </td>
                            )
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600">
                <div>
                  Showing {filteredData.length === 0 ? 0 : Math.min((currentPage - 1) * pageSize + 1, filteredData.length)} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} entries
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${
                      currentPage === 1
                        ? 'text-slate-400 cursor-not-allowed bg-slate-100'
                        : 'text-[#0e4a78] hover:bg-blue-50'
                    }`}
                  >
                    Previous
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">Page</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages || 1}
                      value={currentPage}
                      onChange={(e) => {
                        const p = Math.max(1, Math.min(totalPages || 1, Number(e.target.value) || 1))
                        setCurrentPage(p)
                      }}
                      className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-[#0e4a78]"
                    />
                    <span className="text-slate-600">of {totalPages || 1}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${
                      currentPage === totalPages || totalPages === 0
                        ? 'text-slate-400 cursor-not-allowed bg-slate-100'
                        : 'text-[#0e4a78] hover:bg-blue-50'
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>

          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default RailMovementTAT
