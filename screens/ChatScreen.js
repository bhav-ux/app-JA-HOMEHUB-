import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import {
  deleteChatMessage,
  getChatFamilyId,
  sendTextMessage,
  sendVoiceMessage,
  subscribeToMessages,
} from '../services/chatService';
import MessageBubble from '../src/components/MessageBubble';
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';
import { listenToUserDisplayName } from '../utils/user';

const EMOJIS = [
  '😀', '😂', '😍', '😭', '🙏', '❤️', '🔥', '👏',
  '👍', '🎉', '🥳', '😎', '🤔', '😢', '😡', '🙌',
  '💯', '✨', '🤝', '👀', '🎶', '🌟', '💪', '🏠',
  '📸', '🗓️', '💬', '📍', '🧡', '✅', '🎯', '🥰',
];

const formatDuration = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const isEmojiOnlyMessage = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const noSpaces = trimmed.replace(/\s/g, '');
  return /^[\p{Extended_Pictographic}\uFE0F]+$/u.test(noSpaces);
};

export default function ChatScreen({ navigation }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [familyId, setFamilyId] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [nameMap, setNameMap] = useState({});
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordingStartedAt, setRecordingStartedAt] = useState(null);
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [playbackMap, setPlaybackMap] = useState({});

  const listRef = useRef(null);
  const nameListeners = useRef({});
  const soundRef = useRef(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Family Chat',
      headerTitleAlign: 'center',
      headerTitleStyle: { fontWeight: '700', color: theme.text },
      headerStyle: { backgroundColor: theme.headerBackground },
    });
  }, [navigation, theme]);

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
        const familyValue = await getChatFamilyId(auth.currentUser.uid);
        setFamilyId(familyValue || null);
      } catch (error) {
        console.error('[ChatScreen] Error fetching family', error);
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
      soundRef.current?.unloadAsync?.();
    };
  }, []);

  useEffect(() => {
    if (!auth.currentUser || !familyId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToMessages({
      familyId,
      onData: (nextMessages) => {
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
      onError: () => {
        setMessages([]);
        setLoading(false);
      },
    });

    return unsubscribe;
  }, [familyId]);

  const stopCurrentAudio = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (error) {
        console.error('Audio stop failed', error);
      } finally {
        soundRef.current = null;
        setPlayingMessageId(null);
      }
    }
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    const userId = auth.currentUser?.uid;
    if (!trimmed || !userId || !familyId || sending) return;

    const messageType = isEmojiOnlyMessage(trimmed) ? 'emoji' : 'text';
    try {
      setSending(true);
      await sendTextMessage({
        familyId,
        senderId: userId,
        email: auth.currentUser?.email || null,
        text: trimmed,
        messageType,
      });
      setInput('');
      setShowEmojiPicker(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (error) {
      Alert.alert('Send failed', 'Could not send your message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const startVoiceRecording = useCallback(async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || !familyId || isRecording || uploadingVoice) return;

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone access needed', 'Please allow microphone permission to send voice messages.');
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const recordingResult = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recordingResult.recording);
      setRecordingStartedAt(Date.now());
      setIsRecording(true);
    } catch (error) {
      Alert.alert('Recording error', 'Could not start recording. Try again.');
    }
  }, [familyId, isRecording, uploadingVoice]);

  const stopVoiceRecording = useCallback(async () => {
    if (!recording || !familyId || !auth.currentUser?.uid) return;

    let localUri = '';
    let durationMs = 0;

    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      localUri = recording.getURI() || '';
      durationMs = status.durationMillis || Date.now() - (recordingStartedAt || Date.now());
    } catch (error) {
      Alert.alert('Recording error', 'Unable to finish recording.');
      setRecording(null);
      setIsRecording(false);
      setRecordingStartedAt(null);
      return;
    }

    setRecording(null);
    setIsRecording(false);
    setRecordingStartedAt(null);

    if (!localUri || durationMs < 400) {
      Alert.alert('Recording too short', 'Hold the mic a bit longer to send a voice message.');
      return;
    }

    try {
      setUploadingVoice(true);
      await sendVoiceMessage({
        familyId,
        senderId: auth.currentUser.uid,
        email: auth.currentUser?.email || null,
        localUri,
        duration: durationMs,
      });
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (error) {
      Alert.alert('Upload failed', 'Voice message upload failed. Please try again.');
    } finally {
      setUploadingVoice(false);
    }
  }, [familyId, recording, recordingStartedAt]);

  const handlePlayPauseVoice = useCallback(
    async (message) => {
      if (!message?.audioUrl) return;

      if (playingMessageId === message.id && soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await soundRef.current.pauseAsync();
          return;
        }
        if (status.isLoaded && !status.isPlaying) {
          await soundRef.current.playAsync();
          return;
        }
      }

      await stopCurrentAudio();
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: message.audioUrl },
          { shouldPlay: true },
          (status) => {
            if (!status.isLoaded) return;
            setPlaybackMap((prev) => ({
              ...prev,
              [message.id]: {
                positionMillis: status.positionMillis || 0,
                durationMillis: status.durationMillis || 1,
                isPlaying: status.isPlaying || false,
              },
            }));
            if (status.didJustFinish) {
              setPlayingMessageId(null);
            }
          }
        );
        soundRef.current = sound;
        setPlayingMessageId(message.id);
      } catch (error) {
        Alert.alert('Playback error', 'Could not play this voice message.');
      }
    },
    [playingMessageId, stopCurrentAudio]
  );

  const handleMessageLongPress = (message) => {
    if (!message || message.senderId !== auth.currentUser?.uid || !familyId) return;
    Alert.alert('Delete message?', 'This will remove it for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const previousMessages = messages;
          try {
            setMessages((prev) => prev.filter((m) => m.id !== message.id));
            await deleteChatMessage({ familyId, messageId: message.id });
          } catch (error) {
            setMessages(previousMessages);
          }
        },
      },
    ]);
  };

  const renderVoiceBubble = (item, isCurrentUser) => {
    const playback = playbackMap[item.id];
    const progressRatio = playback ? Math.min(1, playback.positionMillis / Math.max(playback.durationMillis, 1)) : 0;
    const totalDuration = item.duration || Math.floor((playback?.durationMillis || 0) / 1000);
    const isPlaying = playingMessageId === item.id && playback?.isPlaying;

    return (
      <MessageBubble isSender={isCurrentUser} style={styles.voiceBubble}>
        <TouchableOpacity onPress={() => handlePlayPauseVoice(item)} style={styles.playButton}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color={isCurrentUser ? '#fff' : theme.text} />
        </TouchableOpacity>
        <View style={styles.voiceMeta}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressRatio * 100}%` },
                isCurrentUser ? styles.progressFillRight : styles.progressFillLeft,
              ]}
            />
          </View>
          <Text style={[styles.voiceDuration, isCurrentUser ? styles.textRight : styles.textLeft]}>
            {formatDuration(totalDuration)}
          </Text>
        </View>
      </MessageBubble>
    );
  };

  const renderMessageBody = (item, isCurrentUser) => {
    if (item.type === 'voice') return renderVoiceBubble(item, isCurrentUser);
    if (item.type === 'emoji') {
      return (
        <View style={[styles.emojiBubble, isCurrentUser ? styles.emojiRight : styles.emojiLeft]}>
          <Text style={styles.emojiText}>{item.text}</Text>
        </View>
      );
    }

    return (
      <MessageBubble isSender={isCurrentUser}>
        <Text style={[styles.messageText, isCurrentUser ? styles.textRight : styles.textLeft]}>{item.text}</Text>
      </MessageBubble>
    );
  };

  const renderMessage = ({ item }) => {
    const isCurrentUser = item.senderId === auth.currentUser?.uid;
    const senderLabel = nameMap[item.senderId] || item.email || item.senderId || 'Unknown sender';
    const timeLabel = item.createdAt ? item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return (
      <TouchableOpacity activeOpacity={0.9} onLongPress={() => handleMessageLongPress(item)}>
        <View style={[styles.messageRow, isCurrentUser ? styles.rowRight : styles.rowLeft]}>
          <Text style={[styles.senderText, isCurrentUser && styles.senderTextRight]}>{senderLabel}</Text>
          {renderMessageBody(item, isCurrentUser)}
          <Text style={[styles.timeText, isCurrentUser ? styles.timeRight : styles.timeLeft]}>{timeLabel}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const recordingHint = useMemo(() => {
    if (uploadingVoice) return 'Uploading voice...';
    if (isRecording) return 'Recording... release to send';
    return '';
  }, [isRecording, uploadingVoice]);

  if (loading || familyLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
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
      <KeyboardAvoidingView style={styles.keyboardAvoider} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No messages yet.</Text>
            </View>
          }
          ListFooterComponent={<View style={styles.footerSpacing} />}
        />

        {recordingHint ? <Text style={styles.recordingHint}>{recordingHint}</Text> : null}

        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowEmojiPicker((prev) => !prev)}>
            <Ionicons name="happy-outline" size={22} color={theme.primary} />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor={theme.secondaryText}
            value={input}
            onChangeText={setInput}
            multiline
          />

          <Pressable style={[styles.iconButton, (isRecording || uploadingVoice) && styles.iconButtonActive]} onPressIn={startVoiceRecording} onPressOut={stopVoiceRecording}>
            {uploadingVoice ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons name={isRecording ? 'mic' : 'mic-outline'} size={22} color={isRecording ? '#fff' : theme.primary} />
            )}
          </Pressable>

          <TouchableOpacity style={[styles.sendButton, (!input.trim() || sending || uploadingVoice || isRecording) && styles.sendButtonDisabled]} onPress={handleSend} disabled={!input.trim() || sending || uploadingVoice || isRecording}>
            {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showEmojiPicker} transparent animationType="slide" onRequestClose={() => setShowEmojiPicker(false)}>
        <View style={styles.emojiOverlay}>
          <View style={styles.emojiSheet}>
            <View style={styles.emojiHeader}>
              <Text style={styles.emojiTitle}>Choose Emoji</Text>
              <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                <Ionicons name="close" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={EMOJIS}
              numColumns={8}
              keyExtractor={(item, index) => `${item}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.emojiItem} onPress={() => setInput((prev) => `${prev}${item}`)}>
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

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    keyboardAvoider: { flex: 1, backgroundColor: theme.background },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
    messageRow: { maxWidth: '80%', marginVertical: spacing.xs },
    rowRight: { alignSelf: 'flex-end', alignItems: 'flex-end', marginRight: spacing.md },
    rowLeft: { alignSelf: 'flex-start', alignItems: 'flex-start', marginLeft: spacing.md },
    voiceBubble: {
      minWidth: 180,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
    },
    playButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    voiceMeta: { flex: 1 },
    progressTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.22)',
      overflow: 'hidden',
    },
    progressFill: { height: '100%' },
    progressFillRight: { backgroundColor: '#fff' },
    progressFillLeft: { backgroundColor: theme.primary },
    voiceDuration: { marginTop: spacing.xs, fontSize: typography.small.fontSize },
    emojiBubble: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    emojiRight: { alignSelf: 'flex-end' },
    emojiLeft: { alignSelf: 'flex-start' },
    emojiText: { fontSize: 36, lineHeight: 44 },
    messageText: { fontSize: 16 },
    textRight: { color: '#fff' },
    textLeft: { color: theme.text },
    timeText: { marginTop: spacing.xs, fontSize: typography.small.fontSize, color: theme.secondaryText },
    timeRight: { alignSelf: 'flex-end' },
    timeLeft: { alignSelf: 'flex-start' },
    senderText: { ...typography.small, color: theme.secondaryText, marginBottom: spacing.xs },
    senderTextRight: { color: theme.secondaryText },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.sm,
      backgroundColor: theme.card,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      ...shadow,
    },
    iconButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.inputBackground,
      marginRight: spacing.xs,
    },
    iconButtonActive: { backgroundColor: theme.primary },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.inputBackground,
    },
    sendButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: theme.primary,
      marginLeft: spacing.sm,
      ...shadow,
    },
    sendButtonDisabled: { opacity: 0.5 },
    recordingHint: { marginHorizontal: spacing.lg, marginBottom: spacing.xs, color: theme.secondaryText, fontSize: typography.small.fontSize },
    footerSpacing: { height: spacing.sm },
    emptyState: { paddingVertical: spacing.xl, alignItems: 'center' },
    emptyStateText: { color: theme.secondaryText, fontSize: typography.body.fontSize },
    emojiOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.overlay },
    emojiSheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      minHeight: 280,
    },
    emojiHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    emojiTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
    emojiItem: { width: '12.5%', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
    emojiItemText: { fontSize: 24 },
  })
);
