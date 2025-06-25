import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../firebase/config';
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const SESSION_TIMEOUT = 20 * 60 * 1000; // 20 minutes
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);
  const timeoutIdRef = useRef(null);
  const sessionIdRef = useRef(null);
    const [initializing, setInitializing] = useState(true); // Add initializing state

  // Generate unique session ID
  const generateSessionId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Restore session on mount
 useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const sessionTimestamp = localStorage.getItem('sessionTimestamp');
    const storedSessionId = localStorage.getItem('sessionId');

    if (storedUser && sessionTimestamp && storedSessionId) {
      const timeElapsed = Date.now() - parseInt(sessionTimestamp, 10);
      if (timeElapsed < SESSION_TIMEOUT) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setSessionActive(true);
        sessionIdRef.current = storedSessionId;
      } else {
        clearSessionData();
      }
    }
    setInitializing(false); // Mark initialization as complete
  }, []);

  // Track tab close events
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (sessionIdRef.current && user?.phone) {
        try {
          const userRef = doc(db, 'userSessions', user.phone);
          await setDoc(userRef, {
            sessions: {
              [sessionIdRef.current]: {
                logoutTime: serverTimestamp()
              }
            }
          }, { merge: true });
        } catch (error) {
          console.error("Error logging tab close:", error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  const clearSessionData = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('sessionTimestamp');
    localStorage.removeItem('sessionId');
  };

  const logout = useCallback(async () => {
    if (sessionIdRef.current && user?.phone) {
      try {
        const userRef = doc(db, 'userSessions', user.phone);
        await setDoc(userRef, {
          sessions: {
            [sessionIdRef.current]: {
              logoutTime: serverTimestamp()
            }
          }
        }, { merge: true });
      } catch (error) {
        console.error("Error logging logout time:", error);
      }
    }
    
    // Clear all state and storage
    setUser(null);
    setSessionActive(false);
    sessionIdRef.current = null;
    clearSessionData();
  }, [user]);

  const resetSessionTimeout = useCallback(() => {
    localStorage.setItem('sessionTimestamp', Date.now().toString());
  }, []);

  // Session timeout handler
  useEffect(() => {
    if (!sessionActive) {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      return;
    }

    const onTimeout = () => {
      logout();
      alert('Session expired due to inactivity');
    };

    timeoutIdRef.current = setTimeout(onTimeout, SESSION_TIMEOUT);

    const handleActivity = () => {
      resetSessionTimeout();
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      timeoutIdRef.current = setTimeout(onTimeout, SESSION_TIMEOUT);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [sessionActive, logout, resetSessionTimeout]);

  const login = async (userData) => {
    const sessionId = generateSessionId();
    const minimalUserData = {
      name: userData.name,
      employeeID: userData.employeeID,
      phone: userData.phone,
      role: userData.role,
      sessionId: sessionId,
       loginTimestamp: Date.now(),
    };

    // Set user state
    setUser(minimalUserData);
    setSessionActive(true);
    sessionIdRef.current = sessionId;
    
    // Store in localStorage
    localStorage.setItem('user', JSON.stringify(minimalUserData));
    localStorage.setItem('sessionTimestamp', Date.now().toString());
    localStorage.setItem('sessionId', sessionId);

    // Log login to Firestore
    try {
      const userRef = doc(db, 'userSessions', userData.phone);
      await setDoc(userRef, {
        name: userData.name,
        phone: userData.phone,
        employeeID: userData.employeeID,
        sessions: {
          [sessionId]: {
            loginTime: serverTimestamp(),
            logoutTime: null
          }
        }
      }, { merge: true });
    } catch (error) {
      console.error("Error logging login time:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      resetSessionTimeout,
      initializing // Expose initializing state
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Add this missing hook export
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}



// import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
// import { db, auth } from '../firebase/config';
// import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
// import { onAuthStateChanged, signOut, signInWithCustomToken } from 'firebase/auth'; // Added signInWithCustomToken for potential future use

// const SESSION_TIMEOUT = 20 * 60 * 1000; // 20 minutes
// const AuthContext = createContext();

// export function AuthProvider({ children }) {
//   const [user, setUser] = useState(null);
//   const [sessionActive, setSessionActive] = useState(false);
//   const [initializing, setInitializing] = useState(true);
//   const timeoutIdRef = useRef(null);
//   const sessionIdRef = useRef(null);

//   // Generate unique session ID
//   const generateSessionId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

//   // --- IMPORTANT CHANGE: Modify onAuthStateChanged for custom login fallback ---
//   // This useEffect will now primarily monitor Firebase's internal auth state.
//   // If you are relying purely on your custom OTP and not doing `signInWithCustomToken`,
//   // this listener will likely set the user to null eventually unless you trigger
//   // a Firebase Auth state change via a custom token.
//  // Firebase Auth state listener
//   useEffect(() => {
//     const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
//       if (firebaseUser) {
//         // Firebase user is authenticated
//         const sessionId = generateSessionId();
//         sessionIdRef.current = sessionId;

//         try {
//           const userRef = doc(db, 'users_01', firebaseUser.uid);
//           const userDoc = await getDoc(userRef);
//           if (userDoc.exists()) {
//             const userData = userDoc.data();
//             const authUser = {
//               uid: firebaseUser.uid,
//               email: firebaseUser.email, // May be null if phone auth
//               phone: userData.phone,
//               name: userData.name,
//               employeeID: userData.employeeID,
//               role: userData.role,
//               sessionId: sessionId,
//               loginTimestamp: Date.now(),
//             };

//             setUser(authUser);
//             setSessionActive(true);

//             // Store in localStorage
//             localStorage.setItem('user', JSON.stringify(authUser));
//             localStorage.setItem('sessionTimestamp', Date.now().toString());
//             localStorage.setItem('sessionId', sessionId);

//             // Log login to Firestore
//             try {
//               const sessionRef = doc(db, 'userSessions', authUser.uid);
//               await setDoc(
//                 sessionRef,
//                 {
//                   name: authUser.name,
//                   phone: authUser.phone,
//                   employeeID: authUser.employeeID,
//                   sessions: {
//                     [sessionId]: {
//                       loginTime: serverTimestamp(),
//                       logoutTime: null,
//                     },
//                   },
//                 },
//                 { merge: true }
//               );
//             } catch (error) {
//               console.error('Error logging login time via onAuthStateChanged:', error);
//             }
//           } else {
//             console.warn('Firebase authenticated user has no corresponding Firestore document in "users_01". Logging out.');
//             await signOut(auth);
//             setUser(null);
//             setSessionActive(false);
//             clearSessionData();
//           }
//         } catch (error) {
//           console.error('Error fetching user data during onAuthStateChanged:', error);
//           await signOut(auth);
//           setUser(null);
//           setSessionActive(false);
//           clearSessionData();
//         }
//       } else {
//         // No Firebase Auth user; check localStorage for session restoration
//         try {
//           const storedUser = localStorage.getItem('user');
//           const sessionTimestamp = localStorage.getItem('sessionTimestamp');
//           const storedSessionId = localStorage.getItem('sessionId');

//           if (storedUser && sessionTimestamp && storedSessionId) {
//             const timeElapsed = Date.now() - parseInt(sessionTimestamp, 10);
//             if (timeElapsed < SESSION_TIMEOUT) {
//               const parsedUser = JSON.parse(storedUser);
//               setUser(parsedUser);
//               setSessionActive(true);
//               sessionIdRef.current = storedSessionId;
//             } else {
//               console.log('Session expired in localStorage');
//               clearSessionData();
//             }
//           } else {
//             clearSessionData();
//           }
//         } catch (error) {
//           console.error('Error restoring session from localStorage:', error);
//           clearSessionData();
//         }
//       }
//       setInitializing(false);
//     });

//     return () => unsubscribe();
//   }, []);  // Track tab close events
//   useEffect(() => {
//     const handleBeforeUnload = async () => {
//       if (sessionIdRef.current && user?.uid) { // Use UID from `user` state which should be populated
//         try {
//           const userRef = doc(db, 'userSessions', user.uid); // Use UID from `user`
//           await setDoc(userRef, {
//             sessions: {
//               [sessionIdRef.current]: {
//                 logoutTime: serverTimestamp(),
//               },
//             },
//           }, { merge: true });
//         } catch (error) {
//           console.error('Error logging tab close:', error);
//         }
//       }
//     };

//     window.addEventListener('beforeunload', handleBeforeUnload);
//     return () => {
//       window.removeEventListener('beforeunload', handleBeforeUnload);
//     };
//   }, [user]); // Depend on user state

//   const clearSessionData = () => {
//     localStorage.removeItem('user');
//     localStorage.removeItem('sessionTimestamp');
//     localStorage.removeItem('sessionId');
//   };

//   const logout = useCallback(async () => {
//     if (sessionIdRef.current && user?.uid) { // Use UID from `user` state
//       try {
//         const userRef = doc(db, 'userSessions', user.uid); // Use UID from `user`
//         await setDoc(userRef, {
//           sessions: {
//             [sessionIdRef.current]: {
//               logoutTime: serverTimestamp(),
//             },
//           },
//         }, { merge: true });
//       } catch (error) {
//         console.error('Error logging logout time:', error);
//       }
//     }

//     // Sign out from Firebase Authentication if a Firebase Auth user exists
//     // This will clear Firebase's internal session.
//     await signOut(auth); // This will trigger onAuthStateChanged to set user to null

//     // Also clear our custom state and localStorage
//     setUser(null);
//     setSessionActive(false);
//     sessionIdRef.current = null;
//     clearSessionData();
//   }, [user]); // Depend on user state

//   const resetSessionTimeout = useCallback(() => {
//     localStorage.setItem('sessionTimestamp', Date.now().toString());
//   }, []);

//   // Session timeout handler
//   useEffect(() => {
//     if (!sessionActive) {
//       if (timeoutIdRef.current) {
//         clearTimeout(timeoutIdRef.current);
//         timeoutIdRef.current = null;
//       }
//       return;
//     }

//     const onTimeout = () => {
//       logout();
//       alert('Session expired due to inactivity');
//     };

//     timeoutIdRef.current = setTimeout(onTimeout, SESSION_TIMEOUT);

//     const handleActivity = () => {
//       resetSessionTimeout();
//       if (timeoutIdRef.current) {
//         clearTimeout(timeoutIdRef.current);
//       }
//       timeoutIdRef.current = setTimeout(onTimeout, SESSION_TIMEOUT);
//     };

//     window.addEventListener('mousemove', handleActivity);
//     window.addEventListener('keydown', handleActivity);
//     window.addEventListener('click', handleActivity);

//     return () => {
//       if (timeoutIdRef.current) {
//         clearTimeout(timeoutIdRef.current);
//       }
//       window.removeEventListener('mousemove', handleActivity);
//       window.removeEventListener('keydown', handleActivity);
//       window.removeEventListener('click', handleActivity);
//     };
//   }, [sessionActive, logout, resetSessionTimeout]);

//   // --- THE CORE CHANGE FOR PATH A: Custom Login Function ---
//   // This `login` function is now designed to receive the already-verified
//   // user data from your custom OTP logic in Login.js.
//   // It will NOT attempt to call signInWithEmailAndPassword.
//   const login = async (verifiedUserData) => {
//     // IMPORTANT: This `verifiedUserData` MUST contain a unique `uid` or `employeeID`
//     // that you can use to identify the user for Firestore lookups and session tracking.
//     // If you don't have a Firebase Auth UID from a proper sign-in, you need to use something else
//     // as the primary identifier (like `employeeID` or generate a unique ID).
//     // For consistency with your `onAuthStateChanged` listener, it's best if `verifiedUserData`
//     // includes a `uid` that could correspond to a Firebase Auth user.
//     // If not, the `onAuthStateChanged` will eventually set `user` to `null`.

//     try {
//       const sessionId = generateSessionId();
//       sessionIdRef.current = sessionId;

//       const authUser = {
//         uid: verifiedUserData.uid || verifiedUserData.employeeID, // Use UID if available, else employeeID or generate one
//         email: verifiedUserData.email || null, // Email might not be available for phone login
//         phone: verifiedUserData.phone,
//         name: verifiedUserData.name,
//         employeeID: verifiedUserData.employeeID,
//         role: verifiedUserData.role,
//         sessionId: sessionId,
//         loginTimestamp: Date.now(),
//       };

//       setUser(authUser);
//       setSessionActive(true);

//       // Store in localStorage
//       localStorage.setItem('user', JSON.stringify(authUser));
//       localStorage.setItem('sessionTimestamp', Date.now().toString());
//       localStorage.setItem('sessionId', sessionId);

//       // Log login to Firestore based on your custom login logic
//       try {
//         // Use the uid or employeeID as the document ID for userSessions
//         const sessionRef = doc(db, 'userSessions', authUser.uid);
//         await setDoc(sessionRef, {
//           name: authUser.name,
//           phone: authUser.phone,
//           employeeID: authUser.employeeID,
//           sessions: {
//             [sessionId]: {
//               loginTime: serverTimestamp(),
//               logoutTime: null,
//             },
//           },
//         }, { merge: true });
//       } catch (error) {
//         console.error('Error logging custom login time:', error);
//       }
//     } catch (error) {
//       console.error('Custom login process error:', error);
//       throw error;
//     }
//   };


//   return (
//     <AuthContext.Provider value={{
//       user,
//       login, // This `login` now expects `verifiedUserData`
//       logout,
//       resetSessionTimeout,
//       initializing // Expose initializing state
//     }}>
//       {children}
//     </AuthContext.Provider>
//   );
// }

// export function useAuth() {
//   const context = useContext(AuthContext);
//   if (!context) {
//     throw new Error('useAuth must be used within an AuthProvider');
//   }
//   return context;
// }