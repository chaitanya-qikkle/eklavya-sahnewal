import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { API_ENDPOINTS } from '../../config/api'

function normalizePlantsResponse(data) {
  const rawList = data?.data && Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : [])

  const plants = rawList
    .filter((plant) => {
      const isDeleted = plant?.IS_DELETED === true || plant?.IS_DELETED === 1 || plant?.is_deleted === true || plant?.is_deleted === 1
      return !isDeleted
    })
    .map((plant, index) => ({
      id: plant?.PLANT_ID || plant?.plant_id || plant?.id || index,
      plantCode: plant?.PLANT_CODE || plant?.plant_code || '',
      plantName: plant?.PLANT_NAME || plant?.plant_name || '',
      location: plant?.LOCATION || plant?.location || '',
      clientId: (typeof plant?.CLIENT_ID !== 'undefined' ? plant?.CLIENT_ID : (typeof plant?.client_id !== 'undefined' ? plant?.client_id : null)),
      active: (typeof plant?.IS_ACTIVE !== 'undefined' ? plant?.IS_ACTIVE : (typeof plant?.is_active !== 'undefined' ? plant?.is_active : true)),
    }))

  return { rawPlants: rawList, plants }
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

export const plantApi = createApi({
  reducerPath: 'plantApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Plants'],
  endpoints: (builder) => ({
    getPlants: builder.query({
      query: (plant_id) => ({
        url: plant_id ? `${API_ENDPOINTS.MASTER.GET_PLANT}?plant_id=${plant_id}` : API_ENDPOINTS.MASTER.GET_PLANT,
        method: 'GET',
      }),
      transformResponse: (response) => normalizePlantsResponse(response),
      providesTags: ['Plants'],
    }),

    addPlant: builder.mutation({
      query: (body) => ({ url: API_ENDPOINTS.MASTER.ADD_PLANT, method: 'POST', body }),
      invalidatesTags: ['Plants'],
    }),

    updatePlant: builder.mutation({
      query: (body) => ({ url: API_ENDPOINTS.MASTER.UPDATE_PLANT, method: 'POST', body }),
      invalidatesTags: ['Plants'],
    }),

    deletePlant: builder.mutation({
      query: (body) => ({ url: API_ENDPOINTS.MASTER.DELETE_PLANT, method: 'POST', body }),
      invalidatesTags: ['Plants'],
    }),
  }),
})

export const {
  useGetPlantsQuery,
  useAddPlantMutation,
  useUpdatePlantMutation,
  useDeletePlantMutation,
} = plantApi
