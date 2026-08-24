import React, { useState, useCallback, useEffect } from 'react'
import {
  FiSearch, FiRefreshCw, FiChevronUp, FiChevronDown,
  FiImage, FiX, FiCalendar, FiLogIn, FiLogOut,
  FiChevronLeft, FiChevronRight, FiDownload, FiMapPin, FiTruck as FiTruckIcon,
} from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { FaTruck } from 'react-icons/fa'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { useLazyGetPreGateSurveyQuery } from '../../../store/api/ymsApi'
import { buildAssetUrl } from '../../../config/api'

const PAGE_SIZE = 20

const IMAGE_SIDES = [
  { key: 'IMG_LEFT',  label: 'L', side: 'left'  },
  { key: 'IMG_RIGHT', label: 'R', side: 'right' },
  { key: 'IMG_BACK',  label: 'B', side: 'back'  },
  { key: 'IMG_TOP',   label: 'T', side: 'top'   },
]

function formatDateParts(raw) {
  if (!raw) return null
  try {
    const d = new Date(String(raw).replace(' ', 'T'))
    if (isNaN(d.getTime())) return null
    const p = (n) => String(n).padStart(2, '0')
    return {
      date: `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`,
      time: `${p(d.getHours())}:${p(d.getMinutes())}`,
    }
  } catch { return null }
}

function formatDate(raw) {
  const parts = formatDateParts(raw)
  return parts ? `${parts.date} ${parts.time}` : ''
}

/* ─── Lightbox ───────────────────────────────────────────────────────────── */
function ImageLightbox({ url, label, onClose }) {
  if (!url) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-5 py-3">
          <span className="font-semibold capitalize text-base flex items-center gap-2">
            <FiImage /> {label} Image
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          >
            <FiX className="text-lg" />
          </button>
        </div>
        <div className="flex items-center justify-center bg-slate-50 p-4 overflow-auto" style={{ maxHeight: '85vh' }}>
          <img src={url} alt={label} className="max-w-full object-contain rounded-lg" style={{ maxHeight: '80vh' }} />
        </div>
      </div>
    </div>
  )
}

/* ─── Sort Icon ──────────────────────────────────────────────────────────── */
function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span className="opacity-30 ml-1"><FiChevronUp size={10} /></span>
  return sortDir === 'asc'
    ? <FiChevronUp className="ml-1 text-blue-200" size={11} />
    : <FiChevronDown className="ml-1 text-blue-200" size={11} />
}

/* ─── Date Cell ──────────────────────────────────────────────────────────── */
function DateCell({ raw, highlight }) {
  const parts = formatDateParts(raw)
  if (!parts) return <span className="text-slate-300 text-xs">—</span>
  return (
    <div>
      <p className={`text-[11px] font-semibold ${highlight ? 'text-emerald-600' : 'text-slate-700'}`}>{parts.date}</p>
      <p className={`text-[10px] ${highlight ? 'text-emerald-500' : 'text-slate-400'}`}>{parts.time}</p>
    </div>
  )
}

/* ─── Image Cell (4 thumbnails: left/right/back/top) ───────────────────────── */
function ImagesCell({ row, onOpen }) {
  return (
    <div className="flex items-center gap-1 justify-center">
      {IMAGE_SIDES.map(({ key, label, side }) => {
        const url = buildAssetUrl(row[key])
        return url ? (
          <button
            key={key}
            onClick={() => onOpen(url, side)}
            title={`View ${side}`}
            className="w-7 h-7 rounded-lg border border-[#0e4a78]/30 bg-[#0e4a78]/10 text-[#0e4a78] hover:bg-[#0e4a78] hover:text-white flex items-center justify-center text-[9px] font-bold transition-all"
          >
            {label}
          </button>
        ) : (
          <span
            key={key}
            className="w-7 h-7 rounded-lg border border-slate-200 bg-slate-100 text-slate-300 flex items-center justify-center text-[9px] font-bold"
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function PreGateInOut() {
  const [fromDate,    setFromDate]    = useState('')
  const [toDate,      setToDate]      = useState('')
  const [containerNo, setContainerNo] = useState('')
  const [gateFilter,  setGateFilter]  = useState('ALL')
  const [page,        setPage]        = useState(1)
  const [sortCol,     setSortCol]     = useState('SurveyTime')
  const [sortDir,     setSortDir]     = useState('desc')
  const [lightbox,    setLightbox]    = useState(null)

  const [fetchSurvey, { data, isFetching, isError }] = useLazyGetPreGateSurveyQuery()

  const buildArgs = useCallback((pg = 1) => {
    const args = { page: pg, page_size: PAGE_SIZE }
    if (fromDate)               args.from_date    = fromDate
    if (toDate)                 args.to_date      = toDate
    if (containerNo.trim())     args.container_no = containerNo.trim()
    if (gateFilter !== 'ALL')   args.gate_type    = gateFilter
    return args
  }, [fromDate, toDate, containerNo, gateFilter])

  useEffect(() => { fetchSurvey(buildArgs(1)) }, []) // eslint-disable-line

  const handleSearch = () => { setPage(1); fetchSurvey(buildArgs(1)) }

  const handleExport = () => {
    const allRows = Array.isArray(data?.data) ? data.data : []
    if (!allRows.length) return
    const sheetData = allRows.map((row, i) => ({
      '#':              i + 1,
      'Container No':   row.ContainerNo   || '',
      'Size':           row.ContSize      || '',
      'Type':           row.ContType      || '',
      'Process':        row.Process       || '',
      'Gate':           row.GateName      || '',
      'Direction':      row.GateType      || '',
      'Gate In Date':   row.GateInDate    ? formatDate(row.GateInDate)  : '',
      'Gate Out Date':  row.GateOutDate   ? formatDate(row.GateOutDate) : '',
      'Survey Time':    row.SurveyTime    ? formatDate(row.SurveyTime)  : '',
      'Location':       row.Location      || '',
      'Vehicle No':     row.VehicleNo     || '',
      'Document No':    row.DocumentNo    || '',
      'Status':         row.Status        || '',
    }))
    const ws = XLSX.utils.json_to_sheet(sheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pre Gate Survey')
    XLSX.writeFile(wb, `PreGateSurvey_${fromDate || 'today'}_${toDate || 'today'}.xlsx`)
  }

  const handleClear = () => {
    setFromDate(''); setToDate('')
    setContainerNo(''); setGateFilter('ALL'); setPage(1)
    fetchSurvey({ page: 1, page_size: PAGE_SIZE })
  }

  const goToPage = (pg) => {
    const total_pages = data?.total_pages ?? 1
    if (pg < 1 || pg > total_pages) return
    setPage(pg)
    fetchSurvey(buildArgs(pg))
  }

  const toggleSort = (col) => {
    setSortCol(col)
    setSortDir(prev => (sortCol === col && prev === 'desc') ? 'asc' : 'desc')
  }

  const rows = (() => {
    const raw = Array.isArray(data?.data) ? [...data.data] : []
    return raw.sort((a, b) => {
      const av = String(a[sortCol] ?? ''), bv = String(b[sortCol] ?? '')
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  })()

  const total          = data?.total          ?? 0
  const gate_in_count  = data?.gate_in_count   ?? 0
  const gate_out_count = data?.gate_out_count  ?? 0
  const total_pages    = data?.total_pages     ?? 1

  const TH = ({ col, children }) => (
    <th
      onClick={() => toggleSort(col)}
      className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:bg-white/10 transition-colors"
    >
      <span className="flex items-center gap-0.5">
        {children}
        <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
      </span>
    </th>
  )

  return (
    <div
      className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      {/* App-standard light overlay */}
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 pb-10">

          {/* ── Header ── */}
          <header className="pt-6 pb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Gate Management</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0e4a78] flex items-center gap-2 mt-0.5">
                <FaTruck /> Pre Gate In / Out
              </h1>
              <p className="text-slate-500 mt-0.5 text-sm">
                {total.toLocaleString()} total records
              </p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-3 lg:gap-4">
              {[
                { label: 'Total',    val: total,          cls: 'from-[#0e4a78] to-[#0a3b61]',    light: 'text-blue-100'    },
                { label: 'Gate In',  val: gate_in_count,   cls: 'from-emerald-600 to-emerald-500', light: 'text-emerald-100' },
                { label: 'Gate Out', val: gate_out_count,  cls: 'from-amber-500 to-amber-600',     light: 'text-amber-100'   },
              ].map(s => (
                <div key={s.label} className={`bg-gradient-to-br ${s.cls} rounded-xl shadow-lg p-3 sm:p-4 text-white`}>
                  <p className={`text-xs uppercase tracking-wider font-semibold ${s.light}`}>{s.label}</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-1">{s.val.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </header>

          {/* ── Filter Bar ── */}
          <div className="bg-white/95 rounded-xl shadow-lg border border-slate-300 px-4 py-3 mb-4 flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <FiCalendar className="text-[#0e4a78]" size={11} /> From Date
              </label>
              <input
                type="date" value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="border-2 border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <FiCalendar className="text-[#0e4a78]" size={11} /> To Date
              </label>
              <input
                type="date" value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="border-2 border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Direction</label>
              <div className="flex gap-1.5">
                {['ALL', 'GATE_IN', 'GATE_OUT'].map(t => (
                  <button key={t} onClick={() => setGateFilter(t)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                      gateFilter === t
                        ? 'bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white border-[#0e4a78] shadow-md'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-[#0e4a78] hover:text-[#0e4a78]'
                    }`}>
                    {t === 'ALL' ? 'All' : t === 'GATE_IN' ? 'Gate In' : 'Gate Out'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <FiSearch className="text-[#0e4a78]" size={11} /> Container No
              </label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  value={containerNo}
                  onChange={e => setContainerNo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Search container…"
                  className="w-full border-2 border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleClear}
                className="px-4 py-2 rounded-lg border-2 border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all"
              >
                Clear
              </button>
              <button
                onClick={handleSearch}
                disabled={isFetching}
                className="flex items-center gap-2 bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] hover:from-[#0b3e66] hover:to-[#072c4a] text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-60"
              >
                <FiRefreshCw className={isFetching ? 'animate-spin' : ''} size={13} />
                {isFetching ? 'Loading…' : 'Search'}
              </button>
              <button
                onClick={handleExport}
                disabled={!data?.data?.length}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-40"
              >
                <FiDownload size={13} />
                Excel
              </button>
            </div>
          </div>

          {/* ── Table ── */}
          <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">

            {/* Table header bar */}
            <div className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
                  <FaTruck />
                </div>
                <div>
                  <p className="font-semibold text-base">Pre Gate In / Out Report</p>
                  <p className="text-xs text-white/60">
                    Page {page} of {total_pages} · {total.toLocaleString()} total · {PAGE_SIZE} per page
                  </p>
                </div>
              </div>
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-white/50 bg-white/10 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>

            {/* Error */}
            {isError && (
              <div className="px-6 py-10 text-center text-red-600 font-medium text-sm">
                Failed to load data. Please try again.
              </div>
            )}

            {/* Spinner */}
            {isFetching && (
              <div className="py-20 flex flex-col items-center gap-3 text-slate-500">
                <div className="w-10 h-10 rounded-full border-4 border-[#0e4a78]/20 border-t-[#0e4a78] animate-spin" />
                <span className="text-sm font-medium">Loading page {page}…</span>
              </div>
            )}

            {/* Table body */}
            {!isFetching && !isError && (
              <div className="overflow-x-auto">
                <table className="text-sm border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
                  <thead>
                    <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white text-xs">
                      <th className="px-2 py-2 text-left font-semibold uppercase tracking-wider border-r border-white/10 w-8">#</th>
                      <TH col="ContainerNo">Container No</TH>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Size / Type</th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Process</th>
                      <TH col="GateName">Gate</TH>
                      <TH col="GateInDate">Gate In</TH>
                      <TH col="GateOutDate">Gate Out</TH>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Location</th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Vehicle No</th>
                      <th className="px-2 py-2 text-center font-semibold uppercase tracking-wider w-32">Images</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-16 text-center">
                          <FiSearch className="mx-auto text-4xl text-slate-300 mb-3" />
                          <p className="font-semibold text-slate-400 text-sm">No records found</p>
                          <p className="text-xs text-slate-300 mt-1">Adjust the date range and click Search</p>
                        </td>
                      </tr>
                    ) : rows.map((row, idx) => {
                      const serial = (page - 1) * PAGE_SIZE + idx + 1
                      const isIn = row.GateType === 'GATE_IN'

                      return (
                        <tr
                          key={row.ContMasterID ?? row.ContainerNo ?? idx}
                          className={`border-b border-slate-100 hover:bg-blue-50 transition-colors
                            ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                        >
                          <td className="px-2 py-2 text-[10px] text-slate-400 font-medium border-r border-slate-100 w-8">
                            {serial}
                          </td>

                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 text-[#0e4a78] font-black font-mono text-xs">
                              {row.ContainerNo || '—'}
                            </span>
                            {row.DocumentNo && <div className="text-[10px] text-slate-400 mt-0.5 pl-1">{row.DocumentNo}</div>}
                          </td>

                          <td className="px-3 py-2 whitespace-nowrap">
                            {row.ContSize || row.ContType ? (
                              <>
                                <p className="text-xs font-bold text-slate-700">{row.ContSize || '—'}</p>
                                <p className="text-[10px] text-slate-400">{row.ContType || ''}</p>
                              </>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>

                          <td className="px-3 py-2 text-[11px] text-slate-600 font-medium whitespace-nowrap">
                            {row.Process || '—'}
                          </td>

                          <td className="px-3 py-2 whitespace-nowrap">
                            <p className="text-[11px] font-semibold text-slate-700">{row.GateName || '—'}</p>
                            <span className={`inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                              isIn ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                   : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {isIn ? <FiLogIn size={9} /> : <FiLogOut size={9} />}
                              {isIn ? 'IN' : 'OUT'}
                            </span>
                          </td>

                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <FiLogIn className="text-emerald-400 flex-shrink-0" size={11} />
                              <DateCell raw={row.GateInDate} highlight={isIn} />
                            </div>
                          </td>

                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <FiLogOut className="text-amber-400 flex-shrink-0" size={11} />
                              <DateCell raw={row.GateOutDate} />
                            </div>
                          </td>

                          <td className="px-3 py-2 text-[11px] text-slate-600 whitespace-nowrap max-w-[140px] truncate">
                            {row.Location
                              ? <span className="inline-flex items-center gap-1"><FiMapPin size={10} className="text-slate-400" />{row.Location}</span>
                              : <span className="text-slate-300 text-xs">—</span>}
                          </td>

                          <td className="px-3 py-2 text-[11px] text-slate-600 whitespace-nowrap">
                            {row.VehicleNo
                              ? <span className="inline-flex items-center gap-1"><FiTruckIcon size={10} className="text-slate-400" />{row.VehicleNo}</span>
                              : <span className="text-slate-300 text-xs">—</span>}
                          </td>

                          <td className="px-1.5 py-1.5 w-32">
                            <ImagesCell row={row} onOpen={(u, l) => setLightbox({ url: u, label: l })} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Pagination ── */}
            {!isFetching && total_pages > 0 && (
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Showing{' '}
                  <strong className="text-[#0e4a78]">{(page - 1) * PAGE_SIZE + 1}</strong>–<strong className="text-[#0e4a78]">{Math.min(page * PAGE_SIZE, total)}</strong>
                  {' '}of{' '}
                  <strong className="text-[#0e4a78]">{total.toLocaleString()}</strong> records
                </span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => goToPage(1)} disabled={page === 1}
                    className="px-2 py-1.5 rounded-lg border-2 border-slate-300 font-bold text-xs disabled:opacity-40 text-[#0e4a78] hover:bg-blue-50 hover:border-[#0e4a78] bg-white transition-all">
                    «
                  </button>
                  <button onClick={() => goToPage(page - 1)} disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg border-2 border-slate-300 font-bold text-xs disabled:opacity-40 text-[#0e4a78] hover:bg-blue-50 hover:border-[#0e4a78] bg-white flex items-center gap-1 transition-all">
                    <FiChevronLeft size={12} /> Prev
                  </button>

                  {Array.from({ length: Math.min(5, total_pages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, total_pages - 4))
                    const pg = start + i
                    if (pg > total_pages) return null
                    return (
                      <button key={pg} onClick={() => goToPage(pg)}
                        className={`w-9 h-8 rounded-lg border-2 text-xs font-bold transition-all ${
                          pg === page
                            ? 'bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white border-[#0e4a78] shadow-md'
                            : 'border-slate-300 text-[#0e4a78] hover:bg-blue-50 hover:border-[#0e4a78] bg-white'
                        }`}>
                        {pg}
                      </button>
                    )
                  })}

                  <button onClick={() => goToPage(page + 1)} disabled={page === total_pages}
                    className="px-3 py-1.5 rounded-lg border-2 border-slate-300 font-bold text-xs disabled:opacity-40 text-[#0e4a78] hover:bg-blue-50 hover:border-[#0e4a78] bg-white flex items-center gap-1 transition-all">
                    Next <FiChevronRight size={12} />
                  </button>
                  <button onClick={() => goToPage(total_pages)} disabled={page === total_pages}
                    className="px-2 py-1.5 rounded-lg border-2 border-slate-300 font-bold text-xs disabled:opacity-40 text-[#0e4a78] hover:bg-blue-50 hover:border-[#0e4a78] bg-white transition-all">
                    »
                  </button>
                </div>
              </div>
            )}
          </section>

        </main>
        <Footer />
      </div>

      {lightbox && (
        <ImageLightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}
