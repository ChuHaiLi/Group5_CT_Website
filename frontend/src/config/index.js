// Centralize env-based configuration values used across the frontend
const FIREBASE = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || null,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || null,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || null,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || null,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || null,
  appId: process.env.REACT_APP_FIREBASE_APP_ID || null,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || null,
};

function isFirebaseConfigured() {
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  return required.every((k) => Boolean(FIREBASE[k]));
}

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || null;

export { FIREBASE, isFirebaseConfigured, GOOGLE_CLIENT_ID };

export default {
  FIREBASE,
  isFirebaseConfigured,
  GOOGLE_CLIENT_ID,
};
