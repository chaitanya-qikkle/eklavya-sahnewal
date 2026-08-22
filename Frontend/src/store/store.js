import { configureStore } from '@reduxjs/toolkit'
import { ymsApi } from './api/ymsApi'
import { clientApi } from './api/clientApi'
import { plantApi } from './api/plantApi'
import { customerApi } from './api/customerApi'
import authReducer from './slices/authSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [ymsApi.reducerPath]: ymsApi.reducer,
    [clientApi.reducerPath]: clientApi.reducer,
    [plantApi.reducerPath]: plantApi.reducer,
    [customerApi.reducerPath]: customerApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      immutableCheck: false,
    }).concat(ymsApi.middleware, clientApi.middleware, plantApi.middleware, customerApi.middleware),
})
