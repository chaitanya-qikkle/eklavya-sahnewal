import React, { useState } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'

// Mock data matching the reference image layout
const taskRecords = [
  { id: 1, yardName: 'BK-WH04', totalTask: 1, completedTask: 0, pendingTask: 1, nearByEquipment: '' },
  { id: 2, yardName: 'CY-EXPORT', totalTask: 86, completedTask: 60, pendingTask: 26, nearByEquipment: 'K-18' },
  { id: 3, yardName: 'CY-HAZ-EXP', totalTask: 6, completedTask: 5, pendingTask: 1, nearByEquipment: '' },
  { id: 4, yardName: 'CY-IMPORT', totalTask: 1, completedTask: 1, pendingTask: 0, nearByEquipment: 'KC-14,KC-16' },
  { id: 5, yardName: 'CY-YARD', totalTask: 30, completedTask: 14, pendingTask: 16, nearByEquipment: '' },
  { id: 6, yardName: 'NRY', totalTask: 28, completedTask: 28, pendingTask: 0, nearByEquipment: 'KC-10' },
  { id: 7, yardName: 'NRY-START-POINT', totalTask: 6, completedTask: 6, pendingTask: 0, nearByEquipment: '' },
  { id: 8, yardName: 'WH0102', totalTask: 4, completedTask: 4, pendingTask: 0, nearByEquipment: 'KC-07' },
]

// Summary card data
const summaryData = {
  total: 162,
  completed: 118,
  pending: 44
}

const TaskAllocationSummary = () => {
  const [search, setSearch] = useState('')

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(taskRecords)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'TaskAllocationSummary')
    XLSX.writeFile(wb, `TaskAllocationSummary_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const filteredData = taskRecords.filter(item => {
    if (search && !Object.values(item).some(val => String(val).toLowerCase().includes(search.toLowerCase()))) {
      return false
    }
    return true
  })

  // Table columns definition
  const columns = [
    { key: 'yardName', label: 'Yard Name' },
    { key: 'totalTask', label: 'Total Task' },
    { key: 'completedTask', label: 'CompletedTask' },
    { key: 'pendingTask', label: 'Pending Task' },
    { key: 'nearByEquipment', label: 'Near By Equipment' },
  ]

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

            {/* Summary Section - Custom Colored Cards */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              {/* Section Header with Default Blue Gradient */}
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-3 border-b border-blue-800">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  TASK ALLOCATION COUNT
                </h2>
              </div>

              <div className="p-6 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                  {/* Total Card - Orange */}
                  <div className="bg-[#f59e0b] rounded-lg p-4 text-white relative h-32 flex flex-col justify-between shadow-md overflow-hidden">
                    <div className="absolute right-0 bottom-0 text-6xl font-black text-black/10 -rotate-12 translate-x-4 translate-y-4">
                      TOTAL
                    </div>
                    <div className="relative z-10">
                      <div className="text-5xl font-bold">{summaryData.total}</div>
                      <div className="font-semibold text-lg mt-1 uppercase">TOTAL</div>
                    </div>
                    <div className="relative z-10 self-end font-bold italic text-black/20 text-xl tracking-widest">
                      TOTAL
                    </div>
                  </div>

                  {/* Completed Card - Cyan */}
                  <div className="bg-[#06b6d4] rounded-lg p-4 text-white relative h-32 flex flex-col justify-between shadow-md overflow-hidden">
                    <div className="absolute right-0 bottom-0 text-6xl font-black text-black/10 -rotate-12 translate-x-4 translate-y-4">
                      COMPLETED
                    </div>
                    <div className="relative z-10">
                      <div className="text-5xl font-bold">{summaryData.completed}</div>
                      <div className="font-semibold text-lg mt-1 uppercase">COMPLETED</div>
                    </div>
                    <div className="relative z-10 self-end font-bold italic text-black/20 text-xl tracking-widest">
                      COMPLETED
                    </div>
                  </div>

                  {/* Pending Card - Red */}
                  <div className="bg-[#ef4444] rounded-lg p-4 text-white relative h-32 flex flex-col justify-between shadow-md overflow-hidden">
                    <div className="absolute right-0 bottom-0 text-6xl font-black text-black/10 -rotate-12 translate-x-4 translate-y-4">
                      PENDING
                    </div>
                    <div className="relative z-10">
                      <div className="text-5xl font-bold">{summaryData.pending}</div>
                      <div className="font-semibold text-lg mt-1 uppercase">PENDING</div>
                    </div>
                    <div className="relative z-10 self-end font-bold italic text-black/20 text-xl tracking-widest">
                      PENDING
                    </div>
                  </div>

                </div>
              </div>
            </section>

            {/* Table Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              {/* Section Header with Default Blue Gradient */}
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-3 shadow-md">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  TASK ALLOCATION SUMMARY
                </h2>
              </div>

              <div className="px-6 py-6 space-y-4">

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <button
                    onClick={handleExport}
                    className="p-1 items-center justify-center flex"
                    title="Export to Excel"
                  >
                    <FaFileExcel className="text-3xl text-green-700 hover:text-green-800 transition-colors" />
                  </button>

                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-600">Search:</label>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500 w-64"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-sm shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    {/* Table Header with Default Blue Gradient */}
                    <thead className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61]">
                      <tr>
                        {columns.map((column) => (
                          <th key={column.key} className="px-5 py-3 text-left font-bold text-white tracking-wider border-r border-[#ffffff40] last:border-r-0">
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredData.map((row, index) => (
                        <tr key={index} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                          {columns.map((column) => (
                            <td key={column.key} className="px-5 py-3 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0">
                              {row[column.key]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Showing 1 to {filteredData.length} of {filteredData.length} entries
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

export default TaskAllocationSummary
