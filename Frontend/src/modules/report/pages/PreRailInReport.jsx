import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FaFileExcel } from 'react-icons/fa'
import { FiRefreshCw, FiSearch, FiX, FiChevronDown, FiTruck, FiPackage, FiUpload, FiDownload, FiHome } from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { useLazyGetRailJourneyByDocumentQuery, useGetDocumentNumbersQuery } from '../../../store/api/ymsApi'

const TONE_MAP = {
  slate:   { accent: "#0e4a78", iconColor: "text-[#0e4a78]",   iconBg: "bg-[#0e4a78]/10", valueColor: "text-[#0e4a78]",   badgeBg: "bg-[#0e4a78]/8",  activeBg: "bg-[#0e4a78]"   },
  emerald: { accent: "#059669", iconColor: "text-emerald-600", iconBg: "bg-emerald-50",    valueColor: "text-emerald-700", badgeBg: "bg-emerald-50",   activeBg: "bg-emerald-600" },
  amber:   { accent: "#d97706", iconColor: "text-amber-600",   iconBg: "bg-amber-50",      valueColor: "text-amber-700",   badgeBg: "bg-amber-50",     activeBg: "bg-amber-500"   },
  violet:  { accent: "#7c3aed", iconColor: "text-violet-600",  iconBg: "bg-violet-50",     valueColor: "text-violet-700",  badgeBg: "bg-violet-50",    activeBg: "bg-violet-600"  },
  rose:    { accent: "#e11d48", iconColor: "text-rose-600",    iconBg: "bg-rose-50",       valueColor: "text-rose-700",    badgeBg: "bg-rose-50",      activeBg: "bg-rose-600"    },
}

const StatTile = ({ label, value, icon: Icon, tone = "slate", isActive, onClick, total }) => {
  const t = TONE_MAP[tone] || TONE_MAP.slate
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative text-left transition-all duration-150 overflow-hidden border-r border-slate-200 last:border-r-0
        ${isActive ? "bg-slate-50" : "bg-white hover:bg-slate-50/70"}`}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px] transition-all duration-150" style={{ background: isActive ? t.accent : "transparent" }} />
      <div className="pl-4 pr-4 py-3.5 flex items-center gap-3.5">
        <span className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg ${isActive ? `${t.activeBg} text-white` : `${t.iconBg} ${t.iconColor}`} transition-all duration-150`}>
          {Icon && <Icon className="text-[15px]" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400 leading-tight mb-1.5">{label}</p>
          <p className={`text-2xl font-black leading-none tracking-tight transition-colors ${isActive ? t.valueColor : "text-slate-700"}`}>{value.toLocaleString()}</p>
        </div>
        {total > 0 && tone !== "slate" && (
          <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${t.badgeBg} transition-colors`} style={{ color: t.accent }}>{pct}%</span>
        )}
      </div>
      <div className="h-[2px] bg-slate-100">
        {total > 0 && tone !== "slate" && (
          <div className="h-full transition-all duration-700 rounded-full" style={{ width: `${pct}%`, background: t.accent }} />
        )}
      </div>
    </button>
  )
}

const fmtDate = (val) => {
  if (!val) return '—'
  const d = new Date(String(val).replace(' ', 'T'))
  if (isNaN(d)) return String(val)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
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
  const [processFilter, setProcessFilter] = useState('all')

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

  const handleSearch = () => {
    if (!selectedDocs.length) return
    setHasQueried(true)
    fetchDetail(selectedDocs.join(','))
  }

  const handleClear = () => {
    setSelectedDocs([])
    setDocSearch('')
    setSearch('')
    setProcessFilter('all')
  }

  const processStats = useMemo(() => {
    const total = rows.length
    const exportCount = rows.filter(r => String(r.TransactionType || '').toUpperCase() === 'EXPORT').length
    const importCount = rows.filter(r => String(r.TransactionType || '').toUpperCase() === 'IMPORT').length
    const emptyCount = rows.filter(r => String(r.TransactionType || '').toUpperCase() === 'EMPTY').length
    const domesticCount = rows.filter(r => String(r.TransactionType || '').toUpperCase() === 'DOMESTIC').length
    return { total, exportCount, importCount, emptyCount, domesticCount }
  }, [rows])

  const filteredData = useMemo(() => {
    let result = rows
    if (processFilter !== 'all') result = result.filter(r => String(r.TransactionType || '').toUpperCase() === processFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((r) => COLUMNS.some(({ key }) => String(r[key] ?? '').toLowerCase().includes(q)))
    }
    return result
  }, [rows, search, processFilter])

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

            {/* Page Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0e4a78] flex items-center justify-center shadow">
                <FiTruck className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#0e4a78]">All Rail Journey Detail</h1>
                <p className="text-slate-500 text-sm">Container-level journey detail by rail document</p>
              </div>
            </div>

            {/* Filter Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-visible">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex items-center gap-2 rounded-t-2xl">
                <FiSearch className="text-white text-base" />
                <h2 className="text-white font-bold text-base tracking-wide">Search Criteria</h2>
              </div>

              <div className="p-6 rounded-b-2xl">
                <div className="flex flex-col lg:flex-row lg:items-end gap-4">

                  {/* Document No multi-select */}
                  <div className="flex flex-col gap-1.5 relative w-full lg:w-[420px]" ref={docBoxRef}>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">Document No</label>
                    <button
                      type="button"
                      onClick={() => setDocOpen((o) => !o)}
                      className="flex items-center justify-between w-full px-3 py-2.5 min-h-[42px] rounded-lg border border-slate-300 bg-white text-sm text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] transition-colors"
                    >
                      <span className="flex flex-wrap gap-1.5 items-center">
                        {selectedDocs.length === 0 ? (
                          <span className="text-slate-500">None selected</span>
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
                      onClick={handleClear}
                      className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      Clear
                    </button>
                    <button
                      onClick={handleSearch}
                      disabled={isFetching || !selectedDocs.length}
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

            {/* Process filter pills */}
            <div className="grid grid-cols-5 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm w-full lg:w-[840px]">
              <StatTile
                label="Total Entries"
                value={processStats.total}
                icon={FiPackage}
                tone="slate"
                isActive={processFilter === 'all'}
                onClick={() => setProcessFilter('all')}
                total={processStats.total}
              />
              <StatTile
                label="Export"
                value={processStats.exportCount}
                icon={FiUpload}
                tone="amber"
                isActive={processFilter === 'EXPORT'}
                onClick={() => setProcessFilter('EXPORT')}
                total={processStats.total}
              />
              <StatTile
                label="Import"
                value={processStats.importCount}
                icon={FiDownload}
                tone="emerald"
                isActive={processFilter === 'IMPORT'}
                onClick={() => setProcessFilter('IMPORT')}
                total={processStats.total}
              />
              <StatTile
                label="Empty"
                value={processStats.emptyCount}
                icon={FiPackage}
                tone="violet"
                isActive={processFilter === 'EMPTY'}
                onClick={() => setProcessFilter('EMPTY')}
                total={processStats.total}
              />
              <StatTile
                label="Domestic"
                value={processStats.domesticCount}
                icon={FiHome}
                tone="rose"
                isActive={processFilter === 'DOMESTIC'}
                onClick={() => setProcessFilter('DOMESTIC')}
                total={processStats.total}
              />
            </div>

            {/* Results Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-white font-bold text-lg tracking-wide uppercase">Rail Journey Detail</h2>
                  <p className="text-white/60 text-xs mt-0.5">{filteredData.length.toLocaleString()} records</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search…"
                      className="pl-8 pr-3 py-2 rounded-lg border border-white/30 bg-white/10 text-white placeholder-white/50 text-sm focus:outline-none focus:ring-1 focus:ring-white/50 w-44 transition-colors"
                    />
                    <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60 text-sm pointer-events-none" />
                    {search && (
                      <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white">
                        <FiX className="text-xs" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleExport}
                    disabled={!filteredData.length}
                    title="Export to Excel"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 shadow"
                  >
                    <FaFileExcel />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                {isError ? (
                  <div className="px-8 py-12 text-center">
                    <div className="text-red-500 font-semibold text-sm">Failed to load data. Check backend connection.</div>
                  </div>
                ) : isFetching ? (
                  <div className="px-8 py-12 flex flex-col items-center gap-3 text-slate-400">
                    <div className="w-10 h-10 border-2 border-slate-200 border-t-[#0e4a78] rounded-full animate-spin" />
                    <p className="text-sm font-medium">Loading rail journey detail…</p>
                  </div>
                ) : !hasQueried ? (
                  <div className="px-8 py-14 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                      <FiTruck className="text-slate-400 text-xl" />
                    </div>
                    <p className="text-slate-400 text-sm font-medium">
                      Select document number(s) and click <strong className="text-slate-600">Search</strong> to load data.
                    </p>
                  </div>
                ) : filteredData.length === 0 ? (
                  <div className="px-8 py-12 text-center text-slate-400 text-sm">
                    No records found for the selected criteria.
                  </div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {COLUMNS.map((col) => (
                          <th key={col.key} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredData.map((row, index) => (
                        <tr key={index} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/50`}>
                          {COLUMNS.map((col) => {
                            const raw = row[col.key]
                            const display = col.format ? col.format(raw) : (raw != null && raw !== '' ? raw : <span className="text-slate-300">—</span>)
                            return (
                              <td
                                key={col.key}
                                className={`px-4 py-3 whitespace-nowrap ${col.key === 'ContainerNo' ? 'text-slate-800 font-semibold' : 'text-slate-600'}`}
                              >
                                {display}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {filteredData.length > 0 && !isFetching && (
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
                  <span>Showing <strong className="text-slate-700">{filteredData.length}</strong> records</span>
                </div>
              )}
            </div>

          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default PreRailInReport
