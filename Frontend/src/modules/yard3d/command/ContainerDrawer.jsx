import React from "react";
import { FiX, FiMapPin, FiPackage, FiClock } from "react-icons/fi";
import { T, STATUS_COLORS, STATUS_LABELS } from "./theme";
import { FieldRow, Tag } from "./primitives";

export default function ContainerDrawer({ container, onClose }) {
  if (!container) return null;

  const statusColor = STATUS_COLORS[container.status] || T.blue;
  const statusLabel = STATUS_LABELS[container.status] || container.status;

  return (
    <>
      <div
        className="fixed inset-0 z-40 transition-opacity"
        style={{ background: "rgba(15,23,42,0.32)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />
      <div
        className="fixed left-0 right-0 bottom-0 z-50 max-h-[72vh] overflow-hidden rounded-t-2xl border-t shadow-2xl"
        style={{
          background: T.cardSoft,
          borderColor: T.borderHi,
          boxShadow: "0 -20px 60px rgba(15,23,42,0.18)",
          animation: "drawerSlideUp 220ms ease-out",
        }}
      >
        <style>{`
          @keyframes drawerSlideUp {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0%);   opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-3 border-b"
          style={{ borderColor: T.border, background: `linear-gradient(90deg, ${statusColor}10 0%, transparent 60%)` }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: `${statusColor}15`,
              border: `1px solid ${statusColor}40`,
              color: statusColor,
            }}
          >
            <FiPackage size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <Tag color={statusColor} filled>{statusLabel}</Tag>
              {container.size && container.type && (
                <Tag color={T.slate}>{container.size} {container.type}</Tag>
              )}
              {container.process && <Tag color={T.indigo}>{container.process}</Tag>}
            </div>
            <div
              className="font-mono tabular-nums font-black text-[20px] truncate"
              style={{ color: T.text }}
            >
              {container.containerNo || container.id}
            </div>
            <div className="text-[10.5px]" style={{ color: T.textMute }}>
              {container.location || "—"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-100"
            style={{ color: T.textDim, border: `1px solid ${T.border}`, background: T.card }}
          >
            <FiX size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Location */}
          <div className="rounded-xl border p-3" style={{ background: T.card, borderColor: T.border }}>
            <div className="flex items-center gap-2 mb-1">
              <FiMapPin size={11} style={{ color: T.cyan }} />
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textMute }}>
                Location
              </span>
            </div>
            <div className="font-mono tabular-nums font-black text-[15px]" style={{ color: T.text }}>
              {container.location || container.block || "—"}
            </div>
            <div className="text-[10px] truncate" style={{ color: T.textMute }}>
              {container.slotName || container.location || ""}
            </div>
          </div>

          {/* Dwell */}
          <div className="rounded-xl border p-3" style={{ background: T.card, borderColor: T.border }}>
            <div className="flex items-center gap-2 mb-1">
              <FiClock size={11} style={{ color: T.amber }} />
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textMute }}>
                Dwell
              </span>
            </div>
            <div className="font-mono tabular-nums font-black text-[18px]"
              style={{ color: container.dwellDays > 7 ? T.amber : T.text }}>
              {container.dwellDays || 0} <span className="text-[12px] font-bold">days</span>
            </div>
            {container.gateInDate && (
              <div className="text-[10px]" style={{ color: T.textMute }}>
                Gate-in {String(container.gateInDate).replace("T", " ").slice(0, 16)}
              </div>
            )}
          </div>

          {/* Equipment / GPS */}
          <div className="rounded-xl border p-3" style={{ background: T.card, borderColor: T.border }}>
            <div className="flex items-center gap-2 mb-1">
              <FiPackage size={11} style={{ color: T.indigo }} />
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textMute }}>
                Equipment / Process
              </span>
            </div>
            <div className="font-mono tabular-nums font-bold text-[13px]" style={{ color: T.text }}>
              {container.equipment || container.process || "—"}
            </div>
            {container.lat && container.lng && (
              <div className="text-[10px] font-mono" style={{ color: T.textMute }}>
                {Number(container.lat).toFixed(5)}, {Number(container.lng).toFixed(5)}
              </div>
            )}
          </div>
        </div>

        {/* Detail grid */}
        <div className="px-5 pb-5 grid grid-cols-2 md:grid-cols-6 gap-4">
          <FieldRow label="Block"     value={container.block} />
          {(container.row || container.col) && <FieldRow label="Row · Col" value={`${container.row || "-"} · ${container.col || "-"}`} />}
          <FieldRow label="Tier"      value={`T${container.tier}`} />
          <FieldRow label="Size·Type" value={`${container.size || "—"} ${container.type || ""}`.trim()} mono={false} />
          <FieldRow label="Status"    value={statusLabel} mono={false} color={statusColor} />
          <FieldRow label="Dwell"     value={`${container.dwellDays || 0}d`} />
          {container.process && <FieldRow label="Process" value={container.process} mono={false} />}
          {container.equipment && <FieldRow label="Equipment" value={container.equipment} mono={false} />}
          {container.gateInDate && (
            <FieldRow label="Gate In" value={String(container.gateInDate).replace("T", " ").slice(0, 16)} />
          )}
          {container.lastMovedDate && (
            <FieldRow label="Last Moved" value={String(container.lastMovedDate).replace("T", " ").slice(0, 16)} />
          )}
        </div>
      </div>
    </>
  );
}
