import React, { useState, useMemo } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FiCalendar, FiSearch, FiFilter, FiX } from 'react-icons/fi'
import { FaFileExcel } from 'react-icons/fa'
import { TbRefresh } from 'react-icons/tb'
import { MdDevices } from 'react-icons/md'
import * as XLSX from 'xlsx'
import {
  useGetEquipmentQuery,
  useLazyGetDeviceRawDataQuery,
} from '../../../store/api/ymsApi'

const formatDateTime = (value) => {
  if (!value) return '—'
  const raw = String(value).trim()
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (m) {
    const [, yyyy, mm, dd, hh = '00', min = '00'] = m
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  const p2 = (n) => String(n).padStart(2, '0')
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

const COLUMNS = [
  { key: 'PACKET_ID',      label: 'Packet ID' },
  { key: 'GPS_FIX',       label: 'GPS Fix' },
  { key: 'DEVICE_IMEI',   label: 'Device IMEI' },
  { key: 'Equipment_Name', label: 'Machine' },
  { key: 'KALMAR_NO',     label: 'Device ID' },
  { key: 'DATE_TIME',     label: 'Date Time', format: formatDateTime },
  { key: 'LATITUDE',      label: 'Latitude' },
  { key: 'LONGITUDE',     label: 'Longitude' },
  { key: 'ANALOG1',       label: 'Analog 1' },
  { key: 'RFIDDATA',      label: 'OCR / RFID' },
]

// All known packet IDs
const ALL_PACKET_IDS = [1, 7, 8]
const DEFAULT_PACKET_IDS = [1, 7, 8]

const LabeledField = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">
      {label}
    </label>
    {children}
  </div>
)

const inputCls =
  'w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-[#0e4a78] shadow-sm transition-colors'

const DeviceRawData = () => {
  const { data: equipmentApi } = useGetEquipmentQuery()
  const [fetchDeviceRawData, { isFetching }] = useLazyGetDeviceRawDataQuery()

  const { imeiList, deviceNameMap } = useMemo(() => {
    const rows = Array.isArray(equipmentApi?.data) ? equipmentApi.data : []
    const seen = new Set()
    const nameMap = new Map()
    const list = rows
      .map((item) => {
        // KalmarNo in the device-data table matches ESS_MST_EQUIPMENT.Equipment_Name (not Equipment_Code/Device_ID)
        const eqpName = String(item?.Equipment_Name ?? item?.equipment_name ?? item?.EQUIPMENT_NAME ?? '').trim()
        const eqpCode = String(item?.Equipment_Code ?? item?.equipment_code ?? item?.EQUIPMENT_CODE ?? '').trim()
        if (eqpName) nameMap.set(eqpName, eqpCode || eqpName)
        const label = eqpCode && eqpCode !== eqpName ? `${eqpCode} (${eqpName})` : eqpName
        return { label, value: eqpName }
      })
      .filter(({ value }) => {
        if (!value || seen.has(value)) return false
        seen.add(value)
        return true
      })
      .sort((a, b) => a.label.localeCompare(b.label))
    return { imeiList: list, deviceNameMap: nameMap }
  }, [equipmentApi])

  const [selectedImei, setSelectedImei]     = useState('')
  const [fromDate, setFromDate]             = useState('')
  const [toDate, setToDate]                 = useState('')
  const [search, setSearch]                 = useState('')
  const [rows, setRows]                     = useState([])
  const [totalCount, setTotalCount]         = useState(null)
  const [error, setError]                   = useState(null)
  const [hasQueried, setHasQueried]         = useState(false)
  const [selectedPacketIds, setSelectedPacketIds] = useState(new Set(DEFAULT_PACKET_IDS))

  const togglePacketId = (id) => {
    setSelectedPacketIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleFilter = async () => {
    setError(null)
    setHasQueried(true)
    try {
      const res = await fetchDeviceRawData({
        machine:   selectedImei || undefined,
        from_date: fromDate     || undefined,
        to_date:   toDate       || undefined,
      }).unwrap()
      const data = Array.isArray(res?.data) ? res.data : []
      setRows(data)
      setTotalCount(res?.total_records ?? data.length)
    } catch (err) {
      setError(err?.data?.detail || err?.data?.message || err?.error || 'Failed to fetch device data.')
      setRows([])
      setTotalCount(null)
    }
  }

  const handleCancel = () => {
    setSelectedImei('')
    setFromDate('')
    setToDate('')
    setSearch('')
    setRows([])
    setTotalCount(null)
    setError(null)
    setHasQueried(false)
    setSelectedPacketIds(new Set(DEFAULT_PACKET_IDS))
  }

  const handleExport = () => {
    if (!filtered.length) return
    const exportRows = filtered.map((r) => {
      const out = {}
      COLUMNS.forEach(({ key, label, format }) => {
        out[label] = format ? format(r[key]) : (r[key] ?? '')
      })
      return out
    })
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'DeviceRawData')
    XLSX.writeFile(wb, `DeviceRawData_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const filtered = useMemo(() => {
    let result = rows

    // Packet ID filter
    if (selectedPacketIds.size > 0 && selectedPacketIds.size < ALL_PACKET_IDS.length + 1) {
      result = result.filter((row) => selectedPacketIds.has(Number(row.PACKET_ID)))
    }

    // Text search
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((row) =>
        COLUMNS.some(({ key }) => String(row[key] ?? '').toLowerCase().includes(q))
      )
    }

    return result
  }, [rows, search, selectedPacketIds])

  return (
    <div
      className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <div className="w-full space-y-6">

            {/* Page Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0e4a78] flex items-center justify-center shadow">
                <MdDevices className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#0e4a78]">Device Raw Data</h1>
                <p className="text-slate-500 text-sm">Raw packet data from field devices</p>
              </div>
            </div>

            {/* Filter Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex items-center gap-2">
                <FiFilter className="text-white text-base" />
                <h2 className="text-white font-bold text-base tracking-wide">Filter</h2>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                  {/* Machine selector */}
                  <LabeledField label="Machine">
                    <select
                      value={selectedImei}
                      onChange={(e) => setSelectedImei(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">— All Machines —</option>
                      {imeiList.map(({ label, value }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </LabeledField>

                  {/* From Date */}
                  <LabeledField label="From Date">
                    <div className="relative">
                      <input
                        type="datetime-local"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className={inputCls + ' pl-10'}
                      />
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </LabeledField>

                  {/* To Date */}
                  <LabeledField label="To Date">
                    <div className="relative">
                      <input
                        type="datetime-local"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className={inputCls + ' pl-10'}
                      />
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </LabeledField>

                  {/* Packet ID filter */}
                  <LabeledField label="Packet ID">
                    <div className="flex items-center gap-2 h-[42px]">
                      {ALL_PACKET_IDS.map((id) => {
                        const active = selectedPacketIds.has(id)
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => togglePacketId(id)}
                            className={`flex-1 h-full rounded-lg border text-sm font-bold transition-colors shadow-sm
                              ${active
                                ? 'bg-[#0e4a78] border-[#0e4a78] text-white'
                                : 'bg-white border-slate-300 text-slate-500 hover:border-[#0e4a78] hover:text-[#0e4a78]'
                              }`}
                          >
                            {id}
                          </button>
                        )
                      })}
                    </div>
                  </LabeledField>

                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-100">
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <FiX />
                    Clear
                  </button>
                  <button
                    onClick={handleFilter}
                    disabled={isFetching}
                    className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-[#0e4a78] text-white text-sm font-bold hover:bg-[#0a3b61] transition-colors shadow-md disabled:opacity-60 uppercase tracking-wide"
                  >
                    {isFetching
                      ? <TbRefresh className="animate-spin text-base" />
                      : <FiFilter className="text-base" />
                    }
                    {isFetching ? 'Loading…' : 'Apply Filter'}
                  </button>
                </div>
              </div>
            </div>

            {/* Results Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-white font-bold text-lg tracking-wide uppercase">Data View</h2>
                  {totalCount !== null && !isFetching && (
                    <p className="text-white/60 text-xs mt-0.5">
                      {filtered.length !== totalCount
                        ? `${filtered.length} filtered / ${totalCount} total`
                        : `${totalCount} records`
                      }
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Search */}
                  <div className="relative">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search…"
                      className="pl-8 pr-3 py-2 rounded-lg border border-white/30 bg-white/10 text-white placeholder-white/50 text-sm focus:outline-none focus:ring-1 focus:ring-white/50 w-44 transition-colors"
                    />
                    <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60 text-sm pointer-events-none" />
                    {search && (
                      <button
                        onClick={() => setSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                      >
                        <FiX className="text-xs" />
                      </button>
                    )}
                  </div>

                  {/* Export */}
                  <button
                    onClick={handleExport}
                    disabled={!filtered.length}
                    title="Export to Excel"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 shadow"
                  >
                    <FaFileExcel />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                {error ? (
                  <div className="px-8 py-12 text-center">
                    <div className="text-red-500 font-semibold text-sm">{error}</div>
                  </div>
                ) : isFetching ? (
                  <div className="px-8 py-12 flex flex-col items-center gap-3 text-slate-400">
                    <div className="w-10 h-10 border-2 border-slate-200 border-t-[#0e4a78] rounded-full animate-spin" />
                    <p className="text-sm font-medium">Loading device packets…</p>
                  </div>
                ) : !hasQueried ? (
                  <div className="px-8 py-14 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                      <MdDevices className="text-slate-400 text-xl" />
                    </div>
                    <p className="text-slate-400 text-sm font-medium">
                      Select filters above and click <strong className="text-slate-600">Apply Filter</strong> to load data.
                    </p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="px-8 py-12 text-center text-slate-400 text-sm">
                    No records match the selected criteria.
                  </div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-10">#</th>
                        {COLUMNS.map((col) => (
                          <th
                            key={col.key}
                            className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.map((row, index) => (
                        <tr
                          key={index}
                          className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/50`}
                        >
                          <td className="px-4 py-3 text-slate-400 font-mono text-xs">{index + 1}</td>
                          {COLUMNS.map((col) => {
                            const raw = row[col.key]
                            let display
                            if (col.format) {
                              display = col.format(raw)
                            } else if (col.key === 'KALMAR_NO') {
                              display = deviceNameMap.get(String(raw ?? '')) || raw || <span className="text-slate-300">—</span>
                            } else {
                              display = raw != null && raw !== '' ? String(raw) : <span className="text-slate-300">—</span>
                            }
                            return (
                              <td key={col.key} className="px-4 py-3 text-slate-700 whitespace-nowrap">
                                {display}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {filtered.length > 0 && !isFetching && (
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
                  <span>Showing <strong className="text-slate-700">{filtered.length}</strong> records</span>
                </div>
              )}
            </div>

          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default DeviceRawData
