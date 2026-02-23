// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCaFseDoKFwMzU2rnBUgvlbnGlsbA-6rjY",
  authDomain: "availo-162e8.firebaseapp.com",
  projectId: "availo-162e8",
  storageBucket: "availo-162e8.firebasestorage.app",
  messagingSenderId: "234385162653",
  appId: "1:234385162653:web:f896e4ab0f9fc27d5c2f74"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app)