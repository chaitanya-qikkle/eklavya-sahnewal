/**
 * Authentication Service
 * Handles all authentication-related API calls
 */

import { API_ENDPOINTS } from '../config/api';

const AUTH_USER_KEY = 'user';
const AUTH_TOKEN_KEY = 'authToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

const safeJsonParse = (value) => {
    try {
        return value ? JSON.parse(value) : null;
    } catch {
        return null;
    }
};

const base64UrlDecode = (value) => {
    if (!value || typeof value !== 'string') return null;
    try {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
        const decoded = atob(padded);
        // Handle unicode payloads
        const utf8 = decodeURIComponent(
            decoded
                .split('')
                .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
                .join('')
        );
        return utf8;
    } catch {
        return null;
    }
};

export const decodeJwtPayload = (token) => {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const json = base64UrlDecode(parts[1]);
    return safeJsonParse(json);
};

export const isTokenExpired = (token) => {
    const payload = decodeJwtPayload(token);
    const exp = payload?.exp;
    if (typeof exp !== 'number') return false;
    // exp is seconds since epoch
    return Date.now() >= exp * 1000;
};

export const clearLegacyAuthData = () => {
    try {
        sessionStorage.removeItem(AUTH_USER_KEY);
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
        sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
        // ignore
    }
};

/**
 * Login user
 * @param {string} username - User's username
 * @param {string} password - User's password
 * @returns {Promise<Object>} Login response with user data and token
 */
export const login = async (username, password) => {
    try {
        const response = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username,
                password,
            }),
        });

        const contentType = response.headers.get('content-type') || '';
        const rawBody = await response.text();
        const data = contentType.includes('application/json')
            ? safeJsonParse(rawBody)
            : null;

        if (!response.ok) {
            const errorMessage =
                data?.detail ||
                data?.message ||
                rawBody ||
                `Login failed (${response.status})`;
            throw new Error(errorMessage);
        }

        if (!data) {
            throw new Error('Server returned an unexpected response. Please try again.');
        }

        return data;
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Unable to reach server. Please check your network connection.');
        }
        console.error('Login error:', error);
        throw error;
    }
};

/**
 * Make authenticated API request with automatic token refresh
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export const authenticatedFetch = async (url, options = {}) => {
    const token = getStoredToken();
    
    if (!token) {
        throw new Error('No authentication token available');
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
    };

    const response = await fetch(url, { ...options, headers });

    // If unauthorized, token might be expired
    if (response.status === 401) {
        // Could implement token refresh here if refresh endpoint exists
        logout();
        window.location.href = '/';
        throw new Error('Session expired. Please login again.');
    }

    return response;
};

/**
 * Get all roles
 * @returns {Promise<Object>} List of roles
 */
export const getRoles = async () => {
    try {
        const response = await authenticatedFetch(API_ENDPOINTS.AUTH.GET_ROLES, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || data.message || 'Failed to fetch roles');
        }

        return data;
    } catch (error) {
        console.error('Get roles error:', error);
        throw error;
    }
};

/**
 * Create a new role
 * @param {string} role - Role name
 * @param {string} createdBy - ID of user creating the role
 * @returns {Promise<Object>} Created role data
 */
export const createRole = async (role, createdBy = 1) => {
    try {
        const response = await authenticatedFetch(API_ENDPOINTS.AUTH.CREATE_ROLE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                role,
                created_by: createdBy,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || data.message || 'Failed to create role');
        }

        return data;
    } catch (error) {
        console.error('Create role error:', error);
        throw error;
    }
};

/**
 * Update an existing role
 * @param {number} roleId - ID of the role to update
 * @param {string} role - New role name
 * @param {number} modifiedBy - ID of user modifying the role
 * @returns {Promise<Object>} Updated role data
 */
export const updateRole = async (roleId, role, modifiedBy = 1) => {
    try {
        const response = await authenticatedFetch(API_ENDPOINTS.AUTH.UPDATE_ROLE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                role_id: roleId,
                role,
                modified_by: modifiedBy,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || data.message || 'Failed to update role');
        }

        return data;
    } catch (error) {
        console.error('Update role error:', error);
        throw error;
    }
};

/**
 * Delete a role
 * @param {number} roleId - ID of the role to delete
 * @param {number} deletedBy - ID of user deleting the role
 * @returns {Promise<Object>} Deletion response
 */
export const deleteRole = async (roleId, deletedBy = 1) => {
    try {
        const response = await authenticatedFetch(API_ENDPOINTS.AUTH.DELETE_ROLE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                role_id: roleId,
                deleted_by: deletedBy,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || data.message || 'Failed to delete role');
        }

        return data;
    } catch (error) {
        console.error('Delete role error:', error);
        throw error;
    }
};

/**
 * Store user data and token in sessionStorage
 * @param {Object} userData - User data from login response
 * @param {string} token - Authentication token
 * @param {string} refreshToken - Refresh token
 */
export const storeAuthData = (userData, token, refreshToken = null) => {
    // Local persistence: persists across tabs and browser restarts.
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
    if (token) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
    }
    if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    // Ensure old persistent values don't keep users "auto logged-in".
    clearLegacyAuthData();
};

/**
 * Get stored user data
 * @returns {Object|null} User data or null if not logged in
 */
export const getStoredUser = () => {
    const userStr = localStorage.getItem(AUTH_USER_KEY);
    return safeJsonParse(userStr);
};

/**
 * Get stored auth token
 * @returns {string|null} Auth token or null if not logged in
 */
export const getStoredToken = () => {
    return localStorage.getItem(AUTH_TOKEN_KEY);
};

/**
 * Get stored refresh token
 * @returns {string|null} Refresh token or null if not available
 */
export const getStoredRefreshToken = () => {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
};

/**
 * Check if user is authenticated
 * @returns {boolean} True if user is authenticated
 */
export const isAuthenticated = () => {
    const token = getStoredToken();
    if (!token) return false;
    if (isTokenExpired(token)) {
        logout();
        return false;
    }
    return true;
};

/**
 * Logout user (clear stored data)
 */
export const logout = () => {
    try {
        localStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
        // ignore
    }
    clearLegacyAuthData();
};
