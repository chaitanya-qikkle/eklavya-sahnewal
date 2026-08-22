import React, { useState } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'

const navisionRecords = [
  { id: 1, processType: 'INS_StuffDestuff', lastSyncDate: '18-07-2024 16:00:01' },
  { id: 2, processType: 'RailIn', lastSyncDate: '18-07-2024 16:00:01' },
  { id: 3, processType: 'RoadOut', lastSyncDate: '18-07-2024 15:50:14' },
  { id: 4, processType: 'RailOut', lastSyncDate: '18-07-2024 15:00:39' },
  { id: 5, processType: 'PreRoadIn', lastSyncDate: '18-07-2024 12:52:03' },
  { id: 6, processType: 'GateIn', lastSyncDate: '18-07-2024 00:00:01' },
  { id: 7, processType: 'PreGateOut', lastSyncDate: '16-12-2025 10:55:13' },
  { id: 8, processType: 'UPD_StuffDestuff', lastSyncDate: '16-12-2025 10:54:03' },
  { id: 9, processType: 'INSMismatch', lastSyncDate: '16-12-2025 10:54:02' },
  { id: 10, processType: 'PreRailIn', lastSyncDate: '16-12-2025 10:00:31' },
  { id: 11, processType: 'TrailerOut', lastSyncDate: '16-12-2025 09:07:19' },
  { id: 12, processType: 'UPD_UNWANTED', lastSyncDate: '15-12-2025 23:51:24' }
]

const NavisionStatus = () => {
  const [navisionType, setNavisionType] = useState('GateOut')
  const [search, setSearch] = useState('')

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(navisionRecords)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'NavisionStatus')
    XLSX.writeFile(wb, `NavisionStatus_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const filteredData = navisionRecords.filter(item => {
    if (search && !item.processType.toLowerCase().includes(search.toLowerCase())) {
      return false
    }
    return true
  })

  // Define columns for better mapping
  const columns = [
    { key: 'processType', label: 'PROCESS TYPE' },
    { key: 'lastSyncDate', label: 'LAST SYNC DATE' },
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

            {/* Header / Filter Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-3 shadow-md">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  Navision Status
                </h2>
              </div>

              <div className="p-8 bg-slate-50/50">
                <div className="flex flex-col md:flex-row items-center justify-center gap-4">

                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <label className="text-sm font-bold text-slate-700 uppercase whitespace-nowrap">Navision Type</label>
                    <div className="relative w-full md:w-96">
                      <select
                        value={navisionType}
                        onChange={(e) => setNavisionType(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm"
                      >
                        <option value="GateOut">GateOut</option>
                        <option value="GateIn">GateIn</option>
                        <option value="RailOut">RailOut</option>
                        <option value="RailIn">RailIn</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="px-8 py-2 bg-[#0e4a78] text-white rounded text-sm font-bold hover:bg-[#0a3b61] transition-colors shadow-md uppercase"
                    >
                      Filter
                    </button>
                  </div>

                </div>
              </div>
            </section>

            {/* Table Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
                <h2 className="text-white font-bold text-xl tracking-wide uppercase">
                  Navision Report Summary
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExport}
                    className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
                  >
                    <FaFileExcel className="text-lg" />
                  </button>
                </div>
              </div>

              <div className="px-6 py-6 space-y-4">
                <div className="flex justify-end">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-600">Search:</label>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-sm"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] sticky top-0">
                      <tr>
                        {columns.map((column) => (
                          <th key={column.key} className="px-6 py-4 text-left text-xs font-bold text-white tracking-wider border-r border-white/10 last:border-r-0 w-1/2">
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredData.map((row, index) => (
                        <tr key={index} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-slate-700 border-r border-slate-100">{row.processType}</td>
                          <td className="px-6 py-4 text-slate-600">{row.lastSyncDate}</td>
                        </tr>
                      ))}
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

export default NavisionStatus
