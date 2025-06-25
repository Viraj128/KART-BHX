import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../auth/AuthContext";
import { ROLES } from "../../config/roles";
import { FiEdit, FiTrash2, FiToggleLeft, FiToggleRight, FiPlus, FiSearch, FiX } from "react-icons/fi";
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { useNavigate } from "react-router-dom";

const Categories = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Role checks
  const isAdmin = user?.role === ROLES.ADMIN;
  const isManager = user?.role === ROLES.MANAGER;
  const isTeamLeader = user?.role === ROLES.TEAMLEADER;
  const isTeamMember = user?.role === ROLES.TEAMMEMBER;

  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingIdValue, setEditingIdValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Redirect Team Members to unauthorized page
  useEffect(() => {
    if (isTeamMember) {
      navigate('/unauthorized', { replace: true });
    }
  }, [isTeamMember, navigate]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const catRef = collection(db, "category");
      const snapshot = await getDocs(catRef);
      const data = snapshot.docs.map((doc) => ({
        firestoreId: doc.id,
        ...doc.data(),
      }));
      setCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin || isManager || isTeamLeader) {
      fetchCategories();
    }
  }, [isAdmin, isManager, isTeamLeader]);

  useEffect(() => {
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    const results = categories.filter((cat) =>
      cat.name.toLowerCase().includes(lowercasedSearchTerm)
    );
    setFilteredCategories(results);
  }, [categories, searchTerm]);

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

  const handleAddCategory = async () => {
    if (!isAdmin) {
      alert("You do not have permission to add categories.");
      return;
    }
    if (newCategory.trim() === "") {
      alert("Please enter a category name!");
      return;
    }

    try {
      const newNumber = categories.length + 1;
      const newId = `cat${newNumber.toString().padStart(2, "0")}`;

      await setDoc(doc(db, "category", newId), {
        id: newId,
        name: newCategory,
        active: true,
      });

      setCategories([...categories, {
        firestoreId: newId,
        id: newId,
        name: newCategory,
        active: true
      }]);
      setNewCategory("");
    } catch (error) {
      console.error("Error adding category:", error);
      alert("Failed to add category. Please try again.");
    }
  };

  const handleDeleteCategory = async (firestoreId) => {
    if (!isAdmin) {
      alert("You do not have permission to delete categories.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this category?")) return;

    try {
      await deleteDoc(doc(db, "category", firestoreId));
      setCategories(categories.filter((cat) => cat.firestoreId !== firestoreId));
    } catch (error) {
      console.error("Error deleting category:", error);
      alert("Failed to delete category. Please try again.");
    }
  };

  const handleUpdateCategory = async (firestoreId) => {
    if (!isAdmin) {
      alert("You do not have permission to edit categories.");
      return;
    }
    if (editingName.trim() === "" || editingIdValue.trim() === "") {
      alert("Category name and ID cannot be empty!");
      return;
    }

    try {
      const originalCategory = categories.find((cat) => cat.firestoreId === firestoreId);

      if (editingIdValue !== originalCategory.id) {
        // Delete the original document
        await deleteDoc(doc(db, "category", firestoreId));

        // Create a new document with the new ID
        await setDoc(doc(db, "category", editingIdValue), {
          id: editingIdValue,
          name: editingName,
          active: originalCategory.active,
        });

        // Update local state
        setCategories(
          categories.map((cat) =>
            cat.firestoreId === firestoreId
              ? { ...cat, firestoreId: editingIdValue, id: editingIdValue, name: editingName }
              : cat
          )
        );
      } else {
        // Only update the name if ID hasn't changed
        const docRef = doc(db, "category", firestoreId);
        await updateDoc(docRef, { name: editingName });

        setCategories(
          categories.map((cat) =>
            cat.firestoreId === firestoreId ? { ...cat, name: editingName } : cat
          )
        );
      }

      setEditingId(null);
      setEditingName("");
      setEditingIdValue("");
    } catch (error) {
      console.error("Error updating category:", error);
      alert("Failed to update category. Please try again.");
    }
  };

  const toggleActive = async (firestoreId, currentActive) => {
    try {
      const docRef = doc(db, "category", firestoreId);
      await updateDoc(docRef, { active: !currentActive });
      fetchCategories();
    } catch (error) {
      console.error("Error toggling category status:", error);
      alert("Failed to update category status. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Category Management</h1>
              <p className="text-gray-600 mt-1">
                Manage your product categories and organization
              </p>
            </div>
            <div className="mt-4 md:mt-0">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiSearch className="text-gray-400" />
                  </div>
                  <input
                    className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    placeholder="Search categories..."
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
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="mb-8 bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h2 className="text-lg font-semibold text-blue-800 mb-3">Add New Category</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  placeholder="Enter category name"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                />
                <button
                  className="flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                  onClick={handleAddCategory}
                >
                  <FiPlus className="mr-2" />
                  Add Category
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
                      ID
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <SkeletonTheme baseColor="#e5e7eb" highlightColor="#f3f4f6">
                      {[...Array(5)].map((_, index) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Skeleton width={60} height={24} />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <Skeleton width={150} height={24} />
                              <Skeleton width={60} height={24} className="ml-2" />
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <Skeleton width={32} height={32} circle />
                              <Skeleton width={32} height={32} circle />
                              <Skeleton width={32} height={32} circle />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </SkeletonTheme>
                  ) : filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-6 py-8 text-center text-gray-500">
                        {searchTerm ? "No matching categories found" : "No categories available"}
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((cat) => (
                      <tr key={cat.firestoreId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingId === cat.firestoreId ? (
                            <input
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                              value={editingIdValue}
                              onChange={(e) => setEditingIdValue(e.target.value)}
                              autoFocus
                              disabled={!isAdmin} // Disable input for non-Admins
                            />
                          ) : (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                              {cat.id}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {editingId === cat.firestoreId ? (
                            <input
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              disabled={!isAdmin} // Disable input for non-Admins
                            />
                          ) : (
                            <div className="flex items-center">
                              <span className="text-gray-900 font-medium">{cat.name}</span>
                              <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                                cat.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                              }`}>
                                {cat.active ? "Active" : "Inactive"}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {editingId === cat.firestoreId ? (
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => handleUpdateCategory(cat.firestoreId)}
                                className={`flex items-center px-4 py-2 rounded-lg text-white transition-colors ${
                                  isAdmin ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 cursor-not-allowed'
                                }`}
                                disabled={!isAdmin} // Disable Save button for non-Admins
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingName("");
                                  setEditingIdValue("");
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
                                  setEditingId(cat.firestoreId);
                                  setEditingName(cat.name);
                                  setEditingIdValue(cat.id);
                                }}
                                className={`p-2 rounded-lg transition-colors ${
                                  isAdmin ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 cursor-not-allowed'
                                }`}
                                title="Edit"
                                disabled={!isAdmin} // Disable Edit button for non-Admins
                              >
                                <FiEdit size={18} />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat.firestoreId)}
                                className={`p-2 rounded-lg transition-colors ${
                                  isAdmin ? 'text-red-600 hover:bg-red-50' : 'text-gray-400 cursor-not-allowed'
                                }`}
                                title="Delete"
                                disabled={!isAdmin} // Disable Delete button for non-Admins
                              >
                                <FiTrash2 size={18} />
                              </button>
                              <button
                                onClick={() => toggleActive(cat.firestoreId, cat.active)}
                                className={`p-2 rounded-lg transition-colors ${
                                  cat.active ? "text-yellow-600 hover:bg-yellow-50" : "text-gray-600 hover:bg-gray-50"
                                }`}
                                title={cat.active ? "Deactivate" : "Activate"}
                              >
                                {cat.active ? (
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

          {!loading && filteredCategories.length > 0 && (
            <div className="mt-4 text-sm text-gray-500">
              Showing {filteredCategories.length} of {categories.length} categories
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Categories;