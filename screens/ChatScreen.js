import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { colors, radius, shadow, spacing, typography } from '../src/theme';
import { listenToUserDisplayName } from '../utils/user';

export default function ChatScreen({ navigation }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [familyId, setFamilyId] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [nameMap, setNameMap] = useState({});
  const listRef = useRef(null);
  const nameListeners = useRef({});

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Family Chat',
      headerTitleAlign: 'center',
      headerTitleStyle: { fontWeight: '700' },
    });
  }, [navigation]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        const rootNav = navigation.getParent?.() || navigation;
        rootNav?.navigate?.('Login');
      }
    });

    return unsubscribeAuth;
  }, [navigation]);

  useEffect(() => {
    const fetchFamily = async () => {
      if (!auth.currentUser?.uid) {
        setFamilyLoading(false);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const familyValue = snap.exists() ? snap.data()?.familyId : null;
        setFamilyId(familyValue || null);
      } catch (error) {
        console.error('Error fetching family', error);
      } finally {
        setFamilyLoading(false);
      }
    };
    fetchFamily();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(nameListeners.current).forEach((unsubscribe) => unsubscribe?.());
      nameListeners.current = {};
    };
  }, []);

  useEffect(() => {
    if (!auth.currentUser || !familyId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const messagesRef = collection(db, 'families', familyId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const nextMessages = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text || '',
            senderId: data.senderId,
            email: data.email,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
          };
        });
        const senderIds = Array.from(new Set(nextMessages.map((m) => m.senderId).filter(Boolean)));
        senderIds.forEach((uid) => {
          if (nameListeners.current[uid]) return;
          nameListeners.current[uid] = listenToUserDisplayName(uid, (displayName) => {
            setNameMap((prev) => ({ ...prev, [uid]: displayName || '' }));
          });
        });
        setMessages(nextMessages);
        setLoading(false);
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      },
      () => setLoading(false)
    );

    return unsubscribe;
  }, [familyId]);

  const handleSend = async () => {
    const trimmed = input.trim();
    const userId = auth.currentUser?.uid;
    if (!trimmed || !userId || !familyId) {
      return;
    }

    try {
      await addDoc(collection(db, 'families', familyId, 'messages'), {
        text: trimmed,
        senderId: userId,
        email: auth.currentUser?.email || null,
        createdAt: new Date(),
      });
      setInput('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (error) {
      // In a real app you might show a toast or error state
      console.error('Failed to send message', error);
    }
  };

  const handleMessageLongPress = (message) => {
    if (!message || message.senderId !== auth.currentUser?.uid || !familyId) {
      return;
    }
    Alert.alert('Delete message?', 'This will remove it for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setMessages((prev) => prev.filter((m) => m.id !== message.id));
            await deleteDoc(doc(db, 'families', familyId, 'messages', message.id));
          } catch (error) {
            console.error('Failed to delete message', error);
          }
        },
      },
    ]);
  };

  const renderMessage = ({ item }) => {
    const isCurrentUser = item.senderId === auth.currentUser?.uid;
    const senderLabel = nameMap[item.senderId] || item.email || item.senderId || 'Unknown sender';
    const timeLabel = item.createdAt
      ? item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() => handleMessageLongPress(item)}
      >
        <View style={[styles.messageRow, isCurrentUser ? styles.rowRight : styles.rowLeft]}>
          <Text style={[styles.senderText, isCurrentUser && styles.senderTextRight]}>{senderLabel}</Text>
          <View style={[styles.bubble, isCurrentUser ? styles.bubbleRight : styles.bubbleLeft]}>
            <Text style={[styles.messageText, isCurrentUser ? styles.textRight : styles.textLeft]}>
              {item.text}
            </Text>
          </View>
          <Text style={[styles.timeText, isCurrentUser ? styles.timeRight : styles.timeLeft]}>{timeLabel}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const isSendDisabled = !input.trim();

  if (loading || familyLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!familyId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.senderText}>No family found for your account.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={<View style={styles.footerSpacing} />}
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, isSendDisabled && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={isSendDisabled}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoider: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  messageRow: {
    maxWidth: '80%',
    marginVertical: spacing.xs,
  },
  rowRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    marginRight: spacing.md,
  },
  rowLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    marginLeft: spacing.md,
  },
  bubble: {
    maxWidth: '100%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    ...shadow,
  },
  bubbleRight: {
    backgroundColor: colors.primary,
  },
  bubbleLeft: {
    backgroundColor: colors.border,
  },
  messageText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  textRight: {
    color: '#fff',
  },
  textLeft: {
    color: colors.textPrimary,
  },
  timeText: {
    marginTop: spacing.xs,
    fontSize: typography.small.fontSize,
    color: colors.textSecondary,
  },
  timeRight: {
    alignSelf: 'flex-end',
  },
  timeLeft: {
    alignSelf: 'flex-start',
  },
  senderText: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  senderTextRight: {
    color: colors.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    ...shadow,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: 16,
    backgroundColor: colors.surface,
  },
  sendButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
    ...shadow,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  footerSpacing: { height: spacing.sm },
});
