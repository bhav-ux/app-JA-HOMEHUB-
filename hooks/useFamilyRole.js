import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ROLES, getRole } from '../utils/familyRoles';

// Live role (owner / admin / member) for `uid` within `familyId`.
export function useFamilyRole(familyId, uid) {
  const [role, setRole] = useState(ROLES.MEMBER);

  useEffect(() => {
    if (!familyId || !uid) {
      setRole(ROLES.MEMBER);
      return;
    }
    return onSnapshot(doc(db, 'families', familyId), (snap) => {
      setRole(getRole(snap.exists() ? snap.data() : null, uid));
    });
  }, [familyId, uid]);

  return role;
}

export function isApproverRole(role) {
  return role === ROLES.OWNER || role === ROLES.ADMIN;
}
