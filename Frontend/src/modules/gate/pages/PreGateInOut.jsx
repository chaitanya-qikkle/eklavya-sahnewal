import React, { useState, useCallback, useEffect } from 'react'
import {
  FiSearch, FiRefreshCw, FiChevronUp, FiChevronDown,
  FiImage, FiX, FiCalendar, FiLogIn, FiLogOut, FiFilter,
  FiDownload, FiMapPin, FiTruck as FiTruckIcon, FiPackage, FiBox,
  FiHash, FiClock, FiZoomIn, FiDownload as FiDownloadIcon,
  FiChevronLeft, FiChevronRight, FiHome,
} from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { writeXlsx } from '../../../utils/excelDates'
import { FaTruck } from 'react-icons/fa'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { useLazyGetPreGateSurveyQuery, useGetGateNamesQuery } from '../../../store/api/ymsApi'
import { buildAssetUrl } from '../../../config/api'
import { StatGrid, FilterCard } from '../../../components/ui/StatCard'
import { FilterBar, FilterField, FilterSelect, FilterSearchBtn, FilterClearBtn, FilterExportBtn } from '../../../components/ui/FilterBar'

function prettyGateName(name) {
  return String(name || '')
    .split('_')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

// Pagination removed — ek hi request me saare records fetch hote hain.
// Agar backend ka max page_size limit hai to is value ko uske hisaab se adjust karein.
const ALL_PAGE_SIZE = 100000

// "Complex Gate In / Out" column is field se date uthata hai.
// Agar Detected time chahiye to 'ComplexGateDetectedTime' kar do.
const COMPLEX_DATE_KEY = 'ComplexGateSurveyTime'

// Dropdown me sirf yehi 2 gate dikhenge (lowercase pretty name se match hota hai)
const ALLOWED_GATES = ['maingate in', 'maingate out']

const IMAGE_SIDES = [
  { key: 'IMG_LEFT',  label: 'L',  side: 'left'  },
  { key: 'IMG_RIGHT', label: 'R',  side: 'right' },
  { key: 'IMG_TOP',   label: 'T',  side: 'top'   },
  { key: 'Left2',     label: 'LD', side: 'left damage',  damage: true },
  { key: 'Right2',    label: 'RD', side: 'right damage', damage: true },
  { key: 'Top2',      label: 'TD', side: 'top damage',   damage: true },
]

// Left2 / Right2 / Top2 come as "stitching_outputs/MAINGATE_IN/.../damage_xxx.jpg"
// → convert to the same "/v1/container/img?p=..." format the other images use
const DAMAGE_KEYS = ['Left2', 'Right2', 'Top2']

function getImageUrl(row, key) {
  const raw = row?.[key]
  if (!raw) return null
  if (DAMAGE_KEYS.includes(key)) {
    const rel = String(raw).replace(/^\/?stitching_outputs\//, '')
    return buildAssetUrl(`/v1/container/img?p=${rel}`)
  }
  return buildAssetUrl(raw)
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

/* ─── <img> that swaps to a fallback when the file fails to load ─────────── */
function SafeImg({ url, alt, className, style, fallback }) {
  const [err, setErr] = useState(false)
  useEffect(() => { setErr(false) }, [url])
  if (err) return fallback
  return <img src={url} alt={alt} className={className} style={style} onError={() => setErr(true)} />
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
          <SafeImg
            url={url}
            alt={label}
            className="max-w-full object-contain rounded-lg"
            style={{ maxHeight: '80vh' }}
            fallback={
              <div className="py-16 flex flex-col items-center gap-2 text-slate-400">
                <FiImage size={40} />
                <span className="text-sm font-semibold">Image not found on server</span>
              </div>
            }
          />
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

/* ─── Image Cell (L / R / T + LD / RD / LT damage buttons) ────────────── */
// The DB can hold a path for a file that is not actually on the server
// (backend then answers {"success":false,"message":"Image not found"}).
// So "has a path" is not enough — probe the URL once with an <Image> and
// only enable the button when it really loads. Results are cached.
const imgProbeCache = new Map() // url -> 'ok' | 'missing'

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

  const activeCls = damage
    ? 'border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-600 hover:text-white'
    : 'border-[#0e4a78]/30 bg-[#0e4a78]/10 text-[#0e4a78] hover:bg-[#0e4a78] hover:text-white'
  return (
    <button
      type="button"
      onClick={() => onOpen(url, side)}
      title={`View ${side}`}
      className={`w-7 h-7 rounded-lg border flex items-center justify-center text-[9px] font-bold transition-all ${activeCls}`}
    >
      {label}
    </button>
  )
}

function ImagesCell({ row, onOpen }) {
  return (
    <div className="flex items-center gap-1 justify-center">
      {IMAGE_SIDES.map(({ key, label, side, damage }) => (
        <ThumbBtn key={key} url={getImageUrl(row, key)} label={label} side={side} damage={damage} onOpen={onOpen} />
      ))}
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
      <div className="px-4 py-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 sm:gap-x-4">{children}</div>
    </div>
  )
}

/* ─── One image card inside the detail modal (probes the file first) ───── */
function ImageSlot({ url, label, accent, onZoom }) {
  const status = useImageStatus(url)
  const ok = status === 'ok'
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden flex flex-col min-h-0">
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <span className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${accent}12`, color: accent }}>
            <FiImage size={12} />
          </span>
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">{label}</span>
        </span>
        {ok && (
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
      {ok ? (
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
          <span className={`w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center ${status === 'loading' ? 'animate-pulse' : ''}`}>
            <FiImage size={28} />
          </span>
          <span className="text-xs font-semibold text-slate-400">
            {status === 'loading' ? 'Checking…' : 'No image available'}
          </span>
        </div>
      )}
    </div>
  )
}

/* ─── Detail Modal — details on top (container | gate/vehicle), 6 images below ── */
function DetailModal({ row, index, total, onClose, onPrev, onNext, onZoom, isMainGateOut = false, mainDateLabel = 'Main Gate In Date' }) {
  if (!row) return null
  const isIn = row.GateType === 'GATE_IN'
  const dash = <span className="text-slate-300 font-normal">—</span>

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
              <FaTruck size={20} />
            </div>
            <div>
              <p className="font-black text-xl leading-tight tracking-tight">{row.ContainerNo || 'Record'}</p>
              <p className="text-xs text-white/60 font-medium mt-0.5">
                Pre Gate Survey <span className="mx-1.5 opacity-40">·</span> {index + 1} of {total}
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

        {/* Body */}
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
                <span className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border ${
                  isIn ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                       : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {isIn ? <FiLogIn size={13} /> : <FiLogOut size={13} />}
                  {isIn ? 'GATE IN' : 'GATE OUT'}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Left — Container details */}
                <DetailCard title="Container" icon={FiPackage} accent="#0e4a78">
                  <DetailField icon={FiPackage} label="Container No" accent="#0e4a78">
                    {row.ContainerNo || <span className="text-slate-300 font-normal">Not captured</span>}
                  </DetailField>
                  <DetailField icon={FiHash} label="Size / Type" accent="#0e4a78">
                    {(row.ContSize || row.ContType)
                      ? `${row.ContSize || '—'} ${row.ContType || ''}`.trim()
                      : dash}
                  </DetailField>
                  <DetailField icon={FiClock} label="Process" accent="#059669">
                    {row.Process || dash}
                  </DetailField>
                  <DetailField icon={FiHash} label="Document No" accent="#64748b">
                    {row.DocumentNo || dash}
                  </DetailField>
                  <DetailField icon={FiHash} label="Status" accent="#7c3aed">
                    {row.Status || dash}
                  </DetailField>
                  <DetailField icon={FiMapPin} label="Location" accent="#d97706">
                    {row.Location || dash}
                  </DetailField>
                </DetailCard>

                {/* Right — Gate / vehicle / timing details */}
                <DetailCard title="Gate & Vehicle" icon={FiTruckIcon} accent="#0e4a78">
                  <DetailField icon={FiTruckIcon} label="Vehicle No" accent="#0e4a78">
                    {row.VehicleNo || <span className="text-slate-300 font-normal">Not captured</span>}
                  </DetailField>
                  <DetailField icon={FiHome} label="Gate" accent="#d97706">
                    {row.GateName || dash}
                  </DetailField>

                  {isMainGateOut ? (
                    <>
                      <DetailField icon={FiLogOut} label="Gate Out" accent="#d97706">
                        {row.GateOutDate ? formatDate(row.GateOutDate) : dash}
                      </DetailField>
                      <DetailField icon={FiLogOut} label="Complex Gate Out" accent="#0284c7">
                        {row[COMPLEX_DATE_KEY] ? formatDate(row[COMPLEX_DATE_KEY]) : dash}
                      </DetailField>
                      <DetailField icon={FiClock} label={mainDateLabel} accent="#0284c7">
                        {row.SurveyTime ? formatDate(row.SurveyTime) : dash}
                      </DetailField>
                    </>
                  ) : (
                    <>
                      <DetailField icon={FiClock} label={mainDateLabel} accent="#0284c7">
                        {row.SurveyTime ? formatDate(row.SurveyTime) : dash}
                      </DetailField>
                      <DetailField icon={FiLogIn} label="Complex Gate In" accent="#0284c7">
                        {row[COMPLEX_DATE_KEY] ? formatDate(row[COMPLEX_DATE_KEY]) : dash}
                      </DetailField>
                      <DetailField icon={FiLogIn} label="Navis Gate In" accent="#059669">
                        {row.GateInDate ? formatDate(row.GateInDate) : dash}
                      </DetailField>
                    </>
                  )}
                </DetailCard>
              </div>
            </div>
          </div>

          {/* Bottom — 6 images */}
          <div className="flex-1 min-h-0">
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 h-full">
              {[
                { url: getImageUrl(row, 'IMG_LEFT'),  label: 'Left',         accent: '#0e4a78' },
                { url: getImageUrl(row, 'IMG_RIGHT'), label: 'Right',        accent: '#0e4a78' },
                { url: getImageUrl(row, 'IMG_TOP'),   label: 'Top',          accent: '#0e4a78' },
                { url: getImageUrl(row, 'Left2'),     label: 'Left Damage',  accent: '#dc2626' },
                { url: getImageUrl(row, 'Right2'),    label: 'Right Damage', accent: '#dc2626' },
                { url: getImageUrl(row, 'Top2'),      label: 'Top Damage (LT)', accent: '#dc2626' },
              ].map(({ url, label, accent }) => (
                <ImageSlot key={label} url={url} label={label} accent={accent} onZoom={onZoom} />
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

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function PreGateInOut() {
  const [fromDate,    setFromDate]    = useState('')
  const [toDate,      setToDate]      = useState('')
  const [containerNo, setContainerNo] = useState('')
  const [gateFilter,  setGateFilter]  = useState('ALL')
  const [gateName,    setGateName]    = useState('')   // dropdown me jo select hai
  const [appliedGate, setAppliedGate] = useState('')   // jis gate ke liye Search/fetch hua — table layout isse chalta hai
  const [sortCol,     setSortCol]     = useState('SurveyTime')
  const [sortDir,     setSortDir]     = useState('desc')
  const [lightbox,    setLightbox]    = useState(null)
  const [detailIdx,   setDetailIdx]   = useState(null) // index into `rows`
  const [processFilter, setProcessFilter] = useState('all') // client-side filter

  const [fetchSurvey, { data, isFetching, isError }] = useLazyGetPreGateSurveyQuery()
  const { data: gateNamesData, isSuccess: gateNamesLoaded, isError: gateNamesFailed } = useGetGateNamesQuery()
  const allGateOptions = Array.isArray(gateNamesData?.data) ? gateNamesData.data : []

  // Dropdown me sirf Maingate In / Maingate Out (In pehle)
  const gateOptions = allGateOptions
    .filter(g => ALLOWED_GATES.includes(prettyGateName(g).toLowerCase()))
    .sort((a, b) =>
      ALLOWED_GATES.indexOf(prettyGateName(a).toLowerCase()) -
      ALLOWED_GATES.indexOf(prettyGateName(b).toLowerCase())
    )
  const defaultGate = gateOptions.find(g => prettyGateName(g).toLowerCase() === 'maingate in') || ''

  // ── Column layout — Search ke baad jo gate applied hua uske hisaab se ───
  //  Maingate In  : Main Gate In Date → Complex Gate In → Navis Gate In
  //  Maingate Out : Gate Out → Complex Gate Out → Main Gate Out Date   (Navis Gate In nahi)
  //  Fallback     : Maingate In wala layout
  const gateKey        = prettyGateName(appliedGate).toLowerCase()
  const isMainGateOut  = gateKey === 'maingate out'
  const mainDateLabel  = isMainGateOut ? 'Main Gate Out Date' : 'Main Gate In Date'
  // Pehle card ka label — Maingate In pe "Total Gate In", Maingate Out pe "Total Gate Out"
  const totalCardLabel = isMainGateOut ? 'Total Gate Out' : 'Total Gate In'
  // #, Container, Size, Process, Gate, 3 date columns, Vehicle, Images
  const colCount       = 10

  // No pagination — always request everything in a single call.
  const buildArgs = useCallback((gateNameOverride, gateFilterOverride) => {
    const args = { page: 1, page_size: ALL_PAGE_SIZE }
    if (fromDate)               args.from_date    = fromDate
    if (toDate)                 args.to_date      = toDate
    if (containerNo.trim())     args.container_no = containerNo.trim()
    const gf = gateFilterOverride !== undefined ? gateFilterOverride : gateFilter
    if (gf !== 'ALL')           args.gate_type    = gf
    const gn = gateNameOverride !== undefined ? gateNameOverride : gateName
    if (gn)                     args.gate_name    = gn
    return args
  }, [fromDate, toDate, containerNo, gateFilter, gateName])

  // Fetch + applied gate set (layout isi se badalta hai)
  const runFetch = (gateNameOverride, gateFilterOverride) => {
    const gn = gateNameOverride !== undefined ? gateNameOverride : gateName
    setAppliedGate(gn)
    fetchSurvey(buildArgs(gn, gateFilterOverride))
  }

  // Default gate "Maingate In" jab gate names load ho jaye.
  // Agar gate-names call fail/empty ho to unfiltered fetch (report phir bhi load hoga).
  useEffect(() => {
    if (gateName || (!gateNamesLoaded && !gateNamesFailed)) return
    if (defaultGate) {
      setGateName(defaultGate)
      runFetch(defaultGate)
    } else {
      runFetch('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateNamesLoaded, gateNamesFailed])

  const handleSearch = () => {
    setGateFilter('ALL')
    setProcessFilter('all')
    runFetch(undefined, 'ALL')
  }

  const handleClear = () => {
    setFromDate(''); setToDate('')
    setContainerNo(''); setGateFilter('ALL')
    setProcessFilter('all')
    setGateName(defaultGate)
    setAppliedGate(defaultGate)
    const args = { page: 1, page_size: ALL_PAGE_SIZE }
    if (defaultGate) args.gate_name = defaultGate
    fetchSurvey(args)
  }

  const toggleSort = (col) => {
    setSortCol(col)
    setSortDir(prev => (sortCol === col && prev === 'desc') ? 'asc' : 'desc')
  }

  const allRowsSorted = (() => {
    // Kuch records me GateName khali aata hai aur GateType galat/missing hota hai.
    // Jo gate Search me applied hai (Maingate In / Out) wahi har row ka Gate aur IN/OUT maana jaata hai,
    // taaki table, modal, export aur upar ke card ki count hamesha match kare.
    const raw = Array.isArray(data?.data)
      ? data.data.map(r => appliedGate
          ? {
              ...r,
              GateName: prettyGateName(appliedGate),
              GateType: isMainGateOut ? 'GATE_OUT' : 'GATE_IN',
            }
          : r)
      : []
    return raw.sort((a, b) => {
      const av = String(a[sortCol] ?? ''), bv = String(b[sortCol] ?? '')
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  })()

  const sizeOf = (r) => {
    const s = String(r.ContSize || '').trim()
    return s.startsWith('20') ? '20' : s.startsWith('40') ? '40' : ''
  }

  // Count + 20ft + 40ft + TEU (20ft = 1 TEU, 40ft = 2 TEU) for a list of rows
  const breakdown = (list) => {
    const c20 = list.filter(r => sizeOf(r) === '20').length
    const c40 = list.filter(r => sizeOf(r) === '40').length
    return { count: list.length, c20, c40, teu: c20 + c40 * 2 }
  }
  const byProcess = (p) => allRowsSorted.filter(r => String(r.Process || '').toUpperCase() === p)

  const totalStat    = breakdown(allRowsSorted)
  const exportStat   = breakdown(byProcess('EXPORT'))
  const importStat   = breakdown(byProcess('IMPORT'))
  const emptyStat    = breakdown(byProcess('EMPTY'))
  const domesticStat = breakdown(byProcess('DOMESTIC'))

  const rows = processFilter === 'all'
    ? allRowsSorted
    : allRowsSorted.filter(r => String(r.Process || '').toUpperCase() === processFilter)

  // Export — saara data pehle se load hai, alag API call ki zaroorat nahi.
  // Column order table ke saath match karta hai.
  const handleExport = () => {
    if (!rows.length) return
    const sheetData = rows.map((row, i) => {
      const mainDate    = row.SurveyTime  ? formatDate(row.SurveyTime)  : ''
      const complexDate = row[COMPLEX_DATE_KEY] ? formatDate(row[COMPLEX_DATE_KEY]) : ''
      const naviIn      = row.GateInDate  ? formatDate(row.GateInDate)  : ''
      const gateOutDate = row.GateOutDate ? formatDate(row.GateOutDate) : ''

      const out = {
        '#':              i + 1,
        'Container No':   row.ContainerNo   || '',
        'Size':           row.ContSize      || '',
        'Type':           row.ContType      || '',
        'Process':        row.Process       || '',
        'Gate':           row.GateName      || '',
        'Direction':      row.GateType      || '',
      }
      if (isMainGateOut) {
        out['Gate Out']          = gateOutDate
        out['Complex Gate Out']  = complexDate
        out[mainDateLabel]       = mainDate
      } else {
        out[mainDateLabel]       = mainDate
        out['Complex Gate In']   = complexDate
        out['Navis Gate In']     = naviIn
      }
      out['Location']    = row.Location    || ''
      out['Vehicle No']  = row.VehicleNo   || ''
      out['Document No'] = row.DocumentNo  || ''
      out['Status']      = row.Status      || ''
      return out
    })
    const ws = XLSX.utils.json_to_sheet(sheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pre Gate Survey')
    writeXlsx(wb, `PreGateSurvey_${fromDate || 'today'}_${toDate || 'today'}.xlsx`)
  }

  const total = data?.total ?? allRowsSorted.length

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
          <header className="pt-6 pb-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Gate Management</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0e4a78] flex items-center gap-2 mt-0.5">
              <FaTruck /> {isMainGateOut ? 'Main Gate Out Report' : 'Main Gate In Report'}
            </h1>
            <p className="text-slate-500 mt-0.5 text-sm">
              {total.toLocaleString()} total records
            </p>
          </header>

          {/* ── Stats + Filter — merged into one card ── */}
          <FilterCard>
          <StatGrid cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" bare>
            {/* Total card — Maingate In pe "Total Gate In", Maingate Out pe "Total Gate Out" */}
            <SizeStatCard
              label={totalCardLabel}
              icon={isMainGateOut ? FiLogOut : FiLogIn}
              tone="sky"
              stat={totalStat}
              isActive={processFilter === 'all'}
              onClick={() => {
                setGateFilter('ALL'); setProcessFilter('all')
                runFetch(appliedGate, 'ALL')
              }}
            />
            <SizeStatCard
              label="Export"
              icon={FiDownloadIcon}
              tone="amber"
              stat={exportStat}
              total={totalStat.count}
              isActive={processFilter === 'EXPORT'}
              onClick={() => setProcessFilter('EXPORT')}
            />
            <SizeStatCard
              label="Import"
              icon={FiTruckIcon}
              tone="emerald"
              stat={importStat}
              total={totalStat.count}
              isActive={processFilter === 'IMPORT'}
              onClick={() => setProcessFilter('IMPORT')}
            />
            <SizeStatCard
              label="Empty"
              icon={FiBox}
              tone="violet"
              stat={emptyStat}
              total={totalStat.count}
              isActive={processFilter === 'EMPTY'}
              onClick={() => setProcessFilter('EMPTY')}
            />
            <SizeStatCard
              label="Domestic"
              icon={FiHome}
              tone="rose"
              stat={domesticStat}
              total={totalStat.count}
              isActive={processFilter === 'DOMESTIC'}
              onClick={() => setProcessFilter('DOMESTIC')}
            />
          </StatGrid>

          {/* ── Filter Bar ── */}
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

            {/* Gate — sirf Maingate In / Maingate Out */}
            <FilterSelect
              label="Gate"
              icon={FiFilter}
              value={gateName}
              onChange={e => setGateName(e.target.value)}
              className="min-w-[160px]"
            >
              {gateOptions.map(g => (
                <option key={g} value={g}>{prettyGateName(g)}</option>
              ))}
            </FilterSelect>

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
                  <FaTruck />
                </div>
                <div>
                  <p className="font-semibold text-base">Pre Gate In / Out Report</p>
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
                      <TH col="ContainerNo">Container No</TH>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Size / Type</th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Process</th>
                      <TH col="GateName">Gate</TH>

                      {/* Date columns — order depends on applied gate */}
                      {isMainGateOut ? (
                        <>
                          <TH col="GateOutDate">Gate Out</TH>
                          <TH col={COMPLEX_DATE_KEY}>Complex Gate Out</TH>
                          <TH col="SurveyTime">{mainDateLabel}</TH>
                        </>
                      ) : (
                        <>
                          <TH col="SurveyTime">{mainDateLabel}</TH>
                          <TH col={COMPLEX_DATE_KEY}>Complex Gate In</TH>
                          <TH col="GateInDate">Navis Gate In</TH>
                        </>
                      )}

                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Vehicle No</th>
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
                      const serial = idx + 1
                      const isIn = row.GateType === 'GATE_IN'

                      // Main Gate In / Out date (SurveyTime)
                      const mainDateCell = (
                        <td key="main" className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <FiClock className="text-sky-400 flex-shrink-0" size={11} />
                            <DateCell raw={row.SurveyTime} />
                          </div>
                        </td>
                      )

                      // Complex Gate In (In layout) / Complex Gate Out (Out layout) — ComplexGateSurveyTime
                      const complexCell = (
                        <td key="complex" className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {isMainGateOut
                              ? <FiLogOut className="text-sky-400 flex-shrink-0" size={11} />
                              : <FiLogIn  className="text-sky-400 flex-shrink-0" size={11} />}
                            <DateCell raw={row[COMPLEX_DATE_KEY]} />
                          </div>
                        </td>
                      )

                      // Navis Gate In — sirf Maingate In layout me
                      const naviInCell = (
                        <td key="navi" className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <FiLogIn className="text-emerald-400 flex-shrink-0" size={11} />
                            <DateCell raw={row.GateInDate} highlight={isIn} />
                          </div>
                        </td>
                      )

                      // Gate Out — sirf Maingate Out layout me (pehla date column)
                      const gateOutCell = (
                        <td key="out" className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <FiLogOut className="text-amber-400 flex-shrink-0" size={11} />
                            <DateCell raw={row.GateOutDate} />
                          </div>
                        </td>
                      )

                      return (
                        <tr
                          key={row.ContMasterID ?? row.ContainerNo ?? idx}
                          onClick={() => setDetailIdx(idx)}
                          className={`border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors
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

                          {/* Date columns — same order as the header */}
                          {isMainGateOut ? (
                            <>
                              {gateOutCell}
                              {complexCell}
                              {mainDateCell}
                            </>
                          ) : (
                            <>
                              {mainDateCell}
                              {complexCell}
                              {naviInCell}
                            </>
                          )}

                          <td className="px-3 py-2 text-[11px] text-slate-600 whitespace-nowrap">
                            {row.VehicleNo
                              ? <span className="inline-flex items-center gap-1"><FiTruckIcon size={10} className="text-slate-400" />{row.VehicleNo}</span>
                              : <span className="text-slate-300 text-xs">—</span>}
                          </td>

                          <td className="px-1.5 py-1.5 w-52" onClick={e => e.stopPropagation()}>
                            <ImagesCell row={row} onOpen={(u, l) => setLightbox({ url: u, label: l })} />
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

      {detailIdx != null && (
        <DetailModal
          row={rows[detailIdx]}
          index={detailIdx}
          total={rows.length}
          isMainGateOut={isMainGateOut}
          mainDateLabel={mainDateLabel}
          onClose={() => setDetailIdx(null)}
          onPrev={() => setDetailIdx(i => Math.max(0, i - 1))}
          onNext={() => setDetailIdx(i => Math.min(rows.length - 1, i + 1))}
          onZoom={(u, l) => setLightbox({ url: u, label: l })}
        />
      )}

      {/* Rendered after DetailModal so it stacks on top when opened from inside it. */}
      {lightbox && (
        <ImageLightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}