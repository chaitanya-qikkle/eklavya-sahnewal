import React, { useState, useMemo, useEffect } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FiCalendar, FiRefreshCw, FiSearch, FiX, FiTruck, FiPackage, FiUpload, FiDownload, FiHome } from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { useLazyGetRailInReportQuery } from '../../../store/api/ymsApi'
import { StatCard, StatGrid, FilterCard } from '../../../components/ui/StatCard'
import { FilterBar, FilterField, FilterClearBtn, FilterSearchBtn, FilterExportBtn } from '../../../components/ui/FilterBar'

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

// Colored pill for Process (Import/Export/Empty/Domestic) — same tone system
// used by the stat cards above the table.
const ProcessBadge = ({ val }) => {
  if (!val) return <span className="text-slate-300 text-xs">—</span>
  const upper = String(val).toUpperCase()
  const cls = upper === 'IMPORT'
    ? 'bg-emerald-100 text-emerald-700'
    : upper === 'EXPORT'
    ? 'bg-amber-100 text-amber-700'
    : upper === 'DOMESTIC'
    ? 'bg-rose-100 text-rose-700'
    : upper === 'EMPTY'
    ? 'bg-violet-100 text-violet-700'
    : 'bg-slate-100 text-slate-600'
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{val}</span>
}

// Container status pill — generic ok/pending/hold-style colouring.
const StatusBadge = ({ val }) => {
  if (!val) return <span className="text-slate-300 text-xs">—</span>
  const upper = String(val).toUpperCase()
  const cls = upper.includes('HOLD') || upper.includes('BLOCK')
    ? 'bg-rose-100 text-rose-700'
    : upper.includes('PENDING') || upper.includes('WAIT')
    ? 'bg-amber-100 text-amber-700'
    : 'bg-sky-100 text-sky-700'
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{val}</span>
}

// Offload TAT comes back as "DD:HH:MM:SS" (or sometimes just "HH:MM") —
// parse to total hours and colour-code: fast (green) / moderate (amber) /
// slow (red), so the column reads at a glance instead of as plain text.
const tatToHours = (tat) => {
  const parts = String(tat || '').split(':').map(Number)
  if (!parts.length || parts.some((p) => !Number.isFinite(p))) return null
  if (parts.length === 4) {
    const [d, h, m] = parts
    return d * 24 + h + m / 60
  }
  if (parts.length >= 2) {
    const [h, m] = parts
    return h + (Number.isFinite(m) ? m / 60 : 0)
  }
  return null
}

const TatBadge = ({ val }) => {
  if (!val) return <span className="text-slate-300 text-xs">—</span>
  const hours = tatToHours(val)
  const cls = hours == null
    ? 'bg-slate-100 text-slate-600'
    : hours < 2
    ? 'bg-emerald-100 text-emerald-700'
    : hours < 6
    ? 'bg-amber-100 text-amber-700'
    : 'bg-rose-100 text-rose-700'
  return <span className={`px-2 py-0.5 rounded text-xs font-bold tabular-nums ${cls}`}>{val}</span>
}

// Container No as a bold rounded "tag" pill — matches the highlighted look
// used for container numbers across the rest of the app.
const ContainerTag = ({ val }) => {
  if (!val) return <span className="text-slate-300 text-xs">—</span>
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 text-[#0e4a78] font-black font-mono text-xs">
      {val}
    </span>
  )
}

// 20'/40' size badge — cyan/indigo, matching the size-split colours used in
// the admin dashboard's process-mix chart.
const SizeBadge = ({ val }) => {
  if (!val) return <span className="text-slate-300 text-xs">—</span>
  const is40 = String(val).includes('40')
  const cls = is40 ? 'bg-indigo-100 text-indigo-700' : 'bg-cyan-100 text-cyan-700'
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${cls}`}>{val}</span>
}

// Two-line date/time cell — date on top, time beneath in a lighter tone —
// easier to scan than one long "dd/mm/yyyy hh:mm" string.
const DateTimeCell = ({ val }) => {
  if (!val) return <span className="text-slate-300 text-xs">—</span>
  const d = new Date(String(val).replace(' ', 'T'))
  if (isNaN(d)) return <span className="text-slate-600">{String(val)}</span>
  const p = (n) => String(n).padStart(2, '0')
  return (
    <div className="leading-tight">
      <div className="font-semibold text-slate-700 text-xs">{p(d.getDate())}/{p(d.getMonth() + 1)}/{d.getFullYear()}</div>
      <div className="text-[10px] text-slate-400 font-medium">{p(d.getHours())}:{p(d.getMinutes())}</div>
    </div>
  )
}

// Moves count — small numeric badge, tone escalates with how many moves.
const MovesBadge = ({ val }) => {
  const n = Number(val)
  if (!Number.isFinite(n) || n === 0) return <span className="text-slate-300 text-xs">—</span>
  const cls = n <= 1 ? 'bg-slate-100 text-slate-600' : n <= 3 ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'
  return <span className={`inline-flex items-center justify-center min-w-[22px] px-1.5 py-0.5 rounded-full text-xs font-bold tabular-nums ${cls}`}>{n}</span>
}

const COLUMNS = [
  { key: 'ContainerNo',      label: 'Container No', render: (v) => <ContainerTag val={v} /> },
  { key: 'ContainerSize',    label: 'Size', render: (v) => <SizeBadge val={v} /> },
  { key: 'ContainerType',    label: 'Type' },
  { key: 'RailInDateTime',   label: 'Rail In Date', format: fmtDate, render: (v) => <DateTimeCell val={v} /> },
  { key: 'NAVDateTime',      label: 'Navision Date', format: fmtDate, render: (v) => <DateTimeCell val={v} /> },
  { key: 'ContainerLocation',label: 'Location' },
  { key: 'EquipmentName',    label: 'Equipment' },
  { key: 'DocumentNo',       label: 'Document No' },
  { key: 'BookingNo',        label: 'Booking No' },
  { key: 'Process',          label: 'Process', render: (v) => <ProcessBadge val={v} /> },
  { key: 'ContainerStatus',  label: 'Status', render: (v) => <StatusBadge val={v} /> },
  { key: 'Mode',             label: 'Mode' },
  { key: 'Terminal',         label: 'Terminal' },
  { key: 'WagonNo',          label: 'Wagon No' },
  { key: 'RakeNo',           label: 'Rake No' },
  { key: 'NoOfMoves',        label: 'Moves', render: (v) => <MovesBadge val={v} /> },
  { key: 'OffloadTAT',       label: 'Offload TAT', render: (v) => <TatBadge val={v} /> },
]

const RailInReport = () => {
  const [fetchReport, { data, isFetching, isError }] = useLazyGetRailInReportQuery()

  const [containerNo, setContainerNo] = useState('')
  const [fromDate, setFromDate] = useState(yesterdayLocalDT())
  const [toDate, setToDate]     = useState(todayLocalDT())
  const [search, setSearch]     = useState('')
  const [hasQueried, setHasQueried] = useState(false)
  const [processFilter, setProcessFilter] = useState('all')

  useEffect(() => {
    setHasQueried(true)
    fetchReport({ from_date: yesterdayLocalDT(), to_date: todayLocalDT() })
  }, []) // eslint-disable-line

  const rows = Array.isArray(data?.data) ? data.data : []

  const handleSearch = () => {
    setHasQueried(true)
    fetchReport({
      container_no: containerNo.trim() || undefined,
      from_date: fromDate,
      to_date: toDate,
    })
  }

  const handleClear = () => {
    setContainerNo('')
    setFromDate(yesterdayLocalDT())
    setToDate(todayLocalDT())
    setSearch('')
    setProcessFilter('all')
    setHasQueried(true)
    fetchReport({ from_date: yesterdayLocalDT(), to_date: todayLocalDT() })
  }

  const processStats = useMemo(() => {
    const total = rows.length
    const exportCount = rows.filter(r => String(r.Process || '').toUpperCase() === 'EXPORT').length
    const importCount = rows.filter(r => String(r.Process || '').toUpperCase() === 'IMPORT').length
    const emptyCount = rows.filter(r => String(r.Process || '').toUpperCase() === 'EMPTY').length
    const domesticCount = rows.filter(r => String(r.Process || '').toUpperCase() === 'DOMESTIC').length
    return { total, exportCount, importCount, emptyCount, domesticCount }
  }, [rows])

  const filteredData = useMemo(() => {
    let result = rows
    if (processFilter !== 'all') result = result.filter(r => String(r.Process || '').toUpperCase() === processFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((r) => COLUMNS.some(({ key }) => String(r[key] ?? '').toLowerCase().includes(q)))
    }
    return result
  }, [rows, search, processFilter])

  const handleExport = () => {
    if (!filteredData.length) return
    const exportRows = filteredData.map((r) => {
      const out = {}
      COLUMNS.forEach(({ key, label, format }) => { out[label] = format ? format(r[key]) : (r[key] ?? '') })
      return out
    })
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'RailInReport')
    XLSX.writeFile(wb, `RailInReport_${todayLocalDT().slice(0, 10)}.xlsx`)
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
                <FiTruck className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#0e4a78]">Rail In Report</h1>
                <p className="text-slate-500 text-sm">Pre-rail-in container arrivals and location detail</p>
              </div>
            </div>

            {/* Stats + Filter — merged into one card */}
            <FilterCard>
            <StatGrid cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" bare>
              <StatCard
                label="Total Entries"
                value={processStats.total}
                icon={FiPackage}
                tone="slate"
                isActive={processFilter === 'all'}
                onClick={() => setProcessFilter('all')}
                total={processStats.total}
              />
              <StatCard
                label="Export"
                value={processStats.exportCount}
                icon={FiUpload}
                tone="amber"
                isActive={processFilter === 'EXPORT'}
                onClick={() => setProcessFilter('EXPORT')}
                total={processStats.total}
              />
              <StatCard
                label="Import"
                value={processStats.importCount}
                icon={FiDownload}
                tone="emerald"
                isActive={processFilter === 'IMPORT'}
                onClick={() => setProcessFilter('IMPORT')}
                total={processStats.total}
              />
              <StatCard
                label="Empty"
                value={processStats.emptyCount}
                icon={FiPackage}
                tone="violet"
                isActive={processFilter === 'EMPTY'}
                onClick={() => setProcessFilter('EMPTY')}
                total={processStats.total}
              />
              <StatCard
                label="Domestic"
                value={processStats.domesticCount}
                icon={FiHome}
                tone="rose"
                isActive={processFilter === 'DOMESTIC'}
                onClick={() => setProcessFilter('DOMESTIC')}
                total={processStats.total}
              />
            </StatGrid>

            {/* Filter Bar — Search Criteria */}
            <FilterBar bare>
              <FilterField label="Container No" icon={FiSearch} className="flex-1 min-w-[180px]">
                <input
                  type="text"
                  value={containerNo}
                  onChange={(e) => setContainerNo(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Optional — filters by container"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm transition-colors"
                />
              </FilterField>

              <FilterField label="Rail In From" icon={FiCalendar}>
                <input
                  type="datetime-local"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full sm:w-52 px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm transition-colors"
                />
              </FilterField>

              <FilterField label="Rail In To" icon={FiCalendar}>
                <input
                  type="datetime-local"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full sm:w-52 px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm transition-colors"
                />
              </FilterField>

              <div className="flex items-center gap-2">
                <FilterClearBtn onClick={handleClear} />
                <FilterSearchBtn onClick={handleSearch} loading={isFetching} />
              </div>
            </FilterBar>
            </FilterCard>

            {/* Results Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-white font-bold text-lg tracking-wide uppercase">Rail In Detail</h2>
                  <p className="text-white/60 text-xs mt-0.5">{filteredData.length.toLocaleString()} records</p>
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

                  <FilterExportBtn onClick={handleExport} disabled={!filteredData.length} />
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
                    <p className="text-sm font-medium">Loading rail in data…</p>
                  </div>
                ) : !hasQueried ? (
                  <div className="px-8 py-14 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                      <FiTruck className="text-slate-400 text-xl" />
                    </div>
                    <p className="text-slate-400 text-sm font-medium">
                      Select filters and click <strong className="text-slate-600">Search</strong> to load data.
                    </p>
                  </div>
                ) : filteredData.length === 0 ? (
                  <div className="px-8 py-12 text-center text-slate-400 text-sm">
                    No records found for the selected criteria.
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
                      {filteredData.map((row, index) => (
                        <tr key={index} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/50`}>
                          {COLUMNS.map((col) => {
                            const raw = row[col.key]
                            const display = col.render
                              ? col.render(raw)
                              : col.format ? col.format(raw) : (raw != null && raw !== '' ? raw : <span className="text-slate-300">—</span>)
                            return (
                              <td key={col.key} className="px-4 py-3 whitespace-nowrap text-slate-600">
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
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
                  <span>Showing <strong className="text-slate-700">{filteredData.length}</strong> records</span>
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

export default RailInReport
