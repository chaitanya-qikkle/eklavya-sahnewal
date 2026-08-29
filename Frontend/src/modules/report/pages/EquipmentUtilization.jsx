import React, { useState, useMemo, useEffect } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FiCalendar, FiRefreshCw } from 'react-icons/fi'
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
    return rows
      .map((r) => String(r?.Equipment_Name ?? r?.equipment_name ?? r?.EQUIPMENT_NAME ?? '').trim())
      .filter(Boolean)
  }, [equipmentApi])

  const [selectedEqp, setSelectedEqp] = useState([])
  const [fromDate, setFromDate]       = useState(yesterday)
  const [toDate,   setToDate]         = useState(today)
  const [search,   setSearch]         = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    fetchReport({ from_date: yesterday, to_date: today })
  }, []) // eslint-disable-line

  const allSelected = selectedEqp.length === 0

  const toggleEqp = (name) => {
    setSelectedEqp((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

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

            {/* Filter Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <div className="bg-[#0e4a78] px-6 py-3 border-b border-blue-800">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  EQUIPMENT UTILIZATION
                </h2>
              </div>

              <div className="p-6 bg-white">
                <div className="flex flex-col xl:flex-row items-center justify-between gap-6">

                  <div className="flex flex-col lg:flex-row items-center gap-6 w-full flex-wrap">

                    {/* Eqp Name */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full lg:w-auto">
                      <label className="text-sm font-bold text-slate-700 uppercase whitespace-nowrap min-w-[80px]">Eqp Name</label>
                      <select
                        multiple
                        value={selectedEqp}
                        onChange={(e) => setSelectedEqp(Array.from(e.target.selectedOptions, (o) => o.value))}
                        className="w-full sm:w-64 h-24 px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm bg-slate-50 text-slate-700"
                      >
                        {equipmentList.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {allSelected ? `All (${equipmentList.length})` : `${selectedEqp.length} selected`}
                      </span>
                    </div>

                    {/* From Date */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full lg:w-auto">
                      <label className="text-sm font-bold text-slate-700 uppercase whitespace-nowrap min-w-[80px]">From Date</label>
                      <div className="relative w-full sm:w-64">
                        <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input
                          type="date"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm text-slate-700"
                        />
                      </div>
                    </div>

                    {/* To Date */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full lg:w-auto">
                      <label className="text-sm font-bold text-slate-700 uppercase whitespace-nowrap min-w-[80px]">To Date</label>
                      <div className="relative w-full sm:w-64">
                        <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input
                          type="date"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm text-slate-700"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto lg:ml-0 mt-4 lg:mt-0 w-full lg:w-auto justify-end">
                      <button
                        onClick={handleClear}
                        className="px-4 py-2 bg-slate-100 border border-slate-300 text-slate-600 rounded text-sm font-medium hover:bg-slate-200 transition-colors shadow-sm"
                      >
                        Clear
                      </button>
                      <button
                        onClick={handleFilter}
                        disabled={isFetching}
                        className="flex items-center gap-2 px-6 py-2 bg-[#0e4a78] text-white rounded text-sm font-bold hover:bg-[#0a3b61] transition-colors shadow-md uppercase disabled:opacity-60"
                      >
                        <FiRefreshCw className={isFetching ? 'animate-spin' : ''} size={13} />
                        {isFetching ? 'Loading…' : 'Filter'}
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </section>

            {/* Table Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-3 shadow-md">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  EQUIPMENT UTILIZATION SUMMARY
                </h2>
              </div>

              <div className="px-6 py-6 space-y-4">

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExport}
                      disabled={!filteredRows.length}
                      className="p-1 disabled:opacity-40"
                      title="Export to Excel"
                    >
                      <FaFileExcel className="text-3xl text-green-700 hover:text-green-800 transition-colors" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Search:</label>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500 w-full sm:w-64 text-slate-700"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-sm shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61]">
                      <tr>
                        {COLUMNS.map((column) => (
                          <th key={column.key} className="px-5 py-3 text-left font-bold text-white uppercase tracking-wider border-r border-[#ffffff40] last:border-r-0 whitespace-nowrap">
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {isFetching ? (
                        <tr>
                          <td colSpan={COLUMNS.length} className="px-5 py-8 text-center text-slate-400">
                            <FiRefreshCw className="inline animate-spin mr-2" /> Loading equipment data…
                          </td>
                        </tr>
                      ) : isError ? (
                        <tr>
                          <td colSpan={COLUMNS.length} className="px-5 py-8 text-center text-red-500 font-semibold">
                            Failed to load data. Check backend connection.
                          </td>
                        </tr>
                      ) : paginatedRecords.length > 0 ? (
                        paginatedRecords.map((row, index) => (
                          <tr key={index} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                            {COLUMNS.map((column) => {
                              const raw = row[column.key]
                              const display = column.format ? column.format(raw) : (raw ?? '—')
                              return (
                                <td key={column.key} className="px-5 py-3 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0">
                                  {display}
                                </td>
                              )
                            })}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={COLUMNS.length} className="px-5 py-3 text-slate-500">
                            No data available in table
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-slate-600">
                  <div>
                    Showing <strong className="text-[#0e4a78]">{paginatedRecords.length}</strong> of{' '}
                    <strong className="text-[#0e4a78]">{filteredRows.length}</strong> total records (Page{' '}
                    <strong>{currentPage}</strong> of <strong>{totalPages || 1}</strong>)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${
                        currentPage === 1
                          ? 'text-slate-400 cursor-not-allowed bg-slate-100'
                          : 'text-[#0e4a78] hover:bg-blue-50'
                      }`}
                    >
                      Previous
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-600">Page</span>
                      <input
                        type="number"
                        min={1}
                        max={totalPages || 1}
                        value={currentPage}
                        onChange={(e) => {
                          const p = Math.max(1, Math.min(totalPages || 1, Number(e.target.value) || 1))
                          setCurrentPage(p)
                        }}
                        className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-[#0e4a78]"
                      />
                      <span className="text-slate-600">of {totalPages || 1}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.min(totalPages || 1, p + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${
                        currentPage === totalPages || totalPages === 0
                          ? 'text-slate-400 cursor-not-allowed bg-slate-100'
                          : 'text-[#0e4a78] hover:bg-blue-50'
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

            </section>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default EquipmentUtilization
