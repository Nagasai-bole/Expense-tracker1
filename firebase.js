// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDswJHR6Q0dyEFs8fBi9eUzlBSO6XxX6jw",
  authDomain: "myproject18-51f48.firebaseapp.com",
  projectId: "myproject18-51f48",
  storageBucket: "myproject18-51f48.firebasestorage.app",
  messagingSenderId: "132110103732",
  appId: "1:132110103732:web:e1d262858f0e8179da53e1",
  measurementId: "G-ECF0L61N84",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
