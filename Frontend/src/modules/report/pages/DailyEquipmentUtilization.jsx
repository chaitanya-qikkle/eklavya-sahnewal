import React, { useState, useMemo, useEffect, useRef } from 'react'
import { FiSearch, FiFilter, FiCalendar, FiChevronUp, FiChevronDown } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { useLazyGetEquipmentDailyUtilizationQuery, useLazyGetEquipmentDailyUtilizationCountQuery, useGetEquipmentQuery } from '../../../store/api/ymsApi'

const DailyEquipmentUtilization = () => {
  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [fromDate, setFromDate]         = useState(yesterday)
  const [toDate, setToDate]             = useState(yesterday)
  const [globalSearch, setGlobalSearch] = useState('')
  const [sortConfig, setSortConfig]     = useState({ key: null, direction: 'asc' })
  const [currentPage, setCurrentPage]   = useState(1)
  const pageSize = 15

  const { data: equipmentApi } = useGetEquipmentQuery()
  const [fetchUtilization, { data: utilizationApi, isFetching }] =
    useLazyGetEquipmentDailyUtilizationQuery()

  const [fetchCount, { data: countApi }] =
    useLazyGetEquipmentDailyUtilizationCountQuery()

  const allEquipment = useMemo(() => {
    const list = Array.isArray(equipmentApi?.data) ? equipmentApi.data : []
    return list.map(item =>
      String(item?.Equipment_Code ?? item?.equipment_code ??
             item?.Equipment_Name ?? item?.equipment_name ?? '').trim()
    ).filter(Boolean)
  }, [equipmentApi])

  const hasFetched = useRef(false)
  useEffect(() => {
    if (hasFetched.current || !allEquipment.length) return
    hasFetched.current = true
    fetchUtilization({ eqp_no: allEquipment.join(','), from_date: yesterday, to_date: yesterday })
    fetchCount({ from_date: yesterday, to_date: yesterday })
  }, [allEquipment, fetchUtilization, fetchCount, yesterday])

  const g = (r, ...keys) => {
    for (const k of keys) if (r[k] !== undefined && r[k] !== null && r[k] !== '') return r[k]
    return '—'
  }

  const rawRows = useMemo(
    () => Array.isArray(utilizationApi?.data) ? utilizationApi.data : [],
    [utilizationApi]
  )

  const countMap = useMemo(() => {
    const rows = Array.isArray(countApi?.data) ? countApi.data : []
    const map = new Map()
    rows.forEach(c => {
      const key = String(c.Equipment_Name ?? c.equipment_name ?? '').trim()
      if (!key) return
      map.set(key, {
        laden:  Number(c.Laden_Count  ?? c.laden_count  ?? 0),
        empty:  Number(c.Empty_Count  ?? c.empty_count  ?? 0),
        size20: Number(c.Size20_Count ?? c.size20_count ?? 0),
        size40: Number(c.Size40_Count ?? c.size40_count ?? 0),
      })
    })
    return map
  }, [countApi])

  const countTotals = useMemo(() => {
    const rows = Array.isArray(countApi?.data) ? countApi.data : []
    return {
      laden:  rows.reduce((s, c) => s + Number(c.Laden_Count  ?? c.laden_count  ?? 0), 0),
      empty:  rows.reduce((s, c) => s + Number(c.Empty_Count  ?? c.empty_count  ?? 0), 0),
      size20: rows.reduce((s, c) => s + Number(c.Size20_Count ?? c.size20_count ?? 0), 0),
      size40: rows.reduce((s, c) => s + Number(c.Size40_Count ?? c.size40_count ?? 0), 0),
    }
  }, [countApi])

  const tableRows = useMemo(() => rawRows.map(r => ({
    equipmentNo:    g(r, 'EquipmentNo', 'equipmentno', 'EQUIPMENT_NO'),
    breakdownTime:  g(r, 'BreakdownTime', 'breakdowntime', 'BREAKDOWN_TIME'),
    idleTime:       g(r, 'IdleTime', 'idletime', 'IDLE_TIME'),
    workTime:       g(r, 'WorkTime', 'worktime', 'WORK_TIME'),
    totalMoves:     Number(g(r, 'TotalMoves', 'totalmoves', 'TOTAL_MOVES') || 0),
    workingHours:   Number(g(r, 'WorkingHours', 'workinghours', 'WORKING_HOURS') || 0),
    hourlyMoves:    Number(g(r, 'HourlyMoves', 'hourlymoves', 'HOURLY_MOVES') || 0),
    expectedHrs:    Number(g(r, 'ExpectedWorkingHours', 'expectedworkinghours') || 18),
    utilization:    Number(g(r, 'PercentageUtilization', 'percentageutilization') || 0),
    carbonMove:     Number(g(r, 'Carbon_Emi_Move', 'carbon_emi_move') || 0),
    carbonHr:       Number(g(r, 'Carbon_Emi_hr', 'carbon_emi_hr') || 0),
  })), [rawRows])

  const filteredData = useMemo(() => {
    let data = [...tableRows]
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase()
      data = data.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)))
    }
    if (sortConfig.key) {
      data.sort((a, b) => {
        const av = a[sortConfig.key], bv = b[sortConfig.key]
        if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1
        if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return data
  }, [tableRows, globalSearch, sortConfig])

  const totalPages    = Math.ceil(filteredData.length / pageSize)
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }))
    setCurrentPage(1)
  }

  const handleSearch = () => {
    setCurrentPage(1)
    setGlobalSearch('')
    fetchUtilization({ eqp_no: allEquipment.join(','), from_date: fromDate, to_date: toDate })
    fetchCount({ from_date: fromDate, to_date: toDate })
  }

  const handleClear = () => {
    setFromDate(yesterday)
    setToDate(yesterday)
    setGlobalSearch('')
    setCurrentPage(1)
    fetchUtilization({ eqp_no: allEquipment.join(','), from_date: yesterday, to_date: yesterday })
    fetchCount({ from_date: yesterday, to_date: yesterday })
  }

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData.map((r, i) => ({
      '#':                        i + 1,
      'Equipment No':             r.equipmentNo,
      'Breakdown Time':           r.breakdownTime,
      'Idle Time':                r.idleTime,
      'Work Time':                r.workTime,
      'Total Moves':              r.totalMoves,
      'Working Hours':            r.workingHours,
      'Hourly Moves':             r.hourlyMoves,
      'Expected Working Hours':   r.expectedHrs,
      'Utilization %':            r.utilization.toFixed(2),
      'Carbon Emi/Move (ton CO₂)': r.carbonMove,
      'Carbon Emi/Hr (ton CO₂)':   r.carbonHr,
      'Laden Count':              (countMap.get(r.equipmentNo) ?? {}).laden ?? '',
      'Empty Count':              (countMap.get(r.equipmentNo) ?? {}).empty ?? '',
      '20ft Count':               (countMap.get(r.equipmentNo) ?? {}).size20 ?? '',
      '40ft Count':               (countMap.get(r.equipmentNo) ?? {}).size40 ?? '',
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Machine Utilization')
    XLSX.writeFile(wb, `Machine-Utilization-${fromDate}-to-${toDate}.xlsx`)
  }

  const summary = useMemo(() => {
    if (!filteredData.length) return null
    const n = filteredData.length
    return {
      avgUtil:    (filteredData.reduce((s, r) => s + r.utilization, 0) / n).toFixed(2),
      totalMoves: filteredData.reduce((s, r) => s + r.totalMoves, 0),
      avgWork:    (filteredData.reduce((s, r) => s + r.workingHours, 0) / n).toFixed(1),
      avgHourly:  (filteredData.reduce((s, r) => s + r.hourlyMoves, 0) / n).toFixed(1),
    }
  }, [filteredData])

  const SortIcon = ({ col }) => {
    if (sortConfig.key !== col) return <FiChevronUp className="inline w-3 h-3 opacity-40" />
    return sortConfig.direction === 'asc'
      ? <FiChevronUp className="inline w-3 h-3" />
      : <FiChevronDown className="inline w-3 h-3" />
  }

  const avgUtil = filteredData.length
    ? filteredData.reduce((s, r) => s + r.utilization, 0) / filteredData.length
    : 0

  const COLS = [
    { key: 'equipmentNo',   label: 'Equipment No'           },
    { key: 'breakdownTime', label: 'Breakdown Time'         },
    { key: 'idleTime',      label: 'Idle Time'              },
    { key: 'workTime',      label: 'Work Time'              },
    { key: 'totalMoves',    label: 'Total Moves'            },
    // Hidden per request — Laden/Empty/20ft/40ft counts (kept for easy restore)
    // { key: 'laden',         label: 'Laden'                  },
    // { key: 'empty',         label: 'Empty'                  },
    // { key: 'size20',        label: '20ft'                   },
    // { key: 'size40',        label: '40ft'                   },
    { key: 'workingHours',  label: 'Working Hours'          },
    { key: 'hourlyMoves',   label: 'Hourly Moves'           },
    { key: 'expectedHrs',   label: 'Expected Hrs'           },
    { key: 'utilization',   label: 'Utilization %'          },
    { key: 'carbonMove',    label: 'CO₂/Move (ton)'        },
    { key: 'carbonHr',      label: 'CO₂/Hr (ton)'          },
  ]

  return (
    <div
      className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px]" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 space-y-6">

          {/* ── Search Criteria ─────────────────────────────────────────── */}
          <section className="bg-white rounded-t-lg shadow-lg overflow-hidden border border-slate-300">
            <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-3">
              <h2 className="text-white font-bold text-base tracking-wide uppercase flex items-center gap-2">
                <FiFilter className="text-blue-200" />
                Search Criteria
              </h2>
            </div>
            <div className="p-6 bg-slate-50">
              <div className="flex flex-col md:flex-row items-end gap-4">

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <label className="text-xs font-bold text-slate-600 uppercase whitespace-nowrap min-w-[70px]">From Date</label>
                  <div className="relative">
                    <input
                      type="date" value={fromDate}
                      onChange={e => setFromDate(e.target.value)}
                      className="pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/40 text-sm text-slate-700 font-medium shadow-sm"
                    />
                    <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <label className="text-xs font-bold text-slate-600 uppercase whitespace-nowrap min-w-[55px]">To Date</label>
                  <div className="relative">
                    <input
                      type="date" value={toDate}
                      onChange={e => setToDate(e.target.value)}
                      className="pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/40 text-sm text-slate-700 font-medium shadow-sm"
                    />
                    <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClear}
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-md text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleSearch}
                    disabled={isFetching}
                    className="px-6 py-2 bg-[#0e4a78] text-white rounded-md text-sm font-bold hover:bg-[#0a3b61] transition-colors shadow-md flex items-center gap-2 disabled:opacity-50"
                  >
                    <FiSearch className="w-4 h-4" />
                    {isFetching ? 'Loading…' : 'Search'}
                  </button>
                </div>

              </div>
            </div>
          </section>

          {/* ── Summary Cards ───────────────────────────────────────────── */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Avg Utilization',  value: `${summary.avgUtil}%`  },
                { label: 'Total Moves',       value: summary.totalMoves     },
                { label: 'Avg Work Hours',    value: `${summary.avgWork}h`  },
                { label: 'Avg Hourly Moves',  value: summary.avgHourly      },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
                  <p className="text-3xl font-bold text-slate-800 mt-2">{value}</p>
                </div>
              ))}
            </div>
          )}


          {/* ── Table ───────────────────────────────────────────────────── */}
          <section className="bg-white rounded-t-lg shadow-xl border border-slate-300">
            <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-3 flex items-center justify-between gap-4">
              <h2 className="text-white font-bold text-base tracking-wide uppercase">
                Machine Utilization Report
                {filteredData.length > 0 && (
                  <span className="ml-2 text-xs font-normal opacity-70">({filteredData.length} records)</span>
                )}
              </h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/50" />
                  <input
                    type="text"
                    placeholder="Search…"
                    value={globalSearch}
                    onChange={e => { setGlobalSearch(e.target.value); setCurrentPage(1) }}
                    className="pl-8 pr-3 py-1.5 rounded-md bg-white/15 border border-white/30 text-white placeholder-white/50 text-xs focus:outline-none focus:bg-white/25 w-36"
                  />
                </div>
                <button
                  onClick={handleExport}
                  disabled={filteredData.length === 0}
                  className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors disabled:opacity-40"
                  title="Export to Excel"
                >
                  <FaFileExcel className="text-lg" />
                </button>
              </div>
            </div>

            <div className="border-t border-slate-200">
              <table className="w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61]">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-white tracking-wider border-r border-white/20 w-10">#</th>
                    {COLS.map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className="px-4 py-3 text-left font-bold text-white tracking-wider border-r border-white/20 cursor-pointer hover:bg-white/10 select-none transition-colors last:border-r-0"
                      >
                        {col.label} <SortIcon col={col.key} />
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-slate-200">
                  {isFetching ? (
                    <tr>
                      <td colSpan={COLS.length + 1} className="px-6 py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center gap-3">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0e4a78]" />
                          <p className="text-sm font-medium">Loading utilization data…</p>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={COLS.length + 1} className="px-6 py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center gap-2">
                          <FiFilter className="text-4xl text-slate-300" />
                          <p className="font-medium text-sm">No records found</p>
                          <p className="text-xs text-slate-400">Select dates and click Search to load data</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((row, idx) => {
                      const serial = (currentPage - 1) * pageSize + idx + 1
                      return (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50 transition-colors odd:bg-white even:bg-slate-50/50"
                        >
                          <td className="px-4 py-2.5 text-slate-500 border-r border-slate-100 text-center">{serial}</td>
                          <td className="px-4 py-2.5 text-slate-800 font-semibold border-r border-slate-100">{row.equipmentNo}</td>
                          <td className="px-4 py-2.5 text-slate-700 font-mono border-r border-slate-100">{row.breakdownTime}</td>
                          <td className="px-4 py-2.5 text-slate-700 font-mono border-r border-slate-100">{row.idleTime}</td>
                          <td className="px-4 py-2.5 text-slate-700 font-mono border-r border-slate-100">{row.workTime}</td>
                          <td className="px-4 py-2.5 text-slate-700 border-r border-slate-100 text-right">{row.totalMoves}</td>
                          {/* Hidden per request — Laden/Empty/20ft/40ft counts (kept for easy restore)
                          <td className="px-4 py-2.5 text-right border-r border-slate-100">
                            <span className="text-emerald-700 font-bold tabular-nums">{countMap.get(row.equipmentNo)?.laden ?? '—'}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right border-r border-slate-100">
                            <span className="text-amber-600 font-bold tabular-nums">{countMap.get(row.equipmentNo)?.empty ?? '—'}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right border-r border-slate-100">
                            <span className="text-blue-700 font-bold tabular-nums">{countMap.get(row.equipmentNo)?.size20 ?? '—'}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right border-r border-slate-100">
                            <span className="text-purple-700 font-bold tabular-nums">{countMap.get(row.equipmentNo)?.size40 ?? '—'}</span>
                          </td>
                          */}
                          <td className="px-4 py-2.5 text-slate-700 border-r border-slate-100 text-right">{row.workingHours}</td>
                          <td className="px-4 py-2.5 text-slate-700 border-r border-slate-100 text-right">{row.hourlyMoves}</td>
                          <td className="px-4 py-2.5 text-slate-700 border-r border-slate-100 text-right">{row.expectedHrs}</td>
                          <td className="px-4 py-2.5 text-right border-r border-slate-100">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                <div
                                  className="h-full rounded-full bg-[#0e4a78] transition-all duration-500"
                                  style={{ width: `${Math.min(row.utilization, 100)}%` }}
                                />
                              </div>
                              <span className="text-slate-800 font-semibold tabular-nums w-14 text-right">
                                {row.utilization.toFixed(2)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right border-r border-slate-100">
                            <span className="text-emerald-700 font-semibold tabular-nums">
                              {row.carbonMove.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="text-emerald-700 font-semibold tabular-nums">
                              {row.carbonHr.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>

                {filteredData.length > 0 && !isFetching && (
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                    <tr>
                      <td className="px-4 py-2.5 text-slate-500 font-bold text-xs uppercase border-r border-slate-200 text-center">Total</td>
                      <td className="px-4 py-2.5 text-slate-700 font-bold border-r border-slate-200">All Machines</td>
                      <td colSpan={3} className="border-r border-slate-200" />
                      <td className="px-4 py-2.5 text-slate-800 font-bold border-r border-slate-200 text-right">
                        {filteredData.reduce((s, r) => s + r.totalMoves, 0)}
                      </td>
                      {/* Hidden per request — Laden/Empty/20ft/40ft totals (kept for easy restore)
                      <td className="px-4 py-2.5 text-right border-r border-slate-200">
                        <span className="text-emerald-700 font-bold tabular-nums">{countTotals.laden}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right border-r border-slate-200">
                        <span className="text-amber-600 font-bold tabular-nums">{countTotals.empty}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right border-r border-slate-200">
                        <span className="text-blue-700 font-bold tabular-nums">{countTotals.size20}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right border-r border-slate-200">
                        <span className="text-purple-700 font-bold tabular-nums">{countTotals.size40}</span>
                      </td>
                      */}
                      <td className="px-4 py-2.5 text-slate-800 font-bold border-r border-slate-200 text-right">
                        {filteredData.reduce((s, r) => s + r.workingHours, 0).toFixed(1)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-800 font-bold border-r border-slate-200 text-right">
                        {filteredData.reduce((s, r) => s + r.hourlyMoves, 0).toFixed(1)}
                      </td>
                      <td className="border-r border-slate-200" />
                      <td className="px-4 py-2.5 border-r border-slate-200">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-300 overflow-hidden shrink-0">
                            <div className="h-full rounded-full bg-[#0e4a78]" style={{ width: `${Math.min(avgUtil, 100)}%` }} />
                          </div>
                          <span className="text-slate-800 font-bold tabular-nums w-14 text-right">
                            {filteredData.reduce((s, r) => s + r.utilization, 0).toFixed(2)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right border-r border-slate-200">
                        <span className="text-emerald-700 font-bold tabular-nums">
                          {filteredData.reduce((s, r) => s + r.carbonMove, 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-emerald-700 font-bold tabular-nums">
                          {filteredData.reduce((s, r) => s + r.carbonHr, 0).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50">
                <span className="text-xs text-slate-500">
                  Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="px-3 py-1 rounded border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40">
                    Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const page = Math.max(1, Math.min(currentPage - 2 + i, totalPages - 4 + i))
                    return (
                      <button key={page} onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded border text-xs font-bold transition-colors
                          ${currentPage === page ? 'bg-[#0e4a78] text-white border-[#0e4a78]' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
                        {page}
                      </button>
                    )
                  })}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40">
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Record count footer */}
            {!isFetching && (
              <div className="px-6 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
                <span>Total: <strong className="text-slate-700">{filteredData.length}</strong> machine(s)</span>
                <span>
                  Date range: <strong className="text-slate-700">{fromDate}</strong> → <strong className="text-slate-700">{toDate}</strong>
                </span>
              </div>
            )}
          </section>

        </main>
        <Footer />
      </div>
    </div>
  )
}

export default DailyEquipmentUtilization
