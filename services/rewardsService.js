import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { uploadImage } from '../utils/uploadImage';
import { addDaysToKey, getDateKey, getISOWeekKey } from '../utils/dateKeys';

// ─── Constants ───────────────────────────────────────────────────────────────

export const CHORE_FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'once', label: 'One-time' },
];

export function frequencyLabel(value) {
  return CHORE_FREQUENCIES.find((f) => f.value === value)?.label || value;
}

export const VERIFICATION_TYPES = [
  { value: 'auto', label: 'Auto-approve', description: 'Points are awarded instantly' },
  { value: 'photo', label: 'Photo proof', description: 'Attach a photo, a parent reviews it' },
  { value: 'parent', label: 'Parent approval', description: 'A parent reviews and approves' },
];

export function verificationLabel(value) {
  return VERIFICATION_TYPES.find((v) => v.value === value)?.label || value;
}

export const CHORE_ICONS = [
  'bed-outline', 'book-outline', 'school-outline', 'paw-outline',
  'restaurant-outline', 'trash-outline', 'shirt-outline', 'water-outline',
  'leaf-outline', 'brush-outline', 'basket-outline', 'home-outline',
  'car-outline', 'football-outline', 'musical-notes-outline', 'bicycle-outline',
];

export const REWARD_ICONS = [
  'game-controller-outline', 'ice-cream-outline', 'film-outline', 'gift-outline',
  'bicycle-outline', 'pizza-outline', 'tv-outline', 'musical-notes-outline',
  'airplane-outline', 'cash-outline', 'time-outline', 'star-outline',
];

const DUPLICATE_SUBMISSION = 'rewards/duplicate-submission';
const ALREADY_REVIEWED = 'rewards/already-reviewed';
const INSUFFICIENT_BALANCE = 'rewards/insufficient-balance';

function familyCol(familyId, name) {
  return collection(db, 'families', familyId, name);
}

function familyDoc(familyId, name, id) {
  return doc(db, 'families', familyId, name, id);
}

function normalize(snapshotDoc) {
  return { id: snapshotDoc.id, ...snapshotDoc.data() };
}

function subscribeCollection(familyId, name, label, onData, onError) {
  if (!familyId) {
    onData?.([]);
    return () => {};
  }
  return onSnapshot(
    familyCol(familyId, name),
    (snapshot) => onData?.(snapshot.docs.map(normalize)),
    (error) => {
      console.error(`[RewardsService] ${label} subscription failed`, {
        familyId,
        code: error?.code || null,
        message: error?.message || 'Unknown Firestore error',
      });
      onError?.(error);
    }
  );
}

// ─── Chores ──────────────────────────────────────────────────────────────────

export function subscribeChores(familyId, onData, onError) {
  return subscribeCollection(familyId, 'chores', 'Chores', onData, onError);
}

export async function addChore(familyId, data, uid) {
  const payload = {
    title: data.title?.trim() || 'Chore',
    description: data.description?.trim() || '',
    icon: data.icon || 'checkmark-circle-outline',
    points: Math.max(1, Math.round(Number(data.points)) || 10),
    frequency: data.frequency || 'daily',
    verification: data.verification || 'parent',
    assignedTo: Array.isArray(data.assignedTo) ? data.assignedTo : [],
    active: true,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(familyCol(familyId, 'chores'), payload);
  return ref.id;
}

export async function updateChore(familyId, choreId, data) {
  await updateDoc(familyDoc(familyId, 'chores', choreId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteChore(familyId, choreId) {
  await deleteDoc(familyDoc(familyId, 'chores', choreId));
}

// ─── Period keys & submission identity ──────────────────────────────────────

// Submissions use a deterministic ID (chore + assignee + period) so that a
// duplicate submit for the same chore/period is a write to the same document
// rather than a new one — this is what makes "prevent duplicate submissions"
// and "prevent double-awarding" enforceable inside a single transaction.
export function getPeriodKey(frequency, date = new Date()) {
  if (frequency === 'weekly') return getISOWeekKey(date);
  if (frequency === 'once') return 'once';
  return getDateKey(date);
}

export function getSubmissionId(choreId, userId, periodKey) {
  return `${choreId}_${userId}_${periodKey}`;
}

// ─── Submissions ─────────────────────────────────────────────────────────────

export function subscribeSubmissions(familyId, onData, onError) {
  return subscribeCollection(familyId, 'choreSubmissions', 'Submissions', onData, onError);
}

export async function uploadChoreProof(uri, familyId, submissionId) {
  const path = `families/${familyId}/choreProofs/${submissionId}-${Date.now()}.jpg`;
  return uploadImage(uri, path);
}

// Computes the next userStats document after awarding `pointsToAdd`,
// updating lifetime/weekly totals, streaks and the longest-streak record.
function computeAwardedStats(existing, pointsToAdd) {
  const todayKey = getDateKey();
  const yesterdayKey = addDaysToKey(todayKey, -1);
  const weekKey = getISOWeekKey();
  const prev = existing || {};

  const lifetimePoints = (prev.lifetimePoints || 0) + pointsToAdd;
  const balance = (prev.balance || 0) + pointsToAdd;
  const totalCompleted = (prev.totalCompleted || 0) + 1;

  const weeklyBase = prev.weekKey === weekKey ? (prev.weeklyPoints || 0) : 0;
  const weeklyPoints = weeklyBase + pointsToAdd;

  let streak = prev.streak || 0;
  if (prev.lastCompletionDate === todayKey) {
    // already counted today — streak unchanged
  } else if (prev.lastCompletionDate === yesterdayKey) {
    streak += 1;
  } else {
    streak = 1;
  }
  const longestStreak = Math.max(prev.longestStreak || 0, streak);

  return {
    lifetimePoints,
    balance,
    totalCompleted,
    weeklyPoints,
    weekKey,
    streak,
    longestStreak,
    lastCompletionDate: todayKey,
    updatedAt: serverTimestamp(),
  };
}

// Submits a chore for the current period. Auto-verified chores are approved
// (and points awarded) atomically in the same transaction.
export async function submitChore(familyId, chore, userId, { photoURL } = {}) {
  const periodKey = getPeriodKey(chore.frequency);
  const submissionId = getSubmissionId(chore.id, userId, periodKey);
  const submissionRef = familyDoc(familyId, 'choreSubmissions', submissionId);
  const userStatsRef = familyDoc(familyId, 'userStats', userId);
  const choreRef = familyDoc(familyId, 'chores', chore.id);

  await runTransaction(db, async (tx) => {
    const submissionSnap = await tx.get(submissionRef);
    if (submissionSnap.exists() && submissionSnap.data().status !== 'rejected') {
      const error = new Error('This chore was already submitted for this period.');
      error.code = DUPLICATE_SUBMISSION;
      throw error;
    }

    const isAuto = chore.verification === 'auto';
    const base = {
      choreId: chore.id,
      choreTitle: chore.title,
      choreIcon: chore.icon || 'checkmark-circle-outline',
      points: chore.points,
      frequency: chore.frequency,
      verification: chore.verification,
      userId,
      periodKey,
      photoURL: photoURL || null,
      submittedAt: serverTimestamp(),
      reviewedAt: null,
      reviewedBy: null,
      note: null,
    };

    if (isAuto) {
      const statsSnap = await tx.get(userStatsRef);
      const nextStats = computeAwardedStats(statsSnap.exists() ? statsSnap.data() : null, chore.points);
      tx.set(submissionRef, { ...base, status: 'approved', reviewedAt: serverTimestamp() });
      tx.set(userStatsRef, nextStats, { merge: true });
    } else {
      tx.set(submissionRef, { ...base, status: 'pending' });
    }

    if (chore.frequency === 'once') {
      tx.update(choreRef, { active: false, updatedAt: serverTimestamp() });
    }
  });
}

export async function approveSubmission(familyId, submission, reviewerUid) {
  const submissionRef = familyDoc(familyId, 'choreSubmissions', submission.id);
  const userStatsRef = familyDoc(familyId, 'userStats', submission.userId);

  await runTransaction(db, async (tx) => {
    const submissionSnap = await tx.get(submissionRef);
    if (!submissionSnap.exists() || submissionSnap.data().status !== 'pending') {
      const error = new Error('This submission has already been reviewed.');
      error.code = ALREADY_REVIEWED;
      throw error;
    }

    const statsSnap = await tx.get(userStatsRef);
    const nextStats = computeAwardedStats(
      statsSnap.exists() ? statsSnap.data() : null,
      submissionSnap.data().points
    );

    tx.update(submissionRef, {
      status: 'approved',
      reviewedAt: serverTimestamp(),
      reviewedBy: reviewerUid,
    });
    tx.set(userStatsRef, nextStats, { merge: true });
  });
}

export async function rejectSubmission(familyId, submission, reviewerUid, note = '') {
  const submissionRef = familyDoc(familyId, 'choreSubmissions', submission.id);

  await runTransaction(db, async (tx) => {
    const submissionSnap = await tx.get(submissionRef);
    if (!submissionSnap.exists() || submissionSnap.data().status !== 'pending') {
      const error = new Error('This submission has already been reviewed.');
      error.code = ALREADY_REVIEWED;
      throw error;
    }

    tx.update(submissionRef, {
      status: 'rejected',
      reviewedAt: serverTimestamp(),
      reviewedBy: reviewerUid,
      note: note || null,
    });
  });
}

// ─── User stats ──────────────────────────────────────────────────────────────

export function subscribeUserStats(familyId, onData, onError) {
  return subscribeCollection(familyId, 'userStats', 'User stats', onData, onError);
}

export function getEmptyStats(userId) {
  return {
    id: userId,
    balance: 0,
    lifetimePoints: 0,
    weeklyPoints: 0,
    weekKey: getISOWeekKey(),
    streak: 0,
    longestStreak: 0,
    lastCompletionDate: null,
    totalCompleted: 0,
  };
}

// ─── Rewards ─────────────────────────────────────────────────────────────────

export function subscribeRewards(familyId, onData, onError) {
  return subscribeCollection(familyId, 'rewards', 'Rewards', onData, onError);
}

export async function addReward(familyId, data, uid) {
  const payload = {
    title: data.title?.trim() || 'Reward',
    description: data.description?.trim() || '',
    icon: data.icon || 'gift-outline',
    cost: Math.max(1, Math.round(Number(data.cost)) || 50),
    active: true,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(familyCol(familyId, 'rewards'), payload);
  return ref.id;
}

export async function updateReward(familyId, rewardId, data) {
  await updateDoc(familyDoc(familyId, 'rewards', rewardId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteReward(familyId, rewardId) {
  await deleteDoc(familyDoc(familyId, 'rewards', rewardId));
}

// ─── Redemptions ─────────────────────────────────────────────────────────────

export function subscribeRedemptions(familyId, onData, onError) {
  return subscribeCollection(familyId, 'rewardRedemptions', 'Redemptions', onData, onError);
}

export async function redeemReward(familyId, reward, userId) {
  const userStatsRef = familyDoc(familyId, 'userStats', userId);
  const redemptionRef = doc(familyCol(familyId, 'rewardRedemptions'));

  await runTransaction(db, async (tx) => {
    const statsSnap = await tx.get(userStatsRef);
    const balance = statsSnap.exists() ? (statsSnap.data().balance || 0) : 0;
    if (balance < reward.cost) {
      const error = new Error('Not enough points for this reward yet.');
      error.code = INSUFFICIENT_BALANCE;
      throw error;
    }

    tx.set(userStatsRef, { balance: balance - reward.cost, updatedAt: serverTimestamp() }, { merge: true });
    tx.set(redemptionRef, {
      rewardId: reward.id,
      rewardTitle: reward.title,
      rewardIcon: reward.icon || 'gift-outline',
      cost: reward.cost,
      userId,
      status: 'pending',
      redeemedAt: serverTimestamp(),
      fulfilledAt: null,
      fulfilledBy: null,
    });
  });
}

export async function fulfillRedemption(familyId, redemptionId, reviewerUid) {
  await updateDoc(familyDoc(familyId, 'rewardRedemptions', redemptionId), {
    status: 'fulfilled',
    fulfilledAt: serverTimestamp(),
    fulfilledBy: reviewerUid,
  });
}
