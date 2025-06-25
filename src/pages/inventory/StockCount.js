import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import InventoryManagement from './InventoryManagement ';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const StockCount = () => {
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [appliedCounts, setAppliedCounts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [masterCheck, setMasterCheck] = useState(false);
  const [showVarianceModal, setShowVarianceModal] = useState(false);
  const [pendingVarianceItems, setPendingVarianceItems] = useState([]);
  const [submittedItems, setSubmittedItems] = useState({});
  const [itemsToHighlight, setItemsToHighlight] = useState([]);
  const [variances, setVariances] = useState({});
  const [showRecountVariances, setShowRecountVariances] = useState([]);
  const [showStockCountLog, setShowStockCountLog] = useState(false);

  useEffect(() => {
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
        setInventoryItems(items);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching items data:", error);
        setLoading(false);
      }
    };
    fetchItemsData();
  }, []);

  const calculateStock = (item) =>
    (item.boxes * item.innerPerBox * item.unitsPerInner) +
    (item.innerPacks * item.unitsPerInner) +
    item.units;

  const handleInputChange = (id, field, value) => {
    if (value !== '' && (isNaN(value) || Number(value) < 0)) return;

    const updatedItems = inventoryItems.map(item =>
      item.id === id ? { ...item, [field]: value === '' ? '' : Number(value) } : item
    );
    setInventoryItems(updatedItems);
    setShowRecountVariances(prev => prev.filter(itemId => itemId !== id));
  };

  const handleTickChange = (id) => {
    setAppliedCounts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleMasterCheck = () => {
    const newState = !masterCheck;
    setMasterCheck(newState);
    const updated = inventoryItems.reduce((acc, item) => {
      const hasData = item.boxes !== '' || item.innerPacks !== '' || item.units !== '';
      acc[item.id] = newState && hasData;
      return acc;
    }, {});
    setAppliedCounts(updated);
  };

  const saveItems = async (items, override = false) => {
    // Filter items to only include those with non-zero variance
    const itemsWithVariance = items.filter(item => {
      const totalUnits = calculateStock(item);
      const variance = totalUnits - item.totalStockOnHand;
      return variance !== 0;
    });

    // If no items have non-zero variance, mark all items as submitted and return
    if (itemsWithVariance.length === 0) {
      const newSubmitted = items.reduce((acc, item) => {
        acc[item.id] = true;
        return acc;
      }, {});
      setSubmittedItems(prev => ({ ...prev, ...newSubmitted }));
      setAppliedCounts(prev => {
        const newApplied = { ...prev };
        items.forEach(item => {
          newApplied[item.id] = false;
        });
        return newApplied;
      });
      alert("No items with variance to save. Items marked as submitted.");
      return;
    }

    const currentDate = new Date();
    const formattedDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;
    const hours = currentDate.getHours();
    const timeOfDay = hours < 12 ? 'morning' : hours < 17 ? 'afternoon' : 'night';
    const timestamp = currentDate.toISOString();
    const docId = `${formattedDate}_${currentDate.getHours().toString().padStart(2, '0')}-${currentDate.getMinutes().toString().padStart(2, '0')}-${currentDate.getSeconds().toString().padStart(2, '0')}`;

    // Get employeeID from localStorage
    const userData = JSON.parse(localStorage.getItem('user')) || {};
    const employeeID = userData.employeeID || 'unknown';

    try {
      // Use formatted date and time as document ID
      const varianceLogRef = doc(db, 'inventoryLog', docId);

      // Calculate total variance for items with non-zero variance
      const totalVariance = itemsWithVariance.reduce((sum, item) => {
        return sum + (calculateStock(item) - item.totalStockOnHand);
      }, 0);

      // Save main document
      await setDoc(varianceLogRef, {
        id: docId,
        date: formattedDate,
        timestamp: timestamp,
        status: 'adjusted',
        totalVariance: totalVariance,
        employeeID: employeeID,
      }, { merge: true });

      const batchWrites = [];

      itemsWithVariance.forEach(item => {
        const totalUnits = calculateStock(item);
        const variance = totalUnits - item.totalStockOnHand;

        if (override) {
          const inventoryRef = doc(db, 'inventory', item.id);
          batchWrites.push(
            setDoc(inventoryRef, { totalStockOnHand: totalUnits }, { merge: true })
          );
        }

        // Use item-specific ID in items subcollection
        const variantItemRef = doc(collection(varianceLogRef, 'items'), `${docId}_${item.id}`);
        batchWrites.push(
          setDoc(variantItemRef, {
            itemId: item.id,
            itemName: item.itemName,
            unit: item.unit, // Include unit in inventory log
            boxesCount: item.boxes,
            innerCount: item.innerPacks,
            unitsCount: item.units,
            totalCounted: totalUnits,
            variance: variance,
            previousStock: item.totalStockOnHand,
            newStock: override ? totalUnits : item.totalStockOnHand,
            needsRecount: !override && variance !== 0,
            status: variance === 0 ? "completed" : "recorded_with_variance",
            timestamp: timestamp,
            timeOfDay: timeOfDay,
            employeeID: employeeID,
          }, { merge: true })
        );
      });

      await Promise.all(batchWrites);

      // Update inventory items state
      const updatedItems = inventoryItems.map(invItem => {
        const item = itemsWithVariance.find(i => i.id === invItem.id);
        return item ? {
          ...invItem,
          totalStockOnHand: override ? calculateStock(item) : invItem.totalStockOnHand
        } : invItem;
      });

      setInventoryItems(updatedItems);

      // Mark all items (including zero variance) as submitted
      const newSubmitted = items.reduce((acc, item) => {
        acc[item.id] = true;
        return acc;
      }, {});

      // Reset applied counts for submitted items
      setAppliedCounts(prev => {
        const newApplied = { ...prev };
        items.forEach(item => {
          newApplied[item.id] = false;
        });
        return newApplied;
      });

      // Update variances for saved items
      const newVariances = itemsWithVariance.reduce((acc, item) => {
        acc[item.id] = calculateStock(item) - item.totalStockOnHand;
        return acc;
      }, {});

      setSubmittedItems(prev => ({ ...prev, ...newSubmitted }));
      setVariances(prev => ({ ...prev, ...newVariances }));
      setItemsToHighlight(prev => prev.filter(id => !newSubmitted[id]));
      setShowRecountVariances(prev => prev.filter(id => !newSubmitted[id]));

      alert(override
        ? "Items with variance submitted!"
        : "Stock counts with variance saved!");
    } catch (error) {
      console.error("Error saving data:", error);
      alert("Error saving data. Please check the console.");
    }
  };

  const handleSaveAllApplied = async () => {
    const itemsToSave = inventoryItems.filter(item =>
      appliedCounts[item.id] && !submittedItems[item.id]
    );

    const noVarianceItems = [];
    const varianceItems = [];

    itemsToSave.forEach(item => {
      const totalUnits = calculateStock(item);
      if (totalUnits === item.totalStockOnHand) {
        noVarianceItems.push(item);
      } else {
        varianceItems.push(item);
      }
    });

    if (varianceItems.length > 0) {
      setPendingVarianceItems(varianceItems);
      setItemsToHighlight(varianceItems.map(item => item.id));
      setShowRecountVariances(varianceItems.map(item => item.id));
      setShowVarianceModal(true);
    }

    if (noVarianceItems.length > 0) {
      // Mark no-variance items as submitted without saving to inventoryLog
      const newSubmitted = noVarianceItems.reduce((acc, item) => {
        acc[item.id] = true;
        return acc;
      }, {});
      setSubmittedItems(prev => ({ ...prev, ...newSubmitted }));
      setAppliedCounts(prev => {
        const newApplied = { ...prev };
        noVarianceItems.forEach(item => {
          newApplied[item.id] = false;
        });
        return newApplied;
      });
      alert("Items with no variance marked as submitted.");
    }
  };

  const handleSearch = (e) => setSearchQuery(e.target.value.toLowerCase());

  const filteredItems = inventoryItems.filter(item =>
    item.itemName.toLowerCase().includes(searchQuery)
  );

  if (showStockCountLog) {
    return (
      <div className="flex-1 p-6 overflow-auto">
        <button
          onClick={() => setShowStockCountLog(false)}
          className="bg-gray-500 text-white px-4 py-2 rounded shadow hover:bg-gray-600 mb-4"
        >
          Back to Stock Count
        </button>
        <InventoryManagement />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-auto">
      <h1 className="text-2xl font-bold mb-6">Inventory Management (Stock Count)</h1>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Search items..."
          className="border rounded p-2 flex-1"
        />
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={masterCheck}
            onChange={handleMasterCheck}
            className="p-2"
          />
          <label>Select All</label>
        </div>
        <button
          onClick={handleSaveAllApplied}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
        >
          Save Selected
        </button>
        <button
          onClick={() => setShowStockCountLog(true)}
          className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700"
        >
          Stock Count Log
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-3 text-left">Item</th>
              <th className="p-3 text-left">Unit</th>
              <th className="p-3 text-left">Boxes</th>
              <th className="p-3 text-left">Inners</th>
              <th className="p-3 text-left">Units</th>
              <th className="p-3 text-left">Select</th>
              <th className="p-3 text-left">Variance</th>
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
                    <td className="p-3"><Skeleton width={20} height={20} /></td>
                    <td className="p-3"><Skeleton width={50} height={20} /></td>
                  </tr>
                ))}
              </SkeletonTheme>
            ) : (
              filteredItems.map(item => {
                const isSubmitted = submittedItems[item.id];
                const hasHighlight = itemsToHighlight.includes(item.id);
                const currentVariance = calculateStock(item) - item.totalStockOnHand;

                return (
                  <tr key={item.id} className={hasHighlight ? 'bg-yellow-50' : ''}>
                    <td className="p-3 font-medium">{item.itemName}</td>
                    <td className="p-3">{item.unit || 'N/A'}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        value={item.boxes}
                        onChange={(e) => handleInputChange(item.id, 'boxes', e.target.value)}
                        className={`border rounded p-2 w-20 ${hasHighlight ? 'border-red-500' : ''}`}
                        disabled={isSubmitted}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        value={item.innerPacks}
                        onChange={(e) => handleInputChange(item.id, 'innerPacks', e.target.value)}
                        className={`border rounded p-2 w-20 ${hasHighlight ? 'border-red-500' : ''}`}
                        disabled={isSubmitted}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        value={item.units}
                        onChange={(e) => handleInputChange(item.id, 'units', e.target.value)}
                        className={`border rounded p-2 w-20 ${hasHighlight ? 'border-red-500' : ''}`}
                        disabled={isSubmitted}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={appliedCounts[item.id] || false}
                        onChange={() => handleTickChange(item.id)}
                        disabled={isSubmitted}
                      />
                    </td>
                    <td className="p-3 font-medium">
                      {(isSubmitted || showRecountVariances.includes(item.id)) && (
                        <span className={currentVariance !== 0 ? 'text-red-600' : 'text-green-600'}>
                          {currentVariance}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showVarianceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Inventory Adjustment Required</h3>
            <p className="mb-4">
              There is a variance in {pendingVarianceItems.length} item(s).
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowVarianceModal(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Recount
              </button>
              <button
                onClick={async () => {
                  await saveItems(pendingVarianceItems, true);
                  setShowVarianceModal(false);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Submit Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockCount;