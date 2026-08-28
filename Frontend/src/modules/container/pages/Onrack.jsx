import React, { useState, useMemo } from 'react'
import { FiSearch, FiRefreshCw, FiChevronUp, FiChevronDown } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { notify } from '../../../utils/notify'

const mockOnRackData = Array.from({ length: 105 }).map((_, i) => ({
  containerNo: `MSKU${8961782 + i}`,
  size: i % 2 === 0 ? "40" : "20",
  type: "DRY",
  transactionType: i % 3 === 0 ? "IMPORT" : "",
  documentNo: "MDP/RJ/I/25-26/00724",
  mode: "Rail",
  location: "ON RAKE (NRY)",
  gateInDate: "12-12-2025 13:16:08",
  transactionDate: "12-12-2025 13:16:08",
  gateInTat: "000:09",
  equipmentName: "",
  noOfMoves: 0
}))

const Onrack = () => {
  const [containerSearch, setContainerSearch] = useState('')
  const [globalSearch, setGlobalSearch] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null })
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Filtering Logic
  const filteredData = useMemo(() => {
    let data = [...mockOnRackData]

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
    XLSX.utils.book_append_sheet(workbook, worksheet, "OnRack Containers")
    XLSX.writeFile(workbook, "onrack-containers.xlsx")
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

            {/* Top Search Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-3">
                <h2 className="text-lg font-semibold tracking-wide uppercase">ON RACK CONTAINER STATUS</h2>
              </header>
              <div className="p-6">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-4">
                  <label className="font-bold text-slate-700 whitespace-nowrap">CONTAINER NO</label>
                  <input
                    type="text"
                    placeholder="Search Container no"
                    value={containerSearch}
                    onChange={(e) => setContainerSearch(e.target.value)}
                    className="flex-1 w-full px-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50"
                  />
                  <button
                    className="px-8 py-2 bg-[#0e4a78] text-white font-bold rounded shadow hover:bg-[#0b3e66] transition uppercase tracking-wide"
                    onClick={() => notify.info('Searching', `Searching for ${containerSearch}`)}
                  >
                    SUBMIT
                  </button>
                </div>
              </div>
            </section>

            {/* Results Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col">
              {/* Blue Header with Count and Refresh */}
              <div className="bg-[#0e4a78] text-white px-6 py-2 flex justify-between items-center">
                <h3 className="text-lg font-bold">Count ( {filteredData.length} )</h3>
                <button className="text-white hover:text-blue-200 transition">
                  <FiRefreshCw className="text-xl" />
                </button>
              </div>

              {/* Toolbar with Excel and Search */}
              <div className="px-6 py-3 border-b border-slate-200 flex justify-between items-center gap-4">
                <button
                  onClick={handleExport}
                  disabled={filteredData.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 transition text-white font-semibold shadow-md text-sm disabled:opacity-50"
                >
                  <FaFileExcel /> Export
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

              {/* Table Container with Horizontal Scroll */}
              <div className="overflow-x-auto w-full">
                <table className="min-w-[1200px] text-xs md:text-sm text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                      {[
                        { key: 'containerNo', label: 'Container No' },
                        { key: 'size', label: 'Container Size' },
                        { key: 'type', label: 'Container Type' },
                        { key: 'transactionType', label: 'Transaction Type' },
                        { key: 'documentNo', label: 'Document No' },
                        { key: 'mode', label: 'Mode' },
                        { key: 'location', label: 'Location' },
                        { key: 'gateInDate', label: 'Gate In Date' },
                        { key: 'transactionDate', label: 'Transaction Date' },
                        { key: 'gateInTat', label: 'GateIn TAT' },
                        { key: 'equipmentName', label: 'Equipment Name' },
                        { key: 'noOfMoves', label: 'NoOfMoves' }
                      ].map(col => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className="px-5 py-3 text-left font-semibold border-r border-white/30 last:border-r-0 cursor-pointer hover:bg-white/10 whitespace-nowrap"
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
                    {paginatedData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                        <td className="px-5 py-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">
                          <span className="font-mono font-semibold text-slate-900">{row.containerNo}</span>
                        </td>
                        <td className="px-5 py-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">{row.size}</td>
                        <td className="px-5 py-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">{row.type}</td>
                        <td className="px-5 py-3 border-r border-slate-200 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${row.transactionType === 'IMPORT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            'bg-slate-50 text-slate-700 border-slate-200'
                            }`}>
                            {row.transactionType || '-'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">{row.documentNo}</td>
                        <td className="px-5 py-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">{row.mode}</td>
                        <td className="px-5 py-3 border-r border-slate-200 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="font-medium text-slate-800">{row.location}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">{row.gateInDate}</td>
                        <td className="px-5 py-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">{row.transactionDate}</td>
                        <td className="px-5 py-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">{row.gateInTat}</td>
                        <td className="px-5 py-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">{row.equipmentName}</td>
                        <td className="px-5 py-3 text-slate-700 whitespace-nowrap">{row.noOfMoves}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600">
                <div>
                  Showing {Math.min((currentPage - 1) * pageSize + 1, filteredData.length)} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} entries
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

export default Onrack