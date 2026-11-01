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
import {
  useGetVehicleContainerDetectionQuery,
  useLazyGetRailInQuery,
} from '../../../store/api/ymsApi'

/* ─── Config ─────────────────────────────────────────────────────────────── */

const TABS = [
  { key: 'main', label: 'Main Gate In', icon: FaDoorOpen },
  { key: 'rail', label: 'Rail Gate In', icon: FaTrain },
]

const SIDES = [
  { key: 'left',  label: 'Left'  },
  { key: 'right', label: 'Right' },
  { key: 'top',   label: 'Top'   },
]

// TODO(backend): the SP returns the folder of the "00000000" transaction
// (e.g. ".../00000000_<txn>/"). Until it exists the folder is read from the
// row if the API ever sends it, otherwise it stays empty and the image slots
// show "No image". This is the ONLY place that decides where the folder is.
const folderOf = (txn) => txn?.raw?.ImageFolderPath || txn?.raw?.FolderPath || null

// One place that turns "<folder>/<side>.jpg" into a URL. Change here when the
// backend serves the files (same /v1/container/img?p= pattern as Pre Gate).
const imageUrl = (folder, side) => {
  if (!folder) return null
  const base = String(folder).replace(/[\\/]+$/, '')
  const full = `${base}/${side}.jpg`
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
const normalize = (tab, rows) =>
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
function ImageSlot({ label, url, onZoom }) {
  const [err, setErr] = useState(false)
  useEffect(() => { setErr(false) }, [url])
  const ok = !!url && !err
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <span className="w-6 h-6 rounded-lg flex items-center justify-center bg-[#0e4a78]/10 text-[#0e4a78]"><FiImage size={12} /></span>
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">{label}</span>
        <span className="ml-auto text-[10px] font-mono text-slate-400">{label.toLowerCase()}.jpg</span>
      </div>
      {ok ? (
        <button
          type="button"
          onClick={() => onZoom(url, label)}
          className="group relative aspect-[4/3] w-full flex items-center justify-center overflow-hidden"
          style={{ background: 'repeating-conic-gradient(#f8fafc 0% 25%, #f1f5f9 0% 50%) 50% / 24px 24px' }}
        >
          <img src={url} alt={label} onError={() => setErr(true)} className="max-w-full max-h-full object-contain p-2" />
          <span className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center">
            <span className="w-12 h-12 rounded-full bg-white/90 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all flex items-center justify-center shadow-xl">
              <FiZoomIn className="text-[#0e4a78]" size={22} />
            </span>
          </span>
        </button>
      ) : (
        <div className="aspect-[4/3] w-full flex flex-col items-center justify-center gap-2 text-slate-300 bg-slate-50/50">
          <span className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center"><FiImage size={26} /></span>
          <span className="text-xs font-semibold text-slate-400">No image available</span>
        </div>
      )}
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
  const [selectedKey, setSelectedKey] = useState(null)
  const [containerInput, setContainerInput] = useState('')
  const [saved, setSaved] = useState({}) // txn key -> container no (UI only until the backend exists)
  const [lightbox, setLightbox] = useState(null)

  const mainQ = useGetVehicleContainerDetectionQuery(undefined, { skip: tab !== 'main' })
  const [fetchRail, railQ] = useLazyGetRailInQuery()

  const loadRail = useCallback(() => fetchRail({ from_date: fromDate, to_date: toDate }), [fetchRail, fromDate, toDate])
  useEffect(() => { if (tab === 'rail') loadRail() }, [tab]) // eslint-disable-line

  const active = tab === 'main' ? mainQ : railQ
  const isFetching = !!active.isFetching
  const isError = !!active.isError
  const refresh = () => (tab === 'main' ? mainQ.refetch() : loadRail())

  const txns = useMemo(() => {
    const rows = Array.isArray(active.data?.data) ? active.data.data : []
    return normalize(tab, rows)
  }, [active.data, tab])

  const visible = useMemo(() => {
    const from = timeOf(fromDate), to = timeOf(toDate)
    const q = search.trim().toLowerCase()
    return txns
      .filter((t) => {
        if (missingOnly && !isMissing(t.containerNo)) return false
        const tm = timeOf(t.time)
        if (tab === 'main' && tm && ((from && tm < from) || (to && tm > to))) return false
        if (q && !`${t.containerNo ?? ''} ${t.ref ?? ''} ${t.place ?? ''}`.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => timeOf(b.time) - timeOf(a.time))
  }, [txns, missingOnly, search, fromDate, toDate, tab])

  const missingCount = useMemo(() => txns.filter((t) => isMissing(t.containerNo)).length, [txns])

  const selected = useMemo(() => txns.find((t) => t.key === selectedKey) || null, [txns, selectedKey])

  // Switching tab / transaction resets the entry box.
  useEffect(() => { setSelectedKey(null) }, [tab])
  useEffect(() => { setContainerInput('') }, [selectedKey])

  const savedNo = selected ? saved[selected.key] : null
  const baseFolder = folderOf(selected)
  const activeFolder = savedNo ? siblingFolder(baseFolder, savedNo) : baseFolder

  const handleSubmit = () => {
    const cn = containerInput.trim().toUpperCase()
    if (!selected) return
    if (!CONTAINER_RE.test(cn)) {
      notify.warning('Invalid container no', 'Format: 4 letters + 7 digits (e.g. MSKU1234567)')
      return
    }
    // TODO(backend): call the SP here → it creates folder "<cn>" holding
    // left.jpg / right.jpg / top.jpg. For now only the UI state changes.
    setSaved((s) => ({ ...s, [selected.key]: cn }))
    notify.info('UI preview', 'Backend abhi connect nahi hai — sirf screen par dikh raha hai')
  }

  const inputOk = CONTAINER_RE.test(containerInput.trim().toUpperCase())

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
                Missing container transactions — review left / right / top images &amp; enter the container number
              </p>
            </div>
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

          {/* Filters */}
          <div className="bg-white/95 rounded-2xl shadow-sm border border-slate-200 p-3 mb-4 flex flex-wrap items-end gap-3">
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
                    <p className="text-xs mt-1">Date range / filter badal kar dekho</p>
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
                          done ? 'bg-emerald-100 text-emerald-700' : isMissing(t.containerNo) ? 'bg-red-50 text-red-600' : 'bg-blue-100 text-[#0e4a78]'
                        }`}>
                          {done ? saved[t.key] : (t.containerNo || '00000000')}
                        </span>
                        {done && <span className="text-[10px] font-bold text-emerald-600 inline-flex items-center gap-1"><FiCheck size={11} /> Updated</span>}
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                        <span className="inline-flex items-center gap-1"><FiClock size={10} />{formatDate(t.time)}</span>
                        {t.ref && <span className="inline-flex items-center gap-1"><FiTruck size={10} />{t.refLabel}: <b className="text-slate-700">{t.ref}</b></span>}
                        {t.place && <span>{t.place}</span>}
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
                  {selected ? `${selected.refLabel}: ${selected.ref || '—'} · ${formatDate(selected.time)}` : 'Left side se transaction chuno'}
                </p>
              </div>

              {!selected ? (
                <div className="py-24 text-center text-slate-400">
                  <FiImage className="mx-auto text-5xl mb-3 text-slate-300" />
                  <p className="text-sm font-semibold">Koi transaction select nahi hai</p>
                  <p className="text-xs mt-1">Select karne par left / right / top images yahan dikhengi</p>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {/* Folder path */}
                  <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <FiFolder className="text-[#0e4a78] flex-shrink-0" />
                    <span className="font-semibold text-slate-500">Folder</span>
                    <span className="font-mono text-slate-700 break-all">
                      {activeFolder || <span className="text-slate-400">SP se aayega (backend pending)</span>}
                    </span>
                    {savedNo && <span className="ml-auto text-[10px] font-bold text-emerald-600 whitespace-nowrap">renamed → {savedNo}</span>}
                  </div>

                  {/* 3 images */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {SIDES.map(({ key, label }) => (
                      <ImageSlot
                        key={`${selected.key}-${activeFolder}-${key}`}
                        label={label}
                        url={imageUrl(activeFolder, key)}
                        onZoom={(url, l) => setLightbox({ url, label: l })}
                      />
                    ))}
                  </div>

                  {/* Container number entry */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5 mb-2">
                      <FiHash size={12} className="text-[#0e4a78]" /> Container number
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        value={containerInput}
                        onChange={(e) => setContainerInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        placeholder={savedNo ? `Current: ${savedNo}` : 'e.g. MSKU1234567'}
                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-mono font-bold tracking-wider text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78]"
                      />
                      <button
                        onClick={handleSubmit}
                        disabled={!inputOk}
                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <FiCheck size={15} /> Save
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Save karne par is container number ke naam ka folder banega, jisme <b>left.jpg</b>, <b>right.jpg</b> aur <b>top.jpg</b> hongi.
                      {containerInput && !inputOk && <span className="text-red-500 font-semibold"> · 4 letters + 7 digits chahiye</span>}
                    </p>
                  </div>
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
