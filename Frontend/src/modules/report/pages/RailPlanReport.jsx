import React, { useState, useMemo } from 'react'
import { FiSearch, FiChevronUp, FiChevronDown, FiArrowRight } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'

// Mock Data for Left Panel (Journeys)
const mockJourneys = [
  { count: 108, documentNo: "MDP/RJ/I/25-26/00724", navReleaseTime: "10-12-2025 05:00:00", ocrGateInTime: "12-12-2025 13:00" },
  { count: 135, documentNo: "MDP/RJ/I/25-26/00723", navReleaseTime: "09-12-2025 20:40:00", ocrGateInTime: "12-12-2025 07:45" },
  { count: 109, documentNo: "GRV/RJ/I/25-26/00202", navReleaseTime: "10-12-2025 19:05:00", ocrGateInTime: "12-12-2025 04:30" },
  { count: 28, documentNo: "SNL/RJ/X/25-26/00389", navReleaseTime: "11-12-2025 03:50:00", ocrGateInTime: "12-12-2025 02:15" },
  { count: 22, documentNo: "KSP/RJ/X/25-26/00205", navReleaseTime: "11-12-2025 01:20:00", ocrGateInTime: "12-12-2025 00:00" },
  { count: 87, documentNo: "MDP/RJ/I/25-26/00721", navReleaseTime: "09-12-2025 04:35:00", ocrGateInTime: "11-12-2025 20:10" },
  { count: 57, documentNo: "SNL/RJ/X/25-26/00387", navReleaseTime: "10-12-2025 03:25:00", ocrGateInTime: "11-12-2025 02:40" },
  { count: 101, documentNo: "GRV/RJ/I/25-26/00201", navReleaseTime: "09-12-2025 14:15:00", ocrGateInTime: "11-12-2025 01:00" },
  { count: 77, documentNo: "MDP/RJ/I/25-26/00722", navReleaseTime: "09-12-2025 09:00:00", ocrGateInTime: "10-12-2025 23:30" },
  { count: 7, documentNo: "KSP/RJ/X/25-26/00203", navReleaseTime: "09-12-2025 15:45:00", ocrGateInTime: "10-12-2025 06:20" },
]

// Mock Data Generator for Right Panel Details
const generateDetails = (docNo) => {
  const count = mockJourneys.find(j => j.documentNo === docNo)?.count || 5;
  return Array.from({ length: Math.min(count, 20) }, (_, i) => ({
    containerNo: `CNTR${docNo.slice(-4)}${i.toString().padStart(3, '0')}`,
    size: i % 3 === 0 ? "40" : "20",
    type: "DRY",
    status: "Gate In",
    sealNo: `SL${Math.floor(Math.random() * 100000)}`
  }));
};

const RailPlanReport = () => {
  const [fromDate, setFromDate] = useState('2025-12-04')
  const [toDate, setToDate] = useState('2025-12-16')
  const [searchLeft, setSearchLeft] = useState('')
  const [selectedDoc, setSelectedDoc] = useState(null)

  // Left Panel Logic
  const filteredJourneys = useMemo(() => {
    return mockJourneys.filter(item =>
      item.documentNo.toLowerCase().includes(searchLeft.toLowerCase())
    )
  }, [searchLeft])

  // Right Panel Logic
  const detailData = useMemo(() => {
    if (!selectedDoc) return [];
    return generateDetails(selectedDoc);
  }, [selectedDoc]);

  const handleExportLeft = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredJourneys)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rail Journeys")
    XLSX.writeFile(workbook, "rail-journeys.xlsx")
  }

  return (
    <div
      className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
          <div className="w-full space-y-8">

            {/* Filter Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-3">
                <h2 className="text-lg font-semibold tracking-wide uppercase">RAIL JOURNEY DETAIL</h2>
              </header>
              <div className="p-4 sm:p-6">
                <div className="flex flex-col lg:flex-row items-center justify-center gap-6">
                  <div className="flex items-center gap-4 w-full lg:w-auto">
                    <label className="text-xs font-bold text-slate-700 uppercase whitespace-nowrap min-w-[60px] text-right">FROM</label>
                    <div className="relative w-full lg:w-64">
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full lg:w-auto">
                    <label className="text-xs font-bold text-slate-700 uppercase whitespace-nowrap min-w-[60px] text-right">TO DATE</label>
                    <div className="relative w-full lg:w-64">
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 w-full lg:w-auto mt-2 lg:mt-0 justify-center">
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

            {/* Main Content Split View */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

              {/* Left Panel: Journey Count */}
              <div className="xl:col-span-5 bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col h-full min-h-[500px]">
                <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-3">
                  <h2 className="text-lg font-semibold tracking-wide uppercase">RAIL JOURNEY COUNT</h2>
                </header>

                {/* Toolbar */}
                <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center gap-2">
                  <button
                    onClick={handleExportLeft}
                    className="w-8 h-8 flex items-center justify-center bg-green-600 text-white rounded shadow hover:bg-green-700 transition flex-shrink-0"
                    title="Export Excel"
                  >
                    <FaFileExcel />
                  </button>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <span className="text-slate-600 font-medium text-xs sm:text-sm hidden sm:inline">Search:</span>
                    <input
                      type="text"
                      value={searchLeft}
                      onChange={(e) => setSearchLeft(e.target.value)}
                      className="px-3 py-1 border border-slate-300 rounded w-full sm:w-40 focus:outline-none focus:border-[#0e4a78]"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto flex-1">
                  <table className="min-w-full text-xs text-left">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#0e4a78] text-white">
                        {[
                          { key: 'count', label: 'COUNT' },
                          { key: 'documentNo', label: 'DOCUMENT NO' },
                          { key: 'navReleaseTime', label: 'NAV RELEASE TIME' },
                          { key: 'ocrGateInTime', label: 'OCR GATEIN TIME' },
                        ].map(col => (
                          <th key={col.key} className="px-3 py-3 font-semibold whitespace-nowrap border-r border-white/20 last:border-r-0">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredJourneys.map((row, idx) => (
                        <tr
                          key={idx}
                          onClick={() => setSelectedDoc(row.documentNo)}
                          className={`cursor-pointer transition-colors ${selectedDoc === row.documentNo ? 'bg-blue-50 border-l-4 border-l-[#0e4a78]' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-3 py-2.5 font-bold text-slate-700 border-r border-slate-200">{row.count}</td>
                          <td className="px-3 py-2.5 font-bold text-red-600 hover:text-red-700 hover:underline border-r border-slate-200">{row.documentNo}</td>
                          <td className="px-3 py-2.5 text-slate-600 border-r border-slate-200">{row.navReleaseTime}</td>
                          <td className="px-3 py-2.5 text-slate-600">{row.ocrGateInTime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                  Showing 1 to {Math.min(10, filteredJourneys.length)} of {filteredJourneys.length} entries
                </div>
              </div>

              {/* Right Panel: Details */}
              <div className="xl:col-span-7 bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col h-full min-h-[500px]">
                <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-3 flex justify-between items-center">
                  <h2 className="text-lg font-semibold tracking-wide uppercase">
                    {selectedDoc ? `DETAILS: ${selectedDoc}` : 'JOURNEY DETAILS'}
                  </h2>
                </header>

                {selectedDoc ? (
                  <>
                    <div className="overflow-x-auto flex-1">
                      <table className="min-w-full text-xs text-left">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-[#0e4a78] text-white">
                            <th className="px-4 py-3 font-semibold">CONTAINER NO</th>
                            <th className="px-4 py-3 font-semibold">SIZE</th>
                            <th className="px-4 py-3 font-semibold">TYPE</th>
                            <th className="px-4 py-3 font-semibold">SEAL NO</th>
                            <th className="px-4 py-3 font-semibold">STATUS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {detailData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5 font-medium text-slate-700">{row.containerNo}</td>
                              <td className="px-4 py-2.5 text-slate-600">{row.size}</td>
                              <td className="px-4 py-2.5 text-slate-600">{row.type}</td>
                              <td className="px-4 py-2.5 text-slate-600 font-mono">{row.sealNo}</td>
                              <td className="px-4 py-2.5">
                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
                      <span>Total Containers: {detailData.length}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                      <FiArrowRight className="text-2xl text-slate-300" />
                    </div>
                    <p className="text-lg font-medium">Select a Document No</p>
                    <p className="text-sm">Click on any row in the left panel to view detailed breakdown</p>
                  </div>
                )}
              </div>

            </div>

          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default RailPlanReport