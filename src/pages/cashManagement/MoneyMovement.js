import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import dayjs from 'dayjs';

const MoneyMovementPage = () => {
  const [movements, setMovements] = useState([]);
  const [range, setRange] = useState({
    from: dayjs().startOf('day'),
    to: dayjs().endOf('day'),
  });
  const [selectedType, setSelectedType] = useState('all');
  const [userMap, setUserMap] = useState({});

  // ADD THIS BLOCK (This defines the types in your desired custom order)
  const predefinedTypes = [
    { value: 'all', label: 'All Types' }, // Keep 'All Types' at the very top
    { value: 'float_open', label: 'Open Cashier' },
    { value: 'cashier_close', label: 'Close Cashier' },
    { value: 'safe_count', label: 'Safe Count' },
    { value: 'banking', label: 'Banking' },
  ];

  const fetchMovements = async () => {
    let q = query(
      collection(db, 'moneyMovement'),
      where('timestamp', '>=', Timestamp.fromDate(range.from.toDate())),
      where('timestamp', '<=', Timestamp.fromDate(range.to.toDate())),
      orderBy('timestamp', 'desc')
    );

    if (selectedType !== 'all') {
      q = query(q, where('type', '==', selectedType));
    }

    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setMovements(data);
  };

  useEffect(() => {
    fetchMovements();
  }, [range, selectedType]); // Re-fetch movements when range or selectedType changes

  useEffect(() => {
    const fetchUsers = async () => {
      const usersSnapshot = await getDocs(collection(db, 'users_01'));
      const users = {};
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        users[data.employeeID] = data.name || data.employeeID;
      });
      setUserMap(users);
    };
    fetchUsers();
  }, []);

  const totalIn = movements.filter(m => m.direction === 'in').reduce((sum, m) => sum + m.amount, 0);
  const totalOut = movements.filter(m => m.direction === 'out').reduce((sum, m) => sum + m.amount, 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Money Movement Report</h1>

      <div className="flex gap-4 items-center">
        <label>From:</label>
        <input
          type="date"
          value={range.from.format('YYYY-MM-DD')}
          onChange={e =>
            setRange(r => ({
              ...r,
              from: dayjs(e.target.value).startOf('day'),
            }))
          }
          className="border px-2 py-1 rounded"
        />
        <label>To:</label>
        <input
          type="date"
          value={range.to.format('YYYY-MM-DD')}
          onChange={e =>
            setRange(r => ({
              ...r,
              to: dayjs(e.target.value).endOf('day'),
            }))
          }
          className="border px-2 py-1 rounded"
        />
        <label>Type:</label>
        <select
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
          className="border px-2 py-1 rounded"
        >
          {predefinedTypes.map(typeOption => ( // Now use the 'predefinedTypes' array directly
            <option key={typeOption.value} value={typeOption.value}>
              {typeOption.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-auto border rounded shadow">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-100 text-sm text-left">
            <tr>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Amount (£)</th>
              <th className="px-4 py-2">Direction</th>
              <th className="px-4 py-2">Session</th>
              <th className="px-4 py-2">Expected Amount (£)</th>
              <th className="px-4 py-2">Variance (£)</th>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Authorized By</th>
              <th className="px-4 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {movements.map(m => (
              <tr key={m.id} className="border-t hover:bg-gray-50 text-sm">
                <td className="px-4 py-2">{dayjs(m.timestamp.toDate()).format('YYYY-MM-DD HH:mm')}</td>
                <td className="px-4 py-2 capitalize">{m.type.replace(/_/g, ' ')}</td>
                <td className="px-4 py-2">{m.amount?.toFixed(2) ?? '0.00'}</td>
                <td className={`px-4 py-2 ${m.direction === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                  {m.direction.toUpperCase()}
                </td>
                <td className="px-4 py-2">{m.session ?? '—'}</td>
                <td className="px-4 py-2">{m.expectedAmount !== undefined ? m.expectedAmount.toFixed(2) : '—'}</td>
                <td className="px-4 py-2">{m.variance !== undefined ? m.variance.toFixed(2) : '—'}</td>
                <td className="px-4 py-2">{userMap[m.userId] || m.userId}</td>
               <td className="px-4 py-2">
                  {userMap[m.authorisedBy?.witnessEmployeeId] ||
                   m.authorisedBy?.witnessEmployeeId ||
                   '—'}
                </td>
                <td className="px-4 py-2">{m.note}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold text-sm">
              <td className="px-4 py-2" colSpan="2">Totals:</td>
              <td className="px-4 py-2 text-green-700">{totalIn.toFixed(2)} IN</td>
              <td className="px-4 py-2 text-red-700">{totalOut.toFixed(2)} OUT</td>
              <td colSpan="5"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default MoneyMovementPage;
