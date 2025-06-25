import React, { useEffect, useState } from 'react';
import { db } from '../../firebase/config';
import { collection, onSnapshot, setDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../../auth/AuthContext';
import { ROLES } from '../../config/roles';
import { FiEdit, FiTrash2, FiPlus, FiSearch, FiX, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const Sauces = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Role checks
  const isAdmin = user?.role === ROLES.ADMIN;
  const isManager = user?.role === ROLES.MANAGER;
  const isTeamLeader = user?.role === ROLES.TEAMLEADER;
  const isTeamMember = user?.role === ROLES.TEAMMEMBER;

  const [groups, setGroups] = useState([]);
  const [categoryName, setCategoryName] = useState('');
  const [saucesInput, setSaucesInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingSauces, setEditingSauces] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Redirect Team Members to unauthorized page
  useEffect(() => {
    if (isTeamMember) {
      navigate('/unauthorized', { replace: true });
    }
  }, [isTeamMember, navigate]);

  useEffect(() => {
    if (isAdmin || isManager || isTeamLeader) {
      setLoading(true);
      const unsubscribe = onSnapshot(collection(db, "sauceGroups"), (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setGroups(data);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [isAdmin, isManager, isTeamLeader]);

  useEffect(() => {
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    const results = groups.filter((group) =>
      group.id.toLowerCase().includes(lowercasedSearchTerm)
    );
    setFilteredGroups(results);
  }, [groups, searchTerm]);

  const toggleActive = async (groupId, currentActive) => {
    try {
      const newActiveStatus = currentActive !== false; // If undefined or true, set to false; if false, set to true
      const docRef = doc(db, 'sauceGroups', groupId);
      await updateDoc(docRef, { active: !newActiveStatus });
      setGroups(groups.map(group => 
        group.id === groupId ? { ...group, active: !newActiveStatus } : group
      ));
    } catch (error) {
      console.error("Error toggling sauce group status:", error);
      alert("Failed to update sauce group status. Please try again.");
    }
  };

  // Check if user has access
  if (!isAdmin && !isManager && !isTeamLeader) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md p-6 bg-white rounded-xl shadow-md text-center">
          <div className="text-3xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Required</h2>
          <p className="text-gray-600">
            You don't have permission to access this page. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  const handleAddGroup = async () => {
    if (!isAdmin) {
      alert('You do not have permission to add sauce groups.');
      return;
    }
    if (categoryName.trim() === '') {
      alert('Please enter a category name!');
      return;
    }
    if (saucesInput.trim() === '') {
      alert('Please enter at least one sauce!');
      return;
    }

    try {
      const saucesArray = saucesInput.split(',').map(s => s.trim());
      const docRef = doc(db, 'sauceGroups', categoryName);

      await setDoc(docRef, {
        sauces: saucesArray,
        active: true // Add active status by default
      });

      setGroups([...groups, { id: categoryName, sauces: saucesArray, active: true }]);
      setCategoryName('');
      setSaucesInput('');
    } catch (error) {
      console.error("Error adding sauce group:", error);
      alert("Failed to add sauce group. Please try again.");
    }
  };

  const handleUpdateGroup = async (id) => {
    if (!isAdmin) {
      alert('You do not have permission to edit sauce groups.');
      return;
    }
    if (editingSauces.trim() === '') {
      alert('Please enter at least one sauce!');
      return;
    }

    try {
      const saucesArray = editingSauces.split(',').map(s => s.trim());
      const docRef = doc(db, 'sauceGroups', id);

      await updateDoc(docRef, {
        sauces: saucesArray,
      });

      setGroups(groups.map(g => g.id === id ? { ...g, sauces: saucesArray } : g));
      setEditingId(null);
      setEditingSauces('');
    } catch (error) {
      console.error("Error updating sauce group:", error);
      alert("Failed to update sauce group. Please try again.");
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!isAdmin) {
      alert('You do not have permission to delete sauce groups.');
      return;
    }
    if (!window.confirm("Are you sure you want to delete this sauce group?")) return;

    try {
      await deleteDoc(doc(db, 'sauceGroups', id));
      setGroups(groups.filter(g => g.id !== id));
    } catch (error) {
      console.error("Error deleting sauce group:", error);
      alert("Failed to delete sauce group. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Sauce Group Management</h1>
              <p className="text-gray-600 mt-1">
                Manage your sauce groups and organization
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center space-x-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiSearch className="text-gray-400" />
                </div>
                <input
                  className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  placeholder="Search by category name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <FiX className="text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
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

          {isAdmin && (
            <div className="mb-8 bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h2 className="text-lg font-semibold text-blue-800 mb-3">Add New Sauce Group</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category Name
                  </label>
                  <input
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    placeholder="Category name"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sauces (comma separated)
                  </label>
                  <input
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    placeholder="Sauce1, Sauce2, Sauce3"
                    value={saucesInput}
                    onChange={(e) => setSaucesInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddGroup()}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  className="flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                  onClick={handleAddGroup}
                >
                  <FiPlus className="mr-2" />
                  Add Sauce Group
                </button>
              </div>
            </div>
          )}

          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Category
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Sauces
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center">
                        <div className="flex justify-center">
                          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                        </div>
                        <p className="mt-2 text-gray-600">Loading sauce groups...</p>
                      </td>
                    </tr>
                  ) : filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                        {searchTerm ? "No matching sauce groups found" : "No sauce groups available"}
                      </td>
                    </tr>
                  ) : (
                    filteredGroups.map((group) => (
                      <tr key={group.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                            {group.id}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {editingId === group.id ? (
                            <input
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                              value={editingSauces}
                              onChange={(e) => setEditingSauces(e.target.value)}
                              placeholder="Sauces (comma separated)"
                              autoFocus
                              disabled={!isAdmin}
                            />
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {group.sauces.map((sauce, index) => (
                                <span
                                  key={index}
                                  className="px-2 py-1 bg-gray-100 text-gray-800 text-sm rounded-full"
                                >
                                  {sauce}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            group.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }`}>
                            {group.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {editingId === group.id ? (
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => handleUpdateGroup(group.id)}
                                className={`flex items-center px-4 py-2 rounded-lg text-white transition-colors ${
                                  isAdmin ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 cursor-not-allowed'
                                }`}
                                disabled={!isAdmin}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingSauces('');
                                }}
                                className="flex items-center bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => {
                                  setEditingId(group.id);
                                  setEditingSauces(group.sauces.join(', '));
                                }}
                                className={`p-2 rounded-lg transition-colors ${
                                  isAdmin ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 cursor-not-allowed'
                                }`}
                                title="Edit"
                                disabled={!isAdmin}
                              >
                                <FiEdit size={18} />
                              </button>
                              <button
                                onClick={() => handleDeleteGroup(group.id)}
                                className={`p-2 rounded-lg transition-colors ${
                                  isAdmin ? 'text-red-600 hover:bg-red-50' : 'text-gray-400 cursor-not-allowed'
                                }`}
                                title="Delete"
                                disabled={!isAdmin}
                              >
                                <FiTrash2 size={18} />
                              </button>
                              <button
                                onClick={() => toggleActive(group.id, group.active)}
                                className={`p-2 rounded-lg transition-colors ${
                                  group.active ? "text-yellow-600 hover:bg-yellow-50" : "text-gray-600 hover:bg-gray-50"
                                }`}
                                title={group.active ? "Deactivate" : "Activate"}
                              >
                                {group.active ? (
                                  <FiToggleRight size={20} />
                                ) : (
                                  <FiToggleLeft size={20} />
                                )}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {!loading && filteredGroups.length > 0 && (
            <div className="mt-4 text-sm text-gray-500">
              Showing {filteredGroups.length} of {groups.length} sauce groups
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sauces;