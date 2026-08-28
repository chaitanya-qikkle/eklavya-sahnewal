import React, { useState } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FaFileExcel } from 'react-icons/fa'
import { FiCalendar } from 'react-icons/fi'
import * as XLSX from 'xlsx'

// Mock Data for Container Update History
const historyRecords = [
  { id: 1, updateCount: 343, userName: 'Pallavi', transactionDate: '16-12-2025', updatedDate: '16-12-2025' },
  { id: 2, updateCount: 50, userName: 'Virendra', transactionDate: '16-12-2025', updatedDate: '16-12-2025' },
  { id: 3, updateCount: 12, userName: 'Rajesh', transactionDate: '15-12-2025', updatedDate: '15-12-2025' },
  { id: 4, updateCount: 89, userName: 'Suresh', transactionDate: '15-12-2025', updatedDate: '15-12-2025' },
  { id: 5, updateCount: 156, userName: 'Pallavi', transactionDate: '14-12-2025', updatedDate: '14-12-2025' },
]

const ContainerUpdateHistory = () => {
  // State for filters
  const [fromDate, setFromDate] = useState('2025-12-16')
  const [toDate, setToDate] = useState('2025-12-01')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Export to Excel function
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(historyRecords)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'ContainerUpdateHistory')
    XLSX.writeFile(wb, `ContainerUpdateHistory_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Clear filters function
  const handleCancel = () => {
    setFromDate('')
    setToDate('')
    setSearch('')
  }

  // Table Columns definition
  const columns = [
    { key: 'updateCount', label: 'UpdateCount' },
    { key: 'userName', label: 'UserName' },
    { key: 'transactionDate', label: 'TransactionDate' },
    { key: 'updatedDate', label: 'UpdatedDate' },
  ]

  // Filter logic for the table
  const filteredData = historyRecords.filter(item => {
    // Global Search
    if (search && !Object.values(item).some(val => String(val).toLowerCase().includes(search.toLowerCase()))) {
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

            {/* Filter Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              {/* Default Blue Gradient Header */}
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-3 border-b border-blue-800">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  CONTAINER UPDATE HISTORY
                </h2>
              </div>

              <div className="p-6 bg-white">
                <div className="flex flex-col lg:flex-row items-center justify-center gap-6">

                  {/* From Date Filter */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full lg:w-auto">
                    <label className="text-sm font-bold text-slate-700 uppercase whitespace-nowrap min-w-[60px] text-right">FROM</label>
                    <div className="relative w-full sm:w-64">
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm text-slate-700"
                      />
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    </div>
                  </div>

                  {/* To Date Filter */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full lg:w-auto">
                    <label className="text-sm font-bold text-slate-700 uppercase whitespace-nowrap min-w-[60px] text-right">TO</label>
                    <div className="relative w-full sm:w-64">
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm text-slate-700"
                      />
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 ml-auto lg:ml-8 mt-4 lg:mt-0 w-full lg:w-auto justify-end">
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 bg-slate-100 border border-slate-300 text-slate-600 rounded text-sm font-medium hover:bg-slate-200 transition-colors shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      className="px-6 py-2 bg-[#0e4a78] text-white rounded text-sm font-bold hover:bg-[#0a3b61] transition-colors shadow-md uppercase"
                    >
                      SUBMIT
                    </button>
                  </div>

                </div>
              </div>
            </section>

            {/* History Details Table Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              {/* Default Blue Gradient Header */}
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-3 shadow-md">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  HISTORY DETAILS
                </h2>
              </div>

              <div className="px-6 py-6 space-y-4">

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  {/* Excel Export */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExport}
                      className="p-1 items-center justify-center flex"
                      title="Export to Excel"
                    >
                      <FaFileExcel className="text-3xl text-green-700 hover:text-green-800 transition-colors" />
                    </button>
                  </div>

                  {/* Search Bar */}
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

                {/* Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-sm shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    {/* Default Blue Gradient Header for Table */}
                    <thead className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61]">
                      <tr>
                        {columns.map((column) => (
                          <th key={column.key} className="px-5 py-3 text-left font-bold text-white tracking-wider border-r border-[#ffffff40] last:border-r-0 whitespace-nowrap">
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

export default ContainerUpdateHistory
