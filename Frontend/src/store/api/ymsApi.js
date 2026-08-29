import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { API_ENDPOINTS } from '../../config/api'

function normalizeRolesResponse(data) {
  const rawList = data?.data && Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : [])

  const filtered = rawList.filter((role) => {
    const isDeleted =
      role?.IS_DELETED === true || role?.IS_DELETED === 1 ||
      role?.is_deleted === true || role?.is_deleted === 1 ||
      role?.IS_DELETE === true || role?.IS_DELETE === 1 ||
      role?.is_delete === true || role?.is_delete === 1

    return !isDeleted
  })

  const roles = filtered.map((role, index) => ({
    id: role?.ROLE_ID || role?.role_id || role?.id || role?.ID || index,
    roleName: role?.ROLE || role?.Role || role?.role || role?.ROLE_NAME || role?.RoleName || role?.role_name || '',
    plantId: role?.PLANT_ID ?? role?.plant_id ?? null,
    plantName: role?.PLANT_NAME || role?.plant_name ? [role?.PLANT_NAME || role?.plant_name] : [],
  }))

  return { rawRoles: rawList, roles }
}

// Note: customer and plant endpoints moved to separate API slices: clientApi and plantApi

function normalizeUsersResponse(data) {
  const rawList = data?.data && Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : [])

  const users = rawList.map((user, index) => ({
    id:        user?.UserID    || user?.USER_ID    || user?.user_id    || user?.id || index + 1,
    roleId:    user?.RoleID    ?? user?.ROLE_ID    ?? user?.role_id    ?? null,
    roleName:  user?.RoleName  || user?.ROLE_NAME  || user?.role_name  || '',
    plantId:   user?.PlantID   ?? user?.PLANT_ID   ?? user?.plant_id   ?? null,
    clientId:  user?.ClientID  ?? user?.CLIENT_ID  ?? user?.client_id  ?? null,
    firstName: user?.FName     || user?.FIRST_NAME || user?.first_name || '',
    lastName:  user?.LName     || user?.LAST_NAME  || user?.last_name  || '',
    username:  user?.UserName  || user?.USERNAME   || user?.username   || '',
    emailId:   user?.EmailId   || user?.EMAIL_ID   || user?.email_id   || user?.email || '',
    active:    user?.IsActive  ?? user?.is_active  ?? true,
  }))

  return { rawUsers: rawList, users }
}

function normalizeEquipmentResponse(data) {
  // Expected shape: { status, data: [...] }
  if (Array.isArray(data)) {
    return { status: 'success', data }
  }

  if (data?.data && Array.isArray(data.data)) {
    return data
  }

  // Fallback for unexpected shapes
  return { ...(data || {}), data: [] }
}

// (Customers/Plants handled in clientApi.js and plantApi.js)

const baseQuery = fetchBaseQuery({
  baseUrl: '',  // Use relative URLs, Vite proxy handles routing
  prepareHeaders: (headers) => {
    const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken')
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }
    headers.set('content-type', 'application/json')
    return headers
  },
})

const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions)
  const status = result.error?.status
  const isUnauthed = status === 401 || (status === 403 && result.error?.data?.message === 'Not authenticated')
  if (isUnauthed && !window.location.pathname.startsWith('/kiosk')) {
    sessionStorage.removeItem('authToken')
    sessionStorage.removeItem('user')
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
    window.location.href = '/sign-in'
  }
  return result
}

export const ymsApi = createApi({
  reducerPath: 'ymsApi',
  baseQuery: baseQueryWithReauth,
    tagTypes: ['Roles', 'Users', 'Menus', 'RoleMenus', 'Process', 'Equipment', 'EquipmentTransactions', 'DeviceData', 'ContainerInventory', 'Breakdowns', 'RailPlan'],
    endpoints: (builder) => ({

    // ─── Auth ────────────────────────────────────────────────────────────────

    getRoles: builder.query({
      query: () => ({ url: API_ENDPOINTS.AUTH.GET_ROLES, method: 'GET' }),
      transformResponse: (response) => normalizeRolesResponse(response),
      providesTags: ['Roles'],
    }),

    getUsers: builder.query({
      query: () => ({ url: API_ENDPOINTS.AUTH.GET_USERS, method: 'GET' }),
      transformResponse: (response) => normalizeUsersResponse(response),
      providesTags: (result) => {
        const base = [{ type: 'Users', id: 'LIST' }]
        const items = (result?.users || []).map((u) => ({ type: 'Users', id: u.id }))
        return base.concat(items)
      },
    }),

    createRole: builder.mutation({
      query: ({ role, plant_id, created_by = '1' }) => ({
        url: API_ENDPOINTS.AUTH.CREATE_ROLE,
        method: 'POST',
        body: { role, plant_id, created_by },
      }),
      invalidatesTags: ['Roles'],
    }),

    createUser: builder.mutation({
      query: ({ role_id, first_name, last_name, username, password, email_id, created_by = 1 }) => ({
        url: API_ENDPOINTS.AUTH.CREATE_USER,
        method: 'POST',
        body: { role_id, first_name, last_name, username, password, email_id, created_by },
      }),
      invalidatesTags: [{ type: 'Users', id: 'LIST' }],
    }),

    updateUser: builder.mutation({
      query: ({ user_id, role_id, plant_id = 1, client_id = 1, first_name, last_name, username, password, email_id, created_by }) => ({
        url: API_ENDPOINTS.AUTH.UPDATE_USER,
        method: 'POST',
        body: { user_id, role_id, plant_id, client_id, first_name, last_name, username, password, email_id, created_by },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Users', id: 'LIST' }, { type: 'Users', id: arg?.user_id }],
    }),

    updateRole: builder.mutation({
      query: ({ role_id, role, plant_id, modified_by = 1, is_active = 1, is_delete = 0 }) => ({
        url: API_ENDPOINTS.AUTH.UPDATE_ROLE,
        method: 'POST',
        body: { role_id, role, plant_id, modified_by, is_active, is_delete },
      }),
      invalidatesTags: ['Roles'],
    }),

    deleteRole: builder.mutation({
      query: ({ role_id, deleted_by = 1 }) => ({
        url: API_ENDPOINTS.AUTH.DELETE_ROLE,
        method: 'POST',
        body: { role_id, deleted_by },
      }),
      invalidatesTags: ['Roles'],
    }),

    deleteUser: builder.mutation({
      query: ({ user_id, deleted_by = 1 }) => ({
        url: API_ENDPOINTS.AUTH.DELETE_USER,
        method: 'POST',
        body: { user_id, deleted_by },
      }),
      invalidatesTags: [{ type: 'Users', id: 'LIST' }],
    }),

    getMenus: builder.query({
      query: () => ({ url: API_ENDPOINTS.AUTH.GET_MENUS, method: 'GET' }),
      providesTags: ['Menus'],
    }),

    createMenu: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.MENU.CREATE_MENU,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Menus'],
    }),

    updateMenu: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.MENU.UPDATE_MENU,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Menus'],
    }),

    deleteMenu: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.AUTH.DELETE_MENU,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Menus'],
    }),

    getRoleMenus: builder.query({
      query: (role_id) => ({
        url: `${API_ENDPOINTS.AUTH.GET_ROLE_MENUS}?role_id=${role_id}`,
        method: 'GET',
      }),
      providesTags: (result, error, arg) => [{ type: 'RoleMenus', id: arg }],
    }),

    setRoleMenus: builder.mutation({
      query: ({ role_id, menu_ids, created_by = '00000000-0000-0000-0000-000000000000' }) => ({
        url: API_ENDPOINTS.MENU.SET_ROLE_MENUS,
        method: 'POST',
        body: { role_id, menu_ids, created_by },
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'RoleMenus', id: arg?.role_id },
        'Menus',
      ],
    }),

    // Customer and Plant endpoints moved to separate API slices: clientApi and plantApi

    // ─── Master: Process ─────────────────────────────────────────────────────

    getProcess: builder.query({
      query: () => ({ url: API_ENDPOINTS.MASTER.GET_PROCESS, method: 'GET' }),
      providesTags: ['Process'],
    }),

    addProcess: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.MASTER.ADD_PROCESS,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Process'],
    }),

    updateProcess: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.MASTER.UPDATE_PROCESS,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Process'],
    }),

    deleteProcess: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.MASTER.DELETE_PROCESS,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Process'],
    }),

    // ─── Master: Equipment ───────────────────────────────────────────────────

    getEquipment: builder.query({
      query: (eqp_id) => ({
        url: eqp_id
          ? `${API_ENDPOINTS.MASTER.GET_EQUIPMENT}?equipment_id=${eqp_id}`
          : API_ENDPOINTS.MASTER.GET_EQUIPMENT,
        method: 'GET',
      }),
      transformResponse: (response) => normalizeEquipmentResponse(response),
      providesTags: ['Equipment'],
    }),

    getCurrentEquipmentStatus: builder.query({
      query: () => ({ url: API_ENDPOINTS.MASTER.GET_CURRENT_EQUIPMENT_STATUS, method: 'GET' }),
      providesTags: ['Equipment'],
    }),

    addEquipment: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.MASTER.ADD_EQUIPMENT,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Equipment'],
    }),

    updateEquipment: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.MASTER.UPDATE_EQUIPMENT,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Equipment'],
    }),

    deleteEquipment: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.MASTER.DELETE_EQUIPMENT,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Equipment'],
    }),

    // ─── Master: Equipment Transactions ──────────────────────────────────────

    getEquipmentTransactions: builder.query({
      query: ({ device_id, from_date, to_date, top = 50, container_trans_type, packet_type } = {}) => {
        const params = new URLSearchParams()
        if (device_id) params.set('device_id', device_id)
        if (from_date) params.set('from_date', from_date)
        if (to_date) params.set('to_date', to_date)
        if (top != null) params.set('top', String(top))
        if (container_trans_type) params.set('container_trans_type', container_trans_type)
        if (packet_type) params.set('packet_type', packet_type)

        const qs = params.toString()
        return {
          url: qs
            ? `${API_ENDPOINTS.MASTER.GET_EQUIPMENT_TRANSACTIONS}?${qs}`
            : API_ENDPOINTS.MASTER.GET_EQUIPMENT_TRANSACTIONS,
          method: 'GET',
        }
      },
      providesTags: (result, error, arg) => [{ type: 'EquipmentTransactions', id: arg?.device_id || 'LIST' }],
    }),

    getEquipmentTransaction: builder.query({
      query: (transaction_id) => ({
        url: `${API_ENDPOINTS.MASTER.GET_EQUIPMENT_TRANSACTION}?transaction_id=${transaction_id}`,
        method: 'GET',
      }),
      providesTags: (result, error, arg) => [{ type: 'EquipmentTransactions', id: arg }],
    }),

    addEquipmentTransaction: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.MASTER.ADD_EQUIPMENT_TRANSACTION,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['EquipmentTransactions'],
    }),

    updateEquipmentTransaction: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.MASTER.UPDATE_EQUIPMENT_TRANSACTION,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, arg) => ['EquipmentTransactions', { type: 'EquipmentTransactions', id: arg?.transaction_id }],
    }),

    deleteEquipmentTransaction: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.MASTER.DELETE_EQUIPMENT_TRANSACTION,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['EquipmentTransactions'],
    }),

    getEquipmentTransactionLatest: builder.query({
      query: () => ({ url: API_ENDPOINTS.MASTER.GET_EQUIPMENT_TRANSACTION_LATEST, method: 'GET' }),
      providesTags: ['EquipmentTransactions'],
    }),

    getEquipmentTransactionLiveLocations: builder.query({
      query: () => ({ url: API_ENDPOINTS.MASTER.GET_EQUIPMENT_TRANSACTION_LIVE_LOCATIONS, method: 'GET' }),
      providesTags: ['EquipmentTransactions'],
    }),

    getEquipmentDailyUtilization: builder.query({
      query: ({ eqp_no, from_date, to_date } = {}) => {
        const params = new URLSearchParams();
        if (eqp_no)    params.set('eqp_no', eqp_no);
        if (from_date) params.set('from_date', from_date);
        if (to_date)   params.set('to_date', to_date);
        return { url: `${API_ENDPOINTS.MASTER.GET_EQUIPMENT_DAILY_UTILIZATION}?${params}`, method: 'GET' };
      },
      providesTags: ['EquipmentTransactions'],
    }),

    getEquipmentDailyUtilizationCount: builder.query({
      query: ({ from_date, to_date } = {}) => {
        const params = new URLSearchParams();
        if (from_date) params.set('from_date', from_date);
        if (to_date)   params.set('to_date', to_date);
        return { url: `${API_ENDPOINTS.MASTER.GET_EQUIPMENT_DAILY_UTILIZATION_COUNT}?${params}`, method: 'GET' };
      },
    }),

    // ─── Device Data (EKDEVICE) ─────────────────────────────────────────────

    getDeviceData: builder.query({
      query: ({ device_id, container_no, from_date, to_date, top = 50, packet_id } = {}) => {
        const params = new URLSearchParams()
        if (device_id) params.set('device_id', device_id)
        if (container_no) params.set('container_no', container_no)
        if (from_date) params.set('from_date', from_date)
        if (to_date) params.set('to_date', to_date)
        if (top != null) params.set('top', String(top))
        if (packet_id != null) params.set('packet_id', String(packet_id))

        const qs = params.toString()
        return {
          url: qs
            ? `${API_ENDPOINTS.MASTER.GET_DEVICE_DATA}?${qs}`
            : API_ENDPOINTS.MASTER.GET_DEVICE_DATA,
          method: 'GET',
        }
      },
      providesTags: (result, error, arg) => [{ type: 'DeviceData', id: arg?.device_id || 'LIST' }],
    }),

    getDeviceDetails: builder.query({
      query: (kalmar_no) => ({
        url: `${API_ENDPOINTS.MASTER.GET_DEVICE_DETAILS}?kalmar_no=${encodeURIComponent(kalmar_no)}`,
        method: 'GET',
      }),
      providesTags: (result, error, kalmar_no) => [{ type: 'DeviceData', id: kalmar_no }],
    }),

    getDeviceDataLatest: builder.query({
      query: () => ({ url: API_ENDPOINTS.MASTER.GET_DEVICE_DATA_LATEST, method: 'GET' }),
      providesTags: ['DeviceData'],
    }),

    getDeviceDataLiveLocations: builder.query({
      query: () => ({ url: API_ENDPOINTS.MASTER.GET_DEVICE_DATA_LIVE_LOCATIONS, method: 'GET' }),
      providesTags: ['DeviceData'],
    }),

    // ─── Container Inventory ─────────────────────────────────────────────────

    searchContainer: builder.query({
      query: (term) => ({
        url: `${API_ENDPOINTS.CONTAINER.SEARCH_CONTAINER}?term=${term}`,
        method: 'GET',
      }),
    }),

    getContainerInventory: builder.query({
      query: ({ page_index = 1, page_size = 25, search_for = '', process_type = '' } = {}) => {
        const params = new URLSearchParams({
          page_index: String(page_index),
          page_size: String(page_size),
        })
        if (search_for?.trim()) params.append('search_for', search_for.trim().toUpperCase())
        if (process_type && process_type !== 'all') params.append('process_type', process_type)
        return {
          url: `${API_ENDPOINTS.CONTAINER.GET_INVENTORY}?${params.toString()}`,
          method: 'GET',
        }
      },
      providesTags: ['ContainerInventory'],
    }),

    getContainerInfo: builder.query({
      query: (container_no) => ({
        url: `${API_ENDPOINTS.CONTAINER.GET_CONTAINER_INFO}?container_no=${encodeURIComponent(container_no)}`,
        method: 'GET',
      }),
      providesTags: ['ContainerInventory'],
    }),

    getContainerList: builder.query({
      query: () => ({
        url: API_ENDPOINTS.CONTAINER.GET_CONTAINER_LIST,
        method: 'GET',
      }),
      providesTags: ['ContainerInventory'],
    }),

    getContainerTrackingData: builder.query({
      query: (container_no) => ({
        url: `${API_ENDPOINTS.CONTAINER.GET_CONTAINER_TRACKING_DATA}?container_no=${encodeURIComponent(container_no)}`,
        method: 'GET',
      }),
      providesTags: ['ContainerInventory'],
    }),

    containerTrackingUpload: builder.mutation({
      query: (container_nos) => ({
        url: API_ENDPOINTS.CONTAINER.CONTAINER_TRACKING_UPLOAD,
        method: 'POST',
        body: { container_nos },
      }),
    }),

    getRailPlanList: builder.query({
      query: () => ({
        url: API_ENDPOINTS.CONTAINER.GET_RAIL_PLAN_LIST,
        method: 'GET',
      }),
      providesTags: ['RailPlan'],
    }),

    getRailPlanDetail: builder.query({
      query: ({ rail_plan_name, is_job_allotted }) => ({
        url: `${API_ENDPOINTS.CONTAINER.GET_RAIL_PLAN_DETAIL}?rail_plan_name=${encodeURIComponent(rail_plan_name)}&is_job_allotted=${is_job_allotted}`,
        method: 'GET',
      }),
      providesTags: ['RailPlan'],
    }),

    railPlanTask: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.CONTAINER.RAIL_PLAN_TASK,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['RailPlan'],
    }),

    railPlanAddTask: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.CONTAINER.RAIL_PLAN_ADD_TASK,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['RailPlan'],
    }),

    railPlanDeleteTask: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.CONTAINER.RAIL_PLAN_DELETE_TASK,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['RailPlan'],
    }),

    railPlanUpload: builder.mutation({
      query: (rows) => ({
        url: API_ENDPOINTS.CONTAINER.RAIL_PLAN_UPLOAD,
        method: 'POST',
        body: { rows },
      }),
      invalidatesTags: ['RailPlan'],
    }),

    getRailMovementTat: builder.query({
      query: ({ from_date, to_date } = {}) => {
        const params = new URLSearchParams()
        if (from_date) params.set('from_date', from_date)
        if (to_date) params.set('to_date', to_date)
        const qs = params.toString()
        return {
          url: qs ? `${API_ENDPOINTS.CONTAINER.GET_RAIL_MOVEMENT_TAT}?${qs}` : API_ENDPOINTS.CONTAINER.GET_RAIL_MOVEMENT_TAT,
          method: 'GET',
        }
      },
    }),

    getEquipmentUtilizationReport: builder.query({
      query: ({ from_date, to_date, equipment_names } = {}) => {
        const params = new URLSearchParams()
        if (from_date) params.set('from_date', from_date)
        if (to_date) params.set('to_date', to_date)
        if (equipment_names) params.set('equipment_names', equipment_names)
        const qs = params.toString()
        return {
          url: qs ? `${API_ENDPOINTS.REPORTS.EQUIPMENT_UTILIZATION}?${qs}` : API_ENDPOINTS.REPORTS.EQUIPMENT_UTILIZATION,
          method: 'GET',
        }
      },
    }),

    getCountWithMoves: builder.query({
      query: () => ({
        url: API_ENDPOINTS.REPORTS.COUNT_WITH_MOVES,
        method: 'GET',
      }),
    }),

    getOffloadReport: builder.query({
      query: ({ container_no, from_date, to_date } = {}) => {
        const params = new URLSearchParams()
        if (container_no) params.set('container_no', container_no)
        if (from_date) params.set('from_date', from_date)
        if (to_date) params.set('to_date', to_date)
        const qs = params.toString()
        return {
          url: qs ? `${API_ENDPOINTS.REPORTS.OFFLOAD_REPORT}?${qs}` : API_ENDPOINTS.REPORTS.OFFLOAD_REPORT,
          method: 'GET',
        }
      },
    }),

    getDeviceTransactionSummary: builder.query({
      query: ({ container_no, from_date, to_date, equipment_names } = {}) => {
        const params = new URLSearchParams()
        if (container_no) params.set('container_no', container_no)
        if (from_date) params.set('from_date', from_date)
        if (to_date) params.set('to_date', to_date)
        if (equipment_names) params.set('equipment_names', equipment_names)
        const qs = params.toString()
        return {
          url: qs ? `${API_ENDPOINTS.REPORTS.DEVICE_TRANSACTION_SUMMARY}?${qs}` : API_ENDPOINTS.REPORTS.DEVICE_TRANSACTION_SUMMARY,
          method: 'GET',
        }
      },
    }),

    getTaskAllocationSummary: builder.query({
      query: () => ({
        url: API_ENDPOINTS.REPORTS.TASK_ALLOCATION_SUMMARY,
        method: 'GET',
      }),
    }),

    getLifecycleDetails: builder.query({
      query: (container_no) => ({
        url: `${API_ENDPOINTS.CONTAINER.GET_LIFECYCLE_DETAILS}?container_no=${encodeURIComponent(container_no)}`,
        method: 'GET',
      }),
      providesTags: ['ContainerInventory'],
    }),

    getLifecycleOffloadTimeline: builder.query({
      query: (master_id) => ({
        url: `${API_ENDPOINTS.CONTAINER.GET_LIFECYCLE_OFFLOAD_TIMELINE}?master_id=${master_id}`,
        method: 'GET',
      }),
      providesTags: ['ContainerInventory'],
    }),

    getLifecycleGateInOut: builder.query({
      query: ({ master_id, container_no }) => ({
        url: `${API_ENDPOINTS.CONTAINER.GET_LIFECYCLE_GATEINOUT}?master_id=${master_id}&container_no=${encodeURIComponent(container_no)}`,
        method: 'GET',
      }),
      providesTags: ['ContainerInventory'],
    }),

    getYard3dInventory: builder.query({
      query: () => ({
        url: API_ENDPOINTS.CONTAINER.GET_YARD_3D_INVENTORY,
        method: 'GET',
      }),
      providesTags: ['ContainerInventory'],
    }),

    // Slot ID → SlotName mapping (SP GET_3D_LOCATION_SLOT_LIST or ESS_MST_SLOT fallback)
    // Used by 3D yard to resolve containers to their geofence slot positions.
    getYard3dSlotList: builder.query({
      query: () => ({
        url: API_ENDPOINTS.CONTAINER.GET_YARD_3D_SLOT_LIST,
        method: 'GET',
      }),
    }),

    // Yard slot list (SP GET_LOCATION_SLOT_LIST) — used by the live-status
    // map to overlay every configured slot and pinpoint container positions.
    getLocationSlots: builder.query({
      query: () => ({
        url: API_ENDPOINTS.CONTAINER.GET_LOCATION_SLOTS,
        method: 'GET',
      }),
    }),

    // Live status feed (SP GET_CONTAINERLIVESTATUS) — used by the
    // Container Live Status page AND the 3D yard visualization.
    getContainerLiveStatus: builder.query({
      query: (search_for = '') => {
        const params = new URLSearchParams()
        if (search_for) params.set('search_for', search_for)
        const qs = params.toString()
        return {
          url: qs
            ? `${API_ENDPOINTS.CONTAINER.GET_CONTAINER_LIVE_STATUS}?${qs}`
            : API_ENDPOINTS.CONTAINER.GET_CONTAINER_LIVE_STATUS,
          method: 'GET',
        }
      },
      providesTags: ['ContainerInventory'],
    }),

    getTrailerGateInList: builder.query({
      query: () => ({
        url: API_ENDPOINTS.CONTAINER.GET_TRAILER_GATE_IN_LIST,
        method: 'GET',
      }),
      providesTags: ['ContainerInventory'],
    }),

    getTrailerGateOutList: builder.query({
      query: (gate_type = 0) => ({
        url: `${API_ENDPOINTS.CONTAINER.GET_TRAILER_GATE_OUT_LIST}?gate_type=${gate_type}`,
        method: 'GET',
      }),
      providesTags: ['ContainerInventory'],
    }),

    gateOutTrailer: builder.mutation({
      query: (trailer_no) => ({
        url: API_ENDPOINTS.CONTAINER.TRAILER_GATE_OUT,
        method: 'POST',
        body: { trailer_no },
      }),
      invalidatesTags: ['ContainerInventory'],
    }),

    kioskSearch: builder.query({
      query: ({ term, top = 20 } = {}) => ({
        url: `${API_ENDPOINTS.CONTAINER.KIOSK_SEARCH}?term=${encodeURIComponent(term)}&top=${top}`,
        method: 'GET',
      }),
    }),

    // ─── Pre-Gate Survey (E-Survey) ──────────────────────────────────────────

    getGateNames: builder.query({
      query: () => ({ url: API_ENDPOINTS.CONTAINER.GET_GATE_NAMES, method: 'GET' }),
    }),

    getPreGateSurvey: builder.query({
      query: ({ gate_type, gate_name, from_date, to_date, container_no, plant_id, page = 1, page_size = 20 } = {}) => {
        const params = new URLSearchParams()
        if (gate_type)    params.set('gate_type',    gate_type)
        if (gate_name)    params.set('gate_name',    gate_name)
        if (from_date)    params.set('from_date',    from_date)
        if (to_date)      params.set('to_date',      to_date)
        if (container_no) params.set('container_no', container_no)
        if (plant_id !== undefined && plant_id !== null) params.set('plant_id', String(plant_id))
        params.set('page',      String(page))
        params.set('page_size', String(page_size))
        return {
          url: `${API_ENDPOINTS.CONTAINER.GET_PRE_GATE_SURVEY}?${params.toString()}`,
          method: 'GET',
        }
      },
    }),

    // ─── Container Status Report — monthly aggregated (dashboard chart) ─────
    getContainerStatusReport: builder.query({
      query: ({ from_date, to_date } = {}) => {
        const params = new URLSearchParams()
        if (from_date) params.set('from_date', from_date)
        if (to_date)   params.set('to_date',   to_date)
        return {
          url: `${API_ENDPOINTS.CONTAINER.GET_CONTAINER_STATUS_REPORT}?${params.toString()}`,
          method: 'GET',
        }
      },
    }),

    // ─── Container Gate Report — raw rows (Container Status Report page) ────
    getContainerGateReport: builder.query({
      query: ({ from_date, to_date } = {}) => {
        const params = new URLSearchParams()
        if (from_date) params.set('from_date', from_date)
        if (to_date)   params.set('to_date',   to_date)
        return {
          url: `${API_ENDPOINTS.CONTAINER.GET_CONTAINER_GATE_REPORT}?${params.toString()}`,
          method: 'GET',
        }
      },
    }),

    // ─── Container History Report ───────────────────────────────────────────
    getContainerHistoryReport: builder.query({
      query: ({ from_date, to_date, container_no, plant_id } = {}) => {
        const params = new URLSearchParams()
        if (from_date)    params.set('from_date',    from_date)
        if (to_date)      params.set('to_date',      to_date)
        if (container_no) params.set('container_no', container_no)
        if (plant_id !== undefined && plant_id !== null) params.set('plant_id', String(plant_id))
        return {
          url: `${API_ENDPOINTS.CONTAINER.GET_CONTAINER_HISTORY_REPORT}?${params.toString()}`,
          method: 'GET',
        }
      },
    }),

    // ─── Reports ───────────────────────────────────────────────────────────

    getServiceDashboard: builder.query({
      query: ({ from_date, to_date, equipment_names } = {}) => {
        const params = new URLSearchParams()
        if (from_date) params.set('from_date', from_date)
        if (to_date) params.set('to_date', to_date)
        if (equipment_names) params.set('equipment_names', equipment_names)
        const qs = params.toString()
        return {
          url: qs ? `${API_ENDPOINTS.REPORTS.SERVICE_DASHBOARD}?${qs}` : API_ENDPOINTS.REPORTS.SERVICE_DASHBOARD,
          method: 'GET',
        }
      },
    }),

    getDeviceLockReport: builder.query({
      query: ({ from_date, to_date, equipment_names, report_type = 'All', location } = {}) => {
        const params = new URLSearchParams()
        if (from_date) params.set('from_date', from_date)
        if (to_date) params.set('to_date', to_date)
        if (equipment_names) params.set('equipment_names', equipment_names)
        if (report_type) params.set('report_type', report_type)
        if (location) params.set('location', location)

        const qs = params.toString()
        return {
          url: qs
            ? `${API_ENDPOINTS.REPORTS.DEVICE_LOCK_REPORT}?${qs}`
            : API_ENDPOINTS.REPORTS.DEVICE_LOCK_REPORT,
          method: 'GET',
        }
      },
    }),

    getDeviceRawData: builder.query({
      query: ({ machine, from_date, to_date } = {}) => {
        const params = new URLSearchParams()
        if (machine) params.set('machine', machine)
        if (from_date) params.set('from_date', from_date)
        if (to_date) params.set('to_date', to_date)
        const qs = params.toString()
        return {
          url: qs
            ? `${API_ENDPOINTS.REPORTS.DEVICE_RAW_DATA}?${qs}`
            : API_ENDPOINTS.REPORTS.DEVICE_RAW_DATA,
          method: 'GET',
        }
      },
    }),

    getDeviceRawDataKalmarList: builder.query({
      query: () => ({ url: API_ENDPOINTS.REPORTS.DEVICE_RAW_DATA_KALMAR_LIST, method: 'GET' }),
    }),

    updateDeviceDataContainer: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.REPORTS.UPDATE_DEVICE_DATA_CONTAINER,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['DeviceData', 'EquipmentTransactions'],
    }),

    getTrailerReport: builder.query({
      query: ({ trailer_no, from_date, to_date } = {}) => {
        const params = new URLSearchParams()
        if (trailer_no) params.set('trailer_no', trailer_no)
        if (from_date) params.set('from_date', from_date)
        if (to_date) params.set('to_date', to_date)
        const qs = params.toString()
        return {
          url: qs
            ? `${API_ENDPOINTS.REPORTS.TRAILER_REPORT}?${qs}`
            : API_ENDPOINTS.REPORTS.TRAILER_REPORT,
          method: 'GET',
        }
      },
    }),

    // ─── Breakdowns ──────────────────────────────────────────────────────────

    getBreakdowns: builder.query({
      query: ({ eqp_id, from_date, to_date } = {}) => {
        const params = new URLSearchParams()
        if (eqp_id) params.set('eqp_id', eqp_id)
        if (from_date) params.set('from_date', from_date)
        if (to_date) params.set('to_date', to_date)
        const qs = params.toString()
        return {
          url: qs
            ? `${API_ENDPOINTS.MASTER.GET_BREAKDOWNS}?${qs}`
            : API_ENDPOINTS.MASTER.GET_BREAKDOWNS,
          method: 'GET',
        }
      },
      providesTags: ['Breakdowns'],
    }),

    getBreakdownsFiltered: builder.query({
      query: ({ from_date, to_date }) => ({
        url: `${API_ENDPOINTS.MASTER.GET_BREAKDOWNS_FILTERED}?from_date=${encodeURIComponent(from_date)}&to_date=${encodeURIComponent(to_date)}`,
        method: 'GET',
      }),
      providesTags: ['Breakdowns'],
    }),

    addBreakdown: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.MASTER.ADD_BREAKDOWN,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Breakdowns'],
    }),

    updateBreakdown: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.MASTER.UPDATE_BREAKDOWN,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Breakdowns'],
    }),

    closeBreakdown: builder.mutation({
      query: ({ brkid, end_time }) => ({
        url: `${API_ENDPOINTS.MASTER.CLOSE_BREAKDOWN}?brkid=${brkid}&end_time=${encodeURIComponent(end_time)}`,
        method: 'POST',
      }),
      invalidatesTags: ['Breakdowns'],
    }),

    deleteBreakdown: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.MASTER.DELETE_BREAKDOWN,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Breakdowns'],
    }),
  }),
})


export const {
  useGetRolesQuery,
  useGetUsersQuery,
  useCreateRoleMutation,
  useCreateUserMutation,
  useUpdateUserMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useDeleteUserMutation,
  useGetMenusQuery,
  useCreateMenuMutation,
  useUpdateMenuMutation,
  useDeleteMenuMutation,
  useGetRoleMenusQuery,
  useSetRoleMenusMutation,
  useGetProcessQuery,
  useAddProcessMutation,
  useUpdateProcessMutation,
  useDeleteProcessMutation,
  useGetEquipmentQuery,
  useGetCurrentEquipmentStatusQuery,
  useAddEquipmentMutation,
  useUpdateEquipmentMutation,
  useDeleteEquipmentMutation,
  useGetEquipmentTransactionsQuery,
  useLazyGetEquipmentTransactionsQuery,
  useGetEquipmentTransactionQuery,
  useAddEquipmentTransactionMutation,
  useUpdateEquipmentTransactionMutation,
  useDeleteEquipmentTransactionMutation,
  useGetEquipmentTransactionLatestQuery,
  useGetEquipmentTransactionLiveLocationsQuery,
  useGetEquipmentDailyUtilizationQuery,
  useLazyGetEquipmentDailyUtilizationQuery,
  useGetEquipmentDailyUtilizationCountQuery,
  useLazyGetEquipmentDailyUtilizationCountQuery,
  useGetDeviceDataQuery,
  useLazyGetDeviceDataQuery,
  useLazyGetDeviceDetailsQuery,
  useGetDeviceDataLatestQuery,
  useGetDeviceDataLiveLocationsQuery,
  useLazySearchContainerQuery,
  useGetContainerInventoryQuery,
  useLazyGetContainerInventoryQuery,
  useGetContainerInfoQuery,
  useLazyGetContainerInfoQuery,
  useGetContainerListQuery,
  useLazyGetContainerListQuery,
  useGetContainerTrackingDataQuery,
  useLazyGetContainerTrackingDataQuery,
  useContainerTrackingUploadMutation,
  useGetRailPlanListQuery,
  useGetRailPlanDetailQuery,
  useLazyGetRailPlanDetailQuery,
  useRailPlanTaskMutation,
  useRailPlanAddTaskMutation,
  useRailPlanDeleteTaskMutation,
  useRailPlanUploadMutation,
  useGetRailMovementTatQuery,
  useLazyGetRailMovementTatQuery,
  useLazyGetEquipmentUtilizationReportQuery,
  useGetCountWithMovesQuery,
  useLazyGetOffloadReportQuery,
  useLazyGetDeviceTransactionSummaryQuery,
  useGetTaskAllocationSummaryQuery,
  useGetLifecycleDetailsQuery,
  useLazyGetLifecycleDetailsQuery,
  useGetLifecycleOffloadTimelineQuery,
  useLazyGetLifecycleOffloadTimelineQuery,
  useGetLifecycleGateInOutQuery,
  useLazyGetLifecycleGateInOutQuery,
  useGetYard3dInventoryQuery,
  useLazyGetYard3dInventoryQuery,
  useGetYard3dSlotListQuery,
  useGetContainerLiveStatusQuery,
  useLazyGetContainerLiveStatusQuery,
  useGetTrailerGateInListQuery,
  useGetTrailerGateOutListQuery,
  useGateOutTrailerMutation,
  useLazyKioskSearchQuery,
  useGetLocationSlotsQuery,
  useLazyGetLocationSlotsQuery,
  useGetServiceDashboardQuery,
  useLazyGetServiceDashboardQuery,
  useGetDeviceLockReportQuery,
  useLazyGetDeviceLockReportQuery,
  useGetDeviceRawDataQuery,
  useLazyGetDeviceRawDataQuery,
  useGetDeviceRawDataKalmarListQuery,
  useUpdateDeviceDataContainerMutation,
  useGetTrailerReportQuery,
  useLazyGetTrailerReportQuery,
  useGetBreakdownsQuery,
  useLazyGetBreakdownsFilteredQuery,
  useLazyGetBreakdownsQuery,
  useAddBreakdownMutation,
  useUpdateBreakdownMutation,
  useCloseBreakdownMutation,
  useDeleteBreakdownMutation,
  useGetGateNamesQuery,
  useGetPreGateSurveyQuery,
  useLazyGetPreGateSurveyQuery,
  useGetContainerStatusReportQuery,
  useLazyGetContainerStatusReportQuery,
  useGetContainerGateReportQuery,
  useLazyGetContainerGateReportQuery,
  useGetContainerHistoryReportQuery,
  useLazyGetContainerHistoryReportQuery,
} = ymsApi
