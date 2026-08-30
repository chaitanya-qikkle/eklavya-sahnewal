import React, { useMemo, useState } from 'react'
import { FiSearch, FiEdit2, FiTrash2, FiX, FiChevronDown, FiChevronUp } from 'react-icons/fi'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { confirmAction, notify } from '../../../utils/notify'
import { useCreateUserMutation, useDeleteUserMutation, useGetRolesQuery, useGetUsersQuery, useUpdateUserMutation } from '../../../store/api/ymsApi'

// Mock roles
// Mock roles removed in favor of API
// const mockRoles = [ ... ]


const UserPage = () => {
  const [showRegistrationModal, setShowRegistrationModal] = useState(false)
  const [editingUserId, setEditingUserId] = useState(null)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null })
  const pageSize = 10

  // Form state
  const [formData, setFormData] = useState({
    role: '',
    plantId: '1',
    clientId: '1',
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    confirmPassword: '',
    emailId: '',
  })

  const { data: usersData, isLoading: isUsersLoading } = useGetUsersQuery()
  const { data: rolesData, isLoading: isRolesLoading } = useGetRolesQuery()
  const [createUserMutation] = useCreateUserMutation()
  const [deleteUserMutation] = useDeleteUserMutation()
  const [updateUserMutation] = useUpdateUserMutation()

  const roles = rolesData?.roles || []
  const apiUsers = usersData?.users || []

  const roleNameById = useMemo(() => {
    const map = new Map()
    roles.forEach((r) => {
      if (r?.id != null) {
        map.set(String(r.id), r?.roleName || '')
      }
    })
    return map
  }, [roles])

  const users = useMemo(() => {
    return apiUsers.map((u) => {
      const firstName = u?.firstName || ''
      const lastName  = u?.lastName  || ''
      const fullName  = `${firstName} ${lastName}`.trim()
      const roleId    = u?.roleId
      const roleName  = u?.roleName || roleNameById.get(String(roleId)) || (roleId != null ? String(roleId) : '')

      return {
        id:        u?.id,
        role:      roleName,
        roleId,
        plantId:   u?.plantId,
        clientId:  u?.clientId,
        firstName,
        lastName,
        client:    '',
        plant:     '',
        name:      fullName || u?.username || '',
        username:  u?.username  || '',
        emailId:   u?.emailId   || '',
        active:    u?.active ?? true,
      }
    })
  }, [apiUsers, roleNameById])

  // Filter and sort data
  const processedData = useMemo(() => {
    let data = [...users]

    if (search) {
      const lowerSearch = search.toLowerCase()
      data = data.filter(item =>
        item.name.toLowerCase().includes(lowerSearch) ||
        item.username.toLowerCase().includes(lowerSearch) ||
        item.emailId?.toLowerCase().includes(lowerSearch) ||
        item.role.toLowerCase().includes(lowerSearch)
      )
    }

    if (sortConfig.key) {
      data.sort((a, b) => {
        const aVal = a[sortConfig.key] || ''
        const bVal = b[sortConfig.key] || ''
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return data
  }, [search, sortConfig, users])

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize)
  const paginatedData = processedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSaveUser = async () => {
    // Validation
    if (!formData.role || !formData.firstName || !formData.username || !formData.emailId) {
      notify.warning('Missing fields', 'Please fill all required fields')
      return
    }

    const isEditing = Boolean(editingUserId)
    if (!isEditing && !formData.password) {
      notify.warning('Missing fields', 'Password is required to create a user')
      return
    }
    if ((formData.password || formData.confirmPassword) && formData.password !== formData.confirmPassword) {
      notify.warning('Password mismatch', 'Passwords do not match')
      return
    }

    try {
      const basePayload = {
        role_id: Number(formData.role),
        first_name: formData.firstName,
        last_name: formData.lastName,
        username: formData.username,
        email_id: formData.emailId,
      }

      if (isEditing) {
        const payload = {
          user_id:   editingUserId,
          ...basePayload,
          plant_id:  Number(formData.plantId)  || 1,
          client_id: Number(formData.clientId) || 1,
          password:  formData.password || null,
          created_by: editingUserId,
        }

        const result = await updateUserMutation(payload).unwrap()
        if (result?.status !== 'success') {
          throw new Error(result?.message || 'Failed to update user')
        }

        notify.success('Success', result?.message || 'User updated successfully')
        setShowRegistrationModal(false)
        setEditingUserId(null)
        setFormData({
          role: '', plantId: '1', clientId: '1',
          firstName: '', lastName: '', username: '',
          password: '', confirmPassword: '', emailId: '',
        })
        return
      }

      const payload = {
        ...basePayload,
        plant_id:  Number(formData.plantId)  || 1,
        client_id: Number(formData.clientId) || 1,
        password: formData.password,
      }

      const result = await createUserMutation(payload).unwrap()
      if (result?.status !== 'success') {
        throw new Error(result?.message || 'Failed to register user')
      }

      notify.success('Success', result?.message || 'User registered successfully')
      setShowRegistrationModal(false)
      setFormData({
        role: '',
        firstName: '',
        lastName: '',
        username: '',
        password: '',
        confirmPassword: '',
        emailId: ''
      })
    } catch (error) {
      console.error('Error saving user:', error)
      const detail = error?.data?.detail || (Array.isArray(error?.data?.data) ? error?.data?.data : null)
      const messageFromDetail = Array.isArray(detail)
        ? detail.map((d) => `${(d?.loc || []).join('.')}: ${d?.msg}`).join('\n')
        : detail

      const message =
        messageFromDetail ||
        error?.data?.message ||
        error?.error ||
        error?.message ||
        'An error occurred while registering the user.'

      notify.error('Failed to register', message)
    }
  }

  const handleEditUser = (user) => {
    setEditingUserId(user.id)
    setFormData({
      role:     user?.roleId   != null ? String(user.roleId)   : '',
      plantId:  user?.plantId  != null ? String(user.plantId)  : '1',
      clientId: user?.clientId != null ? String(user.clientId) : '1',
      firstName: user?.firstName || '',
      lastName:  user?.lastName  || '',
      username:  user?.username  || '',
      password:  '',
      confirmPassword: '',
      emailId:   user?.emailId || '',
    })
    setShowRegistrationModal(true)
  }

  const handleDeleteUser = async (user) => {
    const confirmed = await confirmAction({
      title: 'Delete user?',
      text: `Are you sure you want to delete ${user.name}?`,
      confirmButtonText: 'Delete',
    })
    if (!confirmed) return

    try {
      const result = await deleteUserMutation({ user_id: user.id, deleted_by: user.id }).unwrap()
      if (result?.status !== 'success') {
        throw new Error(result?.message || 'Delete failed')
      }
      notify.success('Deleted', result?.message || 'User deleted successfully')
    } catch (error) {
      console.error('Error deleting user:', error)
      notify.error('Error deleting user', error?.data?.message || error?.message || 'Delete failed')
    }
  }

  const handleCancel = () => {
    setShowRegistrationModal(false)
    setEditingUserId(null)
    setFormData({
      role: '',
      firstName: '',
      lastName: '',
      username: '',
      password: '',
      confirmPassword: '',
      emailId: ''
    })
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
          <div className="w-full space-y-6">

            {/* User Registration Modal */}
            {showRegistrationModal && (
              <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
                <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-6 py-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold tracking-wide">User Registration</h2>
                  <button
                    onClick={handleCancel}
                    className="p-1 hover:bg-white/20 rounded-lg transition"
                  >
                    <FiX className="text-xl" />
                  </button>
                </header>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Role */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-600 mb-2">
                        Role <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="role"
                        value={formData.role}
                        onChange={handleInputChange}
                        disabled={isRolesLoading}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700 bg-white"
                      >
                        <option value="">--SELECT--</option>
                        {roles.map(role => (
                          <option key={role.id} value={role.id}>
                            {role.roleName || role.id}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* First Name */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-600 mb-2">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        placeholder="First Name"
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700 placeholder:text-slate-400"
                      />
                    </div>

                    {/* Last Name */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-600 mb-2">
                        Last Name
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        placeholder="Last Name"
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700 placeholder:text-slate-400"
                      />
                    </div>

                    {/* Username */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-600 mb-2">
                        UserName <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleInputChange}
                        placeholder="Username"
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700 placeholder:text-slate-400"
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-600 mb-2">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder={editingUserId ? 'Leave blank to keep current password' : 'Password'}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700 placeholder:text-slate-400"
                      />
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-600 mb-2">
                        Confirm Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        placeholder={editingUserId ? 'Confirm new password (optional)' : 'Password'}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700 placeholder:text-slate-400"
                      />
                    </div>

                    {/* Email ID */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-600 mb-2">
                        EmailId <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        name="emailId"
                        value={formData.emailId}
                        onChange={handleInputChange}
                        placeholder="EmailId"
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 text-slate-700 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 mt-6 justify-end">
                    <button
                      onClick={handleCancel}
                      className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveUser}
                      className="px-6 py-2.5 rounded-xl bg-[#0e4a78] text-white font-semibold hover:bg-[#0b3e66] transition shadow-md"
                    >
                      {editingUserId ? 'Update' : 'Save'}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* View User Detail Section */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-wide">View User Detail</h2>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowRegistrationModal(true)}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition shadow"
                  >
                    + Add User
                  </button>
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70" />
                    <input
                      type="text"
                      placeholder="Search:"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/20 w-full sm:w-64"
                    />
                  </div>
                </div>
              </header>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs md:text-sm text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                      {[
                        { key: 'role', label: 'Role' },
                        { key: 'client', label: 'Client' },
                        { key: 'plant', label: 'Plant' },
                        { key: 'name', label: 'Name' },
                        { key: 'username', label: 'Username' },
                        { key: 'emailId', label: 'Email ID' },
                        { key: 'actions', label: 'Action', sortable: false }
                      ].map((col) => (
                        <th
                          key={col.key}
                          onClick={() => col.sortable !== false && handleSort(col.key)}
                          className={`px-4 sm:px-5 py-3 text-left font-semibold border-r border-white/30 last:border-r-0 ${col.sortable !== false ? 'cursor-pointer hover:bg-white/10' : ''} transition select-none`}
                        >
                          <div className="flex items-center gap-2">
                            {col.label}
                            {col.sortable !== false && sortConfig.key === col.key && (
                              sortConfig.direction === 'asc' ? <FiChevronUp /> : <FiChevronDown />
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedData.map((row) => (
                      <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                          {row.role}
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">{row.client}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">{row.plant}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 font-medium">{row.name}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">{row.username}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">{row.emailId || '-'}</td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditUser(row)}
                              className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition"
                              title="Edit"
                            >
                              <FiEdit2 className="text-sm" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(row)}
                              className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition"
                              title="Delete"
                            >
                              <FiTrash2 className="text-sm" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginatedData.length === 0 && (
                      <tr>
                        <td colSpan="7" className="px-6 py-8 text-center text-slate-500">
                          {isUsersLoading ? 'Loading users...' : 'No users found'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600">
                <div>
                  Showing {Math.min((currentPage - 1) * pageSize + 1, processedData.length)} to {Math.min(currentPage * pageSize, processedData.length)} of {processedData.length} entries
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
        </main>
        <Footer />
      </div>
    </div>
  )
}

export default UserPage