import React, { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from '../../firebase/config';
import { FiSearch, FiUser, FiPhone, FiMail, FiHome, FiFileText, FiClock, FiBriefcase } from "react-icons/fi";

const ViewDetails = () => {
  const [phone, setPhone] = useState("");
  const [runner, setRunner] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!phone) return;
    
    setLoading(true);
    setNotFound(false);
    setRunner(null);

    try {
      console.log(`Searching for phone: ${phone}`);

      // Search in users_01 collection
      console.log(`Querying users_01 for phone: ${phone}`);
      const usersQuery = query(collection(db, "users_01"), where("phone", "==", phone));
      const userSnapshot = await getDocs(usersQuery);

      if (userSnapshot.empty) {
        console.log(`No user found in users_01 for phone: ${phone}`);
        setNotFound(true);
        setLoading(false);
        return;
      }

      const userData = userSnapshot.docs[0].data();
      console.log(`User data from users_01:`, userData);

      // Search in customers collection
      console.log(`Querying customers for phone: ${phone}`);
      const customersQuery = query(collection(db, "customers"), where("phone", "==", phone));
      const customerSnapshot = await getDocs(customersQuery);

      let customerID = "N/A";
      if (!customerSnapshot.empty) {
        const customerData = customerSnapshot.docs[0].data();
        console.log(`Customer data from customers:`, customerData);
        customerID = customerData.customerID || "N/A";
        console.log(`customerID: ${customerID}`);
      } else {
        console.warn(`No customer found in customers for phone: ${phone}`);
      }

      setRunner({ ...userData, customerID });
    } catch (error) {
      console.error("Search error:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6 flex items-center justify-center">
      <style jsx>{`
        .custom-spinner {
          display: inline-block;
          width: 24px;
          height: 24px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top: 3px solid #fff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 space-y-6">
        <h1 className="text-3xl font-bold text-center text-gray-800">
        
        </h1>

        <div className="space-y-4">
          <div className="relative">
            <FiPhone className="absolute top-3 left-3 text-gray-400 text-xl" />
            <input
              type="tel"
              placeholder="Enter phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-xl font-medium flex items-center justify-center transition-all"
          >
            {loading ? (
              <>
                <span className="custom-spinner mr-2" />
                Searching...
              </>
            ) : (
              <>
                <FiSearch className="mr-2" />
                Search Member
              </>
            )}
          </button>
        </div>

        {notFound && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">
            No team member found with this phone number
          </div>
        )}

        {runner && (
          <div className="bg-gray-50 rounded-xl p-6 space-y-4">
            <div className="flex items-center space-x-3 mb-4">
              <FiUser className="text-2xl text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-800">
                {runner.name || "Unknown Name"}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <DetailItem icon={<FiMail />} label="Email" value={runner.email} />
              <DetailItem icon={<FiClock />} label="DOB" value={runner.dob} />
              <DetailItem icon={<FiHome />} label="Address" value={runner.address} />
              <DetailItem icon={<FiPhone />} label="Phone" value={runner.phone} />
              <DetailItem icon={<FiFileText />} label="Employee ID" value={runner.employeeID} />
              <DetailItem icon={<FiBriefcase />} label="Customer ID" value={runner.customerID} />
              <DetailItem icon={<FiUser />} label="Role" value={runner.role} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const DetailItem = ({ icon, label, value }) => (
  <div className="flex items-start space-x-3">
    <span className="text-gray-500 pt-1">{icon}</span>
    <div className="flex-1">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="text-gray-700">{value || "N/A"}</div>
    </div>
  </div>
);

export default ViewDetails;