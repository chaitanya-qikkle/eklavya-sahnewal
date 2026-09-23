import React from 'react'
import { FiRefreshCw, FiX } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'

// ─── Shared Filter Bar system ──────────────────────────────────────────────
// Canonical filter-toolbar design used across every report/gate/container/
// trailer page. Renders as a flat white bordered bar — deliberately plain,
// so it reads as a distinct "controls" surface, never confusable with the
// tinted StatCard KPI zone.

/** Uppercase micro-label used above every filter control. */
export const FilterLabel = ({ icon: Icon, children }) => (
  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
    {Icon && <Icon size={10} className="text-[#0e4a78]" />}
    {children}
  </label>
)

const fieldCls =
  'border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] transition-all'

/** A single filter field: label + input/select, consistent width/spacing. */
export const FilterField = ({ label, icon, className = '', children }) => (
  <div className={`flex flex-col gap-0.5 ${className}`}>
    {label && <FilterLabel icon={icon}>{label}</FilterLabel>}
    {children}
  </div>
)

export const filterInputCls = fieldCls

/** Convenience wrapper for a plain text/date/datetime input filter field. */
export const FilterInput = (props) => {
  const { label, icon, className, wrapperClassName, ...rest } = props
  return (
    <FilterField label={label} icon={icon} className={wrapperClassName}>
      <input {...rest} className={`${fieldCls} ${className || ''}`} />
    </FilterField>
  )
}

/** Convenience wrapper for a <select> filter field. */
export const FilterSelect = ({ label, icon, className, wrapperClassName, children, ...rest }) => (
  <FilterField label={label} icon={icon} className={wrapperClassName}>
    <select {...rest} className={`${fieldCls} cursor-pointer ${className || ''}`}>
      {children}
    </select>
  </FilterField>
)

/**
 * The outer toolbar surface. Plain white card, border, modest shadow — the
 * "controls" zone. Place this above/separate from a <StatGrid>, or pass
 * `bare` to drop its own border/shadow when composed inside a <FilterCard>
 * alongside a `bare` <StatGrid>.
 */
export const FilterBar = ({ children, className = '', title, icon: Icon, bare = false }) => (
  <section className={bare ? `bg-white ${className}` : `bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
    {title && (
      <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-4 md:px-5 py-2.5 flex items-center gap-2">
        {Icon && <Icon className="text-blue-200" size={14} />}
        <h2 className="text-white font-bold text-[13px] tracking-wide uppercase">{title}</h2>
      </div>
    )}
    <div className="p-4 flex flex-wrap items-end gap-3">
      {children}
    </div>
  </section>
)

/** Standard "Search" action button. */
export const FilterSearchBtn = ({ onClick, loading, children = 'Search' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    className="flex items-center gap-2 bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-5 py-2 rounded-lg text-sm font-bold shadow hover:from-[#0b3e66] hover:to-[#072c4a] transition-all disabled:opacity-60"
  >
    <FiRefreshCw className={loading ? 'animate-spin' : ''} size={13} />
    {loading ? 'Loading…' : children}
  </button>
)

/** Standard "Clear" action button. */
export const FilterClearBtn = ({ onClick, children = 'Clear' }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-100 transition-all"
  >
    <FiX size={13} />
    {children}
  </button>
)

/**
 * Standard "Export to Excel" action button. Always the last button in the
 * filter bar's action group (after Clear and Search), so every page's
 * export control has the same look and the same position.
 */
export const FilterExportBtn = ({ onClick, loading, disabled, children = 'Export' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || loading}
    title="Export to Excel"
    className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-40"
  >
    <FaFileExcel size={13} className={loading ? 'animate-pulse' : ''} />
    {loading ? 'Exporting…' : children}
  </button>
)

export default FilterBar
