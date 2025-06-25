import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ROLES } from '../config/roles';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [openSection, setOpenSection] = useState(null);

  const isAdmin = user?.role === ROLES.ADMIN;
  const isManager = user?.role === ROLES.MANAGER;
  const isTeamLeader = user?.role === ROLES.TEAMLEADER;
  const isTeamMember = user?.role === ROLES.TEAMMEMBER;

  const formatTime = (timestamp) => {
    if (!timestamp) return '';

    const ts = typeof timestamp === 'string'
      ? parseInt(timestamp, 10)
      : timestamp;

    if (isNaN(ts)) return '';

    return new Date(ts).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Europe/London'
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const toggleSection = (section) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <div className="w-64 bg-white h-[100vh] p-4 flex flex-col border-r border-gray-200 fixed top-0 left-0">
      {/* Header Section */}
      <div className="text-gray-800 mb-6">
        <h1 className="text-xl font-bold mb-1">BHX - Bhookie</h1>
        <div className="h-px bg-gray-200 w-full"></div>
      </div>

      {/* User Info Section */}
      <div className="text-gray-800 mb-8">
        <h2 className="text-lg font-semibold">{user?.name || 'Unknown'}</h2>
        <p className="text-sm text-gray-600">{user?.role || 'Unknown'}</p>
        <p className="text-xs text-gray-500 mt-1">
          Active since: {formatTime(user?.loginTimestamp)}
        </p>
      </div>

      {/* Scrollable Navigation */}
      <nav className="flex-1 overflow-y-auto">
        <div className="space-y-1">
          {/* Dashboard */}
          <button
            className="w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100 rounded-md text-sm"
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </button>

          {/* User Management */}
          {(isAdmin || isManager || isTeamLeader) && (
            <button
              className="w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100 rounded-md text-sm"
              onClick={() => navigate('/users')}
            >
              User Management
            </button>
          )}

          {/* View Details */}
          {(isTeamMember) && (
            <button
              className="w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100 rounded-md text-sm"
              onClick={() => navigate('/viewDetails')}
            >
              View Details
            </button>
          )}

          {/* Attendance */}
          {(isAdmin || isManager || isTeamLeader) && (
            <button
              className="w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100 rounded-md text-sm"
              onClick={() => navigate('/attendance')}
            >
              Attendance
            </button>
          )}
          
          {/* Member Attendance */}
          {(isTeamMember) && (
            <button
              className="w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100 rounded-md text-sm"
              onClick={() => navigate('/memberAttendance')}
            >
              Member Attendance
            </button>
          )}

          {/* Inventory Section */}
          {(isAdmin || isManager || isTeamLeader) && (
            <div className="space-y-1">
              <button
                className="w-full flex justify-between items-center px-4 py-2 text-gray-800 hover:bg-gray-100 rounded-md text-sm"
                onClick={() => toggleSection('inventory')}
              >
                <span>Inventory</span>
                {openSection === 'inventory' ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4" />
                )}
              </button>

              {openSection === 'inventory' && (
                <div className="ml-4 space-y-1">
                  <button
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    onClick={() => navigate('/inventory/stock-count')}
                  >
                    Stock Count
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    onClick={() => navigate('/inventory/waste-management')}
                  >
                    Waste Management
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    onClick={() => navigate('/inventory/stock-Movement')}
                  >
                    Stock Movement
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    onClick={() => navigate('/inventory/inventoryrecords')}
                  >
                    Inventory Records
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Cash Management Section */}
          {(isAdmin || isManager || isTeamLeader) && (
            <div className="space-y-1">
              <button
                className="w-full flex justify-between items-center px-4 py-2 text-gray-800 hover:bg-gray-100 rounded-md text-sm"
                onClick={() => toggleSection('cashManagement')}
              >
                <span>Cash Management</span>
                {openSection === 'cashManagement' ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4" />
                )}
              </button>

              {openSection === 'cashManagement' && (
                <div className="ml-4 space-y-1">
                  <button
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    onClick={() => navigate('/cash-management/open-cashier')}
                  >
                    Open Cashier
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    onClick={() => navigate('/cash-management/close-cashier')}
                  >
                    Close Cashier
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    onClick={() => navigate('/cash-management/banking')}
                  >
                    Banking
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    onClick={() => navigate('/cash-management/safe-count')}
                  >
                    Safe Count
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    onClick={() => navigate('/cash-management/money-movement')}
                  >
                    Money Movement
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Items Management Section */}
          {(isAdmin || isManager || isTeamLeader) && (
            <div className="space-y-1">
              <button
                className="w-full flex justify-between items-center px-4 py-2 text-gray-800 hover:bg-gray-100 rounded-md text-sm"
                onClick={() => toggleSection('itemsmanagement')}
              >
                <span>Items Management</span>
                {openSection === 'itemsmanagement' ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4" />
                )}
              </button>

              {openSection === 'itemsmanagement' && (
                <div className="ml-4 space-y-1">
                  <button
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    onClick={() => navigate('/itemsmanagement/categories')}
                  >
                    Categories
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    onClick={() => navigate('/itemsmanagement/items')}
                  >
                    Items
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    onClick={() => navigate('/itemsmanagement/sauces')}
                  >
                    Sauces
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Reports Section */}
          {(isAdmin || isManager) && (
            <div className="space-y-1">
              <button
                className="w-full flex justify-between items-center px-4 py-2 text-gray-800 hover:bg-gray-100 rounded-md text-sm"
                onClick={() => toggleSection('reports')}
              >
                <span>Reports</span>
                {openSection === 'reports' ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4" />
                )}
              </button>

              {openSection === 'reports' && (
                <div className="ml-4 space-y-1">
                  <button
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    onClick={() => navigate('/reports/trackingWaste')}
                  >
                    Trak Inventory Waste
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    onClick={() => navigate('/reports/totalsaleperitem')}
                  >
                    Total Sale Per Item
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    onClick={() => navigate('/reports/monthlySale')}
                  >
                    Monthly Sale
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    onClick={() => navigate('/reports/weeklySale')}
                  >
                    Weekly Sale
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    onClick={() => navigate('/reports/hourlySale')}
                  >
                    Hourly Sale
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                    onClick={() => navigate('/reports/customerTrend')}
                  >
                    Customer Trend
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                        onClick={() => navigate('/reports/kot')}
                      >
                        KOT Reports
                      </button>
                      <button
                        className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                        onClick={() => navigate('/reports/customerreports')}
                      >
                        Customer Report
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Logout Button */}
      <div className="mt-auto pt-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full text-left px-4 py-2 text-red-500 hover:bg-gray-100 rounded-md text-sm"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;