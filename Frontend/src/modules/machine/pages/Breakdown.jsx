import React, { useState, useMemo, useEffect } from 'react'
import {
  FiAlertTriangle, FiTool, FiCheckCircle, FiClock, FiEdit2, FiTrash2,
  FiPlus, FiX, FiSave, FiRefreshCw, FiSearch, FiActivity,
  FiCalendar, FiZap, FiShield, FiSettings
} from 'react-icons/fi'
import { FaWrench, FaExclamationTriangle, FaCheckCircle, FaHourglassHalf } from 'react-icons/fa'
import { MdOutlineEngineering, MdConstruction } from 'react-icons/md'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import {
  useGetEquipmentQuery,
  useGetBreakdownsQuery,
  useAddBreakdownMutation,
  useUpdateBreakdownMutation,
  useDeleteBreakdownMutation,
  useCloseBreakdownMutation,
} from '../../../store/api/ymsApi'
import { notify } from '../../../utils/notify'

const REMARK_TYPES = ['Breakdown', 'Daily Check', 'Maintenance', 'Change']

const REMARK_META = {
  'Breakdown':    { color: 'red',    icon: FiAlertTriangle, bg: 'bg-red-50',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700',    ring: 'ring-red-400' },
  'Daily Check':  { color: 'emerald', icon: FiCheckCircle,  bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-400' },
  'Maintenance':  { color: 'blue',   icon: FiTool,         bg: 'bg-blue-50',    text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700',   ring: 'ring-blue-400' },
  'Change':       { color: 'amber',  icon: FiSettings,     bg: 'bg-amber-50',   text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700', ring: 'ring-amber-400' },
}

function calcTAT(start, end) {
  if (!start || !end) return '—'
  const diff = Math.abs(new Date(end) - new Date(start))
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`
}

function fmtDT(val) {
  if (!val) return '—'
  const d = new Date(String(val).replace(' ', 'T'))
  if (isNaN(d)) return val
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const getEqpId   = (eqp) => eqp?.Eqp_ID   ?? eqp?.eqp_id   ?? eqp?.EQP_ID
const getEqpName = (eqp) => eqp?.Equipment_Name ?? eqp?.equipment_name ?? eqp?.EQUIPMENT_NAME ?? `EQP-${getEqpId(eqp)}`
const getEqpType = (eqp) => eqp?.Equipment_Type ?? eqp?.equipment_type ?? eqp?.EQUIPMENT_TYPE ?? 'Equipment'

export default function Breakdown() {
  const [selectedEqp, setSelectedEqp] = useState(null)
  const [formMode, setFormMode] = useState('add')   // 'add' | 'edit'
  const [editRow, setEditRow] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ brkid: 0, vehicle_id: '', maintance_start: '', maintance_end: '', reason: '' })

  // Real API data
  const { data: equipmentData, isLoading: eqpLoading } = useGetEquipmentQuery()
  const { data: breakdownData, isLoading: bdLoading, refetch } = useGetBreakdownsQuery(
    selectedEqp ? { eqp_id: getEqpId(selectedEqp) } : {},
    { skip: false }
  )
  const [addBreakdown, { isLoading: adding }] = useAddBreakdownMutation()
  const [updateBreakdown, { isLoading: updating }] = useUpdateBreakdownMutation()
  const [deleteBreakdown] = useDeleteBreakdownMutation()
  const [closeBreakdown] = useCloseBreakdownMutation()

  const machines = useMemo(() => {
    const list = Array.isArray(equipmentData?.data) ? equipmentData.data
      : Array.isArray(equipmentData) ? equipmentData : []
    return list.filter(e => (e.IsActive ?? e.is_active ?? true) !== false && (e.IsActive ?? e.is_active ?? 1) !== 0)
  }, [equipmentData])

  const breakdowns = useMemo(() => {
    const list = breakdownData?.data || []
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(r =>
      (r.EQUIPMENT_NAME || r.equipment_name || '').toLowerCase().includes(q) ||
      (r.REMARK_TYPE || r.remark_type || '').toLowerCase().includes(q) ||
      (r.STATUS || r.status || '').toLowerCase().includes(q)
    )
  }, [breakdownData, search])

  // Stats derived from ALL breakdowns (unfiltered)
  const allBreakdowns = breakdownData?.data || []
  const statsOpen  = allBreakdowns.filter(r => (r.STATUS || r.status || '').toLowerCase() === 'open').length
  const statsClosed = allBreakdowns.filter(r => (r.STATUS || r.status || '').toLowerCase() === 'closed').length
  const statsBreakdown = allBreakdowns.filter(r => (r.REMARK_TYPE || r.remark_type || '') === 'Breakdown').length

  // When machine selected, pre-fill form
  useEffect(() => {
    if (selectedEqp) {
      setForm(f => ({ ...f, vehicle_id: getEqpId(selectedEqp) }))
    }
  }, [selectedEqp])

  const handleMachineClick = (eqp) => {
    setSelectedEqp(eqp)
    setShowForm(false)
    setFormMode('add')
    setEditRow(null)
    setForm({ brkid: 0, vehicle_id: getEqpId(eqp), maintance_start: '', maintance_end: '', reason: '' })
  }

  const openAddForm = () => {
    if (!selectedEqp) { notify.warning('Please select a machine first'); return }
    setFormMode('add')
    setEditRow(null)
    setForm({ brkid: 0, vehicle_id: getEqpId(selectedEqp), maintance_start: '', maintance_end: '', reason: '' })
    setShowForm(true)
  }

  const openEditForm = (row) => {
    setFormMode('edit')
    setEditRow(row)
    const brkid     = row.BRKID      || row.BrkId      || row.brkid      || 0
    const vehicleId = row.VehicleID  || row.VEHICLEID  || row.vehicle_id || row.EQP_ID || row.eqp_id
    setForm({
      brkid,
      vehicle_id:      vehicleId,
      maintance_start: (row.MaintanceStart || row.MAINTANCESTART || row.START_TIME || '').replace(' ', 'T').slice(0, 16),
      maintance_end:   (row.MaintanceEnd   || row.MAINTANCEEND   || row.END_TIME   || '').replace(' ', 'T').slice(0, 16),
      reason:          row.Reason || row.REASON || row.REMARK_TYPE || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.vehicle_id || !form.maintance_start || !form.reason) {
      notify.warning('Machine, Start Time and Reason are required')
      return
    }
    const payload = {
      brkid:          Number(form.brkid) || 0,
      vehicle_id:     Number(form.vehicle_id),
      maintance_start: form.maintance_start.replace('T', ' '),
      maintance_end:   form.maintance_end ? form.maintance_end.replace('T', ' ') : null,
      reason:          form.reason,
    }
    try {
      const fn  = formMode === 'add' ? addBreakdown : updateBreakdown
      const res = await fn(payload).unwrap()
      if (res.status === 'success') {
        notify.success(formMode === 'add' ? 'Breakdown record added' : 'Breakdown record updated')
        setShowForm(false)
        refetch()
      } else {
        notify.error(res.message || 'Failed to save')
      }
    } catch { notify.error('An error occurred') }
  }

  const handleDelete = async (row) => {
    if (!window.confirm('Delete this breakdown record?')) return
    try {
      const brkid = row.BRKID || row.BrkId || row.brkid
      const res = await deleteBreakdown({ brkid }).unwrap()
      if (res.status === 'success') { notify.success('Record deleted'); refetch() }
      else notify.error(res.message)
    } catch { notify.error('Delete failed') }
  }

  const handleClose = async (row) => {
    const brkid = row.BRKID || row.BrkId || row.brkid
    const now   = new Date().toISOString().replace('T', ' ').slice(0, 19)
    try {
      const res = await closeBreakdown({ brkid, end_time: now }).unwrap()
      if (res.status === 'success') { notify.success('Breakdown closed'); refetch() }
      else notify.error(res.message)
    } catch { notify.error('Close failed') }
  }

  const machineStatus = (eqp) => {
    const id = getEqpId(eqp)
    const openCount = allBreakdowns.filter(r =>
      ((r.EQP_ID || r.eqp_id) === id) &&
      (r.STATUS || r.status || '').toLowerCase() === 'open'
    ).length
    return openCount > 0 ? 'breakdown' : 'ok'
  }

  const RemarkIcon = ({ type, size = 'sm' }) => {
    const meta = REMARK_META[type] || REMARK_META['Maintenance']
    const Icon = meta.icon
    const sz = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
    return <Icon className={`${sz} ${meta.text}`} />
  }

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden bg-cover bg-center selection:bg-[#0e4a78] selection:text-white"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/85 via-slate-50/80 to-blue-50/75 backdrop-blur-[1px]" />
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 relative z-10 space-y-6">

        {/* ── PAGE HEADER ──────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0e4a78] flex items-center justify-center shadow-lg">
              <MdOutlineEngineering className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0e4a78] leading-tight">Machine Breakdown</h1>
              <p className="text-xs text-slate-500 font-medium">Log & Track Equipment Maintenance Events</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 transition shadow-sm"
            >
              <FiRefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button
              onClick={openAddForm}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#0e4a78] hover:bg-[#0b3e66] rounded-lg shadow-md transition"
            >
              <FiPlus className="w-3.5 h-3.5" /> Log Breakdown
            </button>
          </div>
        </div>

        {/* ── STAT CARDS ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Machines', value: machines.length, icon: MdConstruction, color: 'blue',   bg: 'from-blue-600 to-[#0e4a78]' },
            { label: 'Open Breakdowns', value: statsOpen,    icon: FaExclamationTriangle, color: 'red',   bg: 'from-red-500 to-red-700' },
            { label: 'Closed Today',   value: statsClosed,   icon: FaCheckCircle,  color: 'green', bg: 'from-emerald-500 to-emerald-700' },
            { label: 'Breakdown Events', value: statsBreakdown, icon: FaHourglassHalf, color: 'amber', bg: 'from-amber-500 to-orange-600' },
          ].map(({ label, value, icon: Icon, bg }) => (
            <div key={label} className="relative overflow-hidden rounded-2xl shadow-lg">
              <div className={`bg-gradient-to-br ${bg} p-5 text-white`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold opacity-80 uppercase tracking-wide">{label}</p>
                    <p className="text-3xl font-black mt-1">{value}</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── MAIN LAYOUT: Machine Grid + Form ─────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* Machine Selection Grid */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden h-full">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <FiZap className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wide">Select Machine</h2>
                  <p className="text-xs text-blue-200">Click to select & filter records</p>
                </div>
              </div>

              <div className="p-5">
                {eqpLoading ? (
                  <div className="flex items-center justify-center h-32 text-slate-400 gap-2">
                    <FiRefreshCw className="animate-spin w-5 h-5" />
                    <span className="text-sm">Loading machines...</span>
                  </div>
                ) : machines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
                    <MdConstruction className="w-8 h-8" />
                    <span className="text-sm">No machines found</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 gap-3">
                    {machines.map((eqp) => {
                      const name = getEqpName(eqp)
                      const isSelected = getEqpId(selectedEqp) === getEqpId(eqp)
                      const status = machineStatus(eqp)
                      const isBreakdown = status === 'breakdown'

                      return (
                        <button
                          key={eqp.Eqp_ID}
                          onClick={() => handleMachineClick(eqp)}
                          className={`
                            relative group flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200
                            ${isSelected
                              ? 'bg-[#0e4a78] border-[#0e4a78] text-white shadow-xl scale-[1.03] ring-2 ring-[#0e4a78]/30 ring-offset-2'
                              : isBreakdown
                                ? 'bg-red-50 border-red-300 text-red-700 hover:border-red-400 hover:shadow-lg hover:-translate-y-0.5'
                                : 'bg-white border-slate-200 text-[#0e4a78] hover:border-[#0e4a78]/50 hover:shadow-lg hover:-translate-y-0.5'
                            }
                          `}
                        >
                          {/* Status dot */}
                          <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 ${
                            isSelected ? 'bg-green-400 border-white' :
                            isBreakdown ? 'bg-red-500 border-red-200 animate-pulse' : 'bg-emerald-400 border-white'
                          }`} />
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 transition-colors ${
                            isSelected ? 'bg-white/20' : isBreakdown ? 'bg-red-100' : 'bg-blue-50'
                          }`}>
                            <MdOutlineEngineering className={`w-5 h-5 ${isSelected ? 'text-white' : isBreakdown ? 'text-red-600' : 'text-[#0e4a78]'}`} />
                          </div>
                          <span className="text-xs font-bold uppercase tracking-wide leading-tight text-center">{name}</span>
                          <span className={`text-[10px] mt-1 font-semibold ${
                            isSelected ? 'text-blue-200' : isBreakdown ? 'text-red-500' : 'text-emerald-600'
                          }`}>
                            {isBreakdown ? 'Breakdown' : 'Active'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {selectedEqp && (
                <div className="mx-5 mb-5 p-3 bg-blue-50 rounded-xl border border-blue-200 flex items-center gap-2">
                  <FiActivity className="w-4 h-4 text-[#0e4a78] flex-shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-[#0e4a78]">{getEqpName(selectedEqp)}</span>
                    <span className="text-slate-500"> — {getEqpType(selectedEqp)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Log Form */}
          <div className="xl:col-span-3">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden h-full">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <FaWrench className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                    {showForm ? (formMode === 'edit' ? 'Edit Record' : 'Log Maintenance Action') : 'Maintenance Action'}
                  </h2>
                  <p className="text-xs text-blue-200">
                    {selectedEqp
                      ? `Selected: ${getEqpName(selectedEqp)}`
                      : 'Select a machine on the left to begin'}
                  </p>
                </div>
                {showForm && (
                  <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition">
                    <FiX className="w-4 h-4 text-white" />
                  </button>
                )}
              </div>

              {!showForm ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400 p-6">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <MdConstruction className="w-8 h-8 text-slate-300" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-500">
                      {selectedEqp ? 'Ready to log a breakdown event' : 'Select a machine to get started'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {selectedEqp ? 'Click "Log Breakdown" to record a new maintenance event' : 'Pick a machine from the grid on the left'}
                    </p>
                  </div>
                  {selectedEqp && (
                    <button
                      onClick={openAddForm}
                      className="flex items-center gap-2 px-5 py-2 bg-[#0e4a78] text-white text-sm font-bold rounded-xl shadow-md hover:bg-[#0b3e66] transition"
                    >
                      <FiPlus className="w-4 h-4" /> Log New Breakdown
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-6 space-y-5">
                  {/* MACHINE */}
                  <div className="grid grid-cols-12 items-center gap-3">
                    <label className="col-span-3 text-right text-[11px] font-bold text-slate-600 uppercase tracking-wide">Machine</label>
                    <div className="col-span-9">
                      <select
                        value={form.vehicle_id}
                        onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/40 focus:border-[#0e4a78] transition bg-white shadow-sm"
                      >
                        <option value="">— Select Machine —</option>
                        {machines.map(m => (
                          <option key={getEqpId(m)} value={getEqpId(m)}>
                            {getEqpName(m)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* START TIME */}
                  <div className="grid grid-cols-12 items-center gap-3">
                    <label className="col-span-3 text-right text-[11px] font-bold text-slate-600 uppercase tracking-wide">Start Time</label>
                    <div className="col-span-9 relative">
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="datetime-local"
                        value={form.maintance_start}
                        onChange={e => setForm(f => ({ ...f, maintance_start: e.target.value }))}
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/40 focus:border-[#0e4a78] transition shadow-sm"
                      />
                    </div>
                  </div>

                  {/* END TIME */}
                  <div className="grid grid-cols-12 items-center gap-3">
                    <label className="col-span-3 text-right text-[11px] font-bold text-slate-600 uppercase tracking-wide">End Time</label>
                    <div className="col-span-9 relative">
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="datetime-local"
                        value={form.maintance_end}
                        onChange={e => setForm(f => ({ ...f, maintance_end: e.target.value }))}
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/40 focus:border-[#0e4a78] transition shadow-sm"
                      />
                    </div>
                  </div>

                  {/* REASON */}
                  <div className="grid grid-cols-12 items-start gap-3">
                    <label className="col-span-3 text-right text-[11px] font-bold text-slate-600 uppercase tracking-wide pt-2.5">Reason</label>
                    <div className="col-span-9">
                      <textarea
                        rows={2}
                        value={form.reason}
                        onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                        placeholder="Enter reason / remarks..."
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/40 focus:border-[#0e4a78] transition shadow-sm resize-none"
                      />
                    </div>
                  </div>

                  {/* TAT Preview */}
                  {form.maintance_start && form.maintance_end && (
                    <div className="grid grid-cols-12 items-center gap-3">
                      <div className="col-span-3" />
                      <div className="col-span-9 flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl border border-blue-200">
                        <FiClock className="w-4 h-4 text-[#0e4a78]" />
                        <span className="text-xs font-bold text-[#0e4a78]">TAT: {calcTAT(form.maintance_start, form.maintance_end)}</span>
                      </div>
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setShowForm(false)}
                      className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-sm transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={adding || updating}
                      className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-[#0e4a78] hover:bg-[#0b3e66] rounded-xl shadow-md transition disabled:opacity-60"
                    >
                      {(adding || updating) ? <FiRefreshCw className="animate-spin w-4 h-4" /> : <FiSave className="w-4 h-4" />}
                      {formMode === 'edit' ? 'Update' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── BREAKDOWN TABLE ───────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                <FiActivity className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                  {selectedEqp
                    ? `Breakdown Log — ${selectedEqp.EQUIPMENT_NAME || selectedEqp.equipment_name}`
                    : '24h Breakdown Details — All Machines'}
                </h2>
                <p className="text-xs text-blue-200">{breakdowns.length} record(s) found</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search records..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-white/20 text-white placeholder:text-white/50 border border-white/30 rounded-lg focus:outline-none focus:bg-white/30 w-44 transition"
                />
              </div>
              {selectedEqp && (
                <button
                  onClick={() => { setSelectedEqp(null); setSearch('') }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-white/20 hover:bg-white/30 rounded-lg border border-white/30 transition"
                >
                  <FiX className="w-3.5 h-3.5" /> All
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            {bdLoading ? (
              <div className="flex items-center justify-center h-32 gap-2 text-slate-400">
                <FiRefreshCw className="animate-spin w-5 h-5" />
                <span className="text-sm">Loading breakdown records...</span>
              </div>
            ) : breakdowns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-400">
                <FiShield className="w-8 h-8" />
                <span className="text-sm font-medium">No breakdown records found</span>
                <span className="text-xs">Select a machine and log a new event</span>
              </div>
            ) : (
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-slate-200">
                    {['#', 'MACHINE', 'START TIME', 'END TIME', 'TAT', 'REASON', 'STATUS', 'ACTIONS'].map(h => (
                      <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-[#0e4a78] uppercase tracking-wider whitespace-nowrap border-r last:border-r-0 border-slate-200">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {breakdowns.map((row, idx) => {
                    const eqpName  = row.Equipment_Name || row.EQUIPMENT_NAME || row.equipment_name || '—'
                    const start    = row.MaintanceStart || row.MAINTANCESTART || row.START_TIME || row.start_time
                    const end      = row.MaintanceEnd   || row.MAINTANCEEND   || row.END_TIME   || row.end_time
                    const reason   = row.Reason || row.REASON || row.REMARK_TYPE || row.remark_type || '—'
                    const isOpen   = !end

                    return (
                      <tr key={idx} className="hover:bg-blue-50/40 transition-colors group">
                        <td className="px-4 py-3.5 text-xs text-slate-400 font-mono border-r border-slate-100">{idx + 1}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-[#0e4a78]/10 flex items-center justify-center flex-shrink-0">
                              <MdOutlineEngineering className="w-3.5 h-3.5 text-[#0e4a78]" />
                            </div>
                            <span className="font-bold text-slate-800 text-xs">{eqpName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap border-r border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <FiCalendar className="w-3 h-3 text-slate-400" />
                            {fmtDT(start)}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap border-r border-slate-100">
                          {end ? (
                            <div className="flex items-center gap-1.5">
                              <FiCalendar className="w-3 h-3 text-slate-400" />
                              {fmtDT(end)}
                            </div>
                          ) : (
                            <span className="text-amber-500 font-semibold flex items-center gap-1">
                              <FiClock className="w-3 h-3 animate-pulse" /> In Progress
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 border-r border-slate-100">
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                            {calcTAT(start, end)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 border-r border-slate-100">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700">
                            <FiTool className="w-3 h-3" />
                            {reason}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 border-r border-slate-100">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide
                            ${isOpen ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                            {isOpen ? 'Open' : 'Closed'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                            {isOpen && (
                              <button
                                onClick={() => handleClose(row)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                                title="Close Breakdown"
                              >
                                <FiCheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => openEditForm(row)}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit"
                            >
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(row)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {breakdowns.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs text-slate-500">
              <span>Showing <span className="font-bold text-slate-700">{breakdowns.length}</span> record(s)</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  {statsOpen} Open
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {statsClosed} Closed
                </span>
              </div>
            </div>
          )}
        </div>

      </main>
      <Footer />
    </div>
  )
}
