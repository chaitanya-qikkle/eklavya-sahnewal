import React, { useMemo, useState } from 'react'
import { FiEdit2, FiList, FiMapPin, FiPlus, FiSearch, FiTrash2, FiUsers, FiX } from 'react-icons/fi'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { confirmAction, notify } from '../../../utils/notify'
import {
  useAddPlantMutation,
  useDeletePlantMutation,
  useGetPlantsQuery,
  useUpdatePlantMutation,
} from '../../../store/api/plantApi'

import { useGetClientAllQuery } from '../../../store/api/clientApi'

const emptyForm = {
  plantCode: '',
  plantName: '',
  location: '',
  clientId: '',
  active: true,
}


const Plant = () => {
  const [activeTab, setActiveTab] = useState('form')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const { data: clientsResponse } = useGetClientAllQuery()
  const clientOptions = useMemo(() => (clientsResponse?.clients || []).map(client => ({ id: client.id, name: client.clientName })), [clientsResponse])

  // Build a lookup map for client names
  const clientNameMap = useMemo(() => {
    const map = {}
    clientOptions.forEach(c => { map[c.id] = c.name })
    return map
  }, [clientOptions])

  const { data: plantsResponse, isLoading, refetch } = useGetPlantsQuery()
  const [addPlant, { isLoading: adding }] = useAddPlantMutation()
  const [updatePlant, { isLoading: updating }] = useUpdatePlantMutation()
  const [deletePlant] = useDeletePlantMutation()

  const plants = useMemo(() => plantsResponse?.plants || [], [plantsResponse])

  const filteredPlants = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return plants
    return plants.filter((plant) =>
      [plant.plantName, plant.plantCode, plant.location, clientNameMap[plant.clientId]]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    )
  }, [plants, searchTerm, clientNameMap])

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleCancel = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const handleSubmit = async () => {
    if (!form.plantName.trim()) {
      notify.warning('Plant name required', 'Please enter a plant name')
      return
    }

    const payload = {
      plant_code: form.plantCode.trim() || null,
      plant_name: form.plantName.trim(),
      location: form.location.trim() || null,
      client_id: form.clientId ? parseInt(form.clientId) : null,
      is_active: Boolean(form.active),
    }

    console.log('[Plant] Submitting payload:', JSON.stringify(payload, null, 2))

    try {
      const result = editingId
        ? await updatePlant({ ...payload, plant_id: editingId }).unwrap()
        : await addPlant(payload).unwrap()

      console.log('[Plant] API response:', JSON.stringify(result, null, 2))

      if (result?.status !== 'success') {
        throw new Error(result?.message || result?.detail || 'Operation failed')
      }

      notify.success('Success', editingId ? 'Plant updated successfully' : 'Plant created successfully')
      handleCancel()
      setActiveTab('list')
      await refetch()
    } catch (error) {
      console.error('[Plant] Save error:', error)
      console.error('[Plant] Error keys:', error ? Object.keys(error) : 'null')

      // Handle all RTK Query error shapes
      const detail = error?.data?.detail
      let errorMsg
      if (typeof detail === 'string') {
        errorMsg = detail
      } else if (Array.isArray(detail)) {
        errorMsg = detail.map(d => d?.msg || d?.message || JSON.stringify(d)).join(', ')
      } else if (error?.error) {
        // FETCH_ERROR or PARSING_ERROR from RTK Query
        errorMsg = error.error
      } else if (error?.message) {
        errorMsg = error.message
      } else {
        errorMsg = JSON.stringify(error) || 'Operation failed'
      }
      notify.error('Plant save failed', errorMsg)
    }
  }

  const handleEdit = (plant) => {
    setEditingId(plant.id)
    setForm({
      plantCode: plant.plantCode || '',
      plantName: plant.plantName || '',
      location: plant.location || '',
      clientId: plant.clientId || '',
      active: Boolean(plant.active),
    })
    setActiveTab('form')
  }

  const handleDelete = async (plant) => {
    const confirmed = await confirmAction({
      title: 'Delete plant?',
      text: `Delete ${plant.plantName}? Roles will no longer be able to select this plant.`,
      confirmButtonText: 'Delete',
    })

    if (!confirmed) return

    try {
      const result = await deletePlant({ plant_id: plant.id }).unwrap()
      if (result?.status !== 'success') {
        throw new Error(result?.message || result?.detail || 'Delete failed')
      }
      notify.success('Deleted', 'Plant deleted successfully')
      await refetch()
    } catch (error) {
      notify.error('Delete failed', error?.data?.detail || error?.message || 'Operation failed')
    }
  }

  return (
    <div
      className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <div className="w-full max-w-6xl mx-auto">

            {/* Tab Header */}
            <div className="flex gap-2 mb-0">
              <button
                onClick={() => setActiveTab('form')}
                className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-t-xl border border-b-0 transition-all ${
                  activeTab === 'form'
                    ? 'bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white border-[#0e4a78] shadow-lg'
                    : 'bg-white/80 text-slate-600 border-slate-300 hover:bg-white hover:text-[#0e4a78]'
                }`}
              >
                <FiMapPin />
                {editingId ? 'Edit Plant' : 'Add Plant'}
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-t-xl border border-b-0 transition-all ${
                  activeTab === 'list'
                    ? 'bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white border-[#0e4a78] shadow-lg'
                    : 'bg-white/80 text-slate-600 border-slate-300 hover:bg-white hover:text-[#0e4a78]'
                }`}
              >
                <FiList />
                Plants List
                <span className={`text-xs  px-2 py-0.5 rounded-full ${activeTab === 'list' ? 'bg-white/20' : 'bg-[#0e4a78]/10 text-[#0e4a78]'}`}>
                  {plants.length}
                </span>
              </button>
            </div>

            {/* Tab Content */}
            <section className="bg-white/95 rounded-b-2xl rounded-tr-2xl shadow-xl border border-slate-300 overflow-hidden">

              {/* ─── FORM TAB ─── */}
              {activeTab === 'form' && (
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700">Plant Code</label>
                      <input
                        value={form.plantCode}
                        onChange={(event) => handleChange('plantCode', event.target.value)}
                        placeholder="Plant Code"
                        className="w-full px-4 py-3 rounded-lg border-2 text-black border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700">Plant Name</label>
                      <input
                        value={form.plantName}
                        onChange={(event) => handleChange('plantName', event.target.value)}
                        placeholder="Plant Name"
                        className="w-full px-4 py-3 rounded-lg border-2 text-black border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700">Location</label>
                      <input
                        value={form.location}
                        onChange={(event) => handleChange('location', event.target.value)}
                        placeholder="Location"
                        className="w-full px-4 py-3 rounded-lg border-2 text-black border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700">Client</label>
                      <select
                        value={form.clientId}
                        onChange={(event) => handleChange('clientId', event.target.value)}
                        className="w-full px-4 py-3 rounded-lg border-2 text-black border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78]"
                      >
                        <option value="">-- Select Client --</option>
                        {clientOptions.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-3 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(event) => handleChange('active', event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#0e4a78] focus:ring-[#0e4a78]"
                    />
                    Active
                  </label>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSubmit}
                      disabled={adding || updating}
                      className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white font-semibold shadow-lg hover:shadow-xl disabled:opacity-60 transition-all"
                    >
                      {editingId ? 'Update' : 'Save'}
                    </button>
                    {editingId && (
                      <button
                        onClick={handleCancel}
                        className="px-6 py-3 rounded-lg border-2 border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-all"
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
                  {/* Search Bar */}
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                    <div className="relative">
                      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search plants..."
                        className="w-full pl-10 pr-10 py-2.5 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-sm"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <FiX />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto flex-1">
                    <table className="min-w-full text-sm text-left">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                          <th className="px-5 py-3 font-semibold border-r border-white/30">Plant Code</th>
                          <th className="px-5 py-3 font-semibold border-r border-white/30">Plant Name</th>
                          <th className="px-5 py-3 font-semibold border-r border-white/30">Location</th>
                          <th className="px-5 py-3 font-semibold border-r border-white/30">
                            <div className="flex items-center gap-2">
                              <FiUsers className="text-xs" />
                              Client
                            </div>
                          </th>
                          <th className="px-5 py-3 font-semibold text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {isLoading ? (
                          <tr>
                            <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                              Loading plants...
                            </td>
                          </tr>
                        ) : filteredPlants.length > 0 ? (
                          filteredPlants.map((plant) => (
                            <tr key={plant.id} className="hover:bg-blue-50 transition">
                              <td className="px-5 py-3 border-r border-slate-200 font-semibold text-slate-700">
                                {plant.plantCode || '-'}
                              </td>
                              <td className="px-5 py-3 border-r border-slate-200 text-slate-700">
                                {plant.plantName}
                              </td>
                              <td className="px-5 py-3 border-r border-slate-200 text-slate-700">
                                {plant.location || '-'}
                              </td>
                              <td className="px-5 py-3 border-r border-slate-200 text-slate-700">
                                {clientNameMap[plant.clientId] ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium text-xs">
                                    <FiUsers className="text-xs" />
                                    {clientNameMap[plant.clientId]}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">—</span>
                                )}
                              </td>
                              <td className="px-5 py-3 text-center">
                                <div className="flex justify-center gap-2">
                                  <button
                                    onClick={() => handleEdit(plant)}
                                    className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition"
                                    title="Edit"
                                  >
                                    <FiEdit2 />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(plant)}
                                    className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition"
                                    title="Delete"
                                  >
                                    <FiTrash2 />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                              No plants found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 text-sm text-slate-600 font-medium">
                    Showing <span className="text-[#0e4a78] font-bold">{filteredPlants.length}</span> of <span className="text-[#0e4a78] font-bold">{plants.length}</span> entries
                  </div>
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

export default Plant
