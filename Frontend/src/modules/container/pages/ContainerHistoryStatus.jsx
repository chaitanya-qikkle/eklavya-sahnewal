import React, { useState, useMemo, useEffect } from 'react'
import { FiSearch, FiRefreshCw, FiChevronUp, FiChevronDown, FiCalendar } from 'react-icons/fi'
import { FaFileExcel, FaFilePdf } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { useLazyGetContainerHistoryReportQuery } from '../../../store/api/ymsApi'

function toDateTimeLocalParam(v) {
  // datetime-local gives "YYYY-MM-DDTHH:mm" — SP wants a value SQL Server can cast to DATETIME
  return v ? v.replace('T', ' ') : undefined
}

function mapRow(r) {
  return {
    containerNo: r.ContainerNo || '',
    size: r.ContainerSize || '',
    type: r.ContainerType || '',
    transactionType: r.Process || '',
    documentNo: r.DocumentNo || '',
    bookingNo: r.BookingNo || '',
    mode: r.Mode || '',
    gateInDate: r.GateInDate || '',
    gateOutDate: r.GateOutDate || '',
    tat: r.TAT || '',
  }
}

const ContainerHistoryStatus = () => {
  const [containerSearch, setContainerSearch] = useState('')
  const [gateInFrom, setGateInFrom] = useState('')
  const [gateInTo, setGateInTo] = useState('')
  const [globalSearch, setGlobalSearch] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null })
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [trigger, { data, isFetching, isError }] = useLazyGetContainerHistoryReportQuery()

  const runSearch = () => {
    setCurrentPage(1)
    trigger({
      from_date: toDateTimeLocalParam(gateInFrom),
      to_date: toDateTimeLocalParam(gateInTo),
      container_no: containerSearch.trim() || undefined,
    })
  }

  useEffect(() => {
    runSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const historyData = useMemo(() => (data?.data || []).map(mapRow), [data])

  // Filter logic
  const filteredData = useMemo(() => {
    let rows = [...historyData]

    // Global Search (Table search)
    if (globalSearch) {
      const lowerSearch = globalSearch.toLowerCase()
      rows = rows.filter(item =>
        Object.values(item).some(val =>
          val.toString().toLowerCase().includes(lowerSearch)
        )
      )
    }

    // Sorting
    if (sortConfig.key) {
      rows.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return rows
  }, [historyData, globalSearch, sortConfig])

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize)
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const handleClear = () => {
    setContainerSearch('')
    setGateInFrom('')
    setGateInTo('')
    setGlobalSearch('')
    setCurrentPage(1)
    trigger({})
  }

  const handleExportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Container History")
    XLSX.writeFile(workbook, "container-history.xlsx")
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

            {/* Filter Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-3">
                <h2 className="text-lg font-semibold tracking-wide">Container History Status</h2>
              </header>
              <div className="p-6">
                <div className="flex flex-wrap items-end gap-6">
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Search Container"
                      value={containerSearch}
                      onChange={(e) => setContainerSearch(e.target.value)}
                      className="w-full md:w-64 px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] outline-none text-slate-700 placeholder:text-slate-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Gate In From
                    </label>
                    <div className="relative">
                      <input
                        type="datetime-local"
                        value={gateInFrom}
                        onChange={(e) => setGateInFrom(e.target.value)}
                        className="w-full md:w-64 px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#0e4a78]/50 outline-none text-slate-700"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Gate In To
                    </label>
                    <div className="relative">
                      <input
                        type="datetime-local"
                        value={gateInTo}
                        onChange={(e) => setGateInTo(e.target.value)}
                        className="w-full md:w-64 px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#0e4a78]/50 outline-none text-slate-700"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleClear}
                      className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 transition uppercase text-sm tracking-wide"
                    >
                      Clear
                    </button>
                    <button
                      onClick={runSearch}
                      disabled={isFetching}
                      className="px-6 py-2.5 rounded-lg bg-[#0e4a78] text-white font-semibold hover:bg-[#0b3e66] transition shadow-md uppercase text-sm tracking-wide disabled:opacity-60"
                    >
                      {isFetching ? 'Loading…' : 'Filter'}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Detail Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
                <h2 className="text-lg font-semibold tracking-wide">Container History Detail</h2>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportExcel}
                      className="w-9 h-9 flex items-center justify-center rounded bg-emerald-600 hover:bg-emerald-700 transition text-white shadow"
                      title="Export Excel"
                    >
                      <FaFileExcel className="text-lg" />
                    </button>
                    <button
                      className="w-9 h-9 flex items-center justify-center rounded bg-red-600 hover:bg-red-700 transition text-white shadow"
                      title="Export PDF"
                    >
                      <FaFilePdf className="text-lg" />
                    </button>
                  </div>
                  <div className="relative flex-1 sm:flex-initial">
                    <span className="hidden sm:block absolute left-3 top-1/2 -translate-y-1/2 text-white/70 text-sm">Search:</span>
                    <input
                      type="text"
                      value={globalSearch}
                      onChange={(e) => setGlobalSearch(e.target.value)}
                      className="w-full sm:w-48 pl-3 sm:pl-16 pr-4 py-1.5 rounded bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:bg-white/20 text-sm"
                    />
                  </div>
                </div>
              </header>

              <div className="overflow-x-auto w-full">
                <table className="min-w-full text-xs md:text-sm text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                      {[
                        { key: 'containerNo', label: 'Container No' },
                        { key: 'size', label: 'Size' },
                        { key: 'type', label: 'Type' },
                        { key: 'transactionType', label: 'Transaction Type' },
                        { key: 'documentNo', label: 'Document No' },
                        { key: 'bookingNo', label: 'Booking No' },
                        { key: 'mode', label: 'Mode' },
                        { key: 'gateInDate', label: 'GATE IN DATE' },
                        { key: 'gateOutDate', label: 'GATE OUT DATE' },
                        { key: 'tat', label: 'TAT' }
                      ].map(col => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className="px-4 sm:px-5 py-3 text-left font-semibold border-r border-white/30 last:border-r-0 cursor-pointer hover:bg-white/10 whitespace-nowrap"
                        >
                          <div className="flex items-center gap-1">
                            {col.label}
                            <div className="flex flex-col opacity-50">
                              <FiChevronUp className="w-2.5 h-2.5 -mb-0.5" />
                              <FiChevronDown className="w-2.5 h-2.5 -mt-0.5" />
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {!isFetching && !isError && paginatedData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 font-medium">{row.containerNo}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">{row.size}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">{row.type}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">{row.transactionType}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">{row.documentNo}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">{row.bookingNo}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">{row.mode}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">{row.gateInDate}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">{row.gateOutDate}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 font-medium whitespace-nowrap">{row.tat}</td>
                      </tr>
                    ))}
                    {isFetching && (
                      <tr>
                        <td colSpan="10" className="px-6 py-8 text-center text-slate-500 bg-white">
                          Loading…
                        </td>
                      </tr>
                    )}
                    {!isFetching && isError && (
                      <tr>
                        <td colSpan="10" className="px-6 py-8 text-center text-red-500 bg-white">
                          Failed to load container history. Check backend connection.
                        </td>
                      </tr>
                    )}
                    {!isFetching && !isError && paginatedData.length === 0 && (
                      <tr>
                        <td colSpan="10" className="px-6 py-8 text-center text-slate-500 bg-white">
                          <div className="flex flex-col items-center gap-2">
                            <FiSearch className="text-3xl text-slate-300" />
                            <span>No matching records found</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
                <div>
                  Showing {Math.min((currentPage - 1) * pageSize + 1, filteredData.length)} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} entries
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded border border-slate-300 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 rounded border ${currentPage === page ? 'bg-[#0e4a78] text-white border-[#0e4a78]' : 'border-slate-300 hover:bg-white bg-white'}`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded border border-slate-300 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                  >
                    Next
                  </button>
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

export default ContainerHistoryStatus