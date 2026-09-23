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
  violet:  { accent: "#7c3aed", iconColor: "text-violet-600",  iconBg: "bg-violet-50",     valueColor: "text-violet-700",  badgeBg: "bg-violet-50",    activeBg: "bg-violet-600"  },
  rose:    { accent: "#e11d48", iconColor: "text-rose-600",    iconBg: "bg-rose-50",       valueColor: "text-rose-700",    badgeBg: "bg-rose-50",      activeBg: "bg-rose-600"    },
}

const StatTile = ({ label, value, icon: Icon, tone = "slate", total, isActive, onClick }) => {
  const t = TONE_MAP[tone] || TONE_MAP.slate
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const clickable = typeof onClick === 'function'
  const Tag = clickable ? 'button' : 'div'
  return (
    <Tag
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={`group relative text-left overflow-hidden border-r border-slate-200 last:border-r-0 transition-all duration-150
        ${isActive ? "bg-slate-50" : clickable ? "bg-white hover:bg-slate-50/70" : "bg-white"}`}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px] transition-all duration-150" style={{ background: !clickable || isActive ? t.accent : "transparent" }} />
      <div className="pl-3.5 pr-3 py-2.5 flex items-center gap-2.5">
        <span className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150 ${
          clickable && isActive ? `${t.activeBg} text-white` : `${t.iconBg} ${t.iconColor}`
        }`}>
          {Icon && <Icon className="text-[13px]" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-400 leading-tight mb-0.5">
            {label}
          </p>
          <p className={`text-lg font-black leading-none tracking-tight transition-colors ${clickable && !isActive ? "text-slate-700" : t.valueColor}`}>
            {value.toLocaleString()}
          </p>
        </div>
        {total > 0 && tone !== "slate" && (
          <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${t.badgeBg}`} style={{ color: t.accent }}>
            {pct}%
          </span>
        )}
      </div>
      {clickable && (
        <div className="h-[2px] bg-slate-100">
          {total > 0 && tone !== "slate" && (
            <div className="h-full transition-all duration-700 rounded-full" style={{ width: `${pct}%`, background: t.accent }} />
          )}
        </div>
      )}
    </Tag>
  )
}

const ContainerStatusReport = () => {
  const [fromDate, setFromDate] = useState(yesterdayLocalDT())
  const [toDate,   setToDate]   = useState(todayLocalDT())
  const [search,   setSearch]   = useState('')
  const [processFilter, setProcessFilter] = useState('all')

  const [fetchReport, { data: apiData, isFetching, isError }] = useLazyGetContainerGateReportQuery()

  const allRows = useMemo(() => apiData?.data ?? [], [apiData])

  const rows = useMemo(() => {
    let result = allRows
    if (processFilter !== 'all') result = result.filter(r => String(r.ProcessName || '').toUpperCase() === processFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(r =>
        Object.values(r).some(v => v != null && String(v).toLowerCase().includes(q))
      )
    }
    return result
  }, [allRows, search, processFilter])

  const stats = useMemo(() => {
    const inYard   = allRows.filter(r => !r.GateOutDate).length
    const gatedOut = allRows.filter(r =>  r.GateOutDate).length
    return { total: allRows.length, inYard, gatedOut }
  }, [allRows])

  const processStats = useMemo(() => {
    const total = allRows.length
    const exportCount = allRows.filter(r => String(r.ProcessName || '').toUpperCase() === 'EXPORT').length
    const importCount = allRows.filter(r => String(r.ProcessName || '').toUpperCase() === 'IMPORT').length
    const emptyCount = allRows.filter(r => String(r.ProcessName || '').toUpperCase() === 'EMPTY').length
    const domesticCount = allRows.filter(r => String(r.ProcessName || '').toUpperCase() === 'DOMESTIC').length
    return { total, exportCount, importCount, emptyCount, domesticCount }
  }, [allRows])

  useEffect(() => { fetchReport({ from_date: yesterdayLocalDT(), to_date: todayLocalDT() }) }, []) // eslint-disable-line

  const handleSearch = () => fetchReport({ from_date: fromDate, to_date: toDate })

  const handleClear = () => {
    setFromDate(yesterdayLocalDT()); setToDate(todayLocalDT()); setSearch(''); setProcessFilter('all')
    fetchReport({ from_date: yesterdayLocalDT(), to_date: todayLocalDT() })
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
    XLSX.writeFile(wb, `ContainerStatusReport_${todayLocalDT().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}>
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 pb-10">

          {/* ── Header ── */}
          <header className="pt-6 pb-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Reports</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0e4a78] flex items-center gap-2 mt-0.5">
              <MdOutlineInventory2 /> Container Status Report
            </h1>
            <p className="text-slate-500 mt-0.5 text-sm">
              {stats.total > 0
                ? `${stats.total.toLocaleString()} containers for selected range`
                : 'Select date range and click Search'}
            </p>
          </header>

          {/* ── Filter Bar ── */}
          <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden mb-6">
            <div className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-3">
              <h2 className="text-lg font-semibold tracking-wide">Container Status Report</h2>
            </div>
            <div className="px-4 sm:px-6 py-4 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Gate In From</label>
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    <input type="datetime-local" value={fromDate} onChange={e => setFromDate(e.target.value)}
                      className="pl-9 pr-3 py-2.5 border-2 border-slate-300 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all w-56" />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Gate In To</label>
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    <input type="datetime-local" value={toDate} onChange={e => setToDate(e.target.value)}
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

              <div className="grid grid-cols-3 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm w-full sm:w-[540px] shrink-0">
                <StatTile label="Total"     value={stats.total}    icon={FiPackage} tone="slate"   total={stats.total} />
                <StatTile label="In Yard"   value={stats.inYard}   icon={FiLogIn}   tone="emerald" total={stats.total} />
                <StatTile label="Gated Out" value={stats.gatedOut} icon={FiLogOut}  tone="amber"   total={stats.total} />
              </div>

              <div className="grid grid-cols-5 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm w-full lg:w-[840px] mt-3">
                <StatTile
                  label="Total Entries"
                  value={processStats.total}
                  icon={FiPackage}
                  tone="slate"
                  isActive={processFilter === 'all'}
                  onClick={() => setProcessFilter('all')}
                  total={processStats.total}
                />
                <StatTile
                  label="Export"
                  value={processStats.exportCount}
                  icon={FiLogOut}
                  tone="amber"
                  isActive={processFilter === 'EXPORT'}
                  onClick={() => setProcessFilter('EXPORT')}
                  total={processStats.total}
                />
                <StatTile
                  label="Import"
                  value={processStats.importCount}
                  icon={FiLogIn}
                  tone="emerald"
                  isActive={processFilter === 'IMPORT'}
                  onClick={() => setProcessFilter('IMPORT')}
                  total={processStats.total}
                />
                <StatTile
                  label="Empty"
                  value={processStats.emptyCount}
                  icon={FiPackage}
                  tone="violet"
                  isActive={processFilter === 'EMPTY'}
                  onClick={() => setProcessFilter('EMPTY')}
                  total={processStats.total}
                />
                <StatTile
                  label="Domestic"
                  value={processStats.domesticCount}
                  icon={MdOutlineInventory2}
                  tone="rose"
                  isActive={processFilter === 'DOMESTIC'}
                  onClick={() => setProcessFilter('DOMESTIC')}
                  total={processStats.total}
                />
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
