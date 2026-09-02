import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useGetContainerLiveStatus3dQuery } from "../../../store/api/ymsApi";
import { FiMapPin, FiRefreshCw, FiBox, FiSearch, FiAlertTriangle } from "react-icons/fi";
import KioskMap from "./KioskMap";

// Same field-name grab helper the 3D yard page uses to read
// ContainerLiveStatus_3D rows — column casing isn't guaranteed.
function grab(row, ...keys) {
  for (const k of keys) if (row[k] != null && row[k] !== "") return row[k];
  return null;
}

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
      relative select-none font-black rounded-2xl transition-all duration-75
      active:scale-95 flex items-center justify-center
      shadow-[0_5px_0_rgba(0,0,0,0.15)] active:shadow-none active:translate-y-1.5
      ${wide ? "px-10 py-3 text-base" : "text-xl"}
      ${accent
        ? "bg-red-600 hover:bg-red-700 text-white border border-red-700/40"
        : "bg-white hover:bg-gray-50 text-[#0e4a78] border border-gray-200"
      }
    `}
    style={{ minWidth: wide ? undefined : "3.75rem", height: wide ? "auto" : "3.75rem" }}
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
      <div className="text-4xl font-black text-white tracking-widest tabular-nums">
        {time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
      </div>
      <div className="text-sm text-blue-200 font-semibold tracking-widest uppercase mt-0.5">
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
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [foundContainer, setFoundContainer] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const suggRef = useRef(null);
  const idleTimer = useRef(null);

  // Same in-yard inventory source (ContainerLiveStatus_3D) the 3D Yard Live
  // Status page uses, incl. the SlotId FK into ESS_MST_LOCATION for exact
  // map placement — replaces the old SP_KIOSK_CONTAINER_SEARCH round trip.
  const { data: inventoryResp, isFetching: loadingInventory } = useGetContainerLiveStatus3dQuery(undefined, {
    pollingInterval: 60000,
  });

  const inventory = useMemo(() => {
    const rows = Array.isArray(inventoryResp?.data) ? inventoryResp.data : [];
    return rows.map((row) => ({
      CONTAINER_NO:      String(grab(row, "Cont_No", "CONTAINER_NO", "ContainerNo") || "").trim().toUpperCase(),
      CONTAINER_SIZE:    grab(row, "Cont_Size", "CONTAINER_SIZE", "ContainerSize"),
      CONTAINER_TYPE:    grab(row, "Cont_Type", "CONTAINER_TYPE", "ContainerType"),
      MASTERTABLE:       grab(row, "Last_Loc", "MASTERTABLE", "LOCATION_NAME"),
      SLOT_ID:           grab(row, "SlotId", "SLOT_ID", "SlotID"),
      OFFLOAD_LAT:       grab(row, "OFFLOAD_LAT", "Lat", "Latitude"),
      OFFLOAD_LON:       grab(row, "OFFLOAD_LON", "Lng", "Longitude"),
      CONTAINER_PROCESS: grab(row, "CONTAINER_PROCESS", "Process"),
      INVENTORY_STATUS:  grab(row, "INVENTORY_STATUS", "Status"),
    })).filter(c => c.CONTAINER_NO);
  }, [inventoryResp]);

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

  const fetchSuggestions = useCallback((term) => {
    if (!term || term.length < 1) { setSuggestions([]); setShowSuggestions(false); return; }
    const t = term.trim().toUpperCase();
    const unique = [...new Set(
      inventory.filter((c) => c.CONTAINER_NO.includes(t)).map((c) => c.CONTAINER_NO)
    )].slice(0, 8);
    setSuggestions(unique);
    setShowSuggestions(unique.length > 0);
  }, [inventory]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (input) fetchSuggestions(input);
      else { setSuggestions([]); setShowSuggestions(false); }
    }, 150);
    return () => clearTimeout(t);
  }, [input, fetchSuggestions]);


  const handleKey = useCallback((key) => {
    resetIdleTimer();
    setError("");
    if (key === "⌫") { setInput((p) => p.slice(0, -1)); }
    else if (key === "SPACE") { setInput((p) => p + " "); }
    else { setInput((p) => (p + key).toUpperCase()); }
  }, [resetIdleTimer]);

  const handleLocate = useCallback(() => {
    const term = input.trim().toUpperCase();
    if (!term) { setError("Please enter a container number first."); return; }
    if (loadingInventory) { setError("Yard inventory is still loading, please wait a moment."); return; }
    setLocating(true);
    setError("");
    const found = inventory.find((c) => c.CONTAINER_NO === term)
      || inventory.find((c) => c.CONTAINER_NO.startsWith(term));
    if (found) {
      setFoundContainer([found]);
      setShowMap(true);
      setShowSuggestions(false);
    } else {
      setError(`Container "${term}" not found in yard inventory.`);
    }
    setLocating(false);
  }, [input, inventory, loadingInventory]);

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
      <header className="flex-shrink-0 bg-[#012541] border-b border-[#0e4a78]/40 px-9 py-5 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-5">
          <img src="/Images/gdl_logo.png" alt="GDL" className="h-14 w-14 rounded-xl object-contain bg-white p-1 shadow-lg" />
          <div>
            <h1 className="text-2xl font-black text-white tracking-wide">Container Locator</h1>
            <p className="text-sm text-blue-300 font-semibold tracking-widest uppercase">Yard Management System · Kiosk</p>
          </div>
        </div>
        <Clock />
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Left: Instructions always visible */}
        <div className="w-80 flex-shrink-0 flex flex-col bg-white/80 backdrop-blur-sm border-r border-gray-200 px-6 py-8 gap-8">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0e4a78]/10 border border-[#0e4a78]/30 mb-5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0e4a78] animate-pulse" />
              <span className="text-sm font-bold text-[#0e4a78] uppercase tracking-widest">How to Use</span>
            </div>
            <div className="space-y-5">
              {[
                { n: "1", title: "Type Container No.", desc: "Use the on-screen keyboard" },
                { n: "2", title: "Select Suggestion",  desc: "Pick from the right panel" },
                { n: "3", title: "Click LOCATE",       desc: "See it on the yard map" },
                { n: "4", title: "Click RESET",        desc: "Start a new search" },
              ].map(({ n, title, desc }) => (
                <div key={n} className="flex gap-4">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#0e4a78]/10 border border-[#0e4a78]/30 flex items-center justify-center text-base font-black text-[#0e4a78]">
                    {n}
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-800">{title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-auto">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Example</p>
            <div className="space-y-2.5">
              {["MSKU9623603", "SUDU5678341", "HDMU3679533"].map((ex) => (
                <button key={ex}
                  onPointerDown={(e) => { e.preventDefault(); setInput(ex); setError(""); }}
                  className="w-full text-left px-4 py-3 bg-[#0e4a78]/10 border border-[#0e4a78]/20 rounded-lg font-mono text-sm text-[#0e4a78] hover:bg-[#0e4a78]/20 transition font-bold tracking-wider">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Input + keyboard */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-3.5 min-h-0">
          <div className="w-full max-w-3xl">
            <label className="text-xs font-bold uppercase tracking-widest text-[#0e4a78] mb-1.5 block">
              Container Number
            </label>
            <div className={`flex items-center gap-4 px-6 py-3.5 rounded-2xl border-2 transition-all bg-white shadow-sm ${error ? "border-red-400" : input ? "border-[#0e4a78]" : "border-gray-200"}`}>
              <FiBox className={`text-2xl flex-shrink-0 ${error ? "text-red-400" : "text-[#0e4a78]"}`} />
              <span className="flex-1 min-h-[2.25rem] flex items-center text-2xl font-black font-mono tracking-widest text-gray-800">
                {input || <span className="text-gray-400 text-lg font-semibold not-italic tracking-wide">Use keyboard below…</span>}
                {input && <span className="animate-pulse ml-0.5 text-[#0e4a78]">|</span>}
              </span>
              {locating && <span className="w-6 h-6 border-2 border-[#0e4a78] border-t-transparent rounded-full animate-spin flex-shrink-0" />}
            </div>
            {error && (
              <div className="mt-2 flex items-center gap-3 px-5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold">
                <FiAlertTriangle className="text-lg flex-shrink-0 text-red-400" />
                {error}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-5 w-full max-w-3xl">
            <button
              onPointerDown={(e) => { e.preventDefault(); handleLocate(); }}
              disabled={locating || !input.trim()}
              className="flex-1 flex items-center justify-center gap-3 py-3.5 rounded-2xl font-black text-white text-xl transition-all
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
              className="flex-1 flex items-center justify-center gap-3 py-3.5 rounded-2xl font-black text-white text-xl transition-all
                bg-red-600 hover:bg-red-700 border border-red-700/40
                shadow-[0_6px_0_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-1"
            >
              <FiRefreshCw className="text-xl" /> RESET
            </button>
          </div>

          {/* Virtual keyboard */}
          <div className="flex flex-col items-center gap-2 w-full max-w-3xl">
            {ROWS.map((row, ri) => (
              <div key={ri} className="flex gap-2 justify-center">
                {row.map((key) => <Key key={key} label={key} onClick={handleKey} />)}
              </div>
            ))}
            <div className="flex gap-2 justify-center mt-0.5">
              <Key label="SPACE" onClick={handleKey} wide />
              <Key label="⌫" onClick={handleKey} wide accent />
            </div>
          </div>
        </div>

        {/* Right: Suggestions panel */}
        <div ref={suggRef} className="w-80 flex-shrink-0 flex flex-col bg-white/80 backdrop-blur-sm border-l border-gray-200">
          {showSuggestions && (suggestions.length > 0 || loadingInventory) ? (
            <>
              <div className="px-6 py-4 border-b border-gray-200 bg-[#0e4a78]/5 flex items-center gap-2 flex-shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0e4a78] animate-pulse flex-shrink-0" />
                <span className="text-xs font-bold text-[#0e4a78] uppercase tracking-widest">
                  {loadingInventory ? "Loading…" : `${suggestions.length} result${suggestions.length !== 1 ? "s" : ""}`}
                </span>
              </div>
              <div className="flex-1 overflow-auto">
                {loadingInventory ? (
                  <div className="flex items-center gap-3 px-6 py-7 text-[#0e4a78] text-base">
                    <span className="w-6 h-6 border-2 border-[#0e4a78] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    Loading…
                  </div>
                ) : suggestions.map((c, i) => (
                  <button key={c}
                    onPointerDown={(e) => { e.preventDefault(); setInput(c); setShowSuggestions(false); setError(""); }}
                    className="w-full flex items-center gap-3 px-5 py-5 text-left border-b border-gray-100 last:border-b-0 hover:bg-[#0e4a78]/5 transition group"
                  >
                    <span className="w-9 h-9 rounded-lg bg-[#0e4a78]/10 border border-[#0e4a78]/20 flex items-center justify-center text-[#0e4a78] text-base font-black flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="font-mono font-black text-gray-800 text-base tracking-wider group-hover:text-[#0e4a78] transition flex-1 min-w-0 truncate">
                      {c}
                    </span>
                    <span className="text-gray-300 group-hover:text-[#0e4a78] text-xl flex-shrink-0">↩</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-5 text-center">
              <FiSearch className="text-4xl text-gray-200" />
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
