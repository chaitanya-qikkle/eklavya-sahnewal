import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  FiSearch, FiRefreshCw, FiImage, FiX, FiZoomIn, FiCalendar, FiCheck,
  FiFolder, FiClock, FiTruck, FiHash, FiAlertCircle,
} from 'react-icons/fi'
import { FaDoorOpen, FaTrain } from 'react-icons/fa'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { notify } from '../../../utils/notify'
import { buildAssetUrl } from '../../../config/api'
import { StatCard, StatGrid } from '../../../components/ui/StatCard'
import {
  useGetVehicleContainerDetectionQuery,
  useSaveGateDashboardMutation,
  useLazyGetGateDashboardImagesQuery,
  useLazyGetRailInQuery,
} from '../../../store/api/ymsApi'

/* ─── Config ─────────────────────────────────────────────────────────────── */

const TABS = [
  { key: 'main', label: 'Main Gate In', icon: FaDoorOpen },
  { key: 'rail', label: 'Rail Gate In', icon: FaTrain },
]

// Rail transactions carry no gate name; this is their folder under the stitching root.
const RAIL_GATE_FOLDER = 'RAILGATE_IN'

const SIDE_STYLE = {
  left:  'bg-blue-100 text-blue-700',
  right: 'bg-emerald-100 text-emerald-700',
  top:   'bg-amber-100 text-amber-700',
}

// File names look like "00000000000_left_00_51_09.jpg" → side + time of day.
const parseImageName = (file) => {
  const name = String(file || '').split(/[\\/]/).pop()
  const m = name.match(/_(left|right|top)_(\d{2})_(\d{2})_(\d{2})/i)
  return {
    name,
    side: m ? m[1].toLowerCase() : null,
    time: m ? `${m[2]}:${m[3]}:${m[4]}` : '',
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

/* ─── Dummy data (local testing) ─────────────────────────────────────────── */
// Lets the whole flow be tried without the backend / SP: fake transactions,
// fake left/right/top pictures (inline SVG) and the container-number entry.
// ON by default only in `npm run dev`; there is a toggle in the filter bar.
const DUMMY_DEFAULT = import.meta.env.DEV

const DUMMY_REAL_NOS = ['MSKU4521987', 'TCLU8830214', 'CAIU2764503']
const DUMMY_VEHICLES = ['MH12AB4521', 'MH14CD8890', 'GJ05EF1203', 'MH43GH7761', 'RJ14JK3342', 'MH04LM9015']

// Folder with many unread images, like the real one: <no>_<side>_<HH_MM_SS>.jpg
function makeDummyFiles(seed) {
  const sides = ['left', 'right', 'top']
  const files = []
  for (let n = 0; n < 12; n++) {
    const s = (seed * 7 + n * 53) % 3600
    files.push(`00000000000_${sides[(n + seed) % 3]}_00_${p2(Math.floor(s / 60))}_${p2(s % 60)}.jpg`)
  }
  return files.sort()
}

function makeDummyRows(tab) {
  const now = Date.now()
  const rows = []
  for (let i = 0; i < 10; i++) {
    const missing = i % 3 !== 2 // 2 out of 3 are "not read" (0000…)
    const t = new Date(now - (i * 95 + 20) * 60 * 1000)
    const stamp = `${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())} ${p2(t.getHours())}:${p2(t.getMinutes())}:00`
    const containerNo = missing ? '00000000' : DUMMY_REAL_NOS[i % DUMMY_REAL_NOS.length]
    const size = i % 2 === 0 ? '20' : '40'
    const process = ['EXPORT', 'IMPORT', 'EMPTY'][i % 3]
    if (tab === 'main') {
      rows.push({
        ID: 9000 + i,
        ContainerNo: containerNo,
        VehicleNo: DUMMY_VEHICLES[i % DUMMY_VEHICLES.length],
        GateName: ['MAINGATE_IN', 'MAINGATE_IN_2', 'COMPLEXGATE_IN'][i % 3 === 1 ? 1 : i % 4 === 0 ? 0 : 2],
        ContainerDetectedTime: stamp,
        ContainerSize: size,
        Process: process,
        ...(i % 3 !== 2 ? { ImageFolderPath: `GATE_IN/20261101/0000000000`, ImageFiles: makeDummyFiles(i) } : { ContainerImagePath: dummyImage('x_left_00_10_00.jpg', 'left') }),
      })
    } else {
      rows.push({
        ContMasterID: 7000 + i,
        ContainerNo: containerNo,
        WagonNo: `WGN${String(48210 + i * 7)}`,
        RakeNo: `RK-${2260 + (i % 3)}`,
        RailInDateTime: stamp,
        ContainerSize: size,
        Process: process,
        DocumentNo: `DOC${5500 + i}`,
        ...(missing ? { ImageFolderPath: `RAIL_IN/20261101/0000000000`, ImageFiles: makeDummyFiles(i) } : { Camera1ImagePath: dummyImage('x_right_00_10_00.jpg', 'right') }),
      })
    }
  }
  return rows
}

// Fake container photo: corrugated side (left/right) or roof (top) with a
// caption showing which folder / file it came from.
function dummyImage(file, side) {
  const name = parseImageName(file).time.replace(/:/g, '_') || file
  const base = { left: ['#2563eb', '#1e40af'], right: ['#059669', '#047857'], top: ['#d97706', '#b45309'] }[side]
  const ribs = Array.from({ length: 24 }, (_, i) =>
    `<rect x="${30 + i * 21}" y="${side === 'top' ? 70 : 60}" width="9" height="${side === 'top' ? 160 : 180}" fill="${base[1]}" opacity=".55"/>`
  ).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 320">
    <rect width="560" height="320" fill="#e2e8f0"/>
    <rect x="20" y="${side === 'top' ? 60 : 50}" width="520" height="${side === 'top' ? 180 : 200}" rx="6" fill="${base[0]}"/>
    ${ribs}
    <text x="280" y="${side === 'top' ? 160 : 150}" font-family="monospace" font-size="34" font-weight="700" fill="#fff" text-anchor="middle" stroke="#0f172a" stroke-width="1">${name}</text>
    <text x="280" y="285" font-family="monospace" font-size="20" fill="#334155" text-anchor="middle">${side} (dummy)</text>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
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
// A transaction is "missing" when none of its container images (left / right /
// top → ContainerImagePath, or Camera1/2ImagePath on rail) came through at all.
const hasOwnImage = (r) => !!(r.ContainerImagePath || r.Camera1ImagePath || r.Camera2ImagePath)
const normalize = (tab, rows) =>
  normalizeRaw(tab, rows).map((t) => ({ ...t, missing: !hasOwnImage(t.raw) }))

const normalizeRaw = (tab, rows) =>
  rows.map((r, i) => tab === 'main'
    ? {
        key: `main-${r.ID ?? i}`,
        containerNo: r.ContainerNo,
        refLabel: 'Vehicle', ref: r.VehicleNo,
        place: r.GateName,
        time: r.ContainerDetectedTime,
        size: r.ContainerSize, process: r.Process,
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

function Lightbox({ url, label, onClose }) {
  if (!url) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative max-w-5xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-5 py-3">
          <span className="font-semibold text-base flex items-center gap-2"><FiImage /> {label}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"><FiX className="text-lg" /></button>
        </div>
        <div className="flex items-center justify-center bg-slate-50 p-4 overflow-auto" style={{ maxHeight: '85vh' }}>
          <img src={url} alt={label} className="max-w-full object-contain rounded-lg" style={{ maxHeight: '80vh' }} />
        </div>
      </div>
    </div>
  )
}

// Image card that falls back to a placeholder when the file is missing.
// One image of the folder. Click = select it, magnifier = zoom.
function ImageThumb({ file, url, selected, onSelect, onZoom, hideName }) {
  const [err, setErr] = useState(false)
  useEffect(() => { setErr(false) }, [url])
  const { side, time } = parseImageName(file)
  const ok = !!url && !err
  return (
    <div
      className={`bg-white rounded-xl border-2 overflow-hidden flex flex-col transition-all ${
        selected ? 'border-emerald-500 shadow-lg ring-2 ring-emerald-200' : 'border-slate-200 hover:border-[#0e4a78]/40'
      }`}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50/70 border-b border-slate-100">
        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${SIDE_STYLE[side] || 'bg-slate-100 text-slate-500'}`}>
          {side || 'unknown'}
        </span>
        {time && <span className="text-[10px] font-mono text-slate-500 inline-flex items-center gap-1"><FiClock size={9} />{time}</span>}
        {selected && <FiCheck className="ml-auto text-emerald-600" size={14} />}
      </div>
      <div
        className="group relative aspect-[4/3] w-full flex items-center justify-center overflow-hidden cursor-pointer"
        style={{ background: 'repeating-conic-gradient(#f8fafc 0% 25%, #f1f5f9 0% 50%) 50% / 24px 24px' }}
        onClick={onSelect}
      >
        {ok ? (
          <img src={url} alt={file} onError={() => setErr(true)} className="max-w-full max-h-full object-contain p-1.5" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-300">
            <FiImage size={24} /><span className="text-[10px] font-semibold text-slate-400">No image available</span>
          </div>
        )}
        {ok && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onZoom(url, file) }}
            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Zoom"
          >
            <FiZoomIn className="text-[#0e4a78]" size={14} />
          </button>
        )}
      </div>
      {!hideName && <div className="px-2.5 py-1.5 text-[10px] font-mono text-slate-400 truncate" title={parseImageName(file).name}>{parseImageName(file).name}</div>}
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function GateDashboard() {
  const [tab, setTab] = useState('main')
  const [fromDate, setFromDate] = useState(yesterdayStr())
  const [toDate, setToDate] = useState(todayStr())
  const [search, setSearch] = useState('')
  const [missingOnly, setMissingOnly] = useState(true)
  const [gate, setGate] = useState('all') // Main Gate In only: one gate or 'all'
  const [selectedKey, setSelectedKey] = useState(null)
  const [containerInput, setContainerInput] = useState('')
  const [pickedFile, setPickedFile] = useState(null) // image chosen in the folder gallery
  const [sideOverride, setSideOverride] = useState(null) // used only when the file name has no side
  const [saved, setSaved] = useState({}) // txn key -> { cn, side, file } (UI only until the backend exists)
  const [lightbox, setLightbox] = useState(null)

  const [dummy, setDummy] = useState(DUMMY_DEFAULT)
  const [dummySeed, setDummySeed] = useState(0) // bump = regenerate fake rows

  // Exactly the same call as the Main Gate In page (no options), so both share one cache entry.
  const mainQ = useGetVehicleContainerDetectionQuery()
  const [fetchRail, railQ] = useLazyGetRailInQuery()
  const [saveGate, { isLoading: saving }] = useSaveGateDashboardMutation()
  const [fetchImgs, imgsQ] = useLazyGetGateDashboardImagesQuery()

  const loadRail = useCallback(() => fetchRail({ from_date: fromDate, to_date: toDate }), [fetchRail, fromDate, toDate])
  useEffect(() => { if (!dummy && tab === 'rail') loadRail() }, [tab, dummy]) // eslint-disable-line

  const active = tab === 'main' ? mainQ : railQ
  const isFetching = !dummy && !!active.isFetching
  const isError = !dummy && !!active.isError
  const refresh = () => {
    if (dummy) { setDummySeed((s) => s + 1); return }
    return tab === 'main' ? mainQ.refetch() : loadRail()
  }

  const txns = useMemo(() => {
    const rows = dummy
      ? makeDummyRows(tab)
      : (Array.isArray(active.data?.data) ? active.data.data : [])
    return normalize(tab, rows)
  }, [active.data, tab, dummy, dummySeed]) // eslint-disable-line

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
  useEffect(() => { setSelectedKey(null); setGate('all') }, [tab])
  useEffect(() => { setContainerInput(''); setPickedFile(null); setSideOverride(null) }, [selectedKey])
  useEffect(() => { setSideOverride(null) }, [pickedFile])

  const savedInfo = selected ? saved[selected.key] : null
  const baseFolder = (folderMode && serverFolder) || folderOf(selected)
  // Missing transaction → all images of <stitching>/<gate>/<its date>/00000000000
  // on the server (listed by the backend). Dummy mode / other rows use the row's own data.
  const folderMode = !!selected && selected.missing && !dummy
  useEffect(() => {
    if (!folderMode) return
    fetchImgs({ gate_name: tab === 'rail' ? RAIL_GATE_FOLDER : selected.place, date: String(selected.time || '').slice(0, 10) })
  }, [folderMode, selected?.key]) // eslint-disable-line
  const serverImgs = folderMode ? imgsQ.currentData : null
  const serverFolder = serverImgs?.folder || null
  const files = useMemo(
    () => folderMode ? (serverImgs?.images || []).map((i) => i.url) : [...displayFilesOf(selected)].sort(),
    [selected, folderMode, serverImgs],
  )
  const picked = pickedFile && files.includes(pickedFile) ? pickedFile : null
  // Side comes from the file name; when it has none the operator picks it.
  const pickedSide = picked ? (parseImageName(picked).side || sideOverride) : null

  // Real urls come from the SP folder; dummy mode draws a fake picture instead.
  const urlFor = (file) => String(file).startsWith('data:') ? file : dummy ?dummyImage(file, parseImageName(file).side || 'left') : imageUrl(baseFolder, file)

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
    const done = () => setSaved((s) => ({ ...s, [selected.key]: { cn, side: pickedSide, file: picked } }))
    if (dummy) {
      done()
      notify.info('Dummy mode', 'Nothing was written — turn Dummy data OFF to save for real')
      return
    }
    if (!baseFolder) {
      notify.warning('No folder', 'This transaction has no image folder from the SP')
      return
    }
    saveGate({
      gate: tab,
      container_no: cn,
      side: pickedSide,
      folder: baseFolder,
      file: parseImageName(picked).name,
      gate_name: selected.place,
      detected_time: selected.time,
    }).unwrap()
      .then((res) => {
        if (res?.status !== 'success') { notify.error('Save failed', res?.message || 'Could not save'); return }
        done()
        notify.success('Saved', `${cn} saved as ${pickedSide}.jpg`)
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
          <header className="pt-6 pb-4 flex items-end justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Dashboard</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0e4a78] flex items-center gap-2 mt-0.5">
                <FaDoorOpen /> Gate Dashboard
              </h1>
              <p className="text-slate-500 mt-0.5 text-sm">
                Missing container transactions — pick the image showing the container &amp; enter its number
              </p>
            </div>

            {/* Summary: top-right corner */}
            <StatGrid cols="grid-cols-2 sm:grid-cols-4" className="w-full lg:w-auto lg:min-w-[640px]">
              <StatCard label="Transactions" value={txns.length} icon={FiTruck} tone="slate" />
              <StatCard label="Need review" value={missingCount} icon={FiAlertCircle} tone="rose" total={txns.length} />
              <StatCard label="Updated" value={Object.keys(saved).length} icon={FiCheck} tone="emerald" total={missingCount} />
              <StatCard label="Shown" value={visible.length} icon={FiImage} tone="sky" total={txns.length} />
            </StatGrid>
          </header>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${
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
            <div className="bg-white/95 rounded-2xl border border-slate-200 shadow-sm p-3 mb-4 flex items-center gap-2 flex-wrap">
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
          <div className="bg-white/95 rounded-2xl shadow-sm border border-slate-200 p-3 mb-4 flex flex-wrap items-end gap-3">
            {tab === 'rail' && <>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1 mb-1"><FiCalendar size={11} /> From</span>
              <input type="datetime-local" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30" />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1 mb-1"><FiCalendar size={11} /> To</span>
              <input type="datetime-local" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30" />
            </label>
            </>}
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex-1 min-w-[200px]">
              <span className="flex items-center gap-1 mb-1"><FiSearch size={11} /> Search</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === 'main' ? 'Vehicle / gate…' : 'Wagon / rake…'}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30" />
            </label>
            <button
              onClick={() => setMissingOnly((v) => !v)}
              className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                missingOnly ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-slate-500 border-slate-300'
              }`}
            >
              {missingOnly ? 'Missing only' : 'All transactions'}
            </button>
            <button
              onClick={() => { setDummy((v) => !v); setSelectedKey(null) }}
              title="Fake transactions + images for testing without backend"
              className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                dummy ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-white text-slate-500 border-slate-300'
              }`}
            >
              Dummy data: {dummy ? 'ON' : 'OFF'}
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
              </div>

              <div className="flex-1 overflow-auto divide-y divide-slate-100">
                {isError ? (
                  <div className="px-5 py-10 text-center text-red-600 text-sm font-medium flex flex-col items-center gap-2">
                    <FiAlertCircle size={24} /> Failed to load transactions
                  </div>
                ) : isFetching && !txns.length ? (
                  <div className="py-16 flex flex-col items-center gap-3 text-slate-500">
                    <div className="w-9 h-9 rounded-full border-4 border-[#0e4a78]/20 border-t-[#0e4a78] animate-spin" />
                    <span className="text-sm font-medium">Loading…</span>
                  </div>
                ) : visible.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <FiSearch className="mx-auto text-3xl mb-2 text-slate-300" />
                    <p className="text-sm font-semibold">No transactions</p>
                    <p className="text-xs mt-1">Try a different date range or filter</p>
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
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Images + entry */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
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
                  {/* Folder path */}
                  <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <FiFolder className="text-[#0e4a78] flex-shrink-0" />
                    <span className="font-semibold text-slate-500">Folder</span>
                    <span className="font-mono text-slate-700 break-all">
                      {savedInfo
                        ? siblingFolder(baseFolder, savedInfo.cn)
                        : baseFolder || <span className="text-slate-400">Will come from the SP (backend pending)</span>}
                    </span>
                    {!savedInfo && baseFolder && <span className="ml-auto text-[10px] font-bold text-slate-500 whitespace-nowrap">{files.length} images</span>}
                  </div>

                  {savedInfo ? (
                    /* Saved: only the one image, under its new name */
                    <div className="max-w-md mx-auto w-full space-y-2">
                      <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                        <FiCheck /> Saved as <span className="font-mono">{savedInfo.cn}/{savedInfo.side}.jpg</span>
                      </p>
                      <ImageThumb
                        file={savedInfo.file}
                        url={urlFor(savedInfo.file)}
                        selected
                        hideName
                        onSelect={() => {}}
                        onZoom={(url, l) => setLightbox({ url, label: `${savedInfo.cn} · ${savedInfo.side}.jpg` })}
                      />
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
                    /* All images of the folder, side read from the file name */
                    <div>
                      <p className="text-[11px] text-slate-500 mb-2">Click the image that shows the missing container.</p>
                      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 max-h-[52vh] overflow-auto pr-1">
                        {files.map((f) => (
                          <ImageThumb
                            key={`${selected.key}-${f}`}
                            file={f}
                            url={urlFor(f)}
                            selected={f === picked}
                            onSelect={() => setPickedFile(f)}
                            onZoom={(url) => setLightbox({ url, label: f })}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Container number entry */}
                  {!savedInfo && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5 mb-2">
                      <FiHash size={12} className="text-[#0e4a78]" /> Container number
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        value={containerInput}
                        onChange={(e) => setContainerInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        placeholder="e.g. MSKU1234567"
                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-mono font-bold tracking-wider text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78]"
                      />
                      <button
                        onClick={handleSubmit}
                        disabled={!inputOk || saving}
                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <FiCheck size={15} /> Save
                      </button>
                    </div>
                    {picked && !parseImageName(picked).side && (
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-[11px] font-bold text-slate-500">Image side</span>
                        {['left', 'right', 'top'].map((s) => (
                          <button key={s} type="button" onClick={() => setSideOverride(s)}
                            className={`px-3 py-1 rounded-full text-[11px] font-black uppercase border ${
                              sideOverride === s ? `${SIDE_STYLE[s]} border-current` : 'bg-white text-slate-500 border-slate-200'
                            }`}>{s}</button>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400 mt-2">
                      {picked
                        ? <>Saving creates folder <b>{containerInput || '<container no>'}</b> with the selected image as <b>{pickedSide || '?'}.jpg</b>.</>
                        : 'Select an image above first.'}
                      {containerInput && !CONTAINER_RE.test(containerInput) && <span className="text-red-500 font-semibold"> · Needs 4 letters + 7 digits</span>}
                    </p>
                  </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </main>
        <Footer />
      </div>

      {lightbox && <Lightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />}
    </div>
  )
}
