import React, { useMemo, useState, useRef, useEffect } from "react";
import { FiSearch, FiX, FiPackage } from "react-icons/fi";
import { T, STATUS_COLORS } from "./theme";
import { Dot } from "./primitives";

const fuzzyMatch = (q, ...fields) => {
  const t = q.toLowerCase();
  return fields.some((f) => f && String(f).toLowerCase().includes(t));
};

export default function CommandSearch({ containers, query, onQueryChange, onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const matches = containers.filter((c) =>
      fuzzyMatch(q, c.containerNo, c.block, c.location, c.status)
    );
    return matches.slice(0, 8);
  }, [containers, query]);

  return (
    <div ref={ref} className="relative w-full max-w-2xl">
      <div
        className="flex items-center gap-2 h-10 px-3 rounded-xl border transition-all"
        style={{
          background: T.card,
          borderColor: open ? `${T.cyan}77` : T.border,
          boxShadow: open ? `0 0 0 3px ${T.cyan}18, 0 4px 12px rgba(15,23,42,0.06)` : "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <FiSearch size={14} style={{ color: T.cyan }} />
        <input
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search container, block, status…"
          className="flex-1 bg-transparent text-[12px] outline-none font-mono"
          style={{ color: T.text }}
        />
        {query && (
          <button
            onClick={() => onQueryChange("")}
            style={{ color: T.textMute }}
            className="hover:opacity-80"
          >
            <FiX size={13} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          className="absolute left-0 right-0 mt-1 rounded-xl border overflow-hidden z-50"
          style={{
            background: T.card,
            borderColor: T.borderHi,
            boxShadow: "0 20px 48px rgba(15,23,42,0.18)",
          }}
        >
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 transition-colors text-left hover:bg-slate-50"
              style={{ borderBottom: `1px solid ${T.border}` }}
            >
              <Dot color={STATUS_COLORS[c.status] || T.slate} size={7} />
              <FiPackage size={11} style={{ color: T.textMute }} />
              <span className="font-mono tabular-nums font-bold text-[12px]" style={{ color: T.text }}>
                {c.containerNo}
              </span>
              <span className="text-[10px] truncate" style={{ color: T.textMute }}>
                {c.size} {c.type} · {c.status}
              </span>
              <span className="ml-auto text-[10px] font-mono" style={{ color: T.textMute }}>
                {c.block || "—"} · T{c.tier}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
