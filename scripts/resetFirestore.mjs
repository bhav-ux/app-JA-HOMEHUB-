import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function deleteCollection(ref) {
  const snapshot = await ref.get();
  const deletions = snapshot.docs.map((docSnap) => docSnap.ref.delete());
  await Promise.all(deletions);
}

async function deleteSubcollection(parentRef, name) {
  const subRef = parentRef.collection(name);
  await deleteCollection(subRef);
}

async function deleteAlbumWithPhotos(familyRef) {
  const albumsRef = familyRef.collection('albums');
  const albumsSnap = await albumsRef.get();
  for (const albumDoc of albumsSnap.docs) {
    const photosRef = albumDoc.ref.collection('photos');
    await deleteCollection(photosRef);
    await albumDoc.ref.delete();
  }
}

async function deleteFamilyData() {
  const familiesRef = db.collection('families');
  const familiesSnap = await familiesRef.get();
  for (const familyDoc of familiesSnap.docs) {
    await deleteSubcollection(familyDoc.ref, 'events');
    await deleteSubcollection(familyDoc.ref, 'messages');
    await deleteSubcollection(familyDoc.ref, 'calendar');
    await deleteSubcollection(familyDoc.ref, 'notes');
    await deleteAlbumWithPhotos(familyDoc.ref);
    await familyDoc.ref.delete();
  }
}

async function deleteUsers() {
  const usersRef = db.collection('users');
  await deleteCollection(usersRef);
}

export async function resetFirestore() {
  await deleteFamilyData();
  await deleteUsers();
  console.log('Firestore reset complete (families, users, and subcollections removed).');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  resetFirestore()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Reset failed', err);
      process.exit(1);
    });
}
