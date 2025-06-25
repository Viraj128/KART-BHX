import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { 
  FaSun, 
  FaCloudSun, 
  FaMoon, 
  FaRegMoon, 
  FaClock,
  FaBoxOpen,
  FaBalanceScale,
  FaCheckCircle,
  FaExclamationTriangle,
} from 'react-icons/fa';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const getTimeOfDayIcon = (timeOfDay) => {
  switch (timeOfDay.toLowerCase()) {
    case 'morning':
      return <FaSun className="text-yellow-500" />;
    case 'afternoon':
      return <FaCloudSun className="text-orange-500" />;
    case 'evening':
      return <FaMoon className="text-blue-500" />;
    case 'night':
      return <FaRegMoon className="text-indigo-500" />;
    default:
      return <FaClock className="text-gray-500" />;
  }
};

const StockCountLog = () => {
  const [logs, setLogs] = useState([]);
  const [expandedLogIds, setExpandedLogIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const logsSnapshot = await getDocs(collection(db, 'inventoryLog'));

        const logPromises = logsSnapshot.docs.map(async (doc) => {
          const logData = doc.data();
          const itemsRef = collection(db, `inventoryLog/${doc.id}/items`);
          const itemsSnapshot = await getDocs(itemsRef);

          return {
            id: doc.id,
            date: logData.date || doc.id.split('_')[0],
            timestamp: logData.timestamp,
            totalVariance: logData.totalVariance || 0,
            status: logData.status || 'pending',
            countType: logData.countType || 'initial',
            items: itemsSnapshot.docs.map((itemDoc) => ({
              id: itemDoc.id,
              itemId: itemDoc.data().itemId,
              itemName: itemDoc.data().itemName || 'Unknown Item',
              boxes: itemDoc.data().boxesCount || 0,
              inners: itemDoc.data().innerCount || 0,
              units: itemDoc.data().unitsCount || 0,
              totalCounted: itemDoc.data().totalCounted || 0,
              variance: itemDoc.data().variance || 0,
              previousStock: itemDoc.data().previousStock || 0,
              newStock: itemDoc.data().newStock || 0,
              status: itemDoc.data().status || 'recorded',
              timeOfDay: itemDoc.data().timeOfDay || 'unknown',
            })),
          };
        });

        const logsData = await Promise.all(logPromises);
        const filteredLogs = selectedDate
          ? logsData.filter((log) => log.date === selectedDate)
          : logsData;

        filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        setLogs(filteredLogs);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching logs:", err);
        setError('Failed to load inventory logs');
        setLoading(false);
      }
    };

    fetchLogs();
  }, [selectedDate]);

  const toggleLogExpand = (logId) => {
    const newSet = new Set(expandedLogIds);
    newSet.has(logId) ? newSet.delete(logId) : newSet.add(logId);
    setExpandedLogIds(newSet);
  };

  const formatTimestamp = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleString('en', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const formatDateTime = (date, timestamp) => {
    try {
      const datePart = date.replace(/-/g, '/'); // Keep YYYY/MM/DD format
      const timePart = new Date(timestamp).toLocaleTimeString('en', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return `${datePart} ${timePart}`;
    } catch {
      return `${date.replace(/-/g, '/')} Unknown Time`;
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <SkeletonTheme baseColor="#e5e7eb" highlightColor="#f3f4f6">
          {/* Filter Section Skeleton */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <Skeleton width={200} height={28} />
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Skeleton width={150} height={40} />
              <Skeleton width={80} height={40} />
            </div>
          </div>
          {/* Log Entries Skeleton */}
          <div className="space-y-4">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm border">
                <div className="p-4 flex justify-between items-center">
                  <div>
                    <Skeleton width={150} height={20} />
                    <Skeleton width={100} height={16} className="mt-2" />
                  </div>
                  <Skeleton width={20} height={20} />
                </div>
                <div className="border-t p-4 bg-gray-50/50">
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="min-w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          {[...Array(8)].map((_, i) => (
                            <th key={i} className="px-4 py-3">
                              <Skeleton width={80} height={16} />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...Array(2)].map((_, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-4 py-3"><Skeleton width={150} height={16} /></td>
                            <td className="px-4 py-3"><Skeleton width={100} height={16} /></td>
                            <td className="px-4 py-3"><Skeleton width={50} height={16} /></td>
                            <td className="px-4 py-3"><Skeleton width={50} height={16} /></td>
                            <td className="px-4 py-3"><Skeleton width={50} height={16} /></td>
                            <td className="px-4 py-3"><Skeleton width={50} height={16} /></td>
                            <td className="px-4 py-3"><Skeleton width={50} height={16} /></td>
                            <td className="px-4 py-3"><Skeleton width={100} height={16} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SkeletonTheme>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FaBoxOpen className="text-blue-500" />
          Stock Count History
        </h1>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border rounded-lg p-2 w-full sm:w-48 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={() => setSelectedDate('')}
            className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            disabled={!selectedDate}
          >
            Clear
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
      ) : logs.length === 0 ? (
        <div className="p-4 bg-gray-50 text-gray-600 rounded-lg text-center">
          No logs found{selectedDate && ` for ${selectedDate}`}
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="bg-white rounded-xl shadow-sm border">
              <div
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleLogExpand(log.id)}
              >
                <div>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <FaClock className="text-gray-500" />
                    {formatDateTime(log.date, log.timestamp)}
                  </h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <FaBalanceScale className="text-gray-500" />
                      Variance:
                      <span
                        className={`ml-1 ${
                          log.totalVariance !== 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {log.totalVariance > 0 ? '+' : ''}{log.totalVariance}
                      </span>
                    </span>
                  </div>
                </div>
                <span className="text-gray-500 text-xl">
                  {expandedLogIds.has(log.id) ? '▼' : '▶'}
                </span>
              </div>

              {expandedLogIds.has(log.id) && (
                <div className="border-t p-4 bg-gray-50/50">
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="min-w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left">Item</th>
                          <th className="px-4 py-3 text-left">Time of Day</th>
                          <th className="px-4 py-3 text-left">Boxes</th>
                          <th className="px-4 py-3 text-left">Inners</th>
                          <th className="px-4 py-3 text-left">Units</th>
                          <th className="px-4 py-3 text-left">Total</th>
                          <th className="px-4 py-3 text-left">Variance</th>
                          <th className="px-4 py-3 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {log.items.map((item) => (
                          <tr
                            key={item.id}
                            className="border-t even:bg-gray-50 hover:bg-gray-50"
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium">{item.itemName}</div>
                              <div className="text-sm text-gray-500">
                                ID: {item.itemId}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {getTimeOfDayIcon(item.timeOfDay)}
                                <span className="capitalize">{item.timeOfDay}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">{item.boxes}</td>
                            <td className="px-4 py-3">{item.inners}</td>
                            <td className="px-4 py-3">{item.units}</td>
                            <td className="px-4 py-3 font-medium">
                              {item.totalCounted}
                            </td>
                            <td
                              className={`px-4 py-3 font-medium ${
                                item.variance !== 0
                                  ? 'text-red-600'
                                  : 'text-green-600'
                              }`}
                            >
                              {item.variance > 0 ? '+' : ''}{item.variance}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  item.status.includes('variance')
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-green-100 text-green-800'
                                }`}
                              >
                                {item.status.includes('variance') ? (
                                  <FaExclamationTriangle className="text-orange-500" />
                                ) : (
                                  <FaCheckCircle className="text-green-500" />
                                )}
                                {item.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StockCountLog;