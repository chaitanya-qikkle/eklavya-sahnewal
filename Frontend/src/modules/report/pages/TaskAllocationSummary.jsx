import React, { useState, useMemo } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FiSearch, FiRefreshCw, FiX, FiClipboard, FiCheckCircle, FiClock, FiList } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import { useGetTaskAllocationSummaryQuery } from '../../../store/api/ymsApi'

const COLUMNS = [
  { key: 'YardName',      label: 'Yard Name' },
  { key: 'TotalTask',     label: 'Total Task' },
  { key: 'CompletedTask', label: 'Completed Task' },
  { key: 'PendingTask',   label: 'Pending Task' },
  { key: 'NearEquipment', label: 'Near By Equipment' },
]

const TONE_MAP = {
  slate:   { accent: "#0e4a78", iconColor: "text-[#0e4a78]",   iconBg: "bg-[#0e4a78]/10", valueColor: "text-[#0e4a78]"   },
  emerald: { accent: "#059669", iconColor: "text-emerald-600", iconBg: "bg-emerald-50",    valueColor: "text-emerald-700" },
  amber:   { accent: "#d97706", iconColor: "text-amber-600",   iconBg: "bg-amber-50",      valueColor: "text-amber-700"   },
}

const StatTile = ({ label, value, icon: Icon, tone = "slate", total }) => {
  const t = TONE_MAP[tone] || TONE_MAP.slate
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="relative text-left overflow-hidden border-r border-slate-200 last:border-r-0 bg-white">
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: t.accent }} />
      <div className="pl-4 pr-4 py-3.5 flex items-center gap-3.5">
        <span className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg ${t.iconBg} ${t.iconColor}`}>
          {Icon && <Icon className="text-[15px]" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400 leading-tight mb-1.5">
            {label}
          </p>
          <p className={`text-2xl font-black leading-none tracking-tight ${t.valueColor}`}>
            {value.toLocaleString()}
          </p>
        </div>
        {total > 0 && tone !== "slate" && (
          <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${t.iconBg}`} style={{ color: t.accent }}>
            {pct}%
          </span>
        )}
      </div>
    </div>
  )
}

const TaskAllocationSummary = () => {
  const { data, isFetching, isError, refetch } = useGetTaskAllocationSummaryQuery()
  const [search, setSearch] = useState('')

  const rows = Array.isArray(data?.data) ? data.data : []

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter((r) => COLUMNS.some(({ key }) => String(r[key] ?? '').toLowerCase().includes(q)))
  }, [rows, search])

  const stats = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        total:     acc.total     + (Number(r.TotalTask) || 0),
        completed: acc.completed + (Number(r.CompletedTask) || 0),
        pending:   acc.pending   + (Number(r.PendingTask) || 0),
      }),
      { total: 0, completed: 0, pending: 0 }
    )
  }, [rows])

  const handleExport = () => {
    if (!filteredRows.length) return
    const exportRows = filteredRows.map((r) => {
      const out = {}
      COLUMNS.forEach(({ key, label }) => { out[label] = r[key] ?? '' })
      return out
    })
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'TaskAllocationSummary')
    XLSX.writeFile(wb, `TaskAllocationSummary_${new Date().toISOString().split('T')[0]}.xlsx`)
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

            {/* Page Title + Stats */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0e4a78] flex items-center justify-center shadow">
                  <FiClipboard className="text-white text-xl" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[#0e4a78]">Task Allocation Summary</h1>
                  <p className="text-slate-500 text-sm">Today's yard-wise task counts and nearby equipment</p>
                </div>
              </div>

              <div className="grid grid-cols-3 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm w-full lg:w-[480px] shrink-0">
                <StatTile label="Total Task"     value={stats.total}     icon={FiList}        tone="slate"   total={stats.total} />
                <StatTile label="Completed"      value={stats.completed} icon={FiCheckCircle} tone="emerald" total={stats.total} />
                <StatTile label="Pending"        value={stats.pending}   icon={FiClock}       tone="amber"   total={stats.total} />
              </div>
            </div>

            {/* Results Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-white font-bold text-lg tracking-wide uppercase">Task Allocation Summary</h2>
                  <p className="text-white/60 text-xs mt-0.5">{filteredRows.length.toLocaleString()} yards</p>
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
                    onClick={() => refetch()}
                    title="Refresh"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors border border-white/30"
                  >
                    <FiRefreshCw className={isFetching ? 'animate-spin' : ''} size={14} />
                  </button>

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
                    <div className="text-red-500 font-semibold text-sm">Failed to load data. Check backend connection.</div>
                  </div>
                ) : isFetching ? (
                  <div className="px-8 py-12 flex flex-col items-center gap-3 text-slate-400">
                    <div className="w-10 h-10 border-2 border-slate-200 border-t-[#0e4a78] rounded-full animate-spin" />
                    <p className="text-sm font-medium">Loading task allocation data…</p>
                  </div>
                ) : filteredRows.length === 0 ? (
                  <div className="px-8 py-12 text-center text-slate-400 text-sm">
                    No records found.
                  </div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {COLUMNS.map((col) => (
                          <th key={col.key} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRows.map((row, index) => (
                        <tr key={index} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/50`}>
                          {COLUMNS.map((col) => {
                            const raw = row[col.key]
                            const display = raw != null && raw !== '' ? raw : <span className="text-slate-300">—</span>
                            return (
                              <td
                                key={col.key}
                                className={`px-4 py-3 whitespace-nowrap ${col.key === 'YardName' ? 'text-slate-800 font-semibold' : 'text-slate-600'}`}
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

export default TaskAllocationSummary
