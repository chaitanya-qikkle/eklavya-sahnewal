import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { API_ENDPOINTS } from '../../config/api'

function normalizeCustomersResponse(data) {
  const rawList = data?.data && Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : [])

  const customers = rawList
    .filter((c) => !(typeof c?.Status !== 'undefined' || typeof c?.STATUS !== 'undefined'))
    .map((c, index) => ({
      id: c?.CUSTOMER_ID || c?.customer_id || c?.id || index,
      customerCode: c?.CUSTOMER_CODE || c?.customer_code || '',
      customerName: c?.CUSTOMER_NAME || c?.customer_name || c?.name || '',
      customerType: c?.CUSTOMER_TYPE || c?.customer_type || '',
      active: (typeof c?.STATUS !== 'undefined' ? c?.STATUS : (typeof c?.status !== 'undefined' ? c?.status : true)),
    }))

  return { rawCustomers: rawList, customers }
}

const baseQuery = fetchBaseQuery({
  baseUrl: '',
  prepareHeaders: (headers) => {
    const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken')
    if (token) headers.set('authorization', `Bearer ${token}`)
    headers.set('content-type', 'application/json')
    return headers
  },
})

const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions)
  if (result.error && result.error.status === 401) {
    sessionStorage.removeItem('authToken')
    sessionStorage.removeItem('user')
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
    window.location.href = '/sign-in'
  }
  return result
}

export const customerApi = createApi({
  reducerPath: 'customerApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Customers'],
  endpoints: (builder) => ({
    getCustomers: builder.query({
      query: (customer_id) => ({
        url: customer_id
          ? `${API_ENDPOINTS.MASTER.GET_CUSTOMER}?customer_id=${customer_id}`
          : API_ENDPOINTS.MASTER.GET_CUSTOMER,
        method: 'GET',
      }),
      transformResponse: (response) => normalizeCustomersResponse(response),
      providesTags: ['Customers'],
    }),
  }),
})

export const {
  useGetCustomersQuery,
} = customerApi
