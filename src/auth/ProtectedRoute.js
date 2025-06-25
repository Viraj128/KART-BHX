

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useEffect } from 'react';

export const ProtectedRoute = ({ allowedRoles }) => {
  const { user, initializing, resetSessionTimeout } = useAuth();
  
  // This useEffect must be at the top level
  useEffect(() => {
    if (user && !initializing) {
      resetSessionTimeout();
    }
  }, [user, initializing, resetSessionTimeout]);

  // Check session validity function
  const isSessionValid = () => {
    const sessionTimestamp = localStorage.getItem('sessionTimestamp');
    if (!sessionTimestamp) return false;
    
    const SESSION_TIMEOUT = 20 * 60 * 1000; // 20 minutes
    const timeElapsed = Date.now() - parseInt(sessionTimestamp);
    return timeElapsed < SESSION_TIMEOUT;
  };

  // Wait until initialization completes
  if (initializing) {
    return null; // Or a loading spinner
  }

  if (!user || !isSessionValid()) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};