import './App.css'
import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import SignIn from './modules/auth/pages/SignIn'
import ProtectedRoute from './components/auth/ProtectedRoute'
import YardLiveStatus3D from './modules/yard3d/pages/YardLiveStatus3D'
import Kiosk from './modules/kiosk/pages/Kiosk'

const _LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-100">
    <div className="h-12 w-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" aria-label="Loading" />
  </div>
)

// On chunk load failure (old build / missing file), redirect to service dashboard
const _RedirectToHome = () => <Navigate to="/dashboard/service" replace />

const lazyPage = (loader) =>
  lazy(() =>
    loader()
      .then((module) => ({
        default: module.default || _RedirectToHome
      }))
      .catch((err) => {
        console.error('[lazyPage] Failed to load chunk:', err)
        return { default: _RedirectToHome }
      })
  )

const routeDefinitions = [
  { path: '/dashboard/admin', Component: lazyPage(() => import('./modules/dashboard/pages/AdminDashboard')) },
  { path: '/dashboard/service', Component: lazyPage(() => import('./modules/dashboard/pages/ServiceDashboard')) },
  { path: '/dashboard/developer', Component: lazyPage(() => import('./modules/dashboard/pages/DeveloperDashboard')) },

  { path: '/application/client', Component: lazyPage(() => import('./modules/application/pages/Client')) },
  { path: '/application/device-equipment-mapping', Component: lazyPage(() => import('./modules/application/pages/DeviceEquipmentMapping')) },
  { path: '/application/device-gate-mapping', Component: lazyPage(() => import('./modules/application/pages/DeviceGateMapping')) },
  { path: '/application/line', Component: lazyPage(() => import('./modules/application/pages/Line')) },
  { path: '/application/plant', Component: lazyPage(() => import('./modules/application/pages/Plant')) },
  { path: '/application/slot', Component: lazyPage(() => import('./modules/application/pages/Slot')) },
  { path: '/application/yard', Component: lazyPage(() => import('./modules/application/pages/Yard')) },
  { path: '/application/yard-master', Component: lazyPage(() => import('./modules/application/pages/YardMaster')) },
  { path: '/application/yard-type', Component: lazyPage(() => import('./modules/application/pages/YardType')) },
  { path: '/application/planning-module', Component: lazyPage(() => import('./modules/application/pages/PlanningModule')) },
  { path: '/application/device-type', Component: lazyPage(() => import('./modules/application/pages/DeviceType')) },
  { path: '/application/slot-mapping', Component: lazyPage(() => import('./modules/application/pages/SlotMapping')) },
  { path: '/application/gate', Component: lazyPage(() => import('./modules/application/pages/Gate')) },
  { path: '/application/manage-activity', Component: lazyPage(() => import('./modules/application/pages/ManageActivity')) },
  { path: '/application/manage-commodity', Component: lazyPage(() => import('./modules/application/pages/ManageCommodity')) },
  { path: '/application/manage-container', Component: lazyPage(() => import('./modules/application/pages/ManageContainer')) },
  { path: '/application/manage-customer', Component: lazyPage(() => import('./modules/application/pages/ManageCustomer')) },
  { path: '/application/manage-process', Component: lazyPage(() => import('./modules/application/pages/ManageProcess')) },

  { path: '/dashboard/3d-visualization', Component: YardLiveStatus3D },

  // Dev-only: wall/building/prop editor for Sahnewal, not linked from any
  // menu — reachable only by navigating here directly.
  { path: '/dashboard/yard-builder', Component: lazyPage(() => import('./modules/yard3d/pages/YardBuilderPage')) },

  { path: '/container/assign-inventory-block', Component: lazyPage(() => import('./modules/container/pages/AssignInventoryBlock')) },
  { path: '/container/inventory-mapping', Component: lazyPage(() => import('./modules/container/pages/InventoryMapping')) },
  { path: '/container/history-status', Component: lazyPage(() => import('./modules/container/pages/ContainerHistoryStatus')) },
  { path: '/container/lifecycle', Component: lazyPage(() => import('./modules/container/pages/ContainerLifecycle')) },
  { path: '/container/e-survey', Component: lazyPage(() => import('./modules/container/pages/ESurvey')) },
  { path: '/container/live-status', Component: lazyPage(() => import('./modules/container/pages/LiveStatus')) },
  { path: '/container/onrack', Component: lazyPage(() => import('./modules/container/pages/Onrack')) },
  { path: '/container/rail-movement-tat', Component: lazyPage(() => import('./modules/container/pages/RailMovementTAT')) },
  { path: '/container/rail-plan-upload', Component: lazyPage(() => import('./modules/container/pages/RailPlanUpload')) },
  { path: '/container/container-live-status', Component: lazyPage(() => import('./modules/container/pages/LiveStatus')) },
  { path: '/container/container-tracking', Component: lazyPage(() => import('./modules/container/pages/ContainerTracking')) },
  { path: '/container/onrack-containers', Component: lazyPage(() => import('./modules/container/pages/Onrack')) },
  { path: '/container/emergency-gate-survey', Component: lazyPage(() => import('./modules/container/pages/EmergencyGateSurvey')) },
  { path: '/container/container-history-status', Component: lazyPage(() => import('./modules/container/pages/ContainerHistoryStatus')) },
  { path: '/container/esurvey-history', Component: lazyPage(() => import('./modules/container/pages/ESurveyHistory')) },
  { path: '/container/container-lifecycle', Component: lazyPage(() => import('./modules/container/pages/ContainerLifecycle')) },
  { path: '/container/esurvey', Component: lazyPage(() => import('./modules/container/pages/ESurvey')) },

  { path: '/gate/trailer-in', Component: lazyPage(() => import('./modules/gate/pages/TrailerGateIn')) },
  { path: '/gate/trailer-out', Component: lazyPage(() => import('./modules/gate/pages/TrailerGateOut')) },
  { path: '/gate/pre-gate-in-out', Component: lazyPage(() => import('./modules/gate/pages/PreGateInOut')) },
  { path: '/gate/main-gate', Component: lazyPage(() => import('./modules/gate/pages/MainGate')) },

  { path: '/machine/breakdown', Component: lazyPage(() => import('./modules/machine/pages/Breakdown')) },
  { path: '/machine/equipment', Component: lazyPage(() => import('./modules/machine/pages/Equipment')) },
  { path: '/machine/equipment-status', Component: lazyPage(() => import('./modules/machine/pages/EquipmentStatus')) },

  { path: '/reports/container-status-report', Component: lazyPage(() => import('./modules/report/pages/ContainerStatusReport')) },
  { path: '/reports/equipment-utilization', Component: lazyPage(() => import('./modules/report/pages/EquipmentUtilization')) },
  { path: '/reports/count-with-moves', Component: lazyPage(() => import('./modules/report/pages/CountWithMoves')) },
  { path: '/reports/task-allocation-summary', Component: lazyPage(() => import('./modules/report/pages/TaskAllocationSummary')) },
  { path: '/reports/login-history', Component: lazyPage(() => import('./modules/report/pages/LoginHistoryReport')) },
  { path: '/reports/physical-inventory-log', Component: lazyPage(() => import('./modules/report/pages/PhysicalInventoryLog')) },
  { path: '/reports/equipment-accuracy', Component: lazyPage(() => import('./modules/report/pages/EquipmentAccuracy')) },
  { path: '/reports/mismatch-handling', Component: lazyPage(() => import('./modules/report/pages/MismatchHandling')) },
  { path: '/reports/gate-in-out-report', Component: lazyPage(() => import('./modules/report/pages/GateInOutReport')) },
  { path: '/reports/daily-equipment-utilization', Component: lazyPage(() => import('./modules/report/pages/DailyEquipmentUtilization')) },
  { path: '/reports/offload-report', Component: lazyPage(() => import('./modules/report/pages/OffloadReport')) },
  { path: '/reports/navision-status', Component: lazyPage(() => import('./modules/report/pages/NavisionStatus')) },
  { path: '/reports/inventory-mismatch', Component: lazyPage(() => import('./modules/report/pages/InventoryMismatch')) },
  { path: '/reports/container-update-history', Component: lazyPage(() => import('./modules/report/pages/ContainerUpdateHistory')) },
  { path: '/reports/device-raw-data', Component: lazyPage(() => import('./modules/report/pages/DeviceRawData')) },
  { path: '/reports/pre-rail-in-report', Component: lazyPage(() => import('./modules/report/pages/PreRailInReport')) },
  { path: '/reports/device-data-report', Component: lazyPage(() => import('./modules/report/pages/DeviceDataReport')) },
  { path: '/reports/equipment-breakdown-report', Component: lazyPage(() => import('./modules/report/pages/EquipmentBreakdownReport')) },
  { path: '/reports/rail-in-report', Component: lazyPage(() => import('./modules/report/pages/RailInReport')) },
  { path: '/reports/device-transaction-summary', Component: lazyPage(() => import('./modules/report/pages/DeviceTransactionSummary')) },
  { path: '/reports/rail-journey', Component: lazyPage(() => import('./modules/report/pages/RailJourney')) },
  { path: '/reports/rail-plan-report', Component: lazyPage(() => import('./modules/report/pages/RailPlanReport')) },
  { path: '/reports/terminal-wise-container-handled', Component: lazyPage(() => import('./modules/report/pages/TerminalWiseContainerHandled')) },
  { path: '/reports/actual-vs-proposed-plan', Component: lazyPage(() => import('./modules/report/pages/ActualVsProposedPlan')) },
  { path: '/reports/breakdown-report', Component: lazyPage(() => import('./modules/report/pages/BreakdownReport')) },
  { path: '/reports/month-wise-inventory', Component: lazyPage(() => import('./modules/report/pages/MonthWiseInventory')) },
  { path: '/reports/rail-in', Component: lazyPage(() => import('./modules/report/pages/RailInReport')) },
  { path: '/reports/rail-plan', Component: lazyPage(() => import('./modules/report/pages/RailPlanReport')) },

  { path: '/trailer/report', Component: lazyPage(() => import('./modules/trailer/pages/TrailerReport')) },
  { path: '/trailer/status', Component: lazyPage(() => import('./modules/trailer/pages/TrailerStatus')) },

  { path: '/user-settings/menu', Component: lazyPage(() => import('./modules/userSettings/pages/MenuPage')) },
  { path: '/user-settings/role-menu-mapping', Component: lazyPage(() => import('./modules/userSettings/pages/RoleMenuMapping')) },
  { path: '/user-settings/role', Component: lazyPage(() => import('./modules/userSettings/pages/RolePage')) },
  { path: '/user-settings/users', Component: lazyPage(() => import('./modules/userSettings/pages/UserPage')) },
]

const App = () => (
  <BrowserRouter>
    <Suspense fallback={<_LoadingScreen />}>
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/kiosk" element={<Kiosk />} />
        {routeDefinitions.map(({ path, Component }) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute>
                <Component />
              </ProtectedRoute>
            }
          />
        ))}
        {/* Any unknown route → service dashboard */}
        <Route path="*" element={<Navigate to="/dashboard/service" replace />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
)

export default App
