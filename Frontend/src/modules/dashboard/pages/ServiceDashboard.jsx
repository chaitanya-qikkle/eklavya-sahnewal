import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  FiSearch, FiCalendar, FiX, FiZoomIn, FiRefreshCw,
  FiFilter, FiChevronDown, FiMapPin, FiClock, FiCamera,
  FiCheck, FiAlertCircle, FiCheckCircle, FiAlertTriangle,
  FiActivity, FiList, FiPercent, FiEye, FiRotateCcw, FiRotateCw,
  FiDownload,
} from "react-icons/fi";
import Navbar from "../../../components/layout/Navbar";
import {
  useGetEquipmentQuery,
  useLazyGetServiceDashboardQuery,
  useLazySearchContainerQuery,
  useUpdateDeviceDataContainerMutation,
} from "../../../store/api/ymsApi";
import Swal from "sweetalert2";

const AWS_IMAGE_PATH =
  "https://container-datasets.s3.ap-south-1.amazonaws.com/reach-tracker-live-ocr";

// ─── helpers ────────────────────────────────────────────────────────────────
const getField = (row, ...keys) => {
  for (const key of keys) {
    if (row && Object.prototype.hasOwnProperty.call(row, key) && row[key] != null)
      return row[key];
  }
  return null;
};

const formatDateTime = (dtStr) => {
  if (!dtStr || dtStr === "-") return "-";
  const d = new Date(dtStr);
  if (isNaN(d.getTime())) return dtStr;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const isMissingContainer = (row) => {
  const raw = getField(row, "ContNo", "contno", "RFIDDATA", "rfiddata", "OCR_CONTAINER_NO", "ocr_container_no", "CONTAINER_TAG_ID", "container_tag_id");
  const clean = String(raw ?? "").trim().split(" ")[0];
  return clean.replace(/0/g, "") === "" || clean === "-" || clean === "";
};

// ─── Image download helper ───────────────────────────────────────────────────
const downloadImg = async (url, filename = "image.jpg") => {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, "_blank");
  }
};

// ─── Equipment Status Chip ───────────────────────────────────────────────────
const EqpChip = ({ icon, label, value, dot, pulse }) => (
  <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/8 border border-white/10 min-w-0">
    <div className={`shrink-0 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/70 ${pulse ? "animate-pulse" : ""}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-[10px] text-white/45 uppercase tracking-wider font-semibold leading-none mb-0.5">{label}</div>
      <div className="flex items-center gap-1.5">
        {dot && <span className={`w-2 h-2 rounded-full shrink-0 ${pulse ? "animate-pulse" : ""}`} style={{ background: dot }} />}
        <span className="text-lg font-black text-white leading-none">{value}</span>
      </div>
    </div>
  </div>
);

// ─── Accuracy Ring ───────────────────────────────────────────────────────────
const AccRing = ({ pct, size = 64 }) => {
  const num = parseFloat(pct);
  const valid = !isNaN(num);
  const color = !valid ? "#64748b" : num >= 80 ? "#10b981" : num >= 60 ? "#f59e0b" : "#ef4444";
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = valid ? (num / 100) * circ : 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={7} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-black text-white leading-none">
          {valid ? `${num.toFixed(0)}%` : "—"}
        </span>
      </div>
    </div>
  );
};

// ─── Stat Card (kept for any future use, replaced in dashboard) ───────────────
const StatCard = ({ icon, label, value, color, pulse }) => {
  const colors = {
    blue:   "from-blue-600 to-blue-700",
    green:  "from-emerald-500 to-emerald-600",
    red:    "from-red-500 to-red-600",
    orange: "from-orange-500 to-orange-600",
    indigo: "from-indigo-500 to-indigo-600",
    teal:   "from-teal-500 to-teal-600",
    purple: "from-purple-500 to-purple-600",
    amber:  "from-amber-500 to-amber-600",
  };
  return (
    <div className={`relative flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-br ${colors[color]||colors.blue} shadow-md overflow-hidden`}>
      <div className={`shrink-0 w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white text-lg ${pulse?"animate-pulse":""}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/80 leading-tight">{label}</div>
        <div className="text-xl font-black text-white leading-tight mt-0.5 truncate">{value}</div>
      </div>
    </div>
  );
};

// ─── Image Thumbnail ─────────────────────────────────────────────────────────
const ImgThumb = ({ srcs = [], alt, onZoom }) => {
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const key = srcs.join(",");
  useEffect(() => { setIdx(0); setFailed(false); }, [key]);
  const activeSrc = !failed ? (srcs[idx] || null) : null;
  const handleError = () => {
    if (idx < srcs.length - 1) { setIdx((i) => i + 1); }
    else { setFailed(true); }
  };
  return (
    <div
      className="relative w-full aspect-video bg-slate-800 rounded-lg overflow-hidden cursor-pointer group border border-white/10 hover:border-white/30 transition-all"
      onClick={() => activeSrc && onZoom(srcs, idx)}
    >
      {!activeSrc ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-500">
          <FiCamera className="w-5 h-5" />
          <span className="text-[10px]">No Image</span>
        </div>
      ) : (
        <>
          <img
            src={activeSrc}
            alt={alt}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            onError={handleError}
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
              <FiZoomIn className="text-white w-4 h-4" />
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); downloadImg(activeSrc, `cam_frame${idx + 1}.jpg`); }}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 transition-colors"
              title="Download image"
            >
              <FiDownload className="text-white w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Modal Image with cascading fallback + flip ───────────────────────────────
const ModalImg = ({ label, srcs = [], flipped, onFlip, onZoom }) => {
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const key = srcs.join(",");
  useEffect(() => { setIdx(0); setFailed(false); }, [key]);
  const activeSrc = !failed ? (srcs[idx] || null) : null;
  const handleError = () => {
    if (idx < srcs.length - 1) { setIdx((i) => i + 1); }
    else { setFailed(true); }
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
          <FiCamera className="w-3 h-3" />{label}
        </div>
        {activeSrc && (
          <button
            type="button"
            onClick={onFlip}
            title="Flip image 180°"
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition-colors
              ${flipped ? "bg-[#0e4a78] text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}
          >
            <span className="text-base">↕</span> Flip
          </button>
        )}
      </div>
      <div
        className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 cursor-pointer group relative"
        style={{ height: "160px" }}
        onClick={() => activeSrc && onZoom(srcs, idx)}
      >
        {activeSrc ? (
          <>
            <img
              src={activeSrc}
              alt={label}
              className="w-full h-full object-cover transition-all duration-300"
              style={{ transform: flipped ? "rotate(180deg)" : "none", transformOrigin: "center center" }}
              onError={handleError}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <FiZoomIn className="text-white w-6 h-6" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-500">
            <FiCamera className="w-5 h-5" />
            <span className="text-[10px]">No Image</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Transaction Card ────────────────────────────────────────────────────────
const TransactionCard = ({
  row, onUpdate, searchContainer,
}) => {
  const [contNo, setContNo] = useState(() => {
    const raw = getField(row, "ContNo", "contno", "RFIDDATA", "rfiddata", "OCR_CONTAINER_NO", "ocr_container_no", "CONTAINER_TAG_ID", "container_tag_id") ?? "";
    const clean = String(raw).split(" ")[0];
    return clean === "00000000000" || clean.startsWith("0000000") ? "" : clean;
  });
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zoomState, setZoomState] = useState(null); // { srcs: [], idx: number }
  const [showModal, setShowModal] = useState(false);
  const [modalContNo, setModalContNo] = useState(contNo);
  const [modalSuggestions, setModalSuggestions] = useState([]);
  const [modalShowSug, setModalShowSug] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [imgFlipped, setImgFlipped] = useState([false, false]);
  const [zoomedFlipped, setZoomedFlipped] = useState(false);
  const inputRef = useRef(null);
  const modalInputRef = useRef(null);
  const modalOverlayRef = useRef(null);

  const toggleFlip = (idx) => setImgFlipped(prev => prev.map((f, i) => i === idx ? !f : f));
  const openZoom = (srcs, startIdx = 0) => { setZoomState({ srcs, idx: startIdx }); setZoomedFlipped(false); };

  const machine = getField(row, "DeviceID", "deviceid", "EqpName", "eqpname") ?? "-";
  const location = getField(row, "Location", "location", "LOCATION", "BLOCK_NAME", "block_name") ?? "-";
  const dateTime = formatDateTime(getField(row, "TransDate", "transdate", "DATE_TIME", "date_time"));
  const transId = getField(row, "EqpTransID", "eqptransid", "Sr_No", "SR_NO", "sr_no", "TRANSACTION_ID", "transaction_id");

  // Backend builds CameraImage1/2/3 as <DeviceID>_<ddMMyyyyHHmmss>_camN_1.jpg,
  // but the actually-captured frame varies (_1/_2/_3) — try all three.
  const cam1Base = row.CameraImage1?.trim() || row.cameraimage1?.trim() || "";
  const cam2Base = row.CameraImage2?.trim() || row.cameraimage2?.trim() || "";
  const cam1Srcs = cam1Base ? [
    `${AWS_IMAGE_PATH}/${cam1Base}`,
    `${AWS_IMAGE_PATH}/${cam1Base.replace(/_cam1_1\.jpg$/i, "_cam1_2.jpg")}`,
    `${AWS_IMAGE_PATH}/${cam1Base.replace(/_cam1_1\.jpg$/i, "_cam1_3.jpg")}`,
  ] : [];
  const cam2Srcs = cam2Base ? [
    `${AWS_IMAGE_PATH}/${cam2Base}`,
    `${AWS_IMAGE_PATH}/${cam2Base.replace(/_cam2_1\.jpg$/i, "_cam2_2.jpg")}`,
    `${AWS_IMAGE_PATH}/${cam2Base.replace(/_cam2_1\.jpg$/i, "_cam2_3.jpg")}`,
  ] : [];

  const handleChange = async (e) => {
    const cur = e.target.selectionStart;
    const val = e.target.value.toUpperCase();
    if (val.length > 11) return;
    setContNo(val);
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(cur, cur);
    });
    if (val.length >= 1) {
      try {
        const res = await searchContainer(val).unwrap();
        setSuggestions(res?.data || res || []);
        setShowSug(true);
      } catch {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
      setShowSug(false);
    }
  };

  const selectSug = (c) => {
    const no = typeof c === "string" ? c : c?.Cont_No || c?.cont_no || c?.CONTAINER_NO || c?.container_no || "";
    setContNo(no);
    setShowSug(false);
  };

  const handleSave = async () => {
    if (!contNo || contNo.trim() === "") {
      Swal.fire("Warning", "Please enter a container number.", "warning"); return;
    }
    if (contNo.length !== 11) {
      Swal.fire("Warning", "Container number must be exactly 11 characters.", "warning"); return;
    }
    if (!transId) {
      Swal.fire("Error", "Transaction ID not found.", "error"); return;
    }
    setSaving(true);
    try {
      const res = await onUpdate({ eqp_trans_id: parseInt(transId), cont_no: contNo }, row);
      if (res?.error) throw res.error;
      Swal.fire({ icon: "success", title: "Updated", text: res?.data?.message || "Container updated.", timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err?.data?.message || err?.data?.detail || "Failed to update container.", "error");
    } finally {
      setSaving(false);
    }
  };

  const openModal = () => {
    setModalContNo(contNo);
    setModalSuggestions([]);
    setModalShowSug(false);
    setShowModal(true);
    setTimeout(() => modalInputRef.current?.focus(), 50);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalShowSug(false);
  };

  const handleModalOverlayClick = (e) => {
    if (e.target === modalOverlayRef.current) closeModal();
  };

  const handleModalChange = async (e) => {
    const cur = e.target.selectionStart;
    const val = e.target.value.toUpperCase();
    if (val.length > 11) return;
    setModalContNo(val);
    requestAnimationFrame(() => {
      modalInputRef.current?.setSelectionRange(cur, cur);
    });
    if (val.length >= 1) {
      try {
        const res = await searchContainer(val).unwrap();
        setModalSuggestions(res?.data || res || []);
        setModalShowSug(true);
      } catch {
        setModalSuggestions([]);
      }
    } else {
      setModalSuggestions([]);
      setModalShowSug(false);
    }
  };

  const selectModalSug = (c) => {
    const no = typeof c === "string" ? c : c?.Cont_No || c?.cont_no || c?.CONTAINER_NO || c?.container_no || "";
    setModalContNo(no);
    setModalShowSug(false);
  };

  const handleModalSave = async () => {
    if (!modalContNo || modalContNo.trim() === "") {
      Swal.fire("Warning", "Please enter a container number.", "warning"); return;
    }
    if (modalContNo.length !== 11) {
      Swal.fire("Warning", "Container number must be exactly 11 characters.", "warning"); return;
    }
    if (!transId) {
      Swal.fire("Error", "Transaction ID not found.", "error"); return;
    }
    setModalSaving(true);
    try {
      const res = await onUpdate({ eqp_trans_id: parseInt(transId), cont_no: modalContNo }, row);
      if (res?.error) throw res.error;
      setContNo(modalContNo);
      closeModal();
      Swal.fire({ icon: "success", title: "Updated", text: res?.data?.message || "Container updated.", timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err?.data?.message || err?.data?.detail || "Failed to update container.", "error");
    } finally {
      setModalSaving(false);
    }
  };

  const isComplete = contNo.length === 11;
  const isPartial  = contNo.length > 0 && contNo.length < 11;
  const modalIsComplete = modalContNo.length === 11;
  const modalIsPartial  = modalContNo.length > 0 && modalContNo.length < 11;

  return (
    <>
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col overflow-visible hover:shadow-lg transition-shadow">
        {/* Card Header */}
        <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] rounded-t-2xl px-3.5 py-2.5 flex items-center justify-between gap-2">
          <span className="text-white font-black text-sm md:text-base tracking-wide">{machine}</span>
          <div className="flex items-center gap-3 text-white/75 text-[10px] md:text-xs font-medium min-w-0 shrink-0">
            <span className="flex items-center gap-1 truncate">
              <FiMapPin className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[80px] md:max-w-[120px]">{location}</span>
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <FiClock className="w-3 h-3 shrink-0" />
              {dateTime}
            </span>
          </div>
        </div>

        {/* Images */}
        <div className="p-3 grid grid-cols-2 gap-2">
          <ImgThumb srcs={cam1Srcs} alt="Camera 1" onZoom={openZoom} />
          <ImgThumb srcs={cam2Srcs} alt="Camera 2" onZoom={openZoom} />
        </div>

        {/* Update Section */}
        <div className="px-3 pb-3 relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={contNo}
                onChange={handleChange}
                onFocus={() => { openModal(); }}
                onBlur={() => setTimeout(() => setShowSug(false), 150)}
                maxLength={11}
                placeholder="CONTAINER NO"
                readOnly
                className={`w-full px-3 py-2 rounded-lg border-2 text-sm font-bold tracking-wider uppercase focus:outline-none transition-all text-slate-800 cursor-pointer
                  ${isComplete ? "border-emerald-400 bg-emerald-50 focus:border-emerald-500" :
                    isPartial  ? "border-amber-400 bg-amber-50 focus:border-amber-500" :
                                 "border-slate-300 bg-white focus:border-[#0e4a78]"}`}
              />
              {/* Suggestions */}
              {showSug && suggestions.length > 0 && (
                <ul className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-40 overflow-y-auto">
                  {suggestions.map((c, i) => {
                    const val = typeof c === "string" ? c : c?.Cont_No || c?.cont_no || c?.CONTAINER_NO || c?.container_no || "";
                    const loc = typeof c === "object" ? c?.Last_Loc || c?.last_loc || c?.LAST_LOCATION_NAME || "" : "";
                    return (
                      <li
                        key={i}
                        onMouseDown={() => selectSug(c)}
                        className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-[#0e4a78]/5 cursor-pointer border-b border-slate-100 last:border-0"
                      >
                        <span className="text-sm font-bold font-mono text-slate-800">{val}</span>
                        {loc && <span className="text-xs text-slate-400 shrink-0">{loc}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !isComplete}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm
                ${isComplete && !saving
                  ? "bg-[#0e4a78] hover:bg-[#0b3b60] text-white"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
            >
              {saving ? (
                <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FiCheck className="w-3.5 h-3.5" />
              )}
              Update
            </button>
          </div>

          {isPartial && (
            <p className="text-[10px] text-amber-600 mt-1 font-medium">{contNo.length}/11 chars</p>
          )}
        </div>
      </div>

      {/* Zoom Modal */}
      {zoomState && (() => {
        const zSrcs = zoomState.srcs;
        const zIdx  = zoomState.idx;
        const zSrc  = zSrcs[zIdx] || null;
        const hasPrev = zIdx > 0;
        const hasNext = zIdx < zSrcs.length - 1;
        const goTo = (i) => { setZoomState({ srcs: zSrcs, idx: i }); setZoomedFlipped(false); };
        return (
        <div
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex flex-col items-center p-4 overflow-y-auto"
          onClick={() => setZoomState(null)}
        >
          {/* Top bar: Flip + Download + frame indicator + Close */}
          <div className="sticky top-0 w-full max-w-3xl flex items-center justify-between z-10 mb-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomedFlipped(f => !f)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors
                  ${zoomedFlipped ? "bg-[#0e4a78] text-white" : "bg-white/15 hover:bg-white/25 text-white"}`}
              >
                <span className="text-base">↕</span> Flip
              </button>
              {zSrc && (
                <button
                  type="button"
                  onClick={() => downloadImg(zSrc, `${machine}_frame${zIdx + 1}.jpg`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-white/15 hover:bg-white/25 text-white transition-colors"
                >
                  <FiDownload className="w-4 h-4" /> Download
                </button>
              )}
            </div>
            {zSrcs.length > 1 && (
              <span className="text-white/50 text-xs font-semibold">
                Frame {zIdx + 1} / {zSrcs.length}
              </span>
            )}
            <button
              className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-colors"
              onClick={() => setZoomState(null)}
            >
              <FiX size={22} />
            </button>
          </div>

          {/* Image + Prev/Next overlay */}
          <div className="relative shrink-0 w-full max-w-3xl flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* Prev button */}
            {hasPrev && (
              <button
                onClick={() => goTo(zIdx - 1)}
                className="absolute left-0 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-black/50 hover:bg-[#0e4a78] text-white transition-colors shadow-lg"
                title="Previous frame"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
            )}

            {zSrc ? (
              <img
                src={zSrc}
                className="max-w-full object-contain rounded-xl shadow-2xl transition-all duration-300"
                style={{ maxHeight: "50vh", transform: zoomedFlipped ? "rotate(180deg)" : "none" }}
                alt="Zoomed"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-white/40 py-16">
                <FiCamera className="w-10 h-10" />
                <span className="text-sm">No Image</span>
              </div>
            )}

            {/* Next button */}
            {hasNext && (
              <button
                onClick={() => goTo(zIdx + 1)}
                className="absolute right-0 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-black/50 hover:bg-[#0e4a78] text-white transition-colors shadow-lg"
                title="Next frame"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            )}
          </div>

          {/* Frame dots */}
          {zSrcs.length > 1 && (
            <div className="flex items-center gap-2 mt-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              {zSrcs.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${i === zIdx ? "bg-white scale-125" : "bg-white/30 hover:bg-white/60"}`}
                />
              ))}
            </div>
          )}

          {/* Container input below image */}
          <div
            className="mt-3 w-full max-w-lg shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <input
                type="text"
                value={modalContNo}
                onChange={handleModalChange}
                onBlur={() => setTimeout(() => setModalShowSug(false), 150)}
                maxLength={11}
                placeholder="ENTER CONTAINER NO"
                className={`w-full px-4 py-4 rounded-xl border-2 text-2xl font-black tracking-widest uppercase focus:outline-none transition-all text-slate-800 text-center
                  ${modalIsComplete ? "border-emerald-400 bg-emerald-50 focus:border-emerald-500" :
                    modalIsPartial  ? "border-amber-400 bg-amber-50 focus:border-amber-500" :
                                      "border-white/30 bg-white focus:border-white"}`}
              />
              {modalIsPartial && (
                <span className="absolute bottom-2 right-3 text-[11px] text-amber-500 font-bold">{modalContNo.length}/11</span>
              )}
              {modalIsComplete && (
                <span className="absolute bottom-2 right-3 text-[11px] text-emerald-500 font-bold flex items-center gap-0.5">
                  <FiCheck className="w-3.5 h-3.5" />11/11
                </span>
              )}
              {/* Suggestions — opens upward in zoom modal */}
              {modalShowSug && modalSuggestions.length > 0 && (
                <ul className="absolute bottom-full mb-1 left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                  {modalSuggestions.map((c, i) => {
                    const val = typeof c === "string" ? c : c?.Cont_No || c?.cont_no || c?.CONTAINER_NO || c?.container_no || "";
                    const loc = typeof c === "object" ? c?.Last_Loc || c?.last_loc || c?.LAST_LOCATION_NAME || "" : "";
                    return (
                      <li
                        key={i}
                        onMouseDown={() => selectModalSug(c)}
                        className="px-4 py-3 flex items-center justify-between gap-2 hover:bg-[#0e4a78]/5 cursor-pointer border-b border-slate-100 last:border-0"
                      >
                        <span className="text-base font-black font-mono text-slate-800">{val}</span>
                        {loc && <span className="text-xs text-slate-400 shrink-0">{loc}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <button
              onClick={handleModalSave}
              disabled={modalSaving || !modalIsComplete}
              className={`w-full mt-2 flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-black tracking-wide transition-all shadow-md
                ${modalIsComplete && !modalSaving
                  ? "bg-[#0e4a78] hover:bg-[#0b3b60] text-white"
                  : "bg-white/20 text-white/40 cursor-not-allowed"}`}
            >
              {modalSaving ? (
                <><FiRefreshCw className="w-5 h-5 animate-spin" />Updating…</>
              ) : (
                <><FiCheck className="w-5 h-5" />Update Container</>
              )}
            </button>
          </div>
        </div>
        );
      })()}

      {/* Container Update Modal */}
      {showModal && (
        <div
          ref={modalOverlayRef}
          className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-sm flex items-start justify-center pt-4 px-4 pb-4"
          onClick={handleModalOverlayClick}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto overflow-y-auto max-h-[96vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-5 py-3.5 flex items-center justify-between">
              <div>
                <div className="text-white font-black text-base tracking-wide">{machine}</div>
                <div className="text-white/55 text-[11px] mt-0.5 flex items-center gap-1.5">
                  <FiMapPin className="w-3 h-3" />{location}
                  <span className="mx-1">·</span>
                  <FiClock className="w-3 h-3" />{dateTime}
                </div>
              </div>
              <button
                onClick={closeModal}
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="p-3 space-y-2">
              {/* Images — stacked on mobile, side-by-side on desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[cam1Srcs, cam2Srcs].map((srcs, idx) => {
                  const label = idx === 0 ? "Cam 1" : "Cam 2";
                  return (
                    <ModalImg
                      key={label}
                      label={label}
                      srcs={srcs}
                      flipped={imgFlipped[idx]}
                      onFlip={() => toggleFlip(idx)}
                      onZoom={openZoom}
                    />
                  );
                })}
              </div>

              {/* Input */}
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Container Number</label>
                <input
                  ref={modalInputRef}
                  type="text"
                  value={modalContNo}
                  onChange={handleModalChange}
                  onBlur={() => setTimeout(() => setModalShowSug(false), 150)}
                  maxLength={11}
                  placeholder="ENTER CONTAINER NO"
                  className={`w-full px-4 py-3 rounded-xl border-2 text-xl font-black tracking-widest uppercase focus:outline-none transition-all text-slate-800 text-center
                    ${modalIsComplete ? "border-emerald-400 bg-emerald-50 focus:border-emerald-500" :
                      modalIsPartial  ? "border-amber-400 bg-amber-50 focus:border-amber-500" :
                                        "border-slate-300 bg-slate-50 focus:border-[#0e4a78] focus:bg-white"}`}
                />
                {modalIsPartial && (
                  <span className="absolute bottom-2 right-3 text-[11px] text-amber-500 font-bold">{modalContNo.length}/11</span>
                )}
                {modalIsComplete && (
                  <span className="absolute bottom-2 right-3 text-[11px] text-emerald-500 font-bold flex items-center gap-0.5">
                    <FiCheck className="w-3.5 h-3.5" />11/11
                  </span>
                )}
                {modalShowSug && modalSuggestions.length > 0 && (
                  <ul className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-44 overflow-y-auto">
                    {modalSuggestions.map((c, i) => {
                      const val = typeof c === "string" ? c : c?.Cont_No || c?.cont_no || c?.CONTAINER_NO || c?.container_no || "";
                      const loc = typeof c === "object" ? c?.Last_Loc || c?.last_loc || c?.LAST_LOCATION_NAME || "" : "";
                      return (
                        <li
                          key={i}
                          onMouseDown={() => selectModalSug(c)}
                          className="px-4 py-3 flex items-center justify-between gap-2 hover:bg-[#0e4a78]/5 cursor-pointer border-b border-slate-100 last:border-0"
                        >
                          <span className="text-base font-black font-mono text-slate-800">{val}</span>
                          {loc && <span className="text-xs text-slate-400 shrink-0">{loc}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <button
                onClick={handleModalSave}
                disabled={modalSaving || !modalIsComplete}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-base font-black tracking-wide transition-all shadow-md
                  ${modalIsComplete && !modalSaving
                    ? "bg-[#0e4a78] hover:bg-[#0b3b60] text-white"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
              >
                {modalSaving ? (
                  <><FiRefreshCw className="w-5 h-5 animate-spin" />Updating…</>
                ) : (
                  <><FiCheck className="w-5 h-5" />Update Container</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────
const ServiceDashboard = () => {
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [searchMachine, setSearchMachine]     = useState("");
  const [showMachineDD, setShowMachineDD]     = useState(false);
  const [fromDate, setFromDate]               = useState("");
  const [toDate, setToDate]                   = useState("");
  const [rows, setRows]                       = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState("");
  const [hasSearched, setHasSearched]         = useState(false);
  const [searchCards, setSearchCards]         = useState("");
  const [removedIds, setRemovedIds]           = useState(new Set());
  const [activeTab, setActiveTab]             = useState("missing");
  const ddRef = useRef(null);

  const { data: equipmentApi } = useGetEquipmentQuery(undefined, {
    pollingInterval: 15000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const [fetchReport, { data: reportData, isLoading: reportLoading, isError: reportIsError, error: reportError }] =
    useLazyGetServiceDashboardQuery();

  // Fixed query shares the same endpoint; stats come from the SP directly
  const [fetchFixed, { data: fixedData }] = useLazyGetServiceDashboardQuery();
  const [fixedRows, setFixedRows] = useState([]);
  useEffect(() => {
    setFixedRows(Array.isArray(fixedData?.data) ? fixedData.data : []);
  }, [fixedData]);

  const [searchContainerQuery] = useLazySearchContainerQuery();
  const [updateDeviceContainer] = useUpdateDeviceDataContainerMutation();

  // Sync RTK state → local state
  useEffect(() => {
    setRows(Array.isArray(reportData?.data) ? reportData.data : []);
    setLoading(!!reportLoading);
    if (reportIsError) {
      const msg = reportError?.data?.message || reportError?.data?.detail || reportError?.error || "Error fetching data";
      setError(String(msg));
    } else {
      setError("");
    }
  }, [reportData, reportLoading, reportIsError, reportError]);

  // Equipment list
  const allMachines = useMemo(() => {
    const list = Array.isArray(equipmentApi?.data) ? equipmentApi.data : [];
    return list.map((item, i) => {
      const name =
        item?.Equipment_Code ?? item?.equipment_code ?? item?.EQUIPMENT_CODE ??
        item?.Equipment_Name ?? item?.equipment_name ?? item?.EQUIPMENT_NAME ?? `EQP-${i + 1}`;
      const deviceId = item?.Device_ID ?? item?.device_id ?? item?.DEVICE_ID ?? null;
      const status = String(item?.Status ?? item?.status ?? item?.STATUS ?? "").toLowerCase();
      const isActive = status === "active" || status === "1" || status === "";
      const isBreakdown = status === "breakdown" || status === "break" || status === "fault";
      const cleanName = String(name).trim();
      if (!cleanName) return null;
      const cleanDeviceId = String(deviceId ?? "").trim();
      // Send Device_ID to API — backend maps it to Equipment_Name before SP call
      return { id: item?.Eqp_ID ?? item?.eqp_id ?? i + 1, name: cleanName, deviceId: cleanDeviceId || cleanName, isActive, isBreakdown };
    }).filter(Boolean);
  }, [equipmentApi]);

  const filteredMachines = allMachines.filter((m) =>
    m.name.toLowerCase().includes(searchMachine.toLowerCase())
  );

  const toggleMachine = (id) =>
    setSelectedMachines((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const selectAll = () =>
    setSelectedMachines(
      selectedMachines.length === allMachines.length ? [] : allMachines.map((m) => m.deviceId)
    );

  // Stats from equipment list
  const stats = useMemo(() => {
    const total     = allMachines.length;
    const active    = allMachines.filter((m) => m.isActive && !m.isBreakdown).length;
    const inactive  = total - active - allMachines.filter((m) => m.isBreakdown).length;
    const breakdown = allMachines.filter((m) => m.isBreakdown).length;
    return { total, active, inactive: Math.max(inactive, 0), breakdown };
  }, [allMachines]);

  // Stats from SP (accurate counts) + row-level breakdown
  const reportStats = useMemo(() => {
    const empty = { total: 0, missing: 0, nonMissing: 0, accuracyPct: null, last24Missing: 0, last24NonMissing: 0, last24AccPct: null, byMachine: {}, peakHour: null, peakHourCount: 0 };

    // All stats derived from GET_DEVICE_LOCK_REPORT rows
    const missing        = rows.filter(isMissingContainer).length;
    const nonMissing     = rows.length - missing;
    const total          = rows.length;
    const accuracyPct    = total > 0 ? (nonMissing / total) * 100 : null;
    const last24Missing    = fixedRows.filter(isMissingContainer).length;
    const last24NonMissing = fixedRows.length - last24Missing;
    const last24AccPct     = fixedRows.length > 0 ? (last24NonMissing / fixedRows.length) * 100 : null;

    // Per-machine breakdown from all rows
    const byMachine = {};
    rows.forEach((r) => {
      const m = getField(r, "DeviceID", "deviceid", "EqpName", "eqpname") ?? "Unknown";
      if (!byMachine[m]) byMachine[m] = { total: 0, missing: 0 };
      byMachine[m].total++;
      if (isMissingContainer(r)) byMachine[m].missing++;
    });

    // Peak hour from missing rows
    const hourBuckets = {};
    rows.forEach((r) => {
      const dt = getField(r, "TransDate", "transdate", "DATE_TIME", "date_time");
      if (!dt) return;
      const h = new Date(dt).getHours();
      hourBuckets[h] = (hourBuckets[h] || 0) + 1;
    });
    let peakHour = null, peakHourCount = 0;
    Object.entries(hourBuckets).forEach(([h, c]) => { if (c > peakHourCount) { peakHour = Number(h); peakHourCount = c; } });

    if (!rows.length) return empty;
    return { total, missing, nonMissing, accuracyPct, last24Missing, last24NonMissing, last24AccPct, byMachine, peakHour, peakHourCount };
  }, [rows, fixedRows]);

  const doFetch = useCallback((machines, fDate, tDate) => {
    setRemovedIds(new Set());
    fetchReport({
      equipment_names: machines.join(",") || undefined,
      from_date: fDate || undefined,
      to_date: tDate || undefined,
    });
    setHasSearched(true);
  }, [fetchReport]);

  // Compute default 9AM→9AM dates once and store in a ref so both effects share them
  const defaultDates = useRef((() => {
    const pad = (n) => String(n).padStart(2, "0");
    const toLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const now = new Date();
    const todayAt9 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
    const yesterdayAt9 = new Date(todayAt9.getTime() - 24 * 60 * 60 * 1000);
    return { from: toLocal(yesterdayAt9), to: toLocal(todayAt9) };
  })());

  // Set date inputs on mount
  useEffect(() => {
    setFromDate(defaultDates.current.from);
    setToDate(defaultDates.current.to);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once machines load, select all and do the ONE initial fetch with correct dates + machine IDs
  const hasAutoSelected = useRef(false);
  useEffect(() => {
    if (!hasAutoSelected.current && allMachines.length > 0) {
      hasAutoSelected.current = true;
      const ids = allMachines.map((m) => m.deviceId);
      setSelectedMachines(ids);
      doFetch(ids, defaultDates.current.from, defaultDates.current.to);
      // Fixed 24hr fetch — always yesterday 9AM → today 9AM, never changes
      fetchFixed({
        equipment_names: ids.join(",") || undefined,
        from_date: defaultDates.current.from,
        to_date: defaultDates.current.to,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMachines]);

  const handleSearch = () => {
    doFetch(selectedMachines, fromDate, toDate);
  };

  const handleClear = () => {
    const pad = (n) => String(n).padStart(2, "0");
    const toLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const now = new Date();
    const todayAt9 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
    const yesterdayAt9 = new Date(todayAt9.getTime() - 24 * 60 * 60 * 1000);
    const from = toLocal(yesterdayAt9);
    const to   = toLocal(todayAt9);

    setFromDate(from);
    setToDate(to);
    setSelectedMachines(allMachines.map((m) => m.deviceId)); setSearchMachine("");
    setSearchCards("");
    doFetch([], from, to);
  };

  const handleUpdateContainer = async (payload, row) => {
    const res = await updateDeviceContainer(payload);
    if (!res?.error) {
      const tid = String(payload.eqp_trans_id);
      setRemovedIds((prev) => new Set([...prev, tid]));
    }
    return res;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) {
        setShowMachineDD(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  // Filter cards — exclude already-updated rows (removedIds persists across RTK re-syncs)
  const displayRows = useMemo(() => {
    const isVisible = (r) => {
      if (!isMissingContainer(r)) return false;
      const id = getField(r, "EqpTransID", "eqptransid", "Sr_No", "SR_NO", "sr_no", "TRANSACTION_ID", "transaction_id");
      if (id != null && removedIds.has(String(id))) return false;
      return true;
    };
    const filtered = !searchCards.trim()
      ? rows.filter(isVisible)
      : rows.filter((r) =>
          isVisible(r) &&
          Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(searchCards.toLowerCase()))
        );
    return [...filtered].sort((a, b) => {
      const da = new Date(getField(a, "TransDate", "transdate", "DATE_TIME", "date_time") || 0);
      const db = new Date(getField(b, "TransDate", "transdate", "DATE_TIME", "date_time") || 0);
      return db - da;
    });
  }, [rows, searchCards, removedIds]);

  // Non-missing rows — OCR-read containers for cross-check & update
  const displayNonMissingRows = useMemo(() => {
    const isVisible = (r) => {
      if (isMissingContainer(r)) return false;
      const id = getField(r, "EqpTransID", "eqptransid", "Sr_No", "SR_NO", "sr_no", "TRANSACTION_ID", "transaction_id");
      if (id != null && removedIds.has(String(id))) return false;
      return true;
    };
    const filtered = !searchCards.trim()
      ? rows.filter(isVisible)
      : rows.filter((r) =>
          isVisible(r) &&
          Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(searchCards.toLowerCase()))
        );
    return [...filtered].sort((a, b) => {
      const da = new Date(getField(a, "TransDate", "transdate", "DATE_TIME", "date_time") || 0);
      const db = new Date(getField(b, "TransDate", "transdate", "DATE_TIME", "date_time") || 0);
      return db - da;
    });
  }, [rows, searchCards, removedIds]);

  return (
    <div
      className="w-full min-h-screen bg-cover bg-center bg-fixed"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      <div className="absolute inset-0 bg-[#050c19]/70 pointer-events-none" aria-hidden />

      <div className="relative z-10 min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1 px-3 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">

          {/* ── Page Title ─────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                Service Dashboard
              </h1>
              <p className="text-white/50 text-xs md:text-sm mt-0.5">
                Missed transactions — review &amp; update container numbers
              </p>
            </div>
            <button
              onClick={handleSearch}
              title="Refresh"
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <FiRefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* ── Stats Panel ──────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: "linear-gradient(160deg,#0d2d4e 0%,#0a2240 50%,#061628 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>

            {/* Top strip — fleet status */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.2)" }}>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Fleet Status</span>
                {[
                  { label: "Total",     val: stats.total,     color: "#60a5fa" },
                  { label: "Active",    val: stats.active,    color: "#4ade80" },
                  { label: "Inactive",  val: stats.inactive,  color: "#fbbf24" },
                  { label: "Breakdown", val: stats.breakdown, color: "#f87171", pulse: stats.breakdown > 0 },
                ].map(({ label, val, color, pulse }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${pulse ? "animate-pulse" : ""}`} style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                    <span className="text-white/40 text-[11px]">{label}</span>
                    <span className="text-white font-bold text-[11px]">{val}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                {loading && <span className="flex items-center gap-1 text-white/40 text-[11px]"><FiRefreshCw className="w-3 h-3 animate-spin" />Loading…</span>}
                {(fromDate || toDate) && (
                  <span className="text-white/30 text-[11px] hidden sm:block">
                    {fromDate?.replace("T", " ")} → {toDate?.replace("T", " ")}
                  </span>
                )}
              </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4">

              {/* Total Transactions */}
              <div className="px-5 py-5 flex flex-col gap-3" style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.25)" }}>
                    <FiActivity className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white/40" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    Transactions
                  </span>
                </div>
                <div>
                  <div className="text-4xl font-black leading-none text-white">
                    {loading ? <span className="text-white/20">···</span> : reportStats.total.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-white/40 font-medium mt-1">Total Transactions</div>
                </div>
                <div className="flex items-center gap-3 mt-auto">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 5px #4ade80" }} />
                    <span className="text-[11px] text-white/40">OCR</span>
                    <span className="text-[12px] font-bold text-emerald-400">{loading ? "—" : reportStats.nonMissing}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: "#f87171", boxShadow: "0 0 5px #f87171" }} />
                    <span className="text-[11px] text-white/40">Missing</span>
                    <span className="text-[12px] font-bold" style={{ color: "#f87171" }}>{loading ? "—" : reportStats.missing}</span>
                  </div>
                </div>
              </div>

              {/* OCR Accuracy — changes with filter */}
              <div className="px-5 py-5 flex flex-col gap-3" style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.25)" }}>
                    <FiPercent className="w-4 h-4 text-violet-400" />
                  </div>
                  {!loading && reportStats.accuracyPct !== null ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                      background: reportStats.accuracyPct >= 80 ? "rgba(74,222,128,0.15)" : reportStats.accuracyPct >= 60 ? "rgba(251,191,36,0.15)" : "rgba(248,113,113,0.15)",
                      color: reportStats.accuracyPct >= 80 ? "#4ade80" : reportStats.accuracyPct >= 60 ? "#fbbf24" : "#f87171",
                      border: `1px solid ${reportStats.accuracyPct >= 80 ? "rgba(74,222,128,0.3)" : reportStats.accuracyPct >= 60 ? "rgba(251,191,36,0.3)" : "rgba(248,113,113,0.3)"}`,
                    }}>
                      {reportStats.accuracyPct >= 80 ? "Good" : reportStats.accuracyPct >= 60 ? "Moderate" : "Critical"}
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full text-white/30" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>Filter Range</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-4xl font-black leading-none text-white">
                      {loading ? <span className="text-white/20">···</span> : reportStats.accuracyPct !== null ? `${reportStats.accuracyPct.toFixed(1)}%` : "—"}
                    </div>
                    <div className="text-[11px] text-white/40 font-medium mt-1">OCR Accuracy</div>
                  </div>
                  <div className="ml-auto">
                    <AccRing pct={reportStats.accuracyPct} size={60} />
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden mt-auto" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{
                    width: loading || reportStats.accuracyPct === null ? "0%" : `${reportStats.accuracyPct}%`,
                    background: reportStats.accuracyPct !== null && reportStats.accuracyPct >= 80 ? "linear-gradient(90deg,#10b981,#4ade80)" : reportStats.accuracyPct !== null && reportStats.accuracyPct >= 60 ? "linear-gradient(90deg,#d97706,#fbbf24)" : "linear-gradient(90deg,#dc2626,#f87171)",
                  }} />
                </div>
              </div>

              {/* Last 24hr Accuracy — fixed 9AM→9AM */}
              <div className="px-5 py-5 flex flex-col gap-3" style={{ borderRight: "1px solid rgba(255,255,255,0.07)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.25)" }}>
                    <FiClock className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", color: "rgba(251,191,36,0.7)" }}>9AM → 9AM</span>
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-4xl font-black leading-none text-white">
                      {reportStats.last24AccPct !== null ? `${reportStats.last24AccPct.toFixed(1)}%` : <span className="text-white/20">—</span>}
                    </div>
                    <div className="text-[11px] text-white/40 font-medium mt-1">Last 24hr Accuracy</div>
                  </div>
                  <div className="ml-auto">
                    <AccRing pct={reportStats.last24AccPct} size={60} />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-auto">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 5px #4ade80" }} />
                    <span className="text-[11px] text-white/40">OCR</span>
                    <span className="text-[12px] font-bold text-emerald-400">{fixedRows.length > 0 ? reportStats.last24NonMissing : "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: "#f87171", boxShadow: "0 0 5px #f87171" }} />
                    <span className="text-[11px] text-white/40">Missing</span>
                    <span className="text-[12px] font-bold" style={{ color: "#f87171" }}>{fixedRows.length > 0 ? reportStats.last24Missing : "—"}</span>
                  </div>
                </div>
              </div>

              {/* By Machine */}
              <div className="px-5 py-5 flex flex-col gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.25)" }}>
                    <FiMapPin className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white/30" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>By Machine</span>
                </div>
                {loading ? (
                  <div className="text-white/20 text-xl font-black">···</div>
                ) : Object.keys(reportStats.byMachine).length === 0 ? (
                  <div className="text-white/25 text-sm">No data</div>
                ) : (
                  <div className="space-y-2.5 flex-1">
                    {Object.entries(reportStats.byMachine).map(([name, d]) => {
                      const acc = d.total > 0 ? ((d.total - d.missing) / d.total * 100) : 0;
                      const col = acc >= 80 ? "#4ade80" : acc >= 60 ? "#fbbf24" : "#f87171";
                      return (
                        <div key={name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] text-white/50 font-medium truncate flex-1 min-w-0">{name}</span>
                            <span className="text-[12px] font-bold shrink-0 ml-2" style={{ color: col }}>{acc.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${acc}%`, background: col, boxShadow: `0 0 6px ${col}` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {reportStats.peakHour !== null && (
                  <div className="pt-2 border-t flex items-center gap-1.5 mt-auto" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                    <FiClock className="w-3 h-3 shrink-0 text-blue-400" />
                    <span className="text-[11px] text-white/40">Peak</span>
                    <span className="text-[11px] font-bold text-blue-300">{String(reportStats.peakHour).padStart(2,"0")}:00–{String(reportStats.peakHour+1).padStart(2,"0")}:00</span>
                    <span className="text-[10px] text-white/30 ml-auto">({reportStats.peakHourCount})</span>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ── Filter Bar ─────────────────────────────────────── */}
          {/* z-index kept below the navbar's sticky mega-menu (z-[1000] in
              Navbar.jsx) — this only needs to layer above this page's own
              cards, not above site navigation. It was z-[9980] before,
              which made the Report dropdown render underneath this filter
              bar and its "Missing" badge instead of over it. */}
          <div className="relative z-40 bg-white/95 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl p-3.5 md:p-5">
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-end">

              {/* Equipment dropdown */}
              <div ref={ddRef} className="relative w-full sm:w-auto sm:min-w-[180px] z-40">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">EQP Name</label>
                <div
                  className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 cursor-pointer hover:bg-white hover:border-[#0e4a78] transition-all text-sm font-semibold text-slate-700"
                  onClick={() => setShowMachineDD((v) => !v)}
                >
                  <span className="truncate">
                    {selectedMachines.length === 0 ? "None selected" : `${selectedMachines.length} selected`}
                  </span>
                  <FiChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${showMachineDD ? "rotate-180" : ""}`} />
                </div>

                {showMachineDD && (
                  <div className="absolute top-full mt-1.5 left-0 min-w-[320px] w-auto bg-white border border-slate-200 rounded-xl shadow-2xl z-40 flex flex-col max-h-80">
                    <div className="p-2 border-b">
                      <div className="relative">
                        <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                        <input
                          type="text"
                          placeholder="Search…"
                          value={searchMachine}
                          onChange={(e) => setSearchMachine(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0e4a78]"
                        />
                      </div>
                    </div>
                    {/* Select All row */}
                    <div
                      className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-slate-50 border-b border-slate-100 text-sm font-semibold text-slate-700 select-none"
                      onClick={(e) => { e.stopPropagation(); selectAll(); }}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selectedMachines.length === allMachines.length && allMachines.length > 0 ? "bg-[#0e4a78] border-[#0e4a78]" : "border-slate-300"}`}>
                        {selectedMachines.length === allMachines.length && allMachines.length > 0 && <FiCheck className="w-2.5 h-2.5 text-white" />}
                        {selectedMachines.length > 0 && selectedMachines.length < allMachines.length && <div className="w-2 h-0.5 bg-[#0e4a78]" />}
                      </div>
                      Select All
                    </div>
                    <div className="overflow-y-auto flex-1 p-1">
                      {filteredMachines.length > 0 ? filteredMachines.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-slate-50 rounded-lg text-sm text-slate-700 font-medium select-none"
                          onClick={(e) => { e.stopPropagation(); toggleMachine(m.deviceId); }}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selectedMachines.includes(m.deviceId) ? "bg-[#0e4a78] border-[#0e4a78]" : "border-slate-300"}`}>
                            {selectedMachines.includes(m.deviceId) && <FiCheck className="w-2.5 h-2.5 text-white" />}
                          </div>
                          {m.name}
                        </div>
                      )) : (
                        <p className="px-3 py-3 text-sm text-slate-400 text-center">No equipment found</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* From Date */}
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  <FiCalendar className="inline mr-1" />From Date
                </label>
                <input
                  type="datetime-local"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/20 focus:border-[#0e4a78] text-sm text-slate-700 transition-all"
                />
              </div>

              {/* To Date */}
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  <FiCalendar className="inline mr-1" />To Date
                </label>
                <input
                  type="datetime-local"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/20 focus:border-[#0e4a78] text-sm text-slate-700 transition-all"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={handleClear}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-all"
                >
                  Clear
                </button>
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0e4a78] hover:bg-[#0b3b60] text-white text-sm font-bold transition-all shadow-md disabled:opacity-60"
                >
                  {loading ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiSearch className="w-4 h-4" />}
                  Search
                </button>
              </div>
            </div>
          </div>

          {/* ── Results ─────────────────────────────────────────
               Always visible — data auto-loads on mount       */}
          <div className="space-y-3">

            {/* Tab Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveTab("missing")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                  activeTab === "missing"
                    ? "bg-red-500/25 border-red-400/50 text-red-200 shadow-lg shadow-red-900/20"
                    : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70"
                }`}
              >
                <FiAlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Missing
                {!loading && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black min-w-[20px] text-center ${
                    activeTab === "missing" ? "bg-red-400/30 text-red-100" : "bg-white/10 text-white/40"
                  }`}>
                    {displayRows.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("nonmissing")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                  activeTab === "nonmissing"
                    ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200 shadow-lg shadow-emerald-900/20"
                    : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70"
                }`}
              >
                <FiEye className="w-3.5 h-3.5 shrink-0" />
                OCR Read
                {!loading && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black min-w-[20px] text-center ${
                    activeTab === "nonmissing" ? "bg-emerald-400/25 text-emerald-100" : "bg-white/10 text-white/40"
                  }`}>
                    {displayNonMissingRows.length}
                  </span>
                )}
              </button>
            </div>

            {/* Section header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              {activeTab === "missing" ? (
                <h2 className="text-white font-bold text-sm md:text-base tracking-wide uppercase flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-[#ed1e25] rounded-full inline-block" />
                  Transaction Missed During Operations
                  {!loading && (
                    <span className="text-white/50 text-xs font-normal normal-case">({displayRows.length} records)</span>
                  )}
                </h2>
              ) : (
                <h2 className="text-white font-bold text-sm md:text-base tracking-wide uppercase flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-emerald-400 rounded-full inline-block" />
                  OCR Read Containers
                  {!loading && (
                    <span className="text-white/50 text-xs font-normal normal-case">({displayNonMissingRows.length} records)</span>
                  )}
                </h2>
              )}

              {!loading && (activeTab === "missing" ? displayRows.length > 0 : displayNonMissingRows.length > 0) && (
                <div className="relative w-full sm:w-64">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-3.5 h-3.5" />
                  <input
                    type="text"
                    placeholder="Filter cards…"
                    value={searchCards}
                    onChange={(e) => setSearchCards(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 rounded-xl bg-white/10 border border-white/15 text-white text-sm placeholder-white/40 focus:outline-none focus:border-white/40 focus:bg-white/15 transition-all"
                  />
                </div>
              )}
            </div>

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                <span className="text-white/60 text-sm">Loading transactions…</span>
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="bg-red-500/20 border border-red-400/30 rounded-2xl p-6 text-center text-red-200 text-sm font-medium">
                {error}
              </div>
            )}

            {/* ── Missing Tab ── */}
            {!loading && !error && activeTab === "missing" && (
              <>
                {displayRows.length === 0 ? (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
                    <FiCheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                    <p className="text-white font-bold text-base mb-1">All Clear!</p>
                    <p className="text-white/50 text-sm">No missed transactions found for the selected filters.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                    {displayRows.map((row) => {
                      const tid = getField(row, "EqpTransID", "eqptransid", "Sr_No", "SR_NO", "sr_no", "TRANSACTION_ID", "transaction_id");
                      return (
                        <TransactionCard
                          key={String(tid ?? Math.random())}
                          row={row}
                          onUpdate={handleUpdateContainer}
                          searchContainer={searchContainerQuery}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── OCR Read Tab ── */}
            {!loading && !error && activeTab === "nonmissing" && (
              <>
                {displayNonMissingRows.length === 0 ? (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
                    <FiCamera className="w-10 h-10 text-white/20 mx-auto mb-3" />
                    <p className="text-white font-bold text-base mb-1">No OCR Data</p>
                    <p className="text-white/50 text-sm">No OCR-read containers found for the selected filters.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-white/40 text-xs">
                      These containers were captured by OCR. Review and update the container number if incorrect.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                      {displayNonMissingRows.map((row) => {
                        const tid = getField(row, "EqpTransID", "eqptransid", "Sr_No", "SR_NO", "sr_no", "TRANSACTION_ID", "transaction_id");
                        return (
                          <TransactionCard
                            key={String(tid ?? Math.random())}
                            row={row}
                            onUpdate={handleUpdateContainer}
                            searchContainer={searchContainerQuery}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      <style>{`
        input[type="datetime-local"],
        input[type="text"],
        select {
          font-size: 16px; /* prevents iOS auto-zoom */
        }
        @media (min-width: 768px) {
          input[type="datetime-local"],
          input[type="text"],
          select {
            font-size: 0.875rem;
          }
        }
      `}</style>
    </div>
  );
};

export default ServiceDashboard;
