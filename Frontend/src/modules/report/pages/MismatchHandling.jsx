import React, { useState, useMemo, useEffect } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FaFileExcel } from 'react-icons/fa'
import { FiRefreshCw, FiSearch, FiX, FiAlertTriangle } from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { useLazyGetMismatchHandlingQuery } from '../../../store/api/ymsApi'

const today = new Date().toISOString().split('T')[0]

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

  const handleSearch = () => fetchMismatch()

  const handleClear = () => {
    setSearch('')
    fetchMismatch()
  }

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
    XLSX.writeFile(wb, `MismatchHandling_${today}.xlsx`)
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

            {/* Filter Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex items-center gap-2">
                <FiSearch className="text-white text-base" />
                <h2 className="text-white font-bold text-base tracking-wide">Search Criteria</h2>
              </div>

              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                  <div className="flex flex-col gap-1.5 w-full md:w-96">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">Search</label>
                    <div className="relative">
                      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Container no, status, remark…"
                        className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm transition-colors"
                      />
                      {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          <FiX className="text-xs" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleClear}
                      className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      Clear
                    </button>
                    <button
                      onClick={handleSearch}
                      disabled={isFetching}
                      className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-[#0e4a78] text-white text-sm font-bold hover:bg-[#0a3b61] transition-colors shadow-md disabled:opacity-60 uppercase tracking-wide"
                    >
                      {isFetching
                        ? <FiRefreshCw className="animate-spin text-base" />
                        : <FiSearch className="text-base" />
                      }
                      {isFetching ? 'Loading…' : 'Search'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex items-center justify-between">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  Inventory Mismatch Report
                  {!isFetching && <span className="ml-2 text-xs font-normal text-white/60">({filteredData.length} records)</span>}
                </h2>
              </div>

              <div className="px-6 py-6 space-y-4">

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
                          <td colSpan={COLUMNS.length} className="px-5 py-8 text-slate-500 text-center">
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
