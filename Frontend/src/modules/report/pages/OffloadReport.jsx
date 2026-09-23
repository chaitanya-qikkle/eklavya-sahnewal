import React, { useState, useMemo, useEffect } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FiCalendar, FiRefreshCw, FiSearch, FiX, FiPackage, FiUpload, FiDownload, FiHome } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import { useLazyGetOffloadReportQuery } from '../../../store/api/ymsApi'

const TONE_MAP = {
  slate:   { accent: "#0e4a78", iconColor: "text-[#0e4a78]",   iconBg: "bg-white", cardBg: "bg-[#0e4a78]/[0.06]", border: "border-[#0e4a78]/15", valueColor: "text-[#0e4a78]",   badgeBg: "bg-white", activeBg: "bg-[#0e4a78]"   },
  emerald: { accent: "#059669", iconColor: "text-emerald-600", iconBg: "bg-white", cardBg: "bg-emerald-50",       border: "border-emerald-200",  valueColor: "text-emerald-700", badgeBg: "bg-white", activeBg: "bg-emerald-600" },
  amber:   { accent: "#d97706", iconColor: "text-amber-600",   iconBg: "bg-white", cardBg: "bg-amber-50",         border: "border-amber-200",    valueColor: "text-amber-700",   badgeBg: "bg-white", activeBg: "bg-amber-500"   },
  violet:  { accent: "#7c3aed", iconColor: "text-violet-600",  iconBg: "bg-white", cardBg: "bg-violet-50",        border: "border-violet-200",   valueColor: "text-violet-700",  badgeBg: "bg-white", activeBg: "bg-violet-600"  },
  rose:    { accent: "#e11d48", iconColor: "text-rose-600",    iconBg: "bg-white", cardBg: "bg-rose-50",          border: "border-rose-200",     valueColor: "text-rose-700",    badgeBg: "bg-white", activeBg: "bg-rose-600"    },
}

const StatTile = ({ label, value, icon: Icon, tone = "slate", isActive, onClick, total }) => {
  const t = TONE_MAP[tone] || TONE_MAP.slate
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative text-left overflow-hidden rounded-xl border transition-all duration-150 ${t.cardBg} ${
        isActive ? `${t.border} shadow-sm ring-1 ring-inset ring-current` : "border-transparent hover:border-current/20 hover:shadow-sm"
      }`}
      style={isActive ? { color: t.accent } : undefined}
    >
      <div className="pl-4 pr-4 py-3.5 flex items-center gap-3.5">
        <span className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg shadow-sm transition-all duration-150 ${isActive ? `${t.activeBg} text-white` : `${t.iconBg} ${t.iconColor}`}`}>
          {Icon && <Icon className="text-[15px]" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500 leading-tight mb-1.5">{label}</p>
          <p className={`text-2xl font-black leading-none tracking-tight transition-colors ${isActive ? t.valueColor : "text-slate-700"}`}>{value.toLocaleString()}</p>
        </div>
        {total > 0 && tone !== "slate" && (
          <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${t.badgeBg}`} style={{ color: t.accent }}>{pct}%</span>
        )}
      </div>
      <div className="h-[2px] bg-slate-100">
        {total > 0 && tone !== "slate" && (
          <div className="h-full transition-all duration-700 rounded-full" style={{ width: `${pct}%`, background: t.accent }} />
        )}
      </div>
    </button>
  )
}

// "YYYY-MM-DDTHH:mm" in local time, for datetime-local input defaults.
const toLocalInputValue = (d) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const todayLocalDT = () => toLocalInputValue(new Date())
const yesterdayLocalDT = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toLocalInputValue(d)
}

const fmtDate = (val) => {
  if (!val) return '—'
  const d = new Date(String(val).replace(' ', 'T'))
  if (isNaN(d)) return String(val)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const COLUMNS = [
  { key: 'ContNo',       label: 'Container' },
  { key: 'ContSize',     label: 'Size' },
  { key: 'ContTypeName', label: 'Type' },
  { key: 'ActivityName', label: 'Activity' },
  { key: 'ProcessName',  label: 'Process' },
  { key: 'GateName',     label: 'Gate' },
  { key: 'GateInDate',   label: 'Gate In Date', format: fmtDate },
  { key: 'OffloadDate',  label: 'Offload Date', format: fmtDate },
  { key: 'OffloadTAT',   label: 'Offload TAT' },
]

const OffloadReport = () => {
  const [fetchReport, { data, isFetching, isError }] = useLazyGetOffloadReportQuery()

  const [containerSearch, setContainerSearch] = useState('')
  const [fromDate, setFromDate] = useState(yesterdayLocalDT())
  const [toDate,   setToDate]   = useState(todayLocalDT())
  const [tableSearch, setTableSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [hasQueried, setHasQueried]   = useState(false)
  const [processFilter, setProcessFilter] = useState('all')
  const itemsPerPage = 10

  useEffect(() => {
    setHasQueried(true)
    fetchReport({ from_date: yesterdayLocalDT(), to_date: todayLocalDT() })
  }, []) // eslint-disable-line

  const rows = Array.isArray(data?.data) ? data.data : []

  const handleSearch = () => {
    setCurrentPage(1)
    setHasQueried(true)
    fetchReport({
      container_no: containerSearch.trim() || undefined,
      from_date: fromDate,
      to_date: toDate,
    })
  }

  const handleClear = () => {
    setContainerSearch('')
    setFromDate(yesterdayLocalDT())
    setToDate(todayLocalDT())
    setTableSearch('')
    setProcessFilter('all')
    setCurrentPage(1)
    fetchReport({ from_date: yesterdayLocalDT(), to_date: todayLocalDT() })
  }

  const processStats = useMemo(() => {
    const total = rows.length
    const exportCount = rows.filter(r => String(r.ProcessName || '').toUpperCase() === 'EXPORT').length
    const importCount = rows.filter(r => String(r.ProcessName || '').toUpperCase() === 'IMPORT').length
    const emptyCount = rows.filter(r => String(r.ProcessName || '').toUpperCase() === 'EMPTY').length
    const domesticCount = rows.filter(r => String(r.ProcessName || '').toUpperCase() === 'DOMESTIC').length
    return { total, exportCount, importCount, emptyCount, domesticCount }
  }, [rows])

  const filteredData = useMemo(() => {
    let result = rows
    if (processFilter !== 'all') result = result.filter(r => String(r.ProcessName || '').toUpperCase() === processFilter)
    if (tableSearch.trim()) {
      const q = tableSearch.trim().toLowerCase()
      result = result.filter((r) =>
        COLUMNS.some(({ key }) => String(r[key] ?? '').toLowerCase().includes(q))
      )
    }
    return result
  }, [rows, tableSearch, processFilter])

  const handleExport = () => {
    if (!filteredData.length) return
    const exportRows = filteredData.map((r) => {
      const out = {}
      COLUMNS.forEach(({ key, label, format }) => {
        out[label] = format ? format(r[key]) : (r[key] ?? '')
      })
      return out
    })
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'OffloadReport')
    XLSX.writeFile(wb, `OffloadReport_${todayLocalDT().slice(0, 10)}.xlsx`)
  }

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

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
                <FiPackage className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#0e4a78]">Offload Report</h1>
                <p className="text-slate-500 text-sm">In-yard containers pending or completed offload, with TAT</p>
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
                  <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">Container No</label>
                    <input
                      type="text"
                      value={containerSearch}
                      onChange={(e) => setContainerSearch(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Search container…"
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">From Date</label>
                    <div className="relative">
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                      <input
                        type="datetime-local"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full sm:w-52 pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">To Date</label>
                    <div className="relative">
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                      <input
                        type="datetime-local"
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

            {/* Process filter pills */}
            <div className="grid grid-cols-5 gap-2 w-full lg:w-[840px]">
              <StatTile
                label="Total Entries"
                value={processStats.total}
                icon={FiPackage}
                tone="slate"
                isActive={processFilter === 'all'}
                onClick={() => { setProcessFilter('all'); setCurrentPage(1) }}
                total={processStats.total}
              />
              <StatTile
                label="Export"
                value={processStats.exportCount}
                icon={FiUpload}
                tone="amber"
                isActive={processFilter === 'EXPORT'}
                onClick={() => { setProcessFilter('EXPORT'); setCurrentPage(1) }}
                total={processStats.total}
              />
              <StatTile
                label="Import"
                value={processStats.importCount}
                icon={FiDownload}
                tone="emerald"
                isActive={processFilter === 'IMPORT'}
                onClick={() => { setProcessFilter('IMPORT'); setCurrentPage(1) }}
                total={processStats.total}
              />
              <StatTile
                label="Empty"
                value={processStats.emptyCount}
                icon={FiPackage}
                tone="violet"
                isActive={processFilter === 'EMPTY'}
                onClick={() => { setProcessFilter('EMPTY'); setCurrentPage(1) }}
                total={processStats.total}
              />
              <StatTile
                label="Domestic"
                value={processStats.domesticCount}
                icon={FiHome}
                tone="rose"
                isActive={processFilter === 'DOMESTIC'}
                onClick={() => { setProcessFilter('DOMESTIC'); setCurrentPage(1) }}
                total={processStats.total}
              />
            </div>

            {/* Results Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-white font-bold text-lg tracking-wide uppercase">Offloading Summary</h2>
                  <p className="text-white/60 text-xs mt-0.5">{filteredData.length.toLocaleString()} records</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Search…"
                      className="pl-8 pr-3 py-2 rounded-lg border border-white/30 bg-white/10 text-white placeholder-white/50 text-sm focus:outline-none focus:ring-1 focus:ring-white/50 w-44 transition-colors"
                    />
                    <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60 text-sm pointer-events-none" />
                    {tableSearch && (
                      <button
                        onClick={() => setTableSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                      >
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
                    <p className="text-sm font-medium">Loading offload data…</p>
                  </div>
                ) : !hasQueried ? (
                  <div className="px-8 py-14 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                      <FiPackage className="text-slate-400 text-xl" />
                    </div>
                    <p className="text-slate-400 text-sm font-medium">
                      Select filters and click <strong className="text-slate-600">Search</strong> to load data.
                    </p>
                  </div>
                ) : paginatedData.length === 0 ? (
                  <div className="px-8 py-12 text-center text-slate-400 text-sm">
                    No records found for the selected criteria.
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
                      {paginatedData.map((row, index) => (
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
                                className={`px-4 py-3 whitespace-nowrap ${col.key === 'ContNo' ? 'text-slate-800 font-semibold' : 'text-slate-600'}`}
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

              {filteredData.length > 0 && !isFetching && (
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
                  <span>
                    Showing <strong className="text-slate-700">{paginatedData.length}</strong> of{' '}
                    <strong className="text-slate-700">{filteredData.length}</strong> records
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className={`px-3 py-1.5 rounded-lg border border-slate-300 font-semibold transition ${
                        currentPage === 1 ? 'text-slate-400 cursor-not-allowed bg-slate-100' : 'text-[#0e4a78] hover:bg-blue-50'
                      }`}
                    >
                      Previous
                    </button>
                    <span className="text-slate-600">Page {currentPage} of {totalPages || 1}</span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages || 1, p + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className={`px-3 py-1.5 rounded-lg border border-slate-300 font-semibold transition ${
                        currentPage === totalPages || totalPages === 0 ? 'text-slate-400 cursor-not-allowed bg-slate-100' : 'text-[#0e4a78] hover:bg-blue-50'
                      }`}
                    >
                      Next
                    </button>
                  </div>
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

export default OffloadReport
