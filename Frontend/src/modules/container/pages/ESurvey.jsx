import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { writeXlsx } from '../../../utils/excelDates'
import jsPDF from 'jspdf'
import {
  FiSearch, FiRefreshCw, FiChevronUp, FiChevronDown, FiX,
  FiCamera, FiMessageSquare, FiArrowLeft, FiArrowRight,
  FiFilter, FiCalendar, FiCheckCircle, FiAlertTriangle,
  FiEye, FiFileText, FiShield, FiLogIn, FiLogOut,
} from 'react-icons/fi'
import { MdQrCodeScanner } from 'react-icons/md'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { useLazyGetPreGateSurveyQuery } from '../../../store/api/ymsApi'
import { FilterExportBtn } from '../../../components/ui/FilterBar'
import { buildAssetUrl } from '../../../config/api'
import { useSelector } from 'react-redux'
import { selectAuthUser } from '../../../store/slices/authSlice'

// ─── constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20

// PDF header details — yahan se Sahnewal ka address / email edit kar sakte ho
const COMPANY = {
  name:  'GATEWAY DISTRIPARKS PVT LTD. - SAHNEWAL',
  addr1: 'Gateway Distriparks (Sahnewal), Sahnewal,',
  addr2: 'Ludhiana - 141 120, Punjab.',
  email: 'esurvey@gdlsahnewal.com',
}

// 5 images: Left / Right / Top + Left Damage (Left2) / Right Damage (Right2)
const SIDES = [
  { key: 'left',        imgKey: 'IMG_LEFT',  name: 'Left Side',    short: 'L',  remarkKey: 'leftRemark'        },
  { key: 'right',       imgKey: 'IMG_RIGHT', name: 'Right Side',   short: 'R',  remarkKey: 'rightRemark'       },
  { key: 'top',         imgKey: 'IMG_TOP',   name: 'Top View',     short: 'T',  remarkKey: 'topRemark'         },
  { key: 'leftDamage',  imgKey: 'Left2',     name: 'Left Damage',  short: 'LD', remarkKey: 'leftDamageRemark',  damage: true },
  { key: 'rightDamage', imgKey: 'Right2',    name: 'Right Damage', short: 'RD', remarkKey: 'rightDamageRemark', damage: true },
]
const STEPS = [
  { id: 1, label: 'Left'  }, { id: 2, label: 'Right'     },
  { id: 3, label: 'Top'   }, { id: 4, label: 'L Damage'  },
  { id: 5, label: 'R Damage' }, { id: 6, label: 'Report' },
]
const REPORT_STEP = STEPS.length // 6

// ─── helpers ──────────────────────────────────────────────────────────────────
// Left2 / Right2 come as "stitching_outputs/MAINGATE_IN/.../damage_left.jpg"
// → convert to the same "/v1/container/img?p=..." format the other images use
function getImageUrl(row, key) {
  const raw = row?.[key]
  if (!raw) return null
  if (key === 'Left2' || key === 'Right2') {
    const rel = String(raw).replace(/^\/?stitching_outputs\//, '')
    return buildAssetUrl(`/v1/container/img?p=${rel}`)
  }
  return buildAssetUrl(raw)
}

// returns { dataUrl, w, h } so the PDF can keep the original aspect ratio
function loadImageForPdf(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), w: img.naturalWidth, h: img.naturalHeight })
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

// The DB can hold a path for a file that is not actually on the server
// (backend then answers {"success":false,"message":"Image not found"}).
// So "has a path" is not enough — we probe the URL once with an <Image> and
// only enable the button when it really loads as an image. Results are cached.
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

function ThumbBtn({ url, short, name, damage }) {
  const status = useImageStatus(url)

  if (status !== 'ok') {
    return (
      <button type="button" disabled
        title={status === 'loading' ? `Checking ${name}…` : `No ${name} image`}
        className={`w-7 h-7 rounded-lg border border-slate-200 bg-slate-100 text-slate-300 opacity-50 cursor-not-allowed flex items-center justify-center text-[9px] font-bold ${status === 'loading' ? 'animate-pulse' : ''}`}>
        {short}
      </button>
    )
  }

  const activeCls = damage
    ? 'border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-600 hover:text-white'
    : 'border-[#0e4a78]/30 bg-[#0e4a78]/10 text-[#0e4a78] hover:bg-[#0e4a78] hover:text-white'
  return (
    <a href={url} target="_blank" rel="noreferrer" title={`View ${name}`}
      className={`w-7 h-7 rounded-lg border flex items-center justify-center text-[9px] font-bold transition-all ${activeCls}`}>
      {short}
    </a>
  )
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
// "YYYY-MM-DDTHH:mm" in local time, for datetime-local input defaults.
const toLocalInputValue = (d) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const todayLocalDT = () => toLocalInputValue(new Date())

export default function ESurvey() {
  const today = todayLocalDT()
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
    leftDamageRemark: '', rightDamageRemark: '',
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
      leftRemark: '', rightRemark: '', topRemark: '',
      leftDamageRemark: '', rightDamageRemark: '', overallRemark: '',
    }))
  }
  const cancelSurvey = () => { setActiveSurvey(null); setZoom(1) }
  const nextStep     = () => { if (step < REPORT_STEP) { setStep(s => s + 1); setZoom(1) } }
  const prevStep     = () => { if (step > 1) { setStep(s => s - 1); setZoom(1) } }
  const handleChange = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ── PDF: "SURVEY REPORT CONTAINER CONDITION" format (GDL Sahnewal) ─────────
  const downloadPDF = useCallback(async (sv, f) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()
    const M  = 10               // page margin
    const CW = W - 2 * M        // content width
    const CX = W / 2            // centre x

    doc.setDrawColor(0, 0, 0)
    doc.setTextColor(0, 0, 0)

    // ── company header ─────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(COMPANY.name, CX, 14, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(COMPANY.addr1, CX, 19.5, { align: 'center' })
    doc.text(COMPANY.addr2, CX, 23.5, { align: 'center' })
    doc.setFontSize(8.5)
    doc.text(`E-mail : ${COMPANY.email}`, CX, 29, { align: 'center' })
    doc.setLineWidth(0.4)
    doc.line(M, 34, W - M, 34)

    // ── SL NO / DATE ───────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text(`SL NO : ${sv.SurveyId ?? '—'}`, M, 40.5)
    doc.text(`DATE : ${fmt(toLocalInputValue(new Date())).slice(0, 10)}`, W - M, 40.5, { align: 'right' })

    // ── title ──────────────────────────────────────────────────────────────
    const TITLE = 'SURVEY REPORT CONTAINER CONDITION'
    doc.setFontSize(12)
    doc.text(TITLE, CX, 47, { align: 'center' })
    const tw = doc.getTextWidth(TITLE)
    doc.setLineWidth(0.3)
    doc.line(CX - tw / 2, 48.2, CX + tw / 2, 48.2)

    // ── "carried out at the request of" ────────────────────────────────────
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text('THIS INSPECTION HAS BEEN CARRIED OUT AT THE REQUEST OF', CX, 54, { align: 'center' })
    doc.text('M/S :', M, 60)
    doc.setFont('helvetica', 'bold')
    doc.text(String(f.inspectionRequestedOf || ''), M + 10, 59.5)
    doc.setLineWidth(0.2)
    doc.line(M + 9, 60.8, W - M, 60.8)

    // ── Incoming / Outgoing / Off Hire / On Hire ───────────────────────────
    const opts = ['Incoming', 'Outgoing', 'Off Hire', 'On Hire']
    const activeOpt = sv.GateType === 'GATE_IN' ? 'Incoming' : sv.GateType === 'GATE_OUT' ? 'Outgoing' : ''
    const TY = 67
    doc.setFontSize(9)
    const wOf = (t, bold) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); return doc.getTextWidth(t) }
    const SEP = ' / '
    const sepW = wOf(SEP, false)
    const totalW = opts.reduce((a, o) => a + wOf(o, o === activeOpt), 0) + sepW * (opts.length - 1)
    let ox = CX - totalW / 2
    opts.forEach((o, i) => {
      const b = o === activeOpt
      const w = wOf(o, b)
      doc.setFont('helvetica', b ? 'bold' : 'normal')
      doc.setTextColor(b ? 0 : 110, b ? 0 : 110, b ? 0 : 110)
      doc.text(o, ox, TY)
      if (b) { doc.setLineWidth(0.3); doc.line(ox, TY + 0.9, ox + w, TY + 0.9) }
      ox += w
      if (i < opts.length - 1) {
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(110, 110, 110)
        doc.text(SEP, ox, TY)
        ox += sepW
      }
    })
    doc.setTextColor(0, 0, 0)

    // label (bold) + value (normal)
    const lv = (label, value, x, y) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
      doc.text(label, x, y)
      const lw = doc.getTextWidth(label) + 1.5
      doc.setFont('helvetica', 'normal')
      doc.text(String(value ?? '—'), x + lw, y)
    }

    // ── container info box (2 rows) ────────────────────────────────────────
    const IB_Y = 74
    const IB_H = 16
    doc.setLineWidth(0.3)
    doc.rect(M, IB_Y, CW, IB_H)
    doc.line(M, IB_Y + IB_H / 2, W - M, IB_Y + IB_H / 2)
    const r1 = IB_Y + 5.2
    const r2 = IB_Y + IB_H / 2 + 5.2
    lv('Container No:',     f.containerNo   || sv.ContainerNo || '—', M + 2,   r1)
    lv('Size:',             f.containerSize || sv.ContSize    || '—', M + 55,  r1)
    lv('Type:',             f.containerType || sv.ContType    || '—', M + 85,  r1)
    lv('Document No:',      f.documentNo    || sv.DocumentNo  || '—', M + 115, r1)
    lv('Vehicle No:',       f.vehicleNo     || '—',                   M + 2,   r2)
    lv('Transaction Type:', f.transactionType || '—',                 M + 55,  r2)
    lv('Gate In Date:',     fmt(sv.GateInDate),                       M + 115, r2)

    // ── remarks table (2 columns, rows grow with text) ─────────────────────
    const HALF = CW / 2
    const LH = 3.6
    const remarkRows = [
      [['LeftSide Remark:',      f.leftRemark],        ['RightSide Remark:',        f.rightRemark]],
      [['TopSide Remark:',       f.topRemark],         ['Overall Remark:',          f.overallRemark]],
      [['LeftDamage Remark:',    f.leftDamageRemark],  ['RightDamage Remark:',      f.rightDamageRemark]],
      [['Place of Inspection:',  f.placeOfInspection], ['Survey by/Presence of:',   f.surveyBy || loggedInName]],
    ]
    const measured = remarkRows.map(row => {
      const cells = row.map(([label, value]) => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
        const lw = doc.getTextWidth(label) + 1.5
        doc.setFont('helvetica', 'normal')
        const lines = doc.splitTextToSize(String(value || '—'), HALF - 4 - lw)
        return { label, lw, lines }
      })
      const h = Math.max(...cells.map(c => c.lines.length)) * LH + 3.6
      return { cells, h }
    })
    const RT_Y = IB_Y + IB_H + 6
    const RT_H = measured.reduce((a, r) => a + r.h, 0)
    doc.setLineWidth(0.3)
    doc.rect(M, RT_Y, CW, RT_H)
    doc.line(CX, RT_Y, CX, RT_Y + RT_H)
    let ry = RT_Y
    measured.forEach((row, i) => {
      if (i > 0) doc.line(M, ry, W - M, ry)
      row.cells.forEach((c, ci) => {
        const x = M + ci * HALF + 2
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
        doc.text(c.label, x, ry + 5)
        doc.setFont('helvetica', 'normal')
        c.lines.forEach((ln, li) => doc.text(ln, x + c.lw, ry + 5 + li * LH))
      })
      ry += row.h
    })

    // ── image block: [Left | Right] / [Top (full)] / [Left Dmg | Right Dmg] ─
    const IMG_TOP = RT_Y + RT_H + 5
    const IMG_BOTTOM = H - 34                      // leave room for signature + note
    const availH = Math.max(IMG_BOTTOM - IMG_TOP, 90)
    const h1 = availH * 0.30
    const h2 = availH * 0.40
    const h3 = availH * 0.30
    const cells = [
      { label: 'LEFT SIDE',    url: getImageUrl(sv, 'IMG_LEFT'),  x: M,        y: IMG_TOP,           w: HALF, h: h1 },
      { label: 'RIGHT SIDE',   url: getImageUrl(sv, 'IMG_RIGHT'), x: M + HALF, y: IMG_TOP,           w: HALF, h: h1 },
      { label: 'TOP VIEW',     url: getImageUrl(sv, 'IMG_TOP'),   x: M,        y: IMG_TOP + h1,      w: CW,   h: h2 },
      { label: 'LEFT DAMAGE',  url: getImageUrl(sv, 'Left2'),     x: M,        y: IMG_TOP + h1 + h2, w: HALF, h: h3 },
      { label: 'RIGHT DAMAGE', url: getImageUrl(sv, 'Right2'),    x: M + HALF, y: IMG_TOP + h1 + h2, w: HALF, h: h3 },
    ]
    const LABEL_H = 6
    for (const c of cells) {
      doc.setDrawColor(0, 0, 0)
      doc.setLineWidth(0.3)
      doc.rect(c.x, c.y, c.w, c.h)
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.text(c.label, c.x + 2, c.y + 4)

      const boxX = c.x + 1, boxY = c.y + LABEL_H
      const boxW = c.w - 2, boxH = c.h - LABEL_H - 1
      let drawn = false
      if (c.url) {
        try {
          const { dataUrl, w, h } = await loadImageForPdf(c.url)
          const s = Math.min(boxW / w, boxH / h)
          const dw = w * s, dh = h * s
          doc.addImage(dataUrl, 'JPEG', boxX + (boxW - dw) / 2, boxY + (boxH - dh) / 2, dw, dh, undefined, 'FAST')
          drawn = true
        } catch { /* fall through to placeholder */ }
      }
      if (!drawn) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text('No Image', c.x + c.w / 2, c.y + c.h / 2 + 2, { align: 'center' })
        doc.setTextColor(0, 0, 0)
      }
    }

    // ── signature + note ───────────────────────────────────────────────────
    doc.setLineWidth(0.3)
    doc.line(W - M - 50, H - 24, W - M, H - 24)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text('GDL SURVEYOR', W - M, H - 19.5, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    const noteLabel = 'Issue without Prejudice Note : '
    doc.text(noteLabel, M, H - 11)
    const noteLabelW = doc.getTextWidth(noteLabel)   // measured while bold
    doc.setFont('helvetica', 'normal')
    doc.text(
      'This report will be destroyed after 6 months unless we receive & query from the Applicant for survey',
      M + noteLabelW, H - 11
    )

    doc.save(`esurvey-${sv.ContainerNo || 'report'}-${today.slice(0, 10)}.pdf`)
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
    writeXlsx(wb, `esurvey-${today.slice(0, 10)}.xlsx`)
  }

  // ── WIZARD VIEW ──────────────────────────────────────────────────────────────
  if (activeSurvey) {
    const side   = step < REPORT_STEP ? SIDES[step - 1] : null
    const imgUrl = side ? getImageUrl(activeSurvey, side.imgKey) : null

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
                      {i < STEPS.length - 1 && <div className={`w-4 h-px mx-1 ${done ? 'bg-emerald-400/50' : 'bg-white/10'}`} />}
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

              {/* Steps 1–5: image viewer + remark bar */}
              {step < REPORT_STEP && side && (
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
                    <div className={`absolute top-3 left-3 backdrop-blur border text-white px-3 py-1.5 rounded-full text-[11px] font-bold tracking-widest uppercase pointer-events-none ${
                      side.damage ? 'bg-red-600/70 border-red-300/40' : 'bg-black/60 border-white/20'
                    }`}>{side.name}</div>
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
                        {step === REPORT_STEP - 1 ? 'View Report' : 'Next'} <FiArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 6: report — 2-col layout, no scroll */}
              {step === REPORT_STEP && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                  className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <form id="survey-form" onSubmit={handleSubmit} className="flex-1 min-h-0 flex gap-2 overflow-hidden">

                    {/* ── LEFT: 5 images in a 2-col grid + remarks ── */}
                    <div className="grid grid-cols-2 grid-rows-3 gap-1.5 w-[50%] shrink-0 min-h-0">
                      {SIDES.map(s => {
                        const url = getImageUrl(activeSurvey, s.imgKey)
                        return (
                          <div key={s.key} className="min-h-0 flex flex-col bg-slate-900/80 rounded-xl overflow-hidden ring-1 ring-white/10">
                            {/* image */}
                            <div className="flex-1 min-h-0 relative">
                              <SurveyImg url={url} />
                              <div className={`absolute top-1.5 left-2 backdrop-blur border text-white px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase pointer-events-none ${
                                s.damage ? 'bg-red-600/70 border-red-300/40' : 'bg-black/60 border-white/20'
                              }`}>{s.name}</div>
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
                      <div className="flex-1 min-h-0 p-3 grid grid-cols-2 gap-x-3 gap-y-2 content-start overflow-y-auto">
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
              <input type="datetime-local" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="border-2 border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <FiCalendar className="text-[#0e4a78]" size={11} /> To Date
              </label>
              <input type="datetime-local" value={toDate} onChange={e => setToDate(e.target.value)}
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
                <FilterExportBtn onClick={handleExport} disabled={!surveys.length} />
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
                              {SIDES.map(({ imgKey, short, name, damage }) => (
                                <ThumbBtn key={imgKey} url={getImageUrl(sv, imgKey)} short={short} name={name} damage={damage} />
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToPage(page - 1)}
                    disabled={page === 1}
                    className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${
                      page === 1
                        ? 'text-slate-400 cursor-not-allowed bg-slate-100'
                        : 'text-[#0e4a78] hover:bg-blue-50'
                    }`}
                  >
                    Previous
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">Page</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={page}
                      onChange={(e) => {
                        const pg = Math.max(1, Math.min(totalPages, Number(e.target.value) || 1))
                        goToPage(pg)
                      }}
                      className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-[#0e4a78]"
                    />
                    <span className="text-slate-600">of {totalPages}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => goToPage(page + 1)}
                    disabled={page === totalPages}
                    className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${
                      page === totalPages
                        ? 'text-slate-400 cursor-not-allowed bg-slate-100'
                        : 'text-[#0e4a78] hover:bg-blue-50'
                    }`}
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
    </div>
  )
}