import React, { useState, useEffect } from 'react'
import { FiSearch, FiTrash2, FiEdit2, FiX, FiActivity, FiCheckCircle, FiXCircle } from 'react-icons/fi'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { confirmAction, notify } from '../../../utils/notify'
import { API_ENDPOINTS } from '../../../config/api'

const ManageActivity = () => {
  const [activityName, setActivityName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [activities, setActivities] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Fetch Activities on Mount
  useEffect(() => {
    fetchActivities()
  }, [])

  const fetchActivities = async () => {
    setIsLoading(true)
    try {
      const token = sessionStorage.getItem('authToken')
      const response = await fetch(API_ENDPOINTS.MASTER.GET_ACTIVITY, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()

      if (!response.ok || data?.status === 'error') {
        throw new Error(data?.message || 'Failed to fetch activities')
      }

      if (data && data.data) {
        const mappedActivities = data.data.map(item => ({
          id: item.ACTIVITY_ID ?? item.activity_id ?? item.ActivityID ?? item.id,
          activityName: item.ACTIVITY_NAME ?? item.activity_name ?? item.ActivityName ?? '',
          isActive:
            item.IS_ACTIVE === true ||
            item.IS_ACTIVE === 1 ||
            item.is_active === true ||
            item.is_active === 1 ||
            item.IsActive === true ||
            item.IsActive === 1
        }))
        setActivities(mappedActivities)
      } else {
        setActivities([])
      }
    } catch (error) {
      notify.error('Error', error?.message || 'Failed to fetch activities')
      setActivities([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!activityName) {
      notify.error('Validation', 'Activity Name is required')
      return
    }

    try {
      const token = localStorage.getItem('authToken')

      const formData = {
        activity_name: activityName
      }

      const response = await fetch(API_ENDPOINTS.MASTER.ADD_ACTIVITY, {
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

      notify.success('Success', 'Activity added successfully')
      handleCancel()
      fetchActivities()

    } catch (error) {
      console.error(error)
      notify.error('Error', error.message)
    }
  }

  const handleUpdate = async () => {
    if (!activityName) {
      notify.error('Validation', 'Activity Name is required')
      return
    }

    try {
      const token = localStorage.getItem('authToken')

      const formData = {
        activity_id: editingId,
        activity_name: activityName,
        is_active: isActive ? true : false
      }

      const response = await fetch(API_ENDPOINTS.MASTER.UPDATE_ACTIVITY, {
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

      notify.success('Success', 'Activity updated successfully')
      handleCancel()
      fetchActivities()

    } catch (error) {
      console.error(error)
      notify.error('Error', error.message)
    }
  }

  const handleCancel = () => {
    setActivityName('')
    setIsActive(true)
    setEditingId(null)
  }

  const handleEdit = (activity) => {
    setActivityName(activity.activityName)
    setIsActive(activity.isActive)
    setEditingId(activity.id)
  }

  const handleDelete = async (id) => {
    const confirmed = await confirmAction({
      title: 'Delete activity?',
      text: 'Are you sure you want to delete this activity?',
      confirmButtonText: 'Delete',
    })
    if (!confirmed) return

    try {
      const token = sessionStorage.getItem('authToken')

      const response = await fetch(API_ENDPOINTS.MASTER.DELETE_ACTIVITY, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ activity_id: id })
      })

      const data = await response.json()

      if (!response.ok || data?.status === 'error') {
        throw new Error(data?.message || 'Delete failed')
      }

      notify.success('Deleted', 'Activity deleted successfully')
      fetchActivities()

    } catch (error) {
      console.error(error)
      notify.error('Error', error.message)
    }
  }
  
  const filteredActivities = activities.filter(activity =>
    activity.activityName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredActivities.length / pageSize)
  const paginatedData = filteredActivities.slice(
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

              {/* Left Panel - Activity Master Form */}
              <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
                <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FiActivity className="text-2xl" />
                    <h2 className="text-xl font-semibold tracking-wide">
                      {editingId ? 'EDIT ACTIVITY' : 'ACTIVITY MASTER'}
                    </h2>
                  </div>
                </header>
                <div className="p-6 space-y-5">
                  {/* Activity Name */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <FiActivity className="text-[#0e4a78]" />
                      Activity Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="activity-name-input"
                      type="text"
                      placeholder="e.g., Gate In, Gate Out, Both"
                      value={activityName}
                      onChange={(e) => setActivityName(e.target.value)}
                      className="activity-input w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] placeholder:text-slate-400 transition-all"
                      autoComplete="off"
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

              {/* Right Panel - View Activity Table */}
              <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col">
                <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FiActivity className="text-2xl" />
                    <h2 className="text-xl font-semibold tracking-wide">VIEW ACTIVITIES</h2>
                  </div>
                </header>

                {/* Search Bar */}
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="activity-search-input"
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by activity name..."
                      className="activity-input w-full pl-10 pr-10 py-2.5 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-[#0e4a78] focus:ring-2 focus:ring-[#0e4a78]/20 text-sm transition-all"
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
                  <table className="activity-table min-w-full text-xs md:text-sm text-left">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                        <th className="px-3 sm:px-4 py-3 text-left font-semibold border-r border-white/30">
                          <div className="flex items-center gap-2">
                            <FiActivity className="text-xs" />
                            Activity Name
                          </div>
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
                        paginatedData.map((activity) => (
                          <tr key={activity.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200">
                            <td className="px-3 sm:px-4 py-3 text-black border-r border-slate-200 font-medium">
                              {activity.activityName}
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-center border-r border-slate-200">
                              {activity.isActive ? (
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
                                  onClick={() => handleEdit(activity)}
                                  className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                                  title="Edit"
                                >
                                  <FiEdit2 className="text-sm" />
                                </button>
                                <button
                                  onClick={() => handleDelete(activity.id)}
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
                              <p className="text-sm font-medium">No activities found</p>
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
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600 font-medium">
                  <div>
                    Showing <span className="text-[#0e4a78] font-bold">{Math.min((currentPage - 1) * pageSize + 1, filteredActivities.length)}</span> to <span className="text-[#0e4a78] font-bold">{Math.min(currentPage * pageSize, filteredActivities.length)}</span> of <span className="text-[#0e4a78] font-bold">{filteredActivities.length}</span> entries
                  </div>
                  {totalPages > 1 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-lg border-2 border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-[#0e4a78] font-semibold text-xs transition-all"
                      >
                        Previous
                      </button>
                      <button className="px-3 py-1.5 rounded-lg border-2 bg-[#0e4a78] text-white border-[#0e4a78] text-xs font-bold">
                        {currentPage}
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded-lg border-2 border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-[#0e4a78] font-semibold text-xs transition-all"
                      >
                        Next
                      </button>
                    </div>
                  )}
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
        #activity-name-input,
        #activity-search-input,
        input#activity-name-input,
        input#activity-search-input,
        .activity-input {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          background-color: #ffffff !important;
          font-weight: 500 !important;
        }
        
        #activity-name-input::placeholder,
        #activity-search-input::placeholder,
        .activity-input::placeholder {
          color: #94a3b8 !important;
          -webkit-text-fill-color: #94a3b8 !important;
          opacity: 1 !important;
        }
        
        .activity-table td {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }
      `}</style>
    </div>
  )
}

export default ManageActivity
