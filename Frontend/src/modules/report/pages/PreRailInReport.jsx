import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FaFileExcel } from 'react-icons/fa'
import { FiRefreshCw, FiSearch, FiX, FiChevronDown, FiTruck } from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { useLazyGetRailJourneyByDocumentQuery, useGetDocumentNumbersQuery } from '../../../store/api/ymsApi'

const fmtDate = (val) => {
  if (!val) return '—'
  const d = new Date(String(val).replace(' ', 'T'))
  if (isNaN(d)) return String(val)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const COLUMNS = [
  { key: 'ContainerNo',      label: 'Container No' },
  { key: 'NAVDateTime',      label: 'Navision Date', format: fmtDate },
  { key: 'ContainerSize',    label: 'Size' },
  { key: 'ContainerType',    label: 'Type' },
  { key: 'DocumentNo',       label: 'Document No' },
  { key: 'TransactionType',  label: 'Process' },
  { key: 'BookingNo',        label: 'Booking No' },
  { key: 'Terminal',         label: 'Terminal' },
  { key: 'Mode',             label: 'Mode' },
  { key: 'WagonNo',          label: 'Wagon No' },
  { key: 'YardType',         label: 'Yard Type' },
  { key: 'YardInTime',       label: 'Yard In Time', format: fmtDate },
  { key: 'ContainerStatus',  label: 'Container Status' },
]

const PreRailInReport = () => {
  const [searchParams] = useSearchParams()
  const initialDocumentNo = searchParams.get('document_no') || ''

  const { data: docNoApi } = useGetDocumentNumbersQuery()
  const [fetchDetail, { data, isFetching, isError }] = useLazyGetRailJourneyByDocumentQuery()

  const documentList = useMemo(() => {
    const rows = Array.isArray(docNoApi?.data) ? docNoApi.data : []
    return Array.from(new Set(rows.map((r) => String(r?.DocumentNo ?? '').trim()).filter(Boolean)))
  }, [docNoApi])

  const [selectedDocs, setSelectedDocs] = useState(initialDocumentNo ? [initialDocumentNo] : [])
  const [docSearch, setDocSearch] = useState('')
  const [docOpen, setDocOpen] = useState(false)
  const docBoxRef = useRef(null)
  const [search, setSearch] = useState('')
  const [hasQueried, setHasQueried] = useState(false)

  useEffect(() => {
    if (initialDocumentNo) {
      setHasQueried(true)
      fetchDetail(initialDocumentNo)
    }
  }, []) // eslint-disable-line

  useEffect(() => {
    const onClickOutside = (e) => {
      if (docBoxRef.current && !docBoxRef.current.contains(e.target)) setDocOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filteredDocOptions = useMemo(() => {
    const q = docSearch.trim().toLowerCase()
    if (!q) return documentList
    return documentList.filter((d) => d.toLowerCase().includes(q))
  }, [documentList, docSearch])

  const toggleDoc = (doc) => {
    setSelectedDocs((prev) => prev.includes(doc) ? prev.filter((d) => d !== doc) : [...prev, doc])
  }
  const removeDoc = (doc) => setSelectedDocs((prev) => prev.filter((d) => d !== doc))

  const rows = Array.isArray(data?.data) ? data.data : []

  const handleSubmit = () => {
    if (!selectedDocs.length) return
    setHasQueried(true)
    fetchDetail(selectedDocs.join(','))
  }

  const handleCancel = () => {
    setSelectedDocs([])
    setDocSearch('')
    setSearch('')
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
    XLSX.utils.book_append_sheet(wb, ws, 'AllRailJourneyDetail')
    XLSX.writeFile(wb, `AllRailJourneyDetail_${new Date().toISOString().split('T')[0]}.xlsx`)
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
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-visible">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-3 border-b border-blue-800 rounded-t-2xl">
                <h2 className="text-white font-bold text-lg tracking-wide uppercase">
                  All Rail Journey Detail
                </h2>
              </div>

              <div className="p-6 bg-white rounded-b-2xl">
                <div className="flex flex-col lg:flex-row items-end gap-4">

                  {/* Document No multi-select */}
                  <div className="flex flex-col gap-1.5 relative w-full lg:w-[420px]" ref={docBoxRef}>
                    <label className="text-xs font-bold text-slate-700 uppercase whitespace-nowrap">Document No</label>
                    <button
                      type="button"
                      onClick={() => setDocOpen((o) => !o)}
                      className="flex items-center justify-between w-full px-3 py-2 min-h-[42px] rounded border border-slate-300 bg-white text-sm text-left shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                    >
                      <span className="flex flex-wrap gap-1.5 items-center">
                        {selectedDocs.length === 0 ? (
                          <span className="text-slate-400">None selected</span>
                        ) : selectedDocs.length <= 3 ? (
                          selectedDocs.map((doc) => (
                            <span key={doc} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#eaf1f7] border border-[#c9dbe9] text-[#0e4a78] text-xs font-semibold">
                              {doc}
                              <FiX className="text-[10px] hover:text-red-500 cursor-pointer" onClick={(e) => { e.stopPropagation(); removeDoc(doc) }} />
                            </span>
                          ))
                        ) : (
                          <span className="text-[#0e4a78] font-semibold text-xs">{selectedDocs.length} documents selected</span>
                        )}
                      </span>
                      <FiChevronDown className={`text-slate-400 shrink-0 ml-2 transition-transform ${docOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {docOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden">
                        <div className="p-2 border-b border-slate-100 relative">
                          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                          <input
                            type="text"
                            value={docSearch}
                            onChange={(e) => setDocSearch(e.target.value)}
                            placeholder="Search document no…"
                            className="w-full pl-7 pr-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#0e4a78]"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto">
                          {filteredDocOptions.map((doc) => (
                            <label key={doc} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-[#eaf1f7] transition-colors">
                              <input type="checkbox" checked={selectedDocs.includes(doc)} onChange={() => toggleDoc(doc)} className="accent-[#0e4a78]" />
                              <span className="text-slate-700">{doc}</span>
                            </label>
                          ))}
                          {filteredDocOptions.length === 0 && (
                            <p className="px-3 py-4 text-center text-xs text-slate-400">No matches</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 bg-slate-100 border border-slate-300 text-slate-600 rounded text-sm font-medium hover:bg-slate-200 transition-colors shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isFetching || !selectedDocs.length}
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
                  Rail Journey Detail
                  {!isFetching && <span className="ml-2 text-xs font-normal text-white/60">({filteredData.length} records)</span>}
                </h2>
              </div>

              <div className="px-6 py-6 space-y-4">

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExport}
                      disabled={!filteredData.length}
                      className="p-1 items-center justify-center flex disabled:opacity-40"
                      title="Export to Excel"
                    >
                      <FaFileExcel className="text-3xl text-green-700 hover:text-green-800 transition-colors" />
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
                        <th className="px-3 py-3 text-left font-bold text-white uppercase tracking-wider border-r border-[#ffffff40] whitespace-nowrap">#</th>
                        {COLUMNS.map((column) => (
                          <th key={column.key} className="px-3 py-3 text-left font-bold text-white uppercase tracking-wider border-r border-[#ffffff40] last:border-r-0 whitespace-nowrap">
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {isFetching ? (
                        <tr>
                          <td colSpan={COLUMNS.length + 1} className="px-5 py-8 text-center text-slate-500">
                            <FiRefreshCw className="inline animate-spin mr-2" /> Loading rail journey detail…
                          </td>
                        </tr>
                      ) : isError ? (
                        <tr>
                          <td colSpan={COLUMNS.length + 1} className="px-5 py-8 text-center text-red-500 font-semibold">
                            Failed to load data. Check backend connection.
                          </td>
                        </tr>
                      ) : !hasQueried ? (
                        <tr>
                          <td colSpan={COLUMNS.length + 1} className="px-5 py-14 text-center text-slate-400">
                            <FiTruck className="mx-auto text-3xl mb-2 text-slate-300" />
                            Select document number(s) and click <strong className="text-slate-600">Submit</strong> to view journey detail.
                          </td>
                        </tr>
                      ) : filteredData.length > 0 ? (
                        filteredData.map((row, index) => (
                          <tr key={index} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="px-3 py-3 text-slate-400 text-xs whitespace-nowrap border-r border-slate-100 text-center">{index + 1}</td>
                            {COLUMNS.map((column) => {
                              const raw = row[column.key]
                              const display = column.format ? column.format(raw) : (raw != null && raw !== '' ? raw : '—')
                              return (
                                <td
                                  key={column.key}
                                  className={`px-3 py-3 whitespace-nowrap border-r border-slate-100 last:border-r-0 ${
                                    column.key === 'ContainerNo' ? 'text-slate-800 font-semibold' : 'text-slate-700'
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
                          <td colSpan={COLUMNS.length + 1} className="px-5 py-3 text-slate-500 text-center">
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

export default PreRailInReport
