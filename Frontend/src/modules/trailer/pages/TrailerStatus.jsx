import React, { useState, useMemo, useEffect } from 'react'
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
import { StatCard, StatGrid } from '../../../components/ui/StatCard'
import { FilterBar, FilterField, FilterClearBtn } from '../../../components/ui/FilterBar'

const normalizeTrailerRow = (row) => ({
  trailerNo: row?.TrailerNo ?? '',
  activity: row?.ActivityName ?? '',
  containerNo: row?.ContainerNo ?? '',
  size: row?.ContainerSize ?? '',
  process: row?.ProcessName ?? '',
  gateIn: row?.GateInDate ?? '',
  gateOut: row?.GateOutDate ?? '',
  tat: row?.TAT ?? '',
})

// TAT comes back as "HHH:MM" (e.g. "000:39") — convert to total hours for bucketing
const tatToHours = (tat) => {
  const [h, m] = String(tat || '').split(':').map(Number)
  if (!Number.isFinite(h)) return null
  return h + (Number.isFinite(m) ? m / 60 : 0)
}

const fmtDate = (val) => {
  if (!val) return ''
  const d = new Date(String(val).replace(' ', 'T'))
  if (isNaN(d)) return String(val)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
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

const PAGE_SIZE = 10

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span className="opacity-30 ml-1"><FiChevronUp size={10} /></span>
  return sortDir === 'asc'
    ? <FiChevronUp className="ml-1 text-blue-200" size={11} />
    : <FiChevronDown className="ml-1 text-blue-200" size={11} />
}

const TrailerStatus = () => {
  const [fromDate, setFromDate] = useState(yesterdayLocalDT())
  const [toDate, setToDate] = useState(todayLocalDT())
  const [queryFromDate, setQueryFromDate] = useState(fromDate)
  const [queryToDate, setQueryToDate] = useState(toDate)
  const [globalSearch, setGlobalSearch] = useState('')
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)

  // Debounce the datetime-local inputs before triggering the (non-lazy) query,
  // since datetime-local fires onChange per keystroke/segment.
  useEffect(() => {
    const t = setTimeout(() => {
      setQueryFromDate(fromDate)
      setQueryToDate(toDate)
    }, 500)
    return () => clearTimeout(t)
  }, [fromDate, toDate])

  const { data: trailerResponse, isFetching, isError } = useGetTrailerReportQuery({ from_date: queryFromDate, to_date: queryToDate })
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
      { label: 'Empty', value: empty, icon: FiBox, tone: 'amber' },
      { label: 'Import', value: imp, icon: FiTruckIcon, tone: 'sky' },
      { label: 'Export', value: exp, icon: FiActivity, tone: 'rose' },
      { label: '<= 1 Hr', value: bucket(0, 1), icon: FiClock, tone: 'amber' },
      { label: '1 - 2 Hrs', value: bucket(1, 2), icon: FiClock, tone: 'sky' },
      { label: '2 - 3 Hrs', value: bucket(2, 3), icon: FiClock, tone: 'rose' },
      { label: '3 - 5 Hrs', value: bucket(3, 5), icon: FiClock, tone: 'emerald' },
      { label: '5 - 10 Hrs', value: bucket(5, 10), icon: FiClock, tone: 'amber' },
      { label: '>= 10 Hrs', value: bucket(10, null), icon: FiClock, tone: 'violet' },
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
    const exportRows = filteredData.map((r) => ({
      'Trailer No': r.trailerNo,
      'Activity': r.activity,
      'Container No': r.containerNo,
      'Size': r.size,
      'Process': r.process,
      'Gate In Date': fmtDate(r.gateIn),
      'Gate Out Date': fmtDate(r.gateOut),
      'TAT': r.tat,
    }))
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Trailer Status')
    XLSX.writeFile(wb, `TrailerStatus_${fromDate.replace(/:/g, '')}_${toDate.replace(/:/g, '')}.xlsx`)
  }

  const handleClear = () => {
    setFromDate(yesterdayLocalDT()); setToDate(todayLocalDT())
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
          <header className="pt-6 pb-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Trailer Management</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0e4a78] flex items-center gap-2 mt-0.5">
              <FaTruck /> Trailer Status
            </h1>
            <p className="text-slate-500 mt-0.5 text-sm">
              {cardData[0].value.toLocaleString()} total records
            </p>
          </header>

          {/* ── Stats zone ── */}
          <StatGrid cols="grid-cols-2 sm:grid-cols-5" className="mb-4">
            {cardData.map((card) => (
              <StatCard key={card.label} label={card.label} value={card.value} icon={card.icon} tone={card.tone} />
            ))}
          </StatGrid>

          {/* ── Filter Bar ── */}
          <FilterBar className="mb-4">
            <FilterField label="From Date" icon={FiCalendar}>
              <input
                type="datetime-local" value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all"
              />
            </FilterField>

            <FilterField label="To Date" icon={FiCalendar}>
              <input
                type="datetime-local" value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all"
              />
            </FilterField>

            <FilterField label="Search" icon={FiSearch} className="flex-1 min-w-[180px]">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  value={globalSearch}
                  onChange={e => { setGlobalSearch(e.target.value); setPage(1) }}
                  placeholder="Search trailer, container…"
                  className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all"
                />
              </div>
            </FilterField>

            <div className="flex gap-2">
              <FilterClearBtn onClick={handleClear} />
              <button
                onClick={handleExport}
                disabled={!filteredData.length}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-40"
              >
                <FiDownload size={13} />
                Excel
              </button>
            </div>
          </FilterBar>

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
                      <TH col="tat">TAT</TH>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-16 text-center">
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
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-700">{fmtDate(row.gateIn) || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-700">{fmtDate(row.gateOut) || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-slate-700">{row.tat || <span className="text-slate-300">—</span>}</td>
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
