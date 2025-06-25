import React, { useState, useEffect } from "react";
import { db } from '../../firebase/config';
import {
  collection,
  getDocs,
  setDoc,
  doc,
  serverTimestamp,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import dayjs from "dayjs";

const denominations = [
  { label: "1p", value: 0.01 },
  { label: "2p", value: 0.02 },
  { label: "5p", value: 0.05 },
  { label: "10p", value: 0.1 },
  { label: "20p", value: 0.2 },
  { label: "50p", value: 0.5 },
  { label: "£1", value: 1 },
  { label: "£2", value: 2 },
  { label: "£5", value: 5 },
  { label: "£10", value: 10 },
  { label: "£20", value: 20 },
  { label: "£50", value: 50 },
];

export default function OpenCashier() {
  const [counts, setCounts] = useState({});
  const [floatType, setFloatType] = useState("");
  const [expectedFloat, setExpectedFloat] = useState(0);
  const [retainedAmount, setRetainedAmount] = useState(0);
  const [cashiers, setCashiers] = useState([]);
  const [selectedCashier, setSelectedCashier] = useState("");
  const [showAuthorization, setShowAuthorization] = useState(false);
  const [authCashierId, setAuthCashierId] = useState("");
  const [authWitnessId, setAuthWitnessId] = useState("");
  const [confirmCashier, setConfirmCashier] = useState(false);
  const [confirmWitness, setConfirmWitness] = useState(false);

  //  Fetch cashiers from Firestore
  useEffect(() => {
    const fetchCashiers = async () => {
      const q = query(
        collection(db, "users_01"));

      const snapshot = await getDocs(q);

      setCashiers(snapshot.docs.map(doc => {
        const data = doc.data();
        
        return {
          id: data.employeeID, // Use employeeId instead of document ID
          name: data.name,
          email: data.email,
          ...data
        };
      }));
    };
    fetchCashiers();
  }, []);
  

  const handleCountChange = (denomination, count) => {
    setCounts((prev) => ({
      ...prev,
      [denomination]: Number(count),
    }));
  };

  const calculateValue = (denomination) => {
    const count = counts[denomination] || 0;
    const denomValue = denominations.find((d) => d.label === denomination).value;
    return (count * denomValue).toFixed(2);
  };

  const totalValue = denominations.reduce((acc, d) => {
    const count = counts[d.label] || 0;
    return acc + count * d.value;
  }, 0);

  const variance = totalValue - expectedFloat;

  const handleContinue = async () => {
    if (!floatType || !selectedCashier) {
      alert("Please select both float type and cashier.");
      return;
    }

    const today = new Date();
    const formattedDate = today.toISOString().split("T")[0];
    const floatDocId = `float${floatType}_${formattedDate}`;
    const floatRef = doc(db, "floats", floatDocId);
    const existingFloat = await getDoc(floatRef);

    
    let retainedAmount =0;

    try{
      const closuresRef = collection(db, "floatClosures");
    const q = query(
      closuresRef,
      where("type", "==", floatType)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      // Find the most recent floatClosure by date
      const closures = snapshot.docs.map(doc => doc.data());
      const latestClosure = closures.sort((a, b) => {
        const dateA = new Date(a.closedAt?.toDate?.() || a.closedAt);
        const dateB = new Date(b.closedAt?.toDate?.() || b.closedAt);
        return dateB - dateA;
      })[0];
      retainedAmount = latestClosure?.retainedAmount || 0;
    }
    }catch(err){
console.error("Error fetching retainedAmount from floatClosures:", err);
    }
    if (existingFloat.exists()) {
      const floatData = existingFloat.data();
      
      if(!floatData.closedAt){
        alert(`Float ${floatType} is currently assigned and still open.`);
         return;
      }
      
      setExpectedFloat(retainedAmount);
      setRetainedAmount(retainedAmount);
    } else {
      setExpectedFloat(0);
      setRetainedAmount(0);
    }

    setShowAuthorization(true);
  };

  const handleSubmit = async () => {
    if (!confirmCashier || !confirmWitness) {
      alert("Both cashier and witness must confirm.");
      return;
    }

    // Get selected cashier by employeeID
    const cashierQuery = query(
      collection(db, "users_01"),
      where("employeeID", "==", selectedCashier)
    );
    const cashierSnapshot = await getDocs(cashierQuery);
    
    if (cashierSnapshot.empty) {
      alert("Selected cashier not found.");
      return;
    }
    
    const selectedCashierData = cashierSnapshot.docs[0].data();
    
    if (selectedCashierData.employeeID?.trim() !== authCashierId.trim()) {
      alert("Cashier ID does not match the selected cashier.");
      return;
    }

    // Validate witness (manager or team leader with employeeID)
    const witnessQuery = query(
      collection(db, "users_01"),
      where("employeeID", "==", authWitnessId.trim()),
      where("role", "in", ["manager", "teamleader"]) // Changed to accept both 'manager' and 'teamleader'
    );
    
    const witnessSnap = await getDocs(witnessQuery);
    
    if (witnessSnap.empty) {
      alert("Invalid witness ID or not a manager/team leader.");
      return;
    }
    
    const today = new Date();
    const formattedDate = today.toISOString().split("T")[0];
    const docId = `float${floatType}_${formattedDate}`;
    const floatRef = doc(db, "floats", docId);
    const existingFloat = await getDoc(floatRef);
    const data = {
      type: floatType,
      date: formattedDate,
      openedAt: serverTimestamp(),
      isOpen: true,
      EmployeeId: selectedCashier,
      entries: denominations.map((d) => ({
        denomination: d.label,
        count: counts[d.label] || 0,
        value: Number(((counts[d.label] || 0) * d.value).toFixed(2)),
      })),
      total: Number((totalValue + retainedAmount).toFixed(2)),
      initialCount: Number(totalValue.toFixed(2)),
      variance: Number(variance.toFixed(2)),
      authorisedBy: {
        cashierEmployeeId: authCashierId,
        witnessEmployeeId: authWitnessId,
      },
    };
    if (existingFloat.exists() && existingFloat.data().isOpen) {
      alert(`Float ${floatType} is already assigned and still open.`);
      return;
    }

    try {
      await setDoc(floatRef, data);
      const cashierName = cashiers.find(c => c.id === selectedCashier)?.name || selectedCashier;

     const now = dayjs();
     const timestampId = now.format("YYYY-MM-DD_HH-mm-ss");
     const moneyMovementRef = doc(db, "moneyMovement",timestampId ); // 'moneyMovement/2025-05-30'

     await setDoc(moneyMovementRef, {
      timestamp: serverTimestamp(),
      type: "float_open",
      amount: Number((totalValue + retainedAmount).toFixed(2)),
      direction: "in",
      userId: selectedCashier,
      session: "—",
      note: `Float opened (${floatType}) for cashier ${cashierName}`,
      authorisedBy: { 
        cashierEmployeeId: authCashierId,
        witnessEmployeeId: authWitnessId,
  },
});


      alert(`Float ${floatType} assigned to cashier successfully.`);

      // Reset form
      setCounts({});
      setFloatType("");
      setExpectedFloat(0);
      setSelectedCashier("");
      setShowAuthorization(false);
      setConfirmCashier(false);
      setConfirmWitness(false);
      setAuthCashierId("");
      setAuthWitnessId("");
    } catch (err) {
      console.error("Error saving float:", err);
      alert("Failed to save float.");
    }
  };

  return (

<div className="p-6 border rounded-2xl shadow-lg bg-white max-w-4xl mx-auto mt-8">
  <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Open Cashier</h2>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
    <div>
      <label className="block text-base font-semibold text-gray-700 mb-2">Select Float Type</label>
      <select
        className="border border-gray-300 p-3 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
        value={floatType}
        onChange={(e) => setFloatType(e.target.value)}
      >
        <option value="">-- Select --</option>
        <option value="A">Float A</option>
        <option value="B">Float B</option>
        <option value="C">Float C</option>
        <option value="D">Float D</option>
      </select>
    </div>

    <div>
      <label className="block text-base font-semibold text-gray-700 mb-2">Select Cashier</label>
      <select
        className="border border-gray-300 p-3 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
        value={selectedCashier}
        onChange={(e) => setSelectedCashier(e.target.value)}
      >
        <option value="">-- Select --</option>
        {cashiers.map((c) => (
          <option key={c.employeeID} value={c.employeeID}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  </div>

  {floatType && (
    <>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Starting Float Count</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 text-base bg-white shadow-sm">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="p-2 text-left">Denomination</th>
              <th className="p-2 text-left">Loose</th>
              <th className="p-2 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {denominations.map((d) => (
              <tr key={d.label} className="border-b">
                <td className="p-2">{d.label}</td>
                <td className="p-2">
                  <input
                    type="number"
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={counts[d.label] || ""}
                    onChange={(e) => handleCountChange(d.label, e.target.value)}
                  />
                </td>
                <td className="p-2 text-right font-medium text-gray-700">£{calculateValue(d.label)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan="2" className="text-right font-bold p-2">Total:</td>
              <td className="text-right font-bold p-2 text-green-700">£{(totalValue + retainedAmount).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {!showAuthorization && (
        <div className="text-center mt-6">
          <button
            onClick={handleContinue}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Continue
          </button>
        </div>
      )}

      {showAuthorization && (
        <div className="mt-8 border-t pt-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Authorization</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">Cashier Employee ID</label>
              <input
                type="password"
                className="border border-gray-300 p-3 rounded-lg w-full focus:ring-2 focus:ring-blue-500"
                value={authCashierId}
                onChange={(e) => setAuthCashierId(e.target.value)}
              />
              <div className="mt-2 text-base">
                <input
                  type="checkbox"
                  checked={confirmCashier}
                  onChange={(e) => setConfirmCashier(e.target.checked)}
                  className="w-5 h-5 text-green-600 border-gray-300 rounded"
                />{" "}
                <label className="text-sm text-gray-700">Cashier Confirm</label>
              </div>
            </div>

            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">Witness Employee ID</label>
              <input
                type="password"
                className="border border-gray-300 p-3 rounded-lg w-full focus:ring-2 focus:ring-blue-500"
                value={authWitnessId}
                onChange={(e) => setAuthWitnessId(e.target.value)}
              />
              <div className="mt-2 text-base">
                <input
                  type="checkbox"
                  checked={confirmWitness}
                  onChange={(e) => setConfirmWitness(e.target.checked)}
                  className="w-5 h-5 text-green-600 border-gray-300 rounded"
                />{" "}
                <label className="text-sm text-gray-700">Witness Confirm</label>
              </div>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={handleSubmit}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Submit Float
            </button>
          </div>
        </div>
      )}
    </>
  )}
</div>
);

}