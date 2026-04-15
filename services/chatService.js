import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { uploadVoiceMessage } from './storageService';

function normalizeMessage(messageDoc, familyId) {
  const data = messageDoc.data();

  return {
    id: messageDoc.id,
    chatId: data.chatId || familyId,
    senderId: data.senderId || '',
    email: data.email || null,
    type: data.type || 'text',
    text: data.text || '',
    audioUrl: data.audioUrl || '',
    duration: data.duration || 0,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
  };
}

function dedupeMessages(messages) {
  const uniqueMessages = [];
  const seen = new Set();

  messages.forEach((message) => {
    if (!message?.id || seen.has(message.id)) {
      return;
    }

    seen.add(message.id);
    uniqueMessages.push(message);
  });

  return uniqueMessages;
}

export async function getChatFamilyId(userId) {
  try {
    if (!userId) {
      console.log('[ChatService] No user ID provided for family lookup');
      return null;
    }

    const userSnap = await getDoc(doc(db, 'users', userId));
    const familyId = userSnap.exists() ? userSnap.data()?.familyId || null : null;

    console.log('[ChatService] Family lookup complete', {
      userId,
      familyId,
    });

    return familyId;
  } catch (error) {
    console.error('[ChatService] Failed to fetch family ID', {
      userId,
      code: error?.code || null,
      message: error?.message || 'Unknown Firestore error',
    });
    throw error;
  }
}

export function subscribeToMessages({ familyId, onData, onError }) {
  try {
    if (!familyId) {
      console.log('[ChatService] Skipping message subscription without family ID');
      onData?.([]);
      return () => {};
    }

    console.log('[ChatService] Subscribing to messages', { familyId });

    const messagesQuery = query(
      collection(db, 'families', familyId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    return onSnapshot(
      messagesQuery,
      (snapshot) => {
        const normalizedMessages = dedupeMessages(
          snapshot.docs.map((messageDoc) => normalizeMessage(messageDoc, familyId))
        );

        console.log('[ChatService] Messages snapshot received', {
          familyId,
          count: normalizedMessages.length,
        });

        onData?.(normalizedMessages);
      },
      (error) => {
        console.error('[ChatService] Message subscription failed', {
          familyId,
          code: error?.code || null,
          message: error?.message || 'Unknown Firestore error',
        });
        onError?.(error);
      }
    );
  } catch (error) {
    console.error('[ChatService] Failed to start message subscription', {
      familyId,
      code: error?.code || null,
      message: error?.message || 'Unknown Firestore error',
    });
    onError?.(error);
    return () => {};
  }
}

export async function sendTextMessage({
  familyId,
  senderId,
  email,
  text,
  messageType = 'text',
}) {
  try {
    if (!familyId) {
      throw new Error('Family ID is required to send a message');
    }

    if (!senderId) {
      throw new Error('Sender ID is required to send a message');
    }

    const trimmedText = text?.trim();

    if (!trimmedText) {
      throw new Error('Message text is required');
    }

    const payload = {
      chatId: familyId,
      senderId,
      type: messageType,
      text: trimmedText,
      createdAt: serverTimestamp(),
      email: email || null,
    };

    console.log('[ChatService] Sending text message', {
      familyId,
      senderId,
      messageType,
    });

    const docRef = await addDoc(collection(db, 'families', familyId, 'messages'), payload);

    console.log('[ChatService] Text message sent', {
      familyId,
      messageId: docRef.id,
    });

    return {
      id: docRef.id,
      ...payload,
    };
  } catch (error) {
    console.error('[ChatService] Failed to send text message', {
      familyId,
      senderId,
      code: error?.code || null,
      message: error?.message || 'Unknown Firestore error',
    });
    throw error;
  }
}

export async function sendVoiceMessage({
  familyId,
  senderId,
  email,
  localUri,
  duration,
}) {
  try {
    if (!familyId) {
      throw new Error('Family ID is required to send a voice message');
    }

    if (!senderId) {
      throw new Error('Sender ID is required to send a voice message');
    }

    if (!localUri) {
      throw new Error('Recording URI is required to send a voice message');
    }

    const uploadTimestamp = Date.now();

    console.log('[ChatService] Uploading voice message', {
      familyId,
      senderId,
      localUri,
      duration,
      uploadTimestamp,
    });

    const { audioUrl, storagePath } = await uploadVoiceMessage({
      uri: localUri,
      chatId: familyId,
      timestamp: uploadTimestamp,
    });

    const payload = {
      chatId: familyId,
      senderId,
      type: 'voice',
      audioUrl,
      duration: Math.max(1, Math.round((duration || 0) / 1000)),
      createdAt: serverTimestamp(),
      email: email || null,
    };

    const docRef = await addDoc(collection(db, 'families', familyId, 'messages'), payload);

    console.log('[ChatService] Voice message sent', {
      familyId,
      messageId: docRef.id,
      storagePath,
    });

    return {
      id: docRef.id,
      storagePath,
      ...payload,
    };
  } catch (error) {
    console.error('[ChatService] Failed to send voice message', {
      familyId,
      senderId,
      localUri,
      duration,
      code: error?.code || null,
      message: error?.message || 'Unknown voice message error',
      stack: error?.stack || null,
    });
    throw error;
  }
}

export async function deleteChatMessage({ familyId, messageId }) {
  try {
    if (!familyId || !messageId) {
      throw new Error('Family ID and message ID are required to delete a message');
    }

    console.log('[ChatService] Deleting message', {
      familyId,
      messageId,
    });

    await deleteDoc(doc(db, 'families', familyId, 'messages', messageId));

    console.log('[ChatService] Message deleted', {
      familyId,
      messageId,
    });
  } catch (error) {
    console.error('[ChatService] Failed to delete message', {
      familyId,
      messageId,
      code: error?.code || null,
      message: error?.message || 'Unknown Firestore error',
    });
    throw error;
  }
}
