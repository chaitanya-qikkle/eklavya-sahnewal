import React, { useState, useMemo } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { RiFileExcel2Fill } from 'react-icons/ri'

const mockAccuracyData = [
  { eqpName: "ERS01", date: "03-12-2025", eq: 290, t: 0, a: 0, m: 21, total: 311, missing: 115, nonMissing: 196, accuracy: 63.02 },
  { eqpName: "ERS01", date: "04-12-2025", eq: 324, t: 0, a: 0, m: 23, total: 347, missing: 113, nonMissing: 234, accuracy: 67.44 },
  { eqpName: "ERS01", date: "05-12-2025", eq: 268, t: 0, a: 0, m: 29, total: 297, missing: 104, nonMissing: 193, accuracy: 64.98 },
  { eqpName: "ERS01", date: "06-12-2025", eq: 354, t: 0, a: 0, m: 7, total: 361, missing: 176, nonMissing: 185, accuracy: 51.25 },
  { eqpName: "ERS01", date: "07-12-2025", eq: 303, t: 0, a: 0, m: 2, total: 305, missing: 136, nonMissing: 169, accuracy: 55.41 },
  { eqpName: "ERS01", date: "08-12-2025", eq: 209, t: 0, a: 0, m: 19, total: 228, missing: 72, nonMissing: 156, accuracy: 68.42 },
  { eqpName: "ERS01", date: "09-12-2025", eq: 239, t: 0, a: 0, m: 22, total: 261, missing: 122, nonMissing: 139, accuracy: 53.26 },
]

const EquipmentAccuracy = () => {
  const [data] = useState(mockAccuracyData)

  // Filter States
  const [filters, setFilters] = useState({
    eqpName: 'ERS01',
    fromDate: '2025-12-03',
    toDate: '2025-12-16',
    search: ''
  })

  // Sort State
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  // Data Keys for Sorting Mapping
  const columnKeys = [
    'eqpName', 'date', 'eq', 't', 'a', 'm', 'total', 'missing', 'nonMissing', 'accuracy'
  ]

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  // Filter and Sort Logic
  const processedData = useMemo(() => {
    let filtered = [...data]

    // 1. Text Search
    if (filters.search) {
      const lowerSearch = filters.search.toLowerCase()
      filtered = filtered.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(lowerSearch)
        )
      )
    }

    // 2. Date Range Filter using DD-MM-YYYY format
    if (filters.fromDate || filters.toDate) {
      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        // Handle input type="date" (YYYY-MM-DD)
        if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) {
          return new Date(dateStr);
        }
        // Handle data format (DD-MM-YYYY)
        const parts = dateStr.split('-');
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }

      const from = parseDate(filters.fromDate)
      const to = parseDate(filters.toDate)

      filtered = filtered.filter(row => {
        const rowDate = parseDate(row.date)
        if (from && rowDate < from) return false
        if (to && rowDate > to) return false
        return true
      })
    }

    // 3. EqpName Filter
    if (filters.eqpName && filters.eqpName !== 'All') {
      filtered = filtered.filter(row => row.eqpName === filters.eqpName)
    }

    // 4. Sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key]
        const bVal = b[sortConfig.key]

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [data, filters, sortConfig])


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
                <h2 className="text-lg font-semibold tracking-wide uppercase">EQUIPMENT ACCURACY</h2>
              </header>
              <div className="p-6">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-8">

                  {/* Inputs Group */}
                  <div className="flex flex-col md:flex-row items-center gap-6 w-full lg:w-auto flex-1 justify-center lg:justify-start">

                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <label className="text-slate-800 font-bold text-sm uppercase whitespace-nowrap min-w-[80px] text-right">EQP NAME<span className="text-red-600">*</span></label>
                      <select
                        value={filters.eqpName}
                        onChange={(e) => handleFilterChange('eqpName', e.target.value)}
                        className="flex-1 md:w-64 px-4 py-2 border border-slate-300 rounded shadow-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] bg-slate-50"
                      >
                        <option value="ERS01">ERS01</option>
                        <option value="ERS02">ERS02</option>
                        <option value="All">All</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <label className="text-slate-800 font-bold text-sm uppercase whitespace-nowrap min-w-[50px] text-right">FROM<span className="text-red-600">*</span></label>
                      <input
                        type="date"
                        value={filters.fromDate}
                        onChange={(e) => handleFilterChange('fromDate', e.target.value)}
                        className="flex-1 md:w-48 px-4 py-2 border border-slate-300 rounded shadow-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] bg-slate-50"
                      />
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <label className="text-slate-800 font-bold text-sm uppercase whitespace-nowrap min-w-[30px] text-right">TO<span className="text-red-600">*</span></label>
                      <input
                        type="date"
                        value={filters.toDate}
                        onChange={(e) => handleFilterChange('toDate', e.target.value)}
                        className="flex-1 md:w-48 px-4 py-2 border border-slate-300 rounded shadow-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] bg-slate-50"
                      />
                    </div>
                  </div>

                </div>

                {/* Buttons */}
                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => setFilters({ eqpName: 'All', fromDate: '', toDate: '', search: '' })}
                    className="px-6 py-2 bg-white border border-slate-300 text-slate-500 font-semibold rounded shadow hover:bg-slate-50 transition uppercase text-sm"
                  >
                    Cancel
                  </button>
                  <button className="px-8 py-2 bg-[#0e4a78] text-white font-bold rounded shadow hover:bg-[#0b3e66] transition uppercase text-sm">
                    SUBMIT
                  </button>
                </div>
              </div>
            </section>

            {/* Detail Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-3">
                <h2 className="text-lg font-semibold tracking-wide uppercase">EQUIPMENT ACCURACY DETAIL</h2>
              </header>

              <div className="p-4">
                {/* Controls */}
                <div className="flex justify-between items-center mb-4">
                  <button className="text-green-600 hover:text-green-700 transition" title="Export to Excel">
                    <RiFileExcel2Fill className="text-4xl" />
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 text-sm font-medium">Search:</span>
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      placeholder="Type to search..."
                      className="border border-slate-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#0e4a78] w-48"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs md:text-sm text-left">
                    <thead className="sticky top-0 z-10 cursor-pointer user-select-none">
                      <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                        {[
                          'EqpName', 'TransactionDate', 'EQ', 'T', 'A', 'M', 'TotalCount', 'Missing', 'NonMissing', 'Accuracy(%)'
                        ].map((header, idx) => (
                          <th
                            key={idx}
                            onClick={() => handleSort(columnKeys[idx])}
                            className="px-4 py-3 font-semibold border-r border-white/30 last:border-r-0 whitespace-nowrap hover:bg-white/10 transition"
                          >
                            <div className="flex items-center justify-between gap-1">
                              {header}
                              <div className="flex flex-col text-[8px] opacity-70">
                                <span className={sortConfig.key === columnKeys[idx] && sortConfig.direction === 'asc' ? 'text-yellow-300' : ''}>▲</span>
                                <span className={sortConfig.key === columnKeys[idx] && sortConfig.direction === 'desc' ? 'text-yellow-300' : ''}>▼</span>
                              </div>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {processedData.length > 0 ? (
                        processedData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition odd:bg-white even:bg-slate-50/30">
                            <td className="px-4 py-3 text-slate-700">{row.eqpName}</td>
                            <td className="px-4 py-3 text-slate-700">{row.date}</td>
                            <td className="px-4 py-3 text-slate-700">{row.eq}</td>
                            <td className="px-4 py-3 text-slate-700">{row.t}</td>
                            <td className="px-4 py-3 text-slate-700">{row.a}</td>
                            <td className="px-4 py-3 text-slate-700">{row.m}</td>
                            <td className="px-4 py-3 text-slate-700">{row.total}</td>
                            <td className="px-4 py-3 text-slate-700">{row.missing}</td>
                            <td className="px-4 py-3 text-slate-700">{row.nonMissing}</td>
                            <td className="px-4 py-3 text-slate-700">{row.accuracy}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="10" className="px-4 py-8 text-center text-slate-500 italic">
                            No records found matching your criteria.
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

export default EquipmentAccuracy