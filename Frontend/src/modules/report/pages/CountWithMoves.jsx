import React, { useState, useMemo } from 'react'
import { FiSearch, FiCalendar, FiChevronDown, FiChevronUp } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts'
import * as XLSX from 'xlsx'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'

// Mock Data
const allEquipment = ["ERS01", "KC-04", "KC-05", "KC-07"]

const initialData = [
  {
    eqpNo: "ERS01",
    breakdownTime: "002:39",
    idleTime: "051:17",
    workTime: "057:20",
    totalMoves: 1323,
    workingHours: 57,
    movesPerHour: 23,
    expectedWorkingHours: 90,
    utilization: 63.33
  },
  {
    eqpNo: "KC-04",
    breakdownTime: "000:00",
    idleTime: "040:00",
    workTime: "060:00",
    totalMoves: 1100,
    workingHours: 60,
    movesPerHour: 18,
    expectedWorkingHours: 100,
    utilization: 60.00
  },
]

const DailyEquipmentUtilization = () => {
  const [fromDate, setFromDate] = useState('2025-12-07')
  const [toDate, setToDate] = useState('2025-12-11')
  const [selectedEqp, setSelectedEqp] = useState(["ERS01"])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const [globalSearch, setGlobalSearch] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null })

  // Toggle Equipment Selection
  const toggleEqp = (eqp) => {
    if (eqp === "Select all") {
      if (selectedEqp.length === allEquipment.length) {
        setSelectedEqp([])
      } else {
        setSelectedEqp([...allEquipment])
      }
    } else {
      if (selectedEqp.includes(eqp)) {
        setSelectedEqp(selectedEqp.filter(item => item !== eqp))
      } else {
        setSelectedEqp([...selectedEqp, eqp])
      }
    }
  }

  // Filter Data based on selection & search
  const filteredData = useMemo(() => {
    let data = initialData.filter(item => selectedEqp.includes(item.eqpNo))

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
  }, [selectedEqp, globalSearch, sortConfig])

  // Chart Data Preparation
  const chartData = filteredData.map(item => ({
    name: item.eqpNo,
    WorkingHours: item.workingHours,
    Utilization: item.utilization
  }))

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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Utilization Report")
    XLSX.writeFile(workbook, "equipment-utilization.xlsx")
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
          <div className="w-full space-y-6">

            {/* Filter Section */}
            <section className="bg-white rounded-2xl shadow-xl border border-slate-300 relative z-30">
              <header className="bg-[#0e4a78] text-white px-6 py-4 rounded-t-2xl">
                <h2 className="text-lg font-bold tracking-wide">
                  Daily Equipment Utilization Summary
                </h2>
              </header>
              <div className="p-6 bg-white rounded-b-2xl">
                <div className="flex flex-col lg:flex-row items-center justify-center gap-8">

                  {/* Multi-Select Dropdown */}
                  <div className="flex items-center gap-3 w-full lg:w-auto relative group">
                    <label className="text-xs font-bold text-red-600 uppercase whitespace-nowrap">EQP NAME*</label>
                    <div className="relative w-full lg:w-64">
                      <div
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded cursor-pointer flex justify-between items-center text-slate-700 text-sm font-medium hover:border-[#0e4a78] transition-colors"
                      >
                        <span className="truncate">
                          {selectedEqp.length === 0 ? "Select Equipment" :
                            selectedEqp.length === allEquipment.length ? "All Selected" :
                              selectedEqp.join(", ")}
                        </span>
                        <FiChevronDown className="text-slate-500" />
                      </div>

                      {isDropdownOpen && (
                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-300 rounded shadow-2xl z-50 max-h-60 overflow-y-auto p-2">
                          <input
                            type="text"
                            placeholder="Search..."
                            className="w-full px-3 py-2 border border-slate-200 rounded text-sm mb-2 focus:outline-none focus:border-[#0e4a78]"
                          />
                          <div className="space-y-1">
                            <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={selectedEqp.length === allEquipment.length}
                                onChange={() => toggleEqp("Select all")}
                                className="rounded border-slate-300 text-[#0e4a78] focus:ring-[#0e4a78]"
                              />
                              Select all
                            </label>
                            {allEquipment.map(eqp => (
                              <label key={eqp} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={selectedEqp.includes(eqp)}
                                  onChange={() => toggleEqp(eqp)}
                                  className="rounded border-slate-300 text-[#0e4a78] focus:ring-[#0e4a78]"
                                />
                                {eqp}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full lg:w-auto">
                    <label className="text-xs font-bold text-red-600 uppercase whitespace-nowrap">FROM*</label>
                    <div className="relative w-full lg:w-56">
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700 uppercase"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full lg:w-auto">
                    <label className="text-xs font-bold text-red-600 uppercase whitespace-nowrap">TO*</label>
                    <div className="relative w-full lg:w-56">
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700 uppercase"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 w-full lg:w-auto mt-2 lg:mt-0 justify-center">
                    <button className="px-6 py-2 border border-slate-300 bg-white text-slate-600 font-bold rounded shadow-sm hover:bg-slate-50 transition">
                      Cancel
                    </button>
                    <button
                      className="px-8 py-2 bg-[#0e4a78] text-white font-bold rounded shadow hover:bg-[#0b3e66] transition uppercase tracking-wide"
                    >
                      FILTER
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Chart Section */}
            {filteredData.length > 0 && (
              <section className="bg-white rounded-2xl shadow-xl border border-slate-300 overflow-hidden relative z-20">
                <header className="bg-[#0e4a78] text-white px-6 py-3">
                  <h2 className="text-lg font-semibold tracking-wide uppercase">
                    UTILIZATION REPORT {fromDate} TO {toDate}
                  </h2>
                </header>
                <div className="p-6 h-[400px] w-full bg-white">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      barSize={60}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis yAxisId="left" orientation="left" label={{ value: 'Working Hours', angle: -90, position: 'insideLeft', offset: 10 }} />
                      <YAxis yAxisId="right" orientation="right" label={{ value: 'Utilization %', angle: 90, position: 'insideRight', offset: 10 }} domain={[0, 100]} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        cursor={{ fill: 'rgba(14, 74, 120, 0.1)' }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="WorkingHours" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Working Hours" />
                      <Bar yAxisId="right" dataKey="Utilization" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Utilization %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* Detailed Table Section */}
            <section className="bg-white rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col relative z-10">

              {/* Toolbar */}
              <div className="px-6 py-3 border-b border-slate-200 flex justify-between items-center gap-4 bg-white">
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
              <div className="overflow-x-auto w-full bg-white">
                <table className="min-w-full text-xs text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#0e4a78] text-white">
                      {[
                        { key: 'eqpNo', label: 'EqpNo' },
                        { key: 'breakdownTime', label: 'BreakdownTime(HH:MM)' },
                        { key: 'idleTime', label: 'IdleTime(HH:MM)' },
                        { key: 'workTime', label: 'WorkTime(HH:MM)' },
                        { key: 'totalMoves', label: 'TotalMoves' },
                        { key: 'workingHours', label: 'WorkingHours' },
                        { key: 'movesPerHour', label: 'Moves Per Hour' },
                        { key: 'expectedWorkingHours', label: 'ExpectedWorkingHours' },
                        { key: 'utilization', label: 'Utilization%' },
                      ].map(col => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className="px-3 py-3 font-semibold whitespace-nowrap border-r border-white/20 last:border-r-0 cursor-pointer hover:bg-white/10"
                        >
                          <div className="flex items-center gap-1">
                            {col.label}
                            <div className="flex flex-col opacity-50 ml-1">
                              <FiChevronUp className="w-2.5 h-2.5 -mb-0.5" />
                              <FiChevronUp className="w-2.5 h-2.5 -mt-0.5 rotate-180" />
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredData.length > 0 ? (
                      filteredData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-3 py-2.5 text-slate-700 font-bold border-r border-slate-200">{row.eqpNo}</td>
                          <td className="px-3 py-2.5 text-slate-700 border-r border-slate-200">{row.breakdownTime}</td>
                          <td className="px-3 py-2.5 text-slate-700 border-r border-slate-200">{row.idleTime}</td>
                          <td className="px-3 py-2.5 text-slate-700 border-r border-slate-200">{row.workTime}</td>
                          <td className="px-3 py-2.5 text-slate-700 border-r border-slate-200">{row.totalMoves}</td>
                          <td className="px-3 py-2.5 text-slate-700 border-r border-slate-200">{row.workingHours}</td>
                          <td className="px-3 py-2.5 text-slate-700 border-r border-slate-200">{row.movesPerHour}</td>
                          <td className="px-3 py-2.5 text-slate-700 border-r border-slate-200">{row.expectedWorkingHours}</td>
                          <td className="px-3 py-2.5 text-slate-700 font-bold">{row.utilization}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="9" className="px-6 py-8 text-center text-slate-500">
                          No data found matching criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default DailyEquipmentUtilization