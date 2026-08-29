import React, { useState, useMemo, useEffect, useRef } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FiCalendar, FiRefreshCw, FiSearch, FiX, FiChevronDown, FiChevronUp, FiTarget } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import { useGetEquipmentQuery, useLazyGetEquipmentAccuracyQuery } from '../../../store/api/ymsApi'

const today     = new Date().toISOString().split('T')[0]
const yesterday = today

const fmtDate = (val) => {
  if (!val) return '—'
  const d = new Date(String(val).replace(' ', 'T'))
  if (isNaN(d)) return String(val)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

const COLUMNS = [
  { key: 'Equipment_Name', label: 'Equipment' },
  { key: 'TransDate',      label: 'Transaction Date', format: fmtDate },
  { key: 'EQ',              label: 'EQ' },
  { key: 'T',               label: 'T' },
  { key: 'A',               label: 'A' },
  { key: 'M',               label: 'M' },
  { key: 'TotalCount',      label: 'Total Count' },
  { key: 'Missing',         label: 'Missing' },
  { key: 'NonMissing',      label: 'Non Missing' },
  { key: 'Accuracy',        label: 'Accuracy (%)' },
]

const EquipmentAccuracy = () => {
  const { data: equipmentApi } = useGetEquipmentQuery()
  const [fetchAccuracy, { data, isFetching, isError }] = useLazyGetEquipmentAccuracyQuery()

  const equipmentList = useMemo(() => {
    const rows = Array.isArray(equipmentApi?.data) ? equipmentApi.data : []
    return Array.from(new Set(
      rows.map((r) => String(r?.Equipment_Name ?? r?.equipment_name ?? r?.EQUIPMENT_NAME ?? '').trim()).filter(Boolean)
    ))
  }, [equipmentApi])

  const [selectedEqp, setSelectedEqp] = useState([])
  const [eqpSearch, setEqpSearch]     = useState('')
  const [eqpOpen, setEqpOpen]         = useState(false)
  const eqpBoxRef = useRef(null)

  const [fromDate, setFromDate] = useState(yesterday)
  const [toDate,   setToDate]   = useState(today)
  const [search,   setSearch]   = useState('')
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [hasQueried, setHasQueried] = useState(false)

  useEffect(() => {
    setHasQueried(true)
    fetchAccuracy({ from_date: yesterday, to_date: today })
  }, []) // eslint-disable-line

  useEffect(() => {
    const onClickOutside = (e) => {
      if (eqpBoxRef.current && !eqpBoxRef.current.contains(e.target)) setEqpOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const allSelected = selectedEqp.length === 0

  const filteredEqpOptions = useMemo(() => {
    const q = eqpSearch.trim().toLowerCase()
    if (!q) return equipmentList
    return equipmentList.filter((name) => name.toLowerCase().includes(q))
  }, [equipmentList, eqpSearch])

  const toggleEqp = (name) => {
    setSelectedEqp((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name])
  }
  const removeEqp = (name) => setSelectedEqp((prev) => prev.filter((n) => n !== name))

  const rows = Array.isArray(data?.data) ? data.data : []

  const handleSearch = () => {
    setHasQueried(true)
    fetchAccuracy({
      from_date: fromDate,
      to_date: toDate,
      equipment_names: allSelected ? undefined : selectedEqp.join(','),
    })
  }

  const handleClear = () => {
    setSelectedEqp([])
    setEqpSearch('')
    setFromDate(yesterday)
    setToDate(today)
    setSearch('')
    setSortConfig({ key: null, direction: 'asc' })
    setHasQueried(true)
    fetchAccuracy({ from_date: yesterday, to_date: today })
  }

  const filteredData = useMemo(() => {
    let out = rows
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      out = out.filter((r) => COLUMNS.some(({ key }) => String(r[key] ?? '').toLowerCase().includes(q)))
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

  const handleExport = () => {
    if (!filteredData.length) return
    const exportRows = filteredData.map((r) => {
      const out = {}
      COLUMNS.forEach(({ key, label, format }) => { out[label] = format ? format(r[key]) : (r[key] ?? '') })
      return out
    })
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'EquipmentAccuracy')
    XLSX.writeFile(wb, `EquipmentAccuracy_${today}.xlsx`)
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
                <FiTarget className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#0e4a78]">Equipment Accuracy</h1>
                <p className="text-slate-500 text-sm">Daily OCR read accuracy per equipment</p>
              </div>
            </div>

            {/* Filter Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-visible">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex items-center gap-2 rounded-t-2xl">
                <FiSearch className="text-white text-base" />
                <h2 className="text-white font-bold text-base tracking-wide">Search Criteria</h2>
              </div>

              <div className="p-6 rounded-b-2xl">
                <div className="flex flex-col lg:flex-row lg:items-end gap-4">

                  {/* Equipment multi-select */}
                  <div className="flex flex-col gap-1.5 relative w-full lg:w-64" ref={eqpBoxRef}>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">
                      Equipment <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setEqpOpen((o) => !o)}
                      className="flex items-center justify-between w-full px-3 py-2.5 min-h-[42px] rounded-lg border border-slate-300 bg-white text-sm text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] transition-colors"
                    >
                      <span className="flex flex-wrap gap-1.5 items-center">
                        {allSelected ? (
                          <span className="text-slate-500">All equipment ({equipmentList.length})</span>
                        ) : selectedEqp.length <= 2 ? (
                          selectedEqp.map((name) => (
                            <span key={name} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#eaf1f7] border border-[#c9dbe9] text-[#0e4a78] text-xs font-semibold">
                              {name}
                              <FiX className="text-[10px] hover:text-red-500 cursor-pointer" onClick={(e) => { e.stopPropagation(); removeEqp(name) }} />
                            </span>
                          ))
                        ) : (
                          <span className="text-[#0e4a78] font-semibold text-xs">{selectedEqp.length} equipment selected</span>
                        )}
                      </span>
                      <FiChevronDown className={`text-slate-400 shrink-0 ml-2 transition-transform ${eqpOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {eqpOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden">
                        <div className="p-2 border-b border-slate-100 relative">
                          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                          <input
                            type="text"
                            value={eqpSearch}
                            onChange={(e) => setEqpSearch(e.target.value)}
                            placeholder="Search equipment…"
                            className="w-full pl-7 pr-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#0e4a78]"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-52 overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => setSelectedEqp([])}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[#eaf1f7] transition-colors ${allSelected ? 'bg-[#eaf1f7] font-semibold text-[#0e4a78]' : 'text-slate-700'}`}
                          >
                            All Equipment
                          </button>
                          {filteredEqpOptions.map((name) => (
                            <label key={name} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-[#eaf1f7] transition-colors">
                              <input type="checkbox" checked={selectedEqp.includes(name)} onChange={() => toggleEqp(name)} className="accent-[#0e4a78]" />
                              <span className="text-slate-700">{name}</span>
                            </label>
                          ))}
                          {filteredEqpOptions.length === 0 && (
                            <p className="px-3 py-4 text-center text-xs text-slate-400">No matches</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">
                      From Date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full sm:w-52 pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">
                      To Date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full sm:w-52 pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm transition-colors"
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
                      disabled={isFetching}
                      className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-[#0e4a78] text-white text-sm font-bold hover:bg-[#0a3b61] transition-colors shadow-md disabled:opacity-60 uppercase tracking-wide"
                    >
                      {isFetching
                        ? <FiRefreshCw className="animate-spin text-base" />
                        : <FiSearch className="text-base" />
                      }
                      {isFetching ? 'Loading…' : 'Search'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-white font-bold text-lg tracking-wide uppercase">Equipment Accuracy Detail</h2>
                  <p className="text-white/60 text-xs mt-0.5">{filteredData.length.toLocaleString()} records</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search…"
                      className="pl-8 pr-3 py-2 rounded-lg border border-white/30 bg-white/10 text-white placeholder-white/50 text-sm focus:outline-none focus:ring-1 focus:ring-white/50 w-44 transition-colors"
                    />
                    <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60 text-sm pointer-events-none" />
                    {search && (
                      <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white">
                        <FiX className="text-xs" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleExport}
                    disabled={!filteredData.length}
                    title="Export to Excel"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 shadow"
                  >
                    <FaFileExcel />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                {isError ? (
                  <div className="px-8 py-12 text-center">
                    <div className="text-red-500 font-semibold text-sm">Failed to load data. Check backend connection.</div>
                  </div>
                ) : isFetching ? (
                  <div className="px-8 py-12 flex flex-col items-center gap-3 text-slate-400">
                    <div className="w-10 h-10 border-2 border-slate-200 border-t-[#0e4a78] rounded-full animate-spin" />
                    <p className="text-sm font-medium">Loading accuracy data…</p>
                  </div>
                ) : !hasQueried ? (
                  <div className="px-8 py-14 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                      <FiTarget className="text-slate-400 text-xl" />
                    </div>
                    <p className="text-slate-400 text-sm font-medium">
                      Select filters and click <strong className="text-slate-600">Search</strong> to load data.
                    </p>
                  </div>
                ) : filteredData.length === 0 ? (
                  <div className="px-8 py-12 text-center text-slate-400 text-sm">
                    No records found for the selected criteria.
                  </div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61]">
                        {COLUMNS.map((col) => (
                          <th
                            key={col.key}
                            onClick={() => handleSort(col.key)}
                            className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-white/10 select-none border-r border-white/20 last:border-r-0"
                          >
                            {col.label} <SortIcon colKey={col.key} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredData.map((row, index) => {
                        const acc = Number(row.Accuracy) || 0
                        return (
                          <tr key={index} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/50`}>
                            {COLUMNS.map((col) => {
                              const raw = row[col.key]
                              const display = col.format ? col.format(raw) : (raw != null && raw !== '' ? raw : <span className="text-slate-300">—</span>)
                              return (
                                <td
                                  key={col.key}
                                  className={`px-4 py-3 whitespace-nowrap ${
                                    col.key === 'Equipment_Name'
                                      ? 'text-slate-800 font-semibold'
                                      : col.key === 'Accuracy'
                                      ? `font-bold ${acc >= 90 ? 'text-emerald-600' : acc >= 70 ? 'text-amber-600' : 'text-red-600'}`
                                      : 'text-slate-600'
                                  }`}
                                >
                                  {col.key === 'Accuracy' ? `${display}%` : display}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {filteredData.length > 0 && !isFetching && (
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
                  <span>Showing <strong className="text-slate-700">{filteredData.length}</strong> records</span>
                </div>
              )}
            </div>

          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default EquipmentAccuracy
