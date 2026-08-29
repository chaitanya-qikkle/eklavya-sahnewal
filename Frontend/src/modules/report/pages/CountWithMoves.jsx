import React, { useState, useMemo } from 'react'
import { FiSearch, FiRefreshCw, FiX, FiLayers, FiChevronUp, FiChevronDown } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, LabelList } from 'recharts'
import * as XLSX from 'xlsx'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { useGetCountWithMovesQuery } from '../../../store/api/ymsApi'

const fmtDate = (val) => {
  if (!val) return '—'
  const d = new Date(String(val).replace(' ', 'T'))
  if (isNaN(d)) return String(val)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`
}

const COLUMNS = [
  { key: 'ContNo',        label: 'Container No' },
  { key: 'Gate_IN',       label: 'Gate In Date', format: fmtDate },
  { key: 'LastShiftDate', label: 'Last Shift Date', format: fmtDate },
  { key: 'cnt',           label: 'Moves' },
]

const BUCKETS = [
  { label: '>=01 & <03', test: (n) => n >= 1  && n < 3  },
  { label: '>=03 & <05', test: (n) => n >= 3  && n < 5  },
  { label: '>=05 & <10', test: (n) => n >= 5  && n < 10 },
  { label: '>=10 & <25', test: (n) => n >= 10 && n < 25 },
  { label: '>=25',       test: (n) => n >= 25            },
]

const CountWithMoves = () => {
  const { data, isFetching, isError, refetch } = useGetCountWithMovesQuery()
  const [search, setSearch] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'cnt', direction: 'desc' })

  const rows = Array.isArray(data?.data) ? data.data : []

  const filteredRows = useMemo(() => {
    let out = rows
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      out = out.filter((r) =>
        COLUMNS.some(({ key }) => String(r[key] ?? '').toLowerCase().includes(q))
      )
    }
    if (sortConfig.key) {
      out = [...out].sort((a, b) => {
        const av = a[sortConfig.key], bv = b[sortConfig.key]
        if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1
        if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return out
  }, [rows, search, sortConfig])

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const chartData = useMemo(() => {
    return BUCKETS.map((b) => ({
      name: b.label,
      count: rows.filter((r) => b.test(Number(r.cnt) || 0)).length,
    }))
  }, [rows])

  const avgMoves = useMemo(() => {
    if (!rows.length) return 0
    const total = rows.reduce((s, r) => s + (Number(r.cnt) || 0), 0)
    return total / rows.length
  }, [rows])

  const handleExport = () => {
    if (!filteredRows.length) return
    const exportRows = filteredRows.map((r) => {
      const out = {}
      COLUMNS.forEach(({ key, label, format }) => {
        out[label] = format ? format(r[key]) : (r[key] ?? '')
      })
      return out
    })
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'CountWithMoves')
    XLSX.writeFile(wb, `CountWithMoves_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const SortIcon = ({ colKey }) => (
    <span className="inline-flex flex-col ml-1">
      <FiChevronUp   className={`w-2.5 h-2.5 -mb-0.5 ${sortConfig.key === colKey && sortConfig.direction === 'asc'  ? 'text-white' : 'text-white/40'}`} />
      <FiChevronDown className={`w-2.5 h-2.5 -mt-0.5 ${sortConfig.key === colKey && sortConfig.direction === 'desc' ? 'text-white' : 'text-white/40'}`} />
    </span>
  )

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
                <FiLayers className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#0e4a78]">Count With Moves</h1>
                <p className="text-slate-500 text-sm">In-yard containers ranked by number of moves</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">

              {/* Table Card */}
              <div className="xl:col-span-2 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="text-white font-bold text-base tracking-wide">Cont Count With Moves</h2>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search…"
                        className="pl-8 pr-3 py-1.5 rounded-lg border border-white/30 bg-white/10 text-white placeholder-white/50 text-xs focus:outline-none focus:ring-1 focus:ring-white/50 w-32 transition-colors"
                      />
                      <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60 text-xs pointer-events-none" />
                      {search && (
                        <button
                          onClick={() => setSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                        >
                          <FiX className="text-xs" />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => refetch()}
                      title="Refresh"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors border border-white/30"
                    >
                      <FiRefreshCw className={isFetching ? 'animate-spin' : ''} size={12} />
                    </button>
                    <button
                      onClick={handleExport}
                      disabled={!filteredRows.length}
                      title="Export to Excel"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-40 shadow"
                    >
                      <FaFileExcel size={12} />
                    </button>
                  </div>
                </div>

                <div className="overflow-auto max-h-[480px] custom-scrollbar">
                  {isError ? (
                    <div className="px-6 py-10 text-center">
                      <div className="text-red-500 font-semibold text-sm">Failed to load data.</div>
                    </div>
                  ) : isFetching ? (
                    <div className="px-6 py-10 flex flex-col items-center gap-3 text-slate-400">
                      <div className="w-8 h-8 border-2 border-slate-200 border-t-[#0e4a78] rounded-full animate-spin" />
                      <p className="text-sm font-medium">Loading…</p>
                    </div>
                  ) : filteredRows.length === 0 ? (
                    <div className="px-6 py-10 text-center text-slate-400 text-sm">
                      No records found.
                    </div>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                          {COLUMNS.map((col) => (
                            <th
                              key={col.key}
                              onClick={() => handleSort(col.key)}
                              className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-white/10 select-none border-r border-white/20 last:border-r-0"
                            >
                              <div className="flex items-center">
                                {col.label}
                                <SortIcon colKey={col.key} />
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredRows.map((row, index) => (
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
                                  className={`px-3 py-2 whitespace-nowrap ${
                                    col.key === 'ContNo'
                                      ? 'text-slate-800 font-semibold'
                                      : col.key === 'cnt'
                                      ? 'text-[#0e4a78] font-bold'
                                      : 'text-slate-600'
                                  }`}
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
                  <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
                    <span>Showing <strong className="text-slate-700">{filteredRows.length}</strong> of{' '}
                      <strong className="text-slate-700">{rows.length}</strong> records</span>
                  </div>
                )}
              </div>

              {/* Chart Card */}
              <div className="xl:col-span-3 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4">
                  <h2 className="text-white font-bold text-base tracking-wide">Container Count – Average Moves</h2>
                </div>

                <div className="p-6 flex flex-col lg:flex-row items-stretch gap-6">
                  <div className="flex-1 h-[340px]">
                    {isFetching ? (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">Loading…</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 24, right: 16, left: 0, bottom: 24 }} barSize={56}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: '#475569' }}
                            label={{ value: 'Moves Per Container', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#6366f1' }}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#475569' }}
                            label={{ value: 'No. Of Containers', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#0e4a78' }}
                          />
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: 8, border: '1px solid #e2e8f0' }}
                            cursor={{ fill: 'rgba(14,74,120,0.08)' }}
                          />
                          <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} name="No. Of Containers">
                            <LabelList dataKey="count" position="top" style={{ fontWeight: 700, fill: '#1e293b', fontSize: 13 }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div className="lg:w-52 shrink-0 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 shadow-lg flex flex-col items-center justify-center text-white py-8">
                    <p className="text-4xl font-black leading-none">{avgMoves.toFixed(1)}</p>
                    <p className="text-xs font-semibold uppercase tracking-wider mt-3 text-center px-4">Avg Moves / Container</p>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default CountWithMoves
