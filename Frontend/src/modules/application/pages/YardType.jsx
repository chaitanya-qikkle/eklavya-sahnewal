import React, { useState } from 'react'
import { FiEdit2, FiTrash2 } from 'react-icons/fi'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { confirmAction, notify } from '../../../utils/notify'

const mockYardTypes = [
  { id: 1, yardType: 'IMPORT', plantName: 'GDL GARHI' },
  { id: 2, yardType: 'EXPORT', plantName: 'GDL GARHI' },
  { id: 3, yardType: 'WAREHOUSE', plantName: 'GDL GARHI' },
  { id: 4, yardType: 'BUFFER', plantName: 'GDL GARHI' },
  { id: 5, yardType: 'HAZARDOUS', plantName: 'GDL GARHI' },
  { id: 6, yardType: 'RAIL', plantName: 'GDL GARHI' },
  { id: 7, yardType: 'WORKSHOP', plantName: 'GDL GARHI' },
  { id: 8, yardType: 'NEW YARD', plantName: 'GDL GARHI' },
]

const mockPlants = ['GDL GARHI', 'Plant 2', 'Plant 3']

const YardType = () => {
  const [yardType, setYardType] = useState('')
  const [plantName, setPlantName] = useState('GDL GARHI')
  const [yardTypes, setYardTypes] = useState(mockYardTypes)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 5

  const handleSave = () => {
    if (!yardType.trim()) {
      notify.warning('Yard type required', 'Please enter yard type')
      return
    }

    if (editingId) {
      setYardTypes(yardTypes.map(yt =>
        yt.id === editingId ? { ...yt, yardType, plantName } : yt
      ))
      setEditingId(null)
      notify.success('Saved', 'Yard type updated successfully')
    } else {
      const newYardType = {
        id: Date.now(),
        yardType,
        plantName
      }
      setYardTypes([...yardTypes, newYardType])
      notify.success('Saved', 'Yard type created successfully')
    }
    handleCancel()
  }

  const handleCancel = () => {
    setYardType('')
    setPlantName('GDL GARHI')
    setEditingId(null)
  }

  const handleEdit = (yard) => {
    setYardType(yard.yardType)
    setPlantName(yard.plantName)
    setEditingId(yard.id)
  }

  const handleDelete = async (id) => {
    const confirmed = await confirmAction({
      title: 'Delete yard type?',
      text: 'Are you sure you want to delete this yard type?',
      confirmButtonText: 'Delete',
    })
    if (!confirmed) return
    setYardTypes(yardTypes.filter(yt => yt.id !== id))
    notify.success('Deleted', 'Yard type deleted successfully')
  }

  const filteredYardTypes = yardTypes.filter(yard =>
    yard.yardType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    yard.plantName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredYardTypes.length / pageSize)
  const paginatedData = filteredYardTypes.slice(
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
          <div className="w-full space-y-8">

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* Left Panel - Yard Type Master Form */}
              <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
                <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-4">
                  <h2 className="text-lg font-semibold tracking-wide">
                    {editingId ? 'EDIT YARD TYPE' : 'YARD TYPE MASTER'}
                  </h2>
                </header>
                <div className="p-6 space-y-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Yard Type
                    </label>
                    <input
                      type="text"
                      placeholder="Yard Type"
                      value={yardType}
                      onChange={(e) => setYardType(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700 placeholder:text-slate-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Plant Name
                    </label>
                    <select
                      value={plantName}
                      onChange={(e) => setPlantName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700 bg-white"
                    >
                      {mockPlants.map((plant, idx) => (
                        <option key={idx} value={plant}>{plant}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleCancel}
                      className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-8 py-2.5 rounded-lg bg-[#0e4a78] text-white font-semibold hover:bg-[#0b3e66] transition shadow-md"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </section>

              {/* Right Panel - View Yardtype Table */}
              <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col">
                <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-4">
                  <h2 className="text-lg font-semibold tracking-wide">VIEW YARDTYPE</h2>
                </header>

                {/* Search Bar */}
                <div className="px-6 py-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium text-sm">Search:</span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg w-48 focus:outline-none focus:border-[#0e4a78] text-sm"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto flex-1">
                  <table className="min-w-full text-xs md:text-sm text-left">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                        <th className="px-4 sm:px-5 py-3 text-left font-semibold border-r border-white/30">
                          Yard Type
                        </th>
                        <th className="px-4 sm:px-5 py-3 text-left font-semibold border-r border-white/30">
                          Plant Name
                        </th>
                        <th className="px-4 sm:px-5 py-3 text-center font-semibold">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {paginatedData.length > 0 ? (
                        paginatedData.map((yard) => (
                          <tr key={yard.id} className="hover:bg-blue-50/50 transition-colors">
                            <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 font-medium">
                              {yard.yardType}
                            </td>
                            <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                              {yard.plantName}
                            </td>
                            <td className="px-4 sm:px-5 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEdit(yard)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                  title="Edit"
                                >
                                  <FiEdit2 />
                                </button>
                                <button
                                  onClick={() => handleDelete(yard.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
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
                          <td colSpan="3" className="px-6 py-8 text-center text-slate-500">
                            No yard types found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer with Pagination */}
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-slate-600">
                  <div>
                    Showing <strong className="text-[#0e4a78]">{Math.min((currentPage - 1) * pageSize + 1, filteredYardTypes.length)} to {Math.min(currentPage * pageSize, filteredYardTypes.length)}</strong> of{' '}
                    <strong className="text-[#0e4a78]">{filteredYardTypes.length}</strong> total records (Page{' '}
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
              </section>

            </div>

          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

export default YardType