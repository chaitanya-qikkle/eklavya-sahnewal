import React, { useState, useMemo, useEffect } from 'react'
import {
  FiSearch, FiRefreshCw, FiChevronUp, FiChevronDown,
  FiImage, FiX, FiTruck as FiTruckIcon, FiPackage, FiLayers,
  FiHash, FiMapPin, FiClock, FiZoomIn, FiDownload as FiDownloadIcon,
  FiChevronLeft, FiChevronRight, FiHome,
} from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { FaDoorOpen } from 'react-icons/fa'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { useGetVehicleContainerDetectionQuery } from '../../../store/api/ymsApi'
import { buildAssetUrl } from '../../../config/api'

const TONE_MAP = {
  slate:   { accent: "#0e4a78", iconColor: "text-[#0e4a78]",   iconBg: "bg-[#0e4a78]/10", valueColor: "text-[#0e4a78]" },
  emerald: { accent: "#059669", iconColor: "text-emerald-600", iconBg: "bg-emerald-50",    valueColor: "text-emerald-700" },
  amber:   { accent: "#d97706", iconColor: "text-amber-600",   iconBg: "bg-amber-50",      valueColor: "text-amber-700" },
}

const StatTile = ({ label, value, icon: Icon, tone = "slate" }) => {
  const t = TONE_MAP[tone] || TONE_MAP.slate
  return (
    <div className="relative text-left overflow-hidden border-r border-slate-200 last:border-r-0 bg-white">
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: t.accent }} />
      <div className="pl-4 pr-4 py-3.5 flex items-center gap-3.5">
        <span className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg ${t.iconBg} ${t.iconColor}`}>
          {Icon && <Icon className="text-[15px]" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400 leading-tight mb-1.5">
            {label}
          </p>
          <p className={`text-2xl font-black leading-none tracking-tight ${t.valueColor}`}>
            {value.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}

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

function DateCell({ raw }) {
  const parts = formatDateParts(raw)
  if (!parts) return <span className="text-slate-300 text-xs">—</span>
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-700">{parts.date}</p>
      <p className="text-[10px] text-slate-400">{parts.time}</p>
    </div>
  )
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
            <FiImage /> {label}
          </span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
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

/* ─── Detail field row ───────────────────────────────────────────────────── */
function DetailField({ icon: Icon, label, children, accent = "#0e4a78" }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5 border-b border-slate-100 last:border-b-0">
      <span
        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
        style={{ background: `${accent}12`, color: accent }}
      >
        {Icon && <Icon size={12} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400 leading-tight">{label}</p>
        <div className="text-[13px] font-semibold text-slate-800 break-words leading-tight">{children}</div>
      </div>
    </div>
  )
}

/* ─── Card wrapping a group of DetailFields, with its own header ──────────── */
function DetailCard({ title, icon: Icon, accent, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${accent}12`, color: accent }}>
          <Icon size={12} />
        </span>
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">{title}</span>
      </div>
      <div className="px-4 py-1 overflow-y-auto">{children}</div>
    </div>
  )
}

/* ─── Detail Modal — left: record details, right: images ──────────────────── */
function DetailModal({ row, index, total, onClose, onPrev, onNext, onZoom }) {
  if (!row) return null

  const vehicleUrl = buildAssetUrl(row.VehicleImagePath)
  const containerUrl = buildAssetUrl(row.ContainerImagePath)

  const dwell = (() => {
    if (!row.VehicleDetectedTime || !row.ContainerDetectedTime) return null
    const a = new Date(String(row.VehicleDetectedTime).replace(' ', 'T'))
    const b = new Date(String(row.ContainerDetectedTime).replace(' ', 'T'))
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null
    const mins = Math.abs(b.getTime() - a.getTime()) / 60000
    if (mins < 60) return `${mins.toFixed(1)} min`
    return `${(mins / 60).toFixed(1)} hr`
  })()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[1600px] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col ring-1 ring-black/5"
        style={{ height: '95vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="relative flex items-center justify-between text-white px-7 py-5 shrink-0 overflow-hidden"
          style={{ background: "linear-gradient(120deg,#0e4a78 0%,#0b3e66 45%,#072c4a 100%)" }}
        >
          <div
            className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "18px 18px",
            }}
          />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shadow-inner">
              <FaDoorOpen size={20} />
            </div>
            <div>
              <p className="font-black text-xl leading-tight tracking-tight">Detection Record</p>
              <p className="text-xs text-white/60 font-medium mt-0.5">
                Record #{row.ID ?? '—'} <span className="mx-1.5 opacity-40">·</span> {index + 1} of {total}
              </p>
            </div>
          </div>
          <div className="relative flex items-center gap-2">
            <button
              onClick={onPrev}
              disabled={index <= 0}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
              title="Previous record"
            >
              <FiChevronLeft size={19} />
            </button>
            <button
              onClick={onNext}
              disabled={index >= total - 1}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
              title="Next record"
            >
              <FiChevronRight size={19} />
            </button>
            <div className="w-px h-7 bg-white/20 mx-2" />
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 hover:bg-red-500/80 transition-all"
              title="Close"
            >
              <FiX size={19} />
            </button>
          </div>
        </div>

        {/* Body — details on top (container | vehicle side-by-side),
            images fill the rest — flex-col with the images pane as flex-1
            so everything fits in the modal's fixed height, no page scroll. */}
        <div className="flex-1 min-h-0 flex flex-col bg-slate-100">

          {/* Top — details */}
          <div className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
            <div className="px-6 py-4">

              <div className="mb-3 flex flex-wrap gap-2.5">
                {row.ContainerNo && (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-[#1364a4] to-[#0a3b61] text-white font-black font-mono text-base shadow-lg shadow-[#0e4a78]/25">
                    <FiPackage size={15} /> {row.ContainerNo}
                  </span>
                )}
                {row.VehicleNo && (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white font-black font-mono text-base shadow-lg shadow-slate-900/20">
                    <FiTruckIcon size={15} /> {row.VehicleNo}
                  </span>
                )}
                {!row.VehicleNo && !row.ContainerNo && (
                  <span className="text-sm text-slate-400 font-medium">No identifiers captured</span>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Left — Container details (OCR + Gateway Rail integration) */}
                <DetailCard title="Container" icon={FiPackage} accent="#0e4a78">
                  <DetailField icon={FiPackage} label="Container No" accent="#0e4a78">
                    {row.ContainerNo || <span className="text-slate-300 font-normal">Not captured</span>}
                  </DetailField>
                  <DetailField icon={FiClock} label="Container Detected" accent="#059669">
                    {row.ContainerDetectedTime ? formatDate(row.ContainerDetectedTime) : <span className="text-slate-300 font-normal">—</span>}
                  </DetailField>
                  <DetailField icon={FiHash} label="Size / Type" accent="#0e4a78">
                    {(row.ContainerSize || row.ContainerType)
                      ? `${row.ContainerSize || '—'} ${row.ContainerType || ''}`.trim()
                      : <span className="text-slate-300 font-normal">—</span>}
                  </DetailField>
                  <DetailField icon={FiClock} label="Process / Status" accent="#059669">
                    {(row.Process || row.ContainerStatus)
                      ? `${row.Process || '—'} ${row.ContainerStatus ? `· ${row.ContainerStatus}` : ''}`.trim()
                      : <span className="text-slate-300 font-normal">—</span>}
                  </DetailField>
                  <DetailField icon={FiHash} label="Document No" accent="#64748b">
                    {row.DocumentNo || <span className="text-slate-300 font-normal">—</span>}
                  </DetailField>
                  <DetailField icon={FiHome} label="Terminal / Mode" accent="#d97706">
                    {(row.Terminal || row.Mode)
                      ? `${row.Terminal || '—'} ${row.Mode ? `· ${row.Mode}` : ''}`.trim()
                      : <span className="text-slate-300 font-normal">—</span>}
                  </DetailField>
                  <DetailField icon={FiClock} label="NAV Date/Time" accent="#059669">
                    {row.NAVDateTime || <span className="text-slate-300 font-normal">—</span>}
                  </DetailField>
                  <DetailField icon={FiHash} label="Integration Status" accent="#7c3aed">
                    {row.IntegrationStatus || <span className="text-slate-300 font-normal">Not integrated</span>}
                  </DetailField>
                </DetailCard>

                {/* Right — Vehicle / trailer details */}
                <DetailCard title="Vehicle" icon={FiTruckIcon} accent="#0e4a78">
                  <DetailField icon={FiTruckIcon} label="Vehicle No" accent="#0e4a78">
                    {row.VehicleNo || <span className="text-slate-300 font-normal">Not captured</span>}
                  </DetailField>
                  <DetailField icon={FiClock} label="Vehicle Detected" accent="#059669">
                    {row.VehicleDetectedTime ? formatDate(row.VehicleDetectedTime) : <span className="text-slate-300 font-normal">—</span>}
                  </DetailField>
                  <DetailField icon={FiTruckIcon} label="Integration Vehicle No" accent="#0e4a78">
                    {row.IntegrationVehicleNo || <span className="text-slate-300 font-normal">—</span>}
                  </DetailField>
                  <DetailField icon={FiMapPin} label="Gate" accent="#d97706">
                    {row.GateName || <span className="text-slate-300 font-normal">—</span>}
                  </DetailField>
                  <DetailField icon={FiHash} label="Record ID" accent="#64748b">
                    {row.ID ?? '—'}
                  </DetailField>
                  {dwell && (
                    <DetailField icon={FiClock} label="Time Between Detections" accent="#7c3aed">
                      {dwell}
                    </DetailField>
                  )}
                  {row.DetectionTimeDifferenceSeconds != null && (
                    <DetailField icon={FiClock} label="Vehicle ↔ Container Match Gap" accent="#7c3aed">
                      {row.DetectionTimeDifferenceSeconds}s
                    </DetailField>
                  )}
                </DetailCard>
              </div>
            </div>
          </div>

          {/* Bottom — dual images, fills remaining modal height */}
          <div className="flex-1 min-h-0">
            <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4 h-full">
              {[
                { url: vehicleUrl, label: 'Vehicle Snapshot', icon: FiTruckIcon, accent: '#0e4a78' },
                { url: containerUrl, label: 'Container Snapshot', icon: FiPackage, accent: '#0e4a78' },
              ].map(({ url, label, icon: Icon, accent }) => (
                <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden flex flex-col min-h-0">
                  <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
                    <span className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${accent}12`, color: accent }}>
                        <Icon size={12} />
                      </span>
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">{label}</span>
                    </span>
                    {url && (
                      <a
                        href={url}
                        download
                        onClick={e => e.stopPropagation()}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#0e4a78] hover:bg-[#0e4a78]/10 transition-colors"
                        title="Download image"
                      >
                        <FiDownloadIcon size={12} />
                      </a>
                    )}
                  </div>
                  {url ? (
                    <button
                      onClick={() => onZoom(url, label)}
                      className="group relative flex-1 min-h-0 flex items-center justify-center overflow-hidden w-full"
                      style={{ background: "repeating-conic-gradient(#f8fafc 0% 25%, #f1f5f9 0% 50%) 50% / 24px 24px" }}
                    >
                      <img src={url} alt={label} className="max-w-full max-h-full object-contain p-2" />
                      <span className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center">
                        <span className="w-14 h-14 rounded-full bg-white/90 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all flex items-center justify-center shadow-xl">
                          <FiZoomIn className="text-[#0e4a78]" size={24} />
                        </span>
                      </span>
                    </button>
                  ) : (
                    <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2.5 text-slate-300 bg-slate-50/50 w-full">
                      <span className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <FiImage size={28} />
                      </span>
                      <span className="text-xs font-semibold text-slate-400">No image available</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ImageThumb({ url, label, onOpen }) {
  return url ? (
    <button
      onClick={() => onOpen(url, label)}
      title={`View ${label}`}
      className="w-8 h-8 rounded-lg border border-[#0e4a78]/30 bg-[#0e4a78]/10 text-[#0e4a78] hover:bg-[#0e4a78] hover:text-white flex items-center justify-center transition-all"
    >
      <FiImage size={13} />
    </button>
  ) : (
    <span className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-100 text-slate-300 flex items-center justify-center">
      <FiImage size={13} />
    </span>
  )
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span className="opacity-30 ml-1"><FiChevronUp size={10} /></span>
  return sortDir === 'asc'
    ? <FiChevronUp className="ml-1 text-blue-200" size={11} />
    : <FiChevronDown className="ml-1 text-blue-200" size={11} />
}

const PAGE_SIZE = 20

const MainGate = () => {
  const { data, isFetching, isError, refetch } = useGetVehicleContainerDetectionQuery()
  const [search, setSearch] = useState('')
  const [gateFilter, setGateFilter] = useState('')
  const [sortCol, setSortCol] = useState('ID')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1') // draft text for the "Page ___" box, committed on blur/Enter
  const [lightbox, setLightbox] = useState(null)
  const [detailIdx, setDetailIdx] = useState(null) // index into `filtered`

  // Keep the draft box in sync whenever `page` changes from anywhere else
  // (Previous/Next buttons, search/filter resetting to page 1, etc.) —
  // the box only diverges from `page` while the operator is mid-typing.
  useEffect(() => { setPageInput(String(page)) }, [page])

  const rowsAll = Array.isArray(data?.data) ? data.data : []

  const gateOptions = useMemo(() => {
    const set = new Set(rowsAll.map(r => r.GateName).filter(Boolean))
    return Array.from(set).sort()
  }, [rowsAll])

  const filtered = useMemo(() => {
    let rows = rowsAll
    if (gateFilter) rows = rows.filter(r => r.GateName === gateFilter)
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      rows = rows.filter(r =>
        String(r.VehicleNo || '').toLowerCase().includes(s) ||
        String(r.ContainerNo || '').toLowerCase().includes(s)
      )
    }
    const sorted = [...rows].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av
      const as = String(av), bs = String(bv)
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as)
    })
    return sorted
  }, [rowsAll, gateFilter, search, sortCol, sortDir])

  const vehicleCount = useMemo(() => rowsAll.filter(r => r.VehicleDetectedTime).length, [rowsAll])
  const containerCount = useMemo(() => rowsAll.filter(r => r.ContainerDetectedTime).length, [rowsAll])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleSort = (col) => {
    setSortCol(col)
    setSortDir(prev => (sortCol === col && prev === 'asc') ? 'desc' : 'asc')
    setPage(1)
  }

  const handleExport = () => {
    const sheetData = filtered.map((row, i) => ({
      '#': i + 1,
      'Vehicle No': row.VehicleNo || '',
      'Container No': row.ContainerNo || '',
      'Gate': row.GateName || '',
      'Vehicle Detected': row.VehicleDetectedTime ? formatDate(row.VehicleDetectedTime) : '',
      'Container Detected': row.ContainerDetectedTime ? formatDate(row.ContainerDetectedTime) : '',
    }))
    const ws = XLSX.utils.json_to_sheet(sheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Main Gate Detection')
    XLSX.writeFile(wb, `MainGateDetection_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const handleClear = () => { setSearch(''); setGateFilter(''); setPage(1) }

  const TH = ({ col, children }) => (
    <th
      onClick={() => toggleSort(col)}
      className="px-3 py-2 text-left font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:bg-white/10 transition-colors"
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
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 pb-10">

          {/* ── Header ── */}
          <header className="pt-6 pb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Gate Management</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0e4a78] flex items-center gap-2 mt-0.5">
                <FaDoorOpen /> Main Gate
              </h1>
              <p className="text-slate-500 mt-0.5 text-sm">
                {rowsAll.length.toLocaleString()} total detections
              </p>
            </div>

            <div className="grid grid-cols-3 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm w-full lg:w-[540px] shrink-0">
              <StatTile label="Total" value={rowsAll.length} icon={FiLayers} tone="slate" />
              <StatTile label="Vehicle Detected" value={vehicleCount} icon={FiTruckIcon} tone="emerald" />
              <StatTile label="Container Detected" value={containerCount} icon={FiPackage} tone="amber" />
            </div>
          </header>

          {/* ── Filter Bar ── */}
          <div className="bg-white/95 rounded-xl shadow-lg border border-slate-300 px-4 py-3 mb-4 flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gate</label>
              <select
                value={gateFilter}
                onChange={e => { setGateFilter(e.target.value); setPage(1) }}
                className="border-2 border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all min-w-[160px]"
              >
                <option value="">All Gates</option>
                {gateOptions.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <FiSearch className="text-[#0e4a78]" size={11} /> Vehicle / Container No
              </label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search vehicle or container…"
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
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-2 bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] hover:from-[#0b3e66] hover:to-[#072c4a] text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-60"
              >
                <FiRefreshCw className={isFetching ? 'animate-spin' : ''} size={13} />
                {isFetching ? 'Loading…' : 'Refresh'}
              </button>
              <button
                onClick={handleExport}
                disabled={!filtered.length}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-40"
              >
                <FiChevronDown size={13} className="rotate-0" />
                Excel
              </button>
            </div>
          </div>

          {/* ── Table ── */}
          <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
            <div className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
                  <FaDoorOpen />
                </div>
                <div>
                  <p className="font-semibold text-base">Vehicle / Container Detection Log</p>
                  <p className="text-xs text-white/60">
                    Page {page} of {totalPages} · {filtered.length.toLocaleString()} total · {PAGE_SIZE} per page
                  </p>
                </div>
              </div>
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-white/50 bg-white/10 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>

            {isError && (
              <div className="px-6 py-10 text-center text-red-600 font-medium text-sm">
                Failed to load data. Please try again.
              </div>
            )}

            {isFetching && (
              <div className="py-20 flex flex-col items-center gap-3 text-slate-500">
                <div className="w-10 h-10 rounded-full border-4 border-[#0e4a78]/20 border-t-[#0e4a78] animate-spin" />
                <span className="text-sm font-medium">Loading…</span>
              </div>
            )}

            {!isFetching && !isError && (
              <div className="overflow-x-auto">
                <table className="text-sm border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
                  <thead>
                    <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white text-xs">
                      <th className="px-2 py-2 text-left font-semibold uppercase tracking-wider border-r border-white/10 w-8">#</th>
                      <TH col="VehicleNo">Vehicle No</TH>
                      <TH col="ContainerNo">Container No</TH>
                      <TH col="GateName">Gate</TH>
                      <TH col="VehicleDetectedTime">Vehicle Detected</TH>
                      <TH col="ContainerDetectedTime">Container Detected</TH>
                      <th className="px-2 py-2 text-center font-semibold uppercase tracking-wider w-24">Images</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center">
                          <FiSearch className="mx-auto text-4xl text-slate-300 mb-3" />
                          <p className="font-semibold text-slate-400 text-sm">No records found</p>
                        </td>
                      </tr>
                    ) : pageRows.map((row, idx) => {
                      const globalIdx = (page - 1) * PAGE_SIZE + idx
                      return (
                        <tr
                          key={row.ID ?? idx}
                          onClick={() => setDetailIdx(globalIdx)}
                          className={`border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                        >
                          <td className="px-2 py-2 text-[10px] text-slate-400 font-medium border-r border-slate-100 w-8">
                            {globalIdx + 1}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {row.VehicleNo
                              ? <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-black font-mono text-xs">{row.VehicleNo}</span>
                              : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {row.ContainerNo
                              ? <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 text-[#0e4a78] font-black font-mono text-xs">{row.ContainerNo}</span>
                              : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-slate-600 font-medium whitespace-nowrap">
                            {row.GateName || '—'}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap"><DateCell raw={row.VehicleDetectedTime} /></td>
                          <td className="px-3 py-2 whitespace-nowrap"><DateCell raw={row.ContainerDetectedTime} /></td>
                          <td className="px-2 py-1.5 w-24">
                            <div className="flex items-center gap-1.5 justify-center" onClick={e => e.stopPropagation()}>
                              <ImageThumb url={buildAssetUrl(row.VehicleImagePath)} label="Vehicle" onOpen={(u, l) => setLightbox({ url: u, label: l })} />
                              <ImageThumb url={buildAssetUrl(row.ContainerImagePath)} label="Container" onOpen={(u, l) => setLightbox({ url: u, label: l })} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!isFetching && totalPages > 0 && (
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Showing{' '}
                  <strong className="text-[#0e4a78]">{filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}</strong>–<strong className="text-[#0e4a78]">{Math.min(page * PAGE_SIZE, filtered.length)}</strong>
                  {' '}of{' '}
                  <strong className="text-[#0e4a78]">{filtered.length.toLocaleString()}</strong> records
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${page === 1 ? 'text-slate-400 cursor-not-allowed bg-slate-100' : 'text-[#0e4a78] hover:bg-blue-50'}`}
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">Page</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value)}
                      onBlur={() => {
                        const pg = Math.max(1, Math.min(totalPages, Number(pageInput) || 1))
                        setPage(pg)
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return
                        const pg = Math.max(1, Math.min(totalPages, Number(pageInput) || 1))
                        setPage(pg)
                        e.currentTarget.blur()
                      }}
                      className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#0e4a78]"
                    />
                    <span className="text-slate-600">of {totalPages}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${page === totalPages ? 'text-slate-400 cursor-not-allowed bg-slate-100' : 'text-[#0e4a78] hover:bg-blue-50'}`}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>

        </main>
        <Footer />
      </div>

      {detailIdx != null && (
        <DetailModal
          row={filtered[detailIdx]}
          index={detailIdx}
          total={filtered.length}
          onClose={() => setDetailIdx(null)}
          onPrev={() => setDetailIdx(i => Math.max(0, i - 1))}
          onNext={() => setDetailIdx(i => Math.min(filtered.length - 1, i + 1))}
          onZoom={(u, l) => setLightbox({ url: u, label: l })}
        />
      )}

      {/* Rendered after DetailModal so it stacks visually on top when
          opened from inside it (both are fixed inset-0 overlays with the
          same z-50 — later in the DOM wins) instead of being hidden behind
          the modal's own backdrop. */}
      {lightbox && (
        <ImageLightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}

export default MainGate
