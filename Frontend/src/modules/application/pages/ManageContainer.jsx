import React, { useState, useEffect } from 'react'
import { FiSearch, FiTrash2, FiEdit2, FiX, FiBox, FiCheckCircle, FiXCircle } from 'react-icons/fi'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { confirmAction, notify } from '../../../utils/notify'
import { API_ENDPOINTS } from '../../../config/api'

const ManageContainer = () => {
  const [activeTab, setActiveTab] = useState('size') // 'size' or 'type'
  
  // Container Size States
  const [sizeCode, setSizeCode] = useState('')
  const [sizeDescription, setSizeDescription] = useState('')
  const [sizes, setSizes] = useState([])
  const [editingSizeId, setEditingSizeId] = useState(null)
  const [sizeSearchTerm, setSizeSearchTerm] = useState('')
  const [sizeCurrentPage, setSizeCurrentPage] = useState(1)
  
  // Container Type States
  const [typeCode, setTypeCode] = useState('')
  const [isoCode, setIsoCode] = useState('')
  const [typeDescription, setTypeDescription] = useState('')
  const [types, setTypes] = useState([])
  const [editingTypeId, setEditingTypeId] = useState(null)
  const [typeSearchTerm, setTypeSearchTerm] = useState('')
  const [typeCurrentPage, setTypeCurrentPage] = useState(1)
  
  const [isLoading, setIsLoading] = useState(false)
  const pageSize = 10

  useEffect(() => {
    fetchSizes()
    fetchTypes()
  }, [])

  // ==================== CONTAINER SIZE FUNCTIONS ====================
  
  const fetchSizes = async () => {
    setIsLoading(true)
    try {
      const token = sessionStorage.getItem('authToken')
      const response = await fetch(API_ENDPOINTS.MASTER.GET_CONT_SIZE, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()
      
      console.log('Container Size API Response:', data) // Debug log

      if (data && data.data) {
        console.log('First size item (raw):', data.data[0]) // Debug: see actual field names
        
        const mappedSizes = data.data.map((item, index) => {
          const mapped = {
            id: item.SizeID || item.SIZE_ID || item.size_id || item.id || item.ID || index,
            sizeCode: item.SizeCode || item.SIZE_CODE || item.size_code || '',
            description: item.Description || item.DESCRIPTION || item.description || ''
          }
          
          if (index === 0) console.log('First mapped size:', mapped) // Debug
          return mapped
        })
        
        console.log('Mapped Container Sizes:', mappedSizes) // Debug log
        setSizes(mappedSizes)
      }
    } catch (error) {
      console.error('Fetch sizes error:', error) // Debug log
      notify.error('Error', 'Failed to fetch container sizes')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveSize = async () => {
    if (!sizeCode) {
      notify.error('Validation', 'Size Code is required')
      return
    }

    try {
      const token = sessionStorage.getItem('authToken')
      const user = JSON.parse(sessionStorage.getItem('user') || '{}')
      const userId = user?.user_id || user?.USER_ID || user?.id || 1

      const formData = {
        size_code: sizeCode,
        description: sizeDescription || null
      }
      
      console.log('Adding container size:', formData) // Debug log

      const response = await fetch(API_ENDPOINTS.MASTER.ADD_CONT_SIZE, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      console.log('Add size response:', data) // Debug log

      if (!response.ok || data?.status === 'error') {
        throw new Error(data?.message || 'Add failed')
      }

      notify.success('Success', 'Container size added successfully')
      handleCancelSize()
      await fetchSizes() // Wait for fetch to complete
    } catch (error) {
      console.error('Add size error:', error) // Debug log
      notify.error('Error', error.message || 'Failed to add container size')
    }
  }

  const handleUpdateSize = async () => {
    if (!sizeCode) {
      notify.error('Validation', 'Size Code is required')
      return
    }

    try {
      const token = sessionStorage.getItem('authToken')
      const user = JSON.parse(sessionStorage.getItem('user') || '{}')
      const userId = user?.user_id || user?.USER_ID || user?.id || 1

      const formData = {
        size_id: editingSizeId,
        size_code: sizeCode,
        description: sizeDescription || null
      }
      
      console.log('Updating container size:', formData) // Debug

      const response = await fetch(API_ENDPOINTS.MASTER.UPDATE_CONT_SIZE, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok || data?.status === 'error') {
        throw new Error(data?.message || 'Update failed')
      }

      notify.success('Success', 'Container size updated successfully')
      handleCancelSize()
      fetchSizes()
    } catch (error) {
      notify.error('Error', error.message || 'Failed to update container size')
    }
  }

  const handleDeleteSize = async (id) => {
    const confirmed = await confirmAction({
      title: 'Delete container size?',
      text: 'Are you sure you want to delete this container size?',
      confirmButtonText: 'Delete',
    })
    if (!confirmed) return

    try {
      const token = sessionStorage.getItem('authToken')
      const user = JSON.parse(sessionStorage.getItem('user') || '{}')
      const userId = user?.user_id || user?.USER_ID || user?.id || 1

      const response = await fetch(API_ENDPOINTS.MASTER.DELETE_CONT_SIZE, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ size_id: id })
      })

      const data = await response.json()

      if (!response.ok || data?.status === 'error') {
        throw new Error(data?.message || 'Delete failed')
      }

      notify.success('Deleted', 'Container size deleted successfully')
      fetchSizes()
    } catch (error) {
      notify.error('Error', error.message || 'Failed to delete container size')
    }
  }

  const handleEditSize = (size) => {
    setSizeCode(size.sizeCode)
    setSizeDescription(size.description)
    setEditingSizeId(size.id)
  }

  const handleCancelSize = () => {
    setSizeCode('')
    setSizeDescription('')
    setEditingSizeId(null)
  }

  // ==================== CONTAINER TYPE FUNCTIONS ====================
  
  const fetchTypes = async () => {
    setIsLoading(true)
    try {
        const token = sessionStorage.getItem('authToken')
      const response = await fetch(API_ENDPOINTS.MASTER.GET_CONT_TYPE, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()
      
      console.log('Container Type API Response:', data) // Debug log

      if (data && data.data) {
        console.log('First type item (raw):', data.data[0]) // Debug: see actual field names
        
        const mappedTypes = data.data.map((item, index) => {
          const mapped = {
            id: item.TypeID || item.TYPE_ID || item.type_id || item.id || item.ID || index,
            typeCode: item.TypeCode || item.TYPE_CODE || item.type_code || '',
            isoCode: item.ISOCode || item.ISO_CODE || item.iso_code || '',
            description: item.TypeDesc || item.TYPE_DESC || item.type_desc || item.Description || item.DESCRIPTION || item.description || ''
          }
          
          if (index === 0) console.log('First mapped type:', mapped) // Debug
          return mapped
        })
        
        console.log('Mapped Container Types:', mappedTypes) // Debug log
        setTypes(mappedTypes)
      }
    } catch (error) {
      console.error('Fetch types error:', error) // Debug log
      notify.error('Error', 'Failed to fetch container types')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveType = async () => {
    if (!typeCode) {
      notify.error('Validation', 'Type Code is required')
      return
    }

    try {
      const token = sessionStorage.getItem('authToken')
      const user = JSON.parse(sessionStorage.getItem('user') || '{}')
      const userId = user?.user_id || user?.USER_ID || user?.id || 1

      const formData = {
        type_code: typeCode,
        iso_code: isoCode || null,
        type_desc: typeDescription || null
      }
      
      console.log('Adding container type:', formData) // Debug

      const response = await fetch(API_ENDPOINTS.MASTER.ADD_CONT_TYPE, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok || data?.status === 'error') {
        throw new Error(data?.message || 'Add failed')
      }

      notify.success('Success', 'Container type added successfully')
      handleCancelType()
      fetchTypes()
    } catch (error) {
      notify.error('Error', error.message || 'Failed to add container type')
    }
  }

  const handleUpdateType = async () => {
    if (!typeCode) {
      notify.error('Validation', 'Type Code is required')
      return
    }

    try {
      const token = sessionStorage.getItem('authToken')
      const user = JSON.parse(sessionStorage.getItem('user') || '{}')
      const userId = user?.user_id || user?.USER_ID || user?.id || 1

      const formData = {
        type_id: editingTypeId,
        type_code: typeCode,
        iso_code: isoCode || null,
        type_desc: typeDescription || null
      }
      
      console.log('Updating container type:', formData) // Debug

      const response = await fetch(API_ENDPOINTS.MASTER.UPDATE_CONT_TYPE, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok || data?.status === 'error') {
        throw new Error(data?.message || 'Update failed')
      }

      notify.success('Success', 'Container type updated successfully')
      handleCancelType()
      fetchTypes()
    } catch (error) {
      notify.error('Error', error.message || 'Failed to update container type')
    }
  }

  const handleDeleteType = async (id) => {
    const confirmed = await confirmAction({
      title: 'Delete container type?',
      text: 'Are you sure you want to delete this container type?',
      confirmButtonText: 'Delete',
    })
    if (!confirmed) return

    try {
      const token = sessionStorage.getItem('authToken')
      const user = JSON.parse(sessionStorage.getItem('user') || '{}')
      const userId = user?.user_id || user?.USER_ID || user?.id || 1

      const response = await fetch(API_ENDPOINTS.MASTER.DELETE_CONT_TYPE, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type_id: id })
      })

      const data = await response.json()

      if (!response.ok || data?.status === 'error') {
        throw new Error(data?.message || 'Delete failed')
      }

      notify.success('Deleted', 'Container type deleted successfully')
      fetchTypes()
    } catch (error) {
      notify.error('Error', error.message || 'Failed to delete container type')
    }
  }

  const handleEditType = (type) => {
    setTypeCode(type.typeCode)
    setIsoCode(type.isoCode)
    setTypeDescription(type.description)
    setEditingTypeId(type.id)
  }

  const handleCancelType = () => {
    setTypeCode('')
    setIsoCode('')
    setTypeDescription('')
    setEditingTypeId(null)
  }

  // Filter and pagination for sizes
  const filteredSizes = sizes.filter(size =>
    size.sizeCode.toLowerCase().includes(sizeSearchTerm.toLowerCase()) ||
    (size.description || '').toLowerCase().includes(sizeSearchTerm.toLowerCase())
  )
  const sizeTotalPages = Math.ceil(filteredSizes.length / pageSize)
  const paginatedSizes = filteredSizes.slice(
    (sizeCurrentPage - 1) * pageSize,
    sizeCurrentPage * pageSize
  )

  // Filter and pagination for types
  const filteredTypes = types.filter(type =>
    type.typeCode.toLowerCase().includes(typeSearchTerm.toLowerCase()) ||
    (type.isoCode || '').toLowerCase().includes(typeSearchTerm.toLowerCase()) ||
    (type.description || '').toLowerCase().includes(typeSearchTerm.toLowerCase())
  )
  const typeTotalPages = Math.ceil(filteredTypes.length / pageSize)
  const paginatedTypes = filteredTypes.slice(
    (typeCurrentPage - 1) * pageSize,
    typeCurrentPage * pageSize
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
          <div className="w-full space-y-6">

            {/* Tab Navigation */}
            <div className="flex gap-2 bg-white/95 rounded-xl p-2 shadow-lg border border-slate-300 w-fit">
              <button
                onClick={() => setActiveTab('size')}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  activeTab === 'size'
                    ? 'bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white shadow-lg'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FiBox />
                  Container Size
                </div>
              </button>
              <button
                onClick={() => setActiveTab('type')}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  activeTab === 'type'
                    ? 'bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white shadow-lg'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FiBox />
                  Container Type
                </div>
              </button>
            </div>

            {/* Container Size Tab */}
            {activeTab === 'size' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Panel - Size Form */}
                <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
                  <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FiBox className="text-2xl" />
                      <h2 className="text-xl font-semibold tracking-wide">
                        {editingSizeId ? 'EDIT CONTAINER SIZE' : 'CONTAINER SIZE MASTER'}
                      </h2>
                    </div>
                  </header>
                  <div className="p-6 space-y-5">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <FiBox className="text-[#0e4a78]" />
                        Size Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., 20, 40, 45"
                        value={sizeCode}
                        onChange={(e) => setSizeCode(e.target.value)}
                        className="container-input w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] placeholder:text-slate-400 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <FiBox className="text-[#0e4a78]" />
                        Description
                      </label>
                      <textarea
                        placeholder="Enter size description..."
                        value={sizeDescription}
                        onChange={(e) => setSizeDescription(e.target.value)}
                        rows="3"
                        className="container-input w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] placeholder:text-slate-400 transition-all resize-none"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleCancelSize}
                        className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={editingSizeId ? handleUpdateSize : handleSaveSize}
                        className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white font-semibold hover:from-[#0b3e66] hover:to-[#072c4a] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      >
                        {editingSizeId ? 'Update' : 'Save'}
                      </button>
                    </div>
                  </div>
                </section>

                {/* Right Panel - Size Table */}
                <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col">
                  <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FiBox className="text-2xl" />
                      <h2 className="text-xl font-semibold tracking-wide">VIEW CONTAINER SIZES</h2>
                    </div>
                  </header>

                  <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <div className="relative">
                      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={sizeSearchTerm}
                        onChange={(e) => setSizeSearchTerm(e.target.value)}
                        placeholder="Search by code or description..."
                        className="container-input w-full pl-10 pr-10 py-2.5 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-[#0e4a78] focus:ring-2 focus:ring-[#0e4a78]/20 text-sm transition-all"
                      />
                      {sizeSearchTerm && (
                        <button
                          onClick={() => setSizeSearchTerm('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                        >
                          <FiX />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto flex-1">
                    <table className="container-table min-w-full text-xs md:text-sm text-left">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                          <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">Size Code</th>
                          <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">Description</th>
                          <th className="px-3 sm:px-4 py-3 text-center font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {paginatedSizes.length > 0 ? (
                          paginatedSizes.map((size, index) => (
                            <tr key={size.id || `size-${index}`} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200">
                              <td className="px-3 sm:px-4 py-3 text-black border-r border-slate-200 font-medium">{size.sizeCode}</td>
                              <td className="px-3 sm:px-4 py-3 text-black border-r border-slate-200 text-xs">{size.description || '-'}</td>
                              <td className="px-3 sm:px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleEditSize(size)}
                                    className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                                    title="Edit"
                                  >
                                    <FiEdit2 className="text-sm" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSize(size.id)}
                                    className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                                    title="Delete"
                                  >
                                    <FiTrash2 className="text-sm" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="3" className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center gap-3 text-slate-400">
                                <FiSearch className="text-4xl" />
                                <p className="text-sm font-medium">No container sizes found</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-slate-600">
                    <div>
                      Showing <strong className="text-[#0e4a78]">{Math.min((sizeCurrentPage - 1) * pageSize + 1, filteredSizes.length)} to {Math.min(sizeCurrentPage * pageSize, filteredSizes.length)}</strong> of{' '}
                      <strong className="text-[#0e4a78]">{filteredSizes.length}</strong> total records (Page{' '}
                      <strong>{sizeCurrentPage}</strong> of <strong>{sizeTotalPages || 1}</strong>)
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSizeCurrentPage(p => Math.max(1, p - 1))}
                        disabled={sizeCurrentPage === 1}
                        className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${
                          sizeCurrentPage === 1
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
                          max={sizeTotalPages || 1}
                          value={sizeCurrentPage}
                          onChange={(e) => {
                            const p = Math.max(1, Math.min(sizeTotalPages || 1, Number(e.target.value) || 1))
                            setSizeCurrentPage(p)
                          }}
                          className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-[#0e4a78]"
                        />
                        <span className="text-slate-600">of {sizeTotalPages || 1}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSizeCurrentPage(p => Math.min(sizeTotalPages || 1, p + 1))}
                        disabled={sizeCurrentPage === sizeTotalPages || sizeTotalPages === 0}
                        className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${
                          sizeCurrentPage === sizeTotalPages || sizeTotalPages === 0
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
            )}

            {/* Container Type Tab */}
            {activeTab === 'type' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Panel - Type Form */}
                <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
                  <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FiBox className="text-2xl" />
                      <h2 className="text-xl font-semibold tracking-wide">
                        {editingTypeId ? 'EDIT CONTAINER TYPE' : 'CONTAINER TYPE MASTER'}
                      </h2>
                    </div>
                  </header>
                  <div className="p-6 space-y-5">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <FiBox className="text-[#0e4a78]" />
                        Type Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., GP, HC, RF"
                        value={typeCode}
                        onChange={(e) => setTypeCode(e.target.value)}
                        className="container-input w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] placeholder:text-slate-400 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <FiBox className="text-[#0e4a78]" />
                        ISO Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., 22G1, 42G1"
                        value={isoCode}
                        onChange={(e) => setIsoCode(e.target.value)}
                        className="container-input w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] placeholder:text-slate-400 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <FiBox className="text-[#0e4a78]" />
                        Description
                      </label>
                      <textarea
                        placeholder="Enter type description..."
                        value={typeDescription}
                        onChange={(e) => setTypeDescription(e.target.value)}
                        rows="3"
                        className="container-input w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] placeholder:text-slate-400 transition-all resize-none"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleCancelType}
                        className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={editingTypeId ? handleUpdateType : handleSaveType}
                        className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white font-semibold hover:from-[#0b3e66] hover:to-[#072c4a] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      >
                        {editingTypeId ? 'Update' : 'Save'}
                      </button>
                    </div>
                  </div>
                </section>

                {/* Right Panel - Type Table */}
                <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col">
                  <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FiBox className="text-2xl" />
                      <h2 className="text-xl font-semibold tracking-wide">VIEW CONTAINER TYPES</h2>
                    </div>
                  </header>

                  <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <div className="relative">
                      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={typeSearchTerm}
                        onChange={(e) => setTypeSearchTerm(e.target.value)}
                        placeholder="Search by code, ISO or description..."
                        className="container-input w-full pl-10 pr-10 py-2.5 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-[#0e4a78] focus:ring-2 focus:ring-[#0e4a78]/20 text-sm transition-all"
                      />
                      {typeSearchTerm && (
                        <button
                          onClick={() => setTypeSearchTerm('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                        >
                          <FiX />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto flex-1">
                    <table className="container-table min-w-full text-xs md:text-sm text-left">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                          <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">Type Code</th>
                          <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">ISO Code</th>
                          <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">Description</th>
                          <th className="px-3 sm:px-4 py-3 text-center font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {paginatedTypes.length > 0 ? (
                          paginatedTypes.map((type, index) => (
                            <tr key={type.id || `type-${index}`} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200">
                              <td className="px-3 sm:px-4 py-3 text-black border-r border-slate-200 font-medium">{type.typeCode}</td>
                              <td className="px-3 sm:px-4 py-3 text-black border-r border-slate-200">{type.isoCode || '-'}</td>
                              <td className="px-3 sm:px-4 py-3 text-black border-r border-slate-200 text-xs">{type.description || '-'}</td>
                              <td className="px-3 sm:px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleEditType(type)}
                                    className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                                    title="Edit"
                                  >
                                    <FiEdit2 className="text-sm" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteType(type.id)}
                                    className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                                    title="Delete"
                                  >
                                    <FiTrash2 className="text-sm" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center gap-3 text-slate-400">
                                <FiSearch className="text-4xl" />
                                <p className="text-sm font-medium">No container types found</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-slate-600">
                    <div>
                      Showing <strong className="text-[#0e4a78]">{Math.min((typeCurrentPage - 1) * pageSize + 1, filteredTypes.length)} to {Math.min(typeCurrentPage * pageSize, filteredTypes.length)}</strong> of{' '}
                      <strong className="text-[#0e4a78]">{filteredTypes.length}</strong> total records (Page{' '}
                      <strong>{typeCurrentPage}</strong> of <strong>{typeTotalPages || 1}</strong>)
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTypeCurrentPage(p => Math.max(1, p - 1))}
                        disabled={typeCurrentPage === 1}
                        className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${
                          typeCurrentPage === 1
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
                          max={typeTotalPages || 1}
                          value={typeCurrentPage}
                          onChange={(e) => {
                            const p = Math.max(1, Math.min(typeTotalPages || 1, Number(e.target.value) || 1))
                            setTypeCurrentPage(p)
                          }}
                          className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-[#0e4a78]"
                        />
                        <span className="text-slate-600">of {typeTotalPages || 1}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setTypeCurrentPage(p => Math.min(typeTotalPages || 1, p + 1))}
                        disabled={typeCurrentPage === typeTotalPages || typeTotalPages === 0}
                        className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${
                          typeCurrentPage === typeTotalPages || typeTotalPages === 0
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
            )}

          </div>
        </main>

        <Footer />
      </div>
      
      <style>{`
        .container-input {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          background-color: #ffffff !important;
          font-weight: 500 !important;
        }
        
        .container-input::placeholder {
          color: #94a3b8 !important;
          -webkit-text-fill-color: #94a3b8 !important;
          opacity: 1 !important;
        }
        
        .container-table td {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }
      `}</style>
    </div>
  )
}

export default ManageContainer
