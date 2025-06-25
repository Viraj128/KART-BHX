import { useEffect, useState, useCallback, useRef } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { ROLES, PATHS } from '../config/roles';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiX, FiSend, FiMessageSquare, FiClock } from 'react-icons/fi';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [showAlertPanel, setShowAlertPanel] = useState(false);
  const [newAlert, setNewAlert] = useState({
    message: '',
    recipient: 'all',
    urgent: false,
    specificUser: '',
    expirationHours: 24, // Default to 24 hours
  });
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const notificationRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [usersSnapshot, customersSnapshot] = await Promise.all([
        getDocs(collection(db, 'users_01')),
        getDocs(collection(db, 'customers')),
      ]);

      const users = usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setUsersList(users);

      const counts = users.reduce((acc, user) => {
        const role = user.role?.toLowerCase() || '';
        return {
          ...acc,
          [role]: (acc[role] || 0) + 1,
        };
      }, {});

      const customerCount = customersSnapshot.docs.length;

      setStats({
        totalUsers: users.length + customerCount,
        customerCount,
        roleCounts: counts,
      });

      await fetchAlerts();
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchAlerts = useCallback(async () => {
    try {
      const alertsSnapshot = await getDocs(collection(db, 'alerts'));
      const currentTime = new Date();
      const userAlerts = alertsSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(
          (alert) =>
            alert.expiration && new Date(alert.expiration.toDate()) > currentTime
        );
      setAlerts(userAlerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, []);

  const handleAddAlert = async () => {
    if (!newAlert.message) return;

    try {
      const timestamp = new Date();
      // Use a very large number for "Permanent" to simulate "until deleted"
      const expirationHours = newAlert.expirationHours === 'Permanent' ? 999999 : Number(newAlert.expirationHours);
      const expiration = new Date(timestamp.getTime() + expirationHours * 60 * 60 * 1000);

      let recipientName = '';
      let recipientId = '';

      if (newAlert.recipient === 'all') {
        recipientName = 'All Non-Admins';
        recipientId = 'all';
      } else if (newAlert.recipient === 'specific' && newAlert.specificUser) {
        const recipientUser = usersList.find((u) => u.id === newAlert.specificUser);
        recipientName = recipientUser
          ? `${recipientUser.name} (${recipientUser.role})`
          : 'Specific User';
        recipientId = newAlert.specificUser;
      } else {
        recipientName =
          newAlert.recipient.charAt(0).toUpperCase() + newAlert.recipient.slice(1) + 's';
        recipientId = newAlert.recipient;
      }

      await addDoc(collection(db, 'alerts'), {
        message: newAlert.message,
        recipient: recipientId,
        recipientName,
        sender: user.employeeID,
        senderName: user.name,
        urgent: newAlert.urgent,
        timestamp,
        expiration,
        read: false,
      });

      setNewAlert({
        message: '',
        recipient: 'all',
        urgent: false,
        specificUser: '',
        expirationHours: 24,
      });
      setShowAlertPanel(false);
      await fetchAlerts();
    } catch (error) {
      console.error('Error adding alert:', error);
    }
  };

  const handleDismissAlert = (alertId) => {
    setDismissedAlerts((prev) => [...prev, alertId]);
  };

  const handleMarkAsRead = async (alertId) => {
    try {
      await updateDoc(doc(db, 'alerts', alertId), { read: true });
      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId ? { ...alert, read: true } : alert
        )
      );
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const handleNavigateWithRole = (role) => {
    navigate(PATHS.USERS, { state: { filterRole: role } });
  };

  const handleNavigateToUsers = () => {
    navigate(PATHS.USERS);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotificationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const receivedAlerts = alerts.filter(
    (alert) =>
      alert.recipient === 'all' ||
      alert.recipient === user.role ||
      alert.recipient === user.id
  );

  const sentAlerts = alerts.filter(
    (alert) => user?.role === ROLES.ADMIN && alert.sender === user.employeeID
  );

  const visibleSentAlerts = sentAlerts.filter(
    (alert) => !dismissedAlerts.includes(alert.id)
  );

  const unreadAlertsCount = receivedAlerts.filter((alert) => !alert.read).length;
  const nonAdminUsers = usersList.filter((u) => u.role !== ROLES.ADMIN);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return 'Unknown time';
    }
  };

  // Handler for expiration time buttons
  const handleExpirationSelect = (hours) => {
    setNewAlert({ ...newAlert, expirationHours: hours });
  };

  if (loading || !stats) {
    return (
      <div className="flex flex-col p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <Skeleton width={200} height={40} />
          <Skeleton circle width={40} height={40} />
        </div>

        <div className="mb-8">
          <Skeleton width={150} height={30} className="mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} height={120} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-8">
          <Skeleton width={200} height={30} className="mb-4" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} height={80} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-4 md:p-8 relative min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>

        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
            className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 transition-colors relative"
          >
            <FiBell size={24} className="text-gray-700" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          {showNotificationDropdown && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
              <div className="p-3 bg-gray-50 font-medium text-sm border-b">
                Notifications
              </div>
              <div className="max-h-96 overflow-y-auto">
                {receivedAlerts.length > 0 ? (
                  receivedAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                        !alert.read ? 'bg-blue-50' : ''
                      } ${alert.urgent ? 'bg-red-50' : ''}`}
                      onClick={() => handleMarkAsRead(alert.id)}
                    >
                      <div className="flex justify-between">
                        <p className="font-medium text-sm">{alert.message}</p>
                        {!alert.read && (
                          <span className="h-2 w-2 rounded-full bg-blue-500 self-center"></span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        From: {alert.senderName}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        To: {alert.recipientName}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatTimestamp(alert.timestamp)}
                      </div>
                      {alert.urgent && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                          Urgent
                        </span>
                      )}
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <FiClock className="mr-1" />
                        Expires: {formatTimestamp(alert.expiration)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No notifications
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {user?.role !== ROLES.TEAMMEMBER && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Users</h2>

          {user?.role === ROLES.ADMIN && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <ClickableDashboardCard
                title="Total Users"
                value={stats.totalUsers}
                color="bg-blue-100"
                onClick={handleNavigateToUsers}
              />
              <ClickableDashboardCard
                title="Admins"
                value={stats.roleCounts.admin || 0}
                color="bg-red-100"
                onClick={() => handleNavigateWithRole('admin')}
              />
              <ClickableDashboardCard
                title="Managers"
                value={stats.roleCounts.manager || 0}
                color="bg-green-100"
                onClick={() => handleNavigateWithRole('manager')}
              />
              <ClickableDashboardCard
                title="Team Leaders"
                value={stats.roleCounts.teamleader || 0}
                color="bg-yellow-100"
                onClick={() => handleNavigateWithRole('teamleader')}
              />
              <ClickableDashboardCard
                title="Team Members"
                value={stats.roleCounts.teammember || 0}
                color="bg-purple-100"
                onClick={() => handleNavigateWithRole('teammember')}
              />
              <ClickableDashboardCard
                title="Customers"
                value={stats.customerCount}
                color="bg-indigo-100"
                onClick={() => handleNavigateWithRole('customer')}
              />
            </div>
          )}

          {user?.role === ROLES.MANAGER && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ClickableDashboardCard
                title="Total Team"
                value={(stats.roleCounts.teamleader || 0) + (stats.roleCounts.teammember || 0)}
                color="bg-blue-100"
                onClick={handleNavigateToUsers}
              />
              <ClickableDashboardCard
                title="Team Leaders"
                value={stats.roleCounts.teamleader || 0}
                color="bg-green-100"
                onClick={() => handleNavigateWithRole('teamleader')}
              />
              <ClickableDashboardCard
                title="Team Members"
                value={stats.roleCounts.teammember || 0}
                color="bg-purple-100"
                onClick={() => handleNavigateWithRole('teammember')}
              />
            </div>
          )}

          {user?.role === ROLES.TEAMLEADER && (
            <div className="grid grid-cols-1">
              <ClickableDashboardCard
                title="Team Members"
                value={stats.roleCounts.teammember || 0}
                color="bg-blue-100"
                onClick={() => handleNavigateWithRole('teammember')}
              />
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-4 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FiMessageSquare className="text-blue-500" />
            Recent Updates
          </h2>
        </div>

        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {user?.role === ROLES.ADMIN ? (
            visibleSentAlerts.length > 0 ? (
              visibleSentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    alert.urgent ? 'bg-red-50 border-red-500' : 'bg-blue-50 border-blue-500'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{alert.message}</p>
                      <div className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">To:</span> {alert.recipientName}
                      </div>
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <FiClock className="mr-1" />
                        Expires: {formatTimestamp(alert.expiration)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatTimestamp(alert.timestamp)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDismissAlert(alert.id)}
                      className="text-gray-500 hover:text-red-500 ml-2"
                    >
                      <FiX />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 rounded-lg bg-gray-50 text-center text-gray-500">
                No sent alerts
              </div>
            )
          ) : receivedAlerts.length > 0 ? (
            receivedAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border-l-4 ${
                  alert.urgent ? 'bg-red-50 border-red-500' : 'bg-blue-50 border-blue-500'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{alert.message}</p>
                    <div className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">From:</span> {alert.senderName}
                    </div>
                    <div className="flex items-center text-xs text-gray-500 mt-1">
                      <FiClock className="mr-1" />
                      Expires: {formatTimestamp(alert.expiration)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatTimestamp(alert.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 rounded-lg bg-gray-50 text-center text-gray-500">
              No recent updates
            </div>
          )}
        </div>
      </div>

      {user?.role === ROLES.ADMIN && (
        <div className="fixed bottom-6 right-6 z-10">
          <button
            onClick={() => setShowAlertPanel(!showAlertPanel)}
            className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
          >
            <FiSend size={24} />
          </button>

          {showAlertPanel && (
            <div className="absolute bottom-16 right-0 w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
              <div className="bg-blue-600 text-white p-3 flex justify-between items-center">
                <h3 className="font-semibold">Send Alert</h3>
                <button
                  onClick={() => setShowAlertPanel(false)}
                  className="text-white hover:text-gray-200"
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="p-4">
                <textarea
                  className="w-full p-3 border rounded mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your message here..."
                  value={newAlert.message}
                  onChange={(e) => setNewAlert({ ...newAlert, message: e.target.value })}
                  rows={4}
                />

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Send To:
                  </label>
                  <select
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={newAlert.recipient}
                    onChange={(e) =>
                      setNewAlert({
                        ...newAlert,
                        recipient: e.target.value,
                        specificUser: e.target.value === 'specific' ? '' : newAlert.specificUser,
                      })
                    }
                  >
                    <option value="all">All Non-Admins</option>
                    <option value="manager">Managers</option>
                    <option value="teamleader">Team Leaders</option>
                    <option value="teammember">Team Members</option>
                    <option value="specific">Specific User</option>
                  </select>

                  {newAlert.recipient === 'specific' && (
                    <div className="mt-2">
                      <select
                        className="w-full p-2 border rounded mt-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={newAlert.specificUser}
                        onChange={(e) =>
                          setNewAlert({ ...newAlert, specificUser: e.target.value })
                        }
                      >
                        <option value="">Select a User</option>
                        {nonAdminUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({user.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center mb-4">
                  <input
                    id="urgent-checkbox"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                    checked={newAlert.urgent}
                    onChange={(e) => setNewAlert({ ...newAlert, urgent: e.target.checked })}
                  />
                  <label htmlFor="urgent-checkbox" className="ml-2 text-sm text-gray-700">
                    Mark as urgent
                  </label>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiration Time:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '1 hr', value: 1 },
                      { label: '5 hr', value: 5 },
                      { label: '24 hr', value: 24 },
                      { label: '2 days', value: 48 },
                      { label: 'Permanent', value: 'Permanent' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleExpirationSelect(option.value)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          newAlert.expirationHours === option.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleAddAlert}
                  className={`w-full py-2 px-4 rounded font-medium flex items-center justify-center gap-2 ${
                    newAlert.urgent
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <FiSend /> Send Alert
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ClickableDashboardCard = ({ title, value, color, onClick }) => (
  <button
    onClick={onClick}
    className={`${color} p-6 rounded-lg shadow-sm w-full text-left hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500`}
  >
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-3xl font-bold">{value || 0}</p>
  </button>
);

export default Dashboard;