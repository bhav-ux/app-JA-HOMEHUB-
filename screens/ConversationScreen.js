import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import {
  deleteConversationMessage,
  leaveGroup,
  sendConversationText,
  sendConversationVoice,
  subscribeToConversation,
} from '../services/chatService';
import MessageBubble from '../src/components/MessageBubble';
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';
import { showAlert, showConfirm } from '../utils/dialogs';
import { listenToUserDisplayName } from '../utils/user';

// ─── Constants ───────────────────────────────────────────────────────────────

const EMOJIS = [
  '😀', '😂', '😍', '😭', '🙏', '❤️', '🔥', '👏',
  '👍', '🎉', '🥳', '😎', '🤔', '😢', '😡', '🙌',
  '💯', '✨', '🤝', '👀', '🎶', '🌟', '💪', '🏠',
  '📸', '🗓️', '💬', '📍', '🧡', '✅', '🎯', '🥰',
];

const AVATAR_COLORS = [
  '#6366F1', '#F43F5E', '#F59E0B', '#0D9488',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
];

const CHAT_GREEN = '#22C55E';
const CHAT_GREEN_DARK = '#16A34A';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAvatarColor(str) {
  if (!str) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].charAt(0).toUpperCase()
    : (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const formatDuration = (s) => {
  const n = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(n / 60)}:${(n % 60).toString().padStart(2, '0')}`;
};

const getMessageTime = (message) => {
  const value = message?.createdAt;
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : new Date(value || 0);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
};

const restoreDeletedMessage = (messages, message) => {
  if (!message || messages.some((item) => item.id === message.id)) return messages;
  return [...messages, message].sort((left, right) => {
    const timeDiff = getMessageTime(left) - getMessageTime(right);
    if (timeDiff !== 0) return timeDiff;
    return String(left.id || '').localeCompare(String(right.id || ''));
  });
};

const getMessageDate = (message) => {
  const value = message?.createdAt;
  return value?.toDate ? value.toDate() : value instanceof Date ? value : new Date(value || 0);
};

const getDayLabel = (date) => {
  const now = new Date();
  const diff = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
      new Date(date.getFullYear(), date.getMonth(), date.getDate())) /
      86400000
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const isEmojiOnly = (val) => {
  const t = val.trim();
  if (!t) return false;
  return /^[\p{Extended_Pictographic}️\s]+$/u.test(t);
};

// ─── Avatar ──────────────────────────────────────────────────────────────────

function MiniAvatar({ name, uid, size = 30, emoji }) {
  const bg = getAvatarColor(uid || name || '');
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: emoji ? size * 0.5 : size * 0.38, color: '#fff', fontWeight: '700' }}>
        {emoji || getInitials(name)}
      </Text>
    </View>
  );
}

// Custom header title: avatar + name + subtitle
function ChatHeaderTitle({ name, subtitle, emoji, chatId, textColor }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: Platform.OS === 'ios' ? -8 : 0 }}>
      <MiniAvatar name={name} uid={chatId || ''} size={38} emoji={emoji || null} />
      <View style={{ marginLeft: 10 }}>
        <Text style={{ color: textColor, fontWeight: '700', fontSize: 16, letterSpacing: -0.2 }} numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text style={{ color: CHAT_GREEN, fontWeight: '600', fontSize: 12, marginTop: 1 }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ConversationScreen({ navigation, route }) {
  const chat = route?.params?.chat;
  const { type, familyId, chatId, name, emoji, memberCount, members } = chat || {};

  const { theme } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [nameMap, setNameMap] = useState({});
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordingStartedAt, setRecordingStartedAt] = useState(null);
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [playbackMap, setPlaybackMap] = useState({});
  const [currentUser, setCurrentUser] = useState(null);

  const listRef = useRef(null);
  const nameListenersRef = useRef({});
  const soundRef = useRef(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // ── Group info handler (defined first so useLayoutEffect can reference it) ──
  const handleGroupInfo = useCallback(() => {
    if (type !== 'group') return;
    const memberNames = (members || []).map((uid) => nameMap[uid] || uid).join(', ');
    showAlert(
      name || 'Group Info',
      `Members: ${memberNames || 'None'}`,
      [
        {
          text: 'Leave Group',
          style: 'destructive',
          onPress: () =>
            showConfirm('Leave Group', 'Are you sure you want to leave this group?', {
              confirmText: 'Leave',
              onConfirm: async () => {
                try {
                  await leaveGroup(familyId, chatId, currentUser?.uid);
                  navigation.goBack();
                } catch {
                  showAlert('Error', 'Could not leave the group. Please try again.');
                }
              },
            }),
        },
        { text: 'Close', style: 'cancel' },
      ]
    );
  }, [type, members, nameMap, name, familyId, chatId, currentUser?.uid, navigation]);

  // ── Navigation header ────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const subtitle =
      type === 'family'
        ? memberCount ? `${memberCount} members` : 'Family group'
        : type === 'group'
        ? `${(members || []).length} members`
        : null;

    navigation.setOptions({
      headerShown: true,
      headerStyle: { backgroundColor: theme.card, shadowOpacity: 0, elevation: 0, borderBottomWidth: 1, borderBottomColor: theme.border },
      headerTintColor: theme.text,
      headerTitleAlign: 'left',
      headerTitle: () => (
        <ChatHeaderTitle
          name={name || 'Chat'}
          subtitle={subtitle}
          emoji={emoji}
          chatId={chatId}
          textColor={theme.text}
        />
      ),
      headerRight:
        type === 'group'
          ? () => (
              <TouchableOpacity
                onPress={handleGroupInfo}
                style={{ marginRight: spacing.md, padding: 4 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="people-outline" size={22} color={theme.secondaryText} />
              </TouchableOpacity>
            )
          : undefined,
    });
  }, [navigation, name, theme, type, members, memberCount, chatId, emoji, handleGroupInfo]);

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) (navigation.getParent?.() || navigation)?.navigate?.('Login');
    });
    return unsub;
  }, [navigation]);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => () => {
    Object.values(nameListenersRef.current).forEach((fn) => fn?.());
    nameListenersRef.current = {};
    soundRef.current?.remove?.();
  }, []);

  // ── Messages subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!familyId) { setMessages([]); setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeToConversation(
      chat,
      (msgs) => {
        Array.from(new Set(msgs.map((m) => m.senderId).filter(Boolean))).forEach((uid) => {
          if (nameListenersRef.current[uid]) return;
          nameListenersRef.current[uid] = listenToUserDisplayName(uid, (n) =>
            setNameMap((prev) => ({ ...prev, [uid]: n || '' }))
          );
        });
        setMessages(msgs);
        setLoading(false);
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      },
      () => { setMessages([]); setLoading(false); }
    );
    return unsub;
  }, [familyId, chatId, type]);

  // ── Audio ────────────────────────────────────────────────────────────────
  const stopCurrentAudio = useCallback(async () => {
    if (!soundRef.current) return;
    try { soundRef.current.pause(); soundRef.current.remove(); }
    catch { /* ignore */ }
    finally { soundRef.current = null; setPlayingMessageId(null); }
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !currentUser?.uid || !familyId || sending) return;
    try {
      setSending(true);
      await sendConversationText(chat, currentUser.uid, currentUser.email || null, trimmed, isEmojiOnly(trimmed) ? 'emoji' : 'text');
      setInput('');
      setShowEmojiPicker(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch { showAlert('Send failed', 'Could not send your message.'); }
    finally { setSending(false); }
  };

  const startVoiceRecording = useCallback(async () => {
    if (!currentUser?.uid || !familyId || isRecording || uploadingVoice) return;
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) { showAlert('Microphone access needed', 'Please allow microphone permission.'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true); setRecordingStartedAt(Date.now()); setIsRecording(true);
    } catch { showAlert('Recording error', 'Could not start recording.'); }
  }, [familyId, isRecording, uploadingVoice, currentUser?.uid, recorder]);

  const stopVoiceRecording = useCallback(async () => {
    if (!recording || !familyId || !currentUser?.uid) return;
    let localUri = '', durationMs = 0;
    try {
      await recorder.stop();
      const status = recorder.getStatus();
      localUri = recorder.uri || '';
      durationMs = status.durationMillis || (Date.now() - (recordingStartedAt || Date.now()));
    } catch {
      showAlert('Recording error', 'Unable to finish recording.');
      setRecording(null); setIsRecording(false); setRecordingStartedAt(null);
      return;
    }
    setRecording(null); setIsRecording(false); setRecordingStartedAt(null);
    if (!localUri || durationMs < 400) { showAlert('Too short', 'Hold the mic a bit longer.'); return; }
    try {
      setUploadingVoice(true);
      await sendConversationVoice(chat, currentUser.uid, currentUser.email || null, localUri, durationMs);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch { showAlert('Upload failed', 'Voice message upload failed.'); }
    finally { setUploadingVoice(false); }
  }, [familyId, recording, recordingStartedAt, currentUser, recorder]);

  const handlePlayPauseVoice = useCallback(async (message) => {
    if (!message?.audioUrl) return;
    if (playingMessageId === message.id && soundRef.current) {
      if (soundRef.current.playing) { soundRef.current.pause(); return; }
      soundRef.current.play();
      return;
    }
    await stopCurrentAudio();
    try {
      const sound = createAudioPlayer({ uri: message.audioUrl });
      sound.addListener('playbackStatusUpdate', (status) => {
        if (!status.isLoaded) return;
        setPlaybackMap((prev) => ({ ...prev, [message.id]: { positionMillis: (status.currentTime || 0) * 1000, durationMillis: (status.duration || 1) * 1000, isPlaying: status.playing || false } }));
        if (status.didJustFinish) setPlayingMessageId(null);
      });
      sound.play();
      soundRef.current = sound;
      setPlayingMessageId(message.id);
    } catch { showAlert('Playback error', 'Could not play this voice message.'); }
  }, [playingMessageId, stopCurrentAudio]);

  const handleMessageLongPress = (message) => {
    if (!message || message.senderId !== currentUser?.uid || !familyId) return;
    showConfirm('Delete message', 'Remove this message?', {
      onConfirm: async () => {
        try {
          setMessages((m) => m.filter((x) => x.id !== message.id));
          await deleteConversationMessage(chat, message.id);
        } catch {
          setMessages((current) => restoreDeletedMessage(current, message));
          showAlert('Error', 'Could not delete the message.');
        }
      },
    });
  };

  // ── Render helpers ───────────────────────────────────────────────────────

  const renderVoiceBubble = (item, isSender) => {
    const pb = playbackMap[item.id];
    const progress = pb ? Math.min(1, pb.positionMillis / Math.max(pb.durationMillis, 1)) : 0;
    const dur = item.duration || Math.floor((pb?.durationMillis || 0) / 1000);
    const isPlaying = playingMessageId === item.id && pb?.isPlaying;
    return (
      <MessageBubble isSender={isSender} style={[styles.voiceBubble, !isSender && styles.receivedBubbleOverride]}>
        <TouchableOpacity onPress={() => handlePlayPauseVoice(item)} style={styles.playBtn}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={15} color={isSender ? '#fff' : CHAT_GREEN_DARK} />
        </TouchableOpacity>
        <View style={styles.voiceMeta}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }, isSender ? styles.progressRight : styles.progressLeft]} />
          </View>
          <Text style={[styles.voiceDur, isSender ? styles.textSent : styles.textReceived]}>{formatDuration(dur)}</Text>
        </View>
      </MessageBubble>
    );
  };

  const renderBody = (item, isSender) => {
    if (item.type === 'voice') return renderVoiceBubble(item, isSender);
    if (item.type === 'emoji') {
      return (
        <View style={[styles.emojiBubble, isSender ? styles.emojiRight : styles.emojiLeft]}>
          <Text style={styles.emojiText}>{item.text}</Text>
        </View>
      );
    }
    return (
      <MessageBubble isSender={isSender} style={isSender ? styles.sentBubbleOverride : styles.receivedBubbleOverride}>
        <Text style={[styles.messageText, isSender ? styles.textSent : styles.textReceived]}>{item.text}</Text>
      </MessageBubble>
    );
  };

  const renderMessage = ({ item, index }) => {
    const isSender = item.senderId === currentUser?.uid;
    const senderName = nameMap[item.senderId] || item.email || '';
    const timeLabel = item.createdAt ? item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const showAvatar = !isSender && (type === 'group' || type === 'family');
    const showName = !isSender && type === 'group';

    const currentDay = getMessageDate(item);
    const previousDay = index > 0 ? getMessageDate(messages[index - 1]) : null;
    const showDateSeparator =
      !previousDay || currentDay.toDateString() !== previousDay.toDateString();

    const bubble = (
      <View style={[styles.messageRow, isSender ? styles.rowRight : styles.rowLeft]}>
        {showName && <Text style={styles.senderName}>{senderName}</Text>}
        {renderBody(item, isSender)}
        <Text style={[styles.timeLabel, isSender ? styles.timeRight : styles.timeLeft]}>{timeLabel}</Text>
      </View>
    );

    const messageContent =
      Platform.OS === 'web' ? (
        <View style={[styles.messageOuter, isSender ? styles.outerRight : styles.outerLeft]}>
          {showAvatar && (
            <View style={styles.avatarSlot}>
              <MiniAvatar name={senderName} uid={item.senderId} size={28} />
            </View>
          )}
          {isSender && (
            <TouchableOpacity style={styles.webDeleteBtn} onPress={() => handleMessageLongPress(item)}>
              <Ionicons name="trash-outline" size={13} color="#D1D5DB" />
            </TouchableOpacity>
          )}
          {bubble}
        </View>
      ) : (
        <TouchableOpacity activeOpacity={0.92} onLongPress={() => handleMessageLongPress(item)}>
          <View style={[styles.messageOuter, isSender ? styles.outerRight : styles.outerLeft]}>
            {showAvatar && (
              <View style={styles.avatarSlot}>
                <MiniAvatar name={senderName} uid={item.senderId} size={28} />
              </View>
            )}
            {bubble}
          </View>
        </TouchableOpacity>
      );

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>{getDayLabel(currentDay)}</Text>
          </View>
        )}
        {messageContent}
      </View>
    );
  };

  const recordingHint = useMemo(() => {
    if (uploadingVoice) return 'Uploading voice...';
    if (isRecording) return '● Recording... release to send';
    return '';
  }, [isRecording, uploadingVoice]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.listContent, { paddingBottom: spacing.lg + insets.bottom }]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{'No messages yet.\nSay hello! 👋'}</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: spacing.md + insets.bottom }} />}
        />

        {recordingHint ? <Text style={styles.recordingHint}>{recordingHint}</Text> : null}

        {/* ── Input bar ── */}
        <View style={[styles.inputBar, { paddingBottom: spacing.sm + Math.max(insets.bottom, 0) }]}>
          <TouchableOpacity style={styles.inputIconBtn} onPress={() => setShowEmojiPicker((p) => !p)}>
            <Ionicons name="happy-outline" size={22} color={theme.secondaryText} />
          </TouchableOpacity>

          <View style={styles.inputFieldWrap}>
            <TextInput
              style={styles.inputField}
              placeholder="Type a message..."
              placeholderTextColor={theme.secondaryText}
              value={input}
              onChangeText={setInput}
              multiline
            />
            <Pressable
              style={[styles.micInline, (isRecording || uploadingVoice) && styles.micActive]}
              onPressIn={startVoiceRecording}
              onPressOut={stopVoiceRecording}
            >
              {uploadingVoice
                ? <ActivityIndicator size="small" color={CHAT_GREEN} />
                : <Ionicons name={isRecording ? 'mic' : 'mic-outline'} size={19} color={isRecording ? '#fff' : theme.secondaryText} />
              }
            </Pressable>
          </View>

          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending || uploadingVoice || isRecording) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending || uploadingVoice || isRecording}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="send" size={17} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Emoji picker ── */}
      <Modal visible={showEmojiPicker} transparent animationType="slide" onRequestClose={() => setShowEmojiPicker(false)}>
        <View style={styles.emojiOverlay}>
          <View style={[styles.emojiSheet, { paddingBottom: spacing.xl + insets.bottom }]}>
            <View style={styles.emojiHeader}>
              <Text style={styles.emojiTitle}>Emoji</Text>
              <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                <Ionicons name="close-circle" size={24} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={EMOJIS}
              numColumns={8}
              keyExtractor={(item, idx) => `${item}-${idx}`}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.emojiItem} onPress={() => setInput((p) => `${p}${item}`)}>
                  <Text style={styles.emojiItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    flex: { flex: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    listContent: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
    },

    // ── Message layout ──
    messageOuter: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginVertical: 3,
    },
    outerRight: { justifyContent: 'flex-end', paddingRight: spacing.sm },
    outerLeft: { justifyContent: 'flex-start', paddingLeft: spacing.sm },

    avatarSlot: { marginRight: 6, marginBottom: 18 },

    messageRow: { maxWidth: '78%', minWidth: 0 },
    rowRight: { alignItems: 'flex-end' },
    rowLeft: { alignItems: 'flex-start' },

    senderName: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.secondaryText,
      marginBottom: 3,
      marginLeft: 2,
    },

    // ── Bubble overrides (applied on top of MessageBubble) ──
    sentBubbleOverride: {
      borderBottomRightRadius: 4,
    },
    receivedBubbleOverride: {
      backgroundColor: theme.messageBubbleReceiver,
      borderBottomLeftRadius: 4,
      shadowColor: 'rgba(0,0,0,0.06)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 8,
      elevation: 2,
    },

    messageText: { fontSize: 15, lineHeight: 21 },
    textSent: { color: '#fff' },
    textReceived: { color: theme.text },

    timeLabel: { marginTop: 4, fontSize: 10, color: theme.secondaryText },
    timeRight: { alignSelf: 'flex-end' },
    timeLeft: { alignSelf: 'flex-start' },

    // ── Date separator ──
    dateSeparator: { alignItems: 'center', marginVertical: spacing.md },
    dateSeparatorText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.secondaryText,
      backgroundColor: theme.inputBackground,
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      borderRadius: 999,
      overflow: 'hidden',
    },

    // ── Voice bubble ──
    voiceBubble: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm + 4,
      paddingHorizontal: spacing.md,
    },
    playBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    voiceMeta: { flex: 1 },
    progressTrack: { height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
    progressFill: { height: '100%' },
    progressRight: { backgroundColor: '#fff' },
    progressLeft: { backgroundColor: '#22C55E' },
    voiceDur: { marginTop: 4, fontSize: 11 },

    // ── Emoji ──
    emojiBubble: { paddingHorizontal: spacing.sm, paddingVertical: 2 },
    emojiRight: { alignSelf: 'flex-end' },
    emojiLeft: { alignSelf: 'flex-start' },
    emojiText: { fontSize: 36, lineHeight: 44 },

    // ── Recording hint ──
    recordingHint: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xs,
      fontSize: 12,
      color: theme.error,
      fontWeight: '500',
    },

    // ── Input bar ──
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      paddingBottom: Platform.OS === 'ios' ? spacing.sm : spacing.sm,
      backgroundColor: theme.card,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    inputIconBtn: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 19,
    },
    micActive: {
      backgroundColor: '#22C55E',
    },
    inputFieldWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginHorizontal: spacing.xs,
      backgroundColor: theme.inputBackground,
      borderRadius: 22,
      paddingLeft: spacing.md,
      paddingRight: 4,
    },
    inputField: {
      flex: 1,
      minHeight: 40,
      maxHeight: 110,
      paddingTop: 10,
      paddingBottom: 10,
      fontSize: 15,
      color: theme.text,
      lineHeight: 20,
    },
    micInline: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#22C55E',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.45 },

    // ── Web delete ──
    webDeleteBtn: {
      padding: 6,
      marginHorizontal: 2,
      opacity: 0.6,
      ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
    },

    // ── Empty state ──
    emptyState: {
      flex: 1,
      paddingVertical: spacing.xxl * 2,
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
    },
    emptyStateText: {
      color: theme.secondaryText,
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 23,
    },

    // ── Emoji picker ──
    emojiOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.overlay },
    emojiSheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      minHeight: 260,
    },
    emojiHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    emojiTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
    emojiItem: { width: '12.5%', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
    emojiItemText: { fontSize: 24 },
  })
);
