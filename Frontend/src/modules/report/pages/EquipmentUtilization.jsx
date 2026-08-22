import React, { useState } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FiCalendar, FiFilter } from 'react-icons/fi'
import { FaFileExcel, FaFilePdf } from 'react-icons/fa'
import * as XLSX from 'xlsx'

const equipmentRecords = [
  // No data available in table as per image, but adding empty state handling
]

const EquipmentUtilization = () => {
  const [eqpName, setEqpName] = useState('All selected (12)')
  const [fromDate, setFromDate] = useState('2025-12-09T11:15')
  const [toDate, setToDate] = useState('2025-12-08T11:15')
  const [search, setSearch] = useState('')

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(equipmentRecords)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'EquipmentUtilization')
    XLSX.writeFile(wb, `EquipmentUtilization_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleClear = () => {
    setEqpName('All selected (12)')
    setFromDate('')
    setToDate('')
    setSearch('')
  }

  // Columns definition
  const columns = [
    { key: 'equipment', label: 'EQUIPMENT' },
    { key: 'utilizationDate', label: 'UTILIZATION DATE' },
    { key: 'totalLiftup', label: 'TOTAL LIFTUP' },
    { key: 'import', label: 'IMPORT' },
    { key: 'export', label: 'EXPORT' },
    { key: 'rail', label: 'RAIL' },
    { key: 'domestic', label: 'DOMESTIC' },
    { key: 'gdl', label: 'GDL' },
    { key: 'laden', label: 'LADEN' },
    { key: 'empty', label: 'EMPTY' },
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

            {/* Filter Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <div className="bg-[#0e4a78] px-6 py-3 border-b border-blue-800">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  EQUIPMENT UTILIZATION
                </h2>
              </div>

              <div className="p-6 bg-white">
                <div className="flex flex-col xl:flex-row items-center justify-between gap-6">

                  <div className="flex flex-col lg:flex-row items-center gap-6 w-full flex-wrap">

                    {/* Eqp Name */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full lg:w-auto">
                      <label className="text-sm font-bold text-slate-700 uppercase whitespace-nowrap min-w-[80px]">EQP NAME <span className="text-red-500">*</span></label>
                      <div className="relative w-full sm:w-64">
                        <select
                          value={eqpName}
                          onChange={(e) => setEqpName(e.target.value)}
                          className="w-full px-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm bg-slate-50 text-slate-700"
                        >
                          <option value="All selected (12)">All selected (12)</option>
                          <option value="KC-11">KC-11</option>
                          <option value="KC-12">KC-12</option>
                        </select>
                      </div>
                    </div>

                    {/* From Date */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full lg:w-auto">
                      <label className="text-sm font-bold text-slate-700 uppercase whitespace-nowrap min-w-[80px]">FROM DATE <span className="text-red-500">*</span></label>
                      <div className="relative w-full sm:w-64">
                        <input
                          type="datetime-local"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                          // Added text-slate-700 ensures text is visible 
                          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm text-slate-700"
                        />
                        <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      </div>
                    </div>

                    {/* To Date */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full lg:w-auto">
                      <label className="text-sm font-bold text-slate-700 uppercase whitespace-nowrap min-w-[80px]">TO DATE <span className="text-red-500">*</span></label>
                      <div className="relative w-full sm:w-64">
                        <input
                          type="datetime-local"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          // Added text-slate-700 ensures text is visible
                          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm text-slate-700"
                        />
                        <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto lg:ml-0 mt-4 lg:mt-0 w-full lg:w-auto justify-end">
                      <button
                        onClick={handleClear}
                        className="px-4 py-2 bg-slate-100 border border-slate-300 text-slate-600 rounded text-sm font-medium hover:bg-slate-200 transition-colors shadow-sm"
                      >
                        Clear
                      </button>
                      <button
                        className="px-6 py-2 bg-[#0e4a78] text-white rounded text-sm font-bold hover:bg-[#0a3b61] transition-colors shadow-md uppercase"
                      >
                        Filter
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </section>

            {/* Table Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-3 shadow-md">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  EQUIPMENT UTILIZATION SUMMARY
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
                    <button
                      className="p-1"
                      title="Export to PDF"
                    >
                      <FaFilePdf className="text-3xl text-red-600 hover:text-red-700 transition-colors" />
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
                      {equipmentRecords.length > 0 ? (
                        equipmentRecords.map((row, index) => (
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
                          <td colSpan={columns.length} className="px-5 py-3 text-slate-500">
                            No data available in table
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Showing 0 to 0 of 0 entries
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button className="px-3 py-1 border border-slate-300 rounded text-slate-500 text-sm hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
                  <button className="px-3 py-1 border border-slate-300 rounded text-slate-500 text-sm hover:bg-slate-50 disabled:opacity-50" disabled>Next</button>
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

export default EquipmentUtilization
