import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../auth/AuthContext';
import { ROLES } from '../../config/roles';

const CustomerReport = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;

  // State declarations
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerKOTs, setCustomerKOTs] = useState([]);
  const [customerReports, setCustomerReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState(null);

  // Currency formatting helper
  const formatCurrency = (value) => {
    const num = Number(value);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  // Date formatting helper
  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date);
      return dateObj.toLocaleString('en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      return date.toString();
    }
  };

  // Fetch all customers on component mount
  useEffect(() => {
    if (!isAdmin) return;

    const fetchCustomers = async () => {
      try {
        setLoading(true);
        setError(null);
        const q = query(collection(db, 'customers'));
        const querySnapshot = await getDocs(q);

        const customersData = querySnapshot.docs.map((doc) => ({
          customerID: doc.id,
          ...doc.data(),
        }));

        setCustomers(customersData);
        console.log('Fetched customers:', customersData.length);
      } catch (err) {
        console.error('Error fetching customers:', err);
        setError('Failed to load customers. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [isAdmin]);

  // Fetch customer data when selected
  useEffect(() => {
    if (!selectedCustomer || !isAdmin) return;

    const fetchCustomerData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch KOTs for this customer
        const kotsQuery = query(
          collection(db, 'KOT'),
          where('customerID', '==', selectedCustomer.customerID)
        );
        const kotsSnapshot = await getDocs(kotsQuery);

        const kotsData = kotsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCustomerKOTs(kotsData);
        console.log('Fetched KOTs:', kotsData.length);

        // Fetch reports related to these KOTs
        if (kotsData.length > 0) {
          const kotPaths = kotsData.map((kot) => `/KOT/${kot.id}`);
          const reportsQuery = query(
            collection(db, 'Reports'),
            where('kot_id', 'in', kotPaths.slice(0, 10)) // Firestore 'in' limit is 10
          );

          const reportsSnapshot = await getDocs(reportsQuery);
          const reportsData = reportsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setCustomerReports(reportsData);
          console.log('Fetched reports:', reportsData.length);
        } else {
          setCustomerReports([]);
        }
      } catch (err) {
        console.error('Error fetching customer data:', err);
        setError('Failed to load customer data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerData();
  }, [selectedCustomer, isAdmin]);

  // Handle customer selection
  const handleCustomerSelect = (customerId) => {
    const customer = customers.find((c) => c.customerID === customerId);
    setSelectedCustomer(customer || null);
    setSortColumn(null); // Reset sorting when customer changes
    setSortDirection(null);
  };

  // Handle search input
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Handle clear action
  const handleClear = () => {
    setSearchQuery('');
    setSelectedCustomer(null);
    setCustomerKOTs([]);
    setCustomerReports([]);
    setSortColumn(null);
    setSortDirection(null);
  };

  // Filter customers based on search query
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const lowerQuery = searchQuery.toLowerCase();
    return customers.filter(
      (customer) =>
        (customer.name?.toLowerCase() || '').includes(lowerQuery) ||
        (customer.customerID?.toLowerCase() || '').includes(lowerQuery)
    );
  }, [customers, searchQuery]);

  // Handle sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortDirection(null);
        setSortColumn(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Get sort indicator for column headers
  const getSortIndicator = (column) => {
    if (sortColumn === column && sortDirection) {
      return sortDirection === 'asc' ? ' ▲' : ' ▼';
    }
    return '';
  };

  // Prepare sorted KOT data
  const sortedCustomerKOTs = useMemo(() => {
    const flatKOTs = customerKOTs.flatMap((kot) => {
      if (!kot.items || kot.items.length === 0) {
        return [{
          kotId: kot.id,
          date: kot.date,
          amount: kot.amount || 0,
          cashPaid: kot.cashPaid || 0,
          creditsUsed: kot.creditsUsed || 0,
          itemName: null,
          quantity: 0,
          itemPrice: 0,
          itemTotal: 0,
          itemIndex: 0,
          itemCount: 1,
        }];
      }
      return kot.items.map((item, index) => ({
        kotId: kot.id,
        date: kot.date,
        amount: kot.amount || 0,
        cashPaid: kot.cashPaid || 0,
        creditsUsed: kot.creditsUsed || 0,
        itemName: item.name || item.id || 'Unknown',
        quantity: item.quantity || 0,
        itemPrice: item.price || 0,
        itemTotal: (item.price || 0) * (item.quantity || 0),
        itemIndex: index,
        itemCount: kot.items.length,
      }));
    });

    if (!sortColumn || !sortDirection) return flatKOTs;

    return [...flatKOTs].sort((a, b) => {
      let aValue = a[sortColumn];
      let bValue = b[sortColumn];

      // Handle date sorting
      if (sortColumn === 'date') {
        aValue = aValue ? (aValue.toDate ? aValue.toDate() : new Date(aValue)) : null;
        bValue = bValue ? (bValue.toDate ? bValue.toDate() : new Date(bValue)) : null;
      }

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1;

      // String comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Date comparison
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Numeric comparison
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [customerKOTs, sortColumn, sortDirection]);

  // Admin access check
  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center p-8 bg-red-50 rounded-lg shadow-md max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-700">
            You don't have permission to view this page. Only administrators can access customer reports.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Customer Report System</h1>

      <div className="mb-8 bg-white p-4 rounded-lg shadow">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <label className="block text-sm font-medium text-gray-700">Search Customer:</label>
          <div className="flex items-center gap-2 w-full md:w-1/3">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search by name or customer ID"
              className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            />
            <button
              onClick={handleClear}
              className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
              disabled={loading || (!searchQuery && !selectedCustomer)}
            >
              Clear
            </button>
          </div>
          <label className="block text-sm font-medium text-gray-700">Select Customer:</label>
          {selectedCustomer && (
            <div className="bg-blue-50 px-3 py-1 rounded-full text-sm font-medium text-blue-800">
              Selected: {selectedCustomer.name}
            </div>
          )}
        </div>
        <select
          onChange={(e) => handleCustomerSelect(e.target.value)}
          className="w-full md:w-1/2 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          disabled={loading}
          value={selectedCustomer?.customerID || ''}
        >
          <option value="">-- Select a customer --</option>
          {filteredCustomers.map((customer) => (
            <option key={customer.customerID} value={customer.customerID}>
              {customer.name} ({customer.customerID})
            </option>
          ))}
        </select>
      </div>

      {selectedCustomer && (
        <div className="space-y-8">
          {/* Customer Details Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">Customer Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-xs font-medium text-gray-500 uppercase">Name</p>
                <p className="font-medium">{selectedCustomer.name || 'N/A'}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-xs font-medium text-gray-500 uppercase">Phone</p>
                <p className="font-medium">{selectedCustomer.phone || 'N/A'}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-xs font-medium text-gray-500 uppercase">Email</p>
                <p className="font-medium">{selectedCustomer.email || 'N/A'}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-xs font-medium text-gray-500 uppercase">Customer ID</p>
                <p className="font-medium">{selectedCustomer.customerID}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-xs font-medium text-gray-500 uppercase">Credit Points</p>
                <p className="font-medium">{selectedCustomer.earnedPoints || 0}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-xs font-medium text-gray-500 uppercase">Member Since</p>
                <p className="font-medium">{selectedCustomer.member_since || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* KOT Transactions Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">KOT Transactions</h2>
            {sortedCustomerKOTs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('kotId')}
                      >
                        KOT ID{getSortIndicator('kotId')}
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('date')}
                      >
                        Date/Time{getSortIndicator('date')}
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('amount')}
                      >
                        Total Amount{getSortIndicator('amount')}
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('cashPaid')}
                      >
                        Cash Paid{getSortIndicator('cashPaid')}
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('creditsUsed')}
                      >
                        Credits Used{getSortIndicator('creditsUsed')}
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('itemName')}
                      >
                        Items{getSortIndicator('itemName')}
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('quantity')}
                      >
                        Quantity{getSortIndicator('quantity')}
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('itemPrice')}
                      >
                        Item Price{getSortIndicator('itemPrice')}
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('itemTotal')}
                      >
                        Item Total{getSortIndicator('itemTotal')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedCustomerKOTs.map((row) => (
                      <tr
                        key={`${row.kotId}-${row.itemIndex}`}
                        className={row.itemIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        {row.itemIndex === 0 && (
                          <>
                            <td className="px-4 py-3 align-top" rowSpan={row.itemCount}>
                              {row.kotId}
                            </td>
                            <td className="px-4 py-3 align-top" rowSpan={row.itemCount}>
                              {formatDate(row.date)}
                            </td>
                            <td className="px-4 py-3 align-top" rowSpan={row.itemCount}>
                              ${formatCurrency(row.amount)}
                            </td>
                            <td className="px-4 py-3 align-top" rowSpan={row.itemCount}>
                              ${formatCurrency(row.cashPaid)}
                            </td>
                            <td className="px-4 py-3 align-top" rowSpan={row.itemCount}>
                              ${formatCurrency(row.creditsUsed)}
                            </td>
                          </>
                        )}
                        <td className="px-4 py-3">{row.itemName || 'No items'}</td>
                        <td className="px-4 py-3">{row.quantity}</td>
                        <td className="px-4 py-3">${formatCurrency(row.itemPrice)}</td>
                        <td className="px-4 py-3">${formatCurrency(row.itemTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No KOT transactions found for this customer.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerReport;