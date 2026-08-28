import React, { useState } from 'react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { FiTrash2, FiEdit, FiX } from 'react-icons/fi'
import { confirmAction, notify } from '../../../utils/notify'

const DeviceEquipmentMapping = () => {
  // Mock Data
  const [mappings, setMappings] = useState([
    { id: 1, deviceId: 'Eklavya', equipmentName: 'KC-12' }
  ])

  // Form State
  const [formData, setFormData] = useState({
    device: '',
    equipment: ''
  })

  // Search State
  const [searchTerm, setSearchTerm] = useState('')

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Clear single field
  const clearField = (field) => {
    setFormData(prev => ({ ...prev, [field]: '' }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.device || !formData.equipment) return

    const newMapping = {
      id: Date.now(),
      deviceId: formData.device,
      equipmentName: formData.equipment
    }

    setMappings(prev => [...prev, newMapping])
    setFormData({ device: '', equipment: '' })
  }

  const handleDelete = async (id) => {
    const confirmed = await confirmAction({
      title: 'Delete mapping?',
      text: 'Are you sure you want to delete this mapping?',
      confirmButtonText: 'Delete',
    })
    if (!confirmed) return
    setMappings(prev => prev.filter(m => m.id !== id))
    notify.success('Deleted', 'Mapping deleted successfully')
  }

  const filteredMappings = mappings.filter(m =>
    m.deviceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.equipmentName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredMappings.length / pageSize)
  const paginatedMappings = filteredMappings.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  return (
    <div
      className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">

            {/* Left Column: Form */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col h-fit">
              <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-3 flex justify-between items-center">
                <h2 className="text-lg font-semibold tracking-wide uppercase">Device & Equipment Mapping</h2>
                <button className="text-white hover:text-slate-200 font-bold text-xl">−</button>
              </header>

              <div className="p-8">
                <form onSubmit={handleSubmit} className="space-y-6">

                  {/* Device Input */}
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <label className="text-slate-800 font-bold text-sm sm:w-32 text-right">
                      Device
                    </label>
                    <div className="relative flex-1 w-full">
                      <select
                        name="device"
                        value={formData.device}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-slate-300 rounded text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-transparent bg-slate-50 appearance-none"
                      >
                        <option value="" disabled>Select Device</option>
                        <option value="Eklavya">Eklavya</option>
                        <option value="Device 2">Device 2</option>
                      </select>
                      {formData.device && (
                        <button
                          type="button"
                          onClick={() => clearField('device')}
                          className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                        >
                          <FiX />
                        </button>
                      )}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* Equipment Input */}
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <label className="text-slate-800 font-bold text-sm sm:w-32 text-right">
                      Equipment
                    </label>
                    <div className="relative flex-1 w-full">
                      <select
                        name="equipment"
                        value={formData.equipment}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-slate-300 rounded text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] focus:border-transparent bg-slate-50 appearance-none"
                      >
                        <option value="" disabled>Select Equipment</option>
                        <option value="KC-04">KC-04</option>
                        <option value="KC-12">KC-12</option>
                      </select>
                      {formData.equipment && (
                        <button
                          type="button"
                          onClick={() => clearField('equipment')}
                          className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                        >
                          <FiX />
                        </button>
                      )}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between pt-8 border-t border-slate-100 mt-6">
                    <button
                      type="button"
                      onClick={() => setFormData({ device: '', equipment: '' })}
                      className="px-6 py-2 bg-white border border-slate-300 text-slate-500 font-semibold rounded shadow-sm hover:bg-slate-50 transition uppercase text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-8 py-2 bg-[#0e4a78] text-white font-bold rounded shadow-sm hover:bg-[#0b3e66] transition uppercase text-sm"
                    >
                      Save
                    </button>
                  </div>
                </form>
              </div>
            </section>

            {/* Right Column: List Table */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col h-full">
              <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-3 flex justify-between items-center">
                <h2 className="text-lg font-semibold tracking-wide uppercase">List</h2>
                <button className="text-white hover:text-slate-200 font-bold text-xl">−</button>
              </header>

              <div className="p-6 flex-1 flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span>Show</span>
                    <select className="border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#0e4a78]">
                      <option>10</option>
                      <option>25</option>
                      <option>50</option>
                    </select>
                    <span>entries</span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-slate-600 text-sm font-medium">Search:</span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="border border-slate-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#0e4a78] w-full sm:w-48"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-auto border border-slate-200 rounded">
                  <table className="min-w-full text-xs md:text-sm text-left">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 font-bold text-slate-700 border-b border-slate-200 w-1/3">
                          <div className="flex items-center justify-between cursor-pointer group">
                            Device ID
                            <div className="flex flex-col text-[8px] opacity-30 group-hover:opacity-100">
                              <span>▲</span><span>▼</span>
                            </div>
                          </div>
                        </th>
                        <th className="px-4 py-3 font-bold text-slate-700 border-b border-slate-200 w-1/3">
                          <div className="flex items-center justify-between cursor-pointer group">
                            Equipment Name
                            <div className="flex flex-col text-[8px] opacity-30 group-hover:opacity-100">
                              <span>▲</span><span>▼</span>
                            </div>
                          </div>
                        </th>
                        <th className="px-4 py-3 font-bold text-slate-700 border-b border-slate-200">
                          <div className="flex items-center justify-between cursor-pointer group">
                            Action
                            <div className="flex flex-col text-[8px] opacity-30 group-hover:opacity-100">
                              <span>▲</span><span>▼</span>
                            </div>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedMappings.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-700">{m.deviceId}</td>
                          <td className="px-4 py-3 text-slate-700">{m.equipmentName}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <button className="text-slate-400 hover:text-[#0e4a78] transition text-lg">
                                <FiEdit />
                              </button>
                              <button
                                onClick={() => handleDelete(m.id)}
                                className="text-slate-400 hover:text-red-500 transition text-lg"
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredMappings.length === 0 && (
                        <tr>
                          <td colSpan="3" className="px-4 py-8 text-center text-slate-500 italic">
                            No mappings found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="px-0 py-3 mt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-slate-600">
                  <div>
                    Showing <strong className="text-[#0e4a78]">{Math.min((currentPage - 1) * pageSize + 1, filteredMappings.length)} to {Math.min(currentPage * pageSize, filteredMappings.length)}</strong> of{' '}
                    <strong className="text-[#0e4a78]">{filteredMappings.length}</strong> total records (Page{' '}
                    <strong>{currentPage}</strong> of <strong>{totalPages || 1}</strong>)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${
                        currentPage === 1
                          ? 'text-slate-400 cursor-not-allowed bg-slate-100'
                          : 'text-[#0e4a78] hover:bg-blue-50'
                      }`}
                    >
                      Previous
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-600">Page</span>
                      <input
                        type="number"
                        min={1}
                        max={totalPages || 1}
                        value={currentPage}
                        onChange={(e) => {
                          const p = Math.max(1, Math.min(totalPages || 1, Number(e.target.value) || 1))
                          setCurrentPage(p)
                        }}
                        className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-[#0e4a78]"
                      />
                      <span className="text-slate-600">of {totalPages || 1}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.min(totalPages || 1, p + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${
                        currentPage === totalPages || totalPages === 0
                          ? 'text-slate-400 cursor-not-allowed bg-slate-100'
                          : 'text-[#0e4a78] hover:bg-blue-50'
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>

              </div>
            </section>

          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default DeviceEquipmentMapping