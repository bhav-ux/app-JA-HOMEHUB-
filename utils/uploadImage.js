import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig';

export async function uploadImage(uri, path) {
  const response = await fetch(uri);
  const blob = await response.blob();

  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);

  return getDownloadURL(storageRef);
}

// Generic file upload (images, video, documents) with an explicit content-type
// fallback — local file:// blobs don't always carry a reliable `blob.type`.
export async function uploadFile(uri, path, fallbackContentType = 'application/octet-stream') {
  const response = await fetch(uri);
  const blob = await response.blob();

  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: blob.type || fallbackContentType });

  const downloadURL = await getDownloadURL(storageRef);
  if (typeof blob.close === 'function') blob.close();
  return { downloadURL, size: blob.size || 0 };
}
