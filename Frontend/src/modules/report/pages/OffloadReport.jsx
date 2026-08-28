import React, { useState } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FaFileExcel, FaFilePdf, FaSearch } from 'react-icons/fa'
import { FiCalendar, FiRefreshCw } from 'react-icons/fi'
import * as XLSX from 'xlsx'

// Mock Data for Offload Report
const offloadRecords = [
  { id: 1, container: 'TEMU1635819', size: '20', type: 'DRY', activity: 'Offload', process: 'Import', arrival: '', gateInDate: '10-12-2025 01:25', offloadDate: '10-12-2025 01:25', ageing: '009:58' },
  { id: 2, container: 'CSLU1761183', size: '20', type: 'DRY', activity: 'Offload', process: 'Import', arrival: '', gateInDate: '05-12-2025 21:15', offloadDate: '05-12-2025 21:15', ageing: '009:58' },
  { id: 3, container: 'UETU5034284', size: '40', type: 'DRY', activity: 'Offload', process: 'Import', arrival: '', gateInDate: '05-12-2025 04:26', offloadDate: '05-12-2025 04:26', ageing: '009:55' },
  { id: 4, container: 'TGCU0208797', size: '40', type: 'DRY', activity: 'Offload', process: 'Import', arrival: '', gateInDate: '09-12-2025 10:10', offloadDate: '09-12-2025 10:10', ageing: '009:54' },
  { id: 5, container: 'WFHU1469141', size: '20', type: 'DRY', activity: 'Offload', process: 'Import', arrival: '', gateInDate: '10-12-2025 01:20', offloadDate: '10-12-2025 01:20', ageing: '009:52' },
  { id: 6, container: 'DFSU7117991', size: '40', type: 'DRY', activity: 'Offload', process: 'Import', arrival: '', gateInDate: '09-12-2025 10:07', offloadDate: '09-12-2025 10:07', ageing: '009:51' },
  { id: 7, container: 'ECMU7016979', size: '40', type: 'DRY', activity: 'Offload', process: 'Import', arrival: '', gateInDate: '11-12-2025 11:04', offloadDate: '11-12-2025 11:04', ageing: '009:50' },
  { id: 8, container: 'TCLU1672374', size: '40', type: 'DRY', activity: 'Offload', process: 'Import', arrival: '', gateInDate: '09-12-2025 20:36', offloadDate: '09-12-2025 20:36', ageing: '009:48' },
  { id: 9, container: 'NYKU4780711', size: '40', type: 'DRY', activity: 'Offload', process: 'Import', arrival: '', gateInDate: '06-12-2025 06:39', offloadDate: '06-12-2025 06:39', ageing: '009:46' },
  { id: 10, container: 'ONEU1736353', size: '40', type: 'DRY', activity: 'Offload', process: 'Import', arrival: '', gateInDate: '03-12-2025 01:29', offloadDate: '03-12-2025 01:29', ageing: '009:40' },
]

const OffloadReport = () => {
  // State for filters
  const [containerSearch, setContainerSearch] = useState('')
  const [fromDate, setFromDate] = useState('2025-12-01T12:20')
  const [toDate, setToDate] = useState('2025-12-16T12:20')
  const [tableSearch, setTableSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Export to Excel function
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(offloadRecords)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'OffloadingSummary')
    XLSX.writeFile(wb, `OffloadingSummary_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Clear filters function
  const handleClear = () => {
    setContainerSearch('')
    setFromDate('')
    setToDate('')
    setTableSearch('')
  }

  // Table Columns definition
  const columns = [
    { key: 'container', label: 'CONTAINER' },
    { key: 'size', label: 'SIZE' },
    { key: 'type', label: 'TYPE' },
    { key: 'activity', label: 'ACTIVITY' },
    { key: 'process', label: 'PROCESS' },
    { key: 'arrival', label: 'ARRIVAL' },
    { key: 'gateInDate', label: 'GATE IN DATE' },
    { key: 'offloadDate', label: 'OFFLOAD DATE' },
    { key: 'ageing', label: 'AGEING' },
  ]

  // Filter logic for the table
  const filteredData = offloadRecords.filter(item => {
    // Container specific Search (from top bar)
    if (containerSearch && !item.container.toLowerCase().includes(containerSearch.toLowerCase())) {
      return false
    }

    // Global Table Search
    if (tableSearch && !Object.values(item).some(val => String(val).toLowerCase().includes(tableSearch.toLowerCase()))) {
      return false
    }
    return true
  })

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

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

            {/* Top Filter Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              {/* Header for Offload Report */}
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-3 border-b border-blue-800">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  Offload Report
                </h2>
              </div>

              <div className="p-4 bg-white">
                <div className="flex flex-col xl:flex-row items-center justify-between gap-4">

                  {/* Left: Container Search */}
                  <div className="flex items-center gap-2 w-full xl:w-auto">
                    <input
                      type="text"
                      placeholder="Search Container"
                      value={containerSearch}
                      onChange={(e) => setContainerSearch(e.target.value)}
                      className="w-full xl:w-64 px-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm text-slate-700"
                    />
                    <button className="px-6 py-2 bg-[#0e4a78] text-white rounded text-sm font-bold hover:bg-[#0a3b61] transition-colors shadow-md uppercase">
                      SEARCH
                    </button>
                  </div>

                  {/* Middle: Date Range */}
                  <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">

                    {/* From Date */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <label className="text-sm font-bold text-slate-700 whitespace-nowrap">From Date</label>
                      <div className="relative w-full md:w-56">
                        <input
                          type="datetime-local"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                          className="w-full pl-10 pr-2 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm text-slate-700"
                        />
                        <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      </div>
                    </div>

                    {/* To Date */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <label className="text-sm font-bold text-slate-700 whitespace-nowrap">To Date</label>
                      <div className="relative w-full md:w-56">
                        <input
                          type="datetime-local"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          className="w-full pl-10 pr-2 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm text-slate-700"
                        />
                        <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      </div>
                    </div>

                  </div>

                  {/* Right: Action Buttons */}
                  <div className="flex items-center gap-2 w-full xl:w-auto justify-end">
                    <button className="px-6 py-2 bg-[#0e4a78] text-white rounded text-sm font-bold hover:bg-[#0a3b61] transition-colors shadow-md uppercase">
                      Search
                    </button>
                    <button
                      onClick={handleClear}
                      className="px-6 py-2 bg-slate-100 border border-slate-300 text-slate-600 rounded text-sm font-medium hover:bg-slate-200 transition-colors shadow-sm"
                    >
                      Clear
                    </button>
                  </div>

                </div>
              </div>
            </section>

            {/* Table Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              {/* Default Blue Gradient Header */}
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-3 shadow-md flex justify-between items-center">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  Offloading Summary
                </h2>
              </div>

              <div className="px-6 py-6 space-y-4">

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  {/* Export Icons */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleExport}
                      className="p-1 items-center justify-center flex transition-transform hover:scale-110"
                      title="Export to Excel"
                    >
                      <FaFileExcel className="text-3xl text-green-700" />
                    </button>
                    <button
                      className="p-1 items-center justify-center flex transition-transform hover:scale-110"
                      title="Export to PDF"
                    >
                      <FaFilePdf className="text-3xl text-red-600" />
                    </button>
                  </div>

                  {/* Table Search */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Search:</label>
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500 w-full sm:w-64 text-slate-700"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-sm shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    {/* Default Blue Gradient Header for Table */}
                    <thead className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61]">
                      <tr>
                        {columns.map((column) => (
                          <th key={column.key} className="px-5 py-3 text-left font-bold text-white uppercase tracking-wider border-r border-[#ffffff40] last:border-r-0 whitespace-nowrap">
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {paginatedData.length > 0 ? (
                        paginatedData.map((row, index) => (
                          <tr key={index} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                            {columns.map((column) => (
                              <td key={column.key} className="px-5 py-3 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0 font-medium">
                                {row[column.key]}
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={columns.length} className="px-5 py-3 text-slate-500 text-center">
                            No data available in table
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-slate-600">
                  <div>
                    Showing <strong className="text-[#0e4a78]">{paginatedData.length}</strong> of{' '}
                    <strong className="text-[#0e4a78]">{filteredData.length}</strong> total records (Page{' '}
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

export default OffloadReport
