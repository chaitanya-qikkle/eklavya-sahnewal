import React, { useState, useMemo, useEffect } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FiFilter, FiCalendar, FiSearch, FiRefreshCw, FiChevronUp, FiChevronDown, FiPackage, FiUpload, FiDownload, FiHome } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import { API_ENDPOINTS } from '../../../config/api'

const TONE_MAP = {
  slate:   { accent: "#0e4a78", iconColor: "text-[#0e4a78]",   iconBg: "bg-[#0e4a78]/10", valueColor: "text-[#0e4a78]",   badgeBg: "bg-[#0e4a78]/8",  activeBg: "bg-[#0e4a78]"   },
  emerald: { accent: "#059669", iconColor: "text-emerald-600", iconBg: "bg-emerald-50",    valueColor: "text-emerald-700", badgeBg: "bg-emerald-50",   activeBg: "bg-emerald-600" },
  amber:   { accent: "#d97706", iconColor: "text-amber-600",   iconBg: "bg-amber-50",      valueColor: "text-amber-700",   badgeBg: "bg-amber-50",     activeBg: "bg-amber-500"   },
  violet:  { accent: "#7c3aed", iconColor: "text-violet-600",  iconBg: "bg-violet-50",     valueColor: "text-violet-700",  badgeBg: "bg-violet-50",    activeBg: "bg-violet-600"  },
  rose:    { accent: "#e11d48", iconColor: "text-rose-600",    iconBg: "bg-rose-50",       valueColor: "text-rose-700",    badgeBg: "bg-rose-50",      activeBg: "bg-rose-600"    },
}

const StatTile = ({ label, value, icon: Icon, tone = "slate", isActive, onClick, total }) => {
  const t = TONE_MAP[tone] || TONE_MAP.slate
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative text-left transition-all duration-150 overflow-hidden border-r border-slate-200 last:border-r-0
        ${isActive ? "bg-slate-50" : "bg-white hover:bg-slate-50/70"}`}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px] transition-all duration-150" style={{ background: isActive ? t.accent : "transparent" }} />
      <div className="pl-4 pr-4 py-3.5 flex items-center gap-3.5">
        <span className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg ${isActive ? `${t.activeBg} text-white` : `${t.iconBg} ${t.iconColor}`} transition-all duration-150`}>
          {Icon && <Icon className="text-[15px]" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400 leading-tight mb-1.5">{label}</p>
          <p className={`text-2xl font-black leading-none tracking-tight transition-colors ${isActive ? t.valueColor : "text-slate-700"}`}>{value}</p>
        </div>
        {total > 0 && tone !== "slate" && (
          <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${t.badgeBg} transition-colors`} style={{ color: t.accent }}>{pct}%</span>
        )}
      </div>
      <div className="h-[2px] bg-slate-100">
        {total > 0 && tone !== "slate" && (
          <div className="h-full transition-all duration-700 rounded-full" style={{ width: `${pct}%`, background: t.accent }} />
        )}
      </div>
    </button>
  )
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

const formatDate = (raw) => {
  if (!raw) return '—'
  try {
    const d = new Date(String(raw).replace(' ', 'T'))
    if (isNaN(d)) return String(raw)
    const p = (n) => String(n).padStart(2, '0')
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
  } catch { return raw }
}

const StatusBadge = ({ val }) => {
  if (!val) return <span className="text-slate-300 text-xs">—</span>
  const upper = String(val).toUpperCase()
  const cls = upper.includes('EMPTY')
    ? 'bg-slate-100 text-slate-600'
    : upper.includes('LADEN') || upper.includes('IMPORT') || upper.includes('EXPORT')
    ? 'bg-blue-100 text-blue-700'
    : 'bg-green-100 text-green-700'
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{val}</span>
}

const GateInOutReport = () => {
  const [searchContainer, setSearchContainer] = useState('')
  const [dateFrom,        setDateFrom]        = useState(yesterdayLocalDT())
  const [dateTo,          setDateTo]          = useState(todayLocalDT())
  const [records,         setRecords]         = useState([])
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState(null)
  const [fetched,         setFetched]         = useState(false)
  const [sortConfig,      setSortConfig]      = useState({ key: null, dir: null })
  const [colFilters,      setColFilters]      = useState({
    ContainerNo: '', ContainerSize: '', ContainerType: '',
    Process: '', Mode: '', DocumentNo: '', ContainerStatus: '',
    GateInDate: '', GateOutDate: '', GateName: '',
    ContainerLocationName: '', TrailerNo: '',
  })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (searchContainer.trim()) params.set('container_no', searchContainer.trim())
      if (dateFrom) params.set('from_date', dateFrom)
      if (dateTo)   params.set('to_date',   dateTo)

      const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken') || ''
      const res = await fetch(`${API_ENDPOINTS.REPORTS.GATE_IN_OUT}?${params.toString()}`, {
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
    setSearchContainer('')
    setDateFrom(yesterdayLocalDT())
    setDateTo(todayLocalDT())
    setRecords([])
    setFetched(false)
    setError(null)
    setColFilters({ ContainerNo: '', ContainerSize: '', ContainerType: '', Process: '', Mode: '', DocumentNo: '', ContainerStatus: '', GateInDate: '', GateOutDate: '', GateName: '', ContainerLocationName: '', TrailerNo: '' })
    setSortConfig({ key: null, dir: null })
  }

  const handleExport = () => {
    if (!filteredRecords.length) return
    const rows = filteredRecords.map((r, i) => ({
      '#':                    i + 1,
      'Container No':         r.ContainerNo             || '',
      'Size':                 r.ContainerSize           || '',
      'Type':                 r.ContainerType           || '',
      'Process':              r.Process                 || '',
      'Document No':          r.DocumentNo              || '',
      'Booking No':           r.BookingNo               || '',
      'Shipping Line':        r.ShippingLine            || '',
      'Mode':                 r.Mode                    || '',
      'Status':               r.ContainerStatus         || '',
      'Gate Name':            r.GateName                || '',
      'Location':             r.ContainerLocationName   || '',
      'Trailer No':           r.TrailerNo               || '',
      'Gate In Date':         formatDate(r.GateInDate),
      'Gate Out Date':        formatDate(r.GateOutDate),
      'In TAT':               r.INTAT                   || '',
      'Out TAT':              r.OUTTAT                  || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Gate In Out Report')
    XLSX.writeFile(wb, `GateInOutReport_${dateFrom}_${dateTo}.xlsx`)
  }

  const setColFilter = (key, val) =>
    setColFilters(prev => ({ ...prev, [key]: val }))

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return { key: null, dir: null }
    })
  }

  const processStats = useMemo(() => {
    const total = records.length
    const exportCount = records.filter(r => String(r.Process || '').toUpperCase() === 'EXPORT').length
    const importCount = records.filter(r => String(r.Process || '').toUpperCase() === 'IMPORT').length
    const emptyCount = records.filter(r => String(r.Process || '').toUpperCase() === 'EMPTY').length
    const domesticCount = records.filter(r => String(r.Process || '').toUpperCase() === 'DOMESTIC').length
    return { total, exportCount, importCount, emptyCount, domesticCount }
  }, [records])

  const filteredRecords = useMemo(() => {
    const filtered = records.filter(row => {
      const match = (key) =>
        !colFilters[key] ||
        String(row[key] || '').toLowerCase().includes(colFilters[key].toLowerCase())
      return (
        match('ContainerNo') && match('ContainerSize') && match('ContainerType') &&
        match('Process') && match('DocumentNo') && match('ContainerStatus') &&
        match('GateName') && match('ContainerLocationName') && match('TrailerNo') &&
        (!colFilters.GateInDate  || formatDate(row.GateInDate).includes(colFilters.GateInDate))  &&
        (!colFilters.GateOutDate || formatDate(row.GateOutDate).includes(colFilters.GateOutDate))
      )
    })
    if (!sortConfig.key || !sortConfig.dir) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortConfig.key] ?? ''
      const bv = b[sortConfig.key] ?? ''
      if (sortConfig.key.includes('Date')) {
        const ad = av ? new Date(String(av).replace(' ', 'T')).getTime() : 0
        const bd = bv ? new Date(String(bv).replace(' ', 'T')).getTime() : 0
        return sortConfig.dir === 'asc' ? ad - bd : bd - ad
      }
      const as2 = String(av).toLowerCase()
      const bs2 = String(bv).toLowerCase()
      if (as2 < bs2) return sortConfig.dir === 'asc' ? -1 : 1
      if (as2 > bs2) return sortConfig.dir === 'asc' ? 1 : -1
      return 0
    })
  }, [records, colFilters, sortConfig])

  const COLS = [
    { key: 'ContainerNo',           label: 'Container No',  ph: 'Container…'  },
    { key: 'ContainerSize',         label: 'Size',          ph: 'Size…'        },
    { key: 'ContainerType',         label: 'Type',          ph: 'Type…'        },
    { key: 'Process',               label: 'Process',       ph: 'Process…'     },
    { key: 'Mode',                  label: 'Mode',          ph: 'Mode…'        },
    { key: 'BookingNo',             label: 'Booking No',    ph: 'Booking…'     },
    { key: 'ContainerLocationName', label: 'Location',      ph: 'Location…'    },
    { key: 'TrailerNo',             label: 'Trailer No',    ph: 'Trailer…'     },
    { key: 'GateInDate',            label: 'Gate In Date',  ph: 'dd/mm/yyyy…'  },
    { key: 'GateOutDate',           label: 'Gate Out Date', ph: 'dd/mm/yyyy…'  },
    { key: 'INTAT',                 label: 'In TAT',        ph: 'TAT…'         },
    { key: 'OUTTAT',                label: 'Out TAT',       ph: 'TAT…'         },
  ]

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

          {/* ── Filter card ── */}
          <section className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-5 py-3">
              <h2 className="text-white font-bold text-base tracking-wide uppercase flex items-center gap-2">
                <FiFilter className="text-blue-200" /> Gate In / Out Report
              </h2>
            </div>

            <div className="p-5 bg-slate-50">
              <div className="flex flex-wrap items-end gap-4">

                <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <FiSearch size={10} /> Container No
                  </label>
                  <input
                    type="text"
                    placeholder="Search container…"
                    value={searchContainer}
                    onChange={e => setSearchContainer(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && fetchData()}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <FiCalendar size={10} /> From Date
                  </label>
                  <input type="datetime-local" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78]" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <FiCalendar size={10} /> To Date
                  </label>
                  <input type="datetime-local" value={dateTo} onChange={e => setDateTo(e.target.value)}
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

          {/* ── Process filter pills ── */}
          <div className="grid grid-cols-5 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm w-full lg:w-[840px]">
            <StatTile
              label="Total Entries"
              value={processStats.total}
              icon={FiPackage}
              tone="slate"
              isActive={!colFilters.Process}
              onClick={() => setColFilter('Process', '')}
              total={processStats.total}
            />
            <StatTile
              label="Export"
              value={processStats.exportCount}
              icon={FiUpload}
              tone="amber"
              isActive={colFilters.Process.toUpperCase() === 'EXPORT'}
              onClick={() => setColFilter('Process', 'EXPORT')}
              total={processStats.total}
            />
            <StatTile
              label="Import"
              value={processStats.importCount}
              icon={FiDownload}
              tone="emerald"
              isActive={colFilters.Process.toUpperCase() === 'IMPORT'}
              onClick={() => setColFilter('Process', 'IMPORT')}
              total={processStats.total}
            />
            <StatTile
              label="Empty"
              value={processStats.emptyCount}
              icon={FiPackage}
              tone="violet"
              isActive={colFilters.Process.toUpperCase() === 'EMPTY'}
              onClick={() => setColFilter('Process', 'EMPTY')}
              total={processStats.total}
            />
            <StatTile
              label="Domestic"
              value={processStats.domesticCount}
              icon={FiHome}
              tone="rose"
              isActive={colFilters.Process.toUpperCase() === 'DOMESTIC'}
              onClick={() => setColFilter('Process', 'DOMESTIC')}
              total={processStats.total}
            />
          </div>

          {/* ── Table ── */}
          <section className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-5 py-3 flex items-center justify-between">
              <h2 className="text-white font-bold text-base tracking-wide uppercase">
                Gate In / Out Summary
                {fetched && <span className="ml-2 text-blue-200 font-normal text-sm">— {records.length} record(s)</span>}
              </h2>
              <button onClick={handleExport} disabled={!filteredRecords.length}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40">
                <FaFileExcel /> Export Excel
              </button>
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
                        <div className="flex items-center gap-1">
                          {label}
                          <SortIcon colKey={key} />
                        </div>
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
                  ) : filteredRecords.length > 0 ? (
                    filteredRecords.map((row, i) => (
                      <tr key={i} className={`hover:bg-blue-50/40 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <td className="px-3 py-2.5 text-slate-400 text-xs border-r border-slate-100 text-center">{i + 1}</td>
                        <td className="px-3 py-2.5 font-mono font-semibold text-[#0e4a78] border-r border-slate-100 whitespace-nowrap">{row.ContainerNo || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100">{row.ContainerSize || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100">{row.ContainerType || '—'}</td>
                        <td className="px-3 py-2.5 border-r border-slate-100"><StatusBadge val={row.Process} /></td>
                        <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100 whitespace-nowrap">{row.Mode || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100 whitespace-nowrap">{row.BookingNo || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100">{row.ContainerLocationName || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100">{row.TrailerNo || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100 whitespace-nowrap">{formatDate(row.GateInDate)}</td>
                        <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100 whitespace-nowrap">{formatDate(row.GateOutDate)}</td>
                        <td className="px-3 py-2.5 text-amber-600 font-semibold border-r border-slate-100 whitespace-nowrap">{row.INTAT || '—'}</td>
                        <td className="px-3 py-2.5 text-emerald-600 font-semibold whitespace-nowrap">{row.OUTTAT || '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={COLS.length + 1} className="py-12 text-center text-slate-400">
                      <FiFilter className="mx-auto text-3xl text-slate-300 mb-2" />
                      <p className="font-medium text-sm">
                        {fetched
                          ? (records.length > 0 ? 'No records match column filters' : 'No records found')
                          : 'Set filters and click Search'}
                      </p>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {records.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
                <span>Showing <strong className="text-[#0e4a78]">{filteredRecords.length}</strong> of <strong className="text-[#0e4a78]">{records.length}</strong> record(s)</span>
                {sortConfig.key && (
                  <span className="text-slate-400">
                    Sorted by: <strong className="text-slate-600">{COLS.find(c => c.key === sortConfig.key)?.label}</strong> ({sortConfig.dir})
                  </span>
                )}
              </div>
            )}
          </section>

        </main>
        <Footer />
      </div>
    </div>
  )
}

export default GateInOutReport
