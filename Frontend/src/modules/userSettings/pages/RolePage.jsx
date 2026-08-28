import React, { useEffect, useState } from 'react'
import { FiEdit2, FiTrash2, FiSearch, FiX, FiShield, FiUsers } from 'react-icons/fi'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { confirmAction, notify } from '../../../utils/notify'
import { getStoredUser } from '../../../services/authService'
import {
  useCreateRoleMutation,
  useDeleteRoleMutation,
  useGetRolesQuery,
  useUpdateRoleMutation,
} from '../../../store/api/ymsApi'
import { useGetPlantsQuery } from '../../../store/api/plantApi'

const RolePage = () => {
  const [roleName, setRoleName] = useState('')
  const [plantId, setPlantId] = useState('')
  const [plantSearch, setPlantSearch] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // ============================================
  // API HOOKS
  // ============================================
  const { data: apiResponse, isLoading, refetch } = useGetRolesQuery()
  const { data: plantsResponse, isLoading: plantsLoading } = useGetPlantsQuery()
  const [createRoleMutation] = useCreateRoleMutation()
  const [updateRoleMutation] = useUpdateRoleMutation()
  const [deleteRoleMutation] = useDeleteRoleMutation()

  // Get current user ID as string (API expects string)
  const currentUser = getStoredUser()
  const currentUserId = String(currentUser?.user_id || currentUser?.id || '1')
  const plants = plantsResponse?.plants || []

  // ============================================
  // DATA MAPPING
  // ============================================
  // Map API response to component format
  const roles = React.useMemo(() => {
    // Check if apiResponse has 'roles' key (already transformed by RTK Query)
    if (apiResponse?.roles && Array.isArray(apiResponse.roles)) {
      return apiResponse.roles
    }
    
    // Check if apiResponse has 'data' key (raw API response)
    if (apiResponse?.data && Array.isArray(apiResponse.data)) {
      return apiResponse.data.map(role => ({
        id: role.ROLE_ID,
        roleName: role.ROLE,
        plantId: role.PLANT_ID || null,
        plantName: role.PLANT_NAME ? role.PLANT_NAME.split(',').filter(Boolean) : []
      }))
    }
    
    return []
  }, [apiResponse])

  // ============================================
  // HANDLERS
  // ============================================
  
  // Handle Save (Create or Update)
  const handleSave = async () => {
    if (!roleName.trim()) {
      notify.warning('Role name required', 'Please enter a role name')
      return
    }

    try {
      const trimmedName = roleName.trim()
      const selectedPlantId = plantId ? Number(plantId) : null

      if (editingId) {
        // UPDATE existing role
        const result = await updateRoleMutation({ 
          role_id: editingId, 
          role: trimmedName, 
          plant_id: selectedPlantId,
          modified_by: currentUserId 
        }).unwrap()
        
        if (result?.status !== 'success') {
          throw new Error(result?.message || 'Operation failed')
        }
        
        notify.success('Success', 'Role updated successfully')
        await refetch() // Refresh data from API
        handleCancel()
        return
      }

      // CREATE new role
      const createResult = await createRoleMutation({ 
        role: trimmedName, 
        plant_id: selectedPlantId,
        created_by: currentUserId 
      }).unwrap()
      
      if (createResult?.status !== 'success') {
        throw new Error(createResult?.message || 'Operation failed')
      }
      
      notify.success('Success', createResult?.message === 'Role restored successfully' ? 'Role restored successfully' : 'Role created successfully')
      
      // Wait a bit for DB to update, then refresh
      setTimeout(async () => {
        await refetch()
      }, 500)
      
      handleCancel()
    } catch (error) {
      console.error('Error saving role:', error)
      notify.error('Error saving role', error?.message || 'Operation failed')
    }
  }

  // Clear form
  const handleCancel = () => {
    setRoleName('')
    setPlantId('')
    setPlantSearch('')
    setEditingId(null)
  }

  // Edit role
  const handleEdit = (role) => {
    setRoleName(role.roleName)
    setPlantId(role.plantId ? String(role.plantId) : '')
    setEditingId(role.id)
  }

  // Delete role
  const handleDelete = async (id) => {
    const confirmed = await confirmAction({
      title: 'Delete role?',
      text: 'Are you sure you want to delete this role?',
      confirmButtonText: 'Delete',
    })

    if (!confirmed) return

    try {
      const result = await deleteRoleMutation({ 
        role_id: id, 
        deleted_by: currentUserId 
      }).unwrap()
      
      if (result?.status !== 'success') {
        throw new Error(result?.message || 'Delete failed')
      }
      
      notify.success('Deleted', 'Role deleted successfully')
      await refetch() // Refresh data from API
    } catch (error) {
      console.error('Error deleting role:', error)
      notify.error('Error deleting role', error?.message)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (plantSearch && !event.target.closest('.plant-dropdown-container')) {
        setPlantSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [plantSearch])

  // ============================================
  // FILTERING & PAGINATION
  // ============================================
  const filteredRoles = roles.filter(role =>
    role.roleName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredRoles.length / pageSize)
  const paginatedData = filteredRoles.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  // ============================================
  // RENDER
  // ============================================
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
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

              {/* ============================================ */}
              {/* LEFT PANEL - ROLE MASTER FORM */}
              {/* ============================================ */}
              <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden h-[600px] flex flex-col">
                <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FiShield className="text-2xl" />
                    <h2 className="text-xl font-semibold tracking-wide">
                      {editingId ? 'EDIT ROLE' : 'ROLE MASTER'}
                    </h2>
                  </div>
                </header>

                <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                  
                  {/* Role Name Input */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <FiUsers className="text-[#0e4a78]" />
                      Role Name
                    </label>
                    <input
                      type="text"
                      placeholder="Role Name"
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-slate-700 placeholder:text-slate-400 transition-all"
                    />
                  </div>

                  {/* Plant Name Dropdown */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Plant Name <span className="text-xs font-normal text-slate-500">(Optional)</span>
                    </label>
                    <div className="relative plant-dropdown-container">
                      {/* Dropdown Toggle Button */}
                      <button
                        type="button"
                        onClick={() => setPlantSearch(prev => prev === '' ? ' ' : '')}
                        className="w-full px-3 py-2.5 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-left text-slate-700 bg-white flex items-center justify-between transition-all text-sm"
                      >
                        <span>
                          {plantId
                            ? plants.find((plant) => String(plant.id) === String(plantId))?.plantName || 'Select plant'
                            : 'Select plant'}
                        </span>
                        <svg 
                          className={`w-4 h-4 transition-transform flex-shrink-0 ${plantSearch ? 'rotate-180' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Dropdown Menu */}
                      {plantSearch && (
                        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-slate-300 rounded-lg shadow-xl">
                          {/* Dropdown list */}
                          <div className="max-h-48 overflow-y-auto custom-scrollbar">
                            {plantsLoading ? (
                              <div className="px-3 py-3 text-sm text-slate-400">Loading plants...</div>
                            ) : plants.length > 0 ? plants.map((plant) => (
                              <div
                                key={plant.id}
                                onClick={() => {
                                  setPlantId(String(plant.id))
                                  setPlantSearch('')
                                }}
                                className={`px-3 py-2 cursor-pointer text-sm transition border-b border-slate-100 last:border-b-0
                                  ${
                                    String(plantId) === String(plant.id)
                                      ? 'bg-[#0e4a78] text-white'
                                      : 'hover:bg-slate-50 text-slate-700'
                                  }
                                `}
                              >
                                {plant.plantName}
                              </div>
                            )) : (
                              <div className="px-3 py-3 text-sm text-slate-400">No plants created</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Save/Cancel Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSave}
                      className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                    >
                      {editingId ? 'Update' : 'Save'}
                    </button>
                    {editingId && (
                      <button
                        onClick={handleCancel}
                        className="px-6 py-3 rounded-lg border-2 border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-all duration-200"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {/* ============================================ */}
              {/* RIGHT PANEL - ROLES TABLE */}
              {/* ============================================ */}
              <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col h-[600px]">
                <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FiShield className="text-2xl" />
                      <h2 className="text-xl font-semibold tracking-wide">ROLES LIST</h2>
                    </div>
                    <div className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">
                      {filteredRoles.length} roles
                    </div>
                  </div>
                </header>

                {/* Search Bar */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search roles..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-sm"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <FiX />
                      </button>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto flex-1">
                  <table className="min-w-full text-xs md:text-sm text-left">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                        <th className="px-4 sm:px-5 py-3 text-left font-semibold border-r border-white/30">
                          <div className="flex items-center gap-2">
                            <FiShield />
                            Role Name
                          </div>
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
                      {isLoading ? (
                        <tr>
                          <td colSpan="3" className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-3 text-slate-400">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0e4a78]"></div>
                              <p className="text-sm font-medium">Loading roles...</p>
                            </div>
                          </td>
                        </tr>
                      ) : paginatedData.length > 0 ? (
                        paginatedData.map((role) => (
                          <tr key={role.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200">
                            <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs">
                                <FiShield className="text-xs" />
                                {role.roleName}
                              </span>
                            </td>
                            <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 font-medium">
                              {role.plantName && role.plantName.length > 0 ? role.plantName.join(', ') : '-'}
                            </td>
                            <td className="px-4 sm:px-5 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEdit(role)}
                                  className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                                  title="Edit"
                                >
                                  <FiEdit2 className="text-sm" />
                                </button>
                                <button
                                  onClick={() => handleDelete(role.id)}
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
                              <p className="text-sm font-medium">No roles found</p>
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
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600">
                  <div className="font-medium">
                    Showing <span className="text-[#0e4a78] font-bold">{Math.min((currentPage - 1) * pageSize + 1, filteredRoles.length)}</span> to <span className="text-[#0e4a78] font-bold">{Math.min(currentPage * pageSize, filteredRoles.length)}</span> of <span className="text-[#0e4a78] font-bold">{filteredRoles.length}</span> entries
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

      {/* Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #0e4a78;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #0a3b61;
        }
      `}</style>
    </div>
  )
}

export default RolePage
