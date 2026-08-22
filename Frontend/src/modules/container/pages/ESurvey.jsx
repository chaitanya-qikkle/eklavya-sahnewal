import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  FiSearch, FiRefreshCw, FiChevronUp, FiChevronDown, FiX,
  FiCamera, FiMessageSquare, FiArrowLeft, FiArrowRight,
  FiFilter, FiCalendar, FiCheckCircle, FiAlertTriangle,
  FiEye, FiFileText, FiShield, FiLogIn, FiLogOut,
} from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import { MdQrCodeScanner } from 'react-icons/md'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { useLazyGetPreGateSurveyQuery } from '../../../store/api/ymsApi'
import { buildAssetUrl } from '../../../config/api'
import { useSelector } from 'react-redux'
import { selectAuthUser } from '../../../store/slices/authSlice'

// ─── constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20

const SIDES = [
  { key: 'left',  imgKey: 'IMG_LEFT',  name: 'Left Side',  remarkKey: 'leftRemark'  },
  { key: 'right', imgKey: 'IMG_RIGHT', name: 'Right Side', remarkKey: 'rightRemark' },
  { key: 'top',   imgKey: 'IMG_TOP',   name: 'Top View',   remarkKey: 'topRemark'   },
]
const STEPS = [
  { id: 1, label: 'Left' }, { id: 2, label: 'Right' },
  { id: 3, label: 'Top'  }, { id: 4, label: 'Report' },
]

// ─── helpers ──────────────────────────────────────────────────────────────────
function fetchImageAsDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = url
  })
}

function fmt(dt) {
  if (!dt) return '—'
  try {
    const d = new Date(String(dt).replace(' ', 'T'))
    if (isNaN(d.getTime())) return String(dt)
    const p = (n) => String(n).padStart(2, '0')
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
  } catch { return String(dt) }
}

// ─── sub-components ───────────────────────────────────────────────────────────
function SurveyImg({ url }) {
  const [err, setErr] = useState(false)
  useEffect(() => setErr(false), [url])
  if (!url || err) return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white/20">
      <FiCamera size={52} />
      <p className="text-xs text-white/30 font-bold uppercase tracking-widest">No Image</p>
    </div>
  )
  return <img src={url} alt="survey" className="w-full h-full object-contain select-none" onError={() => setErr(true)} draggable={false} />
}

function SortIcon({ col, sortField, sortDir }) {
  return (
    <span className="inline-flex flex-col ml-1 align-middle">
      <FiChevronUp   className={`w-3 h-3 ${sortField === col && sortDir === 'asc'  ? 'text-white' : 'text-white/30'}`} />
      <FiChevronDown className={`w-3 h-3 -mt-0.5 ${sortField === col && sortDir === 'desc' ? 'text-white' : 'text-white/30'}`} />
    </span>
  )
}

// ─── main component ───────────────────────────────────────────────────────────
export default function ESurvey() {
  const today = new Date().toISOString().split('T')[0]
  const authUser = useSelector(selectAuthUser)
  const loggedInName = authUser?.first_name || authUser?.username || authUser?.name || 'Unknown'

  const [fromDate,     setFromDate]     = useState(today)
  const [toDate,       setToDate]       = useState(today)
  const [gateFilter,   setGateFilter]   = useState('ALL')
  const [containerNo,  setContainerNo]  = useState('')
  const [page,         setPage]         = useState(1)
  const [sortField,    setSortField]    = useState('SurveyTime')
  const [sortDir,      setSortDir]      = useState('desc')
  const [activeSurvey, setActiveSurvey] = useState(null)
  const [step,         setStep]         = useState(1)
  const [zoom,         setZoom]         = useState(1)
  const [form,         setForm]         = useState({
    leftRemark: '', rightRemark: '', topRemark: '',
    containerNo: '', vehicleNo: '', containerSize: '', containerType: '',
    transactionType: '', documentNo: '', surveyBy: '',
    overallRemark: '', placeOfInspection: '', inspectionRequestedOf: '',
  })

  const imgRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [drag,     setDrag]     = useState({ x: 0, y: 0, sl: 0, st: 0 })

  const [fetchSurvey, { data: apiData, isFetching, isError }] = useLazyGetPreGateSurveyQuery()

  const buildArgs = useCallback((pg = 1) => {
    const args = { page: pg, page_size: PAGE_SIZE, from_date: fromDate, to_date: toDate }
    if (gateFilter !== 'ALL') args.gate_type    = gateFilter
    if (containerNo.trim())   args.container_no = containerNo.trim()
    return args
  }, [fromDate, toDate, gateFilter, containerNo])

  const fetched = useRef(false)
  useEffect(() => {
    if (fetched.current) return
    fetched.current = true
    fetchSurvey({ page: 1, page_size: PAGE_SIZE, from_date: today, to_date: today })
  }, []) // eslint-disable-line

  const handleSearch = () => { setPage(1); fetchSurvey(buildArgs(1)) }
  const handleClear  = () => {
    setFromDate(today); setToDate(today)
    setGateFilter('ALL'); setContainerNo(''); setPage(1)
    fetchSurvey({ page: 1, page_size: PAGE_SIZE, from_date: today, to_date: today })
  }
  const goToPage = (pg) => {
    const tp = apiData?.total_pages ?? 1
    if (pg < 1 || pg > tp) return
    setPage(pg); fetchSurvey(buildArgs(pg))
  }

  // pan / zoom
  useEffect(() => {
    const el = imgRef.current; if (!el) return
    const onWheel = (e) => { e.preventDefault(); setZoom(z => e.deltaY < 0 ? Math.min(8, z + 0.2) : Math.max(1, z - 0.2)) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [step, activeSurvey])

  const startDrag = (e) => { if (!imgRef.current) return; setDragging(true); setDrag({ x: e.clientX, y: e.clientY, sl: imgRef.current.scrollLeft, st: imgRef.current.scrollTop }) }
  const onDrag    = (e) => { if (!dragging || !imgRef.current) return; imgRef.current.scrollLeft = drag.sl - (e.clientX - drag.x); imgRef.current.scrollTop = drag.st - (e.clientY - drag.y) }
  const endDrag   = () => setDragging(false)

  const surveys = useMemo(() => {
    const raw = Array.isArray(apiData?.data) ? [...apiData.data] : []
    return raw.sort((a, b) => {
      const av = String(a[sortField] || ''), bv = String(b[sortField] || '')
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [apiData, sortField, sortDir])

  const totalPages = apiData?.total_pages ?? 1
  const stats = useMemo(() => ({
    total:   apiData?.total          ?? 0,
    gateIn:  apiData?.gate_in_count  ?? 0,
    gateOut: apiData?.gate_out_count ?? 0,
  }), [apiData])

  const handleSort = (f) => {
    setSortDir(sortField === f ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc')
    setSortField(f)
  }

  const startSurvey  = (sv) => {
    setActiveSurvey(sv); setStep(1); setZoom(1)
    setForm(f => ({
      ...f, containerNo: sv.ContainerNo || '', containerSize: sv.ContSize || '',
      containerType: sv.ContType || '', documentNo: sv.DocumentNo || '',
      leftRemark: '', rightRemark: '', topRemark: '', overallRemark: '',
    }))
  }
  const cancelSurvey = () => { setActiveSurvey(null); setZoom(1) }
  const nextStep     = () => { if (step < 4) { setStep(s => s + 1); setZoom(1) } }
  const prevStep     = () => { if (step > 1) { setStep(s => s - 1); setZoom(1) } }
  const handleChange = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const downloadPDF = useCallback(async (sv, f) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()
    const NAVY  = [14, 74, 120]
    const STEEL = [10, 59, 97]
    const GOLD  = [234, 179, 8]
    const LIGHT = [236, 244, 251]
    const WHITE = [255, 255, 255]

    // ── HEADER GRADIENT BLOCK ──────────────────────────────────────────────
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, W, 28, 'F')
    // accent stripe
    doc.setFillColor(...GOLD)
    doc.rect(0, 28, W, 1.2, 'F')

    // logo placeholder circle
    doc.setFillColor(...STEEL)
    doc.circle(18, 14, 8, 'F')
    doc.setFillColor(...GOLD)
    doc.circle(18, 14, 5, 'F')
    doc.setFillColor(...NAVY)
    doc.circle(18, 14, 2.5, 'F')

    // title
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('CONTAINER INSPECTION REPORT', 30, 11)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(180, 210, 235)
    doc.text('E-Survey  ·  Gate Management System  ·  GDL Chennai', 30, 17)
    doc.setTextColor(200, 220, 240)
    doc.setFontSize(7)
    doc.text(`Generated: ${fmt(new Date())}   ·   Survey By: ${loggedInName}`, 30, 23)

    // ── CONTAINER INFO CARD ────────────────────────────────────────────────
    const INFO_Y = 33
    doc.setFillColor(...LIGHT)
    doc.roundedRect(10, INFO_Y, W - 20, 18, 2, 2, 'F')
    doc.setDrawColor(...NAVY)
    doc.setLineWidth(0.4)
    doc.roundedRect(10, INFO_Y, W - 20, 18, 2, 2, 'S')

    // left accent bar
    doc.setFillColor(...NAVY)
    doc.roundedRect(10, INFO_Y, 3, 18, 1, 1, 'F')

    doc.setTextColor(...NAVY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(sv.ContainerNo || '—', 17, INFO_Y + 8)

    const gateType = sv.GateType || '—'
    const badgeX = 17
    const badgeY = INFO_Y + 10
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    const isGateIn = gateType === 'GATE_IN'
    doc.setFillColor(isGateIn ? 16 : 217, isGateIn ? 185 : 119, isGateIn ? 129 : 6)
    doc.roundedRect(badgeX, badgeY, 22, 5, 1, 1, 'F')
    doc.setTextColor(...WHITE)
    doc.text(isGateIn ? 'GATE IN' : 'GATE OUT', badgeX + 11, badgeY + 3.5, { align: 'center' })

    // right side info pills
    const pills = [
      { label: 'GATE',        val: sv.GateName     || '—' },
      { label: 'SIZE',        val: f.containerSize || sv.ContSize  || '—' },
      { label: 'TYPE',        val: f.containerType || sv.ContType  || '—' },
      { label: 'SURVEY TIME', val: fmt(sv.SurveyTime) },
    ]
    let px = W - 14
    for (let i = pills.length - 1; i >= 0; i--) {
      const { label, val } = pills[i]
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(100, 130, 160)
      const valW = doc.getTextWidth(val) + 4
      px -= valW
      doc.setFillColor(...WHITE)
      doc.setDrawColor(180, 205, 225)
      doc.setLineWidth(0.3)
      doc.roundedRect(px, INFO_Y + 3, valW, 11, 1.5, 1.5, 'FD')
      doc.setTextColor(100, 130, 160)
      doc.text(label, px + valW / 2, INFO_Y + 7, { align: 'center' })
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...NAVY)
      doc.text(val, px + valW / 2, INFO_Y + 12, { align: 'center' })
      px -= 3
    }

    // ── SECTION TITLE: PHOTO EVIDENCE ─────────────────────────────────────
    const SEC1_Y = INFO_Y + 22
    doc.setFillColor(...NAVY)
    doc.rect(10, SEC1_Y, 3, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...NAVY)
    doc.text('PHOTO EVIDENCE', 15, SEC1_Y + 5)
    doc.setDrawColor(200, 220, 235)
    doc.setLineWidth(0.3)
    doc.line(52, SEC1_Y + 4.5, W - 10, SEC1_Y + 4.5)

    // ── 3 IMAGES ROW ──────────────────────────────────────────────────────
    const IMG_Y  = SEC1_Y + 9
    const IMG_H  = 52
    const GAP    = 3
    const IMG_W  = (W - 20 - GAP * 2) / 3
    const imgEntries = [
      { label: 'LEFT SIDE',  icon: 'L', url: buildAssetUrl(sv.IMG_LEFT),  remark: f.leftRemark  },
      { label: 'RIGHT SIDE', icon: 'R', url: buildAssetUrl(sv.IMG_RIGHT), remark: f.rightRemark },
      { label: 'TOP VIEW',   icon: 'T', url: buildAssetUrl(sv.IMG_TOP),   remark: f.topRemark   },
    ]

    for (let i = 0; i < imgEntries.length; i++) {
      const x = 10 + i * (IMG_W + GAP)
      const { label, icon, url, remark } = imgEntries[i]

      // card shadow simulation
      doc.setFillColor(200, 215, 230)
      doc.roundedRect(x + 0.7, IMG_Y + 0.7, IMG_W, IMG_H + 14, 2, 2, 'F')

      // card bg
      doc.setFillColor(...WHITE)
      doc.roundedRect(x, IMG_Y, IMG_W, IMG_H + 14, 2, 2, 'F')

      // image area
      doc.setFillColor(240, 245, 250)
      doc.roundedRect(x, IMG_Y, IMG_W, IMG_H, 2, 2, 'F')

      if (url) {
        try {
          const dataUrl = await fetchImageAsDataUrl(url)
          doc.addImage(dataUrl, 'JPEG', x, IMG_Y, IMG_W, IMG_H, undefined, 'FAST')
        } catch {
          doc.setTextColor(180, 180, 180)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7)
          doc.text('No Image', x + IMG_W / 2, IMG_Y + IMG_H / 2, { align: 'center' })
        }
      } else {
        doc.setTextColor(180, 180, 180)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.text('No Image', x + IMG_W / 2, IMG_Y + IMG_H / 2, { align: 'center' })
      }

      // label badge overlay
      doc.setFillColor(...NAVY)
      doc.roundedRect(x + 1.5, IMG_Y + 1.5, IMG_W - 3, 6, 1, 1, 'F')
      doc.setTextColor(...WHITE)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.text(`${icon}  ${label}`, x + IMG_W / 2, IMG_Y + 5.5, { align: 'center' })

      // remark area
      doc.setTextColor(80, 100, 120)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(6.5)
      const lines = doc.splitTextToSize(remark || 'No remark', IMG_W - 4)
      doc.text(lines, x + IMG_W / 2, IMG_Y + IMG_H + 5, { align: 'center' })
    }

    // ── SECTION TITLE: INSPECTION DETAILS ────────────────────────────────
    const SEC2_Y = IMG_Y + IMG_H + 18
    doc.setFillColor(...GOLD)
    doc.rect(10, SEC2_Y, 3, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...NAVY)
    doc.text('INSPECTION DETAILS', 15, SEC2_Y + 5)
    doc.setDrawColor(200, 220, 235)
    doc.setLineWidth(0.3)
    doc.line(57, SEC2_Y + 4.5, W - 10, SEC2_Y + 4.5)

    // ── DETAILS TABLE ─────────────────────────────────────────────────────
    const tableBody = [
      ['Container No',          f.containerNo        || sv.ContainerNo || '—'],
      ['Vehicle No',            f.vehicleNo          || '—'],
      ['Size',                  f.containerSize      || sv.ContSize    || '—'],
      ['Type',                  f.containerType      || sv.ContType    || '—'],
      ['Transaction',           f.transactionType    || '—'],
      ['Document No',           f.documentNo         || sv.DocumentNo  || '—'],
      ['Survey By',             loggedInName],
      ['Place of Inspection',   f.placeOfInspection  || '—'],
      ['Inspection Requested Of', f.inspectionRequestedOf || '—'],
      ['Overall Remark',        f.overallRemark      || '—'],
    ]

    // split into 2 columns: left 5 rows, right 5 rows
    const leftRows  = tableBody.slice(0, 5)
    const rightRows = tableBody.slice(5)
    const COL_W = (W - 23) / 2
    const LABEL_W = 42

    autoTable(doc, {
      startY: SEC2_Y + 9,
      body: leftRows,
      theme: 'plain',
      styles: { fontSize: 7.5, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 } },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: NAVY, cellWidth: LABEL_W, fillColor: LIGHT },
        1: { textColor: [40, 60, 80], cellWidth: COL_W - LABEL_W },
      },
      margin: { left: 10, right: W / 2 + 1.5 },
      alternateRowStyles: { fillColor: [248, 251, 255] },
      didDrawCell: (data) => {
        if (data.column.index === 0 && data.row.index === 0) {
          doc.setFillColor(...NAVY)
          doc.rect(data.cell.x, data.cell.y, 1.5, data.cell.height, 'F')
        }
      },
    })

    autoTable(doc, {
      startY: SEC2_Y + 9,
      body: rightRows,
      theme: 'plain',
      styles: { fontSize: 7.5, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 } },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: NAVY, cellWidth: LABEL_W, fillColor: LIGHT },
        1: { textColor: [40, 60, 80], cellWidth: COL_W - LABEL_W },
      },
      margin: { left: W / 2 + 1.5, right: 10 },
      alternateRowStyles: { fillColor: [248, 251, 255] },
    })

    // ── FOOTER ─────────────────────────────────────────────────────────────
    doc.setFillColor(...NAVY)
    doc.rect(0, H - 12, W, 12, 'F')
    doc.setFillColor(...GOLD)
    doc.rect(0, H - 12, W, 0.8, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(160, 195, 225)
    doc.text('GDL Chennai  ·  Gate Management System  ·  E-Survey Report', 10, H - 5)
    doc.setTextColor(200, 220, 240)
    doc.text(`Surveyed by: ${loggedInName}   ·   ${fmt(new Date())}`, W - 10, H - 5, { align: 'right' })

    doc.save(`esurvey-${sv.ContainerNo || 'report'}-${today}.pdf`)
  }, [today, loggedInName])

  const handleSubmit = async (e) => {
    e.preventDefault()
    await downloadPDF(activeSurvey, form)
    cancelSurvey()
  }

  const handleExport = () => {
    if (!surveys.length) return
    const ws = XLSX.utils.json_to_sheet(surveys.map(sv => ({
      'Container No': sv.ContainerNo, 'Gate': sv.GateName, 'Type': sv.GateType,
      'Survey Time': fmt(sv.SurveyTime), 'Gate In': fmt(sv.GateInDate),
      'Status': sv.Status, 'Size': sv.ContSize, 'Cont Type': sv.ContType, 'Doc No': sv.DocumentNo,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'E-Survey')
    XLSX.writeFile(wb, `esurvey-${today}.xlsx`)
  }

  // ── WIZARD VIEW ──────────────────────────────────────────────────────────────
  if (activeSurvey) {
    const side   = step <= 3 ? SIDES[step - 1] : null
    const imgUrl = side ? buildAssetUrl(activeSurvey[side.imgKey]) : null

    return (
      <div className="h-screen flex flex-col overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: "url('/Images/bgimageold.png')" }}>
        <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm" />
        <div className="relative z-10 flex flex-col h-full overflow-hidden">
          <Navbar />

          {/* content — fills space below navbar, no scroll */}
          <div className="flex-1 min-h-0 flex flex-col px-4 sm:px-6 pt-2 pb-2 gap-2 overflow-hidden">

            {/* ── Wizard header bar ── */}
            <div className="shrink-0 bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] rounded-xl shadow-xl border border-white/10 px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <MdQrCodeScanner className="text-white text-lg" />
                </div>
                <div>
                  <p className="text-[9px] text-blue-200/70 font-black uppercase tracking-widest leading-none">E-Survey · Container Inspection</p>
                  <p className="text-white font-black text-base tracking-wide leading-tight">{activeSurvey.ContainerNo}</p>
                  <p className="text-white/50 text-[10px]">{activeSurvey.GateName} &nbsp;·&nbsp; {fmt(activeSurvey.SurveyTime)}</p>
                </div>
              </div>

              {/* Step tracker */}
              <div className="hidden sm:flex items-center gap-1.5">
                {STEPS.map((s, i) => {
                  const active = step === s.id, done = step > s.id
                  return (
                    <div key={s.id} className="flex items-center gap-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow ring-2 transition-all
                        ${active ? 'bg-emerald-500 text-white ring-emerald-400/30 scale-110' : done ? 'bg-emerald-400/20 text-emerald-400 ring-emerald-400/20' : 'bg-white/10 text-white/30 ring-transparent'}`}>
                        {done ? <FiCheckCircle size={12} /> : s.id}
                      </div>
                      <span className={`text-[9px] font-extrabold uppercase tracking-wider ${active ? 'text-emerald-400' : done ? 'text-emerald-500/50' : 'text-white/25'}`}>{s.label}</span>
                      {i < STEPS.length - 1 && <div className={`w-6 h-px mx-1 ${done ? 'bg-emerald-400/50' : 'bg-white/10'}`} />}
                    </div>
                  )
                })}
              </div>

              <button onClick={cancelSurvey} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-red-500/30 border border-white/20 text-white flex items-center justify-center transition-all shrink-0">
                <FiX size={15} />
              </button>
            </div>

            {/* ── Step body (fills remaining height) ── */}
            <div className="flex-1 min-h-0 flex flex-col">

              {/* Steps 1–3: image viewer + remark bar */}
              {step <= 3 && side && (
                <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}
                  className="flex-1 min-h-0 flex flex-col gap-2">

                  {/* Image panel — fills all available height */}
                  <div className="flex-1 min-h-0 relative bg-slate-900/80 rounded-xl overflow-hidden ring-1 ring-white/10 shadow-inner group">
                    <div ref={imgRef} onMouseDown={startDrag} onMouseMove={onDrag} onMouseUp={endDrag} onMouseLeave={endDrag}
                      className={`w-full h-full overflow-auto ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
                      <div className="m-auto flex items-center justify-center origin-center transition-transform duration-100"
                        style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
                        <SurveyImg url={imgUrl} />
                      </div>
                    </div>
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur border border-white/20 text-white px-3 py-1.5 rounded-full text-[11px] font-bold tracking-widest uppercase pointer-events-none">{side.name}</div>
                    {imgUrl && <div className="absolute top-3 right-3 bg-black/60 backdrop-blur border border-white/10 rounded-xl px-3 py-1.5 pointer-events-none"><span className="text-white text-[10px] font-black">{Math.round(zoom * 100)}%</span></div>}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur border border-white/10 rounded-full px-3 py-1 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                      <span className="text-white/50 text-[9px] font-semibold">Scroll to zoom · Drag to pan</span>
                    </div>
                  </div>

                  {/* Remark + nav bar */}
                  <div className="shrink-0 bg-white/95 rounded-xl px-3 py-2.5 shadow-xl border border-slate-300 flex items-center gap-2">
                    <div className="relative flex-1">
                      <FiMessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                      <input value={form[side.remarkKey]} onChange={e => handleChange(side.remarkKey, e.target.value)}
                        placeholder={`${side.name} — damage remarks…`}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border-2 border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e4a78]/40 focus:ring-2 focus:ring-[#0e4a78]/10 outline-none text-slate-800 text-sm font-semibold transition-all placeholder:text-slate-400 placeholder:font-normal" />
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {step > 1 && (
                        <button onClick={prevStep} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-slate-200 bg-white hover:bg-slate-50 font-bold text-sm text-slate-500 transition-all active:scale-95">
                          <FiArrowLeft size={13} /> Back
                        </button>
                      )}
                      <button onClick={nextStep} className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-sm font-extrabold shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5 active:scale-95 transition-all">
                        {step === 3 ? 'View Report' : 'Next'} <FiArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 4: report — 2-col layout, no scroll */}
              {step === 4 && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                  className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <form id="survey-form" onSubmit={handleSubmit} className="flex-1 min-h-0 flex gap-2 overflow-hidden">

                    {/* ── LEFT: 3 images stacked + remarks ── */}
                    <div className="flex flex-col gap-1.5 w-[42%] shrink-0 min-h-0">
                      {SIDES.map(s => {
                        const url = buildAssetUrl(activeSurvey[s.imgKey])
                        return (
                          <div key={s.key} className="flex-1 min-h-0 flex flex-col bg-slate-900/80 rounded-xl overflow-hidden ring-1 ring-white/10">
                            {/* image */}
                            <div className="flex-1 min-h-0 relative">
                              <SurveyImg url={url} />
                              <div className="absolute top-1.5 left-2 bg-black/60 backdrop-blur border border-white/20 text-white px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase pointer-events-none">{s.name}</div>
                            </div>
                            {/* remark input */}
                            <div className="shrink-0 bg-slate-800/60 px-2 py-1.5 border-t border-white/10">
                              <input value={form[s.remarkKey]} onChange={e => handleChange(s.remarkKey, e.target.value)}
                                placeholder={`${s.name} remarks…`}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder:text-white/30 outline-none focus:border-blue-400/50 transition-all" />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* ── RIGHT: form fields + action buttons ── */}
                    <div className="flex-1 min-h-0 flex flex-col bg-white/95 rounded-xl shadow-2xl border border-slate-300 overflow-hidden">
                      {/* header */}
                      <div className="shrink-0 px-4 py-2.5 bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] flex items-center gap-2">
                        <FiFileText className="text-white" size={14} />
                        <h3 className="text-white font-bold text-xs uppercase tracking-widest">Inspection Report</h3>
                        <span className="ml-auto text-blue-200 text-[11px] font-semibold">{activeSurvey.ContainerNo}</span>
                      </div>
                      {/* fields — 2-col grid, no scroll */}
                      <div className="flex-1 min-h-0 p-3 grid grid-cols-2 gap-x-3 gap-y-2 content-start overflow-hidden">
                        {[
                          { label: 'Container No',   key: 'containerNo',           required: true, span: 1 },
                          { label: 'Vehicle No',     key: 'vehicleNo',                             span: 1 },
                          { label: 'Size',           key: 'containerSize',                         span: 1 },
                          { label: 'Type',           key: 'containerType',                         span: 1 },
                          { label: 'Transaction',    key: 'transactionType',                       span: 1 },
                          { label: 'Document No',    key: 'documentNo',                            span: 1 },
                          { label: 'Survey By',      key: 'surveyBy',                              span: 2 },
                          { label: 'Location',       key: 'placeOfInspection',                     span: 2 },
                          { label: 'Requested By',   key: 'inspectionRequestedOf',                 span: 2 },
                          { label: 'Final Remark',   key: 'overallRemark',                         span: 2 },
                        ].map(({ label, key, required, span }) => (
                          <div key={key} className={`flex flex-col gap-0.5 ${span === 2 ? 'col-span-2' : ''}`}>
                            <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                              {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
                            </label>
                            <input value={form[key]} onChange={e => handleChange(key, e.target.value)} required={required}
                              className="rounded-lg border-2 border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-[#0e4a78] focus:ring-2 focus:ring-[#0e4a78]/10 outline-none transition-all" />
                          </div>
                        ))}
                      </div>
                      {/* footer buttons */}
                      <div className="shrink-0 px-3 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                        <button type="button" onClick={prevStep}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-500 text-xs font-bold hover:bg-slate-50 transition-all active:scale-95">
                          <FiArrowLeft size={12} /> Back
                        </button>
                        <button type="submit"
                          className="flex items-center gap-2 px-6 py-2 rounded-lg bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] hover:from-[#0b3e66] hover:to-[#08304f] text-white text-xs font-extrabold tracking-widest shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all">
                          <FiShield size={13} /> SUBMIT &amp; DOWNLOAD PDF
                        </button>
                      </div>
                    </div>

                  </form>
                </motion.div>
              )}
            </div>

          </div>{/* end content col */}
        </div>
      </div>
    )
  }

  // ── TABLE VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}>
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 pb-10">

          {/* ── Header + Stat Cards ── */}
          <header className="pt-6 pb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Container Management</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0e4a78] flex items-center gap-2 mt-0.5">
                <MdQrCodeScanner /> E-Survey
              </h1>
              <p className="text-slate-500 mt-0.5 text-sm">{stats.total.toLocaleString()} total records</p>
            </div>

            <div className="grid grid-cols-3 gap-3 lg:gap-4">
              {[
                { label: 'Total',    val: stats.total,   cls: 'from-[#0e4a78] to-[#0a3b61]',    light: 'text-blue-100'    },
                { label: 'Gate In',  val: stats.gateIn,  cls: 'from-emerald-600 to-emerald-500', light: 'text-emerald-100' },
                { label: 'Gate Out', val: stats.gateOut, cls: 'from-amber-500 to-amber-600',     light: 'text-amber-100'   },
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
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="border-2 border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <FiCalendar className="text-[#0e4a78]" size={11} /> To Date
              </label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="border-2 border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <FiFilter className="text-[#0e4a78]" size={11} /> Gate Type
              </label>
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
                <input value={containerNo} onChange={e => setContainerNo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Search container…"
                  className="w-full border-2 border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleClear}
                className="px-4 py-2 rounded-lg border-2 border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all">
                Clear
              </button>
              <button onClick={handleSearch} disabled={isFetching}
                className="flex items-center gap-2 bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] hover:from-[#0b3e66] hover:to-[#072c4a] text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-60">
                <FiRefreshCw className={isFetching ? 'animate-spin' : ''} size={13} />
                {isFetching ? 'Loading…' : 'Search'}
              </button>
            </div>
          </div>

          {/* ── Table ── */}
          <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">

            {/* Table header bar */}
            <div className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
                  <MdQrCodeScanner className="text-lg" />
                </div>
                <div>
                  <p className="font-semibold text-base">E-Survey Register</p>
                  <p className="text-xs text-white/60">
                    Page {page} of {totalPages} · {stats.total.toLocaleString()} total · {PAGE_SIZE} per page
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:flex items-center gap-1.5 text-xs text-white/50 bg-white/10 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
                </span>
                <button onClick={handleClear}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold border border-white/30 transition-all">
                  <FiRefreshCw size={11} /> Refresh
                </button>
                <button onClick={handleExport} disabled={!surveys.length}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-all disabled:opacity-40">
                  <FaFileExcel size={11} /> Export
                </button>
              </div>
            </div>

            {/* Loading */}
            {isFetching && (
              <div className="py-20 flex flex-col items-center gap-3 text-slate-500">
                <div className="w-10 h-10 rounded-full border-4 border-[#0e4a78]/20 border-t-[#0e4a78] animate-spin" />
                <span className="text-sm font-medium">Loading survey records…</span>
              </div>
            )}

            {/* Error */}
            {isError && !isFetching && (
              <div className="py-16 text-center text-red-600 font-medium text-sm">
                <FiAlertTriangle className="mx-auto text-3xl mb-2" />
                Failed to load data. Check backend connection.
              </div>
            )}

            {/* Table body */}
            {!isFetching && !isError && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white text-xs">
                      <th className="px-3 py-3 text-left font-semibold uppercase tracking-wider w-10 border-r border-white/10">#</th>
                      {[
                        { label: 'Container No', field: 'ContainerNo' },
                        { label: 'Gate',         field: 'GateName'   },
                        { label: 'Type',         field: 'GateType'   },
                        { label: 'Survey Time',  field: 'SurveyTime' },
                        { label: 'Gate In',      field: 'GateInDate' },
                        { label: 'Status',       field: 'Status'     },
                        { label: 'Size / Type',  field: 'ContSize'   },
                        { label: 'Images',       field: null         },
                        { label: 'Survey',       field: null         },
                      ].map(({ label, field }) => (
                        <th key={label} onClick={() => field && handleSort(field)}
                          className={`px-3 py-3 text-left font-semibold uppercase tracking-wider whitespace-nowrap border-r border-white/10 last:border-r-0 ${field ? 'cursor-pointer hover:bg-white/10' : ''}`}>
                          <span className="flex items-center gap-0.5">
                            {label}
                            {field && <SortIcon col={field} sortField={sortField} sortDir={sortDir} />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {surveys.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-16 text-center">
                          <FiSearch className="mx-auto text-4xl text-slate-300 mb-3" />
                          <p className="text-slate-500 font-medium">No records found</p>
                          <p className="text-xs text-slate-400 mt-1">Adjust the date range or filters and click Search</p>
                        </td>
                      </tr>
                    ) : surveys.map((sv, idx) => {
                      const isIn = sv.GateType === 'GATE_IN'
                      return (
                        <tr key={sv.SurveyId ?? idx}
                          className={`hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                          <td className="px-3 py-3 text-[10px] text-slate-400 font-medium border-r border-slate-100">
                            {(page - 1) * PAGE_SIZE + idx + 1}
                          </td>
                          <td className="px-3 py-3 border-r border-slate-100">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 text-[#0e4a78] font-black font-mono text-xs">
                              {sv.ContainerNo || '—'}
                            </span>
                            {sv.DocumentNo && <div className="text-[10px] text-slate-400 mt-0.5 pl-1">{sv.DocumentNo}</div>}
                          </td>
                          <td className="px-3 py-3 text-[11px] text-slate-600 font-medium border-r border-slate-100 max-w-[90px] truncate">
                            {sv.GateName || '—'}
                          </td>
                          <td className="px-3 py-3 border-r border-slate-100">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${
                              isIn ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                   : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {isIn ? <FiLogIn size={9} /> : <FiLogOut size={9} />}
                              {isIn ? 'GATE IN' : 'GATE OUT'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-[11px] text-slate-700 border-r border-slate-100 whitespace-nowrap">{fmt(sv.SurveyTime)}</td>
                          <td className="px-3 py-3 text-[11px] text-slate-500 border-r border-slate-100 whitespace-nowrap">{fmt(sv.GateInDate)}</td>
                          <td className="px-3 py-3 border-r border-slate-100">
                            {sv.Status
                              ? <span className="inline-block px-2 py-1 rounded-lg text-[10px] font-semibold bg-blue-100 text-blue-700">{sv.Status}</span>
                              : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-3 border-r border-slate-100 text-center">
                            {sv.ContSize || sv.ContType
                              ? <>
                                  <p className="text-xs font-bold text-slate-700">{sv.ContSize || '—'}</p>
                                  <p className="text-[10px] text-slate-400">{sv.ContType || ''}</p>
                                </>
                              : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-3 border-r border-slate-100">
                            <div className="flex items-center gap-1">
                              {[['IMG_LEFT', 'L'], ['IMG_RIGHT', 'R'], ['IMG_TOP', 'T']].map(([k, lbl]) => (
                                sv[k]
                                  ? <a key={k} href={buildAssetUrl(sv[k])} target="_blank" rel="noreferrer"
                                      className="w-7 h-7 rounded-lg border border-[#0e4a78]/30 bg-[#0e4a78]/10 text-[#0e4a78] hover:bg-[#0e4a78] hover:text-white flex items-center justify-center text-[9px] font-bold transition-all">{lbl}</a>
                                  : <span key={k} className="w-7 h-7 rounded-lg border border-slate-200 bg-slate-100 text-slate-300 flex items-center justify-center text-[9px] font-bold">{lbl}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button onClick={() => startSurvey(sv)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0e4a78]/25 text-[#0e4a78] text-[10px] font-bold hover:bg-[#0e4a78] hover:text-white transition-all">
                              <FiEye size={11} /> View
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!isFetching && totalPages > 0 && (
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Showing <strong className="text-[#0e4a78]">{(page - 1) * PAGE_SIZE + 1}</strong>–<strong className="text-[#0e4a78]">{Math.min(page * PAGE_SIZE, stats.total)}</strong> of <strong className="text-[#0e4a78]">{stats.total.toLocaleString()}</strong> records
                </span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => goToPage(1)} disabled={page === 1}
                    className="px-2 py-1.5 rounded-lg border-2 border-slate-300 font-bold text-xs disabled:opacity-40 text-[#0e4a78] hover:bg-blue-50 bg-white transition-all">«</button>
                  <button onClick={() => goToPage(page - 1)} disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg border-2 border-slate-300 font-bold text-xs disabled:opacity-40 text-[#0e4a78] hover:bg-blue-50 bg-white transition-all">Prev</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                    const pg = start + i
                    if (pg > totalPages) return null
                    return (
                      <button key={pg} onClick={() => goToPage(pg)}
                        className={`w-9 h-8 rounded-lg border-2 text-xs font-bold transition-all ${pg === page ? 'bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white border-[#0e4a78] shadow-md' : 'border-slate-300 text-[#0e4a78] hover:bg-blue-50 bg-white'}`}>
                        {pg}
                      </button>
                    )
                  })}
                  <button onClick={() => goToPage(page + 1)} disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg border-2 border-slate-300 font-bold text-xs disabled:opacity-40 text-[#0e4a78] hover:bg-blue-50 bg-white transition-all">Next</button>
                  <button onClick={() => goToPage(totalPages)} disabled={page === totalPages}
                    className="px-2 py-1.5 rounded-lg border-2 border-slate-300 font-bold text-xs disabled:opacity-40 text-[#0e4a78] hover:bg-blue-50 bg-white transition-all">»</button>
                </div>
              </div>
            )}
          </section>

        </main>
        <Footer />
      </div>
    </div>
  )
}
