import { useMemo, useState } from 'react'
import { Edit2, Trash2, Search, X, Layers, Menu } from 'lucide-react'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import { confirmAction, notify } from '../../../utils/notify'
import { getStoredUser } from '../../../services/authService'
import { useCreateMenuMutation, useDeleteMenuMutation, useGetMenusQuery, useUpdateMenuMutation } from '../../../store/api/ymsApi'
import { useGetPlantsQuery } from '../../../store/api/plantApi'

const toNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const normalizeMenuRow = (row) => ({
  id: toNumber(row?.MENU_ID ?? row?.menu_id),
  menuName: String(row?.MENU_NAME ?? row?.menu_name ?? '').trim(),
  parentMenuId: toNumber(row?.PARENT_MENU_ID ?? row?.parent_menu_id),
  menuUrl: String(row?.MENU_URL ?? row?.menu_url ?? ''),
  menuIcon: String(row?.MENU_ICON ?? row?.menu_icon ?? ''),
  area: String(row?.AREA ?? row?.area ?? ''),
  controller: String(row?.CONTROLLER ?? row?.controller ?? ''),
  actionResult: String(row?.ACTION_RESULT ?? row?.action_result ?? ''),
  plantName: String(row?.PLANT_NAME ?? row?.plant_name ?? ''),
  sortOrder: toNumber(row?.SORT_ORDER ?? row?.sort_order) ?? 0,
})

const MenuPage = () => {
  const { data: menusResponse, isLoading: menusLoading, refetch: refetchMenus } = useGetMenusQuery()
  const [createMenu] = useCreateMenuMutation()
  const [updateMenu] = useUpdateMenuMutation()
  const [deleteMenu] = useDeleteMenuMutation()
  const { data: plantsResponse } = useGetPlantsQuery()
  const plants = useMemo(() => (plantsResponse?.plants || []).map((p) => p.plantName).filter(Boolean), [plantsResponse])

  const menus = useMemo(() => {
    const rows = Array.isArray(menusResponse?.data) ? menusResponse.data : []
    console.log('Raw menus data:', menusResponse) // Debug log
    return rows.map(normalizeMenuRow).filter((m) => m.id && m.menuName)
  }, [menusResponse])

  const menuNameById = useMemo(() => {
    const map = new Map()
    menus.forEach((m) => map.set(m.id, m.menuName))
    return map
  }, [menus])

  const [editingId, setEditingId] = useState(null)

  const parentMenuOptions = useMemo(() => {
    const items = Array.isArray(menus) ? menus : []

    // Filter to show only top-level menus (menus without a parent)
    const topLevelMenus = items.filter((m) => !m.parentMenuId)

    if (!editingId) {
      return [...topLevelMenus].sort((a, b) => a.menuName.localeCompare(b.menuName))
    }

    // When editing, prevent obvious cycles: cannot set parent to itself or any of its descendants.
    const childrenByParent = new Map()
    items.forEach((m) => {
      if (!m.parentMenuId) return
      const key = m.parentMenuId
      const next = childrenByParent.get(key) || []
      next.push(m.id)
      childrenByParent.set(key, next)
    })

    const excluded = new Set([editingId])
    const stack = [editingId]
    while (stack.length) {
      const current = stack.pop()
      const kids = childrenByParent.get(current) || []
      kids.forEach((childId) => {
        if (excluded.has(childId)) return
        excluded.add(childId)
        stack.push(childId)
      })
    }

    return topLevelMenus
      .filter((m) => !excluded.has(m.id))
      .sort((a, b) => a.menuName.localeCompare(b.menuName))
  }, [menus, editingId])

  const [menuName, setMenuName] = useState('')
  const [parentMenuId, setParentMenuId] = useState('')
  const [plantName, setPlantName] = useState('')
  const [menuUrl, setMenuUrl] = useState('')
  const [area, setArea] = useState('')
  const [controller, setController] = useState('')
  const [actionResult, setActionResult] = useState('')
  const [menuIcon, setMenuIcon] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isPlantDropdownOpen, setIsPlantDropdownOpen] = useState(false)
  const pageSize = 10

  const handlePlantChange = (plant) => {
    setPlantName(plant)
    setIsPlantDropdownOpen(false)
  }

  const getActorUserId = () => {
    const user = getStoredUser()
    const id = user?.user_id ?? user?.USER_ID ?? user?.id
    return toNumber(id) ?? 1
  }

  const handleSave = () => {
    if (!menuName.trim()) {
      notify.warning('Missing fields', 'Menu name is required')
      return
    }

    // Plant is only mandatory for child menus. Parent (top-level) menus can be created without it.
    if (parentMenuId && !plantName) {
      notify.warning('Missing fields', 'Plant name is required for child menus')
      return
    }

    const actorId = getActorUserId()

    // Use the existing "Area" input as the sort index for now.
    // If Area is blank while editing, keep the current sortOrder to avoid resetting.
    const sortOrderFromArea = toNumber(area)
    const existingSortOrder = editingId
      ? (menus.find((m) => m.id === editingId)?.sortOrder ?? 0)
      : 0

    const payloadBase = {
      menu_name: menuName,
      parent_menu_id: parentMenuId ? toNumber(parentMenuId) : null,
      menu_url: menuUrl || null,
      menu_icon: menuIcon || null,
      area: area || null,
      controller: controller || null,
      action_result: actionResult || null,
      plant_name: plantName || null,
      sort_order: sortOrderFromArea ?? existingSortOrder,
    }

    if (editingId) {
      updateMenu({
        menu_id: editingId,
        ...payloadBase,
        is_active: true,
        modified_by: actorId,
      })
        .unwrap()
        .then((res) => {
          if (res?.status === 'error') {
            notify.warning('Update failed', res?.message || 'Failed to update menu')
            return
          }
          notify.success('Saved', 'Menu updated successfully')
          handleCancel()
          refetchMenus()
        })
        .catch((err) => {
          notify.warning('Update failed', err?.data?.message || err?.message || 'Failed to update menu')
        })
      return
    }

    createMenu({
      ...payloadBase,
      created_by: actorId,
    })
      .unwrap()
      .then((res) => {
        if (res?.status === 'error') {
          notify.warning('Create failed', res?.message || 'Failed to create menu')
          return
        }
        notify.success('Saved', 'Menu created successfully')
        handleCancel()
        // Manually refetch to ensure table updates
        refetchMenus()
      })
      .catch((err) => {
        notify.warning('Create failed', err?.data?.message || err?.message || 'Failed to create menu')
      })
  }

  const handleCancel = () => {
    setMenuName('')
    setParentMenuId('')
    setPlantName('')
    setMenuUrl('')
    setArea('')
    setController('')
    setActionResult('')
    setMenuIcon('')
    setEditingId(null)
    setIsPlantDropdownOpen(false)
  }

  const handleEdit = (menu) => {
    setMenuName(menu.menuName)
    setParentMenuId(menu.parentMenuId ? String(menu.parentMenuId) : '')
    setPlantName(menu.plantName || '')
    setMenuUrl(menu.menuUrl)
    setArea(menu.area)
    setController(menu.controller)
    setActionResult(menu.actionResult)
    setMenuIcon(menu.menuIcon)
    setEditingId(menu.id)
  }

  const handleDelete = async (id) => {
    const confirmed = await confirmAction({
      title: 'Delete menu?',
      text: 'Are you sure you want to delete this menu?',
      confirmButtonText: 'Delete',
    })
    if (!confirmed) return

    const actorId = getActorUserId()
    deleteMenu({ menu_id: id, deleted_by: actorId })
      .unwrap()
      .then((res) => {
        if (res?.status === 'error') {
          notify.warning('Delete failed', res?.message || 'Failed to delete menu')
          return
        }
        notify.success('Deleted', 'Menu deleted successfully')
        refetchMenus()
      })
      .catch((err) => {
        notify.warning('Delete failed', err?.data?.message || err?.message || 'Failed to delete menu')
      })
  }

  const filteredMenus = menus.filter((menu) => {
    // If search term is empty, show all menus
    if (!searchTerm || searchTerm.trim() === '') {
      return true
    }
    
    const parentName = menu.parentMenuId ? (menuNameById.get(menu.parentMenuId) || '') : ''
    const searchLower = searchTerm.toLowerCase()
    
    return (
      (menu.menuName || '').toLowerCase().includes(searchLower) ||
      parentName.toLowerCase().includes(searchLower) ||
      String(menu.menuUrl || '').toLowerCase().includes(searchLower)
    )
  }).sort((a, b) => {
    // Sort by area field (convert to number for proper sorting)
    const areaA = parseInt(a.area) || 0
    const areaB = parseInt(b.area) || 0
    
    // Debug logging - show all menus with area
    console.log(`Menu: "${a.menuName}" - Area: "${a.area}" (parsed: ${areaA})`)
    
    return areaA - areaB
  })
  
  console.log('=== All Menus After Sort ===')
  filteredMenus.forEach((m, i) => console.log(`${i+1}. ${m.menuName} - Area: ${m.area}`))

  const totalPages = Math.ceil(filteredMenus.length / pageSize)
  const paginatedData = filteredMenus.slice(
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

              {/* Left Panel - Menu Master Form */}
              <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
                <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Menu className="text-2xl" />
                    <h2 className="text-xl font-semibold tracking-wide">
                      {editingId ? 'EDIT MENU' : 'MENU MASTER'}
                    </h2>
                  </div>
                </header>
                <div className="p-6 space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Layers className="text-[#0e4a78]" />
                      Menu Name
                    </label>
                    <input
                      type="text"
                      placeholder="Menu Name"
                      value={menuName}
                      onChange={(e) => setMenuName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-slate-700 placeholder:text-slate-400 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Parent Menu</label>
                    <select
                      value={parentMenuId}
                      onChange={(e) => setParentMenuId(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-slate-700 bg-white transition-all"
                    >
                      <option value="">-- No Parent (Top Level) --</option>
                      {parentMenuOptions.map((parent) => (
                        <option key={parent.id} value={String(parent.id)}>{parent.menuName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Plant Name</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsPlantDropdownOpen(!isPlantDropdownOpen)}
                        className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-slate-700 bg-white transition-all text-left flex items-center justify-between"
                      >
                        <span className={!plantName ? "text-slate-400" : ""}>
                          {!plantName ? "--Select--" : plantName}
                        </span>
                        <svg
                          className={`w-5 h-5 transition-transform ${isPlantDropdownOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {isPlantDropdownOpen && (
                        <div className="absolute z-20 w-full mt-1 bg-white border-2 border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto custom-scrollbar">
                          {plants.map((plant, idx) => (
                            <div
                              key={idx}
                              className={`px-4 py-2 hover:bg-blue-50 transition-colors cursor-pointer ${plantName === plant ? 'bg-blue-100 font-semibold' : ''}`}
                              onClick={() => handlePlantChange(plant)}
                            >
                              <span className="text-sm text-slate-700">{plant}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Menu URL</label>
                    <input
                      type="text"
                      placeholder="Menu Url"
                      value={menuUrl}
                      onChange={(e) => setMenuUrl(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-slate-700 placeholder:text-slate-400 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700">Area</label>
                      <input
                        type="text"
                        placeholder="Area"
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-slate-700 placeholder:text-slate-400 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700">Controller</label>
                      <input
                        type="text"
                        placeholder="Controller"
                        value={controller}
                        onChange={(e) => setController(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-slate-700 placeholder:text-slate-400 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Action Result</label>
                    <input
                      type="text"
                      placeholder="Action Result"
                      value={actionResult}
                      onChange={(e) => setActionResult(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-slate-700 placeholder:text-slate-400 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Menu Icon</label>
                    <input
                      type="text"
                      placeholder="Menu Icon"
                      value={menuIcon}
                      onChange={(e) => setMenuIcon(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50 focus:border-[#0e4a78] text-slate-700 placeholder:text-slate-400 transition-all"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleCancel}
                      className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white font-semibold hover:from-[#0b3e66] hover:to-[#072c4a] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </section>

              {/* Right Panel - View Menu Table */}
              <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex flex-col">
                <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Layers className="text-2xl" />
                      <h2 className="text-xl font-semibold tracking-wide">VIEW MENU</h2>
                    </div>
                    <button
                      onClick={() => refetchMenus()}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
                      title="Refresh menu list"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </header>

                {/* Search Bar */}
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by menu name, parent or URL..."
                      className="w-full pl-10 pr-10 py-2.5 border-2 text-black border-slate-300 rounded-lg focus:outline-none focus:border-[#0e4a78] focus:ring-2 focus:ring-[#0e4a78]/20 text-sm transition-all"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                      >
                        <X />
                      </button>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto flex-1">
                  <table className="min-w-full text-xs md:text-sm text-left">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                        <th className="px-4 sm:px-5 py-3 text-left font-semibold border-r border-white/30">Menu Name</th>
                        <th className="px-4 sm:px-5 py-3 text-left font-semibold border-r border-white/30">Parent Menu</th>
                        <th className="px-4 sm:px-5 py-3 text-left font-semibold border-r border-white/30">Menu Url</th>
                        <th className="px-4 sm:px-5 py-3 text-left font-semibold border-r border-white/30">Menu Icon</th>
                        <th className="px-4 sm:px-5 py-3 text-center font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {paginatedData.length > 0 ? (
                        paginatedData.map((menu) => (
                          <tr key={menu.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200">
                            <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 font-medium">
                              {menu.menuName}
                            </td>
                            <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                              {menu.parentMenuId ? (menuNameById.get(menu.parentMenuId) || '-') : '-'}
                            </td>
                            <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 text-xs">
                              {menu.menuUrl}
                            </td>
                            <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 text-xs">
                              {menu.menuIcon}
                            </td>
                            <td className="px-4 sm:px-5 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEdit(menu)}
                                  className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                                  title="Edit"
                                >
                                  <Edit2 className="text-sm" />
                                </button>
                                <button
                                  onClick={() => handleDelete(menu.id)}
                                  className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                                  title="Delete"
                                >
                                  <Trash2 className="text-sm" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-3 text-slate-400">
                              <Search className="text-4xl" />
                              <p className="text-sm font-medium">No menus found</p>
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
                    Showing <span className="text-[#0e4a78] font-bold">{Math.min((currentPage - 1) * pageSize + 1, filteredMenus.length)}</span> to <span className="text-[#0e4a78] font-bold">{Math.min(currentPage * pageSize, filteredMenus.length)}</span> of <span className="text-[#0e4a78] font-bold">{filteredMenus.length}</span> entries
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 rounded-lg border-2 border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-[#0e4a78] font-semibold text-xs transition-all hover:border-[#0e4a78] shadow-sm"
                    >
                      Previous
                    </button>
                    <div className="px-4 py-2 rounded-lg border-2 bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white border-[#0e4a78] text-xs font-bold shadow-md">
                      Page {currentPage} of {totalPages || 1}
                    </div>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="px-4 py-2 rounded-lg border-2 border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-[#0e4a78] font-semibold text-xs transition-all hover:border-[#0e4a78] shadow-sm"
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
      <style jsx>{`
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

export default MenuPage