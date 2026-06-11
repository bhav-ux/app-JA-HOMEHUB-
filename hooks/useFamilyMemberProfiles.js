import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Resolves the family's member uids into { uid, name, photoURL } profiles,
// kept live as the family roster changes.
export function useFamilyMemberProfiles(familyId) {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!familyId) {
      setMembers([]);
      return;
    }

    let mounted = true;
    const unsubscribe = onSnapshot(doc(db, 'families', familyId), async (snap) => {
      if (!snap.exists() || !mounted) return;
      const memberIds = snap.data()?.members || [];

      const resolved = await Promise.all(
        memberIds.map(async (uid) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', uid));
            if (userSnap.exists()) {
              const data = userSnap.data();
              return {
                uid,
                name: data.displayName?.trim() || data.email?.split('@')[0] || 'Member',
                photoURL: data.photoURL || null,
              };
            }
          } catch {
            // fall through to placeholder
          }
          return { uid, name: 'Member', photoURL: null };
        })
      );

      if (mounted) setMembers(resolved);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [familyId]);

  return members;
}
