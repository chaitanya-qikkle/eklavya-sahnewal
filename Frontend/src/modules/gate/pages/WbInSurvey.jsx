import React, { useState, useEffect } from 'react'
import {
  FiSearch, FiChevronUp, FiChevronDown,
  FiImage, FiX, FiCalendar, FiPackage,
  FiHash, FiClock, FiZoomIn, FiDownload as FiDownloadIcon,
  FiChevronLeft, FiChevronRight, FiMapPin, FiTruck as FiTruckIcon,
  FiCheckCircle, FiAlertCircle,
} from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { writeXlsx } from '../../../utils/excelDates'
import { FaTrain } from 'react-icons/fa'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { useLazyGetWbinSurveyQuery } from '../../../store/api/ymsApi'
import { buildAssetUrl } from '../../../config/api'
import { StatGrid, FilterCard } from '../../../components/ui/StatCard'
import { FilterBar, FilterField, FilterSearchBtn, FilterClearBtn, FilterExportBtn } from '../../../components/ui/FilterBar'

function getWbinImageUrl(rawPath) {
  if (!rawPath) return null
  const rel = String(rawPath).replace(/^\/?stitching_outputs\//, '')
  return rel ? buildAssetUrl(`/v1/container/img?p=${rel}`) : null
}

const IMAGE_SIDES = [
  { key: 'Left1',  label: 'L',  side: 'left',         damage: false },
  { key: 'Right1', label: 'R',  side: 'right',        damage: false },
  { key: 'Top1',   label: 'T',  side: 'top',          damage: false },
  { key: 'Left2',  label: 'LD', side: 'left damage',  damage: true  },
  { key: 'Right2', label: 'RD', side: 'right damage', damage: true  },
  { key: 'Top2',   label: 'TD', side: 'top damage',   damage: true  },
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

const isSurveyed = (r) => r.IsSuveryCompleted === true || r.IsSuveryCompleted === 1

// '20' / '40' / '' — "20GP", "40HQ" jaise sizes bhi 20 / 40 maane jaate hain
const sizeOf = (r) => {
  const s = String(r.ContainerSize || '').trim()
  return s.startsWith('20') ? '20' : s.startsWith('40') ? '40' : ''
}

// Count + 20ft + 40ft + TEU (20ft = 1 TEU, 40ft = 2 TEU) for a list of rows
const breakdown = (list) => {
  const c20 = list.filter(r => sizeOf(r) === '20').length
  const c40 = list.filter(r => sizeOf(r) === '40').length
  return { count: list.length, c20, c40, teu: c20 + c40 * 2 }
}

// ── Image probe cache ─────────────────────────────────────────────────────────
const imgProbeCache = new Map()
function useImageStatus(url) {
  const [status, setStatus] = useState(() => (!url ? 'missing' : imgProbeCache.get(url) || 'loading'))
  useEffect(() => {
    if (!url) { setStatus('missing'); return }
    const cached = imgProbeCache.get(url)
    if (cached) { setStatus(cached); return }
    setStatus('loading')
    let cancelled = false
    const img = new Image()
    img.onload  = () => { imgProbeCache.set(url, 'ok');      if (!cancelled) setStatus('ok') }
    img.onerror = () => { imgProbeCache.set(url, 'missing'); if (!cancelled) setStatus('missing') }
    img.src = url
    return () => { cancelled = true }
  }, [url])
  return status
}

// ── SafeImg ───────────────────────────────────────────────────────────────────
function SafeImg({ url, alt, className, style, fallback }) {
  const [err, setErr] = useState(false)
  useEffect(() => { setErr(false) }, [url])
  if (err) return fallback
  return <img src={url} alt={alt} className={className} style={style} onError={() => setErr(true)} />
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function ImageLightbox({ url, label, onClose }) {
  if (!url) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative max-w-5xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-5 py-3">
          <span className="font-semibold capitalize text-base flex items-center gap-2"><FiImage /> {label} Image</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"><FiX className="text-lg" /></button>
        </div>
        <div className="flex items-center justify-center bg-slate-50 p-4 overflow-auto" style={{ maxHeight: '85vh' }}>
          <SafeImg url={url} alt={label} className="max-w-full object-contain rounded-lg" style={{ maxHeight: '80vh' }}
            fallback={<div className="py-16 flex flex-col items-center gap-2 text-slate-400"><FiImage size={40} /><span className="text-sm font-semibold">Image not found on server</span></div>}
          />
        </div>
      </div>
    </div>
  )
}

// ── Sort icon ─────────────────────────────────────────────────────────────────
function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span className="opacity-30 ml-1"><FiChevronUp size={10} /></span>
  return sortDir === 'asc'
    ? <FiChevronUp className="ml-1 text-blue-200" size={11} />
    : <FiChevronDown className="ml-1 text-blue-200" size={11} />
}

// ── Date cell ─────────────────────────────────────────────────────────────────
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

// ── Thumb button ──────────────────────────────────────────────────────────────
function ThumbBtn({ url, label, side, damage, onOpen }) {
  const status = useImageStatus(url)
  if (status !== 'ok') {
    return (
      <button
        type="button"
        disabled
        title={status === 'loading' ? `Checking ${side}…` : `No ${side} image`}
        className={`w-7 h-7 rounded-lg border border-slate-200 bg-slate-100 text-slate-300 opacity-50 cursor-not-allowed flex items-center justify-center text-[9px] font-bold ${status === 'loading' ? 'animate-pulse' : ''}`}
      >
        {label}
      </button>
    )
  }
  const cls = damage
    ? 'border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-600 hover:text-white'
    : 'border-[#0e4a78]/30 bg-[#0e4a78]/10 text-[#0e4a78] hover:bg-[#0e4a78] hover:text-white'
  return (
    <button
      type="button"
      onClick={() => onOpen(url, side)}
      title={`View ${side}`}
      className={`w-7 h-7 rounded-lg border flex items-center justify-center text-[9px] font-bold transition-all ${cls}`}
    >
      {label}
    </button>
  )
}

function ImagesCell({ row, onOpen }) {
  return (
    <div className="flex items-center gap-1 justify-center">
      {IMAGE_SIDES.map(({ key, label, side, damage }) => (
        <ThumbBtn key={key} url={getWbinImageUrl(row[key])} label={label} side={side} damage={damage} onOpen={onOpen} />
      ))}
    </div>
  )
}

// ── Image slot (detail modal) ─────────────────────────────────────────────────
function ImageSlot({ url, label, accent, onZoom }) {
  const status = useImageStatus(url)
  const ok = status === 'ok'
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden flex flex-col min-h-0">
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <span className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${accent}12`, color: accent }}><FiImage size={12} /></span>
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">{label}</span>
        </span>
        {ok && (
          <a href={url} download onClick={e => e.stopPropagation()}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#0e4a78] hover:bg-[#0e4a78]/10 transition-colors" title="Download image">
            <FiDownloadIcon size={12} />
          </a>
        )}
      </div>
      {ok ? (
        <button onClick={() => onZoom(url, label)}
          className="group relative flex-1 min-h-0 flex items-center justify-center overflow-hidden w-full"
          style={{ background: "repeating-conic-gradient(#f8fafc 0% 25%, #f1f5f9 0% 50%) 50% / 24px 24px" }}>
          <img src={url} alt={label} className="max-w-full max-h-full object-contain p-2" />
          <span className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center">
            <span className="w-14 h-14 rounded-full bg-white/90 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all flex items-center justify-center shadow-xl">
              <FiZoomIn className="text-[#0e4a78]" size={24} />
            </span>
          </span>
        </button>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2.5 text-slate-300 bg-slate-50/50 w-full">
          <span className={`w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center ${status === 'loading' ? 'animate-pulse' : ''}`}><FiImage size={28} /></span>
          <span className="text-xs font-semibold text-slate-400">{status === 'loading' ? 'Checking…' : 'No image available'}</span>
        </div>
      )}
    </div>
  )
}

// ── Detail field ──────────────────────────────────────────────────────────────
function DetailField({ icon: Icon, label, children, accent = "#0e4a78" }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5 border-b border-slate-100 last:border-b-0">
      <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5" style={{ background: `${accent}12`, color: accent }}>
        {Icon && <Icon size={12} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400 leading-tight">{label}</p>
        <div className="text-[13px] font-semibold text-slate-800 break-words leading-tight">{children}</div>
      </div>
    </div>
  )
}

function DetailCard({ title, icon: Icon, accent, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${accent}12`, color: accent }}><Icon size={12} /></span>
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">{title}</span>
      </div>
      <div className="px-4 py-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 sm:gap-x-4">{children}</div>
    </div>
  )
}

// ── Detail modal ──────────────────────────────────────────────────────────────
function DetailModal({ row, index, total, onClose, onPrev, onNext, onZoom }) {
  if (!row) return null
  const surveyed = isSurveyed(row)
  const dash = <span className="text-slate-300 font-normal">—</span>
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6" onClick={onClose}>
      <div className="relative w-full max-w-[1600px] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col ring-1 ring-black/5" style={{ height: '95vh' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="relative flex items-center justify-between text-white px-7 py-5 shrink-0 overflow-hidden"
          style={{ background: "linear-gradient(120deg,#0e4a78 0%,#0b3e66 45%,#072c4a 100%)" }}>
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "18px 18px" }} />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shadow-inner"><FaTrain size={20} /></div>
            <div>
              <p className="font-black text-xl leading-tight tracking-tight">{row.ContNo || 'Record'}</p>
              <p className="text-xs text-white/60 font-medium mt-0.5">
                WB In Survey <span className="mx-1.5 opacity-40">·</span> {index + 1} of {total}
              </p>
            </div>
          </div>
          <div className="relative flex items-center gap-2">
            <button onClick={onPrev} disabled={index <= 0} title="Previous record"
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 disabled:opacity-25 disabled:cursor-not-allowed transition-all"><FiChevronLeft size={19} /></button>
            <button onClick={onNext} disabled={index >= total - 1} title="Next record"
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 disabled:opacity-25 disabled:cursor-not-allowed transition-all"><FiChevronRight size={19} /></button>
            <div className="w-px h-7 bg-white/20 mx-2" />
            <button onClick={onClose} title="Close"
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 hover:bg-red-500/80 transition-all"><FiX size={19} /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col bg-slate-100">
          <div className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
            <div className="px-6 py-4">
              <div className="mb-3 flex flex-wrap gap-2.5">
                {row.ContNo && (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-[#1364a4] to-[#0a3b61] text-white font-black font-mono text-base shadow-lg shadow-[#0e4a78]/25">
                    <FiPackage size={15} /> {row.ContNo}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border ${surveyed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {surveyed ? <FiCheckCircle size={13} /> : <FiAlertCircle size={13} />}
                  {surveyed ? 'Survey Done' : 'Survey Pending'}
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <DetailCard title="Container" icon={FiPackage} accent="#0e4a78">
                  <DetailField icon={FiPackage} label="Container No" accent="#0e4a78">{row.ContNo || dash}</DetailField>
                  <DetailField icon={FiHash} label="Size / Type" accent="#0e4a78">{`${row.ContainerSize || '—'} ${row.ContainerType || ''}`.trim() || '—'}</DetailField>
                  <DetailField icon={FiHash} label="Process" accent="#059669">{row.Process || dash}</DetailField>
                  <DetailField icon={FiHash} label="Shipping Line" accent="#7c3aed">{row.ShippingLine || dash}</DetailField>
                  <DetailField icon={FiHash} label="Booking No" accent="#64748b">{row.BookingNo || dash}</DetailField>
                  <DetailField icon={FiHash} label="Document No" accent="#64748b">{row.DocumentNo || dash}</DetailField>
                  <DetailField icon={FiHash} label="Status" accent="#d97706">{row.ContainerStatus || dash}</DetailField>
                  <DetailField icon={FiHash} label="Mode" accent="#0284c7">{row.Mode || dash}</DetailField>
                  <DetailField icon={FiMapPin} label="Location" accent="#d97706">{row.ContainerLocationName || dash}</DetailField>
                </DetailCard>
                <DetailCard title="Gate & Timing" icon={FiTruckIcon} accent="#0e4a78">
                  <DetailField icon={FiTruckIcon} label="Trailer No" accent="#0e4a78">{row.TrailerNo || dash}</DetailField>
                  <DetailField icon={FiHash} label="Gate Name" accent="#d97706">{row.GateName || dash}</DetailField>
                  <DetailField icon={FiClock} label="Survey Time" accent="#0284c7">{row.SurveyTime ? formatDate(row.SurveyTime) : dash}</DetailField>
                  <DetailField icon={FiClock} label="Detected Time" accent="#0284c7">{row.DetectedTime ? formatDate(row.DetectedTime) : dash}</DetailField>
                  <DetailField icon={FiClock} label="Gate In" accent="#059669">{row.GateInDate ? formatDate(row.GateInDate) : dash}</DetailField>
                  <DetailField icon={FiClock} label="Gate Out" accent="#d97706">{row.GateOutDate ? formatDate(row.GateOutDate) : dash}</DetailField>
                </DetailCard>
              </div>
            </div>
          </div>

          {/* Images — 6 slots */}
          <div className="flex-1 min-h-0">
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 h-full">
              {[
                { key: 'Left1',  label: 'Left',         accent: '#0e4a78' },
                { key: 'Right1', label: 'Right',        accent: '#0e4a78' },
                { key: 'Top1',   label: 'Top',          accent: '#0e4a78' },
                { key: 'Left2',  label: 'Left Damage',  accent: '#dc2626' },
                { key: 'Right2', label: 'Right Damage', accent: '#dc2626' },
                { key: 'Top2',   label: 'Top Damage',   accent: '#dc2626' },
              ].map(({ key, label, accent }) => (
                <ImageSlot key={key} url={getWbinImageUrl(row[key])} label={label} accent={accent} onZoom={onZoom} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Stat card with 20 ft / 40 ft / TEU breakdown ───────────────────────── */
const CARD_TONES = {
  emerald: { card: 'bg-emerald-100 border-emerald-300', iconBox: 'text-emerald-600', bar: 'bg-emerald-500', ring: 'ring-emerald-600', pct: 'text-emerald-700' },
  amber:   { card: 'bg-amber-100 border-amber-300',     iconBox: 'text-amber-600',   bar: 'bg-amber-500',   ring: 'ring-amber-600',   pct: 'text-amber-700' },
  violet:  { card: 'bg-violet-100 border-violet-300',   iconBox: 'text-violet-600',  bar: 'bg-violet-500',  ring: 'ring-violet-600',  pct: 'text-violet-700' },
  rose:    { card: 'bg-rose-100 border-rose-300',       iconBox: 'text-rose-600',    bar: 'bg-rose-500',    ring: 'ring-rose-600',    pct: 'text-rose-700' },
  // Total card ke liye alag colour (blue) — text poora black
  sky:     { card: 'bg-sky-100 border-sky-300',         iconBox: 'text-sky-700',     bar: 'bg-sky-600',     ring: 'ring-sky-700',     pct: 'text-sky-800',
             label: 'text-black', value: 'text-black', subLabel: 'text-black', subValue: 'text-black', teu: 'text-black' },
}

function SizeStatCard({ label, icon: Icon, tone = 'emerald', stat, total, isActive, onClick }) {
  const t = CARD_TONES[tone] || CARD_TONES.emerald
  const pct = total ? Math.round((stat.count / total) * 100) : null
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative text-left rounded-xl border px-3 pt-3 pb-3 overflow-hidden transition-all hover:shadow-md ${t.card} ${isActive ? `ring-2 ${t.ring} shadow-md` : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0 ${t.iconBox}`}>
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-bold uppercase tracking-[0.12em] leading-tight truncate ${t.label || 'text-slate-500'}`}>{label}</p>
          <p className={`text-2xl font-black leading-tight ${t.value || 'text-slate-800'}`}>{stat.count.toLocaleString()}</p>
        </div>
        {pct !== null && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white ${t.pct}`}>{pct}%</span>
        )}
      </div>

      {/* 20 ft / 40 ft / TEU */}
      <div className="mt-2.5 grid grid-cols-3">
        <div className="px-1.5 text-center">
          <p className={`text-[9px] font-bold uppercase tracking-wider leading-tight ${t.subLabel || 'text-slate-500'}`}>20 ft</p>
          <p className={`text-sm font-black leading-tight ${t.subValue || 'text-slate-700'}`}>{stat.c20.toLocaleString()}</p>
        </div>
        <div className="px-1.5 text-center border-l border-slate-400/40">
          <p className={`text-[9px] font-bold uppercase tracking-wider leading-tight ${t.subLabel || 'text-slate-500'}`}>40 ft</p>
          <p className={`text-sm font-black leading-tight ${t.subValue || 'text-slate-700'}`}>{stat.c40.toLocaleString()}</p>
        </div>
        <div className="px-1.5 text-center border-l border-slate-400/40">
          <p className={`text-[9px] font-bold uppercase tracking-wider leading-tight ${t.subLabel || 'text-slate-500'}`}>TEU</p>
          <p className={`text-sm font-black leading-tight ${t.teu || 'text-[#0e4a78]'}`}>{stat.teu.toLocaleString()}</p>
        </div>
      </div>

      <span className={`absolute left-0 bottom-0 h-[3px] ${t.bar}`} style={{ width: `${pct ?? 100}%` }} />
    </button>
  )
}

// ── Today helper ──────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WbInSurvey() {
  const today = todayStr()
  const [fromDate,    setFromDate]    = useState(today)
  const [toDate,      setToDate]      = useState(today)
  const [containerNo, setContainerNo] = useState('')
  const [sortCol,     setSortCol]     = useState('SurveyTime')
  const [sortDir,     setSortDir]     = useState('desc')
  const [lightbox,    setLightbox]    = useState(null)   // { url, label }
  const [detailIdx,   setDetailIdx]   = useState(null)   // index into `rows`
  const [processFilter, setProcessFilter] = useState('all') // 'all' | 'EXPORT' | 'IMPORT' — client-side
  const [surveyFilter, setSurveyFilter] = useState('all') // 'all' | 'done' | 'pending' — client-side

  const [fetchWbin, { data, isFetching, isError }] = useLazyGetWbinSurveyQuery()

  // Load today on mount
  useEffect(() => {
    fetchWbin({ from_date: today, to_date: today })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = () => {
    setProcessFilter('all'); setSurveyFilter('all')
    fetchWbin({
      ...(fromDate           ? { from_date:    fromDate }           : {}),
      ...(toDate             ? { to_date:      toDate }             : {}),
      ...(containerNo.trim() ? { container_no: containerNo.trim() } : {}),
    })
  }

  const handleClear = () => {
    setFromDate(today); setToDate(today); setContainerNo('')
    setProcessFilter('all'); setSurveyFilter('all')
    fetchWbin({ from_date: today, to_date: today })
  }

  const toggleSort = (col) => {
    setSortCol(col)
    setSortDir(prev => (sortCol === col && prev === 'desc') ? 'asc' : 'desc')
  }

  const allRowsSorted = (() => {
    const raw = Array.isArray(data?.data) ? [...data.data] : []
    return raw.sort((a, b) => {
      const av = String(a[sortCol] ?? ''), bv = String(b[sortCol] ?? '')
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  })()

  const processOf = (r) => String(r.Process || '').toUpperCase()

  // Total / Export / Import — hamesha poore data ke (count + 20 ft + 40 ft + TEU)
  const totalStat  = breakdown(allRowsSorted)
  const exportStat = breakdown(allRowsSorted.filter(r => processOf(r) === 'EXPORT'))
  const importStat = breakdown(allRowsSorted.filter(r => processOf(r) === 'IMPORT'))

  const processRows = processFilter === 'all'
    ? allRowsSorted
    : allRowsSorted.filter(r => processOf(r) === processFilter)

  // Survey Done / Pending active Export/Import filter ko follow karte hain
  const doneStat    = breakdown(processRows.filter(isSurveyed))
  const pendingStat = breakdown(processRows.filter(r => !isSurveyed(r)))

  const rows = surveyFilter === 'all'
    ? processRows
    : surveyFilter === 'done'
      ? processRows.filter(isSurveyed)
      : processRows.filter(r => !isSurveyed(r))

  const total = allRowsSorted.length

  const handleExport = () => {
    if (!rows.length) return
    const sheetData = rows.map((r, i) => ({
      '#':              i + 1,
      'Container No':   r.ContNo            || '',
      'Size':           r.ContainerSize     || '',
      'Type':           r.ContainerType     || '',
      'Process':        r.Process           || '',
      'Shipping Line':  r.ShippingLine      || '',
      'Booking No':     r.BookingNo         || '',
      'Document No':    r.DocumentNo        || '',
      'Status':         r.ContainerStatus   || '',
      'Mode':           r.Mode              || '',
      'Location':       r.ContainerLocationName || '',
      'Trailer No':     r.TrailerNo         || '',
      'Gate Name':      r.GateName          || '',
      'Survey Time':    r.SurveyTime        ? formatDate(r.SurveyTime)    : '',
      'Detected Time':  r.DetectedTime      ? formatDate(r.DetectedTime)  : '',
      'Survey Date':    r.SurveyDate        || '',
      'Gate In':        r.GateInDate        ? formatDate(r.GateInDate)    : '',
      'Gate Out':       r.GateOutDate       ? formatDate(r.GateOutDate)   : '',
      'Survey Done':    isSurveyed(r) ? 'Yes' : 'No',
    }))
    const ws = XLSX.utils.json_to_sheet(sheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'WB In Survey')
    writeXlsx(wb, `WbInSurvey_${fromDate || 'today'}_${toDate || 'today'}.xlsx`)
  }

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

  const colCount = 9

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
          <header className="pt-6 pb-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Gate Management</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0e4a78] flex items-center gap-2 mt-0.5">
              <FaTrain /> WB In Survey
            </h1>
            <p className="text-slate-500 mt-0.5 text-sm">
              {total.toLocaleString()} total records
            </p>
          </header>

          {/* ── Stats + Filter — merged into one card ── */}
          <FilterCard>
          <StatGrid cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" bare>
            <SizeStatCard
              label="Total"
              icon={FiPackage}
              tone="sky"
              stat={totalStat}
              isActive={processFilter === 'all' && surveyFilter === 'all'}
              onClick={() => { setProcessFilter('all'); setSurveyFilter('all') }}
            />
            <SizeStatCard
              label="Export"
              icon={FiDownloadIcon}
              tone="amber"
              stat={exportStat}
              total={totalStat.count}
              isActive={processFilter === 'EXPORT'}
              onClick={() => setProcessFilter(processFilter === 'EXPORT' ? 'all' : 'EXPORT')}
            />
            <SizeStatCard
              label="Import"
              icon={FiTruckIcon}
              tone="violet"
              stat={importStat}
              total={totalStat.count}
              isActive={processFilter === 'IMPORT'}
              onClick={() => setProcessFilter(processFilter === 'IMPORT' ? 'all' : 'IMPORT')}
            />
            <SizeStatCard
              label="Survey Done"
              icon={FiCheckCircle}
              tone="emerald"
              stat={doneStat}
              total={processRows.length}
              isActive={surveyFilter === 'done'}
              onClick={() => setSurveyFilter(surveyFilter === 'done' ? 'all' : 'done')}
            />
            <SizeStatCard
              label="Pending"
              icon={FiAlertCircle}
              tone="rose"
              stat={pendingStat}
              total={processRows.length}
              isActive={surveyFilter === 'pending'}
              onClick={() => setSurveyFilter(surveyFilter === 'pending' ? 'all' : 'pending')}
            />
          </StatGrid>

          {/* ── Filter Bar — plain white toolbar, same as Pre Gate report ── */}
          <FilterBar bare>
            <FilterField label="From Date" icon={FiCalendar}>
              <input
                type="date" value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all"
              />
            </FilterField>

            <FilterField label="To Date" icon={FiCalendar}>
              <input
                type="date" value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all"
              />
            </FilterField>

            <FilterField label="Container No" icon={FiSearch} className="flex-1 min-w-[180px]">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  value={containerNo}
                  onChange={e => setContainerNo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Search container…"
                  className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all"
                />
              </div>
            </FilterField>

            <div className="flex gap-2">
              <FilterClearBtn onClick={handleClear} />
              <FilterSearchBtn onClick={handleSearch} loading={isFetching} />
              <FilterExportBtn onClick={handleExport} disabled={!rows.length} loading={false} />
            </div>
          </FilterBar>
          </FilterCard>

          {/* ── Table ── */}
          <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">

            {/* Table header bar */}
            <div className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
                  <FaTrain />
                </div>
                <div>
                  <p className="font-semibold text-base">WB In Survey Report</p>
                  <p className="text-xs text-white/60">
                    {rows.length.toLocaleString()} shown · {total.toLocaleString()} total
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
                <span className="text-sm font-medium">Loading records…</span>
              </div>
            )}

            {/* Table body */}
            {!isFetching && !isError && (
              <div className="overflow-x-auto">
                <table className="text-sm border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
                  <thead>
                    <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white text-xs">
                      <th className="px-2 py-2 text-left font-semibold uppercase tracking-wider border-r border-white/10 w-8">#</th>
                      <TH col="ContNo">Container No</TH>
                      <TH col="ContainerSize">Size / Type</TH>
                      <TH col="Process">Process</TH>
                      <TH col="ShippingLine">Shipping Line</TH>
                      <TH col="SurveyTime">Survey Time</TH>
                      <TH col="ContainerStatus">Status</TH>
                      <TH col="IsSuveryCompleted">Surveyed</TH>
                      <th className="px-2 py-2 text-center font-semibold uppercase tracking-wider w-52">Images</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={colCount} className="py-16 text-center">
                          <FiSearch className="mx-auto text-4xl text-slate-300 mb-3" />
                          <p className="font-semibold text-slate-400 text-sm">No records found</p>
                          <p className="text-xs text-slate-300 mt-1">Adjust the date range and click Search</p>
                        </td>
                      </tr>
                    ) : rows.map((row, idx) => {
                      const surveyed = isSurveyed(row)
                      return (
                        <tr
                          key={row.ContMasterID ?? row.ContNo ?? idx}
                          onClick={() => setDetailIdx(idx)}
                          className={`border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors
                            ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                        >
                          <td className="px-2 py-2 text-[10px] text-slate-400 font-medium border-r border-slate-100 w-8">
                            {idx + 1}
                          </td>

                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 text-[#0e4a78] font-black font-mono text-xs">
                              {row.ContNo || '—'}
                            </span>
                            {row.DocumentNo && <div className="text-[10px] text-slate-400 mt-0.5 pl-1">{row.DocumentNo}</div>}
                          </td>

                          <td className="px-3 py-2 whitespace-nowrap">
                            {row.ContainerSize || row.ContainerType ? (
                              <>
                                <p className="text-xs font-bold text-slate-700">{row.ContainerSize || '—'}</p>
                                <p className="text-[10px] text-slate-400">{row.ContainerType || ''}</p>
                              </>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>

                          <td className="px-3 py-2 text-[11px] text-slate-600 font-medium whitespace-nowrap">
                            {row.Process || '—'}
                          </td>

                          <td className="px-3 py-2 text-[11px] text-slate-600 whitespace-nowrap">
                            {row.ShippingLine || '—'}
                          </td>

                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <FiClock className="text-sky-400 flex-shrink-0" size={11} />
                              <DateCell raw={row.SurveyTime} />
                            </div>
                          </td>

                          <td className="px-3 py-2 text-[11px] text-slate-600 whitespace-nowrap">
                            {row.ContainerStatus || '—'}
                          </td>

                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              surveyed ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                       : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {surveyed ? <FiCheckCircle size={9} /> : <FiAlertCircle size={9} />}
                              {surveyed ? 'Yes' : 'No'}
                            </span>
                          </td>

                          <td className="px-1.5 py-1.5 w-52" onClick={e => e.stopPropagation()}>
                            <ImagesCell row={row} onOpen={(url, label) => setLightbox({ url, label })} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer count */}
            {!isFetching && !isError && (
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200">
                <span className="text-xs text-slate-500">
                  Showing <strong className="text-[#0e4a78]">{rows.length.toLocaleString()}</strong> of{' '}
                  <strong className="text-[#0e4a78]">{total.toLocaleString()}</strong> records
                </span>
              </div>
            )}
          </section>

        </main>
        <Footer />
      </div>

      {detailIdx !== null && rows[detailIdx] && (
        <DetailModal
          row={rows[detailIdx]}
          index={detailIdx}
          total={rows.length}
          onClose={() => setDetailIdx(null)}
          onPrev={() => setDetailIdx(i => Math.max(0, i - 1))}
          onNext={() => setDetailIdx(i => Math.min(rows.length - 1, i + 1))}
          onZoom={(url, label) => setLightbox({ url, label })}
        />
      )}

      {/* Rendered after DetailModal so it stacks on top when opened from inside it. */}
      {lightbox && <ImageLightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />}
    </div>
  )
}