import React, { useState, useMemo } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FiFilter, FiSearch, FiChevronUp, FiChevronDown, FiPackage, FiClock } from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { writeXlsx } from '../../../utils/excelDates'
import { StatCard, StatGrid, FilterCard } from '../../../components/ui/StatCard'
import { FilterBar, FilterField, FilterClearBtn, FilterSearchBtn, FilterExportBtn } from '../../../components/ui/FilterBar'
import { useGetContainerAgeingDetailsQuery } from '../../../store/api/ymsApi'

const BUCKETS = ['0-5 Days', '6-10 Days', '11-20 Days', '21-30 Days', 'Above 30 Days']
const BUCKET_CARD_LABELS = ['0-5 Days', '6-10 Days', '11-20 Days', '21-30 Days', '30+ Days']
const BUCKET_TONES = ['emerald', 'violet', 'amber', 'orange', 'rose']
const PROCESSES = ['EMPTY', 'DOMESTIC', 'EXPORT', 'IMPORT']

const formatDate = (raw) => {
  if (!raw) return '—'
  const d = new Date(String(raw).replace(' ', 'T'))
  if (isNaN(d)) return String(raw)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const StatusBadge = ({ val }) => {
  if (!val) return <span className="text-slate-300 text-xs">—</span>
  const u = String(val).toUpperCase()
  const cls = u.includes('EMPTY') ? 'bg-slate-100 text-slate-600'
    : u.includes('LADEN') || u.includes('IMPORT') || u.includes('EXPORT') ? 'bg-blue-100 text-blue-700'
    : 'bg-green-100 text-green-700'
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{val}</span>
}

const BucketBadge = ({ val }) => {
  const cls = val === '0-5 Days' ? 'bg-emerald-100 text-emerald-700'
    : val === '6-10 Days' ? 'bg-violet-100 text-violet-700'
    : val === '11-20 Days' ? 'bg-amber-100 text-amber-700'
    : val === '21-30 Days' ? 'bg-orange-100 text-orange-700'
    : 'bg-rose-100 text-rose-700'
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${cls}`}>{val || '—'}</span>
}

const EMPTY_FILTERS = { ContNo: '', Process: '', ShippingLine: '', AgingDays: '' }

const COLS = [
  { key: 'ContNo',          label: 'Container No' },
  { key: 'ContainerSize',   label: 'Size' },
  { key: 'ContainerType',   label: 'Type' },
  { key: 'Process',         label: 'Process' },
  { key: 'ContainerStatus', label: 'Status' },
  { key: 'ShippingLine',    label: 'Shipping Line' },
  { key: 'GateInDate',      label: 'Gate In Date' },
  { key: 'AgingDays',       label: 'Ageing Bucket' },
]

const ContainerAgeingReport = () => {
  const { data, isFetching, error, refetch } = useGetContainerAgeingDetailsQuery()
  const [filters, setFilters]       = useState(EMPTY_FILTERS)
  const [sortConfig, setSortConfig] = useState({ key: null, dir: null })

  const setFilter = (k, v) => setFilters((p) => ({ ...p, [k]: v }))

  const records = useMemo(() => data || [], [data])

  const shippingLines = useMemo(
    () => [...new Set(records.map((r) => r.ShippingLine).filter(Boolean))].sort(),
    [records]
  )

  const stats = useMemo(() => {
    const byBucket = (b) => records.filter((r) => r.AgingDays === b).length
    return { total: records.length, buckets: BUCKETS.map(byBucket) }
  }, [records])

  const filtered = useMemo(() => {
    const rows = records.filter((r) =>
      (!filters.ContNo || String(r.ContNo || '').toLowerCase().includes(filters.ContNo.toLowerCase())) &&
      (!filters.Process || String(r.Process || '').toUpperCase() === filters.Process) &&
      (!filters.ShippingLine || r.ShippingLine === filters.ShippingLine) &&
      (!filters.AgingDays || r.AgingDays === filters.AgingDays)
    )
    if (!sortConfig.key || !sortConfig.dir) return rows
    const m = sortConfig.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      if (sortConfig.key === 'GateInDate') {
        const ad = a.GateInDate ? new Date(String(a.GateInDate).replace(' ', 'T')).getTime() : 0
        const bd = b.GateInDate ? new Date(String(b.GateInDate).replace(' ', 'T')).getTime() : 0
        return (ad - bd) * m
      }
      if (sortConfig.key === 'AgingDays') return (BUCKETS.indexOf(a.AgingDays) - BUCKETS.indexOf(b.AgingDays)) * m
      return String(a[sortConfig.key] ?? '').toLowerCase().localeCompare(String(b[sortConfig.key] ?? '').toLowerCase()) * m
    })
  }, [records, filters, sortConfig])

  const handleSort = (key) =>
    setSortConfig((p) => {
      if (p.key !== key) return { key, dir: 'asc' }
      if (p.dir === 'asc') return { key, dir: 'desc' }
      return { key: null, dir: null }
    })

  const handleClear = () => { setFilters(EMPTY_FILTERS); setSortConfig({ key: null, dir: null }) }

  const handleExport = () => {
    if (!filtered.length) return
    const rows = filtered.map((r, i) => ({
      '#': i + 1,
      'Container No': r.ContNo || '',
      'Size': r.ContainerSize || '',
      'Type': r.ContainerType || '',
      'Process': r.Process || '',
      'Status': r.ContainerStatus || '',
      'Shipping Line': r.ShippingLine || '',
      'Gate In Date': formatDate(r.GateInDate),
      'Ageing Bucket': r.AgingDays || '',
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Container Ageing')
    writeXlsx(wb, `ContainerAgeing_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const errMsg = error ? (error?.data?.detail || error?.data?.message || `Server error (${error?.status})`) : null

  const SortIcon = ({ colKey }) => (
    <span className="inline-flex flex-col ml-1">
      <FiChevronUp className={`w-3 h-3 ${sortConfig.key === colKey && sortConfig.dir === 'asc' ? 'text-white' : 'text-white/30'}`} />
      <FiChevronDown className={`w-3 h-3 -mt-1 ${sortConfig.key === colKey && sortConfig.dir === 'desc' ? 'text-white' : 'text-white/30'}`} />
    </span>
  )

  const inputCls = "border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78]"

  return (
    <div className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
         style={{ backgroundImage: "url('/Images/bgimageold.png')" }}>
      <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px]" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 space-y-5">

          <header className="px-1">
            <h2 className="text-lg font-bold tracking-wide text-[#0e4a78] uppercase flex items-center gap-2">
              <FiClock /> Container Ageing Report
            </h2>
          </header>

          <FilterCard>
            <StatGrid cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" bare>
              <StatCard label="Total" value={stats.total} icon={FiPackage} tone="slate"
                isActive={!filters.AgingDays} onClick={() => setFilter('AgingDays', '')} total={stats.total} />
              {BUCKETS.map((b, i) => (
                <StatCard key={b} label={BUCKET_CARD_LABELS[i]} value={stats.buckets[i]} icon={FiClock} tone={BUCKET_TONES[i]}
                  isActive={filters.AgingDays === b} onClick={() => setFilter('AgingDays', b)} total={stats.total} />
              ))}
            </StatGrid>

            <FilterBar bare>
              <FilterField label="Container No" icon={FiSearch} className="flex-1 min-w-[160px]">
                <input type="text" placeholder="Search container…" value={filters.ContNo}
                  onChange={(e) => setFilter('ContNo', e.target.value.toUpperCase())} className={inputCls} />
              </FilterField>

              <FilterField label="Process" icon={FiFilter}>
                <select value={filters.Process} onChange={(e) => setFilter('Process', e.target.value)}
                  className={`${inputCls} min-w-[130px]`}>
                  <option value="">All</option>
                  {PROCESSES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </FilterField>

              <FilterField label="Shipping Line" icon={FiFilter}>
                <select value={filters.ShippingLine} onChange={(e) => setFilter('ShippingLine', e.target.value)}
                  className={`${inputCls} min-w-[150px]`}>
                  <option value="">All</option>
                  {shippingLines.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </FilterField>

              <div className="flex gap-2">
                <FilterClearBtn onClick={handleClear} />
                <FilterSearchBtn onClick={refetch} loading={isFetching} />
              </div>
            </FilterBar>
          </FilterCard>

          <section className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-5 py-3 flex items-center justify-between">
              <h2 className="text-white font-bold text-base tracking-wide uppercase">
                Ageing Summary
                {!isFetching && <span className="ml-2 text-blue-200 font-normal text-sm">— {records.length} record(s)</span>}
              </h2>
              <FilterExportBtn onClick={handleExport} disabled={!filtered.length} />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white text-[11px] uppercase tracking-wider">
                    <th className="px-3 py-3 text-left font-bold border-r border-white/20 w-10">#</th>
                    {COLS.map(({ key, label }) => (
                      <th key={key} onClick={() => handleSort(key)}
                        className="px-3 py-3 text-left font-bold border-r border-white/20 last:border-r-0 cursor-pointer hover:bg-white/10 select-none whitespace-nowrap">
                        <div className="flex items-center gap-1">{label}<SortIcon colKey={key} /></div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isFetching ? (
                    <tr><td colSpan={COLS.length + 1} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-[#0e4a78] border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm">Loading data…</p>
                      </div>
                    </td></tr>
                  ) : errMsg ? (
                    <tr><td colSpan={COLS.length + 1} className="py-10 text-center">
                      <p className="text-red-600 font-semibold text-sm">⚠ {errMsg}</p>
                    </td></tr>
                  ) : filtered.length > 0 ? (
                    filtered.map((row, i) => (
                      <tr key={`${row.ContNo}-${i}`}
                        className={`hover:bg-blue-50/40 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <td className="px-3 py-2.5 text-slate-400 text-xs border-r border-slate-100 text-center">{i + 1}</td>
                        <td className="px-3 py-2.5 font-mono font-semibold text-[#0e4a78] border-r border-slate-100 whitespace-nowrap">{row.ContNo || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100">{row.ContainerSize || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100">{row.ContainerType || '—'}</td>
                        <td className="px-3 py-2.5 border-r border-slate-100"><StatusBadge val={row.Process} /></td>
                        <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100 whitespace-nowrap">{row.ContainerStatus || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100 whitespace-nowrap">{row.ShippingLine || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100 whitespace-nowrap">{formatDate(row.GateInDate)}</td>
                        <td className="px-3 py-2.5"><BucketBadge val={row.AgingDays} /></td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={COLS.length + 1} className="py-12 text-center text-slate-400">
                      <FiFilter className="mx-auto text-3xl text-slate-300 mb-2" />
                      <p className="font-medium text-sm">
                        {records.length > 0 ? 'No records match filters' : 'No records found'}
                      </p>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {records.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
                <span>Showing <strong className="text-[#0e4a78]">{filtered.length}</strong> of <strong className="text-[#0e4a78]">{records.length}</strong> record(s)</span>
                {sortConfig.key && (
                  <span className="text-slate-400">
                    Sorted by: <strong className="text-slate-600">{COLS.find((c) => c.key === sortConfig.key)?.label}</strong> ({sortConfig.dir})
                  </span>
                )}
              </div>
            )}
          </section>
        </main>
        <Footer />
      </div>
    </div>
  )
}

export default ContainerAgeingReport