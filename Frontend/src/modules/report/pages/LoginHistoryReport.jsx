import React, { useState } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FiCalendar } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'

const loginRecords = [
  { id: 1, fullName: 'Ishwari Vishe', username: 'Ishwari', loginTime: '03-12-2025 14:36:36', logoutTime: '03-12-2025 14:40:51', sessionTime: '000:04', status: 'INACTIVE' },
  { id: 2, fullName: 'Ishwari Vishe', username: 'Ishwari', loginTime: '03-12-2025 14:35:06', logoutTime: '03-12-2025 14:36:36', sessionTime: '000:01', status: 'INACTIVE' },
]

const LoginHistoryReport = () => {
  const [user, setUser] = useState('Ishwari')
  const [fromDate, setFromDate] = useState('2025-11-30')
  const [toDate, setToDate] = useState('2025-12-16')
  const [search, setSearch] = useState('')

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(loginRecords)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'LoginHistory')
    XLSX.writeFile(wb, `LoginHistory_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleCancel = () => {
    setUser('Ishwari')
    setFromDate('')
    setToDate('')
    setSearch('')
  }

  // Columns definition
  const columns = [
    { key: 'fullName', label: 'FULL NAME' },
    { key: 'username', label: 'USERNAME' },
    { key: 'loginTime', label: 'LOGIN TIME' },
    { key: 'logoutTime', label: 'LOGOUT TIME' },
    { key: 'sessionTime', label: 'SESSION TIME' },
    { key: 'status', label: 'STATUS' },
  ]

  const filteredData = loginRecords.filter(item => {
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
              <div className="bg-[#0e4a78] px-6 py-3 border-b border-blue-800">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  LOGIN HISTORY
                </h2>
              </div>

              <div className="p-6 bg-white">
                <div className="flex flex-col lg:flex-row items-center justify-center gap-6">

                  {/* User */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full lg:w-auto">
                    <label className="text-sm font-bold text-slate-700 uppercase whitespace-nowrap min-w-[60px]">USER</label>
                    <div className="relative w-full sm:w-64">
                      <select
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm bg-white text-slate-700"
                      >
                        <option value="Ishwari">Ishwari</option>
                        <option value="Admin">Admin</option>
                        <option value="User1">User1</option>
                      </select>
                    </div>
                  </div>

                  {/* From Date */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full lg:w-auto">
                    <label className="text-sm font-bold text-slate-700 uppercase whitespace-nowrap min-w-[60px]">FROM</label>
                    <div className="relative w-full sm:w-48">
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm text-slate-700"
                      />
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    </div>
                  </div>

                  {/* To Date */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full lg:w-auto">
                    <label className="text-sm font-bold text-slate-700 uppercase whitespace-nowrap min-w-[30px]">TO</label>
                    <div className="relative w-full sm:w-48">
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm text-slate-700"
                      />
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-auto lg:ml-0 mt-4 lg:mt-0 w-full lg:w-auto justify-end">
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
              <div className="bg-[#0e4a78] px-6 py-3 shadow-md">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  LOGIN HISTORY REPORT
                </h2>
              </div>

              <div className="px-6 py-6 space-y-4">

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExport}
                      className="p-1"
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
                    {/* Table Header with Default Blue Gradient */}
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
                      {filteredData.length > 0 ? (
                        filteredData.map((row, index) => (
                          <tr key={index} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                            {columns.map((column) => (
                              <td key={column.key} className="px-5 py-3 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0">
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

              </div>

            </section>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default LoginHistoryReport