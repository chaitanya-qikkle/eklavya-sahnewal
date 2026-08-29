import React, { useState, useMemo, useEffect } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FiCalendar, FiSearch, FiRefreshCw, FiX, FiUsers } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import { useGetUsersQuery, useLazyGetLoginHistoryQuery } from '../../../store/api/ymsApi'

const fmtDate = (val) => {
  if (!val) return '—'
  const d = new Date(String(val).replace(' ', 'T'))
  if (isNaN(d)) return String(val)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const COLUMNS = [
  { key: 'FullName',    label: 'Full Name' },
  { key: 'UserName',    label: 'Username' },
  { key: 'LoginTime',   label: 'Login Time', format: fmtDate },
  { key: 'LogoutTime',  label: 'Logout Time', format: fmtDate },
  { key: 'SessionTime', label: 'Session Time' },
  { key: 'UserStatus',  label: 'Status' },
]

const LoginHistoryReport = () => {
  const { data: usersApi } = useGetUsersQuery()
  const [fetchHistory, { data, isFetching, isError }] = useLazyGetLoginHistoryQuery()

  const [userId, setUserId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [search, setSearch] = useState('')

  const users = usersApi?.users || []

  useEffect(() => { fetchHistory({}) }, []) // eslint-disable-line

  const rows = Array.isArray(data?.data) ? data.data : []

  const handleSubmit = () => {
    fetchHistory({
      user_id: userId || undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
    })
  }

  const handleCancel = () => {
    setUserId('')
    setFromDate('')
    setToDate('')
    setSearch('')
    fetchHistory({})
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
      COLUMNS.forEach(({ key, label, format }) => { out[label] = format ? format(r[key]) : (r[key] ?? '') })
      return out
    })
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'LoginHistory')
    XLSX.writeFile(wb, `LoginHistory_${new Date().toISOString().split('T')[0]}.xlsx`)
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
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-3 border-b border-blue-800">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase flex items-center gap-2">
                  <FiUsers /> Login History
                </h2>
              </div>

              <div className="p-6 bg-white">
                <div className="flex flex-col lg:flex-row items-center justify-center gap-6">

                  {/* User */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full lg:w-auto">
                    <label className="text-sm font-bold text-slate-700 uppercase whitespace-nowrap min-w-[60px]">User</label>
                    <div className="relative w-full sm:w-64">
                      <select
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm bg-white text-slate-700"
                      >
                        <option value="">— All Users (Today) —</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.username} ({u.username})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* From Date */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full lg:w-auto">
                    <label className="text-sm font-bold text-slate-700 uppercase whitespace-nowrap min-w-[60px]">From</label>
                    <div className="relative w-full sm:w-48">
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm text-slate-700"
                      />
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    </div>
                  </div>

                  {/* To Date */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full lg:w-auto">
                    <label className="text-sm font-bold text-slate-700 uppercase whitespace-nowrap min-w-[30px]">To</label>
                    <div className="relative w-full sm:w-48">
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm text-slate-700"
                      />
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-auto lg:ml-0 mt-4 lg:mt-0 w-full lg:w-auto justify-end">
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 bg-slate-100 border border-slate-300 text-slate-600 rounded text-sm font-medium hover:bg-slate-200 transition-colors shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isFetching}
                      className="flex items-center gap-2 px-6 py-2 bg-[#0e4a78] text-white rounded text-sm font-bold hover:bg-[#0a3b61] transition-colors shadow-md uppercase disabled:opacity-60"
                    >
                      {isFetching ? <FiRefreshCw className="animate-spin" size={13} /> : null}
                      {isFetching ? 'Loading…' : 'Submit'}
                    </button>
                  </div>

                </div>
              </div>
            </section>

            {/* Table Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-3 shadow-md flex items-center justify-between">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  Login History Report
                  {!isFetching && <span className="ml-2 text-xs font-normal text-white/60">({filteredData.length} records)</span>}
                </h2>
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
                            <FiRefreshCw className="inline animate-spin mr-2" /> Loading login history…
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
                              const display = column.format ? column.format(raw) : (raw != null && raw !== '' ? raw : '—')
                              return (
                                <td
                                  key={column.key}
                                  className={`px-5 py-3 whitespace-nowrap border-r border-slate-100 last:border-r-0 ${
                                    column.key === 'UserStatus'
                                      ? raw === 'ACTIVE' ? 'text-emerald-600 font-semibold' : 'text-slate-400 font-semibold'
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
                            No data available in table
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

export default LoginHistoryReport
