import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLazyKioskSearchQuery } from "../../../store/api/ymsApi";
import { FiMapPin, FiRefreshCw, FiBox, FiSearch, FiAlertTriangle } from "react-icons/fi";
import KioskMap from "./KioskMap";

// ─── Keyboard rows ─────────────────────────────────────────────────────────────
const ROWS = [
  ["1","2","3","4","5","6","7","8","9","0"],
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["Z","X","C","V","B","N","M"],
];

// ─── Virtual Keyboard Key ──────────────────────────────────────────────────────
const Key = ({ label, onClick, wide, accent }) => (
  <button
    onPointerDown={(e) => { e.preventDefault(); onClick(label); }}
    className={`
      relative select-none font-black rounded-xl transition-all duration-75
      active:scale-95 flex items-center justify-center
      shadow-[0_4px_0_rgba(0,0,0,0.15)] active:shadow-none active:translate-y-1
      ${wide ? "px-8 py-3 text-sm" : "text-base"}
      ${accent
        ? "bg-red-600 hover:bg-red-700 text-white border border-red-700/40"
        : "bg-white hover:bg-gray-50 text-[#0e4a78] border border-gray-200"
      }
    `}
    style={{ minWidth: wide ? undefined : "3.25rem", height: wide ? "auto" : "3.25rem" }}
  >
    {label}
  </button>
);

// ─── Clock component ──────────────────────────────────────────────────────────
const Clock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="text-right">
      <div className="text-3xl font-black text-white tracking-widest tabular-nums">
        {time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
      </div>
      <div className="text-xs text-blue-200 font-semibold tracking-widest uppercase mt-0.5">
        {time.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
      </div>
    </div>
  );
};

// ─── Main Kiosk Component ──────────────────────────────────────────────────────
const Kiosk = () => {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [foundContainer, setFoundContainer] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [triggerFetch] = useLazyKioskSearchQuery();
  const suggRef = useRef(null);
  const idleTimer = useRef(null);

  // Auto-reset after 90s of idle
  const resetIdleTimer = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setInput(""); setSuggestions([]); setShowSuggestions(false);
      setError(""); setFoundContainer(null); setShowMap(false);
    }, 90000);
  }, []);

  useEffect(() => {
    resetIdleTimer();
    return () => clearTimeout(idleTimer.current);
  }, [input, resetIdleTimer]);

  const fetchSuggestions = useCallback(async (term) => {
    if (!term || term.length < 1) { setSuggestions([]); setShowSuggestions(false); setLoadingSuggestions(false); return; }
    setLoadingSuggestions(true);
    setShowSuggestions(true);
    try {
      const result = await triggerFetch({ term: term.trim(), top: 8 }, false).unwrap();
      const rows = Array.isArray(result?.data) ? result.data : [];
      const unique = [...new Set(rows.map((r) => r.CONTAINER_NO))].filter(Boolean).slice(0, 8);
      setSuggestions(unique);
      setShowSuggestions(unique.length > 0);
    } catch { setSuggestions([]); setShowSuggestions(false); }
    finally { setLoadingSuggestions(false); }
  }, [triggerFetch]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (input) fetchSuggestions(input);
      else { setSuggestions([]); setShowSuggestions(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [input, fetchSuggestions]);


  const handleKey = useCallback((key) => {
    resetIdleTimer();
    setError("");
    if (key === "⌫") { setInput((p) => p.slice(0, -1)); }
    else if (key === "SPACE") { setInput((p) => p + " "); }
    else { setInput((p) => (p + key).toUpperCase()); }
  }, [resetIdleTimer]);

  const handleLocate = useCallback(async () => {
    const term = input.trim().toUpperCase();
    if (!term) { setError("Please enter a container number first."); return; }
    setLocating(true);
    setError("");
    try {
      const result = await triggerFetch({ term, top: 1 }, false).unwrap();
      const rows = Array.isArray(result?.data) ? result.data : [];
      if (rows.length) {
        const found = rows.find((r) => r.CONTAINER_NO === term)
          || rows.find((r) => r.CONTAINER_NO?.startsWith(term))
          || rows[0];
        if (found) {
          setFoundContainer([found]);
          setShowMap(true);
          setShowSuggestions(false);
        } else {
          setError(`Container "${term}" is not in yard inventory.`);
        }
      } else {
        setError(`Container "${term}" not found. Please check the number.`);
      }

    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLocating(false);
    }
  }, [input, triggerFetch]);

  const handleReset = useCallback(() => {
    setInput(""); setSuggestions([]); setShowSuggestions(false);
    setError(""); setFoundContainer(null); setShowMap(false);
    clearTimeout(idleTimer.current);
    resetIdleTimer();
  }, [resetIdleTimer]);

  // Block all physical keyboard input — kiosk uses on-screen keyboard only
  useEffect(() => {
    const block = (e) => e.preventDefault();
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, []);

  if (showMap && foundContainer) {
    return <KioskMap container={foundContainer[0]} onClose={handleReset} />;
  }

  return (
    <div
      className="w-screen h-screen flex flex-col overflow-hidden select-none bg-cover bg-center relative"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      {/* Same overlay as web app */}
      <div className="absolute inset-0 bg-white/65 backdrop-blur-[1px]" aria-hidden="true" />

      <div className="relative z-10 flex flex-col h-full">

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-[#012541] border-b border-[#0e4a78]/40 px-8 py-4 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-4">
          <img src="/Images/gdl_logo.png" alt="GDL" className="h-11 w-11 rounded-xl object-contain bg-white p-1 shadow-lg" />
          <div>
            <h1 className="text-xl font-black text-white tracking-wide">Container Locator</h1>
            <p className="text-xs text-blue-300 font-semibold tracking-widest uppercase">Yard Management System · Kiosk</p>
          </div>
        </div>
        <Clock />
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Left: Instructions always visible */}
        <div className="w-64 flex-shrink-0 flex flex-col bg-white/80 backdrop-blur-sm border-r border-gray-200 px-5 py-6 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0e4a78]/10 border border-[#0e4a78]/30 mb-4">
              <span className="w-2 h-2 rounded-full bg-[#0e4a78] animate-pulse" />
              <span className="text-xs font-bold text-[#0e4a78] uppercase tracking-widest">How to Use</span>
            </div>
            <div className="space-y-4">
              {[
                { n: "1", title: "Type Container No.", desc: "Use the on-screen keyboard" },
                { n: "2", title: "Select Suggestion",  desc: "Pick from the right panel" },
                { n: "3", title: "Click LOCATE",       desc: "See it on the yard map" },
                { n: "4", title: "Click RESET",        desc: "Start a new search" },
              ].map(({ n, title, desc }) => (
                <div key={n} className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#0e4a78]/10 border border-[#0e4a78]/30 flex items-center justify-center text-sm font-black text-[#0e4a78]">
                    {n}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Example</p>
            <div className="space-y-2">
              {["MSKU9623603", "SUDU5678341", "HDMU3679533"].map((ex) => (
                <button key={ex}
                  onPointerDown={(e) => { e.preventDefault(); setInput(ex); setError(""); }}
                  className="w-full text-left px-3 py-2 bg-[#0e4a78]/10 border border-[#0e4a78]/20 rounded-lg font-mono text-xs text-[#0e4a78] hover:bg-[#0e4a78]/20 transition font-bold tracking-wider">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Input + keyboard */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-5 min-h-0">
          <div className="w-full max-w-2xl">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#0e4a78] mb-2 block">
              Container Number
            </label>
            <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border-2 transition-all bg-white shadow-sm ${error ? "border-red-400" : input ? "border-[#0e4a78]" : "border-gray-200"}`}>
              <FiBox className={`text-2xl flex-shrink-0 ${error ? "text-red-400" : "text-[#0e4a78]"}`} />
              <span className="flex-1 min-h-[2rem] flex items-center text-xl font-black font-mono tracking-widest text-gray-800">
                {input || <span className="text-gray-400 text-lg font-semibold not-italic tracking-wide">Use keyboard below…</span>}
                {input && <span className="animate-pulse ml-0.5 text-[#0e4a78]">|</span>}
              </span>
              {locating && <span className="w-6 h-6 border-2 border-[#0e4a78] border-t-transparent rounded-full animate-spin flex-shrink-0" />}
            </div>
            {error && (
              <div className="mt-3 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold">
                <FiAlertTriangle className="text-lg flex-shrink-0 text-red-400" />
                {error}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 w-full max-w-2xl">
            <button
              onPointerDown={(e) => { e.preventDefault(); handleLocate(); }}
              disabled={locating || !input.trim()}
              className="flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-white text-xl transition-all
                bg-[#0e4a78] hover:bg-[#0a3b61] border border-[#0e4a78]/60
                disabled:opacity-40 disabled:cursor-not-allowed
                shadow-[0_6px_0_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-1"
            >
              {locating
                ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Locating…</>
                : <><FiMapPin className="text-xl" /> LOCATE</>}
            </button>
            <button
              onPointerDown={(e) => { e.preventDefault(); handleReset(); }}
              className="flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-white text-xl transition-all
                bg-red-600 hover:bg-red-700 border border-red-700/40
                shadow-[0_6px_0_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-1"
            >
              <FiRefreshCw className="text-xl" /> RESET
            </button>
          </div>

          {/* Virtual keyboard */}
          <div className="flex flex-col items-center gap-2 w-full max-w-2xl">
            {ROWS.map((row, ri) => (
              <div key={ri} className="flex gap-2 justify-center">
                {row.map((key) => <Key key={key} label={key} onClick={handleKey} />)}
              </div>
            ))}
            <div className="flex gap-2 justify-center mt-1">
              <Key label="SPACE" onClick={handleKey} wide />
              <Key label="⌫" onClick={handleKey} wide accent />
            </div>
          </div>
        </div>

        {/* Right: Suggestions panel */}
        <div ref={suggRef} className="w-64 flex-shrink-0 flex flex-col bg-white/80 backdrop-blur-sm border-l border-gray-200">
          {showSuggestions && (suggestions.length > 0 || loadingSuggestions) ? (
            <>
              <div className="px-5 py-3 border-b border-gray-200 bg-[#0e4a78]/5 flex items-center gap-2 flex-shrink-0">
                <span className="w-2 h-2 rounded-full bg-[#0e4a78] animate-pulse flex-shrink-0" />
                <span className="text-[11px] font-bold text-[#0e4a78] uppercase tracking-widest">
                  {loadingSuggestions ? "Searching…" : `${suggestions.length} result${suggestions.length !== 1 ? "s" : ""}`}
                </span>
              </div>
              <div className="flex-1 overflow-auto">
                {loadingSuggestions ? (
                  <div className="flex items-center gap-3 px-5 py-6 text-[#0e4a78] text-sm">
                    <span className="w-5 h-5 border-2 border-[#0e4a78] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    Searching…
                  </div>
                ) : suggestions.map((c, i) => (
                  <button key={c}
                    onPointerDown={(e) => { e.preventDefault(); setInput(c); setShowSuggestions(false); setError(""); }}
                    className="w-full flex items-center gap-3 px-4 py-4 text-left border-b border-gray-100 last:border-b-0 hover:bg-[#0e4a78]/5 transition group"
                  >
                    <span className="w-7 h-7 rounded-lg bg-[#0e4a78]/10 border border-[#0e4a78]/20 flex items-center justify-center text-[#0e4a78] text-sm font-black flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="font-mono font-black text-gray-800 text-sm tracking-wider group-hover:text-[#0e4a78] transition flex-1 min-w-0 truncate">
                      {c}
                    </span>
                    <span className="text-gray-300 group-hover:text-[#0e4a78] text-lg flex-shrink-0">↩</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-5 text-center">
              <FiSearch className="text-3xl text-gray-200" />
              <p className="text-xs text-gray-400 font-medium">Suggestions appear here as you type</p>
            </div>
          )}
        </div>

      </div>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="flex-shrink-0 bg-[#012541] border-t border-[#0e4a78]/40 px-8 py-1 flex items-center justify-between">
        <p className="text-xs text-white/80 font-medium">Gateway Distriparks Limited - ICD Sahnewal</p>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} Qikkle Solutions Pvt Ltd. All rights reserved.</p>
      </footer>

      </div>
    </div>
  );
};

export default Kiosk;
