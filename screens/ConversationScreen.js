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
import { Audio } from 'expo-av';
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
function ChatHeaderTitle({ name, subtitle, emoji, chatId }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: Platform.OS === 'ios' ? -8 : 0 }}>
      <MiniAvatar name={name} uid={chatId || ''} size={38} emoji={emoji || null} />
      <View style={{ marginLeft: 10 }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: -0.2 }} numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 1 }} numberOfLines={1}>
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
      headerStyle: { backgroundColor: theme.primary },
      headerTintColor: '#fff',
      headerTitleAlign: 'left',
      headerTitle: () => (
        <ChatHeaderTitle
          name={name || 'Chat'}
          subtitle={subtitle}
          emoji={emoji}
          chatId={chatId}
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
                <Ionicons name="people-outline" size={22} color="#fff" />
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
    soundRef.current?.unloadAsync?.();
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
    try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); }
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
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) { showAlert('Microphone access needed', 'Please allow microphone permission.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec); setRecordingStartedAt(Date.now()); setIsRecording(true);
    } catch { showAlert('Recording error', 'Could not start recording.'); }
  }, [familyId, isRecording, uploadingVoice, currentUser?.uid]);

  const stopVoiceRecording = useCallback(async () => {
    if (!recording || !familyId || !currentUser?.uid) return;
    let localUri = '', durationMs = 0;
    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      localUri = recording.getURI() || '';
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
  }, [familyId, recording, recordingStartedAt, currentUser]);

  const handlePlayPauseVoice = useCallback(async (message) => {
    if (!message?.audioUrl) return;
    if (playingMessageId === message.id && soundRef.current) {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded && status.isPlaying) { await soundRef.current.pauseAsync(); return; }
      if (status.isLoaded && !status.isPlaying) { await soundRef.current.playAsync(); return; }
    }
    await stopCurrentAudio();
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: message.audioUrl },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          setPlaybackMap((prev) => ({ ...prev, [message.id]: { positionMillis: status.positionMillis || 0, durationMillis: status.durationMillis || 1, isPlaying: status.isPlaying || false } }));
          if (status.didJustFinish) setPlayingMessageId(null);
        }
      );
      soundRef.current = sound;
      setPlayingMessageId(message.id);
    } catch { showAlert('Playback error', 'Could not play this voice message.'); }
  }, [playingMessageId, stopCurrentAudio]);

  const handleMessageLongPress = (message) => {
    if (!message || message.senderId !== currentUser?.uid || !familyId) return;
    showConfirm('Delete message', 'Remove this message?', {
      onConfirm: async () => {
        const prev = messages;
        try {
          setMessages((m) => m.filter((x) => x.id !== message.id));
          await deleteConversationMessage(chat, message.id);
        } catch { setMessages(prev); showAlert('Error', 'Could not delete the message.'); }
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
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={15} color={isSender ? '#fff' : theme.primary} />
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

    const bubble = (
      <View style={[styles.messageRow, isSender ? styles.rowRight : styles.rowLeft]}>
        {showName && <Text style={styles.senderName}>{senderName}</Text>}
        {renderBody(item, isSender)}
        <Text style={[styles.timeLabel, isSender ? styles.timeRight : styles.timeLeft]}>{timeLabel}</Text>
      </View>
    );

    if (Platform.OS === 'web') {
      return (
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
      );
    }

    return (
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
            <Ionicons name="happy-outline" size={24} color="#9CA3AF" />
          </TouchableOpacity>

          <TextInput
            style={styles.inputField}
            placeholder="Type your message..."
            placeholderTextColor="#9CA3AF"
            value={input}
            onChangeText={setInput}
            multiline
          />

          <Pressable
            style={[styles.inputIconBtn, (isRecording || uploadingVoice) && styles.micActive]}
            onPressIn={startVoiceRecording}
            onPressOut={stopVoiceRecording}
          >
            {uploadingVoice
              ? <ActivityIndicator size="small" color={theme.primary} />
              : <Ionicons name={isRecording ? 'mic' : 'mic-outline'} size={22} color={isRecording ? '#fff' : '#9CA3AF'} />
            }
          </Pressable>

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
                <Ionicons name="close-circle" size={24} color="#9CA3AF" />
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
    safeArea: { flex: 1, backgroundColor: '#EEF2FF' },
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
      color: '#9CA3AF',
      marginBottom: 3,
      marginLeft: 2,
    },

    // ── Bubble overrides (applied on top of MessageBubble) ──
    sentBubbleOverride: {
      borderBottomRightRadius: 4,
    },
    receivedBubbleOverride: {
      backgroundColor: '#fff',
      borderBottomLeftRadius: 4,
      shadowColor: 'rgba(0,0,0,0.06)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 8,
      elevation: 2,
    },

    messageText: { fontSize: 15, lineHeight: 21 },
    textSent: { color: '#fff' },
    textReceived: { color: '#111827' },

    timeLabel: { marginTop: 4, fontSize: 10, color: '#9CA3AF' },
    timeRight: { alignSelf: 'flex-end' },
    timeLeft: { alignSelf: 'flex-start' },

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
    progressLeft: { backgroundColor: theme.primary },
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
      backgroundColor: '#fff',
      borderTopWidth: 1,
      borderTopColor: '#F3F4F6',
    },
    inputIconBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
    micActive: {
      backgroundColor: theme.primary,
    },
    inputField: {
      flex: 1,
      minHeight: 40,
      maxHeight: 110,
      marginHorizontal: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingTop: 10,
      paddingBottom: 10,
      backgroundColor: '#F3F4F6',
      borderRadius: 22,
      fontSize: 15,
      color: '#111827',
      lineHeight: 20,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary,
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
      color: '#9CA3AF',
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 23,
    },

    // ── Emoji picker ──
    emojiOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.3)' },
    emojiSheet: {
      backgroundColor: '#fff',
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
    emojiTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
    emojiItem: { width: '12.5%', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
    emojiItemText: { fontSize: 24 },
  })
);
