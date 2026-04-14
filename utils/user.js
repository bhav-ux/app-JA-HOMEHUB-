import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export async function getUserDisplayName(uid) {
  if (!uid) return '';
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return '';
    const data = snap.data();
    return (data.displayName || data.name || data.email || '').trim();
  } catch (error) {
    console.warn('getUserDisplayName error', error);
    return '';
  }
}

export function listenToUserDisplayName(uid, callback) {
  if (!uid || typeof callback !== 'function') return () => {};
  const ref = doc(db, 'users', uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback('');
        return;
      }
      const data = snap.data();
      const value = (data.displayName || data.name || data.email || '').trim();
      callback(value);
    },
    (error) => {
      console.warn('listenToUserDisplayName error', error);
    }
  );
}
