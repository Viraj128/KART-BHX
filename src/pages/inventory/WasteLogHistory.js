import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import {
  FaClock,
  FaSun,
  FaCloudSun,
  FaRegMoon,
  FaCalendarAlt,
  FaFilter,
  FaListAlt,
  FaRegClock,
  FaDonate,
  FaUserSlash,
  FaExclamationTriangle,
  FaBoxOpen,
  FaTrashAlt,
} from 'react-icons/fa';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const WasteLogHistory = () => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const logsSnapshot = await getDocs(collection(db, 'wasteLogs'));
        const logsData = await Promise.all(
          logsSnapshot.docs.map(async (doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              timestamp: data.timestamp,
              totalWaste: data.totalWaste,
              wasteItems: [],
            };
          })
        );

        const sortedLogs = logsData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setLogs(sortedLogs);
        setFilteredLogs(sortedLogs);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching waste logs:", error);
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  useEffect(() => {
    if (!filterDate) {
      setFilteredLogs(logs);
      return;
    }

    const filtered = logs.filter((log) => {
      const logDate = new Date(log.timestamp).toISOString().split('T')[0];
      return logDate === filterDate;
    });

    setFilteredLogs(filtered);
  }, [filterDate, logs]);

  const getTimeOfDayIcon = (timeOfDay) => {
    switch (timeOfDay.toLowerCase()) {
      case 'morning':
        return <FaSun className="text-yellow-500 text-lg" title="Morning" />;
      case 'afternoon':
        return <FaCloudSun className="text-orange-500 text-lg" title="Afternoon" />;
      case 'night':
        return <FaRegMoon className="text-indigo-500 text-lg" title="Night" />;
      default:
        return <FaClock className="text-gray-500 text-lg" />;
    }
  };

  const getReasonIcon = (reasonCode) => {
    switch (reasonCode) {
      case '1':
        return <FaRegClock className="text-blue-500" title="End of Night" />;
      case '2':
        return <FaDonate className="text-green-500" title="Food Donation" />;
      case '3':
        return <FaUserSlash className="text-red-500" title="Customer Complaint" />;
      case '4':
        return <FaExclamationTriangle className="text-amber-600" title="Damaged Stock" />;
      case '5':
        return <FaBoxOpen className="text-purple-500" title="HACCP" />;
      case '6':
        return <FaTrashAlt className="text-gray-600" title="Out of Date" />;
      case '7':
        return <FaTrashAlt className="text-gray-800" title="Expired" />;
      default:
        return <FaClock className="text-gray-500" />;
    }
  };

  const handleLogExpand = async (logId) => {
    if (expandedLogId === logId) {
      setExpandedLogId(null);
      return;
    }

    setExpandedLogId(logId);

    try {
      const wasteItemsRef = collection(db, `wasteLogs/${logId}/wasteItems`);
      const itemsSnapshot = await getDocs(wasteItemsRef);

      const itemsData = itemsSnapshot.docs.map((itemDoc) => {
        const itemData = itemDoc.data();
        const reasonParts = itemData.reason?.split(' ') || [];
        const reasonCode = reasonParts[0].replace('.', '');
        const reasonText = reasonParts.slice(1).join(' ');

        return {
          id: itemDoc.id,
          itemName: itemData.itemName || 'N/A',
          boxesCount: itemData.boxesCount || 0,
          innerCount: itemData.innerCount || 0,
          unitsCount: itemData.unitsCount || 0,
          totalWaste: itemData.totalWaste || 0,
          reasonCode,
          reasonText,
          timeOfDay: itemData.timeOfDay || 'N/A',
        };
      });

      setFilteredLogs((prevLogs) =>
        prevLogs.map((log) =>
          log.id === logId ? { ...log, wasteItems: itemsData } : log
        )
      );
    } catch (error) {
      console.error("Error fetching waste items:", error);
    }
  };

  const clearFilters = () => setFilterDate('');

  if (loading) {
    return (
      <div className="p-6">
        <SkeletonTheme baseColor="#e5e7eb" highlightColor="#f3f4f6">
          {/* Filter Section Skeleton */}
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <Skeleton width={200} height={28} className="mb-4" />
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1">
                <Skeleton width={120} height={16} className="mb-2" />
                <div className="flex items-center gap-2">
                  <Skeleton width={150} height={40} />
                  <Skeleton width={80} height={40} />
                </div>
              </div>
            </div>
          </div>
          {/* Log Entries Skeleton */}
          <div className="space-y-4">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="bg-white rounded-lg shadow">
                <div className="p-4 flex justify-between items-center">
                  <div>
                    <Skeleton width={150} height={20} />
                    <Skeleton width={100} height={16} className="mt-2" />
                  </div>
                  <Skeleton width={20} height={20} />
                </div>
                <div className="border-t p-4 bg-gray-50">
                  <Skeleton width={120} height={20} className="mb-4" />
                  <table className="min-w-full bg-white rounded shadow">
                    <thead className="bg-gray-100">
                      <tr>
                        {[...Array(7)].map((_, i) => (
                          <th key={i} className="p-3">
                            <Skeleton width={80} height={16} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...Array(2)].map((_, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-3"><Skeleton width={150} height={16} /></td>
                          <td className="p-3"><Skeleton width={50} height={16} /></td>
                          <td className="p-3"><Skeleton width={50} height={16} /></td>
                          <td className="p-3"><Skeleton width={50} height={16} /></td>
                          <td className="p-3"><Skeleton width={50} height={16} /></td>
                          <td className="p-3"><Skeleton width={100} height={16} /></td>
                          <td className="p-3"><Skeleton width={120} height={16} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </SkeletonTheme>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-3">
        <FaCalendarAlt className="text-blue-500 text-xl" />
        Waste Log History
      </h1>

      {/* Filter Section */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <FaFilter className="text-gray-500" />
              Filter by Date
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="p-2 border rounded w-full max-w-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 flex items-center gap-2 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Log List */}
      <div className="space-y-4">
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 text-center p-4 bg-white rounded-lg shadow">
            {logs.length === 0 ? 'No waste logs found.' : 'No logs found for the selected date.'}
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="bg-white rounded-lg shadow">
              <div
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleLogExpand(log.id)}
              >
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <FaClock className="text-gray-500" />
                    {new Date(log.timestamp).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </h3>
                  <div className="flex gap-4 mt-1 text-sm text-gray-600 items-center">
                    <span className="flex items-center gap-1">
                      Total Waste: <strong>{log.totalWaste}</strong>
                    </span>
                    <span
                      className={`flex items-center gap-1 font-medium ${
                        log.totalWaste !== 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    ></span>
                  </div>
                </div>
                <span className="text-xl text-gray-500">
                  {expandedLogId === log.id ? '▼' : '▶'}
                </span>
              </div>

              {expandedLogId === log.id && (
                <div className="border-t p-4 bg-gray-50">
                  <h4 className="font-medium mb-4 flex items-center gap-2 text-gray-700">
                    <FaListAlt className="text-gray-500" />
                    Waste Items
                  </h4>

                  {log.wasteItems.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-white rounded shadow">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="p-3 text-left">Item</th>
                            <th className="p-3 text-left">Boxes</th>
                            <th className="p-3 text-left">Inner</th>
                            <th className="p-3 text-left">Units</th>
                            <th className="p-3 text-left">Total</th>
                            <th className="p-3 text-left">Time</th>
                            <th className="p-3 text-left">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {log.wasteItems.map((item) => (
                            <tr
                              key={item.id}
                              className="border-t hover:bg-gray-50 transition-colors"
                            >
                              <td className="p-3 font-medium">{item.itemName}</td>
                              <td className="p-3">{item.boxesCount}</td>
                              <td className="p-3">{item.innerCount}</td>
                              <td className="p-3">{item.unitsCount}</td>
                              <td className="p-3 font-semibold text-red-600">
                                {item.totalWaste}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  {getTimeOfDayIcon(item.timeOfDay)}
                                  <span className="capitalize">{item.timeOfDay}</span>
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  {getReasonIcon(item.reasonCode)}
                                  <span>{item.reasonText}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-center p-4">
                      No waste items found for this log.
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default WasteLogHistory;