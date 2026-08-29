import { useState, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import {
  FiSearch, FiRefreshCw, FiAlertTriangle, FiCalendar,
  FiPackage, FiLogIn, FiLogOut, FiClock,
} from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import { MdOutlineInventory2 } from 'react-icons/md'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { useLazyGetContainerGateReportQuery } from '../../../store/api/ymsApi'

const today     = new Date().toISOString().split('T')[0]
const yesterday = new Date(Date.now() - 864e5).toISOString().split('T')[0]

const fmt = (val) => {
  if (!val) return '—'
  const d = new Date(String(val).replace(' ', 'T'))
  if (isNaN(d)) return String(val)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const TONE_MAP = {
  slate:   { accent: "#0e4a78", iconColor: "text-[#0e4a78]",   iconBg: "bg-[#0e4a78]/10", valueColor: "text-[#0e4a78]",   badgeBg: "bg-[#0e4a78]/8",  activeBg: "bg-[#0e4a78]"   },
  emerald: { accent: "#059669", iconColor: "text-emerald-600", iconBg: "bg-emerald-50",    valueColor: "text-emerald-700", badgeBg: "bg-emerald-50",   activeBg: "bg-emerald-600" },
  amber:   { accent: "#d97706", iconColor: "text-amber-600",   iconBg: "bg-amber-50",      valueColor: "text-amber-700",   badgeBg: "bg-amber-50",     activeBg: "bg-amber-500"   },
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
          <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${t.badgeBg}`} style={{ color: t.accent }}>
            {pct}%
          </span>
        )}
      </div>
      {total > 0 && tone !== "slate" && (
        <div className="h-[2px] bg-slate-100">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: t.accent }} />
        </div>
      )}
    </div>
  )
}

const ContainerStatusReport = () => {
  const [fromDate, setFromDate] = useState(yesterday)
  const [toDate,   setToDate]   = useState(today)
  const [search,   setSearch]   = useState('')

  const [fetchReport, { data: apiData, isFetching, isError }] = useLazyGetContainerGateReportQuery()

  const allRows = useMemo(() => apiData?.data ?? [], [apiData])

  const rows = useMemo(() => {
    if (!search.trim()) return allRows
    const q = search.trim().toLowerCase()
    return allRows.filter(r =>
      Object.values(r).some(v => v != null && String(v).toLowerCase().includes(q))
    )
  }, [allRows, search])

  const stats = useMemo(() => {
    const inYard   = allRows.filter(r => !r.GateOutDate).length
    const gatedOut = allRows.filter(r =>  r.GateOutDate).length
    return { total: allRows.length, inYard, gatedOut }
  }, [allRows])

  useEffect(() => { fetchReport({ from_date: yesterday, to_date: today }) }, []) // eslint-disable-line

  const handleSearch = () => fetchReport({ from_date: fromDate, to_date: toDate })

  const handleClear = () => {
    setFromDate(yesterday); setToDate(today); setSearch('')
    fetchReport({ from_date: yesterday, to_date: today })
  }

  const handleExport = () => {
    if (!rows.length) return
    const ws = XLSX.utils.json_to_sheet(rows.map((r, i) => ({
      '#': i + 1,
      'Container No':  r.ContNo,
      'Size':          r.ContSize,
      'Type':          r.ContTypeName,
      'Process':       r.ProcessName,
      'Arrival':       r.Arrival,
      'Gate In Date':  fmt(r.GateInDate),
      'TAT':           r.TAT,
      'Gate Out Date': fmt(r.GateOutDate),
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'ContainerStatus')
    XLSX.writeFile(wb, `ContainerStatusReport_${today}.xlsx`)
  }

  return (
    <div className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}>
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 pb-10">

          {/* ── Header + Stat Cards ── */}
          <header className="pt-6 pb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Reports</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0e4a78] flex items-center gap-2 mt-0.5">
                <MdOutlineInventory2 /> Container Status Report
              </h1>
              <p className="text-slate-500 mt-0.5 text-sm">
                {stats.total > 0
                  ? `${stats.total.toLocaleString()} containers for selected range`
                  : 'Select date range and click Search'}
              </p>
            </div>

            <div className="grid grid-cols-3 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm w-full lg:w-[540px] shrink-0">
              <StatTile label="Total"     value={stats.total}    icon={FiPackage} tone="slate"   total={stats.total} />
              <StatTile label="In Yard"   value={stats.inYard}   icon={FiLogIn}   tone="emerald" total={stats.total} />
              <StatTile label="Gated Out" value={stats.gatedOut} icon={FiLogOut}  tone="amber"   total={stats.total} />
            </div>
          </header>

          {/* ── Filter Bar ── */}
          <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden mb-6">
            <div className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-3">
              <h2 className="text-lg font-semibold tracking-wide">Container Status Report</h2>
            </div>
            <div className="px-4 sm:px-6 py-4 flex flex-wrap gap-4 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Gate In From</label>
                <div className="relative">
                  <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                    className="pl-9 pr-3 py-2.5 border-2 border-slate-300 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all w-56" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Gate In To</label>
                <div className="relative">
                  <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                    className="pl-9 pr-3 py-2.5 border-2 border-slate-300 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all w-56" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleClear}
                  className="px-4 py-2.5 rounded-lg border-2 border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-all">
                  Clear
                </button>
                <button onClick={handleSearch} disabled={isFetching}
                  className="flex items-center gap-2 bg-[#0e4a78] hover:bg-[#0a3b61] active:bg-[#072c4a] text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed">
                  <FiRefreshCw className={isFetching ? 'animate-spin' : ''} size={13} />
                  {isFetching ? 'Loading…' : 'Search'}
                </button>
              </div>
            </div>
          </section>

          {/* ── Table ── */}
          <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">

            {/* Table header bar */}
            <div className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
                  <MdOutlineInventory2 className="text-lg" />
                </div>
                <div>
                  <p className="font-semibold text-base">Container Status</p>
                  <p className="text-xs text-white/60">{rows.length.toLocaleString()} records</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* inline search */}
                <div className="relative hidden sm:block">
                  <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50" size={12} />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Filter table…"
                    className="pl-8 pr-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 text-xs focus:outline-none focus:bg-white/20 w-44 transition-all" />
                </div>
                <button onClick={handleExport} disabled={!rows.length}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-all disabled:opacity-40">
                  <FaFileExcel size={11} /> Export
                </button>
              </div>
            </div>

            {/* Loading */}
            {isFetching && (
              <div className="py-20 flex flex-col items-center gap-3 text-slate-500">
                <div className="w-10 h-10 rounded-full border-4 border-[#0e4a78]/20 border-t-[#0e4a78] animate-spin" />
                <span className="text-sm font-medium">Loading container data…</span>
              </div>
            )}

            {/* Error */}
            {isError && !isFetching && (
              <div className="py-16 text-center text-red-600 font-medium text-sm">
                <FiAlertTriangle className="mx-auto text-3xl mb-2" />
                Failed to load data. Check backend connection.
              </div>
            )}

            {/* Empty state before first search */}
            {!isFetching && !isError && !apiData && (
              <div className="py-20 text-center text-slate-400">
                <FiClock className="mx-auto text-4xl mb-3 text-slate-300" />
                <p className="font-medium text-slate-500">Select a date range and click Search</p>
              </div>
            )}

            {/* Table body */}
            {!isFetching && !isError && apiData && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white text-xs">
                      {['#', 'Container No', 'Size', 'Type', 'Process', 'Arrival', 'Gate In Date', 'TAT', 'Gate Out Date'].map(h => (
                        <th key={h} className="px-3 py-3 text-left font-semibold uppercase tracking-wider whitespace-nowrap border-r border-white/10 last:border-r-0">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-14 text-center">
                          <FiSearch className="mx-auto text-4xl text-slate-300 mb-3" />
                          <p className="text-slate-500 font-medium">No records found</p>
                          <p className="text-xs text-slate-400 mt-1">Try a different date range</p>
                        </td>
                      </tr>
                    ) : rows.map((r, idx) => {
                      const isOut = !!r.GateOutDate
                      const processCls = {
                        IMPORT: 'bg-purple-100 text-purple-700',
                        EXPORT: 'bg-teal-100 text-teal-700',
                        EMPTY:  'bg-slate-100 text-slate-500',
                        DOMESTIC: 'bg-amber-100 text-amber-700',
                      }[(r.ProcessName || '').toUpperCase()] ?? 'bg-gray-100 text-gray-600'
                      return (
                        <tr key={idx}
                          className={`hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                          <td className="px-3 py-2.5 text-[10px] text-slate-400 border-r border-slate-100">{idx + 1}</td>
                          <td className="px-3 py-2.5 border-r border-slate-100">
                            <span className="font-black font-mono text-xs text-[#0e4a78] bg-blue-50 px-2 py-0.5 rounded-full">
                              {r.ContNo || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs font-semibold text-slate-700 border-r border-slate-100">{r.ContSize ?? '—'}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-700 border-r border-slate-100">{r.ContTypeName || '—'}</td>
                          <td className="px-3 py-2.5 border-r border-slate-100">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${processCls}`}>
                              {r.ProcessName || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-700 border-r border-slate-100">{r.Arrival || '—'}</td>
                          <td className="px-3 py-2.5 text-[11px] text-slate-700 whitespace-nowrap border-r border-slate-100">{fmt(r.GateInDate)}</td>
                          <td className="px-3 py-2.5 text-[11px] font-mono text-slate-600 whitespace-nowrap border-r border-slate-100">
                            {r.TAT || '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            {isOut
                              ? <span className="text-[11px] text-amber-700 whitespace-nowrap">{fmt(r.GateOutDate)}</span>
                              : <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  In Yard
                                </span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </main>
        <Footer />
      </div>
    </div>
  )
}

export default ContainerStatusReport
