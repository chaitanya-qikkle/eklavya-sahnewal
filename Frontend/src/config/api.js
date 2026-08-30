/**
 * API Configuration
 * Centralized API endpoint configuration
 */

// Base URL for API calls
// In development: Vite proxy handles /v1 -> http://127.0.0.1:8000/v1 (see vite.config.js)
// In production (FastAPI on :5050, IIS on :8090): dynamically switch port
const _envUrl = import.meta.env.VITE_API_BASE_URL;
const _getApiBaseUrl = () => {
  if (_envUrl) return _envUrl;
  if (typeof window !== 'undefined' && window.location.port === '8090') {
    return `${window.location.protocol}//${window.location.hostname}:5050`;
  }
  return '';
};
export const API_BASE_URL = _getApiBaseUrl();

// Helper to build full URL
const buildUrl = (path) => {
  if (API_BASE_URL) {
    return `${API_BASE_URL}${path}`;
  }
  return path;
};

// For static assets (images, stitching outputs) that need absolute URL in Tauri desktop
export const buildAssetUrl = (path) => {
  if (!path) return path;
  // Already absolute
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (API_BASE_URL) return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  return path;
};

// API endpoints
export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: buildUrl('/v1/auth/login'),
    LOGOUT: buildUrl('/v1/auth/logout'),
    REFRESH: buildUrl('/v1/auth/refresh'),
    GET_USERS: buildUrl('/v1/auth/get-users'),
    CREATE_USER: buildUrl('/v1/auth/create-user-sp'),
    UPDATE_USER: buildUrl('/v1/auth/update-user'),
    DELETE_USER: buildUrl('/v1/auth/delete-user'),
    GET_ROLES: buildUrl('/v1/auth/get-roles'),
    CREATE_ROLE: buildUrl('/v1/auth/create-role'),
    UPDATE_ROLE: buildUrl('/v1/auth/update-role'),
    DELETE_ROLE: buildUrl('/v1/auth/delete-role'),
    GET_MENUS: buildUrl('/v1/menu/get-menus'),
    CREATE_MENU: buildUrl('/v1/menu/create-menu'),
    UPDATE_MENU: buildUrl('/v1/menu/update-menu'),
    DELETE_MENU: buildUrl('/v1/menu/delete-menu'),
    GET_ROLE_MENUS: buildUrl('/v1/menu/get-role-menus'),
    SET_ROLE_MENUS: buildUrl('/v1/menu/set-role-menus'),
  },

  MENU: {
    CREATE_MENU: buildUrl('/v1/menu/create-menu'),
    UPDATE_MENU: buildUrl('/v1/menu/update-menu'),
    SET_ROLE_MENUS: buildUrl('/v1/menu/set-role-menus'),
  },

  // Master Data
  MASTER: {
    // Customer
    GET_CUSTOMER: buildUrl('/v1/customer/get-customer'),
    GET_CUSTOMER_ALL: buildUrl('/v1/customer/get-customer-all'),
    ADD_CUSTOMER: buildUrl('/v1/customer/add-customer'),
    UPDATE_CUSTOMER: buildUrl('/v1/customer/update-customer'),
    DELETE_CUSTOMER: buildUrl('/v1/customer/delete-customer'),
    // Client
    GET_CLIENT: buildUrl('/v1/client/get-client'),
    GET_CLIENT_ALL: buildUrl('/v1/client/get-client-all'),
    ADD_CLIENT: buildUrl('/v1/client/add-client'),
    UPDATE_CLIENT: buildUrl('/v1/client/update-client'),
    DELETE_CLIENT: buildUrl('/v1/client/delete-client'),

    // Activity
    GET_ACTIVITY: buildUrl('/v1/activity/get-activity'),
    ADD_ACTIVITY: buildUrl('/v1/activity/add-activity'),
    UPDATE_ACTIVITY: buildUrl('/v1/activity/update-activity'),
    DELETE_ACTIVITY: buildUrl('/v1/activity/delete-activity'),

    // Commodity
    GET_COMMODITY: buildUrl('/v1/commodity/get-commodity'),
    ADD_COMMODITY: buildUrl('/v1/commodity/add-commodity'),
    UPDATE_COMMODITY: buildUrl('/v1/commodity/update-commodity'),
    DELETE_COMMODITY: buildUrl('/v1/commodity/delete-commodity'),

    // Container Size
    GET_CONT_SIZE: buildUrl('/v1/cont-size/get-cont-size'),
    ADD_CONT_SIZE: buildUrl('/v1/cont-size/add-cont-size'),
    UPDATE_CONT_SIZE: buildUrl('/v1/cont-size/update-cont-size'),
    DELETE_CONT_SIZE: buildUrl('/v1/cont-size/delete-cont-size'),

    // Container Type
    GET_CONT_TYPE: buildUrl('/v1/cont-type/get-cont-type'),
    ADD_CONT_TYPE: buildUrl('/v1/cont-type/add-cont-type'),
    UPDATE_CONT_TYPE: buildUrl('/v1/cont-type/update-cont-type'),
    DELETE_CONT_TYPE: buildUrl('/v1/cont-type/delete-cont-type'),

    // Line
    GET_LINE: buildUrl('/v1/line/get-line'),
    ADD_LINE: buildUrl('/v1/line/add-line'),
    UPDATE_LINE: buildUrl('/v1/line/update-line'),
    DELETE_LINE: buildUrl('/v1/line/delete-line'),

    // Equipment
    GET_EQUIPMENT: buildUrl('/v1/equipment/get-equipment'),
    GET_CURRENT_EQUIPMENT_STATUS: buildUrl('/v1/equipment/get-current-equipment-status'),
    ADD_EQUIPMENT: buildUrl('/v1/equipment/add-equipment'),
    UPDATE_EQUIPMENT: buildUrl('/v1/equipment/update-equipment'),
    DELETE_EQUIPMENT: buildUrl('/v1/equipment/delete-equipment'),

    // Equipment Transactions
    GET_EQUIPMENT_TRANSACTIONS: buildUrl('/v1/equipment-transaction/get-equipment-transactions'),
    GET_EQUIPMENT_TRANSACTION: buildUrl('/v1/equipment-transaction/get-equipment-transaction'),
    ADD_EQUIPMENT_TRANSACTION: buildUrl('/v1/equipment-transaction/add-equipment-transaction'),
    UPDATE_EQUIPMENT_TRANSACTION: buildUrl('/v1/equipment-transaction/update-equipment-transaction'),
    DELETE_EQUIPMENT_TRANSACTION: buildUrl('/v1/equipment-transaction/delete-equipment-transaction'),
    GET_EQUIPMENT_TRANSACTION_LATEST: buildUrl('/v1/equipment-transaction/get-equipment-transaction-latest'),
    GET_EQUIPMENT_TRANSACTION_LIVE_LOCATIONS: buildUrl('/v1/equipment-transaction/get-equipment-transaction-live-locations'),
    GET_EQUIPMENT_DAILY_UTILIZATION: buildUrl('/v1/equipment-transaction/daily-utilization'),
    GET_EQUIPMENT_DAILY_UTILIZATION_COUNT: buildUrl('/v1/equipment-transaction/daily-utilization-count'),

    // Device Data (EKDEVICE)
    GET_DEVICE_DATA: buildUrl('/v1/device-data/get-device-data'),
    GET_DEVICE_DATA_LATEST: buildUrl('/v1/device-data/get-device-data-latest'),
    GET_DEVICE_DATA_LIVE_LOCATIONS: buildUrl('/v1/device-data/get-device-data-live-locations'),
    GET_DEVICE_DETAILS: buildUrl('/v1/device-data/get-device-details'),

    // Process
    GET_PROCESS: buildUrl('/v1/process/get-process'),
    ADD_PROCESS: buildUrl('/v1/process/add-process'),
    UPDATE_PROCESS: buildUrl('/v1/process/update-process'),
    DELETE_PROCESS: buildUrl('/v1/process/delete-process'),
    
    // Yard
    GET_YARD: buildUrl('/v1/yard/master-lists'),
    GET_YARD_BY_ID: buildUrl('/v1/yard/get-YardById'),
    ADD_YARD: buildUrl('/v1/yard/add-yard'),
    UPDATE_YARD: buildUrl('/v1/yard/update-yard'),
    DELETE_YARD: buildUrl('/v1/yard/delete-yard'),

    ADD_BLOCK: buildUrl('/v1/block/add-block'),
    GET_BLOCKS: buildUrl('/v1/block/get-blocks'),
    UPDATE_BLOCK: buildUrl('/v1/block/update-block'),
    DELETE_BLOCK: buildUrl('/v1/block/delete-block'),

    // Plant
    GET_PLANT: buildUrl('/v1/plant/get-plant'),
    ADD_PLANT: buildUrl('/v1/plant/add-plant'),
    UPDATE_PLANT: buildUrl('/v1/plant/update-plant'),
    DELETE_PLANT: buildUrl('/v1/plant/delete-plant'),

    // Breakdown
    GET_BREAKDOWNS: buildUrl('/v1/breakdown/get-breakdowns'),
    GET_BREAKDOWNS_FILTERED: buildUrl('/v1/breakdown/get-breakdowns-filtered'),
    ADD_BREAKDOWN: buildUrl('/v1/breakdown/add-breakdown'),
    UPDATE_BREAKDOWN: buildUrl('/v1/breakdown/update-breakdown'),
    CLOSE_BREAKDOWN: buildUrl('/v1/breakdown/close-breakdown'),
    DELETE_BREAKDOWN: buildUrl('/v1/breakdown/delete-breakdown'),
  },

  // Container Inventory
  CONTAINER: {
    GET_INVENTORY: buildUrl('/v1/container/container-inventory'),
    SEARCH_CONTAINER: buildUrl('/v1/container/search-container'),
    GET_CONTAINER_INFO: buildUrl('/v1/container/container-info'),
    GET_CONTAINER_LIST: buildUrl('/v1/container/container-list'),
    GET_CONTAINER_TRACKING_DATA: buildUrl('/v1/container/container-tracking-data'),
    CONTAINER_TRACKING_UPLOAD: buildUrl('/v1/container/container-tracking-upload'),
    GET_YARD_3D_INVENTORY: buildUrl('/v1/container/yard-3d-inventory'),
    GET_YARD_3D_SLOT_LIST: buildUrl('/v1/container/yard-3d-slot-list'),
    GET_CONTAINER_LIVE_STATUS: buildUrl('/v1/container/container-live-status'),
    KIOSK_SEARCH: buildUrl('/v1/container/kiosk-search'),
    GET_LOCATION_SLOTS: buildUrl('/v1/container/location-slots'),
    GET_PRE_GATE_SURVEY: buildUrl('/v1/container/pre-gate-survey'),
    GET_GATE_NAMES: buildUrl('/v1/container/gate-names'),
    GET_CONTAINER_STATUS_REPORT: buildUrl('/v1/container/container-status-report'),
    GET_CONTAINER_GATE_REPORT: buildUrl('/v1/container/container-gate-report'),
    GET_CONTAINER_HISTORY_REPORT: buildUrl('/v1/container/container-history-report'),
    GET_LIFECYCLE_DETAILS: buildUrl('/v1/container/lifecycle-details'),
    GET_LIFECYCLE_OFFLOAD_TIMELINE: buildUrl('/v1/container/lifecycle-offload-timeline'),
    GET_LIFECYCLE_GATEINOUT: buildUrl('/v1/container/lifecycle-gateinout'),
    GET_TRAILER_GATE_IN_LIST: buildUrl('/v1/container/trailer-gate-in-list'),
    GET_TRAILER_GATE_OUT_LIST: buildUrl('/v1/container/trailer-gate-out-list'),
    TRAILER_GATE_OUT: buildUrl('/v1/container/trailer-gate-out'),
    GET_RAIL_PLAN_LIST: buildUrl('/v1/container/rail-plan-list'),
    GET_RAIL_PLAN_DETAIL: buildUrl('/v1/container/rail-plan-detail'),
    RAIL_PLAN_TASK: buildUrl('/v1/container/rail-plan-task'),
    RAIL_PLAN_ADD_TASK: buildUrl('/v1/container/rail-plan-add-task'),
    RAIL_PLAN_DELETE_TASK: buildUrl('/v1/container/rail-plan-delete-task'),
    RAIL_PLAN_UPLOAD: buildUrl('/v1/container/rail-plan-upload'),
    GET_RAIL_MOVEMENT_TAT: buildUrl('/v1/container/rail-movement-tat'),
  },

  // Reports
  REPORTS: {
    GATE_IN_OUT: buildUrl('/v1/reports/reports'),
    EQUIPMENT_UTILIZATION: buildUrl('/v1/reports/equipment-utilization'),
    COUNT_WITH_MOVES: buildUrl('/v1/reports/count-with-moves'),
    OFFLOAD_REPORT: buildUrl('/v1/reports/offload-report'),
    DEVICE_TRANSACTION_SUMMARY: buildUrl('/v1/reports/device-transaction-summary'),
    TASK_ALLOCATION_SUMMARY: buildUrl('/v1/reports/task-allocation-summary'),
    NAVISION_STATUS: buildUrl('/v1/reports/navision-status'),
    LOGIN_HISTORY: buildUrl('/v1/reports/login-history'),
    INVENTORY_MISMATCH: buildUrl('/v1/reports/inventory-mismatch'),
    PHYSICAL_INVENTORY_LOG: buildUrl('/v1/reports/physical-inventory-log'),
    CONTAINER_UPDATE_HISTORY: buildUrl('/v1/reports/container-update-history'),
    MONTH_WISE_INVENTORY: buildUrl('/v1/reports/month-wise-inventory'),
    EQUIPMENT_ACCURACY: buildUrl('/v1/reports/equipment-accuracy'),
    DOCUMENT_NUMBERS: buildUrl('/v1/reports/document-numbers'),
    RAIL_PLAN_NAME_LIST: buildUrl('/v1/reports/rail-plan-name-list'),
    ACTUAL_VS_PROPOSED_PLAN: buildUrl('/v1/reports/actual-vs-proposed-plan'),
    RAIL_IN_REPORT: buildUrl('/v1/reports/rail-in-report'),
    DEVICE_LOCK_REPORT: buildUrl('/v1/reports/device-lock-report'),
    SERVICE_DASHBOARD: buildUrl('/v1/reports/service-dashboard'),
    UPDATE_DEVICE_DATA_CONTAINER: buildUrl('/v1/reports/update-device-container'),
    DEVICE_RAW_DATA: buildUrl('/v1/reports/device-raw-data'),
    DEVICE_RAW_DATA_KALMAR_LIST: buildUrl('/v1/reports/device-raw-data/kalmar-list'),
    TRAILER_REPORT:  buildUrl('/v1/reports/trailer-report'),
    RAIL_JOURNEY: buildUrl('/v1/reports/rail-journey'),
    RAIL_JOURNEY_BY_DOCUMENT: buildUrl('/v1/reports/rail-journey-by-document'),
    MISMATCH_HANDLING: buildUrl('/v1/reports/mismatch-handling'),
  },
};

/**
 * Build full URL for API endpoint
 * @param {string} endpoint - API endpoint path
 * @returns {string} Full URL
 */
export const buildApiUrl = (endpoint) => {
  return buildUrl(endpoint);
};

/**
 * Get API configuration for environment
 * @returns {object} API configuration
 */
export const getApiConfig = () => {
  return {
    baseUrl: API_BASE_URL,
    timeout: 30000, // 30 seconds
    headers: {
      'Content-Type': 'application/json',
    },
  };
};
