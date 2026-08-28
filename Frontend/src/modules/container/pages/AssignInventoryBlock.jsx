import React, { useState, useMemo } from 'react'
import { FiSearch, FiRefreshCw, FiChevronUp, FiChevronDown } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { notify } from '../../../utils/notify'

// Mock data for the table
const mockLogData = [
  { containerNo: "MSDU8022011", updatedLocation: "CY-EXPORT:A70:1", inventoryDate: "12-12-2025 11:08:05" },
  { containerNo: "MSBU5261777", updatedLocation: "CY-EXPORT:L87:3", inventoryDate: "12-12-2025 11:04:50" },
  { containerNo: "UETU6087437", updatedLocation: "CY-EXPORT:L87:2", inventoryDate: "12-12-2025 11:04:43" },
  { containerNo: "WHSU5031968", updatedLocation: "CY-EXPORT:L87:1", inventoryDate: "12-12-2025 11:04:33" },
  { containerNo: "FSCU8910599", updatedLocation: "CY-EXPORT:M87:3", inventoryDate: "12-12-2025 11:04:20" },
  { containerNo: "MSMU7308460", updatedLocation: "CY-EXPORT:M87:2", inventoryDate: "12-12-2025 11:04:12" },
  { containerNo: "TLLU5588260", updatedLocation: "CY-EXPORT:M87:1", inventoryDate: "12-12-2025 11:04:04" },
  { containerNo: "CCLU7828257", updatedLocation: "CY-EXPORT:N87:2", inventoryDate: "12-12-2025 11:03:53" },
  { containerNo: "CAIU7248330", updatedLocation: "CY-EXPORT:N87:1", inventoryDate: "12-12-2025 11:03:46" },
  { containerNo: "EMCU8602906", updatedLocation: "CY-EXPORT:E72:3", inventoryDate: "12-12-2025 11:03:39" },
  { containerNo: "TRLU9822101", updatedLocation: "CY-EXPORT:F12:2", inventoryDate: "12-12-2025 10:55:12" },
  { containerNo: "XINU1234567", updatedLocation: "CY-EXPORT:G34:1", inventoryDate: "12-12-2025 10:50:30" },
  { containerNo: "YMLU5678901", updatedLocation: "CY-EXPORT:H56:4", inventoryDate: "12-12-2025 10:45:22" },
  { containerNo: "ZIMU3456789", updatedLocation: "CY-EXPORT:I78:3", inventoryDate: "12-12-2025 10:40:15" },
  { containerNo: "CMNU1122334", updatedLocation: "CY-EXPORT:J90:2", inventoryDate: "12-12-2025 10:35:05" },
]

const AssignInventoryBlock = () => {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [search, setSearch] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null })
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Filter and sort data
  const processedData = useMemo(() => {
    let data = [...mockLogData]

    if (search) {
      const lowerSearch = search.toLowerCase()
      data = data.filter(item =>
        item.containerNo.toLowerCase().includes(lowerSearch) ||
        item.updatedLocation.toLowerCase().includes(lowerSearch)
      )
    }

    if (sortConfig.key) {
      data.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return data
  }, [search, sortConfig])

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize)
  const paginatedData = processedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(processedData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Log")
    XLSX.writeFile(workbook, "inventory-log.xlsx")
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
          <div className="w-full space-y-8">

            {/* Physical Inventory Log Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-4">
                <h2 className="text-xl font-semibold tracking-wide">RAIL INVENTORY LOG</h2>
              </header>
              <div className="p-6">
                <div className="flex flex-col md:flex-row gap-6 items-end">
                  <div className="flex-1 w-full md:w-auto">
                    <label className="block text-sm font-semibold text-slate-600 mb-2">FROM</label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full md:w-64 px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700"
                    />
                  </div>
                  <div className="flex-1 w-full md:w-auto">
                    <label className="block text-sm font-semibold text-slate-600 mb-2">TO</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full md:w-64 px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700"
                    />
                  </div>
                  <div className="flex gap-4 w-full md:w-auto">
                    <button
                      onClick={() => { setFromDate(''); setToDate('') }}
                      className="flex-1 md:flex-none px-6 py-3 rounded-xl border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => notify.info('Submitting', `Submitting range: ${fromDate} to ${toDate}`)}
                      className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-[#0e4a78] text-white font-semibold hover:bg-[#0b3e66] transition shadow-md"
                    >
                      SUBMIT
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Log Details Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-wide">LOG DETAILS</h2>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleExport}
                    disabled={processedData.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 transition text-white font-semibold shadow-md text-sm disabled:opacity-50"
                  >
                    <FaFileExcel /> Export
                  </button>
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70" />
                    <input
                      type="text"
                      placeholder="Search:"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/20 w-full sm:w-64"
                    />
                  </div>
                </div>
              </header>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs md:text-sm text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                      {[
                        { key: 'containerNo', label: 'ContainerNo' },
                        { key: 'updatedLocation', label: 'Updated Location' },
                        { key: 'inventoryDate', label: 'InventoryDate' }
                      ].map((col) => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className="px-4 sm:px-5 py-3 text-left font-semibold border-r border-white/30 last:border-r-0 cursor-pointer hover:bg-white/10 transition select-none"
                        >
                          <div className="flex items-center gap-2">
                            {col.label}
                            {sortConfig.key === col.key && (
                              sortConfig.direction === 'asc' ? <FiChevronUp /> : <FiChevronDown />
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedData.map((row, index) => (
                      <tr key={index} className="hover:bg-blue-50/50 transition-colors">
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 font-medium">{row.containerNo}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">{row.updatedLocation}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">{row.inventoryDate}</td>
                      </tr>
                    ))}
                    {paginatedData.length === 0 && (
                      <tr>
                        <td colSpan="3" className="px-6 py-8 text-center text-slate-500">
                          No records found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600">
                <div>
                  Showing {Math.min((currentPage - 1) * pageSize + 1, processedData.length)} to {Math.min(currentPage * pageSize, processedData.length)} of {processedData.length} entries
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
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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
            </section>

          </div>
        </main>
        <Footer />
      </div>
    </div>
  )
}

export default AssignInventoryBlock