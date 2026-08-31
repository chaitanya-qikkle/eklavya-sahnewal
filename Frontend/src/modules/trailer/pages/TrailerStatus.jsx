import React, { useState, useMemo } from 'react'
import {
  FiSearch, FiRefreshCw, FiChevronUp, FiChevronDown,
  FiCalendar, FiDownload, FiTruck as FiTruckIcon, FiPackage,
  FiBox, FiClock, FiActivity,
} from 'react-icons/fi'
import { FaTruck } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { useGetTrailerReportQuery } from '../../../store/api/ymsApi'

const TONE_MAP = {
  slate:   { accent: "#0e4a78", iconColor: "text-[#0e4a78]",   iconBg: "bg-[#0e4a78]/10", valueColor: "text-[#0e4a78]" },
  cyan:    { accent: "#0891b2", iconColor: "text-cyan-600",    iconBg: "bg-cyan-50",       valueColor: "text-cyan-700" },
  orange:  { accent: "#d97706", iconColor: "text-orange-600",  iconBg: "bg-orange-50",     valueColor: "text-orange-700" },
  red:     { accent: "#dc2626", iconColor: "text-red-600",     iconBg: "bg-red-50",        valueColor: "text-red-700" },
  lime:    { accent: "#65a30d", iconColor: "text-lime-600",    iconBg: "bg-lime-50",       valueColor: "text-lime-700" },
}

const StatTile = ({ label, value, icon: Icon, tone = "slate" }) => {
  const t = TONE_MAP[tone] || TONE_MAP.slate
  return (
    <div className="relative text-left overflow-hidden border-r border-b border-slate-200 last:border-r-0 bg-white">
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: t.accent }} />
      <div className="pl-3.5 pr-3 py-3 flex items-center gap-3">
        <span className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg ${t.iconBg} ${t.iconColor}`}>
          {Icon && <Icon className="text-sm" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-400 leading-tight mb-1 truncate">
            {label}
          </p>
          <p className={`text-xl font-black leading-none tracking-tight ${t.valueColor}`}>
            {value.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}

const normalizeTrailerRow = (row) => ({
  trailerNo: row?.TrailerNo ?? '',
  activity: row?.ActivityName ?? '',
  containerNo: row?.ContainerNo ?? '',
  size: row?.ContainerSize ?? '',
  process: row?.ProcessName ?? '',
  gateIn: row?.GateInDate ?? '',
  gateOut: row?.GateOutDate ?? '',
  offload: '',
  location: '',
  tat: row?.TAT ?? '',
  survey: '',
})

// TAT comes back as "HHH:MM" (e.g. "000:39") — convert to total hours for bucketing
const tatToHours = (tat) => {
  const [h, m] = String(tat || '').split(':').map(Number)
  if (!Number.isFinite(h)) return null
  return h + (Number.isFinite(m) ? m / 60 : 0)
}

const todayStr = () => new Date().toISOString().slice(0, 10)

const PAGE_SIZE = 10

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span className="opacity-30 ml-1"><FiChevronUp size={10} /></span>
  return sortDir === 'asc'
    ? <FiChevronUp className="ml-1 text-blue-200" size={11} />
    : <FiChevronDown className="ml-1 text-blue-200" size={11} />
}

const TrailerStatus = () => {
  const [fromDate, setFromDate] = useState(todayStr())
  const [toDate, setToDate] = useState(todayStr())
  const [globalSearch, setGlobalSearch] = useState('')
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)

  const { data: trailerResponse, isFetching, isError } = useGetTrailerReportQuery({ from_date: fromDate, to_date: toDate })
  const trailerData = useMemo(
    () => (Array.isArray(trailerResponse?.data) ? trailerResponse.data : []).map(normalizeTrailerRow),
    [trailerResponse],
  )

  const cardData = useMemo(() => {
    const total  = trailerData.length
    const empty  = trailerData.filter((r) => String(r.process).toUpperCase() === 'EMPTY').length
    const imp    = trailerData.filter((r) => String(r.process).toUpperCase() === 'IMPORT').length
    const exp    = trailerData.filter((r) => String(r.process).toUpperCase() === 'EXPORT').length
    const hours  = trailerData.map((r) => tatToHours(r.tat)).filter((h) => h !== null)
    const bucket = (lo, hi) => hours.filter((h) => h >= lo && (hi == null || h < hi)).length

    return [
      { label: 'Total', value: total, icon: FiPackage, tone: 'slate' },
      { label: 'Empty', value: empty, icon: FiBox, tone: 'orange' },
      { label: 'Import', value: imp, icon: FiTruckIcon, tone: 'cyan' },
      { label: 'Export', value: exp, icon: FiActivity, tone: 'red' },
      { label: '<= 1 Hr', value: bucket(0, 1), icon: FiClock, tone: 'orange' },
      { label: '1 - 2 Hrs', value: bucket(1, 2), icon: FiClock, tone: 'cyan' },
      { label: '2 - 3 Hrs', value: bucket(2, 3), icon: FiClock, tone: 'red' },
      { label: '3 - 5 Hrs', value: bucket(3, 5), icon: FiClock, tone: 'lime' },
      { label: '5 - 10 Hrs', value: bucket(5, 10), icon: FiClock, tone: 'orange' },
      { label: '>= 10 Hrs', value: bucket(10, null), icon: FiClock, tone: 'cyan' },
    ]
  }, [trailerData])

  const filteredData = useMemo(() => {
    let data = [...trailerData]

    if (globalSearch) {
      const lowerSearch = globalSearch.toLowerCase()
      data = data.filter(item =>
        Object.values(item).some(val =>
          val.toString().toLowerCase().includes(lowerSearch)
        )
      )
    }

    if (sortCol) {
      data.sort((a, b) => {
        if (a[sortCol] < b[sortCol]) return sortDir === 'asc' ? -1 : 1
        if (a[sortCol] > b[sortCol]) return sortDir === 'asc' ? 1 : -1
        return 0
      })
    }

    return data
  }, [trailerData, globalSearch, sortCol, sortDir])

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE))
  const paginatedData = filteredData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleSort = (col) => {
    setSortCol(col)
    setSortDir(prev => (sortCol === col && prev === 'asc') ? 'desc' : 'asc')
  }

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Trailer Status')
    XLSX.writeFile(wb, `TrailerStatus_${fromDate}_${toDate}.xlsx`)
  }

  const handleClear = () => {
    setFromDate(todayStr()); setToDate(todayStr())
    setGlobalSearch(''); setPage(1)
  }

  const goToPage = (pg) => {
    if (pg < 1 || pg > totalPages) return
    setPage(pg)
  }

  const TH = ({ col, children }) => (
    <th
      onClick={() => toggleSort(col)}
      className="px-3 py-2 text-left font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:bg-white/10 transition-colors"
    >
      <span className="flex items-center gap-0.5">
        {children}
        <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
      </span>
    </th>
  )

  return (
    <div
      className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      {/* App-standard light overlay */}
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 pb-10">

          {/* ── Header ── */}
          <header className="pt-6 pb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Trailer Management</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0e4a78] flex items-center gap-2 mt-0.5">
                <FaTruck /> Trailer Status
              </h1>
              <p className="text-slate-500 mt-0.5 text-sm">
                {cardData[0].value.toLocaleString()} total records
              </p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm w-full xl:w-[760px] shrink-0">
              {cardData.map((card) => (
                <StatTile key={card.label} label={card.label} value={card.value} icon={card.icon} tone={card.tone} />
              ))}
            </div>
          </header>

          {/* ── Filter Bar ── */}
          <div className="bg-white/95 rounded-xl shadow-lg border border-slate-300 px-4 py-3 mb-4 flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <FiCalendar className="text-[#0e4a78]" size={11} /> From Date
              </label>
              <input
                type="date" value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="border-2 border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <FiCalendar className="text-[#0e4a78]" size={11} /> To Date
              </label>
              <input
                type="date" value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="border-2 border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all"
              />
            </div>

            <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <FiSearch className="text-[#0e4a78]" size={11} /> Search
              </label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  value={globalSearch}
                  onChange={e => { setGlobalSearch(e.target.value); setPage(1) }}
                  placeholder="Search trailer, container…"
                  className="w-full border-2 border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleClear}
                className="px-4 py-2 rounded-lg border-2 border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all"
              >
                Clear
              </button>
              <button
                onClick={handleExport}
                disabled={!filteredData.length}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-40"
              >
                <FiDownload size={13} />
                Excel
              </button>
            </div>
          </div>

          {/* ── Table ── */}
          <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">

            {/* Table header bar */}
            <div className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
                  <FaTruck />
                </div>
                <div>
                  <p className="font-semibold text-base">Trailer Live Status</p>
                  <p className="text-xs text-white/60">
                    Page {page} of {totalPages} · {filteredData.length.toLocaleString()} total · {PAGE_SIZE} per page
                  </p>
                </div>
              </div>
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-white/50 bg-white/10 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>

            {/* Error */}
            {isError && (
              <div className="px-6 py-10 text-center text-red-600 font-medium text-sm">
                Failed to load trailer status. Please try again.
              </div>
            )}

            {/* Spinner */}
            {isFetching && (
              <div className="py-20 flex flex-col items-center gap-3 text-slate-500">
                <div className="w-10 h-10 rounded-full border-4 border-[#0e4a78]/20 border-t-[#0e4a78] animate-spin" />
                <span className="text-sm font-medium">Loading…</span>
              </div>
            )}

            {/* Table body */}
            {!isFetching && !isError && (
              <div className="overflow-x-auto">
                <table className="text-sm border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
                  <thead>
                    <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white text-xs">
                      <th className="px-2 py-2 text-left font-semibold uppercase tracking-wider border-r border-white/10 w-8">#</th>
                      <TH col="trailerNo">Trailer No</TH>
                      <TH col="activity">Activity</TH>
                      <TH col="containerNo">Container No</TH>
                      <TH col="size">Size</TH>
                      <TH col="process">Process</TH>
                      <TH col="gateIn">Gate In Date</TH>
                      <TH col="gateOut">Gate Out Date</TH>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Offload Date</th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Location</th>
                      <TH col="tat">TAT</TH>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Survey</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-16 text-center">
                          <FiSearch className="mx-auto text-4xl text-slate-300 mb-3" />
                          <p className="font-semibold text-slate-400 text-sm">No records found</p>
                          <p className="text-xs text-slate-300 mt-1">Adjust the date range or search</p>
                        </td>
                      </tr>
                    ) : paginatedData.map((row, idx) => {
                      const serial = (page - 1) * PAGE_SIZE + idx + 1
                      return (
                        <tr
                          key={idx}
                          className={`border-b border-slate-100 hover:bg-blue-50 transition-colors
                            ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                        >
                          <td className="px-2 py-2 text-[10px] text-slate-400 font-medium border-r border-slate-100 w-8">
                            {serial}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-bold text-slate-700">{row.trailerNo || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-[11px] text-slate-600 font-medium">{row.activity || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 text-[#0e4a78] font-black font-mono text-xs">
                              {row.containerNo || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-700">{row.size || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-[11px] text-slate-600 font-medium">{row.process || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-700">{row.gateIn || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-700">{row.gateOut || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-700">{row.offload || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 text-[11px] text-slate-600 whitespace-nowrap max-w-[140px] truncate">{row.location || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-slate-700">{row.tat || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-700">{row.survey || <span className="text-slate-300">—</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Pagination ── */}
            {!isFetching && totalPages > 0 && (
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Showing{' '}
                  <strong className="text-[#0e4a78]">{filteredData.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}</strong>–<strong className="text-[#0e4a78]">{Math.min(page * PAGE_SIZE, filteredData.length)}</strong>
                  {' '}of{' '}
                  <strong className="text-[#0e4a78]">{filteredData.length.toLocaleString()}</strong> records
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToPage(page - 1)}
                    disabled={page === 1}
                    className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${
                      page === 1
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
                      max={totalPages}
                      value={page}
                      onChange={(e) => {
                        const pg = Math.max(1, Math.min(totalPages, Number(e.target.value) || 1))
                        goToPage(pg)
                      }}
                      className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-[#0e4a78]"
                    />
                    <span className="text-slate-600">of {totalPages}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => goToPage(page + 1)}
                    disabled={page === totalPages}
                    className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${
                      page === totalPages
                        ? 'text-slate-400 cursor-not-allowed bg-slate-100'
                        : 'text-[#0e4a78] hover:bg-blue-50'
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>

        </main>
        <Footer />
      </div>
    </div>
  )
}

export default TrailerStatus
