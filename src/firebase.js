// Firebase configuration and initialization
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyB7j2NGjdR6wEEGUOiEYtVGgKo0nUQmM30",
  authDomain: "conciliadoreditorpdf.firebaseapp.com",
  projectId: "conciliadoreditorpdf",
  storageBucket: "conciliadoreditorpdf.firebasestorage.app",
  messagingSenderId: "758654418030",
  appId: "1:758654418030:web:ab6b28c595a57389ebfa7f",
  measurementId: "G-KM7PNF31JZ"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Analytics safely
export let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
      console.log("Firebase Analytics initialized successfully");
    }
  }).catch((err) => {
    console.warn("Firebase Analytics not supported in this environment:", err);
  });
}
