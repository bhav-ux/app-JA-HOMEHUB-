import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAY-I94WGshGVIajREnTO30k3Oo1QXFq44",
  authDomain: "myapp-ceb0c.firebaseapp.com",
  projectId: "myapp-ceb0c",
  storageBucket: "myapp-ceb0c.firebasestorage.app",
  messagingSenderId: "1004386814226",
  appId: "1:1004386814226:web:cf1de1a021a9d919be8bcb",
};

// Avoid "Firebase App named '[DEFAULT]' already exists" during reloads.
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
