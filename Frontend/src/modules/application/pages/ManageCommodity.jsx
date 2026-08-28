import React, { useState, useEffect } from 'react'
import { FiSearch, FiTrash2, FiEdit2, FiX, FiPackage, FiCheckCircle, FiXCircle } from 'react-icons/fi'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { confirmAction, notify } from '../../../utils/notify'
import { API_ENDPOINTS } from '../../../config/api'

const ManageCommodity = () => {
  const [commodityCode, setCommodityCode] = useState('')
  const [commodityName, setCommodityName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [commodities, setCommodities] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Fetch Commodities on Mount
  useEffect(() => {
    fetchCommodities()
  }, [])

  const fetchCommodities = async () => {
    setIsLoading(true)
    try {
      const token = sessionStorage.getItem('authToken')
      const response = await fetch(API_ENDPOINTS.MASTER.GET_COMMODITY, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()

      if (data && data.data) {
        const mappedCommodities = data.data
          .map(item => ({
            id: item.COMMODITY_ID || item.commodity_id || item.id,
            commodityCode: item.COMMODITY_CODE || item.commodity_code || '',
            commodityName: item.COMMODITY_NAME || item.commodity_name || '',
            description: item.DESCRIPTION || item.description || '',
            isActive: item.IS_ACTIVE === true || item.IS_ACTIVE === 1 || item.is_active === 1
          }))
          .filter(commodity => commodity.isActive) // Only show active commodities
        
        console.log('Fetched commodities (active only):', mappedCommodities) // Debug log
        setCommodities(mappedCommodities)
      }
    } catch (error) {
      notify.error('Error', 'Failed to fetch commodities')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!commodityCode || !commodityName) {
      notify.error('Validation', 'Commodity Code and Name are required')
      return
    }

    try {
      const token = sessionStorage.getItem('authToken')
      
      // Get user ID from localStorage
      const user = JSON.parse(sessionStorage.getItem('user') || '{}')
      const userId = user?.user_id || user?.USER_ID || user?.id || 1

      const formData = {
        commodity_code: commodityCode,
        commodity_name: commodityName,
        description: description || null,
        is_active: true,  // Default to active when creating
        created_by: userId
      }

      console.log('Sending commodity data:', formData) // Debug log

      const response = await fetch(API_ENDPOINTS.MASTER.ADD_COMMODITY, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      console.log('API Response:', data) // Debug log
      console.log('Response Status:', response.status) // Debug log

      if (!response.ok || data?.status === 'error') {
        throw new Error(data?.message || `Add failed (Status: ${response.status})`)
      }

      notify.success('Success', 'Commodity added successfully')
      handleCancel()
      fetchCommodities()

    } catch (error) {
      console.error('Full error:', error) // Debug log
      notify.error('Error', error.message || 'Failed to add commodity')
    }
  }

  const handleUpdate = async () => {
    if (!commodityCode || !commodityName) {
      notify.error('Validation', 'Commodity Code and Name are required')
      return
    }

    try {
      const token = sessionStorage.getItem('authToken')
      
      // Get user ID from localStorage
      const user = JSON.parse(sessionStorage.getItem('user') || '{}')
      const userId = user?.user_id || user?.USER_ID || user?.id || 1

      const formData = {
        commodity_id: editingId,
        commodity_code: commodityCode,
        commodity_name: commodityName,
        description: description || null,
        is_active: isActive ? true : false,
        modified_by: userId  // Added missing field
      }

      console.log('Updating commodity data:', formData) // Debug log

      const response = await fetch(API_ENDPOINTS.MASTER.UPDATE_COMMODITY, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      console.log('Update API Response:', data) // Debug log

      if (!response.ok || data?.status === 'error') {
        throw new Error(data?.message || 'Update failed')
      }

      notify.success('Success', 'Commodity updated successfully')
      handleCancel()
      fetchCommodities()

    } catch (error) {
      console.error('Update error:', error)
      notify.error('Error', error.message || 'Failed to update commodity')
    }
  }

  const handleCancel = () => {
    setCommodityCode('')
    setCommodityName('')
    setDescription('')
    setIsActive(true)
    setEditingId(null)
  }

  const handleEdit = (commodity) => {
    setCommodityCode(commodity.commodityCode)
    setCommodityName(commodity.commodityName)
    setDescription(commodity.description)
    setIsActive(commodity.isActive)
    setEditingId(commodity.id)
  }

  const handleDelete = async (id) => {
    const confirmed = await confirmAction({
      title: 'Delete commodity?',
      text: 'Are you sure you want to delete this commodity?',
      confirmButtonText: 'Delete',
    })
    if (!confirmed) return

    try {
      const token = sessionStorage.getItem('authToken')
      
      // Get user ID from localStorage
      const user = JSON.parse(sessionStorage.getItem('user') || '{}')
      const userId = user?.user_id || user?.USER_ID || user?.id || 1

      const deletePayload = { 
        commodity_id: id,
        modified_by: userId
      }
      
      console.log('Delete request payload:', deletePayload) // Debug log
      console.log('Deleting commodity ID:', id) // Debug log

      const response = await fetch(API_ENDPOINTS.MASTER.DELETE_COMMODITY, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(deletePayload)
      })

      console.log('Delete response status:', response.status) // Debug log
      
      const data = await response.json()
      console.log('Delete API response:', data) // Debug log

      if (!response.ok || data?.status === 'error') {
        throw new Error(data?.message || `Delete failed (Status: ${response.status})`)
      }

      notify.success('Deleted', 'Commodity deleted successfully')
      fetchCommodities()

    } catch (error) {
      console.error('Delete error details:', error) // Debug log
      notify.error('Error', error.message || 'Failed to delete commodity')
    }
  }
  
  const filteredCommodities = commodities.filter(commodity =>
    commodity.commodityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    commodity.commodityCode.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredCommodities.length / pageSize)
  const paginatedData = filteredCommodities.slice(
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
          <div className="w-full space-y-6">

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Left Panel - Commodity Master Form */}
              <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
                <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FiPackage className="text-2xl" />
                    <h2 className="text-xl font-semibold tracking-wide">
                      {editingId ? 'EDIT COMMODITY' : 'COMMODITY MASTER'}
                    </h2>
                  </div>
                </header>
                <div className="p-6 space-y-5">
                  {/* Commodity Code */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <FiPackage className="text-[#0e4a78]" />
                      Commodity Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="commodity-code-input"
                      type="text"
                      placeholder="e.g., COM001, STEEL, etc."
                      value={commodityCode}
                      onChange={(e) => setCommodityCode(e.target.value)}
                      className="commodity-input w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] placeholder:text-slate-400 transition-all"
                      autoComplete="off"
                    />
                  </div>

                  {/* Commodity Name */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <FiPackage className="text-[#0e4a78]" />
                      Commodity Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="commodity-name-input"
                      type="text"
                      placeholder="e.g., Steel Coils, Iron Ore, etc."
                      value={commodityName}
                      onChange={(e) => setCommodityName(e.target.value)}
                      className="commodity-input w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] placeholder:text-slate-400 transition-all"
                      autoComplete="off"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <FiPackage className="text-[#0e4a78]" />
                      Description
                    </label>
                    <textarea
                      id="commodity-description-input"
                      placeholder="Enter commodity description..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows="3"
                      className="commodity-input w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] placeholder:text-slate-400 transition-all resize-none"
                    />
                  </div>

                  {/* Is Active - Only show when editing */}
                  {editingId && (
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                        {isActive ? <FiCheckCircle className="text-green-600" /> : <FiXCircle className="text-red-600" />}
                        Status
                      </label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="isActive"
                            checked={isActive === true}
                            onChange={() => setIsActive(true)}
                            className="w-4 h-4 text-[#0e4a78] focus:ring-[#0e4a78]"
                          />
                          <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                            <FiCheckCircle className="text-green-600" />
                            Active
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="isActive"
                            checked={isActive === false}
                            onChange={() => setIsActive(false)}
                            className="w-4 h-4 text-[#0e4a78] focus:ring-[#0e4a78]"
                          />
                          <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                            <FiXCircle className="text-red-600" />
                            Inactive
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleCancel}
                      className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={editingId ? handleUpdate : handleSave}
                      className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white font-semibold hover:from-[#0b3e66] hover:to-[#072c4a] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      {editingId ? 'Update' : 'Save'}
                    </button>
                  </div>
                </div>
              </section>

              {/* Right Panel - View Commodity Table */}
              <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col">
                <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FiPackage className="text-2xl" />
                    <h2 className="text-xl font-semibold tracking-wide">VIEW COMMODITIES</h2>
                  </div>
                </header>

                {/* Search Bar */}
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="commodity-search-input"
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by code or name..."
                      className="commodity-input w-full pl-10 pr-10 py-2.5 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-[#0e4a78] focus:ring-2 focus:ring-[#0e4a78]/20 text-sm transition-all"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                      >
                        <FiX />
                      </button>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto flex-1">
                  <table className="commodity-table min-w-full text-xs md:text-sm text-left">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                        <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">
                          <div className="flex items-center gap-2">
                            <FiPackage className="text-xs" />
                            Code
                          </div>
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">
                          Name
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">
                          Description
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-center font-semibold border-r border-white/30">
                          Status
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-center font-semibold">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {paginatedData.length > 0 ? (
                        paginatedData.map((commodity) => (
                          <tr key={commodity.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200">
                            <td className="px-3 sm:px-4 py-3 text-black border-r border-slate-200 font-medium">
                              {commodity.commodityCode}
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-black border-r border-slate-200 font-medium">
                              {commodity.commodityName}
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-black border-r border-slate-200 text-xs">
                              {commodity.description || '-'}
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-center border-r border-slate-200">
                              {commodity.isActive ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold text-xs">
                                  <FiCheckCircle className="text-[10px]" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 font-semibold text-xs">
                                  <FiXCircle className="text-[10px]" />
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEdit(commodity)}
                                  className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                                  title="Edit"
                                >
                                  <FiEdit2 className="text-sm" />
                                </button>
                                <button
                                  onClick={() => handleDelete(commodity.id)}
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
                          <td colSpan="5" className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-3 text-slate-400">
                              <FiSearch className="text-4xl" />
                              <p className="text-sm font-medium">No commodities found</p>
                              {searchTerm && (
                                <button
                                  onClick={() => setSearchTerm('')}
                                  className="text-xs text-[#0e4a78] hover:underline"
                                >
                                  Clear search
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer with Pagination */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-slate-600">
                  <div>
                    Showing <strong className="text-[#0e4a78]">{Math.min((currentPage - 1) * pageSize + 1, filteredCommodities.length)} to {Math.min(currentPage * pageSize, filteredCommodities.length)}</strong> of{' '}
                    <strong className="text-[#0e4a78]">{filteredCommodities.length}</strong> total records (Page{' '}
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
      
      {/* Override global CSS that sets light text color (#e5edff) from index.css */}
      <style>{`
        /* Ultra-specific selectors to override global :root color */
        #commodity-code-input,
        #commodity-name-input,
        #commodity-description-input,
        #commodity-search-input,
        input#commodity-code-input,
        input#commodity-name-input,
        textarea#commodity-description-input,
        input#commodity-search-input,
        .commodity-input {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          background-color: #ffffff !important;
          font-weight: 500 !important;
        }
        
        #commodity-code-input::placeholder,
        #commodity-name-input::placeholder,
        #commodity-description-input::placeholder,
        #commodity-search-input::placeholder,
        .commodity-input::placeholder {
          color: #94a3b8 !important;
          -webkit-text-fill-color: #94a3b8 !important;
          opacity: 1 !important;
        }
        
        .commodity-table td {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }
      `}</style>
    </div>
  )
}

export default ManageCommodity
