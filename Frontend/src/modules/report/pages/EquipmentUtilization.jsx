import React, { useState, useMemo, useEffect, useRef } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FiCalendar, FiRefreshCw, FiSearch, FiX, FiChevronDown, FiTruck } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import { useGetEquipmentQuery, useLazyGetEquipmentUtilizationReportQuery } from '../../../store/api/ymsApi'

const today     = new Date().toISOString().split('T')[0]
const yesterday = new Date(Date.now() - 864e5).toISOString().split('T')[0]

const fmtDate = (val) => {
  if (!val) return '—'
  const d = new Date(String(val).replace(' ', 'T'))
  if (isNaN(d)) return String(val)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

const COLUMNS = [
  { key: 'EqpName',          label: 'Equipment' },
  { key: 'TransactionDate',  label: 'Utilization Date', format: fmtDate },
  { key: 'LIFTDETAIL',       label: 'Total Liftup' },
  { key: 'IMPORT',           label: 'Import' },
  { key: 'EXPORT',           label: 'Export' },
  { key: 'RAIL',             label: 'Rail' },
  { key: 'DOMESTIC',         label: 'Domestic' },
  { key: 'GDL',              label: 'GDL' },
  { key: 'LOADED',           label: 'Laden' },
  { key: 'EMT',              label: 'Empty' },
]

const EquipmentUtilization = () => {
  const { data: equipmentApi } = useGetEquipmentQuery()
  const [fetchReport, { data: apiData, isFetching, isError }] = useLazyGetEquipmentUtilizationReportQuery()

  const equipmentList = useMemo(() => {
    const rows = Array.isArray(equipmentApi?.data) ? equipmentApi.data : []
    return Array.from(new Set(
      rows.map((r) => String(r?.Equipment_Name ?? r?.equipment_name ?? r?.EQUIPMENT_NAME ?? '').trim()).filter(Boolean)
    ))
  }, [equipmentApi])

  const [selectedEqp, setSelectedEqp]   = useState([])
  const [eqpSearch, setEqpSearch]       = useState('')
  const [eqpOpen, setEqpOpen]           = useState(false)
  const eqpBoxRef = useRef(null)

  const [fromDate, setFromDate]       = useState(yesterday)
  const [toDate,   setToDate]         = useState(today)
  const [search,   setSearch]         = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    fetchReport({ from_date: yesterday, to_date: today })
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
    setSelectedEqp((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  const removeEqp = (name) => setSelectedEqp((prev) => prev.filter((n) => n !== name))

  const handleFilter = () => {
    setCurrentPage(1)
    fetchReport({
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
    setCurrentPage(1)
    fetchReport({ from_date: yesterday, to_date: today })
  }

  const rows = Array.isArray(apiData?.data) ? apiData.data : []

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter((r) =>
      COLUMNS.some(({ key }) => String(r[key] ?? '').toLowerCase().includes(q))
    )
  }, [rows, search])

  const stats = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        totalLiftup: acc.totalLiftup + (Number(r.LIFTDETAIL) || 0),
        import:      acc.import      + (Number(r.IMPORT) || 0),
        export:      acc.export      + (Number(r.EXPORT) || 0),
        rail:        acc.rail        + (Number(r.RAIL) || 0),
        domestic:    acc.domestic    + (Number(r.DOMESTIC) || 0),
        gdl:         acc.gdl         + (Number(r.GDL) || 0),
        laden:       acc.laden       + (Number(r.LOADED) || 0),
        empty:       acc.empty       + (Number(r.EMT) || 0),
      }),
      { totalLiftup: 0, import: 0, export: 0, rail: 0, domestic: 0, gdl: 0, laden: 0, empty: 0 }
    )
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
    XLSX.utils.book_append_sheet(wb, ws, 'EquipmentUtilization')
    XLSX.writeFile(wb, `EquipmentUtilization_${today}.xlsx`)
  }

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage) || 1
  const paginatedRecords = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

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
                <FiTruck className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#0e4a78]">Equipment Utilization</h1>
                <p className="text-slate-500 text-sm">Machine-wise lift activity and process breakdown</p>
              </div>
            </div>

            {/* Filter Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-visible">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex items-center gap-2 rounded-t-2xl">
                <FiTruck className="text-white text-base" />
                <h2 className="text-white font-bold text-base tracking-wide">Equipment Utilization</h2>
              </div>

              <div className="p-6 rounded-b-2xl">
                <div className="flex flex-col lg:flex-row lg:items-end gap-4">

                  {/* Equipment multi-select */}
                  <div className="flex flex-col gap-1.5 relative w-full lg:w-72" ref={eqpBoxRef}>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">
                      Equipment
                    </label>
                    <button
                      type="button"
                      onClick={() => setEqpOpen((o) => !o)}
                      className="flex items-center justify-between w-full px-3 py-2.5 min-h-[42px] rounded-lg border border-slate-300 bg-white text-sm text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] transition-colors"
                    >
                      <span className="flex flex-wrap gap-1.5 items-center">
                        {allSelected ? (
                          <span className="text-slate-500">All equipment ({equipmentList.length})</span>
                        ) : selectedEqp.length <= 3 ? (
                          selectedEqp.map((name) => (
                            <span key={name} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#eaf1f7] border border-[#c9dbe9] text-[#0e4a78] text-xs font-semibold">
                              {name}
                              <FiX
                                className="text-[10px] hover:text-red-500 cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); removeEqp(name) }}
                              />
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
                            <label
                              key={name}
                              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-[#eaf1f7] transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedEqp.includes(name)}
                                onChange={() => toggleEqp(name)}
                                className="accent-[#0e4a78]"
                              />
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

                  {/* From Date */}
                  <div className="flex flex-col gap-1.5 w-full lg:w-48">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">From Date</label>
                    <div className="relative">
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm transition-colors"
                      />
                    </div>
                  </div>

                  {/* To Date */}
                  <div className="flex flex-col gap-1.5 w-full lg:w-48">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">To Date</label>
                    <div className="relative">
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm transition-colors"
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
                      onClick={handleFilter}
                      disabled={isFetching}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#0e4a78] text-white text-sm font-bold hover:bg-[#0a3b61] transition-colors shadow-md disabled:opacity-60 uppercase tracking-wide whitespace-nowrap"
                    >
                      <FiRefreshCw className={isFetching ? 'animate-spin' : ''} size={13} />
                      {isFetching ? 'Loading…' : 'Filter'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            {rows.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Total Liftup', value: stats.totalLiftup },
                  { label: 'Import',       value: stats.import      },
                  { label: 'Export',       value: stats.export      },
                  { label: 'Laden',        value: stats.laden       },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white rounded-lg shadow border border-slate-200 px-5 py-4">
                    <div className="text-[10px] font-bold text-[#0e4a78] uppercase tracking-widest mb-1">{label}</div>
                    <div className="text-2xl font-black text-slate-800">{value.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Results Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-white font-bold text-lg tracking-wide uppercase">Utilization Summary</h2>
                  <p className="text-white/60 text-xs mt-0.5">{filteredRows.length.toLocaleString()} records</p>
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
                      <button
                        onClick={() => setSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                      >
                        <FiX className="text-xs" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleExport}
                    disabled={!filteredRows.length}
                    title="Export to Excel"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 shadow"
                  >
                    <FaFileExcel />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                {isFetching ? (
                  <div className="px-8 py-12 flex flex-col items-center gap-3 text-slate-400">
                    <div className="w-10 h-10 border-2 border-slate-200 border-t-[#0e4a78] rounded-full animate-spin" />
                    <p className="text-sm font-medium">Loading equipment data…</p>
                  </div>
                ) : isError ? (
                  <div className="px-8 py-12 text-center">
                    <div className="text-red-500 font-semibold text-sm">Failed to load data. Check backend connection.</div>
                  </div>
                ) : paginatedRecords.length === 0 ? (
                  <div className="px-8 py-12 text-center text-slate-400 text-sm">
                    No records found for the selected criteria.
                  </div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {COLUMNS.map((col) => (
                          <th
                            key={col.key}
                            className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedRecords.map((row, index) => (
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
                                className={`px-4 py-3 whitespace-nowrap ${col.key === 'EqpName' ? 'text-slate-800 font-semibold' : 'text-slate-600'}`}
                              >
                                {display}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                    {filteredRows.length > 0 && (
                      <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                        <tr>
                          <td className="px-4 py-2.5 text-slate-700 font-bold">Total</td>
                          <td />
                          <td className="px-4 py-2.5 text-slate-800 font-bold">{stats.totalLiftup.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-slate-800 font-bold">{stats.import.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-slate-800 font-bold">{stats.export.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-slate-800 font-bold">{stats.rail.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-slate-800 font-bold">{stats.domestic.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-slate-800 font-bold">{stats.gdl.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-slate-800 font-bold">{stats.laden.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-slate-800 font-bold">{stats.empty.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}
              </div>

              {filteredRows.length > 0 && (
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
                  <span>
                    Showing <strong className="text-slate-700">{paginatedRecords.length}</strong> of{' '}
                    <strong className="text-slate-700">{filteredRows.length}</strong> records
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className={`px-3 py-1.5 rounded-lg border border-slate-300 font-semibold transition ${
                        currentPage === 1 ? 'text-slate-400 cursor-not-allowed bg-slate-100' : 'text-[#0e4a78] hover:bg-blue-50'
                      }`}
                    >
                      Previous
                    </button>
                    <span className="text-slate-600">Page {currentPage} of {totalPages || 1}</span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages || 1, p + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className={`px-3 py-1.5 rounded-lg border border-slate-300 font-semibold transition ${
                        currentPage === totalPages || totalPages === 0 ? 'text-slate-400 cursor-not-allowed bg-slate-100' : 'text-[#0e4a78] hover:bg-blue-50'
                      }`}
                    >
                      Next
                    </button>
                  </div>
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

export default EquipmentUtilization
