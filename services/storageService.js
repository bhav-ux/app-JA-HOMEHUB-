import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebaseConfig';

async function getBlobFromFileUri(uri) {
  try {
    const response = await fetch(uri);

    if (!response.ok) {
      throw new Error(`File fetch failed with status ${response.status}`);
    }

    const blob = await response.blob();

    if (!blob || !blob.size) {
      throw new Error('Fetched audio blob is empty');
    }

    return blob;
  } catch (error) {
    console.error('[StorageService] Failed to convert file URI to blob', {
      uri,
      code: error?.code || null,
      message: error?.message || 'Unknown blob conversion error',
    });
    throw error;
  }
}

export async function uploadVoiceMessage({ uri, chatId, timestamp = Date.now() }) {
  try {
    if (!storage) {
      throw new Error('Firebase Storage is not initialized');
    }

    if (!uri) {
      throw new Error('Recording URI is missing');
    }

    if (!chatId) {
      throw new Error('Chat ID is required for voice uploads');
    }

    const safeTimestamp = Number(timestamp) || Date.now();
    const blob = await getBlobFromFileUri(uri);
    const storagePath = `voiceMessages/${chatId}/${safeTimestamp}.webm`;
    const storageRef = ref(storage, storagePath);

    console.log('[StorageService] Uploading voice message', {
      chatId,
      uri,
      storagePath,
      blobSize: blob.size,
      blobType: blob.type || 'audio/webm',
    });

    await uploadBytes(storageRef, blob, {
      contentType: blob.type || 'audio/webm',
    });

    const downloadURL = await getDownloadURL(storageRef);

    console.log('[StorageService] Voice upload complete', {
      chatId,
      storagePath,
    });

    if (typeof blob.close === 'function') {
      blob.close();
    }

    return {
      audioUrl: downloadURL,
      storagePath,
      timestamp: safeTimestamp,
    };
  } catch (error) {
    console.error('[StorageService] Voice upload failed', {
      chatId,
      uri,
      code: error?.code || null,
      message: error?.message || 'Unknown storage error',
      stack: error?.stack || null,
    });
    throw error;
  }
}
