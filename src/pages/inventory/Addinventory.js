import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/config';
import { collection, doc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import Skeleton from 'react-loading-skeleton';

const Addinventory = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    itemId: '',
    itemName: '',
    unit: 'EA', // Default unit
    unitsPerInner: '',
    innerPerBox: '',
    boxes: '',
    inners: '',
    units: '',
  });
  const [stockOnHand, setStockOnHand] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  // Update stockOnHand whenever relevant fields change
  useEffect(() => {
    const boxesNum = Number(form.boxes) || 0;
    const innersNum = Number(form.inners) || 0;
    const unitsNum = Number(form.units) || 0;
    const innerPerBoxNum = Number(form.innerPerBox) || 0;
    const unitsPerInnerNum = Number(form.unitsPerInner) || 0;

    const totalStockOnHand =
      (boxesNum * innerPerBoxNum * unitsPerInnerNum) +
      (innersNum * unitsPerInnerNum) +
      unitsNum;

    setStockOnHand(totalStockOnHand);
  }, [form.boxes, form.inners, form.units, form.unitsPerInner, form.innerPerBox]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Allow only numeric input for specific fields
    const numericFields = ['unitsPerInner', 'innerPerBox', 'boxes', 'inners', 'units'];
    if (numericFields.includes(name) && !/^[0-9]*$/.test(value)) return;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { itemId, itemName, unit, unitsPerInner, innerPerBox, boxes, inners, units } = form;

    // Check all fields are filled
    if (!itemId || !itemName || !unitsPerInner || !innerPerBox || boxes === '' || inners === '' || units === '') {
      alert('All fields are required.');
      setIsSubmitting(false);
      return;
    }

    // Normalize the entered itemId (lowercase, trimmed, remove leading zeros)
    const normalizedInputId = itemId.trim().toLowerCase().replace(/\s+/g, '');
    const match = normalizedInputId.match(/^item0*(\d+)$/); // e.g., item07 -> 7
    if (!match) {
      alert('Invalid item ID format. Use format like "item07" or "item7".');
      setIsSubmitting(false);
      return;
    }

    const inputNumeric = match[1]; // e.g., "7"
    const normalizedItemName = itemName.trim();
    const normalizedItemNameForCheck = itemName.trim().toLowerCase().replace(/\s+/g, '');

    try {
      setLoading(true);
      // Check for duplicate itemId or itemName
      const snapshot = await getDocs(collection(db, 'inventory'));
      let itemIdExists = false;
      let itemNameExists = false;

      snapshot.forEach((doc) => {
        const data = doc.data();
        // Check itemId
        if (data.itemId) {
          const normalizedExistingId = data.itemId.trim().toLowerCase().replace(/\s+/g, '');
          const existingMatch = normalizedExistingId.match(/^item0*(\d+)$/);
          if (existingMatch && existingMatch[1] === inputNumeric) {
            itemIdExists = true;
          }
        }
        // Check itemName (case-insensitive, no spaces)
        if (data.itemName) {
          const existingItemName = data.itemName.trim().toLowerCase().replace(/\s+/g, '');
          if (existingItemName === normalizedItemNameForCheck) {
            itemNameExists = true;
          }
        }
      });

      if (itemIdExists) {
        alert('This item ID already exists. Please try another one.');
        setIsSubmitting(false);
        setLoading(false);
        return;
      }
      if (itemNameExists) {
        alert('This item name (or a variation like "vada pav", "vadapav", "VadaPav") already exists. Please try another one.');
        setIsSubmitting(false);
        setLoading(false);
        return;
      }

      // Calculate totalStockOnHand and convert fields to numbers
      const boxesNum = Number(boxes) || 0;
      const innersNum = Number(inners) || 0;
      const unitsNum = Number(units) || 0;
      const innerPerBoxNum = Number(innerPerBox) || 0;
      const unitsPerInnerNum = Number(unitsPerInner) || 0;

      const totalStockOnHand =
        boxesNum * innerPerBoxNum * unitsPerInnerNum +
        innersNum * unitsPerInnerNum +
        unitsNum;

      // Add new item to Firestore with itemId as document ID
      const itemDocRef = doc(db, 'inventory', normalizedInputId);
      await setDoc(itemDocRef, {
        itemId: normalizedInputId, // e.g., item7
        itemName: normalizedItemName,
        unit: unit, // Save the unit
        unitsPerInner: unitsPerInnerNum, // Store as number
        innerPerBox: innerPerBoxNum,     // Store as number
        totalStockOnHand: totalStockOnHand, // Store as number
        lastUpdated: serverTimestamp(),
      });

      alert('Inventory added successfully!');
      setForm({
        itemId: '',
        itemName: '',
        unit: 'EA',
        unitsPerInner: '',
        innerPerBox: '',
        boxes: '',
        inners: '',
        units: '',
      });
      setStockOnHand(0);

      setTimeout(() => {
        navigate('/inventory/inventoryrecords');
      }, 1500);
    } catch (err) {
      console.error('Error adding inventory:', err);
      alert('Failed to add inventory. Please try again.');
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-8 bg-white border border-gray-300 rounded-2xl shadow-lg">
        <h2 className="text-xl font-bold mb-8 text-center">
          <Skeleton width={200} height={30} />
        </h2>
        
        <div className="space-y-6">
          {[...Array(8)].map((_, i) => (
            <div key={i}>
              <Skeleton width={120} height={20} className="mb-2" />
              <Skeleton height={40} />
            </div>
          ))}
          <div className="mt-6">
            <Skeleton height={45} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto mt-8 md:mt-16 p-6 md:p-8 bg-white border border-gray-200 rounded-2xl shadow-xl">
      <button
        className="px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-green-700 transition-colors mb-6"
        onClick={() => navigate("/inventory/inventoryrecords")}
      >
        Back to Users
      </button>
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-gray-800">Add New Inventory</h2>
        <p className="text-gray-600 mt-2">Fill in the details to add a new inventory item</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Item ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="itemId"
              value={form.itemId}
              onChange={handleChange}
              className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., item07"
            />
            <p className="text-xs text-gray-500 mt-1">Format: item01, item02, etc.</p>
          </div>
          
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="itemName"
              value={form.itemName}
              onChange={handleChange}
              className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter item name"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Unit <span className="text-red-500">*</span>
            </label>
            <select
              name="unit"
              value={form.unit}
              onChange={handleChange}
              className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="EA">EA (Each)</option>
              <option value="KG">KG (Kilogram)</option>
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Units Per Inner <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="unitsPerInner"
              value={form.unitsPerInner}
              onChange={handleChange}
              className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter number"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Inner Per Box <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="innerPerBox"
              value={form.innerPerBox}
              onChange={handleChange}
              className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter number"
            />
          </div>
          
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Boxes <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="boxes"
              value={form.boxes}
              onChange={handleChange}
              className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter count"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Inners <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="inners"
              value={form.inners}
              onChange={handleChange}
              className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter count"
            />
          </div>
          
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Units <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="units"
              value={form.units}
              onChange={handleChange}
              className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter count"
            />
          </div>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium text-gray-700">Stock On Hand</h3>
              <p className="text-xs text-gray-500">Calculated automatically</p>
            </div>
            <div className="text-2xl font-bold text-blue-700">
              {stockOnHand}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-3 rounded-lg font-semibold transition-all ${
            isSubmitting 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-md hover:shadow-lg'
          }`}
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </div>
          ) : (
            'Add Inventory Item'
          )}
        </button>
      </form>
    </div>
  );
};

export default Addinventory;