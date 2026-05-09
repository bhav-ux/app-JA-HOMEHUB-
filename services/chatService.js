import {
  addDoc,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { uploadVoiceMessage } from './storageService';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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
  const seen = new Set();
  return messages.filter((m) => {
    if (!m?.id || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

function getMessagesRef(chat) {
  const { type, familyId, chatId } = chat;
  if (type === 'family') {
    return collection(db, 'families', familyId, 'messages');
  }
  if (type === 'dm') {
    return collection(db, 'families', familyId, 'dms', chatId, 'messages');
  }
  if (type === 'group') {
    return collection(db, 'families', familyId, 'groups', chatId, 'messages');
  }
  throw new Error(`Unknown chat type: ${type}`);
}

function getChatMetaRef(chat) {
  const { type, familyId, chatId } = chat;
  if (type === 'dm') {
    return doc(db, 'families', familyId, 'dms', chatId);
  }
  if (type === 'group') {
    return doc(db, 'families', familyId, 'groups', chatId);
  }
  return null;
}

async function updateChatPreview(chat, text, senderId) {
  const metaRef = getChatMetaRef(chat);
  if (!metaRef) return;
  try {
    await updateDoc(metaRef, {
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: senderId,
    });
  } catch (error) {
    console.warn('[ChatService] updateChatPreview failed', error?.message);
  }
}

// ---------------------------------------------------------------------------
// Backward-compatible legacy exports (used by HomeDashboardScreen + ChatScreen)
// ---------------------------------------------------------------------------

export async function getChatFamilyId(userId) {
  try {
    if (!userId) return null;
    const userSnap = await getDoc(doc(db, 'users', userId));
    const familyId = userSnap.exists() ? userSnap.data()?.familyId || null : null;
    console.log('[ChatService] Family lookup complete', { userId, familyId });
    return familyId;
  } catch (error) {
    console.error('[ChatService] Failed to fetch family ID', { userId, message: error?.message });
    throw error;
  }
}

export function subscribeToMessages({ familyId, onData, onError }) {
  return subscribeToConversation(
    { type: 'family', familyId, chatId: null },
    onData,
    onError
  );
}

export async function sendTextMessage({ familyId, senderId, email, text, messageType = 'text' }) {
  return sendConversationText(
    { type: 'family', familyId, chatId: null },
    senderId,
    email,
    text,
    messageType
  );
}

export async function sendVoiceMessage({ familyId, senderId, email, localUri, duration }) {
  return sendConversationVoice(
    { type: 'family', familyId, chatId: null },
    senderId,
    email,
    localUri,
    duration
  );
}

export async function deleteChatMessage({ familyId, messageId }) {
  return deleteConversationMessage(
    { type: 'family', familyId, chatId: null },
    messageId
  );
}

// ---------------------------------------------------------------------------
// New exports
// ---------------------------------------------------------------------------

export function subscribeToFamilyMemberIds(familyId, callback) {
  if (!familyId) {
    callback([]);
    return () => {};
  }
  const ref = doc(db, 'families', familyId);
  return onSnapshot(
    ref,
    (snap) => {
      const members = snap.exists() ? snap.data()?.members || [] : [];
      callback(members);
    },
    (error) => {
      console.warn('[ChatService] subscribeToFamilyMemberIds error', error?.message);
      callback([]);
    }
  );
}

export function subscribeToFamilyChatPreview(familyId, callback) {
  if (!familyId) {
    callback(null);
    return () => {};
  }
  const q = query(
    collection(db, 'families', familyId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(1)
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback(null);
        return;
      }
      const data = snap.docs[0].data();
      callback({
        text: data.text || '',
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
        senderId: data.senderId || '',
      });
    },
    (error) => {
      console.warn('[ChatService] subscribeToFamilyChatPreview error', error?.message);
      callback(null);
    }
  );
}

export function subscribeToDMs(familyId, userId, onData, onError) {
  if (!familyId || !userId) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, 'families', familyId, 'dms'),
    where('members', 'array-contains', userId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const dms = snap.docs.map((d) => ({
        id: d.id,
        members: d.data().members || [],
        lastMessage: d.data().lastMessage || '',
        lastMessageAt: d.data().lastMessageAt?.toDate ? d.data().lastMessageAt.toDate() : null,
        lastMessageSenderId: d.data().lastMessageSenderId || '',
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : null,
      }));
      dms.sort((a, b) => {
        const ta = a.lastMessageAt ? a.lastMessageAt.getTime() : (a.createdAt ? a.createdAt.getTime() : 0);
        const tb = b.lastMessageAt ? b.lastMessageAt.getTime() : (b.createdAt ? b.createdAt.getTime() : 0);
        return tb - ta;
      });
      onData(dms);
    },
    (error) => {
      console.warn('[ChatService] subscribeToDMs error', error?.message);
      onError?.(error);
    }
  );
}

export function subscribeToGroups(familyId, userId, onData, onError) {
  if (!familyId || !userId) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, 'families', familyId, 'groups'),
    where('members', 'array-contains', userId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const groups = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name || '',
        emoji: d.data().emoji || '',
        members: d.data().members || [],
        admins: d.data().admins || [],
        createdBy: d.data().createdBy || '',
        lastMessage: d.data().lastMessage || '',
        lastMessageAt: d.data().lastMessageAt?.toDate ? d.data().lastMessageAt.toDate() : null,
        lastMessageSenderId: d.data().lastMessageSenderId || '',
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : null,
      }));
      groups.sort((a, b) => {
        const ta = a.lastMessageAt ? a.lastMessageAt.getTime() : (a.createdAt ? a.createdAt.getTime() : 0);
        const tb = b.lastMessageAt ? b.lastMessageAt.getTime() : (b.createdAt ? b.createdAt.getTime() : 0);
        return tb - ta;
      });
      onData(groups);
    },
    (error) => {
      console.warn('[ChatService] subscribeToGroups error', error?.message);
      onError?.(error);
    }
  );
}

export async function createOrGetDM(familyId, userId, targetUserId) {
  const dmId = [userId, targetUserId].sort().join('_');
  const dmRef = doc(db, 'families', familyId, 'dms', dmId);
  const snap = await getDoc(dmRef);
  if (!snap.exists()) {
    await setDoc(dmRef, {
      members: [userId, targetUserId].sort(),
      createdAt: serverTimestamp(),
      lastMessage: '',
      lastMessageAt: null,
      lastMessageSenderId: '',
    });
  }
  return dmId;
}

export async function createGroup(familyId, name, emoji, members, createdBy) {
  const groupRef = await addDoc(collection(db, 'families', familyId, 'groups'), {
    name: name.trim(),
    emoji: emoji || '',
    members,
    admins: [createdBy],
    createdBy,
    createdAt: serverTimestamp(),
    lastMessage: '',
    lastMessageAt: null,
    lastMessageSenderId: '',
  });
  return groupRef.id;
}

export async function leaveGroup(familyId, groupId, userId) {
  const groupRef = doc(db, 'families', familyId, 'groups', groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) return;
  const members = snap.data()?.members || [];
  if (members.length <= 1) {
    await deleteDoc(groupRef);
  } else {
    await updateDoc(groupRef, { members: arrayRemove(userId) });
  }
}

export function subscribeToConversation(chat, onData, onError) {
  try {
    const { familyId } = chat;
    if (!familyId) {
      onData?.([]);
      return () => {};
    }
    const messagesRef = getMessagesRef(chat);
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const msgs = dedupeMessages(
          snapshot.docs.map((d) => normalizeMessage(d, familyId))
        );
        onData?.(msgs);
      },
      (error) => {
        console.error('[ChatService] subscribeToConversation error', error?.message);
        onError?.(error);
      }
    );
  } catch (error) {
    console.error('[ChatService] Failed to start conversation subscription', error?.message);
    onError?.(error);
    return () => {};
  }
}

export async function sendConversationText(chat, senderId, email, text, messageType = 'text') {
  const trimmed = text?.trim();
  if (!trimmed) throw new Error('Message text is required');
  if (!senderId) throw new Error('Sender ID is required');

  const messagesRef = getMessagesRef(chat);
  const payload = {
    chatId: chat.chatId || chat.familyId,
    senderId,
    type: messageType,
    text: trimmed,
    createdAt: serverTimestamp(),
    email: email || null,
  };
  const docRef = await addDoc(messagesRef, payload);
  await updateChatPreview(chat, trimmed, senderId);
  return { id: docRef.id, ...payload };
}

export async function sendConversationVoice(chat, senderId, email, localUri, duration) {
  if (!localUri) throw new Error('Recording URI is required');
  if (!senderId) throw new Error('Sender ID is required');

  const uploadTimestamp = Date.now();
  const chatId = chat.chatId || chat.familyId;
  const { audioUrl, storagePath } = await uploadVoiceMessage({
    uri: localUri,
    chatId,
    timestamp: uploadTimestamp,
  });

  const messagesRef = getMessagesRef(chat);
  const payload = {
    chatId,
    senderId,
    type: 'voice',
    audioUrl,
    duration: Math.max(1, Math.round((duration || 0) / 1000)),
    createdAt: serverTimestamp(),
    email: email || null,
  };
  const docRef = await addDoc(messagesRef, payload);
  await updateChatPreview(chat, '🎤 Voice message', senderId);
  return { id: docRef.id, storagePath, ...payload };
}

export async function deleteConversationMessage(chat, messageId) {
  if (!messageId) throw new Error('Message ID is required');
  const messagesRef = getMessagesRef(chat);
  await deleteDoc(doc(messagesRef, messageId));
}
