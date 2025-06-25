import React, { useState, useEffect } from 'react';
import { format, isBefore } from 'date-fns';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FiArrowUp, FiArrowDown } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { ROLES } from '../config/roles';
import { useAuth } from "../auth/AuthContext";

const MemberAttendance = () => {
  const navigate = useNavigate();
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [employeeName, setEmployeeName] = useState('');
  const [totalHours, setTotalHours] = useState('0h 0m');
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [userData, setUserData] = useState(null);
  const { user } = useAuth();


  // Role checks using ROLES constants
  const isManager = user?.role === ROLES.MANAGER;
  const isTeamLeader = user?.role === ROLES.TEAMLEADER;

  // Load user data from local storage
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUserData(parsedUser);
      } else {
        setError('No user data found in local storage.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error accessing local storage:', err);
      setError('Failed to retrieve user data from local storage.');
      setLoading(false);
    }
  }, []);

  // Calculate total work hours
  const calculateTotalHours = (data) => {
    let totalMinutes = 0;
    data.forEach((record) => {
      if (record.worked && record.worked !== 'N/A') {
        const match = record.worked.match(/^(\d+)h\s*(\d+)m$/);
        if (match) {
          const hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          totalMinutes += hours * 60 + minutes;
        }
      }
    });
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  // Parse duration for sorting
  const parseDurationToMinutes = (duration) => {
    if (!duration || duration === 'N/A') return 0;
    const match = duration.match(/^(\d+)h\s*(\d+)m$/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      return hours * 60 + minutes;
    }
    return 0;
  };

  // Parse time for sorting
  const parseTime = (time) => {
    if (!time || time === '--:--') return '00:00';
    return time;
  };

  // Sort attendance data
  const sortData = (data) => {
    return [...data].sort((a, b) => {
      let valueA, valueB;
      switch (sortField) {
        case 'date':
          valueA = a.date ? new Date(a.date.split('-').reverse().join('-')) : new Date(0);
          valueB = b.date ? new Date(b.date.split('-').reverse().join('-')) : new Date(0);
          break;
        case 'checkIn':
          valueA = parseTime(a.checkInStr);
          valueB = parseTime(b.checkInStr);
          break;
        case 'checkOut':
          valueA = parseTime(a.checkOutStr);
          valueB = parseTime(b.checkOutStr);
          break;
        case 'duration':
          valueA = parseDurationToMinutes(a.worked);
          valueB = parseDurationToMinutes(b.worked);
          break;
        default:
          return 0;
      }
      if (sortDirection === 'asc') {
        return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      } else {
        return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      }
    });
  };

  // Handle sort toggle
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Update sorted data when sortField or sortDirection changes
  useEffect(() => {
    if (attendanceData.length > 0) {
      setAttendanceData(sortData(attendanceData));
    }
  }, [sortField, sortDirection]);

  // Fetch attendance data using phone number
  const fetchAttendanceData = async () => {
    if (!userData?.phone) {
      setError('No phone number found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setAttendanceData([]);
    setEmployeeName(userData.name || '');
    setTotalHours('0h 0m');

    try {
      const userDocRef = doc(db, 'users_01', userData.phone);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        throw new Error('No user data found in Firestore.');
      }

      const attendanceCollection = collection(db, 'users_01', userData.phone, 'attendance');
      const attendanceSnapshots = await getDocs(attendanceCollection);

      let logs = [];
      for (const attendanceDoc of attendanceSnapshots.docs) {
        const yearMonth = attendanceDoc.id;
        const daysMap = attendanceDoc.data().days || {};

        Object.keys(daysMap).forEach((day) => {
          const dayData = daysMap[day];
          if (!dayData?.sessions?.length) return;

          dayData.sessions.forEach((session) => {
            const checkIn = session.checkIn && typeof session.checkIn.toDate === 'function'
              ? session.checkIn.toDate()
              : null;
            const checkOut = session.checkOut && typeof session.checkOut.toDate === 'function'
              ? session.checkOut.toDate()
              : null;

            if (startDate && endDate && checkIn) {
              const recordDate = new Date(checkIn);
              recordDate.setHours(0, 0, 0, 0);
              const start = new Date(startDate);
              start.setHours(0, 0, 0, 0);
              const end = new Date(endDate);
              end.setHours(23, 59, 59, 999);
              if (recordDate < start || recordDate > end) return;
            }

            logs.push({
              date: checkIn ? format(checkIn, 'dd-MMM-yyyy') : '',
              checkInStr: checkIn ? format(checkIn, 'HH:mm') : '',
              checkOutStr: checkOut ? format(checkOut, 'HH:mm') : '',
              worked: session.worked_hours || 'N/A',
              checkInEdited: session.checkInEdited || false,
              checkOutEdited: session.checkOutEdited || false,
            });
          });
        });
      }

      const sortedLogs = sortData(logs);
      setAttendanceData(sortedLogs);
      setTotalHours(calculateTotalHours(sortedLogs));
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setError(`Failed to load attendance: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle date range filter
  const handleDateFilter = () => {
    if (startDate && endDate && isBefore(new Date(endDate), new Date(startDate))) {
      setError('End date cannot be before start date.');
      return;
    }
    if (userData?.phone) {
      fetchAttendanceData();
    }
  };

  // Clear date filter
  const clearDateFilter = () => {
    setStartDate(null);
    setEndDate(null);
    if (userData?.phone) {
      fetchAttendanceData();
    }
  };

  // Fetch data when userData is set
  useEffect(() => {
    if (userData?.phone) {
      fetchAttendanceData();
    }
  }, [userData]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-gray-800">My Attendance</h1>
            {(isTeamLeader || isManager) && (
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm ml-4"
                onClick={() => navigate("/attendance")}
              >
                Back
              </button>
            )}
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="mb-6 p-4 bg-gray-50 rounded-md">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Filter by Date Range</h2>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : null)}
                className="p-2 border rounded-md text-sm bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)}
                className="p-2 border rounded-md text-sm bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDateFilter}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200"
                disabled={loading}
              >
                Apply Filter
              </button>
              <button
                onClick={clearDateFilter}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
                disabled={loading}
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Employee Name */}
        {employeeName && (
          <div className="mb-6 text-sm text-gray-700">
            Showing attendance for: <span className="font-medium">{employeeName}</span>
          </div>
        )}

        {/* Total Work Hours */}
        {attendanceData.length > 0 && (
          <div className="mb-6 p-4 bg-gray-50 rounded-md shadow-sm">
            <h2 className="text-sm font-medium text-gray-700">
              Total Work Hours: <span className="font-semibold">{totalHours}</span>
            </h2>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-700"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-1">
                      Date
                      {sortField === 'date' &&
                        (sortDirection === 'asc' ? <FiArrowUp /> : <FiArrowDown />)}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-700"
                    onClick={() => handleSort('checkIn')}
                  >
                    <div className="flex items-center gap-1">
                      Check In
                      {sortField === 'checkIn' &&
                        (sortDirection === 'asc' ? <FiArrowUp /> : <FiArrowDown />)}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-700"
                    onClick={() => handleSort('checkOut')}
                  >
                    <div className="flex items-center gap-1">
                      Check Out
                      {sortField === 'checkOut' &&
                        (sortDirection === 'asc' ? <FiArrowUp /> : <FiArrowDown />)}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-700"
                    onClick={() => handleSort('duration')}
                  >
                    <div className="flex items-center gap-1">
                      Duration
                      {sortField === 'duration' &&
                        (sortDirection === 'asc' ? <FiArrowUp /> : <FiArrowDown />)}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceData.map((record, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <span>{record.checkInStr || '--:--'}</span>
                        {record.checkInEdited && (
                          <span className="text-xs text-gray-400">(edited)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <span>{record.checkOutStr || '--:--'}</span>
                        {record.checkOutEdited && (
                          <span className="text-xs text-gray-400">(edited)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.worked}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {attendanceData.length === 0 && !error && !loading && (
              <div className="text-center py-6 text-gray-500 text-sm">
                No attendance records found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberAttendance;