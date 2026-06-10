import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { uploadImage } from '../utils/uploadImage';

// ─── Relationship types ─────────────────────────────────────────────────────
// `{ fromMemberId, toMemberId, type }` reads as
// "fromMember is the `type` of toMember" (e.g. type: 'father' means
// fromMember is toMember's father).

export const RELATIONSHIP_TYPES = [
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'brother', label: 'Brother' },
  { value: 'sister', label: 'Sister' },
  { value: 'son', label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'grandfather', label: 'Grandfather' },
  { value: 'grandmother', label: 'Grandmother' },
  { value: 'uncle', label: 'Uncle' },
  { value: 'aunt', label: 'Aunt' },
  { value: 'cousin', label: 'Cousin' },
];

export function relationshipLabel(type) {
  return RELATIONSHIP_TYPES.find((r) => r.value === type)?.label || type;
}

// ─── Family members ─────────────────────────────────────────────────────────

function normalizeMember(memberDoc) {
  return { id: memberDoc.id, ...memberDoc.data() };
}

export function subscribeFamilyMembers(familyId, onData, onError) {
  if (!familyId) {
    onData?.([]);
    return () => {};
  }

  return onSnapshot(
    collection(db, 'families', familyId, 'familyMembers'),
    (snapshot) => onData?.(snapshot.docs.map(normalizeMember)),
    (error) => {
      console.error('[FamilyTreeService] Members subscription failed', {
        familyId,
        code: error?.code || null,
        message: error?.message || 'Unknown Firestore error',
      });
      onError?.(error);
    }
  );
}

export async function addFamilyMember(familyId, data, uid) {
  const payload = {
    userId: data.userId ?? null,
    name: data.name?.trim() || 'Family Member',
    photoURL: data.photoURL ?? null,
    birthDate: data.birthDate ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    isPlaceholder: !!data.isPlaceholder,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'families', familyId, 'familyMembers'), payload);
  return docRef.id;
}

export async function updateFamilyMember(familyId, memberId, data) {
  await updateDoc(doc(db, 'families', familyId, 'familyMembers', memberId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function ensureSelfMember(familyId, user, existingMembers) {
  if (!familyId || !user?.uid) return null;

  const alreadyExists = (existingMembers || []).some((m) => m.userId === user.uid);
  if (alreadyExists) return null;

  let name = user.displayName || user.email?.split('@')[0] || 'Me';
  let photoURL = user.photoURL || null;

  try {
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      name = data.displayName?.trim() || name;
      photoURL = data.photoURL || photoURL;
    }
  } catch {
    // fall back to auth user fields
  }

  return addFamilyMember(
    familyId,
    { userId: user.uid, name, photoURL, isPlaceholder: false },
    user.uid
  );
}

export async function uploadMemberPhoto(uri, familyId, memberId) {
  const path = `families/${familyId}/familyTree/${memberId}-${Date.now()}.jpg`;
  return uploadImage(uri, path);
}

// ─── Relationships ───────────────────────────────────────────────────────────

function normalizeRelationship(relDoc) {
  return { id: relDoc.id, ...relDoc.data() };
}

export function subscribeRelationships(familyId, onData, onError) {
  if (!familyId) {
    onData?.([]);
    return () => {};
  }

  return onSnapshot(
    collection(db, 'families', familyId, 'relationships'),
    (snapshot) => onData?.(snapshot.docs.map(normalizeRelationship)),
    (error) => {
      console.error('[FamilyTreeService] Relationships subscription failed', {
        familyId,
        code: error?.code || null,
        message: error?.message || 'Unknown Firestore error',
      });
      onError?.(error);
    }
  );
}

export async function addRelationship(familyId, { fromMemberId, toMemberId, type }, uid) {
  const docRef = await addDoc(collection(db, 'families', familyId, 'relationships'), {
    fromMemberId,
    toMemberId,
    type,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateRelationship(familyId, relationshipId, data) {
  await updateDoc(doc(db, 'families', familyId, 'relationships', relationshipId), data);
}

export async function deleteRelationship(familyId, relationshipId) {
  await deleteDoc(doc(db, 'families', familyId, 'relationships', relationshipId));
}
