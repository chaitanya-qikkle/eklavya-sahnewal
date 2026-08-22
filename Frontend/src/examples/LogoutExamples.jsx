// Example: How to add logout functionality to any component

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout, getStoredUser } from '../services/authService';
import { FiLogOut, FiUser } from 'react-icons/fi';
import { confirmAction, notify } from '../utils/notify';
import { clearAuth } from '../store/slices/authSlice';

/**
 * Example 1: Simple Logout Button Component
 */
export const LogoutButton = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const handleLogout = () => {
        // Clear authentication data
        dispatch(clearAuth());
        logout();

        // Redirect to sign-in page
        navigate('/sign-in');
    };

    return (
        <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
        >
            <FiLogOut />
            <span>Logout</span>
        </button>
    );
};

/**
 * Example 2: User Profile Dropdown with Logout
 */
export const UserProfileDropdown = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [isOpen, setIsOpen] = React.useState(false);
    const user = getStoredUser();

    const handleLogout = async () => {
        const confirmed = await confirmAction({
            title: 'Logout?',
            text: 'Are you sure you want to logout?',
            confirmButtonText: 'Logout',
        });

        if (!confirmed) return;

        dispatch(clearAuth());
        logout();
        notify.success('Logged out', 'You have been signed out');
        navigate('/sign-in');
    };

    return (
        <div className="relative">
            {/* Profile Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition-all"
            >
                <FiUser className="text-xl" />
                <div className="text-left">
                    <p className="text-sm font-semibold">{user?.username || 'User'}</p>
                    <p className="text-xs text-gray-500">{user?.role || 'Role'}</p>
                </div>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2">
                    <button
                        onClick={() => {
                            navigate('/profile');
                            setIsOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-all"
                    >
                        Profile
                    </button>
                    <button
                        onClick={() => {
                            navigate('/settings');
                            setIsOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-all"
                    >
                        Settings
                    </button>
                    <hr className="my-2" />
                    <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition-all flex items-center gap-2"
                    >
                        <FiLogOut />
                        <span>Logout</span>
                    </button>
                </div>
            )}
        </div>
    );
};

/**
 * Example 3: Using logout with existing Navbar
 * 
 * If your Navbar component accepts an onSignOut prop, use it like this:
 */
export const PageWithNavbar = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const user = getStoredUser();

    const handleSignOut = () => {
        dispatch(clearAuth());
        logout();
        navigate('/sign-in');
    };

    return (
        <div>
            <Navbar
                userName={user?.username || 'Guest'}
                userRole={user?.role || 'User'}
                onSignOut={handleSignOut}
            />
            {/* Rest of your page content */}
        </div>
    );
};

/**
 * Example 4: Auto-logout on token expiration or authentication error
 */
export const AutoLogoutExample = () => {
    const navigate = useNavigate();

    const handleApiCall = async () => {
        try {
            const response = await fetch('/v1/some-endpoint', {
                headers: {
                    'Authorization': `Bearer ${getStoredToken()}`
                }
            });

            // If unauthorized, logout and redirect
            if (response.status === 401 || response.status === 403) {
                logout();
                navigate('/sign-in');
                return;
            }

            // Process response...
        } catch (error) {
            console.error('API call failed:', error);
        }
    };

    return <div>Example component with auto-logout</div>;
};

/**
 * Example 5: Protected Route Usage
 * 
 * Wrap any route that requires authentication with ProtectedRoute
 */
import ProtectedRoute from '../components/auth/ProtectedRoute';

export const AppRoutesExample = () => {
    return (
        <Routes>
            {/* Public route - no authentication required */}
            <Route path="/sign-in" element={<SignIn />} />

            {/* Protected routes - authentication required */}
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/user-settings/role"
                element={
                    <ProtectedRoute>
                        <RolePage />
                    </ProtectedRoute>
                }
            />
        </Routes>
    );
};

/**
 * Example 6: Check authentication in useEffect
 */
export const ComponentWithAuthCheck = () => {
    const navigate = useNavigate();

    React.useEffect(() => {
        // Check if user is authenticated on component mount
        if (!isAuthenticated()) {
            navigate('/sign-in');
        }
    }, [navigate]);

    return <div>Protected content</div>;
};
