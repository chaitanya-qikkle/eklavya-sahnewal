import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { isAuthenticated, isTokenExpired, logout } from '../../services/authService';
import { clearAuth, selectAuthToken } from '../../store/slices/authSlice';

/**
 * ProtectedRoute Component
 * Wraps routes that require authentication
 * Redirects to sign-in page if user is not authenticated
 */
const ProtectedRoute = ({ children }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const token = useSelector(selectAuthToken);
    const tokenExpired = token ? isTokenExpired(token) : false;
    const tokenValid = token ? !tokenExpired : false;
    const authed = tokenValid || isAuthenticated();

    useEffect(() => {
        if (tokenExpired) {
            dispatch(clearAuth());
            logout();
            navigate('/', { replace: true });
            return;
        }
        // Check if user is authenticated
        if (!authed) {
            // Redirect to sign-in page if not authenticated
            navigate('/', { replace: true });
        }
    }, [navigate, authed, tokenExpired, dispatch]);

    // Only render children if authenticated
    return authed ? children : null;
};

export default ProtectedRoute;
