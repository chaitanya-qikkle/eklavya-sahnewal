import React from "react";
import { FiFilter, FiX } from "react-icons/fi";
import { T, STATUS_COLORS, STATUS_LABELS } from "./theme";
import { SectionLabel } from "./primitives";

const STATUS_OPTIONS = [
  { id: "All", label: "All", color: T.cyan },
  ...Object.keys(STATUS_LABELS).map((k) => ({
    id: k, label: STATUS_LABELS[k], color: STATUS_COLORS[k],
  })),
];

const SIZE_OPTIONS = [
  { id: "All",  label: "All" },
  { id: "20GP", label: "20GP" },
  { id: "40GP", label: "40GP" },
  { id: "40HC", label: "40HC" },
];

const DWELL_OPTIONS = [
  { id: "All",   label: "All" },
  { id: "0-3",   label: "0–3d" },
  { id: "3-7",   label: "3–7d" },
  { id: "7-14",  label: "7–14d" },
  { id: "14+",   label: "14d+" },
];

export default function FilterPanel({ filters, onChange, onReset }) {
  const hasAny =
    filters.status !== "All" ||
    filters.size !== "All" ||
    filters.dwell !== "All";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FiFilter size={11} style={{ color: T.text }} />
          <span
            className="text-[10px] font-black uppercase tracking-[0.22em]"
            style={{ color: T.text }}
          >
            Filters
          </span>
        </div>
        {hasAny && (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider"
            style={{ color: T.red }}
          >
            <FiX size={10} /> reset
          </button>
        )}
      </div>

      <SectionLabel>Status</SectionLabel>
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {STATUS_OPTIONS.map((o) => (
          <Chip
            key={o.id}
            label={o.label}
            color={o.color}
            active={filters.status === o.id}
            onClick={() => onChange({ ...filters, status: o.id })}
          />
        ))}
      </div>

      <SectionLabel>Size · Type</SectionLabel>
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {SIZE_OPTIONS.map((o) => (
          <Chip
            key={o.id}
            label={o.label}
            color={T.blue}
            active={filters.size === o.id}
            onClick={() => onChange({ ...filters, size: o.id })}
          />
        ))}
      </div>

      <SectionLabel>Dwell Range</SectionLabel>
      <div className="grid grid-cols-5 gap-1.5">
        {DWELL_OPTIONS.map((o) => (
          <Chip
            key={o.id}
            label={o.label}
            color={T.amber}
            active={filters.dwell === o.id}
            onClick={() => onChange({ ...filters, dwell: o.id })}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({ label, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="h-7 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all border"
      style={{
        background: active ? `${color}18` : T.card,
        color: active ? color : T.textDim,
        borderColor: active ? `${color}88` : T.border,
      }}
    >
      {label}
    </button>
  );
}

export const applyFilters = (containers, filters) => {
  return containers.filter((c) => {
    if (filters.status !== "All" && c.status !== filters.status) return false;
    if (filters.size !== "All") {
      const want20 = filters.size.startsWith("20");
      const wantHC = filters.size.endsWith("HC");
      if (want20 && c.size !== "20ft") return false;
      if (!want20 && c.size !== "40ft") return false;
      if (wantHC && c.type !== "HC") return false;
      if (filters.size === "40GP" && c.type === "HC") return false;
    }
    if (filters.dwell !== "All") {
      const d = c.dwellDays || 0;
      if (filters.dwell === "0-3"  && !(d <= 3))           return false;
      if (filters.dwell === "3-7"  && !(d > 3 && d <= 7))  return false;
      if (filters.dwell === "7-14" && !(d > 7 && d <= 14)) return false;
      if (filters.dwell === "14+"  && !(d > 14))           return false;
    }
    return true;
  });
};
