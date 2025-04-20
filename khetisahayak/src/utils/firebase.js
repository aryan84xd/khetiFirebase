// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
const firebaseConfig = {
  apiKey: "AIzaSyCXX2P75QFsaP-NDm9JWvuSFLPd1XhSj7Y",
  authDomain: "kheti2-380ec.firebaseapp.com",
  projectId: "kheti2-380ec",
  storageBucket: "kheti2-380ec.firebasestorage.app",
  messagingSenderId: "3961871095",
  appId: "1:3961871095:web:e4948b443d0fa647af11f2",
  measurementId: "G-FZYLL5Z3TB",
};

const app = initializeApp(firebaseConfig);
export default app; // Export the initialized app
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const provider = new GoogleAuthProvider();
