// Import the functions you need from the SDKs you need
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
import { initializeApp } from "firebase/app";
import { getAuth, GithubAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBwH_gxQ_9SBANkCp5jtbe4wt3Bq3YPR94",
  authDomain: "hellowonderai-d149e.firebaseapp.com",
  projectId: "hellowonderai-d149e",
  storageBucket: "hellowonderai-d149e.firebasestorage.app",
  messagingSenderId: "609181336884",
  appId: "1:609181336884:web:c52bd9cee347e20d395161",
  measurementId: "G-6MH82W2VYC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize GitHub Provider
export const githubProvider = new GithubAuthProvider();

// Optional: Request additional scopes
githubProvider.addScope('user:email');

export default app;