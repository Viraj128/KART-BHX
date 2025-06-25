import React, { useEffect, useState, useCallback } from "react";
import { db } from "../firebase/config";
import { collection, getDocs, query } from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ROLES } from "../config/roles";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

const Users = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Role checks using ROLES constants
  const isAdmin = user?.role === ROLES.ADMIN;
  const isManager = user?.role === ROLES.MANAGER;
  const isTeamLeader = user?.role === ROLES.TEAMLEADER;
  const isTeamMember = user?.role === ROLES.TEAMMEMBER;

  // State management
  const [teamMembers, setTeamMembers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [filteredTeamMembers, setFilteredTeamMembers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [roleFilter, setRoleFilter] = useState("all");
  const [userTypeFilter, setUserTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Role counts state
  const [roleCounts, setRoleCounts] = useState({
    Admin: 0,
    Manager: 0,
    TeamLeader: 0,
    TeamMember: 0,
    Customer: 0,
  });

  // Sorting configuration
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc",
  });

  // Redirect team members as they shouldn't access this page
  useEffect(() => {
    if (isTeamMember) {
      navigate("/unauthorized", { replace: true });
    }
  }, [isTeamMember, navigate]);

  // Set roleFilter from navigation state on mount
  React.useEffect(() => {
    if (location.state?.filterRole) {
      setRoleFilter(location.state.filterRole);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // Calculate role counts based on visible users for the current role
  const calculateRoleCounts = (teamMembersList, customersList) => {
    const counts = {
      Admin: 0,
      Manager: 0,
      TeamLeader: 0,
      TeamMember: 0,
      Customer: 0,
    };

    // Apply role-based restrictions for team members
    const visibleTeamMembers = teamMembersList.filter((userData) => {
      if (isAdmin) return true;
      if (isManager) {
        return userData.role === ROLES.TEAMLEADER || userData.role === ROLES.TEAMMEMBER;
      }
      if (isTeamLeader) {
        return userData.role === ROLES.TEAMMEMBER;
      }
      return false;
    });

    // Set customer count (only for admin)
    if (isAdmin) {
      counts.Customer = customersList.length;
    }

    // Calculate counts for visible team members
    visibleTeamMembers.forEach((userData) => {
      if (userData.role === ROLES.ADMIN) counts.Admin++;
      if (userData.role === ROLES.MANAGER) counts.Manager++;
      if (userData.role === ROLES.TEAMLEADER) counts.TeamLeader++;
      if (userData.role === ROLES.TEAMMEMBER) counts.TeamMember++;
    });

    setRoleCounts(counts);
  };

  // Load users data
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch team members
      const userSnapshot = await getDocs(query(collection(db, "users_01")));
      const teamMembersData = userSnapshot.docs.map((doc) => ({
        docId: doc.id,
        userId: doc.data().userId || "N/A",
        name: doc.data().name || "N/A",
        phone: doc.data().phone || "N/A",
        countryCode: doc.data().countryCode || "+91",
        role: doc.data().role || "N/A",
        source: "teammember",
        member_since: doc.data().member_since || null,
      }));

      // Fetch customers
      const customerSnapshot = await getDocs(query(collection(db, "customers")));
      const customersData = customerSnapshot.docs.map((doc) => ({
        docId: doc.id,
        userId: doc.data().userId || "N/A",
        name: doc.data().name || "N/A",
        phone: doc.data().phone || "N/A",
        countryCode: doc.data().countryCode || "+91",
        role: "Customer",
        source: "customer",
        member_since: doc.data().member_since || null,
      }));

      setTeamMembers(teamMembersData);
      setCustomers(customersData);
      calculateRoleCounts(teamMembersData, customersData);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isManager, isTeamLeader]);

  // Filter and sort data
  const filterData = useCallback(() => {
    const search = debouncedSearch.toLowerCase();
    const normalizedRoleFilter = roleFilter.toLowerCase();

    const visibleTeamMembers = teamMembers.filter((userData) => {
      if (isAdmin) return true;
      if (isManager) {
        return userData.role === ROLES.TEAMLEADER || userData.role === ROLES.TEAMMEMBER;
      }
      if (isTeamLeader) {
        return userData.role === ROLES.TEAMMEMBER;
      }
      return false;
    });

    // Filter team members
    const filteredTeamMems = visibleTeamMembers.filter((userData) => {
      if (userTypeFilter === "customers") return false;

      const fullPhone = `${userData.countryCode} ${userData.phone}`.toLowerCase();
      const matchesSearch = [
        userData.name.toLowerCase(),
        userData.phone.toLowerCase(),
        userData.userId.toLowerCase(),
        userData.role.toLowerCase(),
        fullPhone, // Include country code + phone in search
      ].some((field) => field.includes(search));

      const matchesRole =
        normalizedRoleFilter === "all" ||
        userData.role.toLowerCase() === normalizedRoleFilter;

      return matchesSearch && matchesRole;
    });

    // Filter customers (only visible to admin)
    const filteredCusts = isAdmin
      ? customers.filter((customer) => {
          if (userTypeFilter === "teammembers") return false;

          const fullPhone = `${customer.countryCode} ${customer.phone}`.toLowerCase();
          return [
            customer.name.toLowerCase(),
            customer.phone.toLowerCase(),
            customer.userId.toLowerCase(),
            fullPhone, // Include country code + phone in search
          ].some((field) => field.includes(search));
        })
      : [];

    // Sort team members
    const sortedTeamMems = [...filteredTeamMems].sort((a, b) => {
      const direction = sortConfig.direction === "asc" ? 1 : -1;
      if (sortConfig.key === "member_since") {
        const aDate = a.member_since ? new Date(a.member_since) : new Date(0);
        const bDate = b.member_since ? new Date(b.member_since) : new Date(0);
        return (aDate - bDate) * direction;
      }
      if (sortConfig.key === "phone") {
        // Combine countryCode and phone for sorting
        const aPhone = `${a.countryCode}${a.phone}`.toLowerCase();
        const bPhone = `${b.countryCode}${b.phone}`.toLowerCase();
        return aPhone.localeCompare(bPhone) * direction;
      }
      const aValue =
        (typeof a[sortConfig.key] === "string"
          ? a[sortConfig.key].toLowerCase()
          : a[sortConfig.key]) || "";
      const bValue =
        (typeof b[sortConfig.key] === "string"
          ? b[sortConfig.key].toLowerCase()
          : b[sortConfig.key]) || "";
      return aValue.localeCompare(bValue) * direction;
    });

    // Sort customers
    const sortedCusts = [...filteredCusts].sort((a, b) => {
      const direction = sortConfig.direction === "asc" ? 1 : -1;
      if (sortConfig.key === "member_since") {
        const aDate = a.member_since ? new Date(a.member_since) : new Date(0);
        const bDate = b.member_since ? new Date(b.member_since) : new Date(0);
        return (aDate - bDate) * direction;
      }
      if (sortConfig.key === "phone") {
        // Combine countryCode and phone for sorting
        const aPhone = `${a.countryCode}${a.phone}`.toLowerCase();
        const bPhone = `${b.countryCode}${b.phone}`.toLowerCase();
        return aPhone.localeCompare(bPhone) * direction;
      }
      const aValue =
        (typeof a[sortConfig.key] === "string"
          ? a[sortConfig.key].toLowerCase()
          : a[sortConfig.key]) || "";
      const bValue =
        (typeof b[sortConfig.key] === "string"
          ? b[sortConfig.key].toLowerCase()
          : b[sortConfig.key]) || "";
      return aValue.localeCompare(bValue) * direction;
    });

    setFilteredTeamMembers(sortedTeamMems);
    setFilteredCustomers(sortedCusts);
  }, [
    teamMembers,
    customers,
    debouncedSearch,
    roleFilter,
    sortConfig,
    userTypeFilter,
    isAdmin,
    isManager,
    isTeamLeader,
  ]);

  // Sorting handlers
  const sortUsers = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const renderSortArrow = (column) => {
    if (sortConfig.key === column) {
      return sortConfig.direction === "asc" ? "↑" : "↓";
    }
    return null;
  };

  // Search debounce
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  // Filter when dependencies change
  useEffect(() => {
    filterData();
  }, [debouncedSearch, filterData]);

  // Initial load and reload handling
  useEffect(() => {
    const reload = location.state?.reload;
    const message = location.state?.message;

    if (reload) {
      if (message) {
        alert(message);
      }
      navigate(location.pathname, { replace: true });
    }

    loadUsers();
  }, [loadUsers, location, navigate]);

  // Skeleton for Summary Cards
  const renderSummarySkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      {Array(6)
        .fill()
        .map((_, index) => (
          <div key={index} className="bg-white p-4 rounded-lg shadow">
            <Skeleton height={20} width={100} />
            <Skeleton height={30} width={60} style={{ marginTop: 8 }} />
          </div>
        ))}
    </div>
  );

  // Skeleton for Table Rows
  const renderTableSkeleton = (columns, rows = 5) => (
    <tbody className="bg-white divide-y divide-gray-200">
      {Array(rows)
        .fill()
        .map((_, index) => (
          <tr key={index}>
            {Array(columns)
              .fill()
              .map((_, colIndex) => (
                <td
                  key={colIndex}
                  className="px-6 py-4 whitespace-nowrap text-sm"
                >
                  <Skeleton height={20} />
                </td>
              ))}
          </tr>
        ))}
    </tbody>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">User Management</h1>
        {isAdmin && (
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
            onClick={() => navigate("/users/add-employee")}
          >
            <span className="mr-2">+</span> Add User
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <SkeletonTheme baseColor="#e5e7eb" highlightColor="#f3f4f6">
        {loading ? (
          renderSummarySkeleton()
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-gray-500 text-sm">Total Users</h3>
              <p className="text-2xl font-bold">
                {filteredTeamMembers.length + filteredCustomers.length}
              </p>
            </div>
            {Object.entries(roleCounts).map(([role, count]) => (
              <div key={role} className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-gray-500 text-sm">
                  {role === "TeamLeader"
                    ? "Team Leaders"
                    : role === "TeamMember"
                    ? "Team Members"
                    : role + "s"}
                </h3>
                <p
                  className={`text-2xl font-bold ${
                    role === "Admin"
                      ? "text-purple-600"
                      : role === "Manager"
                      ? "text-blue-600"
                      : role === "TeamLeader"
                      ? "text-green-600"
                      : role === "TeamMember"
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {count}
                </p>
              </div>
            ))}
          </div>
        )}
      </SkeletonTheme>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 sticky top-0 z-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="w-full md:w-1/3">
            <label
              htmlFor="userTypeFilter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Show
            </label>
            <select
              id="userTypeFilter"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={userTypeFilter}
              onChange={(e) => setUserTypeFilter(e.target.value)}
            >
              <option value="all">All Users</option>
              <option value="teammembers">Team Members Only</option>
              {isAdmin && <option value="customers">Customers Only</option>}
            </select>
          </div>

          {userTypeFilter !== "customers" && (
            <div className="w-full md:w-1/3">
              <label
                htmlFor="roleFilter"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Filter by Role
              </label>
              <select
                id="roleFilter"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Team Members</option>
                {isAdmin && <option value="admin">Admin</option>}
                {(isAdmin || isManager) && <option value="manager">Manager</option>}
                {(isAdmin || isManager) && <option value="teamleader">Team Leader</option>}
                <option value="teammember">Team Member</option>
              </select>
            </div>
          )}

          <div className="w-full md:w-1/3">
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Search
            </label>
            <input
              type="text"
              id="search"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search by name, phone, country code, or user ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Team Members Table */}
      {userTypeFilter !== "customers" && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">
            Team Members ({filteredTeamMembers.length})
          </h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["userId", "name", "phone", "member_since", "role"].map(
                    (column) => (
                      <th
                        key={column}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => sortUsers(column)}
                      >
                        <div className="flex items-center">
                          {column === "userId"
                            ? "User ID"
                            : column === "member_since"
                            ? "Date of Joining"
                            : column === "phone"
                            ? "Phone Number"
                            : column.charAt(0).toUpperCase() + column.slice(1)}
                          {renderSortArrow(column)}
                        </div>
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <SkeletonTheme baseColor="#e5e7eb" highlightColor="#f3f4f6">
                {loading ? (
                  renderTableSkeleton(5) // 5 columns for team members
                ) : (
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTeamMembers.map((userData) => (
                      <tr
                        key={userData.userId}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/users/${userData.userId}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {userData.userId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {userData.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {userData.countryCode} {userData.phone}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {userData.member_since
                            ? new Date(userData.member_since).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              userData.role.toLowerCase() === "admin"
                                ? "bg-purple-100 text-purple-800"
                                : userData.role.toLowerCase() === "manager"
                                ? "bg-blue-100 text-blue-800"
                                : userData.role.toLowerCase() === "teamleader"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {userData.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </SkeletonTheme>
            </table>
          </div>
        </div>
      )}

      {/* Customers Table (only for admin) */}
      {isAdmin && userTypeFilter !== "teammembers" && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">
            Customers ({filteredCustomers.length})
          </h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["userId", "name", "phone"].map((column) => (
                    <th
                      key={column}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => sortUsers(column)}
                    >
                      <div className="flex items-center">
                        {column === "userId"
                          ? "User ID"
                          : column === "phone"
                          ? "Phone Number"
                          : column.charAt(0).toUpperCase() + column.slice(1)}
                        {renderSortArrow(column)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <SkeletonTheme baseColor="#e5e7eb" highlightColor="#f3f4f6">
                {loading ? (
                  renderTableSkeleton(3) // 3 columns for customers
                ) : (
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCustomers.map((customer) => (
                      <tr
                        key={customer.userId}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/users/${customer.userId}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {customer.userId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.countryCode} {customer.phone}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </SkeletonTheme>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;