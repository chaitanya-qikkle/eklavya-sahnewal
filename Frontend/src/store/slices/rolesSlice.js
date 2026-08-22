import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { createRole, deleteRole, getRoles, updateRole } from '../../services/authService'

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
    plantName: [],
  }))

  return { rawRoles: rawList, roles }
}

export const fetchRoles = createAsyncThunk('roles/fetchRoles', async (_, { rejectWithValue }) => {
  try {
    const data = await getRoles()
    return normalizeRolesResponse(data)
  } catch (error) {
    return rejectWithValue(error?.message || 'Failed to fetch roles')
  }
})

export const saveRole = createAsyncThunk(
  'roles/saveRole',
  async ({ id, roleName }, { dispatch, getState, rejectWithValue }) => {
    try {
      const trimmedName = (roleName || '').trim()
      if (!trimmedName) return rejectWithValue('Role name is required')

      // Update existing
      if (id) {
        const result = await updateRole(id, trimmedName, 1)
        if (result?.status !== 'success') {
          return rejectWithValue(result?.message || 'Operation failed')
        }
        await dispatch(fetchRoles())
        return { kind: 'updated' }
      }

      // Restore deleted role if exists in raw roles
      const state = getState()
      const rawRoles = state?.roles?.rawRoles || []

      const existingDeletedRole = rawRoles.find((r) => {
        const rName = r?.ROLE || r?.Role || r?.role || r?.ROLE_NAME || r?.RoleName || r?.role_name || ''
        const isDeleted =
          r?.IS_DELETED == true || r?.IS_DELETED == 1 ||
          r?.is_deleted == true || r?.is_deleted == 1 ||
          r?.IS_DELETE == true || r?.IS_DELETE == 1 ||
          r?.is_delete == true || r?.is_delete == 1

        return isDeleted && rName.trim().toLowerCase() === trimmedName.toLowerCase()
      })

      if (existingDeletedRole) {
        const roleId = existingDeletedRole?.ROLE_ID || existingDeletedRole?.role_id || existingDeletedRole?.id
        const result = await updateRole(roleId, trimmedName, 1)

        if (result?.status === 'success') {
          await dispatch(fetchRoles())
          return { kind: 'restored' }
        }

        // If backend blocks restore, fall through to create
      }

      const result = await createRole(trimmedName, '1')
      if (result?.status !== 'success') {
        return rejectWithValue(result?.message || 'Operation failed')
      }

      await dispatch(fetchRoles())
      return { kind: 'created' }
    } catch (error) {
      return rejectWithValue(error?.message || 'Operation failed')
    }
  }
)

export const removeRole = createAsyncThunk('roles/removeRole', async ({ id }, { dispatch, rejectWithValue }) => {
  try {
    const result = await deleteRole(id, 1)
    if (result?.status !== 'success') {
      return rejectWithValue(result?.message || 'Delete failed')
    }

    await dispatch(fetchRoles())
    return { id }
  } catch (error) {
    return rejectWithValue(error?.message || 'Delete failed')
  }
})

const initialState = {
  roles: [],
  rawRoles: [],
  isLoading: false,
  error: null,
}

const rolesSlice = createSlice({
  name: 'roles',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoles.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.isLoading = false
        state.roles = action.payload.roles
        state.rawRoles = action.payload.rawRoles
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload || action.error.message
      })
      .addCase(saveRole.pending, (state) => {
        state.error = null
      })
      .addCase(saveRole.rejected, (state, action) => {
        state.error = action.payload || action.error.message
      })
      .addCase(removeRole.pending, (state) => {
        state.error = null
      })
      .addCase(removeRole.rejected, (state, action) => {
        state.error = action.payload || action.error.message
      })
  },
})

export default rolesSlice.reducer
