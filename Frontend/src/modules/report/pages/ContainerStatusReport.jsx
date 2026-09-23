import { useState, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import {
  FiSearch, FiRefreshCw, FiAlertTriangle, FiCalendar,
  FiPackage, FiLogIn, FiLogOut, FiClock,
} from 'react-icons/fi'
import { MdOutlineInventory2 } from 'react-icons/md'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { useLazyGetContainerGateReportQuery } from '../../../store/api/ymsApi'
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

const fmt = (val) => {
  if (!val) return '—'
  const d = new Date(String(val).replace(' ', 'T'))
  if (isNaN(d)) return String(val)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const ContainerStatusReport = () => {
  const [fromDate, setFromDate] = useState(yesterdayLocalDT())
  const [toDate,   setToDate]   = useState(todayLocalDT())
  const [search,   setSearch]   = useState('')
  const [processFilter, setProcessFilter] = useState('all')
  const [gateFilter, setGateFilter] = useState('all')

  const [fetchReport, { data: apiData, isFetching, isError }] = useLazyGetContainerGateReportQuery()

  const allRows = useMemo(() => apiData?.data ?? [], [apiData])

  const rows = useMemo(() => {
    let result = allRows
    if (gateFilter === 'inyard') result = result.filter(r => !r.GateOutDate)
    else if (gateFilter === 'gatedout') result = result.filter(r => r.GateOutDate)
    if (processFilter !== 'all') result = result.filter(r => String(r.ProcessName || '').toUpperCase() === processFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(r =>
        Object.values(r).some(v => v != null && String(v).toLowerCase().includes(q))
      )
    }
    return result
  }, [allRows, search, processFilter, gateFilter])

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
    setFromDate(yesterdayLocalDT()); setToDate(todayLocalDT()); setSearch('')
    setProcessFilter('all'); setGateFilter('all')
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

          {/* ── Stats + Filter — merged into one card ── */}
          <FilterCard>
          <StatGrid cols="grid-cols-2 sm:grid-cols-4 lg:grid-cols-7" bare>
            <StatCard
              label="Total"
              value={stats.total}
              icon={FiPackage}
              tone="slate"
              isActive={gateFilter === 'all' && processFilter === 'all'}
              onClick={() => { setGateFilter('all'); setProcessFilter('all') }}
              total={stats.total}
            />
            <StatCard
              label="In Yard"
              value={stats.inYard}
              icon={FiLogIn}
              tone="emerald"
              isActive={gateFilter === 'inyard'}
              onClick={() => setGateFilter('inyard')}
              total={stats.total}
            />
            <StatCard
              label="Gated Out"
              value={stats.gatedOut}
              icon={FiLogOut}
              tone="amber"
              isActive={gateFilter === 'gatedout'}
              onClick={() => setGateFilter('gatedout')}
              total={stats.total}
            />
            <StatCard
              label="Export"
              value={processStats.exportCount}
              icon={FiLogOut}
              tone="amber"
              isActive={processFilter === 'EXPORT'}
              onClick={() => setProcessFilter('EXPORT')}
              total={processStats.total}
            />
            <StatCard
              label="Import"
              value={processStats.importCount}
              icon={FiLogIn}
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
              icon={MdOutlineInventory2}
              tone="rose"
              isActive={processFilter === 'DOMESTIC'}
              onClick={() => setProcessFilter('DOMESTIC')}
              total={processStats.total}
            />
          </StatGrid>

          {/* ── Filter Bar ── */}
          <FilterBar bare>
            <FilterField label="Gate In From" icon={FiCalendar}>
              <input type="datetime-local" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all w-56" />
            </FilterField>
            <FilterField label="Gate In To" icon={FiCalendar}>
              <input type="datetime-local" value={toDate} onChange={e => setToDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all w-56" />
            </FilterField>
            <div className="flex gap-2">
              <FilterClearBtn onClick={handleClear} />
              <FilterSearchBtn onClick={handleSearch} loading={isFetching} />
            </div>
          </FilterBar>
          </FilterCard>

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
                <FilterExportBtn onClick={handleExport} disabled={!rows.length} />
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
