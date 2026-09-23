import React from 'react'

// ─── Shared Stat Card system ───────────────────────────────────────────────
// Canonical KPI-tile design used across every report/gate/container/trailer
// page. Renders as a tinted, bordered rounded card — visually distinct from
// the FilterBar (which is a plain white/gray toolbar), so stats and filters
// never look like the same UI element.

export const STAT_TONES = {
  slate:   { accent: '#0e4a78', iconColor: 'text-[#0e4a78]',   cardBg: 'bg-[#0e4a78]/[0.06]', border: 'border-[#0e4a78]/15', valueColor: 'text-[#0e4a78]',   activeBg: 'bg-[#0e4a78]'   },
  emerald: { accent: '#059669', iconColor: 'text-emerald-600', cardBg: 'bg-emerald-50',       border: 'border-emerald-200',  valueColor: 'text-emerald-700', activeBg: 'bg-emerald-600' },
  amber:   { accent: '#d97706', iconColor: 'text-amber-600',   cardBg: 'bg-amber-50',         border: 'border-amber-200',    valueColor: 'text-amber-700',   activeBg: 'bg-amber-500'   },
  violet:  { accent: '#7c3aed', iconColor: 'text-violet-600',  cardBg: 'bg-violet-50',        border: 'border-violet-200',   valueColor: 'text-violet-700',  activeBg: 'bg-violet-600'  },
  sky:     { accent: '#0284c7', iconColor: 'text-sky-600',     cardBg: 'bg-sky-50',           border: 'border-sky-200',      valueColor: 'text-sky-700',     activeBg: 'bg-sky-600'     },
  rose:    { accent: '#e11d48', iconColor: 'text-rose-600',    cardBg: 'bg-rose-50',          border: 'border-rose-200',     valueColor: 'text-rose-700',    activeBg: 'bg-rose-600'    },
  teal:    { accent: '#0d9488', iconColor: 'text-teal-600',    cardBg: 'bg-teal-50',          border: 'border-teal-200',     valueColor: 'text-teal-700',    activeBg: 'bg-teal-600'    },
}

const fmt = (v) => (typeof v === 'number' ? v.toLocaleString() : v)

/**
 * A single KPI tile. Non-interactive by default; pass `onClick` to make it a
 * filter-toggle button (isActive controls the highlighted state).
 */
export const StatCard = ({ label, value, icon: Icon, tone = 'slate', total, isActive, onClick }) => {
  const t = STAT_TONES[tone] || STAT_TONES.slate
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const clickable = typeof onClick === 'function'
  const Tag = clickable ? 'button' : 'div'
  return (
    <Tag
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={`group relative text-left overflow-hidden rounded-xl border transition-all duration-150 ${t.cardBg} ${
        isActive ? `${t.border} shadow-sm ring-1 ring-inset ring-current` : clickable ? 'border-transparent hover:border-current/20 hover:shadow-sm' : t.border
      }`}
      style={isActive ? { color: t.accent } : undefined}
    >
      <div className="px-3.5 py-3 flex items-center gap-3">
        <span className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg shadow-sm transition-all duration-150 ${
          clickable && isActive ? `${t.activeBg} text-white` : `bg-white ${t.iconColor}`
        }`}>
          {Icon && <Icon className="text-[15px]" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500 leading-tight mb-1 truncate">
            {label}
          </p>
          <p className={`text-xl font-black leading-none tracking-tight transition-colors ${clickable && !isActive ? 'text-slate-700' : t.valueColor}`}>
            {fmt(value)}
          </p>
        </div>
        {total > 0 && tone !== 'slate' && (
          <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white" style={{ color: t.accent }}>
            {pct}%
          </span>
        )}
      </div>
      {clickable && (
        <div className="h-[2px] bg-black/5">
          {total > 0 && tone !== 'slate' && (
            <div className="h-full transition-all duration-700 rounded-full" style={{ width: `${pct}%`, background: t.accent }} />
          )}
        </div>
      )}
    </Tag>
  )
}

/**
 * Wraps a row of <StatCard>s in the "stats zone" — a distinct tinted section
 * (separate from the filter toolbar's plain white surface) with its own
 * light background and generous card gaps, so stats never read as part of
 * the filter bar above/below it.
 *
 * cols: Tailwind grid-cols classes, responsive-ready, e.g.
 *   "grid-cols-2 sm:grid-cols-4 lg:grid-cols-8"
 */
export const StatGrid = ({ children, cols = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6', className = '' }) => (
  <div className={`rounded-2xl border border-slate-200/70 bg-slate-50/60 p-3 ${className}`}>
    <div className={`grid ${cols} gap-2.5`}>
      {children}
    </div>
  </div>
)

export default StatCard
