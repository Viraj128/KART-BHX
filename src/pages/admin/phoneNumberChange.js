import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const ChangePhoneNumber = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const oldPhone = location.state?.oldPhone;

  const [customerData, setCustomerData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newPhone, setNewPhone] = useState('');
  const [updateError, setUpdateError] = useState(null);
  const [updateSuccess, setUpdateSuccess] = useState(null);
  const [phoneError, setPhoneError] = useState(null);

  // Validate phone number (must be exactly 10 digits)
  const validatePhoneNumber = (phone) => {
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(phone);
  };

  // Handle input change with real-time validation
  const handlePhoneChange = (e) => {
    const value = e.target.value;
    setNewPhone(value);
    
    if (value && !validatePhoneNumber(value)) {
      setPhoneError('Phone number must be exactly 10 digits');
    } else {
      setPhoneError(null);
    }
  };

  // Fetch data for the old phone number
  useEffect(() => {
    if (!oldPhone) {
      setError('No phone number provided');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch from customers (document ID is phone)
        const customerDoc = await getDoc(doc(db, 'customers', oldPhone));
        // Fetch from users_01 (document ID is phone)
        const userDoc = await getDoc(doc(db, 'users_01', oldPhone));

        if (customerDoc.exists()) {
          setCustomerData(customerDoc.data());
        }

        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [oldPhone]);

  // Handle phone number update (delete old, add new)
  const handlePhoneUpdate = async () => {
    if (!newPhone) {
      setUpdateError('Please enter a new phone number');
      return;
    }

    if (!validatePhoneNumber(newPhone)) {
      setUpdateError('Phone number must be exactly 10 digits');
      return;
    }

    try {
      // Check if new phone number already exists in either table
      const [newCustomerDoc, newUserDoc] = await Promise.all([
        getDoc(doc(db, 'customers', newPhone)),
        getDoc(doc(db, 'users_01', newPhone))
      ]);

      if (newCustomerDoc.exists() || newUserDoc.exists()) {
        setUpdateError('New phone number already exists in customers or users_01');
        return;
      }

      // Prepare updates
      const updates = [];

      // Handle customers
      if (customerData) {
        updates.push(deleteDoc(doc(db, 'customers', oldPhone)));
        updates.push(setDoc(doc(db, 'customers', newPhone), {
          ...customerData,
          phone: newPhone,
          updatedAt: new Date()
        }));
      }

      // Handle users_01
      if (userData) {
        updates.push(deleteDoc(doc(db, 'users_01', oldPhone)));
        updates.push(setDoc(doc(db, 'users_01', newPhone), {
          ...userData,
          phone: newPhone,
          updatedAt: new Date()
        }));
      }

      // If old phone exists in both tables, ensure new phone is added to both
      if (customerData && userData) {
        // Already handled above, as both are copied to newPhone
      }

      await Promise.all(updates);

      setUpdateSuccess('Phone number updated successfully!');
      setUpdateError(null);
      setPhoneError(null);
      setNewPhone('');
      setTimeout(() => navigate('/users'), 2000);
    } catch (err) {
      setUpdateError(`Failed to update phone number: ${err.message}`);
      setUpdateSuccess(null);
    }
  };

  // Handle navigation back
  const handleBack = () => {
    navigate('/users');
  };

  // Render complex fields (bank_details, changeField, timestamps)
  const renderValue = (key, value) => {
    // Handle Firestore Timestamps
    const timestampFields = ['updatedAt', 'created_at', 'archivedAt', 'convertedAt', 'member_since'];
    if (timestampFields.includes(key) && value && value.toDate) {
      return value.toDate().toLocaleString() || 'N/A';
    }

    // Handle bank_details map
    if (key === 'bank_details' && value) {
      return (
        <div className="space-y-1">
          {Object.entries(value).map(([subKey, subValue]) => (
            <p key={subKey}>
              {subKey.replace(/_/g, ' ')}: {subValue || 'N/A'}
            </p>
          ))}
        </div>
      );
    }

    // Handle changeField array
    if (key === 'changeField' && Array.isArray(value)) {
      return (
        <ul className="list-disc pl-5">
          {value.map((change, index) => (
            <li key={index}>
              {change.field}: {change.oldValue || 'N/A'} → {change.newValue || 'N/A'} 
              (Changed at: {new Date(change.changedAt).toLocaleString()})
            </li>
          ))}
        </ul>
      );
    }

    // Handle other objects or arrays
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }

    // Handle primitive values
    return value || 'N/A';
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;
  if (error) return <div className="p-4 text-center text-red-500">Error: {error}</div>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Phone Number Details</h1>
          <button
            onClick={handleBack}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Back to Users
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Phone Number</h2>
            <p className="text-gray-600">{oldPhone || 'N/A'}</p>
          </div>

          {/* Customer Details */}
          <div>
            <h2 className="text-lg font-semibold">Customer Details</h2>
            {customerData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {Object.entries(customerData).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 capitalize">
                      {key.replace(/_/g, ' ')}
                    </label>
                    <p className="mt-1 text-gray-600">
                      {renderValue(key, value)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No customer data found</p>
            )}
          </div>

          {/* User Details */}
          <div>
            <h2 className="text-lg font-semibold">User Details</h2>
            {userData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {Object.entries(userData).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 capitalize">
                      {key.replace(/_/g, ' ')}
                    </label>
                    <p className="mt-1 text-gray-600">
                      {renderValue(key, value)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No user data found</p>
            )}
          </div>

          {/* Update Phone Number Form */}
          <div>
            <h2 className="text-lg font-semibold">Update Phone Number</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">New Phone Number</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={handlePhoneChange}
                  className={`mt-1 w-full p-2 border rounded ${phoneError ? 'border-red-500' : ''}`}
                  placeholder="Enter new phone number"
                />
                {phoneError && <p className="text-red-500 text-sm mt-1">{phoneError}</p>}
              </div>
              {updateError && <p className="text-red-500 text-sm">{updateError}</p>}
              {updateSuccess && <p className="text-green-500 text-sm">{updateSuccess}</p>}
              <button
                onClick={handlePhoneUpdate}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                disabled={phoneError || !newPhone}
              >
                Update Phone Number
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangePhoneNumber;