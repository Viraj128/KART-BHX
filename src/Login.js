import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../src/firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "./auth/AuthContext";
import { getDashboardPath } from "../src/config/roles";

const Login = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone");
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    if (!phone) {
      setError("Please enter phone number");
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      const usersRef = collection(db, "users_01");
      const q = query(usersRef, where("phone", "==", phone));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Phone number not registered");
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      
      if (!userData.role) {
        throw new Error("User role not defined");
      }
      if (!userData.employeeID) {
        throw new Error("Employee ID not defined");
      }

      setUserData({ ...userData, employeeID: userData.employeeID });
      setStep("otp");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // const handleOtpSubmit = async (e) => {
  //   e.preventDefault();
  //   if (!otp) {
  //     setError("Please enter OTP");
  //     return;
  //   }

  //   setLoading(true);
  //   setError("");

  //   try {
  //     if (otp === userData.otp.toString()) {
  //       await login({
  //         ...userData,
  //         loginTimestamp: Date.now() // Add login timestamp
  //       });
  //       navigate(getDashboardPath(), { replace: true }); // Replace history
  //     }
  //   } catch (err) {
  //     setError(err.message);
  //   } finally {
  //     setLoading(false);
  //   }
  // };
  
//HERE ARE CHANGES IN OTP SUBMIT:
const handleOtpSubmit = async (e) => {
  e.preventDefault();
  if (!otp) {
    setError("Please enter OTP");
    return;
  }

  setLoading(true);
  setError("");

  try {
    // Your custom OTP verification logic
    if (otp === userData.otp.toString()) {
      // Now, call the `login` function from AuthContext with the *verified* userData
      // The `userData` state already holds the data fetched from Firestore.
      await login({
        ...userData, // Pass the existing userData object
        loginTimestamp: Date.now() // Add any extra info you need
      });
      navigate(getDashboardPath(), { replace: true });
    } else {
      throw new Error("Invalid OTP"); // If custom OTP doesn't match
    }
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to your account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {step === "phone" ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-6">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <div className="mt-1">
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-sm text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? "Sending OTP..." : "Send OTP"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                  Enter OTP
                </label>
                <div className="mt-1">
                  <input
                    id="otp"
                    name="otp"
                    type="number"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-sm text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;