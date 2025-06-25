import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy, limit, doc, setDoc, where,getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import BankingTable from './BankingTable';
import '../../css/Banking.css';
import { serverTimestamp } from 'firebase/firestore';
import dayjs from 'dayjs';

function BankingPage() {

  const [isAuthorized, setIsAuthorized] = useState({ witness: false, shiftRunner: false });
  const [actualAmount, setActualAmount] = useState(0);
  const [expectedAmount, setExpectedAmount] = useState(0);
  const [variance, setVariance] = useState(0);
  const [varianceReason, setVarianceReason] = useState('');
  const [showVarianceReason, setShowVarianceReason] = useState(false);
  const [authCashierId, setAuthCashierId] = useState('');
  const [authWitnessId, setAuthWitnessId] = useState('');
  const [confirmCashier, setConfirmCashier] = useState(false);
  const [confirmManager, setConfirmManager] = useState(false);
  const [authDisabled, setAuthDisabled] = useState(false);
  const [depositBagNumber, setDepositBagNumber] = useState('');
  const [bankingSlipNumber, setBankingSlipNumber] = useState('');
  const [confirmDepositBag, setConfirmDepositBag] = useState(false);
  const [confirmBankingSlip, setConfirmBankingSlip] = useState(false);
  // Add state for today's banking details
  const [todayBanking, setTodayBanking] = useState(null);
  const [loadingBanking, setLoadingBanking] = useState(true);
  const [shiftRunnerName, setShiftRunnerName] = useState('');
  const [witnessName, setWitnessName] = useState('');



  const denominations = useMemo(() => [
    { name: '£5', value: 5.00 },
    { name: '£10', value: 10.00 },
    { name: '£20', value: 20.00 },
    { name: '£50', value: 50.00 },
  ], []);

  const defaultValues = denominations.map(denom => ({
    denomination: denom.name,
    loose: 0,
    value: 0
  }));

  const [values, setValues] = useState(defaultValues);

  const fetchLatestExpectedAmount = useCallback(async () => {
    try {
      // 1. Fetch latest SafeFloat
      const q = query(
        collection(db, 'SafeFloats'),
        where('isDropped', '==', false),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const querySnapshot = await getDocs(q);

      let total = 0;
      let transferFloat = 0;
      if (!querySnapshot.empty) {
        const latestDoc = querySnapshot.docs[0].data();
        total = latestDoc.denominations.reduce((sum, item) => sum + (item.value || 0), 0);
        transferFloat = latestDoc.transferFloat || 0;
      }

      // 2. Fetch TransferFloat from today's safeCounts
      const todayDate = new Date().toISOString().slice(0, 10);
      const safeCountRef = doc(db, 'safeCounts', todayDate);
      const safeCountSnap = await getDoc(safeCountRef);

      let transferFloatFromSafeCounts = 0;
      if (safeCountSnap.exists()) {
        const safeCountData = safeCountSnap.data();
        transferFloatFromSafeCounts = safeCountData?.TransferFloats?.total || 0;
      } else {
        console.warn(`safeCounts/${todayDate} not found.`);
      }

      // 3. Add all together
      const expected = total + transferFloat + transferFloatFromSafeCounts;

      console.log("Expected Breakdown →", {
        denominationsTotal: total,
        transferFloat,
        transferFloatFromSafeCounts,
        finalExpectedAmount: expected,
      });

      setExpectedAmount(expected);
      setVariance(actualAmount - expected);

    } catch (error) {
      console.error("Error fetching latest expected amount:", error);
      setExpectedAmount(0);
      setVariance(actualAmount);
    }
  }, [actualAmount]);



  useEffect(() => {
    fetchLatestExpectedAmount();
  }, [fetchLatestExpectedAmount]);

  useEffect(() => {
    if (confirmCashier && confirmManager) {
      setIsAuthorized({ witness: true, shiftRunner: true });
    } else {
      setIsAuthorized({ witness: false, shiftRunner: false });
    }
  }, [confirmCashier, confirmManager]);

  const updateValues = (index, type, newValue) => {
    const updatedValues = [...values];
    updatedValues[index][type] = parseFloat(newValue) || 0;
    updatedValues[index].value = updatedValues[index].loose * denominations[index].value;
    setValues(updatedValues);

    const totalActual = updatedValues.reduce((sum, row) => sum + row.value, 0);
    setActualAmount(totalActual);
    setVariance(totalActual - expectedAmount);
  };
  const fetchTodayBanking = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const entriesRef = collection(db, "SafeDrop", today, "entries");
    const q = query(entriesRef, orderBy("timestamp", "desc"));
    const querySnap = await getDocs(q);
    const entries = await Promise.all(
      querySnap.docs.map(async docSnap => {
        const entry = docSnap.data();

        // Fetch Shift Runner Name
        let shiftRunnerName = entry.shiftRunner;
        if (entry.shiftRunner) {
          const cashierQuery = query(
            collection(db, "users_01"),
            where("employeeID", "==", entry.shiftRunner)
          );
          const cashierSnap = await getDocs(cashierQuery);
          if (!cashierSnap.empty) {
            shiftRunnerName = cashierSnap.docs[0].data().name;
          }
        }

        // Fetch Witness Name
        let witnessName = entry.witness;
        if (entry.witness) {
          const witnessQuery = query(
            collection(db, "users_01"),
            where("employeeID", "==", entry.witness)
          );
          const witnessSnap = await getDocs(witnessQuery);
          if (!witnessSnap.empty) {
            witnessName = witnessSnap.docs[0].data().name;
          }
        }

        return { ...entry, shiftRunnerName, witnessName };
      })
    );
    setTodayBanking(entries);
    setLoadingBanking(false);
  }, []);

  useEffect(() => {
    fetchTodayBanking();
  }, [fetchTodayBanking]);

  const handleSave = async () => {
    if (!confirmCashier || !confirmManager) {
      alert('Both cashier and manager must confirm.');
      return;
    }

    const cashierQuery = query(
      collection(db, 'users_01'),
      where('employeeID', '==', authCashierId.trim())
    );
    const cashierSnap = await getDocs(cashierQuery);
    if (cashierSnap.empty) {
      alert('Invalid Employee ID for cashier.');
      return;
    }

    const managerQuery = query(
      collection(db, 'users_01'),
      where('employeeID', '==', authWitnessId.trim()),
      where('role', 'in', ['manager', 'teamleader'])
    );
    const managerSnap = await getDocs(managerQuery);
    if (managerSnap.empty) {
      alert('Invalid witness ID or not a manager/Team Leader.');
      return;
    }

    if (variance !== 0) {
      if (!showVarianceReason) {
        setShowVarianceReason(true);
        return;
      }

      if (varianceReason.trim() === '') {
        alert('Please provide a reason for the variance.');
        return;
      }
    }

    const data = {
      expectedAmount,
      actualAmount,
      variance,
      varianceReason: variance !== 0 ? varianceReason : '',
      witness: authWitnessId,
      shiftRunner: authCashierId,
      depositBagNumber,
      confirmDepositBag,
      bankingSlipNumber,
      confirmBankingSlip,
      values: values,
      timestamp: new Date().toISOString()
    };

    // Store as a subcollection with unique ID (date + time)
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const timeId = new Date().toISOString().replace(/:/g, '-'); // "YYYY-MM-DDTHH-mm-ss.sssZ"
    const docRef = doc(collection(db, 'SafeDrop', today, 'entries'), timeId);
    await setDoc(docRef, data);


    // Save to MoneyMovement
    const now = dayjs();
    const timestampId = now.format("YYYY-MM-DD_HH-mm-ss");
    const moneyMovementRef = doc(db, "moneyMovement", timestampId)
    const currentSession = 'end-of-day';


    await setDoc(moneyMovementRef, {
      timestamp: serverTimestamp(),
      type: "banking",
      amount: Number(actualAmount.toFixed(2)),
      expectedAmount: Number(expectedAmount.toFixed(2)),
      variance: Number(variance.toFixed(2)),
      direction: "in",
      userId: authCashierId,
      session: currentSession,
      note: variance !== 0 ? varianceReason : '',
      authorisedBy: {
        cashierEmployeeId: authCashierId,
        witnessEmployeeId: authWitnessId,
      },
    });
    const safeFloatSnapshot = await getDocs(query(
      collection(db, 'SafeFloats'),
      where('isDropped', '==', false),
      orderBy('timestamp', 'desc'),
      limit(1)
    ));
    if (!safeFloatSnapshot.empty) {
      const docId = safeFloatSnapshot.docs[0].id;
      await setDoc(doc(db, 'SafeFloats', docId), { isDropped: true }, { merge: true });
    }
    alert('Safe Drop data saved successfully!');

    setActualAmount(0);
    setVarianceReason('');
    setShowVarianceReason(false);
    setExpectedAmount(0);
    setIsAuthorized({ witness: false, shiftRunner: false });
    setAuthCashierId('');
    setAuthWitnessId('');
    setDepositBagNumber('');
    setBankingSlipNumber('');
    setConfirmCashier(false);
    setConfirmManager(false);
    setDepositBagNumber('');
    setBankingSlipNumber('');
    const resetValues = denominations.map(denom => ({
      denomination: denom.name,
      loose: 0,
      value: 0
    }));
    setValues(resetValues);
    fetchLatestExpectedAmount();
    await fetchTodayBanking();

  };

  return (
    <div className="mb-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Today's Banking Details</h3>
        <table className="min-w-full table-auto border">
          <thead>
            <tr>
              <th className="px-4 py-2">Actual Deposit</th>
              <th className="px-4 py-2">Expected Deposit</th>
              <th className="px-4 py-2">Variance</th>
              <th className="px-4 py-2">Bag No.</th>
              <th className="px-4 py-2">Giro No.</th>
              <th className="px-4 py-2">Shift Runner</th>
              <th className="px-4 py-2">Witness</th>
            </tr>
          </thead>
          <tbody>
            {loadingBanking ? (
              <tr>
                <td colSpan={7} className="text-center py-4">Loading...</td>
              </tr>
            ) : todayBanking && todayBanking.length > 0 ? (
              todayBanking.map((entry, idx) => (
                <tr key={entry.timestamp || idx}>
                  <td className="px-4 py-2">{entry.actualAmount ?? '-'}</td>
                  <td className="px-4 py-2">{entry.expectedAmount ?? '-'}</td>
                  <td className="px-4 py-2">{entry.variance ?? '-'}</td>
                  <td className="px-4 py-2">{entry.depositBagNumber ?? '-'}</td>
                  <td className="px-4 py-2">{entry.bankingSlipNumber ?? '-'}</td>
                  <td className="px-4 py-2">{entry.shiftRunnerName || entry.shiftRunner || '-'}</td>
                  <td className="px-4 py-2">{entry.witnessName || entry.witness || '-'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-4">No records to display.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


      <div className="banking-page">
        <div className="container">
          <div className="mb-4">
            <h2>  Safe Drop  </h2>


            <div className="mb-8"> {/* Added margin bottom for spacing */}
              <BankingTable
                denominations={denominations}
                values={values}
                onChange={updateValues}
                actualAmount={actualAmount}
                expectedAmount={expectedAmount}
                variance={variance}
                readOnly={false} // Assuming this table is editable
              />
            </div>



            <div className="space-y-4 p-4 border border-gray-200 rounded-lg shadow-sm bg-white mb-4">
              {/* Deposit Bag Number */}
              <div className="flex flex-col space-y-1 mt-4">
                <label className="w-40 text-gray-700 font-medium">Deposit Bag No:</label>
                <input
                  type="number"
                  value={depositBagNumber}
                  onChange={(e) => setDepositBagNumber(e.target.value)}
                  className="border p-2 rounded-md w-40 focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                  placeholder="Enter Bag Number"
                  disabled={authDisabled}
                />
              </div>

              {/* Banking Slip Number */}
              <div className="flex flex-col space-y-1 mt-4">
                <label className="w-40 text-gray-700 font-medium">Banking Slip No:</label>
                <input
                  type="number"
                  value={bankingSlipNumber}
                  onChange={(e) => setBankingSlipNumber(e.target.value)}
                  className="border p-2 rounded-md w-40 focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                  placeholder="Enter Slip Number"
                  disabled={authDisabled}
                />
              </div>

              <div className="space-y-4 p-4 border border-gray-200 rounded-lg shadow-sm bg-white">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Authorization</h3>
                <div className="flex flex-col space-y-4 md:flex-row md:space-x-8 md:space-y-0">
                  {/* Cashier ID */}
                  <div className="flex items-center space-x-2">
                    <label className="w-40 text-gray-700 font-medium">Cashier ID:</label>
                    <input
                      value={authCashierId}
                      onChange={(e) => setAuthCashierId(e.target.value)}
                      disabled={authDisabled}
                      className="border p-2 rounded-md w-40 focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                      placeholder="Enter Cashier ID"
                    />
                    <label className="flex items-center space-x-1 text-gray-700">
                      <input
                        type="checkbox"
                        checked={confirmCashier}
                        onChange={(e) => setConfirmCashier(e.target.checked)}
                        disabled={authDisabled}
                        className="form-checkbox h-4 w-4 text-blue-600 rounded"
                      />
                      <span>Confirm</span>
                    </label>
                  </div>
                </div>

                {/* Witness ID */}
                <div className="flex items-center space-x-2">
                  <label className="w-40 text-gray-700 font-medium">Witness ID:</label>
                  <input
                    value={authWitnessId}
                    onChange={(e) => setAuthWitnessId(e.target.value)}
                    className="border p-2 rounded-md w-40 focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                    disabled={authDisabled}
                    placeholder="Enter Witness ID"
                  />
                  <label className="flex items-center space-x-1 text-gray-700">
                    <input
                      type="checkbox"
                      checked={confirmManager}
                      onChange={(e) => setConfirmManager(e.target.checked)}
                      disabled={authDisabled}
                      className="form-checkbox h-4 w-4 text-blue-600 rounded"
                    />
                    <span>Confirm</span>
                  </label>
                </div>
              </div>


            </div>
          </div>
          {/* Variance Reason Input */}
          {showVarianceReason && variance !== 0 && (
            <div className="space-y-2 bg-white p-4 rounded-lg shadow">
              <label className="block text-sm font-medium text-gray-700">Reason for Variance:</label>
              <textarea
                className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 h-24"
                value={varianceReason}
                onChange={(e) => setVarianceReason(e.target.value)}
                placeholder="Explain the reason for the variance..."
              />
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end mt-6">
            <button
              className={`py-2 px-8 rounded-md font-semibold text-white text-base transition-all shadow-lg
              ${(!isAuthorized.witness || !isAuthorized.shiftRunner) ? 'bg-gray-300 cursor-not-allowed' : 'bg-purple-700 '}
            `}
              onClick={handleSave}
              disabled={!isAuthorized.witness || !isAuthorized.shiftRunner}
            >
              Save

            </button>
          </div>
        </div>
      </div>
    </div>

  );
}


export default BankingPage;
