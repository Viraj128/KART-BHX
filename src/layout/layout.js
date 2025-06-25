import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Sidebar from '../component/Sidebar';

const Layout = () => {
  const { user } = useAuth();

  // If no user (e.g., during session restoration), return null
  if (!user) {
    return null;
  }

  return (
  <div className="flex min-h-screen">
      {/* Sidebar is fixed and takes up 256px width */}
      <Sidebar user={user} />

      {/* Main content area with padding to avoid overlapping the fixed sidebar */}
      <div className="flex-1 pl-64">
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;