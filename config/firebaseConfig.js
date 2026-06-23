import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, reactNativeLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyACZpEYcMikPqt063TxW-aMKIkcjZPpyxo",
  authDomain: "jj-message-36273.firebaseapp.com",
  projectId: "jj-message-36273",
  storageBucket: "jj-message-36273.firebasestorage.app",
  messagingSenderId: "98382539969",
  appId: "1:98382539969:web:a6fd2acf335eafdf76b840",
  measurementId: "G-64C48MP35Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with cross-platform persistence support for Expo Web/Native
const auth = Platform.OS === 'web'
  ? getAuth(app)
  : initializeAuth(app, { persistence: reactNativeLocalPersistence });

// Initialize Firestore
const db = getFirestore(app);

export { app, auth, db };

