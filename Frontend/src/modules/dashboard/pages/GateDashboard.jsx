import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  FiSearch, FiRefreshCw, FiImage, FiZoomIn, FiZoomOut, FiMinimize, FiCalendar, FiCheck,
  FiFolder, FiClock, FiTruck, FiHash, FiAlertCircle, FiChevronLeft, FiChevronRight,
} from 'react-icons/fi'
import { FaDoorOpen, FaTrain } from 'react-icons/fa'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { notify } from '../../../utils/notify'
import { buildAssetUrl } from '../../../config/api'
import {
  useLazyGetPreGateSurveyQuery,
  useSaveGateDashboardMutation,
  useLazySearchGateDashboardContainersQuery,
  useLazyGetGateDashboardImagesQuery,
  useLazyGetRailInQuery,
} from '../../../store/api/ymsApi'

/* ─── Config ─────────────────────────────────────────────────────────────── */

const TABS = [
  { key: 'main', label: 'Main Gate In', icon: FaDoorOpen },
  { key: 'rail', label: 'Rail Gate In', icon: FaTrain },
]

// Image folders under the stitching root. A transaction's GateName is a device /
// gate code (e.g. COM-WB-BK-IN-110), not the folder, so each tab has one fixed folder.
const MAIN_GATE_FOLDER = 'MAINGATE_IN'
const RAIL_GATE_FOLDER = 'RAILGATE'

const SIDE_STYLE = {
  left:  'bg-blue-100 text-blue-700',
  right: 'bg-emerald-100 text-emerald-700',
  top:   'bg-amber-100 text-amber-700',
}

// File names look like "00000000000_left_00_51_09.jpg" → side + time of day.
const parseImageName = (file) => {
  const name = String(file || '').split(/[\\/]/).pop()
  // "…_left_00_51_09.jpg" (folder images) or a saved "left.jpg"
  const s = name.match(/(?:^|[_\-.])(left|right|top)(?:[_\-.]|$)/i)
  const m = name.match(/_(?:left|right|top)_(\d{2})[_\-:.](\d{2})[_\-:.](\d{2})/i)
  return {
    name,
    side: s ? s[1].toLowerCase() : null,
    time: m ? `${m[1]}:${m[2]}:${m[3]}` : '',
  }
}

// TODO(backend): the SP returns the folder of the "00000000" transaction (e.g.
// "D:\stitching\outputs\GATE_IN\20261101\0000000000") and the list of image
// files in it. Until it exists both are read from the row if the API ever sends
// them. These two functions are the ONLY place that decides folder / files.
const folderOf = (txn) => txn?.raw?.ImageFolderPath || txn?.raw?.FolderPath || null
const filesOf = (txn) => {
  const f = txn?.raw?.ImageFiles
  return Array.isArray(f) ? f : []
}

// One place that turns "<folder>/<file>" into a URL. Change here when the
// backend serves the files (same /v1/container/img?p= pattern as Pre Gate).
// Until the folder SP exists, the gallery falls back to the image(s) the row
// already carries (Main Gate: ContainerImagePath, Rail: Camera1/2ImagePath).
// These are ready-made API urls like "/v1/container/.../img?p=...".
const displayFilesOf = (txn) => {
  const real = filesOf(txn)
  if (real.length) return real
  const r = txn?.raw || {}
  return [r.ContainerImagePath, r.Camera1ImagePath, r.Camera2ImagePath].filter(Boolean)
}

const imageUrl = (folder, file) => {
  if (file && /^(https?:\/\/|\/v1\/)/i.test(file)) return /^\//.test(file) ? buildAssetUrl(file) : file
  if (!folder || !file) return null
  const base = String(folder).replace(/[\\/]+$/, '')
  const full = `${base}/${file}`
  if (/^https?:\/\//i.test(full)) return full
  return buildAssetUrl(`/v1/container/img?p=${full.replace(/^\/?stitching_outputs\//, '')}`)
}

// Folder next to the "0000…" one, named after the container number.
const siblingFolder = (folder, containerNo) => {
  if (!folder) return containerNo
  const base = String(folder).replace(/[\\/]+$/, '')
  const i = Math.max(base.lastIndexOf('/'), base.lastIndexOf('\\'))
  return `${i >= 0 ? base.slice(0, i + 1) : ''}${containerNo}`
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const p2 = (n) => String(n).padStart(2, '0')
const toLocalInputValue = (d) =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`
const todayStr = () => toLocalInputValue(new Date())
const yesterdayStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return toLocalInputValue(d) }

const formatDate = (raw) => {
  if (!raw) return '—'
  const d = new Date(String(raw).replace(' ', 'T'))
  if (isNaN(d.getTime())) return String(raw)
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

const timeOf = (raw) => {
  const t = new Date(String(raw || '').replace(' ', 'T')).getTime()
  return isNaN(t) ? 0 : t
}

// Same rule as Service Dashboard: empty / "-" / only zeros = container not read.
const isMissing = (containerNo) => {
  const clean = String(containerNo ?? '').trim().split(' ')[0]
  return clean === '' || clean === '-' || clean.replace(/0/g, '') === ''
}

const CONTAINER_RE = /^[A-Z]{4}\d{7}$/

// Both gates reduced to one shape so the list/panel don't care which tab.
// A transaction is "missing" when one or more of its container images did not
// come through. Rail: Camera1 (left) / Camera2 (right) absent. Main Gate: which
// of left / right / top exist is looked up on the server per container (see
// `sidesMap` in the page), so it starts empty here. The operator opens a missing
// one, finds the image in <stitching>/<gate>/<date>/00000000000 and saves it.
const ALL_SIDES = ['left', 'right', 'top']
const missingImages = (tab, r) => tab === 'main'
  ? [!r.IMG_LEFT && 'left', !r.IMG_RIGHT && 'right', !r.IMG_TOP && 'top'].filter(Boolean)
  : [!r.Camera1ImagePath && 'left', !r.Camera2ImagePath && 'right'].filter(Boolean)
const normalize = (tab, rows) =>
  normalizeRaw(tab, rows).map((t) => {
    const miss = missingImages(tab, t.raw)
    return { ...t, missing: miss.length > 0, missingSides: miss }
  })

const normalizeRaw = (tab, rows) =>
  rows.map((r, i) => tab === 'main'
    ? {
        key: `main-${r.ContMasterID ?? ''}-${r.ContainerNo ?? ''}-${r.SurveyTime ?? ''}-${i}`,
        containerNo: r.ContainerNo,
        refLabel: 'Vehicle', ref: r.VehicleNo,
        place: r.GateName,
        time: r.SurveyTime,
        size: r.ContSize, process: r.Process,
        raw: r,
      }
    : {
        key: `rail-${r.ContMasterID ?? r.DocumentNo ?? ''}-${r.ContainerNo ?? ''}-${i}`,
        containerNo: r.ContainerNo,
        refLabel: 'Wagon', ref: r.WagonNo,
        place: r.RakeNo ? `Rake ${r.RakeNo}` : 'Rail',
        time: r.RailInDateTime,
        size: r.ContainerSize, process: r.Process,
        raw: r,
      })

/* ─── Small UI pieces ────────────────────────────────────────────────────── */

// Text shown next to the image: the side when the name has one, otherwise whatever
// the file name carries (without container no., time and extension).
const labelOf = (name) => {
  const base = String(name || '').replace(/\.[a-z0-9]+$/i, '')
  const words = base.split(/[_\-\s]+/).filter((w) => w && !/^\d+$/.test(w) && !/^[A-Z]{4}\d{7}$/i.test(w))
  return words.join(' ') || base
}

// One image of the folder at a time, with an in-place zoom tool (no popup).
//   • swipe / ← → / arrow buttons: previous / next image (while not zoomed in)
//   • mouse wheel, + / − buttons, pinch: zoom   • drag: pan   • double-click: zoom in / out
//   • Fit = whole image, 1:1 = actual pixels
// The image on screen is the one that gets saved.
const MAX_ZOOM = 16
function ImageViewer({ files, index, urlFor, onGo }) {
  const file = files[index]
  const url = urlFor(file)
  const { side, time, name } = parseImageName(file)
  const [err, setErr] = useState(false)
  const [view, setView] = useState({ s: 1, x: 0, y: 0 })
  const box = React.useRef(null)
  const img = React.useRef(null)
  const pointers = React.useRef(new Map())
  const gesture = React.useRef(null)

  useEffect(() => { setErr(false); setView({ s: 1, x: 0, y: 0 }) }, [url])

  // Zoom by `factor` keeping the point (cx, cy) — relative to the box centre — fixed.
  const zoomAt = React.useCallback((factor, cx = 0, cy = 0) => {
    setView((v) => {
      const s = Math.min(MAX_ZOOM, Math.max(1, v.s * factor))
      if (s === 1) return { s: 1, x: 0, y: 0 }
      const k = s / v.s
      return { s, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }
    })
  }, [])
  const fit = () => setView({ s: 1, x: 0, y: 0 })
  const actualSize = () => {
    const el = img.current
    if (!el || !el.clientWidth) return
    setView({ s: Math.min(MAX_ZOOM, Math.max(1, el.naturalWidth / el.clientWidth)), x: 0, y: 0 })
  }
  const rel = (e) => {
    const r = box.current.getBoundingClientRect()
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 }
  }

  // Wheel zoom needs a non-passive listener so the page does not scroll.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) return
      if (e.key === 'ArrowLeft') onGo(-1)
      else if (e.key === 'ArrowRight') onGo(1)
      else if (e.key === '+' || e.key === '=') zoomAt(1.4)
      else if (e.key === '-') zoomAt(1 / 1.4)
      else if (e.key === '0') fit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onGo, zoomAt])

  const dist = () => {
    const [a, b] = [...pointers.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  const onPointerDown = (e) => {
    box.current.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) gesture.current = { type: 'pinch', d: dist() }
    else gesture.current = { type: 'one', sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false }
  }
  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return
    if (g.type === 'pinch' && pointers.current.size === 2) {
      const d = dist()
      const [a, b] = [...pointers.current.values()]
      const r = box.current.getBoundingClientRect()
      zoomAt(d / g.d, (a.x + b.x) / 2 - r.left - r.width / 2, (a.y + b.y) / 2 - r.top - r.height / 2)
      g.d = d
    } else if (g.type === 'one') {
      const dx = e.clientX - g.sx, dy = e.clientY - g.sy
      if (Math.abs(dx) + Math.abs(dy) > 4) g.moved = true
      if (view.s > 1) setView((v) => ({ ...v, x: g.ox + dx, y: g.oy + dy }))
    }
  }
  const onPointerUp = (e) => {
    const g = gesture.current
    pointers.current.delete(e.pointerId)
    if (g?.type === 'one' && view.s === 1) {
      const dx = e.clientX - g.sx
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - g.sy)) onGo(dx < 0 ? 1 : -1) // swipe
    }
    if (pointers.current.size === 0) gesture.current = null
    else if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()]
      gesture.current = { type: 'one', sx: p.x, sy: p.y, ox: view.x, oy: view.y, moved: true }
    }
  }
  const onDoubleClick = (e) => { view.s > 1 ? fit() : zoomAt(2.5, rel(e).x, rel(e).y) }

  const arrow = 'absolute top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-[#0e4a78] hover:bg-white hover:scale-105 transition-all'
  const tool = 'h-8 min-w-[2rem] px-2 rounded-lg flex items-center justify-center text-xs font-bold text-white hover:bg-white/20 transition-colors'
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50/70 border-b border-slate-100">
        <span className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full ${SIDE_STYLE[side] || 'bg-slate-100 text-slate-600'}`}>{side || labelOf(name)}</span>
        {time && <span className="text-xs font-mono text-slate-500 inline-flex items-center gap-1"><FiClock size={11} />{time}</span>}
        <span className="ml-auto text-xs font-bold text-slate-500">{index + 1} / {files.length}</span>
      </div>
      <div
        ref={box}
        className="relative h-[42vh] min-h-[240px] overflow-hidden select-none touch-none"
        style={{
          background: 'repeating-conic-gradient(#f8fafc 0% 25%, #f1f5f9 0% 50%) 50% / 24px 24px',
          cursor: view.s > 1 ? (gesture.current ? 'grabbing' : 'grab') : 'zoom-in',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, transformOrigin: 'center', transition: gesture.current ? 'none' : 'transform 120ms ease-out' }}
        >
          {url && !err ? (
            <img ref={img} src={url} alt={name} onError={() => setErr(true)} draggable={false}
              className="max-w-full max-h-full object-contain p-2 pointer-events-none" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-slate-300"><FiImage size={34} /><span className="text-xs font-semibold text-slate-400">Image could not be loaded</span></div>
          )}
        </div>

        {files.length > 1 && view.s === 1 && (
          <>
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => onGo(-1)} className={`${arrow} left-3`} title="Previous (←)"><FiChevronLeft size={22} /></button>
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => onGo(1)} className={`${arrow} right-3`} title="Next (→)"><FiChevronRight size={22} /></button>
          </>
        )}

        {/* Zoom tool */}
        {url && !err && (
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-1 rounded-xl bg-slate-900/80 backdrop-blur shadow-lg"
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <button type="button" className={tool} onClick={() => zoomAt(1 / 1.4)} disabled={view.s <= 1} title="Zoom out (−)"><FiZoomOut size={15} /></button>
            <span className="w-12 text-center text-[11px] font-mono font-bold text-white/90">{Math.round(view.s * 100)}%</span>
            <button type="button" className={tool} onClick={() => zoomAt(1.4)} disabled={view.s >= MAX_ZOOM} title="Zoom in (+)"><FiZoomIn size={15} /></button>
            <span className="w-px h-5 bg-white/20 mx-1" />
            <button type="button" className={tool} onClick={fit} title="Fit to window (0)"><FiMinimize size={14} /><span className="ml-1">Fit</span></button>
            <button type="button" className={tool} onClick={actualSize} title="Actual size">1:1</button>
          </div>
        )}
      </div>
      <div className="px-4 py-2 text-[11px] font-mono text-slate-400 truncate border-t border-slate-100" title={name}>{name}</div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function GateDashboard() {
  const [tab, setTab] = useState('main')
  // One date: it filters the transactions (whole day) and picks the <yyyymmdd> image folder.
  const [day, setDay] = useState(todayStr().slice(0, 10))
  const fromDate = `${day}T00:00`
  const toDate = `${day}T23:59`
  const [search, setSearch] = useState('')
  const [missingOnly, setMissingOnly] = useState(true) // default: only transactions with a missing left / right / top image
  const [gate, setGate] = useState('all') // Main Gate In only: one gate or 'all'
  const [selectedKey, setSelectedKey] = useState(null)
  const [containerInput, setContainerInput] = useState('')
  const [sideOverride, setSideOverride] = useState(null) // used only when the file name has no side
  const [saved, setSaved] = useState({}) // txn key -> { cn, side, file } (UI only until the backend exists)

  const [sugs, setSugs] = useState([])              // last-24h inventory suggestions for the container box
  const [sugOpen, setSugOpen] = useState(false)
  const [viewFile, setViewFile] = useState(null)  // folder image on screen (= the one that gets saved); kept when you change transaction
  const [dateOverride, setDateOverride] = useState(null) // yyyymmdd chosen by the operator

  // Main Gate In uses the same data as the Pre Gate In / Out report (GET_ESURVEY_DETAIL).
  const [fetchMain, mainQ] = useLazyGetPreGateSurveyQuery()
  const [fetchRail, railQ] = useLazyGetRailInQuery()
  const [saveGate, { isLoading: saving }] = useSaveGateDashboardMutation()
  const [fetchImgs, imgsQ] = useLazyGetGateDashboardImagesQuery()
  const [fetchSugs] = useLazySearchGateDashboardContainersQuery()

  const loadRail = useCallback(() => fetchRail({ from_date: fromDate, to_date: toDate }), [fetchRail, fromDate, toDate])
  useEffect(() => { if (tab === 'rail') loadRail() }, [tab]) // eslint-disable-line

  const loadMain = useCallback(() => fetchMain({
    page: 1, page_size: 100000, from_date: fromDate, to_date: toDate, gate_type: 'GATE_IN',
  }), [fetchMain, fromDate, toDate])
  // Reload (after a short pause while typing a date) whenever the range changes.
  useEffect(() => {
    if (tab !== 'main') return
    const h = setTimeout(loadMain, 300)
    return () => clearTimeout(h)
  }, [tab, loadMain])

  const active = tab === 'main' ? mainQ : railQ
  const isFetching = !!active.isFetching
  const isError = !!active.isError || active.data?.status === 'error'
  const refresh = () => (tab === 'main' ? loadMain() : loadRail())

  // Missing sides come straight from the row (IMG_LEFT / IMG_RIGHT / IMG_TOP are empty when the file is absent).
  const txns = useMemo(() => {
    const rows = Array.isArray(active.data?.data) ? active.data.data : []
    return normalize(tab, rows)
  }, [active.data, tab])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return txns
      .filter((t) => {
        if (missingOnly && !t.missing) return false
        if (tab === 'main' && gate !== 'all' && t.place !== gate) return false
        if (q &&!`${t.containerNo ?? ''} ${t.ref ?? ''} ${t.place ?? ''}`.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => timeOf(b.time) - timeOf(a.time))
  }, [txns, missingOnly, search, tab, gate])

  // Gates = the distinct GateName values of the Main Gate In SP rows (same as
  // the Main Gate In page), shown with their raw names.
  const gateList = useMemo(() => {
    const set = new Set(txns.map((t) => t.place).filter(Boolean))
    return [...set].sort()
  }, [txns])
  const gateCounts = useMemo(() => {
    const m = {}
    txns.forEach((t) => { if (t.missing || !missingOnly) m[t.place] = (m[t.place] || 0) + 1 })
    return m
  }, [txns, missingOnly])

  const missingCount = useMemo(() => txns.filter((t) => t.missing).length, [txns])

  const selected = useMemo(() => txns.find((t) => t.key === selectedKey) || null, [txns, selectedKey])

  // Switching tab / transaction resets the entry box.
  useEffect(() => { setSelectedKey(null); setGate('all'); setDateOverride(null); setViewFile(null) }, [tab])
  // The transaction's own container number is filled in automatically (editable).
  useEffect(() => {
    const cn = selected && !isMissing(selected.containerNo) ? String(selected.containerNo).trim().split(' ')[0].toUpperCase() : ''
    setContainerInput(cn); setSideOverride(null) // the viewed image and folder date are kept
  }, [selectedKey]) // eslint-disable-line

  // Suggestions: containers that came in during the last 24 h matching what is typed.
  useEffect(() => {
    if (containerInput.length < 2 || containerInput.length >= 11) { setSugs([]); return }
    let stale = false
    const h = setTimeout(() => {
      fetchSugs(containerInput, true).unwrap()
        .then((res) => { if (!stale) setSugs(Array.isArray(res?.data) ? res.data : []) })
        .catch(() => { if (!stale) setSugs([]) })
    }, 250)
    return () => { stale = true; clearTimeout(h) }
  }, [containerInput]) // eslint-disable-line

  const savedInfo = selected ? saved[selected.key] : null
  // Selected transaction -> every image of <stitching>/<gate>/<date>/00000000000
  // on the server (listed by the backend), shown one at a time.
  const folderMode = !!selected
  // Main: the row's own GateName + the day of its SurveyTime. Rail: the fixed RAILGATE folder (today unless changed).
  const imgGate = tab === 'rail' ? RAIL_GATE_FOLDER : (selected?.raw?.GateName || MAIN_GATE_FOLDER)
  const imgDay = day.replace(/-/g, '')
  const imgArgs = { gate_name: imgGate, ...(imgDay ? { date: imgDay } : {}) }
  useEffect(() => {
    if (!folderMode) return
    fetchImgs(imgArgs, true) // cached per gate/date; the image on screen is kept when it is still in the list
  }, [folderMode, tab, imgGate, imgDay]) // eslint-disable-line
  const serverImgs = folderMode ? imgsQ.currentData : null
  const baseFolder = serverImgs?.folder || folderOf(selected)
  // The transaction knows which sides are missing, so only images of those sides
  // are shown (e.g. missing "left" → only *_left_* files). "Show all" lifts the filter.
  const [showAllSides, setShowAllSides] = useState(false)
  useEffect(() => { setShowAllSides(false) }, [selectedKey])
  const allFiles = useMemo(
    () => (folderMode ? (serverImgs?.images || []).map((i) => i.url) : []),
    [folderMode, serverImgs],
  )
  const wantedSides = (selected?.missingSides || []).filter((s) => ALL_SIDES.includes(s))
  const sideFiles = useMemo(
    () => (wantedSides.length ? allFiles.filter((f) => wantedSides.includes(parseImageName(f).side)) : allFiles),
    [allFiles, wantedSides.join(',')], // eslint-disable-line
  )
  const filtered = !showAllSides && wantedSides.length > 0 && sideFiles.length > 0 && sideFiles.length < allFiles.length
  const files = filtered || (wantedSides.length === 0) ? sideFiles : allFiles
  // The image on screen is the one that gets saved.
  const viewIdx = Math.max(0, files.indexOf(viewFile))
  const picked = files.length ? files[viewIdx] : null
  useEffect(() => { setSideOverride(null) }, [picked])
  // Side comes from the file name (pre-selected); the operator can still change it.
  const detectedSide = picked ? parseImageName(picked).side : null
  const pickedSide = picked ? (sideOverride || detectedSide) : null
  const go = (d) => { if (files.length) setViewFile(files[(viewIdx + d + files.length) % files.length]) }

  const urlFor = (file) => imageUrl(baseFolder, file)

  const handleSubmit = () => {
    const cn = containerInput.trim().toUpperCase()
    if (!selected) return
    if (!picked) {
      notify.warning('Select an image', 'Click the image that shows the missing container first')
      return
    }
    if (!pickedSide) {
      notify.warning('Unknown side', 'The file name does not contain left / right / top')
      return
    }
    if (!CONTAINER_RE.test(cn)) {
      notify.warning('Invalid container no', 'Format: 4 letters + 7 digits (e.g. MSKU1234567)')
      return
    }
    // After the move the image lives at <container>/<side>.jpg (res.url); show it from there.
    const done = (res) => setSaved((s) => ({ ...s, [selected.key]: { cn, side: pickedSide, file: res?.url || picked } }))
    if (!baseFolder) {
      notify.warning('No folder', 'No 00000000000 folder was found for this transaction')
      return
    }
    saveGate({
      gate: tab,
      container_no: cn,
      side: pickedSide,
      folder: baseFolder,
      file: parseImageName(picked).name,
      detected_time: selected.time,
      // Main: the survey row is found by GateName + SurveyTime + its current number.
      gate_name: tab === 'main' ? selected.raw.GateName : undefined,
      survey_time: tab === 'main' ? selected.raw.SurveyTime : undefined,
      old_container_no: String(selected.containerNo ?? '').trim().split(' ')[0].toUpperCase(),
      // Rail: only when the number changes.
      update_record: cn !== String(selected.containerNo ?? '').trim().split(' ')[0].toUpperCase(),
    }).unwrap()
      .then((res) => {
        if (res?.status !== 'success') { notify.error('Save failed', res?.message || 'Could not save'); return }
        done(res)
        // The image was moved out of 00000000000, so reload that folder's list.
        setViewFile(null)
        fetchImgs(imgArgs, false)
        notify.success('Saved', `${cn}/${pickedSide}.jpg ${res.folder_existed ? 'moved into the existing folder' : 'moved into a new folder'}${res.inserted ? ' · added to the survey table' : res.updated ? ' · transaction updated' : ''}`)
      })
      .catch(() => notify.error('Save failed', 'Server error'))
  }

  const inputOk = !!picked && CONTAINER_RE.test(containerInput.trim().toUpperCase())

  return (
    <div className="w-full min-h-screen relative overflow-hidden bg-cover bg-center" style={{ backgroundImage: "url('/Images/bgimageold.png')" }}>
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 pb-10">
          {/* Header */}
          <header className="pt-2 pb-2 flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-[#0e4a78] flex items-center gap-2">
                <FaDoorOpen /> Gate Dashboard
              </h1>
            </div>

          </header>

          {/* Tabs */}
          <div className="flex gap-2 mb-2">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold border transition-all ${
                  tab === key
                    ? 'bg-[#0e4a78] text-white border-[#0e4a78] shadow-md'
                    : 'bg-white/90 text-slate-600 border-slate-200 hover:border-[#0e4a78]/40 hover:text-[#0e4a78]'
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {/* Summary */}
          {/* Gate filter (Main Gate In) */}
          {tab === 'main' && (
            <div className="bg-white/95 rounded-2xl border border-slate-200 shadow-sm px-3 py-2 mb-2 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 mr-1 inline-flex items-center gap-1"><FaDoorOpen size={12} /> Gate</span>
              {[{ key: 'all', label: 'All gates', count: Object.values(gateCounts).reduce((a, b) => a + b, 0) },
                ...gateList.map((g) => ({ key: g, label: g, count: gateCounts[g] || 0 }))].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => { setGate(key); setSelectedKey(null) }}
                  className={`inline-flex items-center gap-2 pl-3.5 pr-2 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    gate === key
                      ? 'bg-gradient-to-r from-[#0e4a78] to-[#0b3e66] text-white border-[#0e4a78] shadow-md scale-[1.03]'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-[#0e4a78]/40 hover:text-[#0e4a78]'
                  }`}
                >
                  {label}
                  <span className={`min-w-[22px] text-center px-1.5 py-0.5 rounded-full text-[10px] font-black ${gate === key ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>{count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="bg-white/95 rounded-2xl shadow-sm border border-slate-200 px-3 py-2 mb-2 flex flex-wrap items-end gap-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1 mb-1"><FiCalendar size={11} /> Date</span>
              <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30" />
            </label>
            <button
              onClick={() => setMissingOnly((v) => !v)}
              className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                missingOnly ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-slate-500 border-slate-300'
              }`}
            >
              {missingOnly ? 'Missing only' : 'All transactions'}
            </button>
            <button onClick={refresh}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-[#0e4a78] text-white hover:bg-[#0b3e66] transition-colors">
              <FiRefreshCw className={isFetching ? 'animate-spin' : ''} size={14} /> Search
            </button>
          </div>

          {/* Body: transactions | images */}
          <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-4">

            {/* Transactions */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col xl:max-h-[calc(100vh-300px)]">
              <div className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">Transactions</p>
                  <p className="text-[11px] text-white/60">{visible.length.toLocaleString()} shown · {missingCount.toLocaleString()} missing of {txns.length.toLocaleString()}</p>
                </div>
                <div className="relative w-44">
                  <FiSearch size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Container / vehicle…"
                    className="w-full pl-7 pr-2 py-1.5 rounded-lg text-xs text-white bg-white/10 border border-white/25 placeholder:text-white/50 focus:outline-none focus:bg-white/15 focus:border-white/50"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-auto divide-y divide-slate-100">
                {isError ? (
                  <div className="px-5 py-10 text-center text-red-600 text-sm font-medium flex flex-col items-center gap-2">
                    <FiAlertCircle size={24} /> Failed to load transactions
                    <span className="text-[11px] font-mono text-red-400 break-all">
                      {active.error?.status ? `HTTP ${active.error.status} ` : ''}
                      {typeof active.error?.data === 'string' ? active.error.data.slice(0, 160) : (active.error?.data?.detail || active.error?.data?.message || active.error?.error || active.data?.message || '')}
                    </span>
                    <button onClick={refresh} className="mt-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 border border-red-200 hover:bg-red-100">Retry</button>
                  </div>
                ) : isFetching && !txns.length ? (
                  <div className="py-16 flex flex-col items-center gap-3 text-slate-500">
                    <div className="w-9 h-9 rounded-full border-4 border-[#0e4a78]/20 border-t-[#0e4a78] animate-spin" />
                    <span className="text-sm font-medium">Loading…</span>
                  </div>
                ) : visible.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <FiSearch className="mx-auto text-3xl mb-2 text-slate-300" />
                    <p className="text-sm font-semibold">{isFetching ? 'Loading transactions…' : 'No transactions'}</p>
                    <p className="text-xs mt-1">{isFetching ? 'Please wait' : 'Try a different date range or filter'}</p>
                  </div>
                ) : visible.map((t) => {
                  const sel = t.key === selectedKey
                  const done = !!saved[t.key]
                  return (
                    <button
                      key={t.key}
                      onClick={() => setSelectedKey(t.key)}
                      className={`w-full text-left px-4 py-3 transition-colors ${sel ? 'bg-blue-50 border-l-4 border-[#0e4a78]' : 'hover:bg-slate-50 border-l-4 border-transparent'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-mono font-black text-xs px-2.5 py-1 rounded-full ${
                          done ? 'bg-emerald-100 text-emerald-700' : t.missing ? 'bg-red-50 text-red-600' : 'bg-blue-100 text-[#0e4a78]'
                        }`}>
                          {done ? saved[t.key].cn : (t.containerNo || '00000000')}
                        </span>
                        {done && <span className="text-[10px] font-bold text-emerald-600 inline-flex items-center gap-1"><FiCheck size={11} /> Updated</span>}
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                        <span className="inline-flex items-center gap-1"><FiClock size={10} />{formatDate(t.time)}</span>
                        {t.ref && <span className="inline-flex items-center gap-1"><FiTruck size={10} />{t.refLabel}: <b className="text-slate-700">{t.ref}</b></span>}
                        {tab === 'rail' && t.place && <span>{t.place}</span>}
                        {t.missingSides?.length > 0 && !done && (
                          <span className="font-bold text-red-500">Missing: {t.missingSides.join(', ')}</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Images + entry */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden xl:sticky xl:top-2 xl:self-start">
              <div className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-4 py-3">
                <p className="font-semibold text-sm">{selected ? 'Transaction images' : 'Select a transaction'}</p>
                <p className="text-[11px] text-white/60">
                  {selected ? `${selected.refLabel}: ${selected.ref || '—'} · ${formatDate(selected.time)}` : 'Pick a transaction from the list'}
                </p>
              </div>

              {!selected ? (
                <div className="py-24 text-center text-slate-400">
                  <FiImage className="mx-auto text-5xl mb-3 text-slate-300" />
                  <p className="text-sm font-semibold">No transaction selected</p>
                  <p className="text-xs mt-1">All images of its folder appear here once you select one</p>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {/* Container number + side + Save: always at the top so no scrolling is needed */}
                  {!savedInfo && (
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-3 space-y-1.5">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 inline-flex items-center gap-1.5 whitespace-nowrap">
                        <FiHash size={12} className="text-[#0e4a78]" /> Container no.
                      </span>
                      <div className="relative flex-1 min-w-[180px]">
                        <input
                          value={containerInput}
                          onChange={(e) => { setContainerInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11)); setSugOpen(true) }}
                          onFocus={() => setSugOpen(true)}
                          onBlur={() => setTimeout(() => setSugOpen(false), 150)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { setSugOpen(false); handleSubmit() } else if (e.key === 'Escape') setSugOpen(false) }}
                          placeholder="e.g. MSKU1234567"
                          autoComplete="off"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold tracking-wider text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78]"
                        />
                        {sugOpen && sugs.length > 0 && (
                          <ul className="absolute z-20 left-0 right-0 top-full mt-1 max-h-60 overflow-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100">
                            <li className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 sticky top-0">In the yard in the last 24 hours</li>
                            {sugs.map((s) => (
                              <li key={s.ContNo}>
                                <button type="button" onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => { setContainerInput(String(s.ContNo).toUpperCase().slice(0, 11)); setSugOpen(false) }}
                                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-blue-50">
                                  <span className="font-mono font-bold text-sm text-slate-700">{s.ContNo}</span>
                                  <span className="text-[10px] text-slate-400">{[s.ContainerSize && `${s.ContainerSize}'`, s.Process, s.GateInDate && String(s.GateInDate).slice(5, 16)].filter(Boolean).join(' · ')}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {picked && (
                        <div className="flex items-center gap-1.5" title={detectedSide ? 'Side taken from the file name' : 'Pick the side'}>
                          {['left', 'right', 'top'].map((s) => (
                            <button key={s} type="button" onClick={() => setSideOverride(s)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase border ${
                                pickedSide === s ? `${SIDE_STYLE[s]} border-current` : 'bg-white text-slate-500 border-slate-200'
                              }`}>{s}</button>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={handleSubmit}
                        disabled={!inputOk || saving}
                        className="inline-flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <FiCheck size={15} /> Save
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {picked
                        ? <>The image below is saved into folder <b>{containerInput || '<container no>'}</b> as <b>{pickedSide || '?'}.jpg</b>.</>
                        : 'Container number is filled from the transaction.'}
                      {containerInput && !CONTAINER_RE.test(containerInput) && <span className="text-red-500 font-semibold"> · Needs 4 letters + 7 digits</span>}
                    </p>
                  </div>
                  )}

                  {savedInfo ? (
                    /* Saved: only the one image, under its new name */
                    <div className="max-w-3xl mx-auto w-full space-y-2">
                      <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                        <FiCheck /> Saved as <span className="font-mono">{savedInfo.cn}/{savedInfo.side}.jpg</span>
                      </p>
                      <ImageViewer files={[savedInfo.file]} index={0} urlFor={urlFor} onGo={() => {}} />
                      <button
                        onClick={() => setSaved((s) => { const n = { ...s }; delete n[selected.key]; return n })}
                        className="text-[11px] font-semibold text-slate-500 hover:text-[#0e4a78] underline"
                      >
                        Change
                      </button>
                    </div>
                  ) : files.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      <FiImage className="mx-auto text-4xl mb-2 text-slate-300" />
                      <p className="text-sm font-semibold">{folderMode && imgsQ.isFetching ? 'Loading images…' : 'No images to show'}</p>
                      <p className="text-xs mt-1">
                        {folderMode ? (serverImgs?.message || 'Looks in <gate>/<date>/00000000000 on the server') : 'This transaction has no images'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Date of the folder: the transaction's date, or any other day that has a 00000000000 folder */}
                      {false && serverImgs?.dates?.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-slate-500 inline-flex items-center gap-1"><FiCalendar size={11} /> Folder date</span>
                          {serverImgs.dates.slice(0, 8).map((d) => (
                            <button key={d} type="button" onClick={() => setDateOverride(d)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border transition-all ${
                                serverImgs.date === d ? 'bg-[#0e4a78] text-white border-[#0e4a78]' : 'bg-white text-slate-500 border-slate-200 hover:border-[#0e4a78]/40'
                              }`}>{d}</button>
                          ))}
                        </div>
                      )}
                      {serverImgs?.fallback && (
                        <p className="text-[11px] font-semibold text-amber-600 flex items-center gap-1.5">
                          <FiAlertCircle size={12} /> No folder for this transaction's date, showing {serverImgs.date} instead.
                        </p>
                      )}
                      {wantedSides.length > 0 && allFiles.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap text-[11px]">
                          <span className="font-bold text-slate-500">Missing for this container</span>
                          {wantedSides.map((s) => (
                            <span key={s} className={`px-2.5 py-0.5 rounded-full font-black uppercase ${SIDE_STYLE[s]}`}>{s}</span>
                          ))}
                          {sideFiles.length === 0 && (
                            <span className="text-amber-600 font-semibold">· No {wantedSides.join(' / ')} image in the folder, showing all {allFiles.length}</span>
                          )}
                        </div>
                      )}
                      <ImageViewer
                        files={files}
                        index={viewIdx}
                        urlFor={urlFor}
                        onGo={go}
                      />
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </main>
        <Footer />
      </div>

    </div>
  )
}
