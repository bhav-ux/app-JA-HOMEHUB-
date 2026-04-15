import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

function normalizeEvent(eventDoc, familyId) {
  const data = eventDoc.data();

  return {
    id: eventDoc.id,
    familyId,
    ...data,
  };
}

export async function getUserFamilyId(userId) {
  try {
    if (!userId) {
      console.log('[EventService] No user ID provided for family lookup');
      return null;
    }

    const userSnap = await getDoc(doc(db, 'users', userId));
    const familyId = userSnap.exists() ? userSnap.data()?.familyId || null : null;

    console.log('[EventService] Family lookup complete', {
      userId,
      familyId,
    });

    return familyId;
  } catch (error) {
    console.error('[EventService] Failed to fetch family ID', {
      userId,
      code: error?.code || null,
      message: error?.message || 'Unknown Firestore error',
    });
    throw error;
  }
}

export async function createEvent({
  familyId,
  title,
  description,
  date,
  createdBy,
  createdByEmail,
}) {
  try {
    if (!familyId) {
      throw new Error('Family ID is required to create an event');
    }

    if (!createdBy) {
      throw new Error('User ID is required to create an event');
    }

    const trimmedTitle = title?.trim();

    if (!trimmedTitle) {
      throw new Error('Event title is required');
    }

    const eventDate = date instanceof Date ? date : new Date(date);

    if (Number.isNaN(eventDate.getTime())) {
      throw new Error('Event date is invalid');
    }

    const payload = {
      title: trimmedTitle,
      description: description?.trim() || '',
      date: eventDate,
      createdBy,
      createdByEmail: createdByEmail || null,
      createdAt: serverTimestamp(),
    };

    console.log('[EventService] Creating event', {
      familyId,
      title: payload.title,
      createdBy,
    });

    const docRef = await addDoc(collection(db, 'families', familyId, 'events'), payload);

    console.log('[EventService] Event created', {
      familyId,
      eventId: docRef.id,
    });

    return {
      id: docRef.id,
      familyId,
      ...payload,
    };
  } catch (error) {
    console.error('[EventService] Failed to create event', {
      familyId,
      createdBy,
      code: error?.code || null,
      message: error?.message || 'Unknown Firestore error',
    });
    throw error;
  }
}

export function subscribeToEvents({ familyId, onData, onError }) {
  try {
    if (!familyId) {
      console.log('[EventService] Skipping event subscription without family ID');
      onData?.([]);
      return () => {};
    }

    console.log('[EventService] Subscribing to events', { familyId });

    const eventsQuery = query(
      collection(db, 'families', familyId, 'events'),
      orderBy('date', 'asc')
    );

    return onSnapshot(
      eventsQuery,
      (snapshot) => {
        const events = snapshot.docs.map((eventDoc) => normalizeEvent(eventDoc, familyId));

        console.log('[EventService] Events snapshot received', {
          familyId,
          count: events.length,
        });

        onData?.(events);
      },
      (error) => {
        console.error('[EventService] Event subscription failed', {
          familyId,
          code: error?.code || null,
          message: error?.message || 'Unknown Firestore error',
        });
        onError?.(error);
      }
    );
  } catch (error) {
    console.error('[EventService] Failed to start event subscription', {
      familyId,
      code: error?.code || null,
      message: error?.message || 'Unknown Firestore error',
    });
    onError?.(error);
    return () => {};
  }
}
