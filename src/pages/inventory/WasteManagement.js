import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, setDoc, doc, updateDoc, increment } from 'firebase/firestore';
import WasteLogHistory from './WasteLogHistory';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'night';
};

const getEmployeeId = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    return user?.employeeID || 'NA';
  } catch (error) {
    return 'NA';
  }
};

const WasteManagement = () => {
  const [wasteItems, setWasteItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReasons, setSelectedReasons] = useState({});
  const [readyToAdjust, setReadyToAdjust] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [masterCheck, setMasterCheck] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showWasteLog, setShowWasteLog] = useState(false);

  const fetchItemsData = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'inventory'));
      const items = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            itemName: data.itemName || 'Unknown Item',
            unit: data.unit || '', // Fetch unit from Firebase
            boxes: '',
            innerPacks: '',
            units: '',
            innerPerBox: data.innerPerBox || 1,
            unitsPerInner: data.unitsPerInner || 1,
            totalStockOnHand: data.totalStockOnHand || 0,
          };
        })
      );
      setWasteItems(items);

      // Initialize states
      const initialReasons = {};
      const initialReadyToAdjust = {};
      items.forEach(item => {
        initialReasons[item.id] = '1 End of Night';
        initialReadyToAdjust[item.id] = false;
      });
      setSelectedReasons(initialReasons);
      setReadyToAdjust(initialReadyToAdjust);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching items data:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItemsData();
  }, []);

  const calculateWaste = (item) =>
    (item.boxes * item.innerPerBox * item.unitsPerInner) +
    (item.innerPacks * item.unitsPerInner) +
    (item.units || 0);

  const handleInputChange = (id, field, value) => {
    if (value !== '' && (isNaN(value) || Number(value) < 0)) return;

    const updatedItems = wasteItems.map(item =>
      item.id === id ? { ...item, [field]: value === '' ? '' : Number(value) } : item
    );
    setWasteItems(updatedItems);
  };

  const handleReasonChange = (id, reason) => {
    setSelectedReasons(prev => ({ ...prev, [id]: reason }));
  };

  const handleReadyToAdjustChange = (id) => {
    setReadyToAdjust(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleMasterCheck = () => {
    const newState = !masterCheck;
    setMasterCheck(newState);
    const updated = wasteItems.reduce((acc, item) => {
      const hasData = item.boxes !== '' || item.innerPacks !== '' || item.units !== '';
      acc[item.id] = newState && hasData;
      return acc;
    }, {});
    setReadyToAdjust(updated);
  };

  const handleSearch = (e) => setSearchQuery(e.target.value.toLowerCase());

  const filteredItems = wasteItems.filter(item =>
    item.itemName.toLowerCase().includes(searchQuery)
  );

  const applyWasteAdjustment = async () => {
    const itemsToAdjust = wasteItems.filter(item =>
      readyToAdjust[item.id] && (item.boxes !== '' || item.innerPacks !== '' || item.units !== '')
    );

    if (itemsToAdjust.length === 0) {
      setSuccessMessage('No items selected for waste adjustment');
      setShowSuccessModal(true);
      return;
    }

    const currentDate = new Date();
    const formattedDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;
    const formattedTime = `${currentDate.getHours().toString().padStart(2, '0')}-${currentDate.getMinutes().toString().padStart(2, '0')}-${currentDate.getSeconds().toString().padStart(2, '0')}`;
    const logId = `${formattedDate}_${formattedTime}`;
    const employeeID = getEmployeeId();

    try {
      // Create waste log document
      const wasteLogRef = doc(db, 'wasteLogs', logId);
      const totalWaste = itemsToAdjust.reduce((sum, item) => sum + calculateWaste(item), 0);

      await setDoc(wasteLogRef, {
        id: logId,
        timestamp: currentDate.toISOString(),
        totalWaste: totalWaste,
        date: formattedDate,
      });

      // Prepare write operations
      const wasteItemPromises = [];
      const inventoryUpdatePromises = [];
      const timeOfDay = getTimeOfDay();

      itemsToAdjust.forEach(item => {
        const totalWaste = calculateWaste(item);
        const wasteItemId = `${logId}_${item.id}`;
        const wasteItemRef = doc(db, `wasteLogs/${logId}/wasteItems`, wasteItemId);

        // Add waste item record
        wasteItemPromises.push(setDoc(wasteItemRef, {
          itemId: doc(db, `inventory/${item.id}`),
          itemName: item.itemName,
          unit: item.unit, // Include unit in waste log
          boxesCount: item.boxes || 0,
          innerCount: item.innerPacks || 0,
          unitsCount: item.units || 0,
          totalWaste: totalWaste,
          reason: selectedReasons[item.id],
          datePerformed: currentDate.toISOString(),
          timestamp: currentDate.toISOString(),
          timeOfDay: timeOfDay,
          employeeID: employeeID,
        }));

        // Update inventory stock
        const inventoryRef = doc(db, 'inventory', item.id);
        inventoryUpdatePromises.push(
          updateDoc(inventoryRef, {
            totalStockOnHand: increment(-totalWaste)
          })
        );
      });

      // Execute all database operations
      await Promise.all([...wasteItemPromises, ...inventoryUpdatePromises]);

      // Reset form
      const updatedItems = wasteItems.map(item => {
        if (readyToAdjust[item.id]) {
          return {
            ...item,
            boxes: '',
            innerPacks: '',
            units: '',
          };
        }
        return item;
      });

      // Reset ALL checkboxes
      const newReadyState = {};
      wasteItems.forEach(item => {
        newReadyState[item.id] = false;
      });
      // Update states
      setWasteItems(updatedItems);
      setReadyToAdjust(newReadyState);
      setMasterCheck(false);

      // Refresh data
      await fetchItemsData();

      setSuccessMessage(`Successfully recorded waste for ${itemsToAdjust.length} item(s)`);
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Error saving waste data:", error);
      setSuccessMessage('Error saving waste data. Please check the console.');
      setShowSuccessModal(true);
    }
  };

  if (showWasteLog) {
    return (
      <div className="flex-1 p-6 overflow-auto">
        <button
          onClick={() => setShowWasteLog(false)}
          className="bg-gray-500 text-white px-4 py-2 rounded shadow hover:bg-gray-600 mb-4"
        >
          Back to Waste Management
        </button>
        <WasteLogHistory />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-auto">
      <h1 className="text-2xl font-bold mb-6">Waste Management</h1>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="font-semibold">Search Item:</label>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Item name..."
            className="border rounded p-2"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={masterCheck}
            onChange={handleMasterCheck}
            className="p-2"
          />
          <label>Tick All</label>
        </div>

        <button
          onClick={applyWasteAdjustment}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
        >
          Apply
        </button>

        <button
          onClick={() => setShowWasteLog(true)}
          className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700"
        >
          Waste Log
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-3 text-left">Item</th>
              <th className="p-3 text-left">Unit</th>
              <th className="p-3 text-left">Adjust "Box"</th>
              <th className="p-3 text-left">Adjust "Inner"</th>
              <th className="p-3 text-left">Adjust "Unit"</th>
              <th className="p-3 text-left">Reason</th>
              <th className="p-3 text-left">Ready To Adjust</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTheme baseColor="#e5e7eb" highlightColor="#f3f4f6">
                {[...Array(5)].map((_, index) => (
                  <tr key={index}>
                    <td className="p-3"><Skeleton width={150} height={20} /></td>
                    <td className="p-3"><Skeleton width={50} height={20} /></td>
                    <td className="p-3"><Skeleton width={80} height={20} /></td>
                    <td className="p-3"><Skeleton width={80} height={20} /></td>
                    <td className="p-3"><Skeleton width={80} height={20} /></td>
                    <td className="p-3"><Skeleton width={120} height={20} /></td>
                    <td className="p-3"><Skeleton width={20} height={20} /></td>
                  </tr>
                ))}
              </SkeletonTheme>
            ) : (
              filteredItems.map(item => (
                <tr key={item.id}>
                  <td className="p-3">{item.itemName}</td>
                  <td className="p-3">{item.unit || 'N/A'}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      value={item.boxes}
                      onChange={(e) => handleInputChange(item.id, 'boxes', e.target.value)}
                      className="border rounded p-2 w-20"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      value={item.innerPacks}
                      onChange={(e) => handleInputChange(item.id, 'innerPacks', e.target.value)}
                      className="border rounded p-2 w-20"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      value={item.units}
                      onChange={(e) => handleInputChange(item.id, 'units', e.target.value)}
                      className="border rounded p-2 w-20"
                    />
                  </td>
                  <td className="p-3">
                    <select
                      value={selectedReasons[item.id]}
                      onChange={(e) => handleReasonChange(item.id, e.target.value)}
                      className="border rounded p-2"
                    >
                      <option value="1 End of Night">1 End of Night</option>
                      <option value="2.Food Donation">2.Food Donation</option>
                      <option value="3 Customer Complaint">3 Customer Complaint</option>
                      <option value="4 Damaged Stock">4 Damaged Stock</option>
                      <option value="5 HACCP">5 HACCP</option>
                      <option value="6 Out of Date">6 Out of Date</option>
                      <option value="7 Expired">7 Expired</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={readyToAdjust[item.id]}
                      onChange={() => handleReadyToAdjustChange(item.id)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Waste Adjustment</h3>
            <p className="mb-4">{successMessage}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowSuccessModal(false)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WasteManagement;