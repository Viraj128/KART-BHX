import React, { useState, useEffect } from "react";
import { db } from '../../firebase/config';
import {
  collection,
  getDocs,
  setDoc,
  serverTimestamp,
  doc,
  updateDoc,
  query, where,
} from "firebase/firestore";
import dayjs from "dayjs";

// Denominations list for counting
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

export default function CloseCashier() {
  const [counts, setCounts] = useState({});
  const [cashiers, setCashiers] = useState([]);
  const [selectedCashier, setSelectedCashier] = useState("");
  const [expectedAmount, setExpectedAmount] = useState(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [reason, setReason] = useState("");
  const [auth, setAuth] = useState({ name: "", password: "" });
  const [authRequired, setAuthRequired] = useState(false);
  const [showReasonForm, setShowReasonForm] = useState(false);
  const [isClosed, setIsClosed] = useState(false); //  New state to track if float is closed
  const [confirmCashierChecked, setConfirmCashierChecked] = useState(false);
const [confirmWitnessChecked, setConfirmWitnessChecked] = useState(false);

 

  // Fetch cashiers from Firestore
  useEffect(() => {
    const fetchCashiers = async () => {
      const q = query(
        collection(db, "users_01")
        
      );
      const snapshot = await getDocs(q);
      setCashiers(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          employeeID: data.employeeID, // Add employeeID to cashier objects
          name: data.name,
          ...data
        };
      }));
    };
    fetchCashiers();
  }, []);


  // Fetch assigned float for selected cashier
  useEffect(() => {
    const fetchAssignedFloat = async () => {
      if (!selectedCashier) {
        setExpectedAmount(null);
        return;
      }
  
      // Query floats collection properly
      const q = query(
        collection(db, "floats"),
        where("EmployeeId", "==", selectedCashier),
        where("isOpen", "==", true)
      );
      
      const floatSnap = await getDocs(q);
      
      if (!floatSnap.empty) {
        const floatData = floatSnap.docs[0].data();
        setExpectedAmount(Number(floatData.initialCount));
        setIsClosed(floatData.closed);
      } else {
        setExpectedAmount(null);
        setIsClosed(false);
      }
    };
    fetchAssignedFloat();
  }, [selectedCashier]);

  // Handle change of count for a specific denomination
  const handleCountChange = (denomination, count) => {
    setCounts((prev) => ({ ...prev, [denomination]: Number(count) || 0 }));
  };

  // Calculate value for each denomination
  const calculateValue = (denomination) => {
    const count = counts[denomination] || 0;
    const denomValue = denominations.find((d) => d.label === denomination).value;
    return (count * denomValue).toFixed(2);
  };

  // Total value of all denominations
  const totalValue = denominations.reduce((acc, d) => {
    const count = counts[d.label] || 0;
    return acc + count * d.value;
  }, 0);

  // Variance between expected and counted total
  const variance = expectedAmount !== null ? totalValue - expectedAmount : 0;

  // Handle submit when "Continue" is clicked
  const handleSubmit = () => {
    if (!selectedCashier || expectedAmount === null) {
      alert("Please select a cashier with an assigned float");
      return;
    }

 
    // Check for variance and attempts
    if (Math.abs(variance) <= 1) {
      setAuthRequired(true);
    } else if (attemptCount < 2) {
      setAttemptCount((prev) => prev + 1); // Correct async handling of attempts
      alert("There is a Variance. Please recheck the denominations.");
    } else {
      setAttemptCount(3);  // Lock attempts at 3
      setReason("");  // Reset reason field in case it's shown after 3rd attempt
      setShowReasonForm(true); // Show the reason form
      alert("Please provide a reason for the variance.");
    }

  };

  // Handle saving the reason after 3 failed attempts
  const handleSaveWithReason = () => {
    if (!reason) {
      alert("Please provide a reason for the variance.");
      return;
    }
    setAuthRequired(true);
  };

  // Handle authorization (password verification)
  const handleAuthorization = async () => {
    if (!auth.password || !auth.witnessId) {
      alert("Please enter cashier and witness ID");
      return;
    }
    if (!confirmCashierChecked || !confirmWitnessChecked) {
  alert("Both cashier and witness must confirm float closure by checking the boxes.");
  return;
}
    try {

       // 1. Validate witness (manager or teamleader) from users_01
      const witnessSnap = await getDocs(
        query(
          collection(db, "users_01"),
          where("employeeID", "==", auth.witnessId),
          where("role", "in", ["manager", "teamleader"]) // Allow both manager and teamleader roles
        )
      );
    if (witnessSnap.empty) {
      alert("Invalid witness ID: No such user found or user is not manager/team leader.");
      return;
    }
    const witness = witnessSnap.docs[0].data();
    

      //fetch float and extract floatType from doc Id
      const floatSnap = await getDocs(collection(db, "floats"));
      const matchingFloat = floatSnap.docs
        .map((doc) =>{
         const floatTypeMatch = doc.id.match(/^float([A-Z])_/i); // e.g., extract "A" from "floatA_2025-06-10"
        return {
          id: doc.id,
          floatType: floatTypeMatch ? floatTypeMatch[1] : null,
          ...doc.data()
        } ;
      })
          
        .find(
          (doc) =>
            doc.EmployeeId === selectedCashier && // Match selected cashier
            doc.authorisedBy?.cashierEmployeeId === auth.password && // Cashier ID auth
            !doc.closed
        );

      if (!matchingFloat) {
        alert("Authorization failed: Invalid cashier ID");
        return;
      }
      if (matchingFloat.isOpen === false) {
        alert("This float has already been closed.");
        return;
      }
      
      const floatType = matchingFloat.floatType;

      // Now, store the denominations from £5 to £50 in the safeDrop collection
      const safeFloatsData = denominations
        .filter((d) => d.value >= 5) // Filter for denominations from £5 to £50
        .map((d) => ({
          denomination: d.label,
          count: counts[d.label] || 0,
          value: Number(((counts[d.label] || 0) * d.value).toFixed(2)),
          type: "safe_float", // Mark as a safe drop entry
        }));

      const today = new Date();
      const formattedDate = today.toISOString().split("T")[0];

      const safeFloatsDocId = `${selectedCashier}_${formattedDate}`;
      const safeFloatsDocRef = doc(db, "SafeFloats", safeFloatsDocId);

      await setDoc(safeFloatsDocRef, {
        denominations: safeFloatsData, // Store all denominations as an array in one document
        timestamp: serverTimestamp(),
        cashierId: selectedCashier,
        isDropped:false,
      });

      //calculate total of SafeDrop denominations
      const safeFloatsTotal = safeFloatsData.reduce((sum, d) => sum + d.value, 0);

      //compute new float amoount (total counted -safeDrop Total)
      const leftOverAmount = Number((totalValue - safeFloatsTotal).toFixed(2));
   

       //close the float
      await updateDoc(doc(db, "floats", matchingFloat.id), {
        closed: true,
        isOpen: false,
        closedAt: serverTimestamp(),
        
      });

      //save float closure
      const docId = `${selectedCashier}_${formattedDate}`;
      const data = {
        cashierId: selectedCashier,
        type:floatType || null,
        date: formattedDate,
        timestamp: serverTimestamp(),
        expectedAmount: Number(expectedAmount),
        total: Number(totalValue.toFixed(2)),
        variance: Number(variance.toFixed(2)),
        retainedAmount:leftOverAmount,
        entries: denominations.map((d) => ({
          denomination: d.label,
          count: counts[d.label] || 0,
          value: Number(((counts[d.label] || 0) * d.value).toFixed(2)),
        })),
        reason: reason || null,
        authorizedBy: { 
          cashierEmployeeId: auth.password ,
          witnessManagerId:auth.witnessId,
      },
      };
     // Save to floatClosures
      await setDoc(doc(db, "floatClosures", docId), data);

    const now = dayjs();
    const timestampId = now.format("YYYY-MM-DD_HH-mm-ss");
    const moneyMovementRef = doc(db, "moneyMovement",timestampId )

    //store in moneyMovement collection
await setDoc(moneyMovementRef, {
  timestamp: serverTimestamp(),
  type: "cashier_close",
  amount: Number(totalValue.toFixed(2)),
  expectedAmount: Number(expectedAmount),
  variance: Number(variance.toFixed(2)),
  direction: "out",
  userId: selectedCashier,
  session: "—" , // e.g., 'morning', 'evening'
  note: reason || null,
  authorisedBy: {
    cashierEmployeeId: auth.password ,
    witnessEmployeeId: auth.witnessId,
  },
});



      alert("Float closure and authorization successful.");
      setCounts({});
      setSelectedCashier("");
      setExpectedAmount(null);
      setAttemptCount(0);
      setReason("");
      setAuth({ name: "", password: "" });
      setAuthRequired(false);
      setShowReasonForm(false);
    } catch (err) {
      console.error("Authorization error:", err);
      alert("An error occurred during authorization.");
    }
  };

  return (
    <div className="p-6 border rounded-2xl shadow-lg bg-white max-w-4xl mx-auto mt-8">
  <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Close Cashier</h2>

  {/* Cashier Selection */}
  <div className="mb-6">
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

  {expectedAmount !== null && (
    <>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Count Register</h3>

      {/* Denomination Table */}
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
                    disabled={isClosed}
                  />
                </td>
                <td className="p-2 text-right font-medium text-gray-700">£{calculateValue(d.label)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan="2" className="text-right font-bold p-2">Total:</td>
              <td className="text-right font-bold p-2 text-green-700">£{totalValue.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {!showReasonForm && !authRequired && !isClosed && (
        <div className="text-center mt-6">
          <button
            onClick={handleSubmit}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Continue
          </button>
        </div>
      )}

      {/* Reason for Variance */}
      {showReasonForm && (
        <div className="mt-8 border-t pt-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Variance Explanation</h3>
          <div className="text-base space-y-1 mb-4">
            <div><strong>Expected Float:</strong> £{expectedAmount.toFixed(2)}</div>
            <div><strong>Counted Total:</strong> £{totalValue.toFixed(2)}</div>
            <div className="text-red-700"><strong>Variance:</strong> £{variance.toFixed(2)}</div>
          </div>

          <label className="block text-base font-medium text-gray-700 mb-2">Reason for Variance</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
            rows="3"
          />

          <div className="text-center mt-4">
            <button
              onClick={handleSaveWithReason}
              className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
            >
              Save Reason
            </button>
          </div>
        </div>
      )}

      {/* Authorization */}
      {authRequired && (
        <div className="mt-8 border-t pt-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Authorization</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">Cashier ID</label>
              <input
                type="password"
                className="border border-gray-300 p-3 rounded-lg w-full focus:ring-2 focus:ring-blue-500"
                value={auth.password}
                onChange={(e) => setAuth({ ...auth, password: e.target.value })}
              />
              <div className="flex items-center space-x-2 mt-2">
        <input
          type="checkbox"
          checked={confirmCashierChecked}
          onChange={(e) => setConfirmCashierChecked(e.target.checked)}
          className="w-5 h-5 text-blue-600 border-gray-300 rounded"
        />
        <label className="text-sm text-gray-700">Cashier confirms float details.</label>
      </div>
            </div>
           <div>
    <label className="block text-base font-medium text-gray-700 mb-2">Witness Manager ID</label>
    <input
      type="password"
      className="border border-gray-300 p-3 rounded-lg w-full focus:ring-2 focus:ring-green-500"
      value={auth.witnessId || ""}
      onChange={(e) => setAuth({ ...auth, witnessId: e.target.value })}
    />
     <div className="flex items-center space-x-2 mt-2">
        <input
          type="checkbox"
          checked={confirmWitnessChecked}
          onChange={(e) => setConfirmWitnessChecked(e.target.checked)}
          className="w-5 h-5 text-green-600 border-gray-300 rounded"
        />
        <label className="text-sm text-gray-700">Manager confirms float closure.</label>
      </div>
  </div> 
          </div>

          <div className="text-center">
            <button
              onClick={handleAuthorization}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Authorize and Close
            </button>
          </div>
        </div>
      )}

      {isClosed && (
        <div className="mt-6 text-center text-red-600 font-semibold text-base">
          This float is already closed. You cannot enter denominations.
        </div>
      )}
    </>
  )}
</div>


  );
}