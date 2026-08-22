import { createSlice } from '@reduxjs/toolkit'
import { getStoredUser, getStoredToken } from '../../services/authService'

const initialState = {
  user: getStoredUser(),
  token: getStoredToken(),
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload?.user ?? null
      state.token = action.payload?.token ?? null
    },
    clearAuth: (state) => {
      state.user = null
      state.token = null
    },
  },
})

export const { setCredentials, clearAuth } = authSlice.actions

export const selectAuthUser = (state) => state.auth?.user
export const selectAuthToken = (state) => state.auth?.token
export const selectIsAuthenticated = (state) => !!state.auth?.token

export default authSlice.reducer
