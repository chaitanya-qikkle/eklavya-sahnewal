import React, { useState } from 'react'
import { Calendar, FileSpreadsheet, FileText, ChevronUp, ChevronDown, Search } from 'lucide-react'

// Sample data for rail in records
const railInRecords = [
  {
    id: 1,
    containerNo: 'WHLU0668114',
    navDateTime: '18-12-2025 22:20',
    arrivalTime: '23-12-2025 02:00',
    containerSize: '20',
    containerType: 'DRY',
    transactionType: 'Import',
    documentNo: 'MDP/RJ/I/25-26/00746',
    bookingNo: 'MDP/I/BK/25-26/06325',
    containerStatus: 'Laden',
    wagonNo: '62310803153',
    mode: 'Rail',
    terminal: 'GHH'
  },
  {
    id: 2,
    containerNo: 'WHSU2355140',
    navDateTime: '18-12-2025 22:20',
    arrivalTime: '23-12-2025 02:00',
    containerSize: '20',
    containerType: 'DRY',
    transactionType: 'Import',
    documentNo: 'MDP/RJ/I/25-26/00746',
    bookingNo: 'MDP/I/BK/25-26/06325',
    containerStatus: 'Laden',
    wagonNo: '62310803030',
    mode: 'Rail',
    terminal: 'GHH'
  },
  {
    id: 3,
    containerNo: 'WHSU2389428',
    navDateTime: '18-12-2025 22:20',
    arrivalTime: '23-12-2025 02:00',
    containerSize: '20',
    containerType: 'DRY',
    transactionType: 'Import',
    documentNo: 'MDP/RJ/I/25-26/00746',
    bookingNo: 'MDP/I/BK/25-26/06325',
    containerStatus: 'Laden',
    wagonNo: '62310803023',
    mode: 'Rail',
    terminal: 'GHH'
  },
  {
    id: 4,
    containerNo: 'WHSU0234031',
    navDateTime: '18-12-2025 22:20',
    arrivalTime: '23-12-2025 02:00',
    containerSize: '20',
    containerType: 'DRY',
    transactionType: 'Import',
    documentNo: 'MDP/RJ/I/25-26/00746',
    bookingNo: 'MDP/I/BK/25-26/06325',
    containerStatus: 'Laden',
    wagonNo: '62310803160',
    mode: 'Rail',
    terminal: 'GHH'
  },
  {
    id: 5,
    containerNo: 'WHSU0012306',
    navDateTime: '18-12-2025 22:20',
    arrivalTime: '23-12-2025 02:00',
    containerSize: '20',
    containerType: 'DRY',
    transactionType: 'Import',
    documentNo: 'MDP/RJ/I/25-26/00746',
    bookingNo: 'MDP/I/BK/25-26/06325',
    containerStatus: 'Laden',
    wagonNo: '62310803078',
    mode: 'Rail',
    terminal: 'GHH'
  },
  {
    id: 6,
    containerNo: 'WHLU5820385',
    navDateTime: '18-12-2025 22:20',
    arrivalTime: '23-12-2025 02:00',
    containerSize: '40',
    containerType: 'DRY',
    transactionType: 'Import',
    documentNo: 'MDP/RJ/I/25-26/00746',
    bookingNo: 'MDP/I/BK/25-26/06325',
    containerStatus: 'Laden',
    wagonNo: '62310803122',
    mode: 'Rail',
    terminal: 'GHH'
  },
  {
    id: 7,
    containerNo: 'WHLU0685169',
    navDateTime: '18-12-2025 22:20',
    arrivalTime: '23-12-2025 02:00',
    containerSize: '20',
    containerType: 'DRY',
    transactionType: 'Import',
    documentNo: 'MDP/RJ/I/25-26/00746',
    bookingNo: 'MDP/I/BK/25-26/06325',
    containerStatus: 'Laden',
    wagonNo: '62310803153',
    mode: 'Rail',
    terminal: 'GHH'
  },
  {
    id: 8,
    containerNo: 'WHSU5906524',
    navDateTime: '18-12-2025 22:20',
    arrivalTime: '23-12-2025 02:00',
    containerSize: '40',
    containerType: 'DRY',
    transactionType: 'Import',
    documentNo: 'MDP/RJ/I/25-26/00746',
    bookingNo: 'MDP/I/BK/25-26/06325',
    containerStatus: 'Laden',
    wagonNo: '62310803214',
    mode: 'Rail',
    terminal: 'GHH'
  },
  {
    id: 9,
    containerNo: 'WHSU2250129',
    navDateTime: '18-12-2025 22:20',
    arrivalTime: '23-12-2025 02:00',
    containerSize: '20',
    containerType: 'DRY',
    transactionType: 'Import',
    documentNo: 'MDP/RJ/I/25-26/00746',
    bookingNo: 'MDP/I/BK/25-26/06325',
    containerStatus: 'Laden',
    wagonNo: '62310803146',
    mode: 'Rail',
    terminal: 'GHH'
  },
  {
    id: 10,
    containerNo: 'WHSU5947122',
    navDateTime: '18-12-2025 22:20',
    arrivalTime: '23-12-2025 02:00',
    containerSize: '40',
    containerType: 'DRY',
    transactionType: 'Import',
    documentNo: 'MDP/RJ/I/25-26/00746',
    bookingNo: 'MDP/I/BK/25-26/06325',
    containerStatus: 'Laden',
    wagonNo: '62310803115',
    mode: 'Rail',
    terminal: 'GHH'
  }
]

const Navbar = () => (
  <nav className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-4 shadow-lg">
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-bold">Qikkle Solution</h1>
      <div className="text-sm">Welcome User</div>
    </div>
  </nav>
)

const Footer = () => (
  <footer className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-4 text-center text-sm">
    <p>&copy; 2025 Qikkle Solution. All rights reserved.</p>
  </footer>
)

const RailInReport = () => {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [containerSearch, setContainerSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const itemsPerPage = 10

  const parseDateTime = (dateTimeStr) => {
    const [datePart, timePart] = dateTimeStr.split(' ')
    const [day, month, year] = datePart.split('-')
    return new Date(`${year}-${month}-${day}T${timePart}`)
  }

  const handleSearch = () => {
    setCurrentPage(1)
  }

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const handleExport = () => {
    const headers = columns.map(col => col.label).join(',')
    const rows = filteredData.map(row => 
      columns.map(col => row[col.key] || '').join(',')
    ).join('\n')
    const csv = `${headers}\n${rows}`
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `RailInReport_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleClear = () => {
    setDateFrom('')
    setDateTo('')
    setSearch('')
    setContainerSearch('')
    setCurrentPage(1)
    setSortConfig({ key: null, direction: 'asc' })
  }

  const filteredData = railInRecords.filter(item => {
    if (containerSearch && !item.containerNo.toLowerCase().includes(containerSearch.toLowerCase())) {
      return false
    }

    if (search && !Object.values(item).some(val => 
      String(val).toLowerCase().includes(search.toLowerCase())
    )) {
      return false
    }

    if (dateFrom || dateTo) {
      const arrivalDate = parseDateTime(item.arrivalTime)
      
      if (dateFrom) {
        const fromDate = new Date(dateFrom)
        if (arrivalDate < fromDate) return false
      }
      
      if (dateTo) {
        const toDate = new Date(dateTo)
        if (arrivalDate > toDate) return false
      }
    }

    return true
  })

  // Apply sorting
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig.key) return 0

    const aValue = a[sortConfig.key]
    const bValue = b[sortConfig.key]

    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1
    }
    return 0
  })

  const totalPages = Math.ceil(sortedData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentData = sortedData.slice(startIndex, endIndex)

  const columns = [
    { key: 'containerNo', label: 'Container No' },
    { key: 'navDateTime', label: 'NAV Date Time' },
    { key: 'arrivalTime', label: 'Arrival Time' },
    { key: 'containerSize', label: 'Container Size' },
    { key: 'containerType', label: 'Container Type' },
    { key: 'transactionType', label: 'Transaction Type' },
    { key: 'documentNo', label: 'Document No' },
    { key: 'bookingNo', label: 'Booking No' },
    { key: 'containerStatus', label: 'Container Status' },
    { key: 'wagonNo', label: 'Wagon No' },
    { key: 'mode', label: 'Mode' },
    { key: 'terminal', label: 'Terminal' }
  ]

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <div className="w-full space-y-6">

            <section className="bg-white rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-3 shadow-md">
                <h2 className="text-white font-bold text-lg tracking-wide">
                  Rail In Report
                </h2>
              </div>

              <div className="p-6 bg-slate-50">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                  
                  {/* Search Container */}
                  <div className="flex items-center gap-3 w-full lg:w-auto">
                    <label className="text-sm font-bold text-slate-700 uppercase min-w-[120px]">Search Container</label>
                    <div className="relative w-full md:w-64">
                      <input
                        type="text"
                        value={containerSearch}
                        onChange={(e) => setContainerSearch(e.target.value)}
                        placeholder="Enter container no..."
                        className="w-full pl-10 pr-4 py-2 border  border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm text-black "
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black w-4 h-4" />
                    </div>
                  </div>

                  {/* Date Filters */}
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <label className="text-sm font-bold text-slate-700 uppercase min-w-[100px]">Rail In From</label>
                      <div className="relative w-full md:w-64">
                        <input
                          type="datetime-local"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm"
                        />
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <label className="text-sm font-bold text-slate-700 uppercase min-w-[80px]">Rail In To</label>
                      <div className="relative w-full md:w-64">
                        <input
                          type="datetime-local"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm"
                        />
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleClear}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                      >
                        Clear
                      </button>
                      <button
                        onClick={handleSearch}
                        className="px-6 py-2 bg-[#0e4a78] text-white rounded text-sm font-bold hover:bg-[#0a3b61] transition-colors shadow-md"
                      >
                        Search
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
                <h2 className="text-white font-bold text-xl tracking-wide uppercase">
                  Report Data
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExport}
                    className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
                    title="Export to Excel"
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                  </button>
                  <button
                    className="p-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                    title="Export to PDF"
                  >
                    <FileText className="w-5 h-5" />
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
                          <th
                            key={column.key}
                            onClick={() => handleSort(column.key)}
                            className="px-5 py-4 text-left text-xs font-bold text-white uppercase tracking-wide border-r border-white/10 last:border-r-0 whitespace-nowrap cursor-pointer hover:bg-[#0a3b61] transition-colors select-none"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span>{column.label}</span>
                              <div className="flex flex-col">
                                <ChevronUp 
                                  className={`w-3 h-3 -mb-1 ${
                                    sortConfig.key === column.key && sortConfig.direction === 'asc' 
                                      ? 'text-white' 
                                      : 'text-white/40'
                                  }`}
                                />
                                <ChevronDown 
                                  className={`w-3 h-3 ${
                                    sortConfig.key === column.key && sortConfig.direction === 'desc' 
                                      ? 'text-white' 
                                      : 'text-white/40'
                                  }`}
                                />
                              </div>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {currentData.length > 0 ? (
                        currentData.map((row, index) => (
                          <tr key={index} className="hover:bg-slate-50 transition-colors">
                            {columns.map((column) => (
                              <td
                                key={column.key}
                                className="px-5 py-4 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0"
                              >
                                {row[column.key] || ''}
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={columns.length} className="px-5 py-8 text-center text-slate-500">
                            No records found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {sortedData.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                    <div className="text-sm text-slate-600">
                      Showing {startIndex + 1} to {Math.min(endIndex, sortedData.length)} of {sortedData.length} entries
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
                        onClick={() => setCurrentPage(p => Math.min(totalPages || 1, p + 1))}
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
                )}
              </div>

            </section>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default RailInReport