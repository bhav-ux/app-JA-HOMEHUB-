import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  runTransaction,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ─── Role constants ───────────────────────────────────────────────────────────

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
};

// ─── Role derivation ──────────────────────────────────────────────────────────

export function getRole(familyData, uid) {
  if (!familyData || !uid) return ROLES.MEMBER;
  if (familyData.ownerId === uid) return ROLES.OWNER;
  if ((familyData.adminIds || []).includes(uid)) return ROLES.ADMIN;
  return ROLES.MEMBER;
}

export function getRoleBadge(role) {
  switch (role) {
    case ROLES.OWNER: return '👑 Owner';
    case ROLES.ADMIN: return '🛡️ Admin';
    default:          return '👤 Member';
  }
}

// ─── Permission checks ────────────────────────────────────────────────────────

export function canRemoveMember(actorRole, targetRole) {
  if (actorRole === ROLES.OWNER) return targetRole !== ROLES.OWNER;
  if (actorRole === ROLES.ADMIN) return targetRole === ROLES.MEMBER;
  return false;
}

export function canPromoteToAdmin(actorRole, targetRole) {
  return actorRole === ROLES.OWNER && targetRole === ROLES.MEMBER;
}

export function canDemoteAdmin(actorRole, targetRole) {
  return actorRole === ROLES.OWNER && targetRole === ROLES.ADMIN;
}

export function canTransferOwnership(actorRole) {
  return actorRole === ROLES.OWNER;
}

// ─── Firestore mutations ──────────────────────────────────────────────────────

/**
 * Owner or admin removes another member from the family.
 * Atomically clears the target's familyId and removes them from the family doc.
 */
export async function removeMember({ familyId, targetUid }) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'families', familyId), {
    members:  arrayRemove(targetUid),
    adminIds: arrayRemove(targetUid),
  });
  batch.update(doc(db, 'users', targetUid), { familyId: null });
  await batch.commit();
}

/**
 * Owner promotes a member to admin.
 */
export async function promoteToAdmin({ familyId, targetUid }) {
  await updateDoc(doc(db, 'families', familyId), {
    adminIds: arrayUnion(targetUid),
  });
}

/**
 * Owner demotes an admin back to member.
 */
export async function demoteToMember({ familyId, targetUid }) {
  await updateDoc(doc(db, 'families', familyId), {
    adminIds: arrayRemove(targetUid),
  });
}

/**
 * Atomically transfers ownership.
 * - New owner is removed from adminIds (if present).
 * - Old owner is added to adminIds.
 * Uses a transaction to guard against concurrent transfers.
 */
export async function transferOwnership({ familyId, currentOwnerId, newOwnerId }) {
  const familyRef = doc(db, 'families', familyId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(familyRef);
    if (!snap.exists()) throw new Error('Family not found.');
    const data = snap.data();
    if (data.ownerId !== currentOwnerId) throw new Error('You are no longer the owner.');

    const prevAdmins = data.adminIds || [];
    // Remove new owner from admins (they're moving up); add old owner to admins.
    const newAdminIds = [
      ...prevAdmins.filter((id) => id !== newOwnerId),
      currentOwnerId,
    ];

    tx.update(familyRef, { ownerId: newOwnerId, adminIds: newAdminIds });
  });
}

/**
 * Permanently deletes the family and clears familyId from every member's doc.
 * Also performs best-effort subcollection cleanup.
 */
export async function deleteFamily({ familyId, memberIds }) {
  // Clear familyId from all members + delete the family doc in one batch.
  const batch = writeBatch(db);
  for (const uid of memberIds) {
    batch.update(doc(db, 'users', uid), { familyId: null });
  }
  batch.delete(doc(db, 'families', familyId));
  await batch.commit();

  // Best-effort: delete known subcollections (Firestore does not auto-cascade).
  const subcols = ['events', 'albums', 'chats', 'messages', 'notes'];
  for (const sub of subcols) {
    try {
      const snap = await getDocs(collection(db, 'families', familyId, sub));
      if (snap.empty) continue;
      const subBatch = writeBatch(db);
      snap.docs.forEach((d) => subBatch.delete(d.ref));
      await subBatch.commit();
    } catch {
      // Ignore subcollection cleanup errors; family doc is already gone.
    }
  }
}
