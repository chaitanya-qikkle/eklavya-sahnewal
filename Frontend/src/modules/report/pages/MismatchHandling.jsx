import React, { useState, useMemo, useEffect } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FaFileExcel } from 'react-icons/fa'
import { FiRefreshCw, FiSearch, FiX, FiAlertTriangle } from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { useLazyGetMismatchHandlingQuery } from '../../../store/api/ymsApi'

const COLUMNS = [
  { key: 'CONTNO', label: 'Container No' },
  { key: 'ReleaseStatus', label: 'Release Status' },
  { key: 'Remark', label: 'Remark' },
]

const MismatchHandling = () => {
  const [fetchMismatch, { data, isFetching, isError }] = useLazyGetMismatchHandlingQuery()
  const [search, setSearch] = useState('')

  useEffect(() => { fetchMismatch() }, []) // eslint-disable-line

  const rows = Array.isArray(data?.data) ? data.data : []

  const handleRefresh = () => fetchMismatch()

  const filteredData = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter((r) => COLUMNS.some(({ key }) => String(r[key] ?? '').toLowerCase().includes(q)))
  }, [rows, search])

  const handleExport = () => {
    if (!filteredData.length) return
    const exportRows = filteredData.map((r) => {
      const out = {}
      COLUMNS.forEach(({ key, label }) => { out[label] = r[key] ?? '' })
      return out
    })
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'MismatchHandling')
    XLSX.writeFile(wb, `MismatchHandling_${new Date().toISOString().split('T')[0]}.xlsx`)
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

            {/* Page Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0e4a78] flex items-center justify-center shadow">
                <FiAlertTriangle className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#0e4a78]">Mismatch Handling</h1>
                <p className="text-slate-500 text-sm">Navision vs Eklavya inventory reconciliation</p>
              </div>
            </div>

            {/* Results Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  Inventory Mismatch Report
                  {!isFetching && <span className="ml-2 text-xs font-normal text-white/60">({filteredData.length} records)</span>}
                </h2>
                <button
                  onClick={handleRefresh}
                  disabled={isFetching}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-semibold hover:bg-white/20 transition-colors disabled:opacity-60"
                >
                  <FiRefreshCw className={isFetching ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              <div className="px-6 py-6 space-y-4">

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExport}
                      disabled={!filteredData.length}
                      className="p-1 disabled:opacity-40"
                      title="Export to Excel"
                    >
                      <FaFileExcel className="text-3xl text-green-700 hover:text-green-800 transition-colors" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Search:</label>
                    <div className="relative w-full sm:w-64">
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 pl-7 text-sm focus:outline-none focus:border-blue-500 w-full text-slate-700"
                      />
                      <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                      {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          <FiX className="text-xs" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-sm shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61]">
                      <tr>
                        {COLUMNS.map((column) => (
                          <th key={column.key} className="px-5 py-3 text-left font-bold text-white uppercase tracking-wider border-r border-[#ffffff40] last:border-r-0 whitespace-nowrap">
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {isFetching ? (
                        <tr>
                          <td colSpan={COLUMNS.length} className="px-5 py-8 text-center text-slate-500">
                            <FiRefreshCw className="inline animate-spin mr-2" /> Loading mismatch data…
                          </td>
                        </tr>
                      ) : isError ? (
                        <tr>
                          <td colSpan={COLUMNS.length} className="px-5 py-8 text-center text-red-500 font-semibold">
                            Failed to load data. Check backend connection.
                          </td>
                        </tr>
                      ) : filteredData.length > 0 ? (
                        filteredData.map((row, index) => (
                          <tr key={index} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                            {COLUMNS.map((column) => {
                              const raw = row[column.key]
                              const display = raw != null && raw !== '' ? raw : '—'
                              return (
                                <td
                                  key={column.key}
                                  className={`px-5 py-3 whitespace-nowrap border-r border-slate-100 last:border-r-0 ${
                                    column.key === 'Remark'
                                      ? raw === 'Not in Eklavya' ? 'text-rose-600 font-semibold' : raw === 'Not in Navision' ? 'text-amber-600 font-semibold' : 'text-slate-700'
                                      : 'text-slate-700'
                                  }`}
                                >
                                  {display}
                                </td>
                              )
                            })}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={COLUMNS.length} className="px-5 py-3 text-slate-500 text-center">
                            No mismatches found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>

            </div>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default MismatchHandling
