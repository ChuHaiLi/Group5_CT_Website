// Import the functions you need from the SDKs you need
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
import { initializeApp } from "firebase/app";
import { getAuth, GithubAuthProvider } from "firebase/auth";
import { FIREBASE, isFirebaseConfigured } from "../config";

// Build firebase config from centralized FIREBASE values
const firebaseConfig = {
  apiKey: FIREBASE.apiKey,
  authDomain: FIREBASE.authDomain,
  projectId: FIREBASE.projectId,
  storageBucket: FIREBASE.storageBucket,
  messagingSenderId: FIREBASE.messagingSenderId,
  appId: FIREBASE.appId,
  measurementId: FIREBASE.measurementId,
};

// Chỉ khởi tạo Firebase nếu có đầy đủ cấu hình
let app = null;
let auth = null;
let githubProvider = null;

if (isFirebaseConfigured()) {
  try {
    // Initialize Firebase
    app = initializeApp(firebaseConfig);

    // Initialize Firebase Authentication
    auth = getAuth(app);
    auth.languageCode = 'en';

    // Initialize GitHub Provider
    githubProvider = new GithubAuthProvider();
    githubProvider.addScope('user:email');
    
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.warn('Firebase initialization failed:', error);
  }
} else {
  console.warn('Firebase not configured. GitHub login will be disabled.');
}

// Export với named exports
export { auth, githubProvider };

// Export default
export default app;