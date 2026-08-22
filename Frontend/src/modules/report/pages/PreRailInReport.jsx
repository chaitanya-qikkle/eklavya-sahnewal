import React, { useState } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FaFileExcel } from 'react-icons/fa'
import { CgGoogleTasks } from "react-icons/cg";
import * as XLSX from 'xlsx'

// Mock data for the report
const reportData = [
  { id: 1, containerNo: 'GCXU5744179', navisionDate: '30-11-2025 06:05:00', size: 40, documentNo: 'KIC/RJ/I/25-26/00028', process: 'Import', bookingNo: 'MDP/I/BK/25-26/05838', terminal: 'SNL', status: 'Laden', ismail: 'YES', yardIntime: '02-12-2025 08:42:00' },
  { id: 2, containerNo: 'HAMU1048425', navisionDate: '30-11-2025 06:05:00', size: 20, documentNo: 'KIC/RJ/I/25-26/00028', process: 'Import', bookingNo: 'KIC/I/BK/25-26/00067', terminal: 'PIYALA', status: 'Laden', ismail: 'YES', yardIntime: '02-12-2025 08:40:00' },
  { id: 3, containerNo: 'HASU4600503', navisionDate: '30-11-2025 06:05:00', size: 40, documentNo: 'KIC/RJ/I/25-26/00028', process: 'Import', bookingNo: 'MDP/I/BK/25-26/05783', terminal: 'KSP', status: 'Laden', ismail: 'YES', yardIntime: '02-12-2025 08:38:00' },
  { id: 4, containerNo: 'HASU4868585', navisionDate: '30-11-2025 06:05:00', size: 40, documentNo: 'KIC/RJ/I/25-26/00028', process: 'Import', bookingNo: 'MDP/I/BK/25-26/05783', terminal: 'KSP', status: 'Laden', ismail: 'YES', yardIntime: '02-12-2025 08:43:00' },
  { id: 5, containerNo: 'HASU5143280', navisionDate: '30-11-2025 06:05:00', size: 40, documentNo: 'KIC/RJ/I/25-26/00028', process: 'Import', bookingNo: 'MDP/I/BK/25-26/05783', terminal: 'KSP', status: 'Laden', ismail: 'YES', yardIntime: '02-12-2025 08:31:00' },
  { id: 6, containerNo: 'HASU5187056', navisionDate: '30-11-2025 06:05:00', size: 40, documentNo: 'KIC/RJ/I/25-26/00028', process: 'Import', bookingNo: 'MDP/I/BK/25-26/05783', terminal: 'KSP', status: 'Laden', ismail: 'YES', yardIntime: '02-12-2025 08:42:00' },
  { id: 7, containerNo: 'HJCU1609036', navisionDate: '30-11-2025 06:05:00', size: 40, documentNo: 'KIC/RJ/I/25-26/00028', process: 'Import', bookingNo: 'MDP/I/BK/25-26/05839', terminal: 'GHH', status: 'Laden', ismail: 'YES', yardIntime: '02-12-2025 08:39:00' },
  { id: 8, containerNo: 'HLBU3500278', navisionDate: '30-11-2025 06:05:00', size: 20, documentNo: 'KIC/RJ/I/25-26/00028', process: 'Import', bookingNo: 'KIC/I/BK/25-26/00067', terminal: 'PIYALA', status: 'Laden', ismail: 'YES', yardIntime: '02-12-2025 08:39:00' },
  { id: 9, containerNo: 'HLBU3669503', navisionDate: '30-11-2025 06:05:00', size: 20, documentNo: 'KIC/RJ/I/25-26/00028', process: 'Import', bookingNo: 'KIC/I/BK/25-26/00068', terminal: 'PIYALA', status: 'Laden', ismail: 'YES', yardIntime: '02-12-2025 08:41:00' },
]

const PreRailInReport = () => {
  const [documentNo, setDocumentNo] = useState('KIC/RJ/I/25-26/00028')
  const [search, setSearch] = useState('')

  // Export to Excel function
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(reportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'PreRailJourneyReport')
    XLSX.writeFile(wb, `PreRailJourneyReport_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Clear filters
  const handleCancel = () => {
    setDocumentNo('')
    setSearch('')
  }

  // Table Columns definition
  const columns = [
    { key: 'icon', label: '#' },
    { key: 'containerNo', label: 'CONTAINER NO' },
    { key: 'navisionDate', label: 'NAVISION DATE' },
    { key: 'size', label: 'SIZE' },
    { key: 'documentNo', label: 'DOCUMENT NO' },
    { key: 'process', label: 'PROCESS' },
    { key: 'bookingNo', label: 'BOOKING NO' },
    { key: 'terminal', label: 'TERMINAL' },
    { key: 'status', label: 'CONTAINER STATUS' },
    { key: 'ismail', label: 'ISMAIL' },
    { key: 'yardIntime', label: 'YARD INTIME' },
  ]

  // Filter logic
  const filteredData = reportData.filter(item => {
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
                  ALL RAIL JOURNEY DETAIL
                </h2>
              </div>

              <div className="p-6 bg-white">
                <div className="flex flex-col lg:flex-row items-center justify-center gap-6">

                  {/* Document No Filter */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full lg:w-auto">
                    <label className="text-sm font-bold text-slate-700 uppercase whitespace-nowrap min-w-[60px] text-right">DOCUMENT NO</label>
                    <div className="relative w-full sm:w-[500px]">
                      <select
                        value={documentNo}
                        onChange={(e) => setDocumentNo(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm bg-slate-50 text-slate-700"
                      >
                        <option value="KIC/RJ/I/25-26/00028">KIC/RJ/I/25-26/00028</option>
                        <option value="KIC/RJ/I/25-26/00029">KIC/RJ/I/25-26/00029</option>
                      </select>
                    </div>
                  </div>

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

            {/* Table Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              {/* Default Blue Gradient Header */}
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-3 shadow-md">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  PRE RAIL JOURNEY REPORT BY DOCUMENT
                </h2>
              </div>

              <div className="px-6 py-6 space-y-4">

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExport}
                      className="p-1 items-center justify-center flex"
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
                    {/* Default Blue Gradient Header for Table */}
                    <thead className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61]">
                      <tr>
                        {columns.map((column) => (
                          <th key={column.key} className="px-3 py-3 text-left font-bold text-white uppercase tracking-wider border-r border-[#ffffff40] last:border-r-0 whitespace-nowrap">
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredData.length > 0 ? (
                        filteredData.map((row, index) => (
                          <tr key={index} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="px-3 py-3 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0">
                              {/* Adjusted icon color to match default theme */}
                              <CgGoogleTasks className="text-[#0e4a78] text-xl border border-[#0e4a78] rounded p-0.5" />
                            </td>
                            <td className="px-3 py-3 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0 font-medium">
                              {row.containerNo}
                            </td>
                            <td className="px-3 py-3 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0">
                              {row.navisionDate}
                            </td>
                            <td className="px-3 py-3 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0">
                              {row.size}
                            </td>
                            <td className="px-3 py-3 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0">
                              {row.documentNo}
                            </td>
                            <td className="px-3 py-3 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0">
                              {row.process}
                            </td>
                            <td className="px-3 py-3 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0">
                              {row.bookingNo}
                            </td>
                            <td className="px-3 py-3 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0">
                              {row.terminal}
                            </td>
                            <td className="px-3 py-3 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0">
                              {row.status}
                            </td>
                            <td className="px-3 py-3 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0">
                              {row.ismail}
                            </td>
                            <td className="px-3 py-3 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0">
                              {row.yardIntime}
                            </td>
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
              </div>

            </section>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default PreRailInReport
