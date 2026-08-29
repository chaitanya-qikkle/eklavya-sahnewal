import React, { useState, useRef, useMemo } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FiX, FiSearch, FiRefreshCw, FiUploadCloud, FiDownload } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import { MdGpsFixed } from 'react-icons/md'
import * as XLSX from 'xlsx'
import { useLazyGetContainerTrackingDataQuery, useGetContainerListQuery } from '../../../store/api/ymsApi'

const COLUMNS = [
  { key: 'ContNo',        label: 'Container No' },
  { key: 'ContSize',      label: 'Size' },
  { key: 'ContTypeName',  label: 'Type' },
  { key: 'ProcessName',   label: 'Process' },
  { key: 'Location',      label: 'Location' },
]

const PROCESS_COLORS = {
  Empty:    'text-emerald-600',
  Domestic: 'text-amber-600',
  Import:   'text-blue-600',
  Export:   'text-purple-600',
}

const ContainerTracking = () => {
  const [fetchTracking, { data, isFetching }] = useLazyGetContainerTrackingDataQuery()
  const { data: containerListApi } = useGetContainerListQuery()

  const [containers, setContainers]   = useState([])
  const [inputValue, setInputValue]   = useState('')
  const [error, setError]             = useState(null)
  const [hasQueried, setHasQueried]   = useState(false)
  const [dragActive, setDragActive]   = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const fileInputRef = useRef(null)

  const rows = Array.isArray(data?.data) ? data.data : []

  const allContainerNos = useMemo(() => {
    const list = Array.isArray(containerListApi?.data) ? containerListApi.data : []
    return list.map((r) => String(r?.ContNo ?? '').trim().toUpperCase()).filter(Boolean)
  }, [containerListApi])

  const suggestions = useMemo(() => {
    const q = inputValue.trim().toUpperCase()
    if (!q) return []
    return allContainerNos
      .filter((no) => no.includes(q) && !containers.includes(no))
      .slice(0, 8)
  }, [inputValue, allContainerNos, containers])

  const addContainer = (val) => {
    const v = val.trim().toUpperCase()
    if (!v) return
    setContainers((prev) => (prev.includes(v) ? prev : [...prev, v]))
    setInputValue('')
    setShowSuggestions(false)
    setActiveSuggestion(-1)
  }

  const handleInputKeyDown = (e) => {
    if (showSuggestions && suggestions.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setActiveSuggestion((prev) => {
        const dir = e.key === 'ArrowDown' ? 1 : -1
        const next = prev + dir
        if (next < 0) return suggestions.length - 1
        if (next >= suggestions.length) return 0
        return next
      })
      return
    }
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (showSuggestions && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        addContainer(suggestions[activeSuggestion])
      } else {
        addContainer(inputValue)
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setActiveSuggestion(-1)
    } else if (e.key === 'Backspace' && !inputValue && containers.length) {
      setContainers((prev) => prev.slice(0, -1))
    }
  }

  const removeContainer = (val) => {
    setContainers((prev) => prev.filter((c) => c !== val))
  }

  const handleShowContainer = async () => {
    setError(null)
    setHasQueried(true)
    const list = inputValue.trim() ? [...containers, inputValue.trim().toUpperCase()] : containers
    if (!list.length) {
      setError('Enter at least one container number.')
      return
    }
    try {
      await fetchTracking(list.join(',')).unwrap()
      setInputValue('')
    } catch (err) {
      setError(err?.data?.detail || err?.data?.message || err?.error || 'Failed to fetch container data.')
    }
  }

  const handleExport = () => {
    if (!rows.length) return
    const exportRows = rows.map((r) => {
      const out = {}
      COLUMNS.forEach(({ key, label }) => { out[label] = r[key] ?? '' })
      return out
    })
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'ContainerTracking')
    XLSX.writeFile(wb, `ContainerTracking_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleDownloadFormat = () => {
    const ws = XLSX.utils.aoa_to_sheet([['Container No']])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Format')
    XLSX.writeFile(wb, 'ContainerTracking_UploadFormat.xlsx')
  }

  const readFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rowsFromFile = XLSX.utils.sheet_to_json(ws, { header: 1 })
        const nos = rowsFromFile
          .flat()
          .map((v) => String(v ?? '').trim().toUpperCase())
          .filter((v) => v && v !== 'CONTAINER NO')
        if (nos.length) {
          setContainers((prev) => Array.from(new Set([...prev, ...nos])))
        }
      } catch {
        setError('Could not read the uploaded file.')
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleFileInput = (e) => {
    readFile(e.target.files?.[0])
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    readFile(e.dataTransfer.files?.[0])
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
                <MdGpsFixed className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#0e4a78]">Container Tracking</h1>
                <p className="text-slate-500 text-sm">Search containers to view their current status and location</p>
              </div>
            </div>

            {/* Search Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex items-center gap-2">
                <FiSearch className="text-white text-base" />
                <h2 className="text-white font-bold text-base tracking-wide">Container Tracking</h2>
              </div>

              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                  <div className="flex-1 flex flex-col gap-1.5 relative">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">
                      Cont No
                    </label>
                    <div className="flex flex-wrap items-center gap-2 w-full px-3 py-2 min-h-[46px] rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-[#0e4a78] focus-within:border-[#0e4a78] shadow-sm transition-colors">
                      {containers.map((c) => (
                        <span
                          key={c}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#eaf1f7] border border-[#c9dbe9] text-[#0e4a78] text-sm font-semibold"
                        >
                          {c}
                          <button
                            type="button"
                            onClick={() => removeContainer(c)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <FiX className="text-xs" />
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => {
                          setInputValue(e.target.value.toUpperCase())
                          setShowSuggestions(true)
                          setActiveSuggestion(-1)
                        }}
                        onFocus={() => inputValue.trim() && setShowSuggestions(true)}
                        onKeyDown={handleInputKeyDown}
                        onBlur={() => {
                          setTimeout(() => setShowSuggestions(false), 120)
                          if (inputValue.trim()) addContainer(inputValue)
                        }}
                        placeholder={containers.length ? '' : 'Enter container no. and press Enter'}
                        className="flex-1 min-w-[160px] py-1 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
                      />
                    </div>

                    {showSuggestions && suggestions.length > 0 && (
                      <ul className="absolute top-full left-0 right-0 mt-1 z-20 bg-white rounded-lg border border-slate-200 shadow-lg max-h-56 overflow-y-auto">
                        {suggestions.map((no, idx) => (
                          <li
                            key={no}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              addContainer(no)
                            }}
                            className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                              idx === activeSuggestion
                                ? 'bg-[#0e4a78] text-white'
                                : 'text-slate-700 hover:bg-[#eaf1f7]'
                            }`}
                          >
                            {no}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <button
                    onClick={handleShowContainer}
                    disabled={isFetching}
                    className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-[#0e4a78] text-white text-sm font-bold hover:bg-[#0a3b61] transition-colors shadow-md disabled:opacity-60 uppercase tracking-wide whitespace-nowrap"
                  >
                    {isFetching
                      ? <FiRefreshCw className="animate-spin text-base" />
                      : <FiSearch className="text-base" />
                    }
                    {isFetching ? 'Loading…' : 'Show Container'}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

              {/* File Upload Card */}
              <div className="lg:col-span-1 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden h-fit">
                <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex items-center gap-2">
                  <FiUploadCloud className="text-white text-base" />
                  <h2 className="text-white font-bold text-base tracking-wide">File Upload</h2>
                </div>

                <div className="p-5 space-y-3">
                  <button
                    onClick={handleDownloadFormat}
                    className="flex items-center gap-2 text-sm font-semibold text-[#0e4a78] hover:underline"
                  >
                    <FiDownload className="text-base" />
                    Download Excel Format
                  </button>

                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex items-center justify-center text-center px-4 py-10 rounded-lg border-2 border-dashed cursor-pointer transition-colors
                      ${dragActive ? 'border-[#0e4a78] bg-[#eaf1f7]' : 'border-slate-300 bg-slate-50 hover:border-slate-400'}`}
                  >
                    <p className="text-slate-500 text-sm font-medium">Drop files here to upload</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xls,.xlsx"
                      className="hidden"
                      onChange={handleFileInput}
                    />
                  </div>

                  <p className="text-xs font-bold text-red-500">UPLOAD ONLY XLS/XLSX FILE</p>
                </div>
              </div>

              {/* Results Card */}
              <div className="lg:col-span-3 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex items-center justify-between gap-3">
                  <h2 className="text-white font-bold text-base tracking-wide">View Container Detail</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExport}
                      disabled={!rows.length}
                      title="Export to Excel"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 shadow"
                    >
                      <FaFileExcel />
                      <span className="hidden sm:inline">Export</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {error ? (
                    <div className="px-8 py-12 text-center">
                      <div className="text-red-500 font-semibold text-sm">{error}</div>
                    </div>
                  ) : isFetching ? (
                    <div className="px-8 py-12 flex flex-col items-center gap-3 text-slate-400">
                      <div className="w-10 h-10 border-2 border-slate-200 border-t-[#0e4a78] rounded-full animate-spin" />
                      <p className="text-sm font-medium">Loading container data…</p>
                    </div>
                  ) : !hasQueried ? (
                    <div className="px-8 py-14 text-center">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                        <MdGpsFixed className="text-slate-400 text-xl" />
                      </div>
                      <p className="text-slate-400 text-sm font-medium">
                        Enter container numbers above and click <strong className="text-slate-600">Show Container</strong> to view details.
                      </p>
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="px-8 py-12 text-center text-slate-400 text-sm">
                      No records found for the given container(s).
                    </div>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          {COLUMNS.map((col) => (
                            <th
                              key={col.key}
                              className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map((row, index) => (
                          <tr
                            key={index}
                            className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/50`}
                          >
                            {COLUMNS.map((col) => {
                              const raw = row[col.key]
                              const display = raw != null && raw !== '' ? String(raw) : <span className="text-slate-300">—</span>
                              const isProcess = col.key === 'ProcessName'
                              return (
                                <td
                                  key={col.key}
                                  className={`px-4 py-3 whitespace-nowrap ${
                                    col.key === 'ContNo'
                                      ? 'text-slate-800 font-semibold'
                                      : isProcess
                                      ? `font-semibold ${PROCESS_COLORS[raw] || 'text-slate-600'}`
                                      : 'text-slate-600'
                                  }`}
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

                {rows.length > 0 && !isFetching && (
                  <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
                    <span>Showing <strong className="text-slate-700">{rows.length}</strong> records</span>
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

export default ContainerTracking
