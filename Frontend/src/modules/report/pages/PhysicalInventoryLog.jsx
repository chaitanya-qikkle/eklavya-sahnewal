import React, { useState } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FaFileExcel, FaSearch, FaFilter } from 'react-icons/fa'
import { FiCalendar, FiRefreshCw, FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi'
import * as XLSX from 'xlsx'

// Mock Data for Physical Inventory Log
const logRecords = [
  { id: 1, containerNo: 'TCNU5799359', updatedLocation: 'CY-EXPORT:N63:3', inventoryDate: '16-12-2025 10:17:54' },
  { id: 2, containerNo: 'TRHU4777786', updatedLocation: 'CY-EXPORT:N63:2', inventoryDate: '16-12-2025 10:17:35' },
  { id: 3, containerNo: 'DPWU9073165', updatedLocation: 'CY-EXPORT:N63:1', inventoryDate: '16-12-2025 10:17:25' },
  { id: 4, containerNo: 'TGBU5998622', updatedLocation: 'CY-EXPORT:063:2', inventoryDate: '16-12-2025 10:17:14' },
  { id: 5, containerNo: 'HAMU4197783', updatedLocation: 'CY-EXPORT:063:1', inventoryDate: '16-12-2025 10:17:05' },
  { id: 6, containerNo: 'NYKU9705876', updatedLocation: 'CY-EXPORT:058:3', inventoryDate: '16-12-2025 10:16:22' },
  { id: 7, containerNo: 'NLLU4143989', updatedLocation: 'CY-EXPORT:058:2', inventoryDate: '16-12-2025 10:16:07' },
  { id: 8, containerNo: 'MSMU6010234', updatedLocation: 'CY-EXPORT:058:1', inventoryDate: '16-12-2025 10:15:56' },
  { id: 9, containerNo: 'TCKU7471512', updatedLocation: 'CY-EXPORT:N58:4', inventoryDate: '16-12-2025 10:15:47' },
  { id: 10, containerNo: 'TCKU7471512', updatedLocation: 'CY-EXPORT:N58:4', inventoryDate: '16-12-2025 10:15:46' },
]

const PhysicalInventoryLog = () => {
  // State for filters
  const [fromDate, setFromDate] = useState('2026-02-16')
  const [toDate, setToDate] = useState('')
  const [search, setSearch] = useState('')

  // Export to Excel function for "Log Details"
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(logRecords)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'PhysicalInventoryLog')
    XLSX.writeFile(wb, `PhysicalInventoryLog_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Clear filters function
  const handleCancel = () => {
    setFromDate('')
    setToDate('')
    setSearch('')
  }

  // Refresh function mock
  const handleRefresh = () => {
    // Logic to reload data would go here
  }

  // Table Columns definition
  const columns = [
    { key: 'containerNo', label: 'ContainerNo' },
    { key: 'updatedLocation', label: 'Updated Location' },
    { key: 'inventoryDate', label: 'InventoryDate' },
  ]

  // Filter logic for the table
  const filteredData = logRecords.filter(item => {
    // Search filter
    if (search && !Object.values(item).some(val => String(val).toLowerCase().includes(search.toLowerCase()))) {
      return false
    }
    return true
  })

  return (
    <div
      className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px]" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <div className="w-full space-y-8">

            {/* Filter Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-200 overflow-hidden transition-all hover:shadow-2xl">
              {/* Default Blue Gradient Header */}
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 border-b border-blue-800 flex justify-between items-center">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase flex items-center gap-2">
                  <FaFilter className="text-blue-200" />
                  PHYSICAL INVENTORY LOG
                </h2>
                <button onClick={handleRefresh} className="text-white/80 hover:text-white transition-colors">
                  <FiRefreshCw />
                </button>
              </div>

              <div className="p-8 bg-white">
                <div className="flex flex-col lg:flex-row items-center justify-center gap-8">

                  {/* From Date Filter */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto group">
                    <label className="text-sm font-bold text-slate-700 uppercase whitespace-nowrap min-w-[60px] text-right group-hover:text-[#0e4a78] transition-colors">FROM</label>
                    <div className="relative w-full sm:w-72 shadow-sm rounded-md transition-shadow hover:shadow-md">
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-transparent text-sm text-slate-700 transition-all font-medium"
                      />
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-[#0e4a78] transition-colors" />
                    </div>
                  </div>

                  {/* To Date Filter */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto group">
                    <label className="text-sm font-bold text-slate-700 uppercase whitespace-nowrap min-w-[60px] text-right group-hover:text-[#0e4a78] transition-colors">TO</label>
                    <div className="relative w-full sm:w-72 shadow-sm rounded-md transition-shadow hover:shadow-md">
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-transparent text-sm text-slate-700 transition-all font-medium"
                      />
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-[#0e4a78] transition-colors" />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 ml-auto lg:ml-8 mt-6 lg:mt-0 w-full lg:w-auto justify-end">
                    <button
                      onClick={handleCancel}
                      className="px-6 py-2.5 bg-slate-100 border border-slate-300 text-slate-600 rounded-md text-sm font-semibold hover:bg-slate-200 transition-all shadow-sm hover:shadow active:scale-95"
                    >
                      Cancel
                    </button>
                    <button
                      className="px-8 py-2.5 bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white rounded-md text-sm font-bold hover:shadow-lg hover:from-[#0a3b61] hover:to-[#0e4a78] transition-all shadow-md active:scale-95 uppercase tracking-wide"
                    >
                      SUBMIT
                    </button>
                  </div>

                </div>
              </div>
            </section>

            {/* Log Details Table Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-200 overflow-hidden transition-all hover:shadow-2xl">
              {/* Default Blue Gradient Header */}
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 shadow-md flex justify-between items-center">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  LOG DETAILS
                </h2>
                <div className="text-white/80 text-xs font-mono bg-black/20 px-2 py-1 rounded">
                  Total Records: {filteredData.length}
                </div>
              </div>

              <div className="p-6 space-y-6">

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-500 mr-2">Actions:</span>
                    <button
                      onClick={handleExport}
                      className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-all shadow-sm flex items-center justify-center group"
                      title="Export to Excel"
                    >
                      <FaFileExcel className="text-xl text-green-600 group-hover:scale-110 transition-transform" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-80 group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaSearch className="text-slate-400 group-focus-within:text-[#0e4a78] transition-colors" />
                      </div>
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search records..."
                        className="pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-transparent w-full transition-all shadow-sm text-slate-700"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    {/* Default Blue Gradient Header for Table */}
                    <thead className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61]">
                      <tr>
                        {columns.map((column) => (
                          <th key={column.key} className="px-6 py-4 text-left font-bold text-white uppercase tracking-wider border-r border-white/10 last:border-r-0 whitespace-nowrap text-xs">
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredData.length > 0 ? (
                        filteredData.map((row, index) => (
                          <tr key={index} className="hover:bg-blue-50/30 transition-colors border-b border-slate-100 group">
                            {columns.map((column) => (
                              <td key={column.key} className="px-6 py-4 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0 group-hover:text-blue-900 transition-colors font-medium">
                                {row[column.key]}
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={columns.length} className="px-6 py-12 text-slate-500 text-center flex flex-col items-center justify-center gap-2">
                            <div className="text-4xl opacity-20">📭</div>
                            <p>No data available matching your criteria</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Mockup */}
                <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-slate-600 pt-2 border-t border-slate-100">
                  <div className="font-medium">
                    Showing <span className="font-bold text-slate-800">1</span> to <span className="font-bold text-slate-800">{filteredData.length}</span> of <span className="font-bold text-slate-800">{filteredData.length}</span> entries
                  </div>

                  <div className="flex items-center gap-1 mt-4 sm:mt-0">
                    <button className="p-2 rounded-md hover:bg-slate-100 text-slate-400 disabled:opacity-50 transition-colors" disabled>
                      <FiChevronsLeft />
                    </button>
                    <button className="p-2 rounded-md hover:bg-slate-100 text-slate-400 disabled:opacity-50 transition-colors" disabled>
                      <FiChevronLeft />
                    </button>

                    <div className="flex gap-1 mx-2">
                      <button className="w-8 h-8 flex items-center justify-center rounded-md bg-[#0e4a78] text-white font-bold shadow-sm">1</button>
                      <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-600 transition-colors">2</button>
                      <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-600 transition-colors">3</button>
                    </div>

                    <button className="p-2 rounded-md hover:bg-slate-100 text-slate-600 transition-colors">
                      <FiChevronRight />
                    </button>
                    <button className="p-2 rounded-md hover:bg-slate-100 text-slate-600 transition-colors">
                      <FiChevronsRight />
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

export default PhysicalInventoryLog
