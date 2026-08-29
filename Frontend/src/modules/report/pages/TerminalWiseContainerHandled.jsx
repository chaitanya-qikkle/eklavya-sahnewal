import React, { useState, useMemo, useEffect } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FaFileExcel } from 'react-icons/fa'
import { FiCalendar, FiRefreshCw, FiSearch, FiX, FiBarChart2, FiChevronUp, FiChevronDown, FiDownload } from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { useLazyGetMonthWiseInventoryQuery } from '../../../store/api/ymsApi'

const today = new Date().toISOString().split('T')[0]
const fromDefault = new Date(Date.now() - 90 * 864e5).toISOString().split('T')[0]

const LOCATIONS = [
  { key: 'GHH',    label: 'GHH' },
  { key: 'PIYALA', label: 'PIYALA' },
  { key: 'SNL',    label: 'SNL' },
  { key: 'KSP',    label: 'KSP' },
]

const SUB_COLS = [
  { suffix: '20',    label: '20' },
  { suffix: '40',    label: '40' },
  { suffix: 'Total', label: "Units" },
  { suffix: 'Tues',  label: "Teu's" },
  { suffix: 'Moves', label: 'Moves' },
]

const TYPES = [
  { value: '', label: '--SELECT--' },
  { value: 'DAY',   label: 'DAY' },
  { value: 'MONTH', label: 'MONTH' },
  { value: 'YEAR',  label: 'YEAR' },
]

const TerminalWiseContainerHandled = () => {
  const [fetchData, { data, isFetching, isError }] = useLazyGetMonthWiseInventoryQuery()
  const [reportType, setReportType] = useState('MONTH')
  const [fromDate, setFromDate] = useState(fromDefault)
  const [toDate, setToDate] = useState(today)
  const [search, setSearch] = useState('')
  const [hasQueried, setHasQueried] = useState(false)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  useEffect(() => {
    setHasQueried(true)
    fetchData({ report_type: 'MONTH', from_date: fromDefault, to_date: today })
  }, []) // eslint-disable-line

  const rows = Array.isArray(data?.data) ? data.data : []

  const handleSearch = () => {
    if (!reportType) return
    setHasQueried(true)
    fetchData({ report_type: reportType, from_date: fromDate, to_date: toDate })
  }

  const handleClear = () => {
    setReportType('MONTH')
    setFromDate(fromDefault)
    setToDate(today)
    setSearch('')
    setSortConfig({ key: null, direction: 'asc' })
    setHasQueried(true)
    fetchData({ report_type: 'MONTH', from_date: fromDefault, to_date: today })
  }

  const filteredData = useMemo(() => {
    let out = rows
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      out = out.filter((r) => String(r.ReportDate ?? '').toLowerCase().includes(q))
    }
    if (sortConfig.key) {
      out = [...out].sort((a, b) => {
        const av = a[sortConfig.key], bv = b[sortConfig.key]
        if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1
        if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return out
  }, [rows, search, sortConfig])

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const handleExport = () => {
    if (!filteredData.length) return
    const exportRows = filteredData.map((r) => {
      const out = { [reportType === 'DAY' ? 'Date' : reportType === 'YEAR' ? 'Year' : 'Month']: r.ReportDate }
      LOCATIONS.forEach(({ key, label }) => {
        SUB_COLS.forEach(({ suffix, label: subLabel }) => {
          out[`${label} ${subLabel}`] = r[`${key}${suffix}`] ?? 0
        })
      })
      return out
    })
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'TerminalWiseContainerHandled')
    XLSX.writeFile(wb, `TerminalWiseContainerHandled_${today}.xlsx`)
  }

  const handleRowExport = (row) => {
    const out = { [reportType === 'DAY' ? 'Date' : reportType === 'YEAR' ? 'Year' : 'Month']: row.ReportDate }
    LOCATIONS.forEach(({ key, label }) => {
      SUB_COLS.forEach(({ suffix, label: subLabel }) => {
        out[`${label} ${subLabel}`] = row[`${key}${suffix}`] ?? 0
      })
    })
    const ws = XLSX.utils.json_to_sheet([out])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Row')
    XLSX.writeFile(wb, `TerminalWiseContainerHandled_${row.ReportDate}.xlsx`)
  }

  const periodLabel = reportType === 'DAY' ? 'Date' : reportType === 'YEAR' ? 'Year' : 'Month'

  const SortIcon = ({ colKey }) => (
    <span className="inline-flex flex-col ml-1 align-middle">
      <FiChevronUp   className={`w-2.5 h-2.5 -mb-0.5 ${sortConfig.key === colKey && sortConfig.direction === 'asc'  ? 'text-white' : 'text-white/40'}`} />
      <FiChevronDown className={`w-2.5 h-2.5 -mt-0.5 ${sortConfig.key === colKey && sortConfig.direction === 'desc' ? 'text-white' : 'text-white/40'}`} />
    </span>
  )

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
                <FiBarChart2 className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#0e4a78]">Terminal Wise Container Handled</h1>
                <p className="text-slate-500 text-sm">Rail-inbound container distribution by terminal and size</p>
              </div>
            </div>

            {/* Filter Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex items-center gap-2">
                <FiSearch className="text-white text-base" />
                <h2 className="text-white font-bold text-base tracking-wide">Terminal Wise Container Handled</h2>
              </div>

              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">
                      Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                      className="w-full sm:w-40 px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm transition-colors"
                    >
                      {TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">
                      From Date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full sm:w-52 pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">
                      To Date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full sm:w-52 pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleClear}
                      className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSearch}
                      disabled={isFetching || !reportType}
                      className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-[#0e4a78] text-white text-sm font-bold hover:bg-[#0a3b61] transition-colors shadow-md disabled:opacity-60 uppercase tracking-wide"
                    >
                      {isFetching
                        ? <FiRefreshCw className="animate-spin text-base" />
                        : <FiSearch className="text-base" />
                      }
                      {isFetching ? 'Loading…' : 'Submit'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-white font-bold text-lg tracking-wide uppercase">Handled Details</h2>
                  <p className="text-white/60 text-xs mt-0.5">{filteredData.length.toLocaleString()} rows</p>
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
                      <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white">
                        <FiX className="text-xs" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleExport}
                    disabled={!filteredData.length}
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
                    <div className="text-red-500 font-semibold text-sm">Failed to load data. Check backend connection.</div>
                  </div>
                ) : isFetching ? (
                  <div className="px-8 py-12 flex flex-col items-center gap-3 text-slate-400">
                    <div className="w-10 h-10 border-2 border-slate-200 border-t-[#0e4a78] rounded-full animate-spin" />
                    <p className="text-sm font-medium">Loading handled details…</p>
                  </div>
                ) : !hasQueried ? (
                  <div className="px-8 py-14 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                      <FiBarChart2 className="text-slate-400 text-xl" />
                    </div>
                    <p className="text-slate-400 text-sm font-medium">
                      Select filters and click <strong className="text-slate-600">Submit</strong> to load data.
                    </p>
                  </div>
                ) : filteredData.length === 0 ? (
                  <div className="px-8 py-12 text-center text-slate-400 text-sm">
                    No records found for the selected criteria.
                  </div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-[#8faab4] text-white">
                        <th rowSpan={2} className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap align-middle border-r border-white/30 w-10">#</th>
                        <th
                          rowSpan={2}
                          onClick={() => handleSort('ReportDate')}
                          className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap align-middle border-r border-white/30 cursor-pointer hover:bg-white/10 select-none"
                        >
                          {periodLabel} <SortIcon colKey="ReportDate" />
                        </th>
                        {LOCATIONS.map((loc) => (
                          <th key={loc.key} colSpan={SUB_COLS.length} className="px-4 py-2 text-center text-xs font-bold uppercase tracking-wider border-r border-white/30 border-b border-white/30">
                            {loc.label}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-[#8faab4] text-white">
                        {LOCATIONS.map((loc) => (
                          <React.Fragment key={loc.key}>
                            {SUB_COLS.map((sc, idx) => (
                              <th
                                key={sc.suffix}
                                onClick={() => handleSort(`${loc.key}${sc.suffix}`)}
                                className={`px-3 py-2 text-right text-[11px] font-bold uppercase whitespace-nowrap cursor-pointer hover:bg-white/10 select-none ${
                                  idx === SUB_COLS.length - 1 ? 'border-r border-white/30' : ''
                                }`}
                              >
                                {sc.label} <SortIcon colKey={`${loc.key}${sc.suffix}`} />
                              </th>
                            ))}
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredData.map((row, index) => (
                        <tr key={index} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/50`}>
                          <td className="px-3 py-3 text-center border-r border-slate-100">
                            <button
                              onClick={() => handleRowExport(row)}
                              title="Download this row"
                              className="inline-flex items-center justify-center w-7 h-7 rounded bg-[#0e4a78] text-white hover:bg-[#0a3b61] transition-colors"
                            >
                              <FiDownload size={12} />
                            </button>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-800 font-semibold border-r border-slate-100">
                            {row.ReportDate ?? '—'}
                          </td>
                          {LOCATIONS.map((loc) => (
                            <React.Fragment key={loc.key}>
                              {SUB_COLS.map((sc, idx) => (
                                <td
                                  key={sc.suffix}
                                  className={`px-3 py-3 text-right whitespace-nowrap ${
                                    sc.suffix === 'Total' ? 'text-[#0e4a78] font-bold' : 'text-slate-600'
                                  } ${idx === SUB_COLS.length - 1 ? 'border-r border-slate-100' : ''}`}
                                >
                                  {row[`${loc.key}${sc.suffix}`] ?? 0}
                                </td>
                              ))}
                            </React.Fragment>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {filteredData.length > 0 && !isFetching && (
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
                  <span>Showing <strong className="text-slate-700">1</strong> to <strong className="text-slate-700">{filteredData.length}</strong> of <strong className="text-slate-700">{filteredData.length}</strong> entries</span>
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

export default TerminalWiseContainerHandled
