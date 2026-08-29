import React, { useState, useMemo } from 'react'
import { FiSearch, FiRefreshCw, FiCalendar, FiX, FiTool } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { useLazyGetBreakdownsFilteredQuery } from '../../../store/api/ymsApi'

const today     = new Date().toISOString().split('T')[0]
const yesterday = new Date(Date.now() - 864e5).toISOString().split('T')[0]

const fmtDate = (val) => {
  if (!val) return '—'
  const d = new Date(String(val).replace(' ', 'T'))
  if (isNaN(d)) return String(val)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const COLUMNS = [
  { key: 'EqpName',        label: 'Machine' },
  { key: 'MaintanceStart', label: 'Maintenance Start', format: fmtDate },
  { key: 'MaintanceEnd',   label: 'Maintenance End',   format: fmtDate },
  { key: 'TAT',            label: 'TAT' },
  { key: 'Reason',         label: 'Remark Type' },
  { key: 'RemarkBy',       label: 'Remark By' },
]

const BreakdownReport = () => {
  const [fromDate, setFromDate] = useState(yesterday)
  const [toDate,   setToDate]   = useState(today)
  const [search,   setSearch]   = useState('')
  const [hasQueried, setHasQueried] = useState(false)

  const [fetchBreakdowns, { data, isFetching, isError }] = useLazyGetBreakdownsFilteredQuery()

  const rows = Array.isArray(data?.data) ? data.data : []

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter((r) =>
      COLUMNS.some(({ key }) => String(r[key] ?? '').toLowerCase().includes(q))
    )
  }, [rows, search])

  const handleSearch = () => {
    setHasQueried(true)
    fetchBreakdowns({ from_date: fromDate, to_date: toDate })
  }

  const handleClear = () => {
    setFromDate(yesterday)
    setToDate(today)
    setSearch('')
    setHasQueried(true)
    fetchBreakdowns({ from_date: yesterday, to_date: today })
  }

  const handleExport = () => {
    if (!filteredRows.length) return
    const exportRows = filteredRows.map((r) => {
      const out = {}
      COLUMNS.forEach(({ key, label, format }) => {
        out[label] = format ? format(r[key]) : (r[key] ?? '')
      })
      return out
    })
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'BreakdownReport')
    XLSX.writeFile(wb, `BreakdownReport_${today}.xlsx`)
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
          <div className="w-full space-y-6">

            {/* Page Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0e4a78] flex items-center justify-center shadow">
                <FiTool className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#0e4a78]">Equipment Breakdown Report</h1>
                <p className="text-slate-500 text-sm">Machine downtime, maintenance windows, and TAT</p>
              </div>
            </div>

            {/* Filter Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex items-center gap-2">
                <FiSearch className="text-white text-base" />
                <h2 className="text-white font-bold text-base tracking-wide">Search Criteria</h2>
              </div>

              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">From Date</label>
                    <div className="relative">
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full sm:w-56 pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">To Date</label>
                    <div className="relative">
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full sm:w-56 pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleClear}
                      className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      Clear
                    </button>
                    <button
                      onClick={handleSearch}
                      disabled={isFetching}
                      className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-[#0e4a78] text-white text-sm font-bold hover:bg-[#0a3b61] transition-colors shadow-md disabled:opacity-60 uppercase tracking-wide"
                    >
                      {isFetching
                        ? <FiRefreshCw className="animate-spin text-base" />
                        : <FiSearch className="text-base" />
                      }
                      {isFetching ? 'Loading…' : 'Search'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-white font-bold text-lg tracking-wide uppercase">Breakdown Records</h2>
                  <p className="text-white/60 text-xs mt-0.5">{filteredRows.length.toLocaleString()} records</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search…"
                      className="pl-8 pr-3 py-2 rounded-lg border border-white/30 bg-white/10 text-white placeholder-white/50 text-sm focus:outline-none focus:ring-1 focus:ring-white/50 w-44 transition-colors"
                    />
                    <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60 text-sm pointer-events-none" />
                    {search && (
                      <button
                        onClick={() => setSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                      >
                        <FiX className="text-xs" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleExport}
                    disabled={!filteredRows.length}
                    title="Export to Excel"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 shadow"
                  >
                    <FaFileExcel />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                {isError ? (
                  <div className="px-8 py-12 text-center">
                    <div className="text-red-500 font-semibold text-sm">Failed to load breakdown records.</div>
                  </div>
                ) : isFetching ? (
                  <div className="px-8 py-12 flex flex-col items-center gap-3 text-slate-400">
                    <div className="w-10 h-10 border-2 border-slate-200 border-t-[#0e4a78] rounded-full animate-spin" />
                    <p className="text-sm font-medium">Loading breakdown data…</p>
                  </div>
                ) : !hasQueried ? (
                  <div className="px-8 py-14 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                      <FiTool className="text-slate-400 text-xl" />
                    </div>
                    <p className="text-slate-400 text-sm font-medium">
                      Select a date range and click <strong className="text-slate-600">Search</strong> to load data.
                    </p>
                  </div>
                ) : filteredRows.length === 0 ? (
                  <div className="px-8 py-12 text-center text-slate-400 text-sm">
                    No breakdown records found for the selected range.
                  </div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {COLUMNS.map((col) => (
                          <th
                            key={col.key}
                            className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRows.map((row, index) => (
                        <tr
                          key={index}
                          className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/50`}
                        >
                          {COLUMNS.map((col) => {
                            const raw = row[col.key]
                            const display = col.format ? col.format(raw) : (raw != null && raw !== '' ? raw : <span className="text-slate-300">—</span>)
                            return (
                              <td
                                key={col.key}
                                className={`px-4 py-3 whitespace-nowrap ${col.key === 'EqpName' ? 'text-slate-800 font-semibold' : 'text-slate-600'}`}
                              >
                                {display}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {filteredRows.length > 0 && !isFetching && (
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
                  <span>Showing <strong className="text-slate-700">{filteredRows.length}</strong> records</span>
                </div>
              )}
            </div>

          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default BreakdownReport
