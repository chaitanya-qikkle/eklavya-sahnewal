import React, { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import {
  FiSearch,
  FiTrash2,
  FiChevronDown,
  FiChevronRight,
  FiCheckCircle,
  FiX,
  FiLayers,
  FiUsers,
  FiShield
} from 'react-icons/fi'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { notify } from '../../../utils/notify'
import { useGetMenusQuery, useGetRoleMenusQuery, useGetRolesQuery, useSetRoleMenusMutation } from '../../../store/api/ymsApi'
import { selectAuthUser } from '../../../store/slices/authSlice'

const toNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const buildMenuHierarchy = (rows) => {
  const items = Array.isArray(rows) ? rows : []
  const menus = items
    .map((m) => ({
      id: toNumber(m?.MENU_ID ?? m?.menu_id),
      name: String(m?.MENU_NAME ?? m?.menu_name ?? '').trim(),
      parentId: toNumber(m?.PARENT_MENU_ID ?? m?.parent_menu_id),
      sort: toNumber(m?.SORT_ORDER ?? m?.sort_order) ?? 0,
      isActive: m?.IS_ACTIVE ?? m?.is_active,
      isDeleted: m?.IS_DELETED ?? m?.is_deleted,
    }))
    .filter((m) => m.id && m.name && !(m.isDeleted === 1 || m.isDeleted === true))

  const byId = new Map(menus.map((m) => [m.id, { id: m.id, name: m.name, parentId: m.parentId, sort: m.sort, children: [] }]))

  const parents = []
  byId.forEach((m) => {
    const parentId = m.parentId
    if (!parentId) {
      parents.push(m)
      return
    }
    const parent = byId.get(parentId)
    if (!parent) {
      parents.push({ ...m, parentId: null })
      return
    }
    parent.children.push(m)
  })

  const sorter = (a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name)
  parents.sort(sorter)
  parents.forEach((p) => p.children.sort(sorter))
  return parents
}

const RoleMenuMapping = () => {
  const authUser = useSelector(selectAuthUser)
  const currentUserId = authUser?.id || authUser?.user_id || authUser?.UserID || '00000000-0000-0000-0000-000000000000'

  const { data: rolesResponse } = useGetRolesQuery()
  const { data: menusResponse } = useGetMenusQuery()
  const [setRoleMenus] = useSetRoleMenusMutation()

  const roles = useMemo(() => {
    const apiRoles = rolesResponse?.roles || []
    return apiRoles
      .map((r) => ({ id: toNumber(r?.id), name: String(r?.roleName || '').trim() }))
      .filter((r) => r.id && r.name)
  }, [rolesResponse])

  const [selectedRoleId, setSelectedRoleId] = useState(null)
  const [selectedMenus, setSelectedMenus] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedMenus, setExpandedMenus] = useState({})
  const pageSize = 10

  const selectedRole = useMemo(() => roles.find((r) => r.id === selectedRoleId) || null, [roles, selectedRoleId])

  const menuHierarchy = useMemo(() => buildMenuHierarchy(menusResponse?.data), [menusResponse])

  const { data: roleMenusResponse } = useGetRoleMenusQuery(selectedRoleId, {
    skip: !selectedRoleId,
  })

  const roleMenus = useMemo(() => {
    const rows = Array.isArray(roleMenusResponse?.data) ? roleMenusResponse.data : []
    return rows
      .map((m) => ({
        id: toNumber(m?.MENU_ID ?? m?.menu_id),
        name: String(m?.MENU_NAME ?? m?.menu_name ?? '').trim(),
      }))
      .filter((m) => m.id && m.name)
  }, [roleMenusResponse])

  const mappings = useMemo(() => {
    const roleName = selectedRole?.name || ''
    return roleMenus.map((m) => ({
      id: `${selectedRoleId}::${m.id}`,
      role: roleName,
      menuId: m.id,
      menu: m.name,
    }))
  }, [roleMenus, selectedRoleId, selectedRole])

  useEffect(() => {
    // Default select first available role
    if (roles.length && !selectedRoleId) {
      setSelectedRoleId(roles[0].id)
    }
  }, [roles])

  useEffect(() => {
    const next = {}
    roleMenus.forEach((m) => {
      next[String(m.id)] = true
    })
    setSelectedMenus(next)
  }, [selectedRoleId, roleMenus])

  const handleMenuToggle = (menuId) => {
    setSelectedMenus(prev => ({
      ...prev,
      [menuId]: !prev[menuId]
    }))
  }

  const toggleExpand = (menuId) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuId]: !prev[menuId]
    }))
  }

  const handleSave = () => {
    const selectedCount = Object.values(selectedMenus).filter(Boolean).length

    if (!selectedRoleId) {
      notify.warning('Select role', 'Please select a role')
      return
    }

    const ids = Object.entries(selectedMenus)
      .filter(([, checked]) => Boolean(checked))
      .map(([id]) => toNumber(id))
      .filter(Boolean)

    setRoleMenus({ role_id: selectedRoleId, menu_ids: ids, created_by: currentUserId })
      .unwrap()
      .then(() => {
        setCurrentPage(1)
        notify.success('Saved', `Saved ${selectedCount} menu permissions for ${selectedRole?.name || ''} role`)
      })
      .catch((err) => {
        notify.warning('Save failed', err?.data?.message || err?.message || 'Failed to save role menus')
      })
  }

  const handleRemoveMapping = (role, menuId) => {
    if (!selectedRoleId) return
    const currentIds = roleMenus.map((m) => m.id)
    const nextIds = currentIds.filter((id) => id !== menuId)

    setRoleMenus({ role_id: selectedRoleId, menu_ids: nextIds, created_by: currentUserId })
      .unwrap()
      .catch((err) => {
        notify.warning('Remove failed', err?.data?.message || err?.message || 'Failed to remove mapping')
      })
  }

  const filteredMappings = mappings.filter(mapping =>
    mapping.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(mapping.menu || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredMappings.length / pageSize)
  const paginatedData = filteredMappings.slice(
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

              {/* Left Panel - Role Menu Master */}
              <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
                <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FiShield className="text-2xl" />
                    <h2 className="text-xl font-semibold tracking-wide">ROLE MENU MASTER</h2>
                  </div>
                </header>
                <div className="p-6 space-y-5">
                  {/* Role Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <FiUsers className="text-[#0e4a78]" />
                      Select Role
                    </label>
                    <select
                      value={selectedRoleId || ''}
                      onChange={(e) => setSelectedRoleId(toNumber(e.target.value))}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-slate-700 bg-white font-medium transition-all"
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Menu Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <FiLayers className="text-[#0e4a78]" />
                      Assign Menus
                    </label>
                    <div className="border-2 border-slate-300 rounded-xl p-4 h-[500px] overflow-y-auto bg-gradient-to-b from-slate-50 to-white custom-scrollbar">
                      <div className="text-xs text-slate-500 mb-3 pb-2 border-b border-slate-200 font-semibold uppercase tracking-wide">
                        Select menu items to assign
                      </div>
                      {menuHierarchy.map((menu) => {
                        const isExpanded = expandedMenus[menu.id]
                        const hasChildren = menu.children && menu.children.length > 0
                        const isChecked = selectedMenus[menu.id] || false
                        const childrenCheckedCount = menu.children.filter(c => selectedMenus[c.id]).length

                        return (
                          <div key={menu.id} className="mb-2 rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                            <div className={`flex items-center gap-2 p-3 ${isChecked ? 'bg-gradient-to-r from-[#0e4a78] to-[#0a3b61]' : 'bg-slate-50 hover:bg-slate-100'} transition-colors`}>
                              {hasChildren && (
                                <button
                                  onClick={() => toggleExpand(menu.id)}
                                  className={`p-1 rounded hover:bg-white/20 transition ${isChecked ? 'text-white' : 'text-slate-600'}`}
                                >
                                  {isExpanded ? <FiChevronDown className="text-sm" /> : <FiChevronRight className="text-sm" />}
                                </button>
                              )}
                              <input
                                type="checkbox"
                                id={menu.id}
                                checked={isChecked}
                                onChange={() => handleMenuToggle(menu.id)}
                                className="w-5 h-5 text-[#0e4a78] border-slate-300 rounded focus:ring-[#0e4a78] cursor-pointer"
                              />
                              <label
                                htmlFor={menu.id}
                                className={`text-sm font-semibold cursor-pointer flex items-center gap-2 flex-1 ${isChecked ? 'text-white' : 'text-slate-700'
                                  }`}
                              >
                                <span className="text-lg">{menu.icon}</span>
                                {menu.name}
                                {hasChildren && childrenCheckedCount > 0 && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${isChecked ? 'bg-white/20 text-white' : 'bg-[#0e4a78] text-white'}`}>
                                    {childrenCheckedCount}/{menu.children.length}
                                  </span>
                                )}
                              </label>
                            </div>

                            {hasChildren && isExpanded && (
                              <div className="bg-white border-t border-slate-200">
                                <div className="p-2 space-y-1">
                                  {menu.children.map((child) => (
                                    <div key={child.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-blue-50 transition-colors group">
                                      <input
                                        type="checkbox"
                                        id={child.id}
                                        checked={selectedMenus[child.id] || false}
                                        onChange={() => handleMenuToggle(child.id)}
                                        className="w-4 h-4 text-[#0e4a78] border-slate-300 rounded focus:ring-[#0e4a78] cursor-pointer ml-6"
                                      />
                                      <label
                                        htmlFor={child.id}
                                        className="text-sm text-slate-600 cursor-pointer group-hover:text-[#0e4a78] group-hover:font-medium transition-all flex-1"
                                      >
                                        {child.name}
                                      </label>
                                      {selectedMenus[child.id] && (
                                        <FiCheckCircle className="text-emerald-500 text-sm" />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setSelectedMenus({})}
                      className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white font-semibold hover:from-[#0b3e66] hover:to-[#072c4a] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      Save Permissions
                    </button>
                  </div>
                </div>
              </section>

              {/* Right Panel - View Role Menu */}
              <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col">
                <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FiLayers className="text-2xl" />
                    <h2 className="text-xl font-semibold tracking-wide">VIEW ROLE MENU MAPPINGS</h2>
                  </div>
                </header>

                {/* Search Bar */}
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by role or menu..."
                      className="w-full pl-10 pr-10 py-2.5 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-[#0e4a78] focus:ring-2 focus:ring-[#0e4a78]/20 text-sm transition-all"
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
                  <table className="min-w-full text-xs md:text-sm text-left">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                        <th className="px-4 sm:px-5 py-3 text-left font-semibold border-r border-white/30">
                          <div className="flex items-center gap-2">
                            <FiShield />
                            Role
                          </div>
                        </th>
                        <th className="px-4 sm:px-5 py-3 text-left font-semibold border-r border-white/30">
                          <div className="flex items-center gap-2">
                            <FiLayers />
                            Menu
                          </div>
                        </th>
                        <th className="px-4 sm:px-5 py-3 text-center font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {paginatedData.length > 0 ? (
                        paginatedData.map((mapping, index) => (
                          <tr
                            key={mapping.id}
                            className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200 group"
                          >
                            <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs">
                                <FiShield className="text-xs" />
                                {mapping.role}
                              </span>
                            </td>
                            <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 font-medium">
                              {mapping.menu}
                            </td>
                            <td className="px-4 sm:px-5 py-3 text-center">
                              <button
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5 font-semibold"
                                onClick={() => handleRemoveMapping(mapping.role, mapping.menuId)}
                              >
                                <FiTrash2 />
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-3 text-slate-400">
                              <FiSearch className="text-4xl" />
                              <p className="text-sm font-medium">No role-menu mappings found</p>
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
                    Showing <span className="text-[#0e4a78] font-bold">{Math.min((currentPage - 1) * pageSize + 1, filteredMappings.length)}</span> to <span className="text-[#0e4a78] font-bold">{Math.min(currentPage * pageSize, filteredMappings.length)}</span> of <span className="text-[#0e4a78] font-bold">{filteredMappings.length}</span> entries
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

export default RoleMenuMapping