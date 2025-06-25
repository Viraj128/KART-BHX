import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext'; // Import useAuth
import { ROLES } from '../../config/roles'; // Import ROLES

const InventoryRecords = () => {
  const { user } = useAuth(); // Get current user from AuthContext
  const navigate = useNavigate();

  // Role checks using ROLES constants
  const isAdmin = user?.role === ROLES.ADMIN;
  // const isManager = user?.role === ROLES.MANAGER;
  // const isTeamLeader = user?.role === ROLES.TEAMLEADER;
  const isTeamMember = user?.role === ROLES.TEAMMEMBER;

  const [inventory, setInventory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRowId, setEditingRowId] = useState(null);
  const [editedItem, setEditedItem] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'itemId', direction: 'asc' });
  const [stockPrompt, setStockPrompt] = useState({ boxes: '', inner: '', units: '' });
  const [showStockPrompt, setShowStockPrompt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Redirect Team Members to unauthorized page
  useEffect(() => {
    if (isTeamMember) {
      navigate('/unauthorized', { replace: true });
    }
  }, [isTeamMember, navigate]);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        setLoading(true);
        const querySnapshot = await getDocs(collection(db, 'inventory'));
        const items = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          itemId: doc.data().itemId || '',
        }));
        
        // Sort by numeric value in itemId
        items.sort((a, b) => {
          const idA = parseInt(a.itemId.replace(/\D/g, '')) || 0;
          const idB = parseInt(b.itemId.replace(/\D/g, '')) || 0;
          return idA - idB;
        });
        
        setInventory(items);
        setError(null);
      } catch (error) {
        console.error('Error fetching inventory:', error);
        setError('Failed to load inventory. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchInventory();
  }, []);

  const handleSort = (key) => {
    setSortConfig((prevConfig) => {
      const isAsc = prevConfig.key === key && prevConfig.direction === 'asc';
      const direction = isAsc ? 'desc' : 'asc';
      const sortedInventory = [...inventory].sort((a, b) => {
        let aValue = a[key] || '';
        let bValue = b[key] || '';
        if (key === 'itemId') {
          aValue = parseInt(aValue.replace(/\D/g, '')) || 0;
          bValue = parseInt(bValue.replace(/\D/g, '')) || 0;
        } else if (['unitsPerInner', 'innerPerBox', 'totalStockOnHand'].includes(key)) {
          aValue = Number(aValue) || 0;
          bValue = Number(bValue) || 0;
        } else {
          aValue = String(aValue).toLowerCase();
          bValue = String(bValue).toLowerCase();
        }
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      });
      setInventory(sortedInventory);
      return { key, direction };
    });
  };

  const filteredInventory = inventory.filter(item =>
    Object.values(item).some(value =>
      String(value).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const isNumeric = (val) => /^[0-9\b]+$/.test(val) || val === '';

  const handleInputChange = (e, field) => {
    const value = e.target.value;
    if (['unitsPerInner', 'innerPerBox', 'totalStockOnHand'].includes(field) && !isNumeric(value)) return;
    setEditedItem({ ...editedItem, [field]: value });
  };

  const handleStockPromptChange = (e, field) => {
    const value = e.target.value;
    if (!isNumeric(value)) return;
    setStockPrompt({ ...stockPrompt, [field]: value });
  };

  const calculateTotalStock = () => {
    const { boxes, inner, units } = stockPrompt;
    const unitsPerInner = Number(editedItem.unitsPerInner) || 0;
    const innerPerBox = Number(editedItem.innerPerBox) || 0;
    const total = (Number(boxes) || 0) * innerPerBox * unitsPerInner +
                  (Number(inner) || 0) * unitsPerInner +
                  (Number(units) || 0);
    return total;
  };

  const handleStockPromptSubmit = () => {
    const totalStock = calculateTotalStock();
    setEditedItem({ ...editedItem, totalStockOnHand: totalStock.toString() });
    setShowStockPrompt(false);
    setStockPrompt({ boxes: '', inner: '', units: '' });
  };

  const handleSave = async (itemId) => {
    if (!isAdmin) {
      alert('You do not have permission to edit inventory.');
      return;
    }
    try {
      const oldItem = inventory.find(item => item.id === itemId);
      const duplicateItem = inventory.find(item =>
        item.id !== itemId && (
          (editedItem.itemId && item.itemId === editedItem.itemId) ||
          (editedItem.itemName && item.itemName.toLowerCase() === editedItem.itemName.toLowerCase())
        )
      );
      
      if (duplicateItem) {
        alert(duplicateItem.itemId === editedItem.itemId
          ? 'An item with this Item ID already exists.'
          : 'An item with this Item Name already exists.');
        return;
      }

      const changedFields = [];
      Object.entries(editedItem).forEach(([key, newValue]) => {
        const oldValue = oldItem[key] || '';
        if (String(oldValue) !== String(newValue)) {
          changedFields.push({ field: key, oldValue, newValue });
        }
      });

      const allowedFields = ['itemId', 'itemName', 'unitsPerInner', 'innerPerBox', 'totalStockOnHand'];
      const updatedData = {};
      allowedFields.forEach(field => {
        if (editedItem.hasOwnProperty(field)) {
          updatedData[field] = ['unitsPerInner', 'innerPerBox', 'totalStockOnHand'].includes(field)
            ? Number(editedItem[field]) || 0
            : editedItem[field];
        } else if (oldItem.hasOwnProperty(field)) {
          updatedData[field] = ['unitsPerInner', 'innerPerBox', 'totalStockOnHand'].includes(field)
            ? Number(oldItem[field]) || 0
            : oldItem[field];
        }
      });

      updatedData.lastUpdated = Timestamp.fromDate(new Date());
      updatedData.changedFields = changedFields.length > 0 ? changedFields : (oldItem.changedFields || []);

      const itemDocRef = doc(db, 'inventory', itemId);
      await updateDoc(itemDocRef, updatedData);

      setInventory(prev =>
        prev.map(item => item.id === itemId ? { ...item, ...updatedData } : item)
      );

      setEditingRowId(null);
      setEditedItem({});
      setShowStockPrompt(false);
      alert('Changes saved successfully!');
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save item.');
    }
  };

  const handleDelete = async (itemId) => {
    if (!isAdmin) {
      alert('You do not have permission to delete inventory.');
      return;
    }
    const confirmDelete = window.confirm('Are you sure you want to delete this record?');
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, 'inventory', itemId));
      setInventory(prev => prev.filter(item => item.id !== itemId));
      alert('Item deleted successfully!');
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item.');
    }
  };

  const renderSortArrow = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
    }
    return '';
  };

  // Loading Skeleton Component
  const SkeletonRow = () => (
    <tr className="animate-pulse">
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-300 rounded w-full"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-300 rounded w-1/2"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-300 rounded w-1/2"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-300 rounded w-1/2"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
      </td>
      <td className="px-6 py-4">
        <div className="flex space-x-2">
          <div className="h-8 bg-gray-300 rounded-md w-16"></div>
          <div className="h-8 bg-gray-300 rounded-md w-16"></div>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 bg-white p-6 rounded-lg shadow">
          {isAdmin && (
            <button
              onClick={() => navigate('/inventory/addinventory')}
              className="bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition duration-300 flex items-center mb-4 md:mb-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add Inventory
            </button>
          )}
          
          <h1 className="text-3xl font-bold text-gray-800 mb-4 md:mb-0">Inventory Records</h1>
          
          <div className="relative w-full md:w-auto">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search inventory..."
              className="border rounded-lg text-base px-4 py-2.5 pl-10 w-full md:w-80 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743- glaucoma2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {showStockPrompt && isAdmin && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-xl w-96">
              <h2 className="text-xl font-bold mb-4 text-gray-800">Update Stock Levels</h2>
              
              <div className="space-y-4 mb-6">
                {['boxes', 'inner', 'units'].map((type) => (
                  <div key={type}>
                    <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{type}</label>
                    <input
                      type="text"
                      value={stockPrompt[type]}
                      onChange={(e) => handleStockPromptChange(e, type)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={`Enter ${type} count`}
                    />
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between">
                <button
                  onClick={() => setShowStockPrompt(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStockPromptSubmit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition duration-150"
                    onClick={() => handleSort('itemId')}
                  >
                    <div className="flex items-center">
                      Item ID
                      {renderSortArrow('itemId')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition duration-150"
                    onClick={() => handleSort('itemName')}
                  >
                    <div className="flex items-center">
                      Item Name
                      {renderSortArrow('itemName')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition duration-150"
                    onClick={() => handleSort('unitsPerInner')}
                  >
                    <div className="flex items-center">
                      Units/Inner
                      {renderSortArrow('unitsPerInner')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition duration-150"
                    onClick={() => handleSort('innerPerBox')}
                  >
                    <div className="flex items-center">
                      Inner/Box
                      {renderSortArrow('innerPerBox')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition duration-150"
                    onClick={() => handleSort('totalStockOnHand')}
                  >
                    <div className="flex items-center">
                      Total Stock
                      {renderSortArrow('totalStockOnHand')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <SkeletonRow key={index} />
                  ))
                ) : filteredInventory.length > 0 ? (
                  filteredInventory.map((item) => (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-gray-50 ${editingRowId === item.id ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {editingRowId === item.id ? (
                          <input
                            type="text"
                            value={editedItem.itemId || ''}
                            onChange={(e) => handleInputChange(e, 'itemId')}
                            className="w-full px-3 py-1 border rounded-md focus:ring-2 focus:ring-blue-500"
                            disabled={!isAdmin} // Disable input for non-admins
                          />
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {item.itemId || 'N/A'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingRowId === item.id ? (
                          <input
                            type="text"
                            value={editedItem.itemName || ''}
                            onChange={(e) => handleInputChange(e, 'itemName')}
                            className="w-full px-3 py-1 border rounded-md focus:ring-2 focus:ring-blue-500"
                            disabled={!isAdmin} // Disable input for non-admins
                          />
                        ) : (
                          item.itemName || 'N/A'
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingRowId === item.id ? (
                          <input
                            type="text"
                            value={editedItem.unitsPerInner || ''}
                            onChange={(e) => handleInputChange(e, 'unitsPerInner')}
                            className="w-full px-3 py-1 border rounded-md focus:ring-2 focus:ring-blue-500"
                            disabled={!isAdmin} // Disable input for non-admins
                          />
                        ) : (
                          item.unitsPerInner || 'N/A'
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingRowId === item.id ? (
                          <input
                            type="text"
                            value={editedItem.innerPerBox || ''}
                            onChange={(e) => handleInputChange(e, 'innerPerBox')}
                            className="w-full px-3 py-1 border rounded-md focus:ring-2 focus:ring-blue-500"
                            disabled={!isAdmin} // Disable input for non-admins
                          />
                        ) : (
                          item.innerPerBox || 'N/A'
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingRowId === item.id ? (
                          <div className="flex items-center">
                            <input
                              type="text"
                              value={editedItem.totalStockOnHand || ''}
                              onChange={(e) => handleInputChange(e, 'totalStockOnHand')}
                              className="w-full px-3 py-1 border rounded-md focus:ring-2 focus:ring-blue-500"
                              readOnly
                            />
                            <button
                              onClick={() => setShowStockPrompt(true)}
                              className={`ml-2 px-2 py-1 text-white rounded-md flex items-center text-sm ${
                                isAdmin ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gray-400 cursor-not-allowed'
                              }`}
                              disabled={!isAdmin} // Disable stock edit button for non-admins
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                              Edit
                            </button>
                          </div>
                        ) : (
                          item.totalStockOnHand || 'N/A'
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {item.lastUpdated
                          ? new Date(item.lastUpdated.seconds * 1000).toLocaleString()
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          {editingRowId === item.id ? (
                            <>
                              <button
                                onClick={() => handleSave(item.id)}
                                className={`px-3 py-1 text-white rounded-md flex items-center transition ${
                                  isAdmin ? 'bg-green-600 hover:bg-green-700' : 'bg-green-400 cursor-not-allowed'
                                }`}
                                disabled={!isAdmin} // Disable Save button for non-admins
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingRowId(null);
                                  setEditedItem({});
                                  setShowStockPrompt(false);
                                }}
                                className="px-3 py-1 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingRowId(item.id);
                                  setEditedItem({
                                    itemId: item.itemId || '',
                                    itemName: item.itemName || '',
                                    unitsPerInner: item.unitsPerInner || '',
                                    innerPerBox: item.innerPerBox || '',
                                    totalStockOnHand: item.totalStockOnHand || '',
                                  });
                                }}
                                className={`px-3 py-1 text-white rounded-md flex items-center transition ${
                                  isAdmin ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-400 cursor-not-allowed'
                                }`}
                                disabled={!isAdmin} // Disable Edit button for non-admins
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className={`px-3 py-1 text-white rounded-md flex items-center transition ${
                                  isAdmin ? 'bg-red-600 hover:bg-red-700' : 'bg-red-400 cursor-not-allowed'
                                }`}
                                disabled={!isAdmin} // Disable Delete button for non-admins
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                        </svg>
                        <p className="text-lg">No inventory records found</p>
                        <p className="mt-2">Try adjusting your search or add new items</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryRecords;