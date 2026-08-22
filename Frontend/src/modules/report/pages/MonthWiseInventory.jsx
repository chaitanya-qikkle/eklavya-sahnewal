import React, { useState, useMemo } from 'react'
import { FiSearch, FiChevronUp, FiChevronDown, FiList } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'

// Mock Data for Table
const mockData = [
  { containerNo: "WSNU6849865", transactionDate: "06-12-2025 14:06:08" },
  { containerNo: "WSDU8877866", transactionDate: "05-12-2025 07:06:20" },
  { containerNo: "WSCU5247659", transactionDate: "11-12-2025 11:07:30" },
  { containerNo: "WRSU6205750", transactionDate: "10-12-2025 19:13:11" },
  { containerNo: "WRSU2329497", transactionDate: "12-12-2025 09:30:47" },
  { containerNo: "WRLU5834861", transactionDate: "10-12-2025 03:29:21" },
  { containerNo: "WRLU0516209", transactionDate: "12-12-2025 00:02:41" },
  { containerNo: "WHSU5826809", transactionDate: "07-12-2025 21:35:26" },
  { containerNo: "WHSU2625950", transactionDate: "07-12-2025 18:30:29" },
  { containerNo: "WHMU5216830", transactionDate: "09-12-2025 17:46:14" },
]

const MonthWiseInventory = () => {
  const [fromDate, setFromDate] = useState('2025-12-03')
  const [toDate, setToDate] = useState('2025-12-13')
  const [globalSearch, setGlobalSearch] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null })
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Filtering Logic
  const filteredData = useMemo(() => {
    let data = [...mockData]

    if (globalSearch) {
      const lowerSearch = globalSearch.toLowerCase()
      data = data.filter(item =>
        Object.values(item).some(val =>
          val.toString().toLowerCase().includes(lowerSearch)
        )
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
  }, [globalSearch, sortConfig])

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / pageSize)
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mismatch Containers")
    XLSX.writeFile(workbook, "mismatch-containers.xlsx")
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

            {/* Filter Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-3">
                <h2 className="text-lg font-semibold tracking-wide uppercase">MISMATCH CONTAINER</h2>
              </header>
              <div className="p-6">
                <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <label className="text-xs font-bold text-slate-700 uppercase whitespace-nowrap min-w-[60px] text-right">FROM</label>
                    <div className="relative w-full md:w-64">
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <label className="text-xs font-bold text-slate-700 uppercase whitespace-nowrap min-w-[60px] text-right">TO DATE</label>
                    <div className="relative w-full md:w-64">
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 w-full md:w-auto mt-2 md:mt-0 justify-center">
                    <button className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 transition">
                      Cancel
                    </button>
                    <button
                      className="px-8 py-2.5 rounded-lg bg-[#0e4a78] text-white font-bold hover:bg-[#0b3e66] transition uppercase tracking-wide shadow-md"
                    >
                      SUBMIT
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Detailed Table Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col">

              {/* Toolbar */}
              <div className="px-6 py-3 border-b border-slate-200 flex justify-between items-center gap-4">
                <button
                  onClick={handleExport}
                  className="w-8 h-8 flex items-center justify-center bg-green-600 text-white rounded shadow hover:bg-green-700 transition"
                  title="Export Excel"
                >
                  <FaFileExcel />
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-medium">Search:</span>
                  <input
                    type="text"
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    className="px-3 py-1 border border-slate-300 rounded w-48 focus:outline-none focus:border-[#0e4a78]"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto w-full">
                <table className="min-w-full text-xs md:text-sm text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                      <th className="px-4 sm:px-5 py-3 text-center border-r border-white/30 w-16">#</th>

                      <th
                        onClick={() => handleSort('containerNo')}
                        className="px-4 sm:px-5 py-3 text-left font-semibold border-r border-white/30 cursor-pointer hover:bg-white/10"
                      >
                        <div className="flex items-center gap-1">
                          CONTAINER NO
                          <div className="flex flex-col opacity-50">
                            <FiChevronUp className="w-2.5 h-2.5 -mb-0.5" />
                            <FiChevronDown className="w-2.5 h-2.5 -mt-0.5" />
                          </div>
                        </div>
                      </th>

                      <th
                        onClick={() => handleSort('transactionDate')}
                        className="px-4 sm:px-5 py-3 text-left font-semibold cursor-pointer hover:bg-white/10"
                      >
                        <div className="flex items-center gap-1">
                          TRANSACTION DATE
                          <div className="flex flex-col opacity-50">
                            <FiChevronUp className="w-2.5 h-2.5 -mb-0.5" />
                            <FiChevronDown className="w-2.5 h-2.5 -mt-0.5" />
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedData.length > 0 ? (
                      paginatedData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-4 sm:px-5 py-3 border-r border-slate-200 text-center">
                            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-[#0e4a78]">
                              <FiList />
                            </div>
                          </td>
                          <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 font-medium">{row.containerNo}</td>
                          <td className="px-4 sm:px-5 py-3 text-slate-700">{row.transactionDate}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="px-6 py-8 text-center text-slate-500">
                          No data available in table
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600">
                <div>
                  Showing {Math.min((currentPage - 1) * pageSize + 1, filteredData.length)} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} entries
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-[#0e4a78] font-semibold"
                  >
                    Previous
                  </button>
                  <button className="px-3 py-1 rounded border bg-[#0e4a78] text-white border-[#0e4a78]">
                    1
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-[#0e4a78] font-semibold"
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

export default MonthWiseInventory