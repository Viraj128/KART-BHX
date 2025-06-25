import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../auth/AuthContext';
import { ROLES } from '../../config/roles';
import { FiEdit, FiTrash2, FiToggleLeft, FiToggleRight, FiPlus, FiSearch, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const ItemsManager = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Role checks
  const isAdmin = user?.role === ROLES.ADMIN;
  const isManager = user?.role === ROLES.MANAGER;
  const isTeamLeader = user?.role === ROLES.TEAMLEADER;
  const isTeamMember = user?.role === ROLES.TEAMMEMBER;

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sauceGroups, setSauceGroups] = useState([]);
  const [form, setForm] = useState({
    itemName: '',
    price: '',
    categoryId: '',
    sauceGroupId: '',
    sauceName: '',
    components: [{ itemId: '', quantity: '' }],
  });
  const [editId, setEditId] = useState(null);
  const [searchField, setSearchField] = useState('itemName');
  const [searchTerm, setSearchTerm] = useState('');

  // Redirect Team Members to unauthorized page
  useEffect(() => {
    if (isTeamMember) {
      navigate('/unauthorized', { replace: true });
    }
  }, [isTeamMember, navigate]);

  useEffect(() => {
    if (isAdmin || isManager || isTeamLeader) {
      const unsubscribe = onSnapshot(collection(db, 'items'), snapshot => {
        setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsubscribe();
    }
  }, [isAdmin, isManager, isTeamLeader]);

  useEffect(() => {
    const fetchCategories = async () => {
      const snapshot = await getDocs(collection(db, 'category'));
      setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    if (isAdmin || isManager || isTeamLeader) {
      fetchCategories();
    }
  }, [isAdmin, isManager, isTeamLeader]);

  useEffect(() => {
    const fetchSauceGroups = async () => {
      const snapshot = await getDocs(collection(db, 'sauceGroups'));
      const sauces = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSauceGroups(sauces);
    };
    if (isAdmin || isManager || isTeamLeader) {
      fetchSauceGroups();
    }
  }, [isAdmin, isManager, isTeamLeader]);

  const handleComponentChange = (index, field, value) => {
    const newComponents = [...form.components];
    newComponents[index] = { ...newComponents[index], [field]: value };
    setForm({ ...form, components: newComponents });
  };

  const addComponentField = () => {
    setForm({ ...form, components: [...form.components, { itemId: '', quantity: '' }] });
  };

  const removeComponentField = (index) => {
    setForm({ ...form, components: form.components.filter((_, i) => i !== index) });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!isAdmin) {
      alert('You do not have permission to add or update items.');
      return;
    }

    if (!form.itemName.trim() || !form.price || !form.categoryId) {
      alert('Please fill in item name, price, and category.');
      return;
    }

    const componentsMap = form.components.reduce((acc, comp, index) => {
      if (comp.itemId && comp.quantity) {
        acc[index] = { itemId: comp.itemId, quantity: Number(comp.quantity) };
      }
      return acc;
    }, {});

    const itemData = {
      itemName: form.itemName.trim(),
      price: Number(form.price),
      categoryId: form.categoryId ? doc(db, 'category', form.categoryId) : null,
      sauces: form.sauceGroupId ? doc(db, 'sauceGroups', form.sauceGroupId) : null,
      sauceName: form.sauceName || '',
      components: componentsMap,
      active: true, // Default to active for new items
    };

    try {
      if (editId) {
        await updateDoc(doc(db, 'items', editId), itemData);
        setEditId(null);
      } else {
        const snapshot = await getDocs(collection(db, 'items'));
        const newId = `item${(snapshot.size + 1).toString().padStart(2, '0')}`;
        await setDoc(doc(db, 'items', newId), { ...itemData, id: newId });
      }

      setForm({
        itemName: '',
        price: '',
        categoryId: '',
        sauceGroupId: '',
        sauceName: '',
        components: [{ itemId: '', quantity: '' }],
      });
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save item. Please try again.');
    }
  };

  const handleEdit = item => {
    if (!isAdmin) {
      alert('You do not have permission to edit items.');
      return;
    }
    const componentsArray = item.components
      ? Object.keys(item.components).map(key => ({
          itemId: item.components[key].itemId,
          quantity: item.components[key].quantity.toString(),
        }))
      : [{ itemId: '', quantity: '' }];

    setForm({
      itemName: item.itemName || '',
      price: item.price || '',
      categoryId: item.categoryId?.id || '',
      sauceGroupId: item.sauces?.id || '',
      sauceName: item.sauceName || '',
      components: componentsArray,
    });
    setEditId(item.id);
  };

  const handleDelete = async id => {
    if (!isAdmin) {
      alert('You do not have permission to delete items.');
      return;
    }
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteDoc(doc(db, 'items', id));
      } catch (error) {
        console.error('Error deleting item:', error);
        alert('Failed to delete item. Please try again.');
      }
    }
  };

  const handleToggleActive = async (id, currentActive) => {
    try {
      await updateDoc(doc(db, 'items', id), { active: !currentActive });
    } catch (error) {
      console.error('Error toggling item status:', error);
      alert('Failed to update active status.');
    }
  };

  const filteredItems = items.filter(item => {
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();

    switch (searchField) {
      case 'itemName':
        return item.itemName?.toLowerCase().includes(term);
      case 'categoryId':
        const cat = categories.find(cat => cat.id === item.categoryId?.id);
        const catName = cat?.name?.toLowerCase() || '';
        const catId = item.categoryId?.id || '';
        return catName.includes(term) || catId.toLowerCase().includes(term);
      case 'price':
        return item.price?.toString().includes(term);
      default:
        return true;
    }
  });

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

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Item Management</h1>
              <p className="text-gray-600 mt-1">Manage your items and organization</p>
            </div>
            <div className="mt-4 md:mt-0">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiSearch className="text-gray-400" />
                  </div>
                  <select
                    value={searchField}
                    onChange={e => setSearchField(e.target.value)}
                    className="appearance-none w-32 p-2 border rounded mr-2 text-gray-700"
                  >
                    <option value="itemName">Item Name</option>
                    <option value="categoryId">Category</option>
                    <option value="price">Price</option>
                  </select>
                  <input
                    type="text"
                    placeholder={`Search by ${
                      searchField === 'categoryId'
                        ? 'Category Name or ID'
                        : searchField.charAt(0).toUpperCase() + searchField.slice(1)
                    }...`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
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
              <h2 className="text-lg font-semibold text-blue-800 mb-3">
                {editId ? 'Update Item' : 'Add New Item'}
              </h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="Item Name"
                    value={form.itemName}
                    onChange={e => setForm({ ...form, itemName: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    required
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={form.categoryId}
                    onChange={e => setForm({ ...form, categoryId: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    required
                  >
                    <option value="">— Select Category —</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name || cat.id}
                      </option>
                    ))}
                  </select>
                  <select
                    value={form.sauceGroupId}
                    onChange={e => setForm({ ...form, sauceGroupId: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  >
                    <option value="">— No Sauce Group —</option>
                    {sauceGroups.map(sg => (
                      <option key={sg.id} value={sg.id}>
                        {sg.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="Sauce Name"
                    value={form.sauceName}
                    onChange={e => setForm({ ...form, sauceName: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-gray-700">Components</h3>
                  {form.components.map((comp, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Item ID"
                        value={comp.itemId}
                        onChange={e => handleComponentChange(index, 'itemId', e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                      />
                      <input
                        type="number"
                        placeholder="Quantity"
                        value={comp.quantity}
                        onChange={e => handleComponentChange(index, 'quantity', e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                      />
                      {form.components.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeComponentField(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <FiX size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addComponentField}
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <FiPlus size={16} />
                    Add Component
                  </button>
                </div>
                <button
                  type="submit"
                  className="flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <FiPlus className="mr-2" />
                  {editId ? 'Update Item' : 'Add Item'}
                </button>
              </form>
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
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Price
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Category
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Sauces
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Components
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                        {searchTerm ? 'No matching items found' : 'No items available'}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map(item => {
                      const categoryName =
                        categories.find(cat => cat.id === item.categoryId?.id)?.name || item.categoryId?.id || '—';
                      const sauceGroup = sauceGroups.find(sg => sg.id === item.sauces?.id);
                      const saucesList = sauceGroup?.sauces ? sauceGroup.sauces.join(', ') : item.sauceName || '—';
                      const componentsList = item.components
                        ? Object.values(item.components)
                            .map(comp => `${comp.itemId}: ${comp.quantity}`)
                            .join(', ')
                        : '—';

                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                              {item.id}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <span className="text-gray-900 font-medium">{item.itemName}</span>
                              <span
                                className={`ml-2 px-2 py-1 text-xs rounded-full ${
                                  item.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {item.active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900">{item.price}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                              {categoryName}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-gray-900">{saucesList}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-gray-900">{componentsList}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => handleEdit(item)}
                                className={`p-2 rounded-lg transition-colors ${
                                  isAdmin ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 cursor-not-allowed'
                                }`}
                                title="Edit"
                                disabled={!isAdmin}
                              >
                                <FiEdit size={18} />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className={`p-2 rounded-lg transition-colors ${
                                  isAdmin ? 'text-red-600 hover:bg-red-50' : 'text-gray-400 cursor-not-allowed'
                                }`}
                                title="Delete"
                                disabled={!isAdmin}
                              >
                                <FiTrash2 size={18} />
                              </button>
                              <button
                                onClick={() => handleToggleActive(item.id, item.active)}
                                className={`p-2 rounded-lg transition-colors ${
                                  item.active
                                    ? 'text-yellow-600 hover:bg-yellow-50'
                                    : 'text-gray-600 hover:bg-gray-50'
                                }`}
                                title={item.active ? 'Deactivate' : 'Activate'}
                              >
                                {item.active ? (
                                  <FiToggleRight size={20} />
                                ) : (
                                  <FiToggleLeft size={20} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {filteredItems.length > 0 && (
            <div className="mt-4 text-sm text-gray-500">
              Showing {filteredItems.length} of {items.length} items
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemsManager;