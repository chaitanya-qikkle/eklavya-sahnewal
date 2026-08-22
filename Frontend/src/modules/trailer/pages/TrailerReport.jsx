import React, { useState, useMemo, useEffect } from 'react'
import { FiSearch, FiChevronUp, FiChevronDown, FiCalendar, FiFilter, FiRefreshCw } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { API_ENDPOINTS } from '../../../config/api'

const formatDate = (raw) => {
  if (!raw) return '—'
  try {
    const d = new Date(String(raw).replace(' ', 'T'))
    if (isNaN(d)) return String(raw)
    const p = (n) => String(n).padStart(2, '0')
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
  } catch { return raw }
}

const ActivityBadge = ({ val }) => {
  if (!val) return <span className="text-slate-300 text-xs">—</span>
  const upper = String(val).toUpperCase()
  const cls = upper === 'PICKUP'
    ? 'bg-amber-100 text-amber-700'
    : upper === 'OFFLOAD'
    ? 'bg-blue-100 text-blue-700'
    : 'bg-slate-100 text-slate-600'
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{val}</span>
}

const COLS = [
  { key: 'TrailerNo',     label: 'Trailer No'     },
  { key: 'ContainerNo',   label: 'Container No'   },
  { key: 'ContainerType', label: 'Type'           },
  { key: 'ContainerSize', label: 'Size'           },
  { key: 'ProcessName',   label: 'Process'        },
  { key: 'ActivityName',  label: 'Activity'       },
  { key: 'GateInDate',    label: 'Gate In Date'   },
  { key: 'GateOutDate',   label: 'Gate Out Date'  },
  { key: 'TAT',           label: 'TAT'            },
]

const TrailerReport = () => {
  const today = new Date().toISOString().split('T')[0]

  const [trailerNo,   setTrailerNo]   = useState('')
  const [fromDate,    setFromDate]    = useState(today)
  const [toDate,      setToDate]      = useState(today)
  const [records,     setRecords]     = useState([])
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [fetched,     setFetched]     = useState(false)
  const [sortConfig,  setSortConfig]  = useState({ key: null, dir: null })
  const [globalSearch, setGlobalSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 15

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (trailerNo.trim()) params.set('trailer_no', trailerNo.trim())
      if (fromDate) params.set('from_date', fromDate)
      if (toDate)   params.set('to_date',   toDate)

      const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken') || ''
      const res = await fetch(`${API_ENDPOINTS.REPORTS.TRAILER_REPORT}?${params.toString()}`, {
        headers: {
          'Content-Type':  'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
      })
      const json = await res.json()
      if (!res.ok || json.status !== 'success') {
        setError(json.message || `Server error (${res.status})`)
        setRecords([])
      } else {
        setRecords(json.data || [])
      }
      setFetched(true)
    } catch (err) {
      setError(`Unable to fetch data: ${err.message}`)
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setTrailerNo('')
    setFromDate(today)
    setToDate(today)
    setRecords([])
    setFetched(false)
    setError(null)
    setGlobalSearch('')
    setSortConfig({ key: null, dir: null })
    setCurrentPage(1)
  }

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return { key: null, dir: null }
    })
  }

  const filteredRecords = useMemo(() => {
    let data = records.filter(row => {
      if (!globalSearch) return true
      const q = globalSearch.toLowerCase()
      return Object.values(row).some(v => String(v || '').toLowerCase().includes(q))
    })
    if (!sortConfig.key || !sortConfig.dir) return data
    return [...data].sort((a, b) => {
      const av = a[sortConfig.key] ?? ''
      const bv = b[sortConfig.key] ?? ''
      if (sortConfig.key.includes('Date')) {
        const ad = av ? new Date(String(av).replace(' ', 'T')).getTime() : 0
        const bd = bv ? new Date(String(bv).replace(' ', 'T')).getTime() : 0
        return sortConfig.dir === 'asc' ? ad - bd : bd - ad
      }
      return sortConfig.dir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
  }, [records, globalSearch, sortConfig])

  const totalPages   = Math.ceil(filteredRecords.length / pageSize)
  const paginatedData = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleExport = () => {
    if (!filteredRecords.length) return
    const rows = filteredRecords.map((r, i) => ({
      '#':             i + 1,
      'Trailer No':    r.TrailerNo    || '',
      'Container No':  r.ContainerNo  || '',
      'Type':          r.ContainerType || '',
      'Size':          r.ContainerSize || '',
      'Process':       r.ProcessName   || '',
      'Activity':      r.ActivityName  || '',
      'Gate In Date':  formatDate(r.GateInDate),
      'Gate Out Date': formatDate(r.GateOutDate),
      'TAT':           r.TAT           || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Trailer Report')
    XLSX.writeFile(wb, `TrailerReport_${fromDate}_${toDate}.xlsx`)
  }

  const SortIcon = ({ colKey }) => (
    <span className="inline-flex flex-col ml-1">
      <FiChevronUp   className={`w-3 h-3 ${sortConfig.key === colKey && sortConfig.dir === 'asc'  ? 'text-white' : 'text-white/30'}`} />
      <FiChevronDown className={`w-3 h-3 -mt-1 ${sortConfig.key === colKey && sortConfig.dir === 'desc' ? 'text-white' : 'text-white/30'}`} />
    </span>
  )

  return (
    <div
      className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px]" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 space-y-5">

          {/* Filter card */}
          <section className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-5 py-3">
              <h2 className="text-white font-bold text-base tracking-wide uppercase flex items-center gap-2">
                <FiFilter className="text-blue-200" /> Trailer Report
              </h2>
            </div>
            <div className="p-5 bg-slate-50">
              <div className="flex flex-wrap items-end gap-4">

                <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <FiSearch size={10} /> Trailer No
                  </label>
                  <input
                    type="text"
                    placeholder="Search trailer…"
                    value={trailerNo}
                    onChange={e => setTrailerNo(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && fetchData()}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <FiCalendar size={10} /> From Date
                  </label>
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78]" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <FiCalendar size={10} /> To Date
                  </label>
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78]" />
                </div>

                <div className="flex gap-2">
                  <button onClick={handleClear}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-100 transition-all">
                    Clear
                  </button>
                  <button onClick={fetchData} disabled={loading}
                    className="flex items-center gap-2 bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-5 py-2 rounded-lg text-sm font-bold shadow hover:from-[#0b3e66] hover:to-[#072c4a] transition-all disabled:opacity-60">
                    <FiRefreshCw className={loading ? 'animate-spin' : ''} size={13} />
                    {loading ? 'Loading…' : 'Search'}
                  </button>
                </div>

              </div>
            </div>
          </section>

          {/* Table card */}
          <section className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-5 py-3 flex items-center justify-between gap-3">
              <h2 className="text-white font-bold text-base tracking-wide uppercase">
                Trailer Report Detail
                {fetched && <span className="ml-2 text-blue-200 font-normal text-sm">— {records.length} record(s)</span>}
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-white/70 text-xs font-medium">Search:</span>
                  <input
                    type="text"
                    value={globalSearch}
                    onChange={e => { setGlobalSearch(e.target.value); setCurrentPage(1) }}
                    className="px-3 py-1 rounded-lg border border-white/30 bg-white/10 text-white placeholder-white/50 text-xs focus:outline-none focus:bg-white/20 w-36"
                    placeholder="Filter rows…"
                  />
                </div>
                <button onClick={handleExport} disabled={!filteredRecords.length}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40">
                  <FaFileExcel /> Export Excel
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white text-[11px] uppercase tracking-wider">
                    <th className="px-3 py-3 text-left font-bold border-r border-white/20 w-10">#</th>
                    {COLS.map(({ key, label }) => (
                      <th
                        key={key}
                        onClick={() => handleSort(key)}
                        className="px-3 py-3 text-left font-bold border-r border-white/20 last:border-r-0 cursor-pointer hover:bg-white/10 select-none whitespace-nowrap"
                      >
                        <div className="flex items-center gap-1">{label}<SortIcon colKey={key} /></div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={COLS.length + 1} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-[#0e4a78] border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm">Loading data…</p>
                      </div>
                    </td></tr>
                  ) : error ? (
                    <tr><td colSpan={COLS.length + 1} className="py-10 text-center">
                      <p className="text-red-600 font-semibold text-sm">⚠ {error}</p>
                    </td></tr>
                  ) : paginatedData.length > 0 ? (
                    paginatedData.map((row, i) => (
                      <tr key={i} className={`hover:bg-blue-50/40 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <td className="px-3 py-2.5 text-slate-400 text-xs border-r border-slate-100 text-center">
                          {(currentPage - 1) * pageSize + i + 1}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-[#0e4a78] border-r border-slate-100 whitespace-nowrap">{row.TrailerNo || '—'}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-700 border-r border-slate-100 whitespace-nowrap">{row.ContainerNo || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100">{row.ContainerType || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100">{row.ContainerSize || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100">{row.ProcessName || '—'}</td>
                        <td className="px-3 py-2.5 border-r border-slate-100"><ActivityBadge val={row.ActivityName} /></td>
                        <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100 whitespace-nowrap">{formatDate(row.GateInDate)}</td>
                        <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100 whitespace-nowrap">{formatDate(row.GateOutDate)}</td>
                        <td className="px-3 py-2.5 text-amber-600 font-semibold whitespace-nowrap">{row.TAT || '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={COLS.length + 1} className="py-12 text-center text-slate-400">
                      <FiFilter className="mx-auto text-3xl text-slate-300 mb-2" />
                      <p className="font-medium text-sm">
                        {fetched
                          ? (records.length > 0 ? 'No records match filter' : 'No records found')
                          : 'Set filters and click Search'}
                      </p>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {filteredRecords.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-3">
                <span>
                  Showing <strong className="text-[#0e4a78]">{Math.min((currentPage - 1) * pageSize + 1, filteredRecords.length)}</strong> to{' '}
                  <strong className="text-[#0e4a78]">{Math.min(currentPage * pageSize, filteredRecords.length)}</strong> of{' '}
                  <strong className="text-[#0e4a78]">{filteredRecords.length}</strong> record(s)
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-[#0e4a78] font-semibold transition-all text-xs">
                    Previous
                  </button>
                  <span className="px-3 py-1.5 rounded-lg border bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white text-xs font-bold">
                    Page {currentPage} of {totalPages || 1}
                  </span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-[#0e4a78] font-semibold transition-all text-xs">
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

export default TrailerReport
