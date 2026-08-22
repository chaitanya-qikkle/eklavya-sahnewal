import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { API_ENDPOINTS } from '../../../config/api'
import {
  FiEdit2, FiTrash2, FiSave, FiX, FiRefreshCw, FiPlus,
  FiMapPin, FiHash, FiLayers, FiGrid, FiCheckCircle,
  FiAlertCircle, FiSearch, FiList, FiPackage,
} from 'react-icons/fi'

const getAuthHeaders = () => {
  const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken')
  return { Authorization: `Bearer ${token}` }
}

const EMPTY_FORM = {
  YardName: '',
  YardCode: '',
  BaseStatus: '',
  NoOfRow: '',
  NoOfColumn: '',
  NoOfStack: '',
  MarkingStart: '',
  Size: [],
  IsActive: true,
}

export default function YardMaster() {
  const [activeTab, setActiveTab]     = useState('form')
  const [yards, setYards]             = useState([])
  const [loading, setLoading]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [editingId, setEditingId]     = useState(null)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [search, setSearch]           = useState('')
  const [toast, setToast]             = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchYards = async () => {
    setLoading(true)
    try {
      const res = await axios.get(API_ENDPOINTS.MASTER.GET_YARD_BY_ID, { headers: getAuthHeaders() })
      const raw = res.data?.data || res.data || []
      setYards(Array.isArray(raw) ? raw : [])
    } catch (err) {
      console.error('Fetch yards failed:', err)
      showToast('Failed to load yards', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchYards() }, [])

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleEdit = (yard) => {
    setEditingId(yard.YardID)
    setForm({
      YardName:     yard.YardName     || '',
      YardCode:     yard.YardCode     || '',
      BaseStatus:   yard.BaseStatus   || yard.YardTypeID || '',
      NoOfRow:      yard.NoOfRow      || '',
      NoOfColumn:   yard.NoOfColumn   || '',
      NoOfStack:    yard.NoOfStack    || '',
      MarkingStart: yard.MarkingStart || '',
      Size:  yard.Size ? (Array.isArray(yard.Size) ? yard.Size : [yard.Size]) : [],
      IsActive: yard.IsActive ?? true,
    })
    setActiveTab('form')
  }

  const handleCancel = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const handleSave = async () => {
    if (!form.YardName.trim()) return showToast('Yard Name is required', 'error')
    setSaving(true)
    try {
      if (editingId) {
        await axios.post(API_ENDPOINTS.MASTER.UPDATE_YARD, {
          YardID:     editingId,
          YardName:   form.YardName,
          YardCode:   form.YardCode,
          YardTypeID: form.BaseStatus || null,
          IsActive:   form.IsActive,
        }, { headers: getAuthHeaders() })
        showToast('Yard updated successfully')
      } else {
        await axios.post(API_ENDPOINTS.MASTER.ADD_YARD, {
          YardName:   form.YardName,
          YardCode:   form.YardCode,
          YardTypeID: form.BaseStatus || null,
          IsActive:   form.IsActive,
        }, { headers: getAuthHeaders() })
        showToast('Yard added successfully')
      }
      handleCancel()
      setActiveTab('list')
      await fetchYards()
    } catch (err) {
      console.error('Save failed:', err)
      showToast('Failed to save yard', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (yard) => {
    if (!window.confirm(`Delete yard "${yard.YardName}"?`)) return
    try {
      await axios.delete(API_ENDPOINTS.MASTER.DELETE_YARD, {
        headers: getAuthHeaders(),
        data: { YardID: yard.YardID },
      })
      showToast('Yard deleted successfully')
      if (editingId === yard.YardID) handleCancel()
      await fetchYards()
    } catch (err) {
      console.error('Delete failed:', err)
      showToast('Failed to delete yard', 'error')
    }
  }

  const filteredYards = yards.filter(y =>
    !search ||
    (y.YardName || '').toLowerCase().includes(search.toLowerCase()) ||
    (y.YardCode || '').toLowerCase().includes(search.toLowerCase())
  )

  const Field = ({ label, icon: Icon, children }) => (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon className="text-[#0e4a78]" size={14} />}
        {label}
      </label>
      {children}
    </div>
  )

  const inputCls = "w-full px-4 py-2.5 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] text-slate-700 placeholder:text-slate-400 transition-all text-sm"

  return (
    <div
      className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      {/* App-standard light overlay */}
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-sm font-semibold transition-all
            ${toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-green-50 border-green-200 text-green-700'}`}>
            {toast.type === 'error'
              ? <FiAlertCircle className="text-base flex-shrink-0" />
              : <FiCheckCircle className="text-base flex-shrink-0" />}
            {toast.msg}
          </div>
        )}

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <div className="w-full max-w-6xl mx-auto">

            {/* ── Tab Navigation ── */}
            <div className="flex gap-2 mb-0">
              <button
                onClick={() => setActiveTab('form')}
                className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-t-xl border border-b-0 transition-all ${
                  activeTab === 'form'
                    ? 'bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white border-[#0e4a78] shadow-lg'
                    : 'bg-white/80 text-slate-600 border-slate-300 hover:bg-white hover:text-[#0e4a78]'
                }`}
              >
                <FiMapPin size={15} />
                {editingId ? 'Edit Yard' : 'Add Yard'}
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-t-xl border border-b-0 transition-all ${
                  activeTab === 'list'
                    ? 'bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white border-[#0e4a78] shadow-lg'
                    : 'bg-white/80 text-slate-600 border-slate-300 hover:bg-white hover:text-[#0e4a78]'
                }`}
              >
                <FiList size={15} />
                Yards List
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'list' ? 'bg-white/20 text-white' : 'bg-[#0e4a78]/10 text-[#0e4a78]'
                }`}>
                  {yards.length}
                </span>
              </button>
            </div>

            {/* ── Tab Panel ── */}
            <section className="bg-white/95 rounded-b-2xl rounded-tr-2xl shadow-xl border border-slate-300 overflow-hidden">

              {/* ─── FORM TAB ─── */}
              {activeTab === 'form' && (
                <div className="p-6 space-y-6">

                  {/* Section: Identity */}
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="w-5 h-px bg-slate-300" /> Identity <span className="flex-1 h-px bg-slate-200" />
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <Field label="Yard Name" icon={FiMapPin}>
                        <input
                          type="text" placeholder="e.g. Container Yard A"
                          value={form.YardName} onChange={e => handleChange('YardName', e.target.value)}
                          className={inputCls}
                        />
                      </Field>
                      <Field label="Yard Code" icon={FiHash}>
                        <input
                          type="text" placeholder="e.g. CY-01"
                          value={form.YardCode} onChange={e => handleChange('YardCode', e.target.value)}
                          className={inputCls}
                        />
                      </Field>
                    </div>
                  </div>

                  {/* Section: Dimensions */}
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="w-5 h-px bg-slate-300" /> Dimensions <span className="flex-1 h-px bg-slate-200" />
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                      <Field label="No Of Row" icon={FiGrid}>
                        <input type="number" placeholder="0" min={0}
                          value={form.NoOfRow} onChange={e => handleChange('NoOfRow', e.target.value)}
                          className={inputCls} />
                      </Field>
                      <Field label="No Of Column" icon={FiGrid}>
                        <input type="number" placeholder="0" min={0}
                          value={form.NoOfColumn} onChange={e => handleChange('NoOfColumn', e.target.value)}
                          className={inputCls} />
                      </Field>
                      <Field label="No Of Stack" icon={FiLayers}>
                        <input type="number" placeholder="0" min={0}
                          value={form.NoOfStack} onChange={e => handleChange('NoOfStack', e.target.value)}
                          className={inputCls} />
                      </Field>
                      <Field label="Marking Start" icon={FiHash}>
                        <input type="text" placeholder="e.g. A1"
                          value={form.MarkingStart} onChange={e => handleChange('MarkingStart', e.target.value)}
                          className={inputCls} />
                      </Field>
                    </div>
                  </div>

                  {/* Section: Classification */}
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="w-5 h-px bg-slate-300" /> Classification <span className="flex-1 h-px bg-slate-200" />
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                      <Field label="Base Status" icon={FiCheckCircle}>
                        <select
                          value={form.BaseStatus} onChange={e => handleChange('BaseStatus', e.target.value)}
                          className={inputCls}
                        >
                          <option value="">— Select —</option>
                          <option value="1">Active</option>
                          <option value="2">Inactive</option>
                          <option value="3">Under Maintenance</option>
                        </select>
                      </Field>

                      <Field label="Container Size" icon={FiPackage}>
                        <div className="flex gap-2 pt-1">
                          {['20', '40', '45'].map(sz => (
                            <button
                              key={sz} type="button"
                              onClick={() => {
                                const next = form.Size.includes(sz)
                                  ? form.Size.filter(s => s !== sz)
                                  : [...form.Size, sz]
                                handleChange('Size', next)
                              }}
                              className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all
                                ${form.Size.includes(sz)
                                  ? 'bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white border-[#0e4a78] shadow-md'
                                  : 'bg-white text-slate-500 border-slate-300 hover:border-[#0e4a78] hover:text-[#0e4a78]'
                                }`}
                            >
                              {sz}ft
                            </button>
                          ))}
                        </div>
                      </Field>

                      <Field label="Active Status" icon={FiCheckCircle}>
                        <button
                          type="button"
                          onClick={() => handleChange('IsActive', !form.IsActive)}
                          className={`w-full py-2.5 rounded-lg text-sm font-semibold border-2 flex items-center justify-center gap-2 transition-all
                            ${form.IsActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-400 hover:bg-emerald-100'
                              : 'bg-slate-50 text-slate-500 border-slate-300 hover:bg-slate-100'}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${form.IsActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {form.IsActive ? 'Active' : 'Inactive'}
                        </button>
                      </Field>

                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2 border-t border-slate-200">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white font-semibold hover:from-[#0b3e66] hover:to-[#072c4a] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {saving
                        ? <><div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Saving…</>
                        : <><FiSave size={15} /> {editingId ? 'Update Yard' : 'Save Yard'}</>
                      }
                    </button>
                    {editingId && (
                      <button
                        onClick={handleCancel}
                        className="px-6 py-3 rounded-xl border-2 border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                </div>
              )}

              {/* ─── LIST TAB ─── */}
              {activeTab === 'list' && (
                <div className="flex flex-col min-h-[500px]">

                  {/* Toolbar */}
                  <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-sm">
                      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        type="text" value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search yards…"
                        className="w-full pl-9 pr-9 py-2.5 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-[#0e4a78] focus:ring-2 focus:ring-[#0e4a78]/20 text-sm transition-all"
                      />
                      {search && (
                        <button onClick={() => setSearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          <FiX size={14} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={fetchYards}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border-2 border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-100 transition-all"
                        title="Refresh"
                      >
                        <FiRefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        Refresh
                      </button>
                      <button
                        onClick={() => { handleCancel(); setActiveTab('form') }}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white text-sm font-semibold hover:from-[#0b3e66] hover:to-[#072c4a] shadow-md transition-all"
                      >
                        <FiPlus size={13} /> Add Yard
                      </button>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto flex-1">
                    <table className="min-w-full text-sm text-left">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                          <th className="px-5 py-3 font-semibold border-r border-white/20">#</th>
                          <th className="px-5 py-3 font-semibold border-r border-white/20">
                            <div className="flex items-center gap-2"><FiMapPin size={13} /> Yard Name</div>
                          </th>
                          <th className="px-5 py-3 font-semibold border-r border-white/20">
                            <div className="flex items-center gap-2"><FiHash size={13} /> Code</div>
                          </th>
                          <th className="px-5 py-3 font-semibold border-r border-white/20">
                            <div className="flex items-center gap-2"><FiGrid size={13} /> Rows</div>
                          </th>
                          <th className="px-5 py-3 font-semibold border-r border-white/20">
                            <div className="flex items-center gap-2"><FiGrid size={13} /> Columns</div>
                          </th>
                          <th className="px-5 py-3 font-semibold border-r border-white/20">
                            <div className="flex items-center gap-2"><FiLayers size={13} /> Stacks</div>
                          </th>
                          <th className="px-5 py-3 font-semibold border-r border-white/20">Status</th>
                          <th className="px-5 py-3 font-semibold text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {loading ? (
                          <tr>
                            <td colSpan={8} className="py-16 text-center">
                              <div className="w-8 h-8 rounded-full border-4 border-[#0e4a78]/30 border-t-[#0e4a78] animate-spin mx-auto mb-3" />
                              <p className="text-slate-400 text-sm">Loading…</p>
                            </td>
                          </tr>
                        ) : filteredYards.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-16 text-center">
                              <div className="flex flex-col items-center gap-3 text-slate-400">
                                <FiSearch className="text-4xl" />
                                <p className="text-sm font-medium">
                                  {search ? 'No yards match your search' : 'No yards configured yet'}
                                </p>
                                {search && (
                                  <button onClick={() => setSearch('')} className="text-xs text-[#0e4a78] hover:underline">
                                    Clear search
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : filteredYards.map((yard, i) => (
                          <tr key={yard.YardID ?? i}
                            className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200">
                            <td className="px-5 py-3 text-slate-400 text-sm border-r border-slate-200">{i + 1}</td>
                            <td className="px-5 py-3 border-r border-slate-200">
                              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs">
                                <FiMapPin size={11} />
                                {yard.YardName}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-slate-600 font-mono text-sm border-r border-slate-200">
                              {yard.YardCode || '—'}
                            </td>
                            <td className="px-5 py-3 text-slate-600 text-sm border-r border-slate-200">
                              {yard.NoOfRow || '—'}
                            </td>
                            <td className="px-5 py-3 text-slate-600 text-sm border-r border-slate-200">
                              {yard.NoOfColumn || '—'}
                            </td>
                            <td className="px-5 py-3 text-slate-600 text-sm border-r border-slate-200">
                              {yard.NoOfStack || '—'}
                            </td>
                            <td className="px-5 py-3 border-r border-slate-200">
                              {yard.IsActive
                                ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                                  </span>
                                : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactive
                                  </span>
                              }
                            </td>
                            <td className="px-5 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEdit(yard)}
                                  className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                                  title="Edit"
                                >
                                  <FiEdit2 size={13} />
                                </button>
                                <button
                                  onClick={() => handleDelete(yard)}
                                  className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                                  title="Delete"
                                >
                                  <FiTrash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer count */}
                  {filteredYards.length > 0 && (
                    <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 font-medium">
                      Showing {filteredYards.length} of {yards.length} yards
                    </div>
                  )}
                </div>
              )}

            </section>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}
