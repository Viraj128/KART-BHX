import React, { Fragment, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, arrayUnion } from 'firebase/firestore';
import { Dialog, Transition } from '@headlessui/react';
import { getAuth, updateEmail, onAuthStateChanged, sendEmailVerification } from 'firebase/auth';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { useAuth } from '../auth/AuthContext';
import {ROLES} from '../config/roles';


// Define field access rules
const fieldAccessRules = {
  [ROLES.ADMIN]: {
    editable: [
      'name', 'email', 'phone', 'role', 'address', 'dob', 'document_number',
      'shareCode', 'bank_details.bank_name', 'bank_details.account_number',
      'bank_details.branch_name', 'customerID', 'employeeID'
    ]
  },
  [ROLES.MANAGER]: {
    editable: ['name', 'dob', 'address']
  },
  [ROLES.TEAMLEADER]: {
    editable: []
  }
};

const displayValue = (value) => value || 'N/A';

const UserDetails = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState(null);
  const [duplicateProfiles, setDuplicateProfiles] = useState([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPhoneChangeAlertOpen, setIsPhoneChangeAlertOpen] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    dob: '',
    document_number: '',
    role: '',
    member_since: '',
    shareCode: '',
    bank_details: {
      account_number: '',
      bank_name: '',
      branch_name: ''
    },
    customerID: '',
    employeeID: ''
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Role checks
  const isAdmin = currentUser?.role === ROLES.ADMIN;
  const isManager = currentUser?.role === ROLES.MANAGER;
  const isTeamLeader = currentUser?.role === ROLES.TEAMLEADER;

  // Get editable fields for current user
  const currentUserRole = currentUser?.role || ROLES.TEAMMEMBER;
  const editableFields = fieldAccessRules[currentUserRole]?.editable || [];

    // console.log('Current User:', currentUserRole);
    // console.log('isAdmin:', isAdmin, 'ROLES.ADMIN:', ROLES.ADMIN, 'currentUser?.role:', currentUser?.role);
  
  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) return;

      try {
        await currentUser.reload();
        const refreshedUser = auth.currentUser;

        if (refreshedUser.emailVerified && !user?.emailVerified) {
          const collectionName = user?.originalCollection || "users_01";
          const docId = user?.phone;

          if (collectionName && docId) {
            const docRef = doc(db, collectionName, docId);
            await updateDoc(docRef, { emailVerified: true });
            setUser((prev) => ({
              ...prev,
              emailVerified: true,
            }));
            console.log("Email verified status updated in Firestore.");
          }
        }
      } catch (err) {
        console.error("Error checking or updating emailVerified:", err);
      }
    });

    return () => unsubscribe();
  }, [user?.emailVerified, user?.originalCollection, user?.phone]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setIsLoading(true);
        const [usersSnapshot, customersSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'users_01'), where('userId', '==', userId))),
          getDocs(query(collection(db, 'customers'), where('userId', '==', userId)))
        ]);

        const employees = usersSnapshot.docs.map(doc => ({
          ...doc.data(),
          idType: 'employee',
          originalRole: doc.data().role,
          phone: doc.id,
          originalCollection: 'users_01'
        }));

        const customers = customersSnapshot.docs.map(doc => ({
          ...doc.data(),
          idType: 'customer',
          role: 'customer',
          phone: doc.id,
          originalCollection: 'customers'
        }));

        const allProfiles = [...employees, ...customers];

        if (allProfiles.length > 1) {
          if (isAdmin) {
            setDuplicateProfiles(allProfiles);
            setIsLoading(false);
            return;
          } else {
            // For non-admins, automatically select the first profile and proceed
            const profile = allProfiles[0];
            setUser(profile);
            setFormData(prev => ({
              ...prev,
              ...profile,
              bank_details: profile.bank_details || {},
              customerID: profile.customerID || '',
              employeeID: profile.employeeID || '',
              role: profile.originalCollection === 'customers' ? 'customer' : profile.role
            }));
            setDuplicateProfiles([]);
            setIsLoading(false);
            return;
          }
        }

        if (allProfiles.length === 0) {
          setError('User not found');
          setIsLoading(false);
          return;
        }

        const profile = allProfiles[0];
        setUser(profile);
        setFormData(prev => ({
          ...prev,
          ...profile,
          bank_details: profile.bank_details || {},
          customerID: profile.customerID || '',
          employeeID: profile.employeeID || '',
          role: profile.originalCollection === 'customers' ? 'customer' : profile.role
        }));
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching user:', err);
        setError('Failed to load user data');
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [userId, isAdmin]);

  const trackEmployeeChanges = (originalData, newData) => {
    const changes = [];
    const fieldsToTrack = [
      'name', 'email', 'phone', 'address', 'dob', 'document_number',
      'member_since', 'shareCode', 'employeeID', 'role'
    ];

    fieldsToTrack.forEach(field => {
      const oldValue = originalData[field] ?? null;
      const newValue = newData[field] ?? null;

      if (oldValue !== newValue) {
        changes.push({
          field,
          oldValue,
          newValue,
          changedAt: new Date().toISOString(),
          changedBy: 'admin'
        });
      }
    });

    const bankFields = ['account_number', 'bank_name', 'branch_name'];
    bankFields.forEach(field => {
      const originalValue = originalData.bank_details?.[field] || '';
      const newValue = newData.bank_details?.[field] || '';

      if (originalValue !== newValue) {
        changes.push({
          field: `bank_details.${field}`,
          oldValue: originalValue,
          newValue: newValue,
          changedAt: new Date().toISOString(),
          changedBy: 'admin'
        });
      }
    });

    return changes;
  };

  const handleProfileSelection = (selectedProfile) => {
    setUser(selectedProfile);
    setDuplicateProfiles([]);
    setFormData(prev => ({
      ...prev,
      ...selectedProfile,
      bank_details: selectedProfile.bank_details || {},
      customerID: selectedProfile.customerID || '',
      employeeID: selectedProfile.employeeID || '',
      role: selectedProfile.originalCollection === 'customers' ? 'customer' : selectedProfile.role
    }));
  };

  const handleEdit = () => setIsEditOpen(true);

  const handlePhoneChangeAlertConfirm = () => {
    setIsPhoneChangeAlertOpen(false);
    setIsEditOpen(false);
    navigate('/users/changephoneNumber', { state: { oldPhone: user.phone } });
  };

  const formatShareCode = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    let formatted = '';
    for (let i = 0; i < digits.length; i++) {
      if (i === 2 || i === 4) formatted += '/';
      formatted += digits[i];
    }
    return formatted;
  };

  const handleShareCodeChange = (e) => {
    const formatted = formatShareCode(e.target.value);
    setFormData({ ...formData, shareCode: formatted });
    setError('');
  };
const handleSave = async () => {
  try {
    const requiredFields = {
      name: 'Name is required',
      email: 'Email is required',
      phone: 'Phone number is required',
      role: 'Role is required'
    };

    for (const [field, message] of Object.entries(requiredFields)) {
      if (!formData[field]) {
        setError(message);
        return;
      }
    }

    if (!/^[A-Za-z\s]+$/.test(formData.name)) {
      setError('Full Name should only contain alphabets and spaces.');
      return;
    }

    if (!/^[^\s@]+@(gmail\.com|yahoo\.com|outlook\.com)$/.test(formData.email)) {
      setError('Invalid email format');
      return;
    }

    if (formData.role === 'customer' && !formData.customerID) {
      setError('Customer ID is required');
      return;
    }

    if (formData.role !== 'customer' && formData.employeeID) {
      const empIdQuery = query(
        collection(db, 'users_01'),
        where('employeeID', '==', formData.employeeID)
      );
      const empIdSnapshot = await getDocs(empIdQuery);
      if (
        !empIdSnapshot.empty &&
        empIdSnapshot.docs.some(docSnap => docSnap.id !== formData.phone)
      ) {
        setError('This Employee ID is already in use by another user.');
        return;
      }
    }

    await Promise.all([
      getDoc(doc(db, 'customers', formData.phone)),
      getDoc(doc(db, 'users_01', formData.phone))
    ]);

    if (formData.document_number && !/^\d{5}$/.test(formData.document_number)) {
      setError('Document Number must be exactly 5 digits.');
      return;
    }

    if (formData.bank_details.bank_name && !/^[a-zA-Z\s]+$/.test(formData.bank_details.bank_name)) {
      setError('Bank Name can only contain alphabets and spaces.');
      return;
    }

    if (formData.bank_details.branch_name && !/^[a-zA-Z\s]+$/.test(formData.bank_details.branch_name)) {
      setError('Branch Name can only contain alphabets and spaces.');
      return;
    }

    if (formData.dob) {
      const dobDate = new Date(formData.dob);
      const today = new Date();
      if (dobDate > today) {
        setError('Date of Birth cannot be in the future');
        return;
      }
      const dobYear = dobDate.getFullYear();
      if (dobYear > 2001) {
        setError('Date of Birth year must be 2001 or earlier.');
        return;
      }
    }

    if (formData.shareCode && !/^\d{2}\/\d{2}\/\d{2}$/.test(formData.shareCode)) {
      setError('Share Code must be in the format __/__/__ (e.g., 12/34/56).');
      return;
    }

    if (formData.bank_details.account_number && !/^\d{8}$/.test(formData.bank_details.account_number)) {
      setError('Account Number must be exactly 8 digits.');
      return;
    }

    if (formData.address && formData.address.toLowerCase() === 'none') {
      setError('Address cannot be "none"');
      return;
    }

    if (formData.phone !== user.phone) {
      setNewPhoneNumber(formData.phone);
      setIsPhoneChangeAlertOpen(true);
      return;
    }

    const isEmailChanged = formData.email !== user.email;

    const [customerDoc, employeeDoc] = await Promise.all([
      getDoc(doc(db, 'customers', formData.phone)),
      getDoc(doc(db, 'users_01', formData.phone))
    ]);

    const updates = [];
    let employeeChanges = [];
    let isConvertingToCustomer = false;

    const commonData = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      dob: formData.dob,
      document_number: formData.document_number,
      bank_details: formData.bank_details,
      member_since: formData.member_since || new Date().toISOString(),
      shareCode: formData.shareCode,
      updatedAt: new Date(),
      userId: formData.userId,
      emailVerified: false,
    };

    if (customerDoc.exists()) {
      const existingCustomerData = customerDoc.data();
      const customerUpdate = {
        ...commonData,
        role: 'customer',
        customerID: formData.role === 'customer' ? formData.customerID : existingCustomerData.customerID,
      };
      delete customerUpdate.employeeID;
      delete customerUpdate.changeField;
      delete customerUpdate.type; // Remove type for customers
      delete customerUpdate.active; // Remove active for customers

      updates.push(updateDoc(doc(db, 'customers', formData.phone), customerUpdate));
    }

    if (employeeDoc.exists()) {
      const existingEmployeeData = employeeDoc.data();
      const employeeUpdate = {
        ...commonData,
        role: formData.role !== 'customer' ? formData.role : existingEmployeeData.role,
        employeeID: formData.role !== 'customer' ? formData.employeeID : existingEmployeeData.employeeID,
        type: 'employee', // Set type explicitly for employees
        active: true // Set active explicitly for employees
      };

      employeeChanges = trackEmployeeChanges(existingEmployeeData, employeeUpdate);
      if (employeeChanges.length > 0) {
        employeeUpdate.changeField = arrayUnion(...employeeChanges);
      }

      updates.push(updateDoc(doc(db, 'users_01', formData.phone), employeeUpdate));
    }

    if (!customerDoc.exists() && formData.role === 'customer') {
      const customerData = {
        ...commonData,
        role: 'customer',
        customerID: formData.customerID
      };
      delete customerData.employeeID;
      delete customerData.changeField;
      delete customerData.type; // Remove type for customers
      delete customerData.active; // Remove active for customers

      updates.push(setDoc(doc(db, 'customers', formData.phone), customerData));
    }

    if (!employeeDoc.exists() && formData.role !== 'customer') {
      const employeeData = {
        ...commonData,
        role: formData.role, // Fix: Use the intended role
        employeeID: formData.employeeID,
        type: 'employee', // Add type for new employees
        active: true, // Add active for new employees
        changeField: arrayUnion(...trackEmployeeChanges({}, formData))
      };

      updates.push(setDoc(doc(db, 'users_01', formData.phone), employeeData));
    }

    if (formData.role === 'customer' && employeeDoc?.exists()) {
      updates.push(
        updateDoc(doc(db, 'users_01', formData.phone), {
          originalRole: employeeDoc.data().role
        })
      );
      isConvertingToCustomer = true;
    }

    if (formData.role !== 'customer' && customerDoc?.exists()) {
      updates.push(
        updateDoc(doc(db, 'customers', formData.phone), {
          status: 'converted-to-employee',
          convertedAt: new Date()
        })
      );
    }

    await Promise.all(updates);

    setUser(prev => ({
      ...prev,
      ...formData,
      changeField: employeeDoc.exists() ? [...(prev.changeField || []), ...employeeChanges] : prev.changeField || [],
      originalRole: isConvertingToCustomer ? employeeDoc.data().role : prev.originalRole
    }));

    setSuccessMessage('User updated successfully!');
    setTimeout(() => navigate('/users'), 1000);
  } catch (err) {
    console.error('Update error:', err);
    setError(`Failed to update user: ${err.message}`);
  }
};
  const ChangeAwareDisplay = ({ field, value, changes }) => {
    if (!changes || changes.length === 0) return <span>{displayValue(value)}</span>;

    const latestChange = changes
      .filter(c => c.field === field || c.field.startsWith(`${field}.`))
      .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))[0];

    if (!latestChange) return <span>{displayValue(value)}</span>;

    return (
      <div className="flex items-center gap-2">
        <span>{displayValue(latestChange.newValue)}</span>
        <span className="text-green-600 text-sm font-medium">(new)</span>
      </div>
    );
  };

  const LoadingSkeleton = () => (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <Skeleton height={30} width={200} />
        <div className="flex">
          <Skeleton height={40} width={100} className="mr-2" />
          <Skeleton height={40} width={120} />
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-6 space-y-8">
        <div>
          <Skeleton height={25} width={250} className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array(6).fill(0).map((_, i) => (
              <div key={i}>
                <Skeleton height={15} width={100} className="mb-1" />
                <Skeleton height={20} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <Skeleton height={25} width={250} className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i}>
                <Skeleton height={15} width={100} className="mb-1" />
                <Skeleton height={20} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <Skeleton height={25} width={250} className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i}>
                <Skeleton height={15} width={100} className="mb-1" />
                <Skeleton height={20} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoading) return <LoadingSkeleton />;

  if (duplicateProfiles.length > 0 && isAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-xl font-bold text-red-600">Duplicate Profiles Found</h2>
          <p className="text-gray-600">Select which profile to view:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {duplicateProfiles.map((profile, index) => (
              <button
                key={index}
                onClick={() => handleProfileSelection(profile)}
                className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {profile.idType === 'customer' ? '👤 Customer' : '👨‍💼 Employee'}
                  </h3>
                  <span className="text-sm text-gray-500">
                    {new Date(profile.member_since).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-sm">Phone: {profile.phone}</p>
                  <p className="text-sm">
                    ID: {profile.idType === 'customer' ? profile.customerID : profile.employeeID}
                  </p>
                  <p className="text-sm">Role: <span className="capitalize">{profile.role}</span></p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">User Details</h1>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="ml-auto mr-2 bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
        >
          Go Back
        </button>
        {(isAdmin || isManager) && (
          <button
            onClick={handleEdit}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Edit User
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-lg">
          {successMessage}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 space-y-8">
        <div>
          <h3 className="text-lg font-semibold mb-4 pb-2 border-b border-gray-200 text-blue-600 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">User ID</label>
              <p className="mt-1 font-mono text-gray-800">{displayValue(user.userId)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {user.idType === 'customer' ? 'Customer ID' : 'Employee ID'}
              </label>
              <p className="mt-1 font-mono text-gray-800">
                {displayValue(user.idType === 'customer' ? user.customerID : user.employeeID)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <div className="mt-1 text-gray-800">
                <ChangeAwareDisplay field="name" value={user.name} changes={user?.changeField || []} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <div className="mt-1 flex items-center gap-2 text-gray-800">
                <ChangeAwareDisplay field="email" value={user.email} changes={user?.changeField || []} />
                {user?.emailVerified && (
                  <span className="text-green-600 text-sm font-semibold border border-green-600 px-2 py-0.5 rounded-full">
                    Verified
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <p className="mt-1 text-gray-800">{displayValue(user.phone)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <p className="mt-1 capitalize text-gray-800">{displayValue(user.role)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Member Since</label>
              <p className="mt-1 text-gray-800">{displayValue(new Date(user.member_since).toLocaleDateString())}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <div className="mt-1 text-gray-800">
                <ChangeAwareDisplay field="address" value={user.address} changes={user?.changeField || []} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
              <div className="mt-1 text-gray-800">
                <ChangeAwareDisplay field="dob" value={user.dob} changes={user?.changeField || []} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Document Number</label>
              <div className="mt-1 text-gray-800">
                <ChangeAwareDisplay field="document_number" value={user.document_number} changes={user?.changeField || []} />
              </div>
            </div>
          </div>
        </div>

        {user.role !== 'customer' && (
          <div>
            <h3 className="text-lg font-semibold mb-4 pb-2 border-b border-gray-200 text-blue-600 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
              </svg>
              Employee Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                <p className="mt-1 text-gray-800">{displayValue(user.employeeID)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Share Code</label>
                <div className="mt-1 text-gray-800">
                  <ChangeAwareDisplay field="shareCode" value={user.shareCode} changes={user?.changeField || []} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold mb-4 pb-2 border-b border-gray-200 text-blue-600 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
            </svg>
            Bank Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Bank Name</label>
              <div className="mt-1 text-gray-800">
                <ChangeAwareDisplay field="bank_details.bank_name" value={user.bank_details?.bank_name} changes={user?.changeField || []} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Account Number</label>
              <div className="mt-1 text-gray-800">
                <ChangeAwareDisplay field="bank_details.account_number" value={user.bank_details?.account_number} changes={user?.changeField || []} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Branch Name</label>
              <div className="mt-1 text-gray-800">
                <ChangeAwareDisplay field="bank_details.branch_name" value={user.bank_details?.branch_name} changes={user?.changeField || []} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Transition appear show={isEditOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setIsEditOpen(false)}>
          <div className="fixed inset-0 bg-black/30" />
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Dialog.Panel className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-xl">
                <Dialog.Title className="text-lg font-bold mb-4">Edit User</Dialog.Title>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Name*</label>
                      <input
                        value={formData.name}
                        onChange={(e) => {
                          if (editableFields.includes('name')) {
                            setFormData({ ...formData, name: e.target.value });
                            setError('');
                          }
                        }}
                        disabled={!editableFields.includes('name')}
                        className={`w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          !editableFields.includes('name') ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Email*</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => {
                          if (editableFields.includes('email')) {
                            setFormData({ ...formData, email: e.target.value });
                            setError('');
                          }
                        }}
                        disabled={!editableFields.includes('email')}
                        className={`w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          !editableFields.includes('email') ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Phone*</label>
                      <input
                        value={formData.phone}
                        onChange={(e) => {
                          if (editableFields.includes('phone')) {
                            setFormData({ ...formData, phone: e.target.value });
                            setError('');
                          }
                        }}
                        disabled={!editableFields.includes('phone')}
                        className={`w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          !editableFields.includes('phone') ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Role*</label>
                      <select
                        value={formData.role}
                        onChange={(e) => {
                          if (editableFields.includes('role')) {
                            setFormData({ ...formData, role: e.target.value });
                            setError('');
                          }
                        }}
                        disabled={!editableFields.includes('role')}
                        className={`w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          !editableFields.includes('role') ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                        }`}
                      >
                        <option value="customer">Customer</option>
                        <option value="teammember">Team Member</option>
                        <option value="manager">Manager</option>
                        <option value="teamleader">Team Leader</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    {formData.role === 'customer' ? (
                      <div>
                        <label className="block text-sm font-medium mb-1">Customer ID*</label>
                        <input
                          value={formData.customerID}
                          onChange={(e) => {
                            if (editableFields.includes('customerID')) {
                              setFormData({ ...formData, customerID: e.target.value });
                              setError('');
                            }
                          }}
                          disabled={!editableFields.includes('customerID')}
                          className={`w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            !editableFields.includes('customerID') ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                          }`}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium mb-1">Employee ID*</label>
                        <input
                          value={formData.employeeID}
                          onChange={(e) => {
                            if (editableFields.includes('employeeID')) {
                              setFormData({ ...formData, employeeID: e.target.value });
                              setError('');
                            }
                          }}
                          disabled={!editableFields.includes('employeeID')}
                          className={`w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            !editableFields.includes('employeeID') ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                          }`}
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium mb-1">Address</label>
                      <input
                        value={formData.address}
                        onChange={(e) => {
                          if (editableFields.includes('address')) {
                            setFormData({ ...formData, address: e.target.value });
                            setError('');
                          }
                        }}
                        disabled={!editableFields.includes('address')}
                        className={`w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          !editableFields.includes('address') ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={formData.dob}
                        onChange={(e) => {
                          if (editableFields.includes('dob')) {
                            setFormData({ ...formData, dob: e.target.value });
                            setError('');
                          }
                        }}
                        disabled={!editableFields.includes('dob')}
                        className={`w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          !editableFields.includes('dob') ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Document Number</label>
                      <input
                        value={formData.document_number}
                        onChange={(e) => {
                          if (editableFields.includes('document_number')) {
                            setFormData({ ...formData, document_number: e.target.value });
                            setError('');
                          }
                        }}
                        disabled={!editableFields.includes('document_number')}
                        className={`w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          !editableFields.includes('document_number') ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Share Code</label>
                      <input
                        value={formData.shareCode}
                        onChange={handleShareCodeChange}
                        placeholder="e.g., 12/34/56"
                        maxLength={8}
                        disabled={!editableFields.includes('shareCode')}
                        className={`w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          !editableFields.includes('shareCode') ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Bank Name</label>
                      <input
                        value={formData.bank_details.bank_name}
                        onChange={(e) => {
                          if (editableFields.includes('bank_details.bank_name')) {
                            setFormData({
                              ...formData,
                              bank_details: { ...formData.bank_details, bank_name: e.target.value }
                            });
                            setError('');
                          }
                        }}
                        disabled={!editableFields.includes('bank_details.bank_name')}
                        className={`w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          !editableFields.includes('bank_details.bank_name') ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Account Number</label>
                      <input
                        value={formData.bank_details.account_number}
                        onChange={(e) => {
                          if (editableFields.includes('bank_details.account_number')) {
                            setFormData({
                              ...formData,
                              bank_details: { ...formData.bank_details, account_number: e.target.value }
                            });
                            setError('');
                          }
                        }}
                        disabled={!editableFields.includes('bank_details.account_number')}
                        className={`w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          !editableFields.includes('bank_details.account_number') ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Branch Name</label>
                      <input
                        value={formData.bank_details.branch_name}
                        onChange={(e) => {
                          if (editableFields.includes('bank_details.branch_name')) {
                            setFormData({
                              ...formData,
                              bank_details: { ...formData.bank_details, branch_name: e.target.value }
                            });
                            setError('');
                          }
                        }}
                        disabled={!editableFields.includes('bank_details.branch_name')}
                        className={`w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          !editableFields.includes('bank_details.branch_name') ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                        }`}
                      />
                    </div>
                  </div>
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  {successMessage && <p className="text-green-500 text-sm">{successMessage}</p>}
                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      onClick={() => setIsEditOpen(false)}
                      className="px-4 py-2 border rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition appear show={isPhoneChangeAlertOpen} as={Fragment}>
        <Dialog as="div" className="relative z-20" onClose={() => setIsPhoneChangeAlertOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
                  <Dialog.Title className="text-lg font-bold mb-4">Phone Number Change Detected</Dialog.Title>
                  <div className="space-y-4">
                    <p className="text-gray-600">
                      You have changed the phone number from {user?.phone} to {newPhoneNumber}.
                      Do you want to proceed with the phone number change?
                    </p>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <div className="flex justify-end space-x-3 mt-6">
                      <button
                        onClick={() => setIsPhoneChangeAlertOpen(false)}
                        className="px-4 py-2 border rounded hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePhoneChangeAlertConfirm}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default UserDetails;