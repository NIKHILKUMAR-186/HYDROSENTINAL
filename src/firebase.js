// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// Public web config values are intentionally exposed to the frontend.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const requiredFirebaseKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_APP_ID",
];

const optionalFirebaseKeys = [
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_MEASUREMENT_ID",
];

const missingRequiredFirebaseKeys = requiredFirebaseKeys.filter((key) => {
  const value = import.meta.env[key];
  return !value || String(value).trim().length === 0;
});

const missingOptionalFirebaseKeys = optionalFirebaseKeys.filter((key) => {
  const value = import.meta.env[key];
  return !value || String(value).trim().length === 0;
});

const hasRequiredConfig = missingRequiredFirebaseKeys.length === 0;

const canInitializeAnalytics =
  missingOptionalFirebaseKeys.indexOf("VITE_FIREBASE_PROJECT_ID") === -1 &&
  missingOptionalFirebaseKeys.indexOf("VITE_FIREBASE_MEASUREMENT_ID") === -1;

if (!hasRequiredConfig) {
  console.warn(
    "[firebase] Missing required Firebase config. Edit .env (or the environment used by Vite) and set: " +
      missingRequiredFirebaseKeys.join(", "),
  );
}

// Initialize Firebase only when the minimum client config exists.
const app = hasRequiredConfig ? initializeApp(firebaseConfig) : null;

if (app && canInitializeAnalytics) {
  try {
    getAnalytics(app);
  } catch (error) {
    console.warn("[firebase] Analytics initialization skipped:", error);
  }
}

export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;
export const storage = app ? getStorage(app) : null;

export const firebaseSetupInfo = {
  requiredKeys: requiredFirebaseKeys,
  optionalKeys: optionalFirebaseKeys,
  missingRequiredKeys: missingRequiredFirebaseKeys,
  missingOptionalKeys: missingOptionalFirebaseKeys,
  envFileHint: ".env",
  sourceHint: "Firebase Console -> Project settings -> General -> Your apps -> Web app config",
};

export const isFirebaseConfigured = missingRequiredFirebaseKeys.length === 0;
