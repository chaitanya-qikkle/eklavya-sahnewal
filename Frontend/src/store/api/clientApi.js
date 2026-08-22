import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { API_ENDPOINTS } from '../../config/api'

function normalizeClientsResponse(data) {
  const rawList = data?.data && Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : [])

  const clients = rawList
    .filter((c) => !(typeof c?.Status !== 'undefined' || typeof c?.STATUS !== 'undefined'))
    .filter((c) => !(c?.IS_DELETED === true || c?.IS_DELETED === 1 || c?.is_deleted === true || c?.is_deleted === 1))
    .map((c, index) => ({
      id: c?.CLIENT_ID || c?.client_id || c?.id || index,
      clientCode: c?.CLIENT_CODE || c?.client_code || '',
      clientName: c?.CLIENT_NAME || c?.client_name || c?.name || '',
      clientType: c?.CLIENT_TYPE || c?.client_type || null,
      logoPath: c?.LOGO_PATH || c?.logo_path || null,
      active: (typeof c?.IS_ACTIVE !== 'undefined' ? c?.IS_ACTIVE : (typeof c?.is_active !== 'undefined' ? c?.is_active : true)),
    }))

  return { rawClients: rawList, clients }
}

const baseQuery = fetchBaseQuery({
  baseUrl: '',
  prepareHeaders: (headers) => {
    const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken')
    if (token) headers.set('authorization', `Bearer ${token}`)
    // Don't set content-type for FormData requests — the browser
    // needs to set it automatically with the correct multipart boundary.
    // For JSON requests (GET, delete) the header is set per-endpoint.
    return headers
  },
})

const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions)
  const status = result.error?.status
  const isUnauthed = status === 401 || (status === 403 && result.error?.data?.message === 'Not authenticated')
  if (isUnauthed) {
    sessionStorage.removeItem('authToken')
    sessionStorage.removeItem('user')
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
    window.location.href = '/sign-in'
  }
  return result
}

export const clientApi = createApi({
  reducerPath: 'clientApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Clients'],
  endpoints: (builder) => ({
    getClient: builder.query({
      query: (client_id) => ({
        url: client_id ? `${API_ENDPOINTS.MASTER.GET_CLIENT}?client_id=${client_id}` : API_ENDPOINTS.MASTER.GET_CLIENT,
        method: 'GET',
      }),
      transformResponse: (response) => normalizeClientsResponse(response),
      providesTags: (result) => {
        const base = [{ type: 'Clients', id: 'LIST' }]
        const items = (result?.clients || []).map((c) => ({ type: 'Clients', id: c.id }))
        return base.concat(items)
      },
    }),

    getClientAll: builder.query({
      query: () => ({ url: API_ENDPOINTS.MASTER.GET_CLIENT_ALL, method: 'GET' }),
      transformResponse: (response) => normalizeClientsResponse(response),
      providesTags: ['Clients'],
    }),

    addClient: builder.mutation({
      query: ({ client_name, logo }) => {
        const formData = new FormData()
        formData.append('client_name', client_name)
        if (logo) formData.append('logo', logo)
        return { url: API_ENDPOINTS.MASTER.ADD_CLIENT, method: 'POST', body: formData }
      },
      invalidatesTags: ['Clients'],
    }),

    updateClient: builder.mutation({
      query: ({ client_id, client_name, logo }) => {
        const formData = new FormData()
        formData.append('client_id', client_id)
        formData.append('client_name', client_name)
        if (logo) formData.append('logo', logo)
        return { url: API_ENDPOINTS.MASTER.UPDATE_CLIENT, method: 'POST', body: formData }
      },
      invalidatesTags: ['Clients'],
    }),

    deleteClient: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.MASTER.DELETE_CLIENT,
        method: 'POST',
        body,
        headers: { 'content-type': 'application/json' },
      }),
      invalidatesTags: ['Clients'],
    }),
  }),
})

export const {
  useGetClientQuery,
  useGetClientAllQuery,
  useAddClientMutation,
  useUpdateClientMutation,
  useDeleteClientMutation,
} = clientApi

