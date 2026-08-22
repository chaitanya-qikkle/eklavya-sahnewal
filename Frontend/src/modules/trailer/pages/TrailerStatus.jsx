import React, { useState, useMemo } from 'react'
import { FiSearch, FiRefreshCw, FiChevronUp, FiChevronDown, FiTruck, FiClock, FiActivity, FiBox } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { useGetTrailerReportQuery } from '../../../store/api/ymsApi'

const normalizeTrailerRow = (row) => ({
  trailerNo: row?.TrailerNo ?? '',
  activity: row?.ActivityName ?? '',
  containerNo: row?.ContainerNo ?? '',
  size: row?.ContainerSize ?? '',
  process: row?.ProcessName ?? '',
  gateIn: row?.GateInDate ?? '',
  gateOut: row?.GateOutDate ?? '',
  offload: '',
  location: '',
  tat: row?.TAT ?? '',
  survey: '',
})

// TAT comes back as "HHH:MM" (e.g. "000:39") — convert to total hours for bucketing
const tatToHours = (tat) => {
  const [h, m] = String(tat || '').split(':').map(Number)
  if (!Number.isFinite(h)) return null
  return h + (Number.isFinite(m) ? m / 60 : 0)
}

const todayStr = () => new Date().toISOString().slice(0, 10)

const TrailerStatus = () => {
  const [fromDate, setFromDate] = useState(todayStr())
  const [toDate, setToDate] = useState(todayStr())
  const [globalSearch, setGlobalSearch] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null })
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const { data: trailerResponse, isLoading, isError } = useGetTrailerReportQuery({ from_date: fromDate, to_date: toDate })
  const mockTrailerData = useMemo(
    () => (Array.isArray(trailerResponse?.data) ? trailerResponse.data : []).map(normalizeTrailerRow),
    [trailerResponse],
  )

  const cardData = useMemo(() => {
    const total  = mockTrailerData.length
    const empty  = mockTrailerData.filter((r) => String(r.process).toUpperCase() === 'EMPTY').length
    const imp    = mockTrailerData.filter((r) => String(r.process).toUpperCase() === 'IMPORT').length
    const exp    = mockTrailerData.filter((r) => String(r.process).toUpperCase() === 'EXPORT').length
    const hours  = mockTrailerData.map((r) => tatToHours(r.tat)).filter((h) => h !== null)
    const bucket = (lo, hi) => hours.filter((h) => h >= lo && (hi == null || h < hi)).length

    return [
      { label: 'Empty', count: empty, subLabel: 'EMPTY', gradient: 'from-orange-400 to-orange-600', icon: FiBox },
      { label: 'Import', count: imp, subLabel: 'IMPORT', gradient: 'from-cyan-400 to-cyan-600', icon: FiTruck },
      { label: 'Export', count: exp, subLabel: 'EXPORT', gradient: 'from-red-400 to-red-600', icon: FiActivity },
      { label: 'Total', count: total, subLabel: 'TOTAL COUNT', gradient: 'from-lime-400 to-lime-600', icon: FiRefreshCw },
      { label: 'Less than 1hr', count: bucket(0, 1), subLabel: '<= 1HRS', gradient: 'from-orange-400 to-orange-600', icon: FiClock },
      { label: 'Between 1hr To 2hrs', count: bucket(1, 2), subLabel: '1HRS - 2HRS', gradient: 'from-cyan-400 to-cyan-600', icon: FiClock },
      { label: 'Between 2hr To 3hrs', count: bucket(2, 3), subLabel: '2HRS - 3HRS', gradient: 'from-red-400 to-red-600', icon: FiClock },
      { label: 'Between 3hr to 5hr', count: bucket(3, 5), subLabel: '3HRS - 5HRS', gradient: 'from-lime-400 to-lime-600', icon: FiClock },
      { label: 'Between 5hr to 10hr', count: bucket(5, 10), subLabel: '5HRS - 10HRS', gradient: 'from-orange-400 to-orange-600', icon: FiClock },
      { label: 'More than 10hr', count: bucket(10, null), subLabel: '>= 10HRS', gradient: 'from-cyan-400 to-cyan-600', icon: FiClock },
    ]
  }, [mockTrailerData])

  // Filtering Logic
  const filteredData = useMemo(() => {
    let data = [...mockTrailerData]

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
  }, [mockTrailerData, globalSearch, sortConfig])

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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Trailer Status")
    XLSX.writeFile(workbook, "trailer-status.xlsx")
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

            {/* Trailer Count Dashboard */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-3 flex justify-between items-center">
                <h2 className="text-lg font-semibold tracking-wide uppercase">TRAILER COUNT</h2>
              </header>
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {cardData.map((card, idx) => (
                    <div
                      key={idx}
                      className={`relative group overflow-hidden rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-gradient-to-br ${card.gradient}`}
                    >
                      {/* Card Background Pattern */}
                      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity duration-300 transform group-hover:scale-110">
                        <card.icon className="text-6xl text-white" />
                      </div>

                      <div className="relative z-10 p-4 flex flex-col justify-between h-full min-h-[110px]">
                        <div className="flex justify-between items-start">
                          <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg shadow-inner">
                            <card.icon className="text-lg text-white" />
                          </div>
                          <span className="text-[10px] font-bold text-white/90 uppercase tracking-widest bg-black/10 px-2 py-0.5 rounded">
                            {card.subLabel}
                          </span>
                        </div>

                        <div className="mt-2">
                          <h3 className="text-3xl font-black text-white tracking-tight drop-shadow-sm">
                            {card.count}
                          </h3>
                          <p className="text-white/90 font-semibold text-xs mt-0.5 tracking-wide uppercase">
                            {card.label}
                          </p>
                        </div>
                      </div>

                      {/* Shine Effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Trailer Live Status Table */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col">
              <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-3">
                <h2 className="text-lg font-semibold tracking-wide uppercase">TRAILER LIVE STATUS</h2>
              </header>

              {/* Toolbar */}
              <div className="px-6 py-3 border-b border-slate-200 flex justify-between items-center gap-4">
                <button
                  onClick={handleExport}
                  className="w-8 h-8 flex items-center justify-center bg-green-600 text-white rounded shadow hover:bg-green-700 transition"
                  title="Export Excel"
                >
                  <FaFileExcel />
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-medium">From:</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="px-3 py-1 border border-slate-300 rounded focus:outline-none focus:border-[#0e4a78]"
                  />
                  <span className="text-slate-600 font-medium">To:</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="px-3 py-1 border border-slate-300 rounded focus:outline-none focus:border-[#0e4a78]"
                  />
                </div>
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
              <div className="overflow-x-auto w-full">
                <table className="min-w-full text-xs md:text-sm text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                      {[
                        { key: 'trailerNo', label: 'TRAILER NO' },
                        { key: 'activity', label: 'ACTIVITY' },
                        { key: 'containerNo', label: 'CONTAINER NO' },
                        { key: 'size', label: 'SIZE' },
                        { key: 'process', label: 'PROCESS' },
                        { key: 'gateIn', label: 'GATE IN DATE' },
                        { key: 'gateOut', label: 'GATE OUT DATE' },
                        { key: 'offload', label: 'OFFLOAD DATE' },
                        { key: 'location', label: 'LOCATION' },
                        { key: 'tat', label: 'TAT' },
                        { key: 'survey', label: 'SURVEY' },
                      ].map(col => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className="px-4 sm:px-5 py-3 text-left font-semibold border-r border-white/30 last:border-r-0 cursor-pointer hover:bg-white/10 whitespace-nowrap"
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
                    {isLoading ? (
                      <tr><td colSpan="11" className="px-6 py-8 text-center text-slate-500">Loading…</td></tr>
                    ) : isError ? (
                      <tr><td colSpan="11" className="px-6 py-8 text-center text-red-600">Failed to load trailer status.</td></tr>
                    ) : paginatedData.length === 0 ? (
                      <tr><td colSpan="11" className="px-6 py-8 text-center text-slate-500">No data available in table</td></tr>
                    ) : paginatedData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 font-medium">{row.trailerNo}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">{row.activity}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 font-mono">{row.containerNo}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">{row.size}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">{row.process}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">{row.gateIn}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">{row.gateOut}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">{row.offload}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">{row.location}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 font-medium">{row.tat}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700">{row.survey}</td>
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
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-[#0e4a78] font-semibold"
                  >
                    Previous
                  </button>
                  <button className="px-3 py-1 rounded border bg-[#0e4a78] text-white border-[#0e4a78]">
                    1
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-[#0e4a78] font-semibold"
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

export default TrailerStatus