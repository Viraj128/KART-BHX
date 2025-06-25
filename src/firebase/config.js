// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {

    apiKey: "AIzaSyA5jVQcxmKKLQy31Ft8329EB_cWRyBu0uI",
    authDomain: "bhookiecore.firebaseapp.com",
    databaseURL: "https://bhookiecore-default-rtdb.firebaseio.com",
    projectId: "bhookiecore",
    storageBucket: "bhookiecore.firebasestorage.app",
    messagingSenderId: "252666746613",
    appId: "1:252666746613:web:e97a48d4c31c1d952d17bc",
    measurementId: "G-STVRJ77V79"
  
  };


// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

