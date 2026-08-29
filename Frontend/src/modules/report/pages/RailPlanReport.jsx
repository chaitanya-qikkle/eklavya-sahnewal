import React, { useState, useMemo, useEffect } from 'react'
import { FiSearch, FiRefreshCw, FiX, FiArrowRight, FiCalendar, FiActivity } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { useLazyGetRailPlanNameListQuery, useLazyGetRailPlanDetailQuery } from '../../../store/api/ymsApi'

const today = new Date().toISOString().split('T')[0]
const fromDefault = new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0]

const fmtDate = (val) => {
  if (!val) return '—'
  const d = new Date(String(val).replace(' ', 'T'))
  if (isNaN(d)) return String(val)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const DETAIL_COLUMNS = [
  { key: 'ContainerNo',            label: 'Container No' },
  { key: 'ContainerSize',          label: 'Size' },
  { key: 'ContainerLocationName',  label: 'Location' },
  { key: 'Process',                label: 'Process' },
  { key: 'TrailerNo',              label: 'Trailer No' },
  { key: 'JobCompletionDate',      label: 'Completed', format: (v) => v ? fmtDate(v) : 'Pending' },
]

const RailPlanReport = () => {
  const [fetchPlans, { data: planData, isFetching: isPlansFetching, isError: isPlansError }] = useLazyGetRailPlanNameListQuery()
  const [fetchDetail, { data: detailData, isFetching: isDetailFetching }] = useLazyGetRailPlanDetailQuery()

  const [fromDate, setFromDate] = useState(fromDefault)
  const [toDate, setToDate] = useState(today)
  const [searchLeft, setSearchLeft] = useState('')
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [hasQueried, setHasQueried] = useState(false)

  useEffect(() => {
    setHasQueried(true)
    fetchPlans({ report_type: 'MONTH', from_date: fromDefault, to_date: today })
  }, []) // eslint-disable-line

  const plans = Array.isArray(planData?.data) ? planData.data : []
  const detailRows = Array.isArray(detailData?.data) ? detailData.data : []

  const handleSearch = () => {
    setHasQueried(true)
    setSelectedDoc(null)
    fetchPlans({ report_type: 'MONTH', from_date: fromDate, to_date: toDate })
  }

  const handleClear = () => {
    setFromDate(fromDefault)
    setToDate(today)
    setSearchLeft('')
    setSelectedDoc(null)
    setHasQueried(true)
    fetchPlans({ report_type: 'MONTH', from_date: fromDefault, to_date: today })
  }

  const filteredPlans = useMemo(() => {
    if (!searchLeft.trim()) return plans
    const q = searchLeft.trim().toLowerCase()
    return plans.filter((p) => String(p.RailPlanName ?? '').toLowerCase().includes(q))
  }, [plans, searchLeft])

  const handleSelectPlan = (plan) => {
    setSelectedDoc(plan.RailPlanName)
    fetchDetail({ rail_plan_name: plan.RailPlanName, is_job_allotted: 1 })
  }

  const handleExportLeft = () => {
    if (!filteredPlans.length) return
    const ws = XLSX.utils.json_to_sheet(filteredPlans.map((p) => ({
      'Rail Plan Name': p.RailPlanName,
      'Rail Plan Date': fmtDate(p.RailPlanDate),
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'RailPlans')
    XLSX.writeFile(wb, `RailPlanNameList_${today}.xlsx`)
  }

  const handleExportRight = () => {
    if (!detailRows.length) return
    const ws = XLSX.utils.json_to_sheet(detailRows.map((r) => {
      const out = {}
      DETAIL_COLUMNS.forEach(({ key, label, format }) => { out[label] = format ? format(r[key]) : (r[key] ?? '') })
      return out
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'PlanDetail')
    XLSX.writeFile(wb, `RailPlanDetail_${selectedDoc || today}.xlsx`)
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
                <FiActivity className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#0e4a78]">Rail Plan Report</h1>
                <p className="text-slate-500 text-sm">Rail plan names with job counts — select a plan to view containers</p>
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
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">From Date</label>
                    <div className="relative">
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full sm:w-56 pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">To Date</label>
                    <div className="relative">
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full sm:w-56 pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm transition-colors"
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
                      disabled={isPlansFetching}
                      className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-[#0e4a78] text-white text-sm font-bold hover:bg-[#0a3b61] transition-colors shadow-md disabled:opacity-60 uppercase tracking-wide"
                    >
                      {isPlansFetching
                        ? <FiRefreshCw className="animate-spin text-base" />
                        : <FiSearch className="text-base" />
                      }
                      {isPlansFetching ? 'Loading…' : 'Search'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Split View */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

              {/* Left Panel: Rail Plan Names */}
              <div className="xl:col-span-5 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full min-h-[500px]">
                <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-white font-bold text-base tracking-wide uppercase">Rail Plan Names</h2>
                    <p className="text-white/60 text-xs mt-0.5">{filteredPlans.length.toLocaleString()} plans</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={searchLeft}
                        onChange={(e) => setSearchLeft(e.target.value)}
                        placeholder="Search…"
                        className="pl-8 pr-3 py-2 rounded-lg border border-white/30 bg-white/10 text-white placeholder-white/50 text-sm focus:outline-none focus:ring-1 focus:ring-white/50 w-36 transition-colors"
                      />
                      <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60 text-sm pointer-events-none" />
                      {searchLeft && (
                        <button onClick={() => setSearchLeft('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white">
                          <FiX className="text-xs" />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={handleExportLeft}
                      disabled={!filteredPlans.length}
                      title="Export to Excel"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 shadow"
                    >
                      <FaFileExcel />
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto flex-1">
                  {isPlansError ? (
                    <div className="px-6 py-10 text-center text-red-500 font-semibold text-sm">Failed to load data.</div>
                  ) : isPlansFetching ? (
                    <div className="px-6 py-10 flex flex-col items-center gap-3 text-slate-400">
                      <div className="w-8 h-8 border-2 border-slate-200 border-t-[#0e4a78] rounded-full animate-spin" />
                      <p className="text-sm font-medium">Loading rail plans…</p>
                    </div>
                  ) : !hasQueried ? (
                    <div className="px-6 py-14 text-center text-slate-400 text-sm">
                      Select a date range and click <strong className="text-slate-600">Search</strong>.
                    </div>
                  ) : filteredPlans.length === 0 ? (
                    <div className="px-6 py-10 text-center text-slate-400 text-sm">No rail plans found.</div>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Rail Plan Name</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Rail Plan Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPlans.map((row, idx) => (
                          <tr
                            key={idx}
                            onClick={() => handleSelectPlan(row)}
                            className={`cursor-pointer transition-colors ${
                              selectedDoc === row.RailPlanName ? 'bg-blue-50 border-l-4 border-l-[#0e4a78]' : idx % 2 === 0 ? 'bg-white hover:bg-blue-50/50' : 'bg-slate-50/50 hover:bg-blue-50/50'
                            }`}
                          >
                            <td className="px-4 py-3 font-semibold text-[#0e4a78] whitespace-nowrap">{row.RailPlanName}</td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(row.RailPlanDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Right Panel: Plan Detail */}
              <div className="xl:col-span-7 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full min-h-[500px]">
                <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-white font-bold text-base tracking-wide uppercase">
                      {selectedDoc ? `Detail — ${selectedDoc}` : 'Plan Detail'}
                    </h2>
                    {selectedDoc && <p className="text-white/60 text-xs mt-0.5">{detailRows.length.toLocaleString()} containers</p>}
                  </div>
                  {selectedDoc && (
                    <button
                      onClick={handleExportRight}
                      disabled={!detailRows.length}
                      title="Export to Excel"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 shadow"
                    >
                      <FaFileExcel />
                    </button>
                  )}
                </div>

                {!selectedDoc ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                      <FiArrowRight className="text-2xl text-slate-300" />
                    </div>
                    <p className="text-lg font-medium text-slate-500">Select a Rail Plan</p>
                    <p className="text-sm">Click any row in the left panel to view its containers</p>
                  </div>
                ) : isDetailFetching ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
                    <div className="w-10 h-10 border-2 border-slate-200 border-t-[#0e4a78] rounded-full animate-spin" />
                    <p className="text-sm font-medium">Loading containers…</p>
                  </div>
                ) : detailRows.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">No containers found for this plan.</div>
                ) : (
                  <div className="overflow-x-auto flex-1">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          {DETAIL_COLUMNS.map((col) => (
                            <th key={col.key} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailRows.map((row, idx) => (
                          <tr key={idx} className={`transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/50`}>
                            {DETAIL_COLUMNS.map((col) => {
                              const raw = row[col.key]
                              const display = col.format ? col.format(raw) : (raw != null && raw !== '' ? raw : <span className="text-slate-300">—</span>)
                              return (
                                <td key={col.key} className={`px-4 py-3 whitespace-nowrap ${col.key === 'ContainerNo' ? 'text-slate-800 font-semibold' : 'text-slate-600'}`}>
                                  {display}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default RailPlanReport
