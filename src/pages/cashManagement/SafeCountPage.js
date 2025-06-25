// import React, { useState, useEffect, useMemo } from 'react';
// import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
// import { db } from '../../firebase/config';
// import SafeCountTable from './SafeCountTable';
// import DatePicker from 'react-datepicker';
// import 'react-datepicker/dist/react-datepicker.css';


// function SafeCountPage() {
//   const [currentSession, setCurrentSession] = useState(null);
//   const [disabledSessions, setDisabledSessions] = useState(['changeover', 'night']);
//   const [isReadOnly, setIsReadOnly] = useState(false);
//   const [showTransferTable, setShowTransferTable] = useState(false);
//   const [authDisabled, setAuthDisabled] = useState(false);
//   const [saveDisabled, setSaveDisabled] = useState(false);
//   const [selectedDate, setSelectedDate] = useState(new Date());
//   const [authCashierId, setAuthCashierId] = useState('');
//   const [authWitnessId, setAuthWitnessId] = useState('');
//   const [confirmCashier, setConfirmCashier] = useState(false);
//   const [confirmManager, setConfirmManager] = useState(false);

//   const currentDateStr = selectedDate.toISOString().slice(0, 10);

//   const denominations = useMemo(() => [
//     { name: '1p', value: 0.01, bagValue: 100.00 },
//     { name: '2p', value: 0.02, bagValue: 50.00 },
//     { name: '5p', value: 0.05, bagValue: 100.00 },
//     { name: '10p', value: 0.1, bagValue: 50.00 },
//     { name: '20p', value: 0.2, bagValue: 50.00 },
//     { name: '50p', value: 0.5, bagValue: 20.00 },
//     { name: '£1', value: 1.00, bagValue: 20.00 },
//     { name: '£2', value: 2.00, bagValue: 10.00 },
//     { name: '£5', value: 5.00, bagValue: 0.00 },
//     { name: '£10', value: 10.00, bagValue: 0.00 },
//     { name: '£20', value: 20.00, bagValue: 0.00 },
//     { name: '£50', value: 50.00, bagValue: 0.00 },
//   ], []);

//   const [values, setValues] = useState(denominations.map(() => ({ bags: 0, loose: 0, value: 0 })));
//   const [actualAmount, setActualAmount] = useState(0);
//   const [expectedAmount, setExpectedAmount] = useState(0);
//   const [variance, setVariance] = useState(0);

//   const today = new Date().toISOString().slice(0, 10);

//   const [savedSessions, setSavedSessions] = useState({
//     morning: false,
//     changeover: false,
//     night: false,
//   });

//   const [transferValues, setTransferValues] = useState([
//     { name: '£5', loose: 0, value: 0 },
//     { name: '£10', loose: 0, value: 0 },
//     { name: '£20', loose: 0, value: 0 },
//     { name: '£50', loose: 0, value: 0 },
//   ]);

//   const [transferTotal, setTransferTotal] = useState(0);

//   useEffect(() => {
//     const fetchData = async () => {
//       const docRef = doc(db, 'safeCounts', currentDateStr);
//       const docSnap = await getDoc(docRef);
//       if (docSnap.exists()) {
//         const savedData = docSnap.data();
//         setSavedSessions({
//           morning: !!savedData.morning,
//           changeover: !!savedData.changeover,
//           night: !!savedData.night,
//         });
//       }
//     };
//     fetchData();
//   }, [currentDateStr]);

//   useEffect(() => {
//     let newDisabledSessions = ['changeover', 'night'];
//     if (savedSessions.morning) newDisabledSessions = newDisabledSessions.filter(s => s !== 'changeover');
//     if (savedSessions.changeover) newDisabledSessions = newDisabledSessions.filter(s => s !== 'night');
//     setDisabledSessions(newDisabledSessions);
//   }, [savedSessions]);

//   const handleSave = async () => {
//     if (!confirmCashier || !confirmManager) {
//       alert('Both cashier and manager must confirm.');
//       return;
//     }

//     const cashierQuery = query(
//       collection(db,"users_01"),
//       where("employeeID", "==", authCashierId.trim()),
      
//       // should log 'string'

//     );
//     console.log(typeof authCashierId.trim())
//     const cashierSnap = await getDocs(cashierQuery);
//     if (cashierSnap.empty) {
//       alert('Invalid Employee ID for cashier.');
//       return;
//     }

//     const managerQuery = query(
//       collection(db, 'users_01'),
//       where("employeeID", "==", authWitnessId.trim()),
//       where("role", "in", ["manager", "teamleader"])
//     );
//     const managerSnap = await getDocs(managerQuery);
//     if (managerSnap.empty) {
//       alert('Invalid witness ID or not a manager/team leader.');
//       return;
//     }

//     if (savedSessions[currentSession]) {
//       alert(`${currentSession} session has already been saved.`);
//       return;
//     }

//     // Only include expectedAmount and variance if not change_receive
//     const data =
//       currentSession === 'change_receive'
//         ? {
//             actualAmount,
//             values,
//             cashier: authCashierId,
//             manager: authWitnessId,
//           }
//         : {
//             expectedAmount,
//             actualAmount,
//             variance,
//             values,
//             cashier: authCashierId,
//             manager: authWitnessId,
//           };

//     const docRef = doc(db, 'safeCounts', currentDateStr);
//     await setDoc(docRef, { [currentSession]: data }, { merge: true });
//     alert(`Data for ${currentSession} saved!`);

//     setSavedSessions(prev => ({ ...prev, [currentSession]: true }));
//     setValues(denominations.map(() => ({ bags: 0, loose: 0, value: 0 })));
//     setActualAmount(0);
//     setExpectedAmount(0);
//     setVariance(0);
//     setCurrentSession(null);
//     setAuthCashierId('');
//     setAuthWitnessId('');
//     setConfirmCashier(false);
//     setConfirmManager(false);
//     setAuthDisabled(true);
//     setSaveDisabled(true);
//   };

//   const handleSessionSelect = async (session) => {
    
//     setCurrentSession(session);
//     setShowTransferTable(false);

//     const docRef = doc(db, 'safeCounts', currentDateStr);
//     const docSnap = await getDoc(docRef);

//     if (docSnap.exists() && docSnap.data()[session]) {
//       const savedData = docSnap.data()[session];
//       setValues(savedData.values);
//       setActualAmount(savedData.actualAmount);
//       setExpectedAmount(savedData.expectedAmount);
//       setVariance(savedData.variance);
//       setIsReadOnly(true);
//       setAuthDisabled(true);
//       setSaveDisabled(true);
//     } else {
//       setValues(denominations.map(() => ({ bags: 0, loose: 0, value: 0 })));
//       setIsReadOnly(false);
//       await calculateExpectedAmount(session);
//       setActualAmount(0);
//       setVariance(0);

//       setAuthCashierId('');
//       setAuthWitnessId('');
//       setConfirmCashier(false);
//       setConfirmManager(false);
      
//       setAuthDisabled(false);
//       setSaveDisabled(false);
//     }
//   };

//   const handleTransferFloats = () => {
//     const transferData = denominations
//       .map((d, index) => ({ name: d.name, loose: values[index].loose, value: values[index].loose * d.value }))
//       .filter(d => ['£5', '£10', '£20', '£50'].includes(d.name));

//     setTransferValues(transferData);
//     const total = transferData.reduce((sum, d) => sum + d.value, 0);
//     setTransferTotal(total);
//     setShowTransferTable(true);
//   };

//   const calculateExpectedAmount = async (session) => {
//     const todayRef = doc(db, 'safeCounts', today);
//     const todaySnap = await getDoc(todayRef);
//     const todayData = todaySnap.exists() ? todaySnap.data() : {};

//     const transferTotal = todayData.TransferFloats?.total || 0;
//     const changeReceive = todayData.change_receive ?.actualAmount || 0;

//     const yesterday = new Date();
//     yesterday.setDate(yesterday.getDate() - 1);
//     const yesterdayStr = yesterday.toISOString().slice(0, 10);
//     const yesterdayRef = doc(db, 'safeCounts', yesterdayStr);
//     const yesterdaySnap = await getDoc(yesterdayRef);
//     const yesterdayData = yesterdaySnap.exists() ? yesterdaySnap.data() : {};

//     let expected = 0;

//     if (session === 'morning') {
//        const nightActual = yesterdayData.night?.actualAmount || 0;
//        expected = nightActual + changeReceive - transferTotal;
//     } else if (session === 'changeover') {
//       const morningActual = todayData.morning ?.actualAmount || 0;
//       expected = morningActual + changeReceive - transferTotal;
//     } else if (session === 'night') {
//       const changeoverActual = todayData.changeover ?.actualAmount || 0;
//       expected = changeoverActual + changeReceive - transferTotal;
//     }

//     setExpectedAmount(expected);
//   };

//   const handleSaveTransferFloats = async () => {
//     const docRef = doc(db, 'safeCounts', currentDateStr);
//     await setDoc(docRef, {
//       TransferFloats: {
//         values: transferValues,
//         total: transferTotal,
//         cashier:authCashierId,
//         manager:authWitnessId
//       }
//     }, { merge: true });

//     alert('Transfer Floats saved!');
//     setShowTransferTable(false);
//   };

//   const fetchSessionsForDate = async (date) => {
//     const dateStr = date.toISOString().slice(0, 10);
//     const docRef = doc(db, 'safeCounts', dateStr);
//     const docSnap = await getDoc(docRef);

//     if (docSnap.exists()) {
//       const savedData = docSnap.data();
//       setSavedSessions({
//         morning: !!savedData.morning,
//         changeover: !!savedData.changeover,
//         night: !!savedData.night,
//       });

//       if (dateStr !== today) {
//         setIsReadOnly(true);
//         setAuthDisabled(true);
//         setSaveDisabled(true);
//       } else {
//         setIsReadOnly(false);
//         setAuthDisabled(false);
//         setSaveDisabled(false);
//       }

//     } else {
//       setSavedSessions({ morning: false, changeover: false, night: false });
//       setIsReadOnly(dateStr !== today);
//       setAuthDisabled(dateStr !== today);
//       setSaveDisabled(dateStr !== today);
//     }
//   };

//   useEffect(() => {
//     fetchSessionsForDate(selectedDate);
//     setCurrentSession(null); // Reset session on date change
//     setShowTransferTable(false);
//   }, [selectedDate]);

//   function SessionButtons({ sessions, currentSession, onSelect, disabledSessions, onTransferFloats }) {
//     return (
//       <div className="flex flex-wrap gap-4 mb-6">
//         {sessions.map((session) => (
//           <button
//             key={session}
//             onClick={() => onSelect(session)}
//             disabled={disabledSessions.includes(session)}
//             className={`px-5 py-3 rounded-lg font-medium text-sm sm:text-base transition-colors
//               ${
//                 currentSession === session 
//                   ? 'bg-blue-800 text-white' 
//                   : 'bg-blue-600 text-white hover:bg-blue-700'
//               }
//               ${
//                 disabledSessions.includes(session)
//                   ? 'disabled:bg-gray-300 disabled:cursor-not-allowed'
//                   : ''
//               }`}
//           >
//             {session.replace(/_/g, ' ').toUpperCase()}
//           </button>
//         ))}
//         <button
//           onClick={onTransferFloats}
//           className="px-5 py-3 bg-purple-600 text-white rounded-lg font-medium text-sm sm:text-base hover:bg-purple-700 transition-colors"
//         >
//           TRANSFER FLOATS
//         </button>
//       </div>
//     );
//   }


// return (
//   <div className="container mx-auto p-6 max-w-5xl bg-white rounded-2xl shadow-lg mt-10 mb-10">
//     <div className="mb-4">
//       <h2 className="text-3xl font-bold text-black-500 tracking-tight text-center w-full">
//         Safe Count
//       </h2>
//     </div>
//     {/* Date Picker */}
//     <div className="flex justify-end mb-10">
//       <div className="bg-blue-50 p-4 rounded-xl shadow flex items-center gap-4">
//         <span className="font-semibold text-blue-700">Select Date:</span>
//         <DatePicker
//           selected={selectedDate}
//           onChange={date => setSelectedDate(date)}
//           dateFormat="yyyy-MM-dd"
//           className="border px-4 py-2 rounded-md text-lg focus:ring-2 focus:ring-blue-400"
//           maxDate={new Date()}
//         />
//       </div>
//     </div>
//     {/* Session Buttons */}
//     <div className="mb-8">
//       <SessionButtons
//         sessions={['morning', 'changeover', 'night', 'change_receive']}
//         currentSession={currentSession}
//         onSelect={handleSessionSelect}
//         disabledSessions={disabledSessions}
//         onTransferFloats={handleTransferFloats}
//       />
//     </div>

//     {currentSession && !showTransferTable && (
//       <div className="bg-gray-50 rounded-xl shadow p-6 mt-6 space-y-8 border border-gray-200">
//         <h3 className="text-2xl font-bold text-blue-700 mb-4 capitalize">
//           {currentSession.replace(/_/g, ' ')} Session
//           </h3>

//         <SafeCountTable
//           denominations={denominations}
//           values={values}
//           onChange={(index, type, value) => {
//             const updatedValues = [...values];
//             updatedValues[index][type] = parseFloat(value) || 0;
//             updatedValues[index].value =
//               (denominations[index].value * updatedValues[index].bags * denominations[index].bagValue) +
//               (updatedValues[index].loose * denominations[index].value);
//             setValues(updatedValues);
//             const total = updatedValues.reduce((sum, row) => sum + row.value, 0);
//             setActualAmount(total);
//             setVariance(total - expectedAmount);
//           }}
//           actualAmount={actualAmount}
//           onActualChange={e => {
//             const actual = parseFloat(e.target.value) || 0;
//             setActualAmount(actual);
//             setVariance(actual - expectedAmount);
//           }}
//           expectedAmount={expectedAmount}
//           variance={variance}
//           readOnly={isReadOnly}
//           session={currentSession} // <-- add this line
//         />

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
//           <div className="space-y-4 bg-white p-4 rounded-lg shadow">
//             <label className="block">
//               <span className="text-sm font-medium text-gray-700">Cashier ID</span>
//               <input
//                 className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
//                 value={authCashierId}
//                 onChange={(e) => setAuthCashierId(e.target.value)}
//                 disabled={authDisabled}
//               />
//             </label>
//             <label className="flex items-center space-x-2">
//               <input
//                 type="checkbox"
//                 className="h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
//                 checked={confirmCashier}
//                 onChange={(e) => setConfirmCashier(e.target.checked)}
//                 disabled={authDisabled}
//               />
//               <span className="text-sm text-gray-700">Confirm Cashier</span>
//             </label>
//           </div>

//           <div className="space-y-4 bg-white p-4 rounded-lg shadow">
//             <label className="block">
//               <span className="text-sm font-medium text-gray-700">Witness ID</span>
//               <input
//                 className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
//                 value={authWitnessId}
//                 onChange={(e) => setAuthWitnessId(e.target.value)}
//                 disabled={authDisabled}
//               />
//             </label>
//             <label className="flex items-center space-x-2">
//               <input
//                 type="checkbox"
//                 className="h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
//                 checked={confirmManager}
//                 onChange={(e) => setConfirmManager(e.target.checked)}
//                 disabled={authDisabled}
//               />
//               <span className="text-sm text-gray-700">Confirm Manager</span>
//             </label>
//           </div>
//         </div>

//         <div className="flex justify-end mt-6">
//           <button
//             className={`py-2 px-8 rounded-md font-semibold text-white text-base transition-all shadow-lg
//               ${saveDisabled ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-800'}
//             `}
//             onClick={handleSave}
//             disabled={saveDisabled}
//           >
//             Save Session
//           </button>
//         </div>
//       </div>
//     )}

//     {showTransferTable && (
//       <div className="bg-purple-50 rounded-xl shadow p-6 mt-10 space-y-6 border border-purple-200">
//         <h3 className="text-2xl font-bold text-purple-800 mb-4">Transfer Floats</h3>
//         <div className="overflow-x-auto rounded-lg border border-gray-200">
//           <table className="min-w-full divide-y divide-gray-100">
//             <thead className="bg-purple-100 text-purple-800">
//               <tr>
//                 <th className="px-6 py-3 text-left text-sm font-semibold tracking-wide">Denomination</th>
//                 <th className="px-6 py-3 text-center text-sm font-semibold tracking-wide">Loose</th>
//                 <th className="px-6 py-3 text-right text-sm font-semibold tracking-wide">Value</th>
//               </tr>
//             </thead>
//             <tbody className="bg-white divide-y divide-gray-100">
//               {transferValues.map((row, idx) => (
//                 <tr key={idx} className="hover:bg-purple-50 transition">
//                   <td className="px-6 py-4 text-sm text-gray-800">{row.name}</td>
//                   <td className="px-6 py-4 text-center">
//                     <input
//                       type="number"
//                       className="w-24 text-center px-3 py-1 border border-gray-300 rounded-md focus:ring-purple-400 focus:border-purple-400"
//                       value={row.loose}
//                       onChange={(e) => {
//                         const loose = parseFloat(e.target.value) || 0;
//                         const updated = [...transferValues];
//                         updated[idx].loose = loose;
//                         updated[idx].value = loose * denominations.find(d => d.name === row.name).value;
//                         setTransferValues(updated);
//                         const total = updated.reduce((sum, d) => sum + d.value, 0);
//                         setTransferTotal(total);
//                       }}
//                     />
//                   </td>
//                   <td className="px-6 py-4 text-right text-sm text-gray-800">£{row.value.toFixed(2)}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>

//         <div className="flex justify-between items-center mt-6">
//           <span className="text-lg font-semibold text-purple-700">Total:</span>
//           <span className="text-2xl font-bold text-purple-900">£{transferTotal.toFixed(2)}</span>
//         </div>

//         <div className="flex justify-end">
//           <button
//             className="py-2 px-8 bg-purple-700 text-white rounded-md font-semibold text-base hover:bg-purple-800 shadow-lg transition-all"
//             onClick={handleSaveTransferFloats}
//           >
//             Save Transfer Floats
//           </button>
//         </div>
//       </div>
//     )}
//   </div>
// );


// }
// export default SafeCountPage;





import React, { useState, useEffect, useMemo } from 'react';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import SafeCountTable from './SafeCountTable';
import TransferFloats from './TransferFloats'; // Added import for TransferFloats
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { serverTimestamp } from 'firebase/firestore';
import dayjs from 'dayjs';

function SafeCountPage() {
  const [currentSession, setCurrentSession] = useState(null);
  const [disabledSessions, setDisabledSessions] = useState(['changeover', 'night']);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showTransferTable, setShowTransferTable] = useState(false);
  const [authDisabled, setAuthDisabled] = useState(false);
  const [saveDisabled, setSaveDisabled] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [authCashierId, setAuthCashierId] = useState('');
  const [authWitnessId, setAuthWitnessId] = useState('');
  const [confirmCashier, setConfirmCashier] = useState(false);
  const [confirmManager, setConfirmManager] = useState(false);

  const currentDateStr = selectedDate.toISOString().slice(0, 10);

  const denominations = useMemo(() => [
    { name: '1p', value: 0.01, bagValue: 100.00 },
    { name: '2p', value: 0.02, bagValue: 50.00 },
    { name: '5p', value: 0.05, bagValue: 100.00 },
    { name: '10p', value: 0.1, bagValue: 50.00 },
    { name: '20p', value: 0.2, bagValue: 50.00 },
    { name: '50p', value: 0.5, bagValue: 20.00 },
    { name: '£1', value: 1.00, bagValue: 20.00 },
    { name: '£2', value: 2.00, bagValue: 10.00 },
    { name: '£5', value: 5.00, bagValue: 0.00 },
    { name: '£10', value: 10.00, bagValue: 0.00 },
    { name: '£20', value: 20.00, bagValue: 0.00 },
    { name: '£50', value: 50.00, bagValue: 0.00 },
  ], []);

  const [values, setValues] = useState(denominations.map(() => ({ bags: 0, loose: 0, value: 0 })));
  const [actualAmount, setActualAmount] = useState(0);
  const [expectedAmount, setExpectedAmount] = useState(0);
  const [variance, setVariance] = useState(0);

  const today = new Date().toISOString().slice(0, 10);

  const [savedSessions, setSavedSessions] = useState({
    morning: false,
    changeover: false,
    night: false,
  });

  const [transferValues, setTransferValues] = useState([
    { name: '£5', loose: 0, value: 0 },
    { name: '£10', loose: 0, value: 0 },
    { name: '£20', loose: 0, value: 0 },
    { name: '£50', loose: 0, value: 0 },
  ]);

  const [transferTotal, setTransferTotal] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const docRef = doc(db, 'safeCounts', currentDateStr);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const savedData = docSnap.data();
        setSavedSessions({
          morning: !!savedData.morning,
          changeover: !!savedData.changeover,
          night: !!savedData.night,
        });
      }
    };
    fetchData();
  }, [currentDateStr]);

  useEffect(() => {
    let newDisabledSessions = ['changeover', 'night'];
    if (savedSessions.morning) newDisabledSessions = newDisabledSessions.filter(s => s !== 'changeover');
    if (savedSessions.changeover) newDisabledSessions = newDisabledSessions.filter(s => s !== 'night');
    setDisabledSessions(newDisabledSessions);
  }, [savedSessions]);

  const handleSave = async () => {
    if (!confirmCashier || !confirmManager) {
      alert('Both cashier and manager must confirm.');
      return;
    }

    // Fetch cashier name
    const cashierQuery = query(
      collection(db, "users_01"),
      where("employeeID", "==", authCashierId.trim())
    );
    const cashierSnap = await getDocs(cashierQuery);
    if (cashierSnap.empty) {
      alert('Invalid Employee ID for cashier.');
      return;
    }
    const cashierName = cashierSnap.docs[0]?.data().name || authCashierId;

    // Fetch manager/witness name
    const managerQuery = query(
      collection(db, 'users_01'),
      where("employeeID", "==", authWitnessId.trim()),
      where("role", "in", ["manager", "teamleader"])
    );
    const managerSnap = await getDocs(managerQuery);
    if (managerSnap.empty) {
      alert('Invalid witness ID or not a manager/team leader.');
      return;
    }
    const managerName = managerSnap.docs[0]?.data().name || authWitnessId;

    if (savedSessions[currentSession]) {
      alert(`${currentSession} session has already been saved.`);
      return;
    }

    // Only include expectedAmount and variance if not change_receive
    const data =
      currentSession === 'change_receive'
        ? {
            actualAmount,
            values,
            cashier: authCashierId,
            manager: authWitnessId,
          }
        : {
            expectedAmount,
            actualAmount,
            variance,
            values,
            cashier: authCashierId,
            manager: authWitnessId,
          };

    const docRef = doc(db, 'safeCounts', currentDateStr);
    await setDoc(docRef, { [currentSession]: data }, { merge: true });

const now = dayjs();
const timestampId = now.format("YYYY-MM-DD_HH-mm-ss");
const moneyMovementRef = doc(db, "moneyMovement", timestampId);
await setDoc(moneyMovementRef, {
  timestamp: serverTimestamp(),
  type: "safe_count",
  amount: Number(actualAmount.toFixed(2)),
  expectedAmount: Number(expectedAmount.toFixed(2)),
  variance: Number(variance.toFixed(2)),
  direction: "in",
  userId: authCashierId,
  session: currentSession,
  note: `Safe Count completed for session '${currentSession}' by ${cashierName}`,
  authorisedBy: { 
    cashierEmployeeId: authCashierId,
    witnessEmployeeId: authWitnessId,
  },
});
    alert(`Data for ${currentSession} saved!`);

    setSavedSessions(prev => ({ ...prev, [currentSession]: true }));
    setValues(denominations.map(() => ({ bags: 0, loose: 0, value: 0 })));
    setActualAmount(0);
    setExpectedAmount(0);
    setVariance(0);
    setCurrentSession(null);
    setAuthCashierId('');
    setAuthWitnessId('');
    setConfirmCashier(false);
    setConfirmManager(false);
    setAuthDisabled(true);
    setSaveDisabled(true);
  };

  const handleSessionSelect = async (session) => {
    
    setCurrentSession(session);
    setShowTransferTable(false);

    const docRef = doc(db, 'safeCounts', currentDateStr);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists() && docSnap.data()[session]) {
      const savedData = docSnap.data()[session];
      setValues(savedData.values);
      setActualAmount(savedData.actualAmount);
      setExpectedAmount(savedData.expectedAmount);
      setVariance(savedData.variance);
      setIsReadOnly(true);
      setAuthDisabled(true);
      setSaveDisabled(true);
    } else {
      setValues(denominations.map(() => ({ bags: 0, loose: 0, value: 0 })));
      setIsReadOnly(false);
      await calculateExpectedAmount(session);
      setActualAmount(0);
      setVariance(0);

      setAuthCashierId('');
      setAuthWitnessId('');
      setConfirmCashier(false);
      setConfirmManager(false);
      
      setAuthDisabled(false);
      setSaveDisabled(false);
    }
  };

  const handleTransferFloats = () => {
    const transferData = denominations
      .map((d, index) => ({ name: d.name, loose: values[index].loose, value: values[index].loose * d.value }))
      .filter(d => ['£5', '£10', '£20', '£50'].includes(d.name));

    setTransferValues(transferData);
    const total = transferData.reduce((sum, d) => sum + d.value, 0);
    setTransferTotal(total);
    setShowTransferTable(true);
  };

  const calculateExpectedAmount = async (session) => {
    const todayRef = doc(db, 'safeCounts', today);
    const todaySnap = await getDoc(todayRef);
    const todayData = todaySnap.exists() ? todaySnap.data() : {};

    const transferTotal = todayData.TransferFloats?.total || 0;
    const changeReceive = todayData.change_receive ?.actualAmount || 0;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const yesterdayRef = doc(db, 'safeCounts', yesterdayStr);
    const yesterdaySnap = await getDoc(yesterdayRef);
    const yesterdayData = yesterdaySnap.exists() ? yesterdaySnap.data() : {};

    let expected = 0;

    if (session === 'morning') {
       const nightActual = yesterdayData.night?.actualAmount || 0;
       expected = nightActual + changeReceive - transferTotal;
    } else if (session === 'changeover') {
      const morningActual = todayData.morning ?.actualAmount || 0;
      expected = morningActual + changeReceive - transferTotal;
    } else if (session === 'night') {
      const changeoverActual = todayData.changeover ?.actualAmount || 0;
      expected = changeoverActual + changeReceive - transferTotal;
    }

    setExpectedAmount(expected);
  };

  const handleSaveTransferFloats = async () => {
    const docRef = doc(db, 'safeCounts', currentDateStr);
    await setDoc(docRef, {
      TransferFloats: {
        values: transferValues,
        total: transferTotal,
        cashier:authCashierId,
        manager:authWitnessId
      }
    }, { merge: true });

    alert('Transfer Floats saved!');
    setShowTransferTable(false);
  };

  const fetchSessionsForDate = async (date) => {
    const dateStr = date.toISOString().slice(0, 10);
    const docRef = doc(db, 'safeCounts', dateStr);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const savedData = docSnap.data();
      setSavedSessions({
        morning: !!savedData.morning,
        changeover: !!savedData.changeover,
        night: !!savedData.night,
      });

      if (dateStr !== today) {
        setIsReadOnly(true);
        setAuthDisabled(true);
        setSaveDisabled(true);
      } else {
        setIsReadOnly(false);
        setAuthDisabled(false);
        setSaveDisabled(false);
      }

    } else {
      setSavedSessions({ morning: false, changeover: false, night: false });
      setIsReadOnly(dateStr !== today);
      setAuthDisabled(dateStr !== today);
      setSaveDisabled(dateStr !== today);
    }
  };

  useEffect(() => {
    fetchSessionsForDate(selectedDate);
    setCurrentSession(null); // Reset session on date change
    setShowTransferTable(false);
  }, [selectedDate]);

  function SessionButtons({ sessions, currentSession, onSelect, disabledSessions, onTransferFloats }) {
    return (
      <div className="flex flex-wrap gap-4 mb-6">
        {sessions.map((session) => (
          <button
            key={session}
            onClick={() => onSelect(session)}
            disabled={disabledSessions.includes(session)}
            className={`px-5 py-3 rounded-lg font-medium text-sm sm:text-base transition-colors
              ${
                currentSession === session 
                  ? 'bg-blue-800 text-white' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }
              ${
                disabledSessions.includes(session)
                  ? 'disabled:bg-gray-300 disabled:cursor-not-allowed'
                  : ''
              }`}
          >
            {session.replace(/_/g, ' ').toUpperCase()}
          </button>
        ))}
        <button
          onClick={onTransferFloats}
          className="px-5 py-3 bg-purple-600 text-white rounded-lg font-medium text-sm sm:text-base hover:bg-purple-700 transition-colors"
        >
          TRANSFER FLOATS
        </button>
      </div>
    );
  }


return (
  <div className="container mx-auto p-6 max-w-5xl bg-white rounded-2xl shadow-lg mt-10 mb-10">
    <div className="mb-4">
      <h2 className="text-3xl font-bold text-black-500 tracking-tight text-center w-full">
        Safe Count
      </h2>
    </div>
    {/* Date Picker */}
    <div className="flex justify-end mb-10">
      <div className="bg-blue-50 p-4 rounded-xl shadow flex items-center gap-4">
        <span className="font-semibold text-blue-700">Select Date:</span>
        <DatePicker
          selected={selectedDate}
          onChange={date => setSelectedDate(date)}
          dateFormat="yyyy-MM-dd"
          className="border px-4 py-2 rounded-md text-lg focus:ring-2 focus:ring-blue-400"
          maxDate={new Date()}
        />
      </div>
    </div>
    {/* Session Buttons */}
    <div className="mb-8">
      <SessionButtons
        sessions={['morning', 'changeover', 'night', 'change_receive']}
        currentSession={currentSession}
        onSelect={handleSessionSelect}
        disabledSessions={disabledSessions}
        onTransferFloats={handleTransferFloats}
      />
    </div>

    {currentSession && !showTransferTable && (
      <div className="bg-gray-50 rounded-xl shadow p-6 mt-6 space-y-8 border border-gray-200">
        <h3 className="text-2xl font-bold text-blue-700 mb-4 capitalize">
          {currentSession.replace(/_/g, ' ')} Session
          </h3>

        <SafeCountTable
          denominations={denominations}
          values={values}
          onChange={(index, type, value) => {
            const updatedValues = [...values];
            updatedValues[index][type] = parseFloat(value) || 0;
            updatedValues[index].value =
              (denominations[index].value * updatedValues[index].bags * denominations[index].bagValue) +
              (updatedValues[index].loose * denominations[index].value);
            setValues(updatedValues);
            const total = updatedValues.reduce((sum, row) => sum + row.value, 0);
            setActualAmount(total);
            setVariance(total - expectedAmount);
          }}
          actualAmount={actualAmount}
          onActualChange={e => {
            const actual = parseFloat(e.target.value) || 0;
            setActualAmount(actual);
            setVariance(actual - expectedAmount);
          }}
          expectedAmount={expectedAmount}
          variance={variance}
          readOnly={isReadOnly}
          session={currentSession} // <-- add this line
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4 bg-white p-4 rounded-lg shadow">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Cashier ID</span>
              <input
                className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                value={authCashierId}
                onChange={(e) => setAuthCashierId(e.target.value)}
                disabled={authDisabled}
              />
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                className="h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                checked={confirmCashier}
                onChange={(e) => setConfirmCashier(e.target.checked)}
                disabled={authDisabled}
              />
              <span className="text-sm text-gray-700">Confirm Cashier</span>
            </label>
          </div>

          <div className="space-y-4 bg-white p-4 rounded-lg shadow">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Witness ID</span>
              <input
                className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                value={authWitnessId}
                onChange={(e) => setAuthWitnessId(e.target.value)}
                disabled={authDisabled}
              />
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                className="h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                checked={confirmManager}
                onChange={(e) => setConfirmManager(e.target.checked)}
                disabled={authDisabled}
              />
              <span className="text-sm text-gray-700">Confirm Manager</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            className={`py-2 px-8 rounded-md font-semibold text-white text-base transition-all shadow-lg
              ${saveDisabled ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-800'}
            `}
            onClick={handleSave}
            disabled={saveDisabled}
          >
            Save Session
          </button>
        </div>
      </div>
    )}

    {showTransferTable && (
      <div className="bg-purple-50 rounded-xl shadow p-6 mt-10 space-y-6 border border-purple-200">
        <h3 className="text-2xl font-bold text-purple-800 mb-4">Transfer Floats</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-purple-100 text-purple-800">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold tracking-wide">Denomination</th>
                <th className="px-6 py-3 text-center text-sm font-semibold tracking-wide">Loose</th>
                <th className="px-6 py-3 text-right text-sm font-semibold tracking-wide">Value</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {transferValues.map((row, idx) => (
                <tr key={idx} className="hover:bg-purple-50 transition">
                  <td className="px-6 py-4 text-sm text-gray-800">{row.name}</td>
                  <td className="px-6 py-4 text-center">
                    <input
                      type="number"
                      className="w-24 text-center px-3 py-1 border border-gray-300 rounded-md focus:ring-purple-400 focus:border-purple-400"
                      value={row.loose}
                      onChange={(e) => {
                        const loose = parseFloat(e.target.value) || 0;
                        const updated = [...transferValues];
                        updated[idx].loose = loose;
                        updated[idx].value = loose * denominations.find(d => d.name === row.name).value;
                        setTransferValues(updated);
                        const total = updated.reduce((sum, d) => sum + d.value, 0);
                        setTransferTotal(total);
                      }}
                    />
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-800">£{row.value.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center mt-6">
          <span className="text-lg font-semibold text-purple-700">Total:</span>
          <span className="text-2xl font-bold text-purple-900">£{transferTotal.toFixed(2)}</span>
        </div>

        <div className="flex justify-end">
          <button
            className="py-2 px-8 bg-purple-700 text-white rounded-md font-semibold text-base hover:bg-purple-800 shadow-lg transition-all"
            onClick={handleSaveTransferFloats}
          >
            Save Transfer Floats
          </button>
        </div>
      </div>
    )}
  </div>
);


}
export default SafeCountPage;
