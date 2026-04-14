import { collection, deleteDoc, doc, getDoc, getDocs } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';

const buildOwnerError = () => {
  const error = new Error('You can only delete your own events');
  error.code = 'not-owner';
  return error;
};

const ensureOwner = async (docRef, currentUser) => {
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    const error = new Error('Event not found');
    error.code = 'not-found';
    throw error;
  }
  const createdBy = snap.data()?.createdBy;
  if (!currentUser?.uid || createdBy !== currentUser.uid) {
    throw buildOwnerError();
  }
  return snap.data();
};

const deleteStoragePath = async (path) => {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    if (error?.code === 'storage/object-not-found') {
      console.warn('Storage object not found for delete:', path);
      return;
    }
    throw error;
  }
};

export const deleteEvent = async ({ familyId, eventId, currentUser }) => {
  if (!familyId || !eventId) {
    throw new Error('Missing event information');
  }
  const eventRef = doc(db, 'families', familyId, 'events', eventId);
  await ensureOwner(eventRef, currentUser);
  await deleteDoc(eventRef);
  console.log('[Delete] Event removed:', eventId);
};

export const deleteCalendarEvent = async ({ familyId, eventId, currentUser }) => {
  if (!familyId || !eventId) {
    throw new Error('Missing event information');
  }
  const eventRef = doc(db, 'families', familyId, 'events', eventId);
  await ensureOwner(eventRef, currentUser);
  await deleteDoc(eventRef);
  console.log('[Delete] Calendar event removed:', eventId);
};

export const deletePhoto = async ({ familyId, albumId, photoId, photoPath }) => {
  if (!familyId || !albumId || !photoId) {
    throw new Error('Missing photo information');
  }
  const photoRef = doc(db, 'families', familyId, 'albums', albumId, 'photos', photoId);
  let resolvedPath = photoPath;
  if (!resolvedPath) {
    const snap = await getDoc(photoRef);
    if (!snap.exists()) {
      const error = new Error('Photo not found');
      error.code = 'not-found';
      throw error;
    }
    resolvedPath = snap.data()?.path;
  }
  await deleteStoragePath(resolvedPath);
  await deleteDoc(photoRef);
  console.log('[Delete] Photo removed:', photoId);
};

export const deleteAlbum = async ({ familyId, albumId }) => {
  if (!familyId || !albumId) {
    throw new Error('Missing album information');
  }
  const photosRef = collection(db, 'families', familyId, 'albums', albumId, 'photos');
  const photosSnapshot = await getDocs(photosRef);
  await Promise.all(
    photosSnapshot.docs.map(async (photoDoc) => {
      const data = photoDoc.data();
      await deleteStoragePath(data?.path);
      await deleteDoc(photoDoc.ref);
    })
  );
  await deleteDoc(doc(db, 'families', familyId, 'albums', albumId));
  console.log('[Delete] Album removed:', albumId);
};
