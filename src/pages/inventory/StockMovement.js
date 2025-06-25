import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import {
  FaSun,
  FaCloudSun,
  FaRegMoon,
  FaClock,
  FaExclamationTriangle,
  FaCheckCircle,
  FaBoxOpen,
  FaTrashAlt,
  FaBalanceScale,
} from 'react-icons/fa';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

// Updated getTimeOfDayIcon to exclude "evening"
const getTimeOfDayIcon = (timeOfDay) => {
  switch (timeOfDay?.toLowerCase()) {
    case 'morning':
      return <FaSun className="text-yellow-500 text-lg" />;
    case 'afternoon':
      return <FaCloudSun className="text-orange-500 text-lg" />;
    case 'night':
      return <FaRegMoon className="text-indigo-500 text-lg" />;
    default:
      return <FaClock className="text-gray-500 text-lg" />;
  }
};

const InventoryAndWasteHistory = () => {
  const [groupedLogs, setGroupedLogs] = useState({});
  const [expandedDates, setExpandedDates] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('all');

  // Helper to fetch inventory logs
  const fetchInventoryLogs = useCallback(async () => {
    const inventorySnapshot = await getDocs(collection(db, 'inventoryLog'));
    return Promise.all(
      inventorySnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const itemsRef = collection(db, `inventoryLog/${doc.id}/items`);
        const itemsSnapshot = await getDocs(itemsRef);

        const itemsData = itemsSnapshot.docs.map((itemDoc) => ({
          id: itemDoc.id,
          itemId: itemDoc.data().itemId || 'N/A',
          itemName: itemDoc.data().itemName || 'Unknown Item',
          boxes: itemDoc.data().boxesCount || 0,
          inners: itemDoc.data().innerCount || 0,
          units: itemDoc.data().unitsCount || 0,
          totalCounted: itemDoc.data().totalCounted || 0,
          variance: itemDoc.data().variance || 0,
          status: itemDoc.data().status || 'recorded',
          timeOfDay: itemDoc.data().timeOfDay || 'unknown',
        }));

        return {
          id: doc.id,
          type: 'inventory',
          date: data.date || doc.id.split('_')[0] || 'Unknown Date',
          timestamp: data.timestamp || new Date().toISOString(),
          totalVariance: data.totalVariance || 0,
          status: data.status || 'pending',
          countType: data.countType || 'initial',
          items: itemsData,
        };
      })
    );
  }, []);

  // Helper to fetch waste logs
  const fetchWasteLogs = useCallback(async () => {
    const wasteSnapshot = await getDocs(collection(db, 'wasteLogs'));
    return Promise.all(
      wasteSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const wasteItemsRef = collection(db, `wasteLogs/${doc.id}/wasteItems`);
        const itemsSnapshot = await getDocs(wasteItemsRef);

        const itemsData = itemsSnapshot.docs.map((itemDoc) => {
          const itemData = itemDoc.data();
          let cleanItemId = 'N/A';
          if (itemData.itemId) {
            try {
              cleanItemId =
                typeof itemData.itemId === 'string'
                  ? itemData.itemId.split('/').pop()
                  : itemData.itemId?.path?.split('/').pop() || 'N/A';
            } catch {
              cleanItemId = 'N/A';
            }
          }

          return {
            id: itemDoc.id,
            itemName: itemData.itemName || 'Unknown Item',
            itemId: cleanItemId,
            boxesCount: itemData.boxesCount || 0,
            innerCount: itemData.innerCount || 0,
            unitsCount: itemData.unitsCount || 0,
            totalWaste: itemData.totalWaste || 0,
            reason: itemData.reason || 'N/A',
            timeOfDay: itemData.timeOfDay || 'unknown',
          };
        });

        return {
          id: doc.id,
          type: 'waste',
          date: data.date || doc.id.split('_')[0] || 'Unknown Date',
          timestamp: data.timestamp || new Date().toISOString(),
          totalWaste: data.totalWaste || 0,
          timeOfDay: data.timeOfDay || 'unknown',
          wasteItems: itemsData,
        };
      })
    );
  }, []);

  // Fetch and group logs
  useEffect(() => {
    const fetchAllLogs = async () => {
      try {
        setLoading(true);
        setError(null);

        const [inventoryLogs, wasteLogs] = await Promise.all([
          fetchInventoryLogs(),
          fetchWasteLogs(),
        ]);

        const grouped = {};
        [...inventoryLogs, ...wasteLogs]
          .filter((log) => !selectedDate || log.date === selectedDate)
          .forEach((log) => {
            const logDate = log.date;
            if (!grouped[logDate]) {
              grouped[logDate] = {
                date: logDate,
                timestamp: log.timestamp,
                inventoryLogs: [],
                wasteLogs: [],
              };
            }

            if (log.type === 'inventory') {
              grouped[logDate].inventoryLogs.push(log);
            } else {
              grouped[logDate].wasteLogs.push(log);
            }
          });

        const sortedDates = Object.values(grouped).sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        );

        const sortedGrouped = {};
        sortedDates.forEach((dateGroup) => {
          sortedGrouped[dateGroup.date] = dateGroup;
        });

        setGroupedLogs(sortedGrouped);
      } catch (err) {
        console.error('Error loading logs:', err);
        setError('Failed to load inventory or waste logs. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchAllLogs();
  }, [selectedDate, selectedTime, fetchInventoryLogs, fetchWasteLogs]);

  // Helper functions
  const handleDateExpand = useCallback((date) => {
    setExpandedDates((prev) => {
      const newSet = new Set(prev);
      newSet.has(date) ? newSet.delete(date) : newSet.add(date);
      return newSet;
    });
  }, []);

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString || 'Unknown Date';
    }
  };

  const formatTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return 'Unknown Time';
    }
  };

  const formatVariance = (variance) => {
    const isPositive = variance > 0;
    const isNegative = variance < 0;
    return (
      <span
        className="flex items-center gap-1 font-medium text-red-600"
        aria-label={`Variance: ${variance}`}
      >
        {isNegative && <FaExclamationTriangle className="text-red-500" />}
        {isPositive && <FaCheckCircle className="text-red-500" />}
        {variance > 0 ? '+' : ''}{variance}
      </span>
    );
  };

  const formatReason = (reason, timeOfDay) => {
    const truncatedReason = reason.length > 50 ? `${reason.slice(0, 47)}...` : reason;
    return (
      <span className="flex items-center gap-1" aria-label={`Reason: ${reason}`}>
        {getTimeOfDayIcon(timeOfDay)}
        <span className="capitalize">{truncatedReason}</span>
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <SkeletonTheme baseColor="#e5e7eb" highlightColor="#f3f4f6">
          {/* Filter Section Skeleton */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <Skeleton width={200} height={28} />
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="flex gap-2">
                <Skeleton width={150} height={40} />
                <Skeleton width={120} height={40} />
              </div>
              <Skeleton width={100} height={40} />
            </div>
          </div>
          {/* Log Sections Skeleton */}
          {[...Array(3)].map((_, index) => (
            <div key={index} className="bg-white rounded-lg border shadow-sm">
              <div className="p-4 flex justify-between items-center">
                <div>
                  <Skeleton width={150} height={20} />
                  <Skeleton width={100} height={16} className="mt-2" />
                </div>
                <Skeleton width={20} height={20} />
              </div>
              <div className="border-t p-4 space-y-6">
                {/* Waste Log Skeleton */}
                <div>
                  <Skeleton width={120} height={24} className="mb-4" />
                  <div className="mb-6">
                    <Skeleton width={200} height={16} className="mb-2" />
                    <table className="w-full table-auto">
                      <thead>
                        <tr className="bg-gray-50">
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
                            <td className="p-3"><Skeleton width={100} height={16} /></td>
                            <td className="p-3"><Skeleton width={50} height={16} /></td>
                            <td className="p-3"><Skeleton width={50} height={16} /></td>
                            <td className="p-3"><Skeleton width={50} height={16} /></td>
                            <td className="p-3"><Skeleton width={50} height={16} /></td>
                            <td className="p-3"><Skeleton width={120} height={16} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* Inventory Log Skeleton */}
                <div>
                  <Skeleton width={120} height={24} className="mb-4" />
                  <div className="mb-6">
                    <Skeleton width={200} height={16} className="mb-2" />
                    <table className="w-full table-auto">
                      <thead>
                        <tr className="bg-gray-50">
                          {[...Array(8)].map((_, i) => (
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
                            <td className="p-3"><Skeleton width={100} height={16} /></td>
                            <td className="p-3"><Skeleton width={50} height={16} /></td>
                            <td className="p-3"><Skeleton width={50} height={16} /></td>
                            <td className="p-3"><Skeleton width={50} height={16} /></td>
                            <td className="p-3"><Skeleton width={50} height={16} /></td>
                            <td className="p-3"><Skeleton width={50} height={16} /></td>
                            <td className="p-3"><Skeleton width={100} height={16} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </SkeletonTheme>
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-center text-red-600">{error}</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Inventory & Waste History</h1>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="flex gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border rounded-lg p-2 w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Select date"
            />
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="border rounded-lg p-2 w-full sm:w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Select time of day"
            >
              <option value="all">All Times</option>
              <option value="morning">🌅 Morning</option>
              <option value="afternoon">🌆 Afternoon</option>
              <option value="night">🌃 Night</option>
            </select>
          </div>
          <button
            onClick={() => {
              setSelectedDate('');
              setSelectedTime('all');
            }}
            className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-6">
        {Object.keys(groupedLogs).length > 0 ? (
          Object.keys(groupedLogs).map((date) => {
            const dateGroup = groupedLogs[date];
            const totalWaste = dateGroup.wasteLogs.reduce((sum, log) => sum + (log.totalWaste || 0), 0);
            const totalVariance = dateGroup.inventoryLogs.reduce(
              (sum, log) => sum + (log.totalVariance || 0),
              0
            );

            return (
              <div key={date} className="bg-white rounded-lg border shadow-sm">
                {/* Date Header */}
                <div
                  className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                  onClick={() => handleDateExpand(date)}
                  role="button"
                  aria-expanded={expandedDates.has(date)}
                  aria-label={`Toggle logs for ${formatDate(date)}`}
                >
                  <div>
                    <h3 className="font-semibold text-gray-800">{formatDate(date)}</h3>
                    <div className="flex gap-4 mt-1 text-sm">
                      {totalWaste !== 0 && (
                        <span className="text-red-600">Waste: {totalWaste}</span>
                      )}
                      {totalVariance !== 0 && (
                        <span className="text-red-600">Variance: {totalVariance}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-gray-500">{expandedDates.has(date) ? '▼' : '▶'}</span>
                </div>

                {expandedDates.has(date) && (
                  <div className="border-t p-4 space-y-6">
                    {/* Waste Logs Section */}
                    {dateGroup.wasteLogs
                      .filter((log) =>
                        selectedTime === 'all' ||
                        log.wasteItems.some((item) => item.timeOfDay === selectedTime)
                      )
                      .length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-4">Waste Count: -</h4>
                        {dateGroup.wasteLogs
                          .filter((log) =>
                            selectedTime === 'all' ||
                            log.wasteItems.some((item) => item.timeOfDay === selectedTime)
                          )
                          .map((log) => (
                            <div key={log.id} className="mb-6">
                              <div className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                                <FaClock className="text-gray-500" />
                                {formatTime(log.timestamp)}
                                <FaTrashAlt className="text-red-500" />
                                <span>Total Waste: {log.totalWaste}</span>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full table-auto">
                                  <thead>
                                    <tr className="bg-gray-50">
                                      <th className="p-3 text-left text-sm font-semibold">Item</th>
                                      <th className="p-3 text-left text-sm font-semibold">Time</th>
                                      <th className="p-3 text-left text-sm font-semibold">Boxes</th>
                                      <th className="p-3 text-left text-sm font-semibold">Inners</th>
                                      <th className="p-3 text-left text-sm font-semibold">Units</th>
                                      <th className="p-3 text-left text-sm font-semibold">Total</th>
                                      <th className="p-3 text-left text-sm font-semibold">Reason</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {log.wasteItems
                                      .filter(
                                        (item) => selectedTime === 'all' || item.timeOfDay === selectedTime
                                      )
                                      .map((item) => (
                                        <tr key={item.id} className="border-t hover:bg-gray-50">
                                          <td className="p-3">
                                            <div className="font-medium">{item.itemName}</div>
                                            <div className="text-xs text-gray-500">ID: {item.itemId}</div>
                                          </td>
                                          <td className="p-3">
                                            <div className="flex items-center gap-1">
                                              {getTimeOfDayIcon(item.timeOfDay)}
                                              <span className="capitalize">{item.timeOfDay}</span>
                                            </div>
                                          </td>
                                          <td className="p-3">{item.boxesCount}</td>
                                          <td className="p-3">{item.innerCount}</td>
                                          <td className="p-3">{item.unitsCount}</td>
                                          <td className="p-3 font-medium">{item.totalWaste}</td>
                                          <td className="p-3">
                                            {formatReason(item.reason, item.timeOfDay)}
                                          </td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Inventory Logs Section */}
                    {dateGroup.inventoryLogs
                      .filter((log) =>
                        selectedTime === 'all' ||
                        log.items.some((item) => item.timeOfDay === selectedTime)
                      )
                      .length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-4">Stock Count Log: -</h4>
                        {dateGroup.inventoryLogs
                          .filter((log) =>
                            selectedTime === 'all' ||
                            log.items.some((item) => item.timeOfDay === selectedTime)
                          )
                          .map((log) => (
                            <div key={log.id} className="mb-6">
                              <div className="text-sm text-gray-600 mb-2 flex items-center gap-3">
                                <FaClock className="text-gray-500" />
                                {formatTime(log.timestamp)}
                                <FaBoxOpen className="text-blue-500" />
                                <span>Type: {log.countType}</span>
                                <FaBalanceScale className="text-green-500" />
                                <span className="text-red-600">
                                  Variance: {log.totalVariance}
                                </span>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full table-auto">
                                  <thead>
                                    <tr className="bg-gray-50">
                                      <th className="p-3 text-left text-sm font-semibold">Item</th>
                                      <th className="p-3 text-left text-sm font-semibold">Time</th>
                                      <th className="p-3 text-left text-sm font-semibold">Boxes</th>
                                      <th className="p-3 text-left text-sm font-semibold">Inners</th>
                                      <th className="p-3 text-left text-sm font-semibold">Units</th>
                                      <th className="p-3 text-left text-sm font-semibold">Counted</th>
                                      <th className="p-3 text-left text-sm font-semibold">Variance</th>
                                      <th className="p-3 text-left text-sm font-semibold">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {log.items
                                      .filter(
                                        (item) => selectedTime === 'all' || item.timeOfDay === selectedTime
                                      )
                                      .map((item) => (
                                        <tr key={item.id} className="border-t hover:bg-gray-50">
                                          <td className="p-3">
                                            <div className="font-medium">{item.itemName}</div>
                                            <div className="text-xs text-gray-500">ID: {item.itemId}</div>
                                          </td>
                                          <td className="p-3">
                                            <div className="flex items-center gap-1">
                                              {getTimeOfDayIcon(item.timeOfDay)}
                                              <span className="capitalize">{item.timeOfDay}</span>
                                            </div>
                                          </td>
                                          <td className="p-3">{item.boxes}</td>
                                          <td className="p-3">{item.inners}</td>
                                          <td className="p-3">{item.units}</td>
                                          <td className="p-3">{item.totalCounted}</td>
                                          <td className="p-3">{formatVariance(item.variance)}</td>
                                          <td className="p-3">
                                            <span className="flex items-center gap-1">
                                              {item.status === 'recorded' ? (
                                                <FaCheckCircle className="text-green-500" />
                                              ) : (
                                                <FaExclamationTriangle className="text-orange-500" />
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
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center text-gray-600">No logs found for the selected filters.</div>
        )}
      </div>
    </div>
  );
};

export default InventoryAndWasteHistory;