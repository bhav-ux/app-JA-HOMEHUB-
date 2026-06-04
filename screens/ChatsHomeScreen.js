import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import {
  createOrGetDM,
  subscribeToFamilyChatPreview,
  subscribeToFamilyMemberIds,
  subscribeToDMs,
  subscribeToGroups,
} from '../services/chatService';
import { createThemedStyles, spacing, useAppTheme } from '../src/theme';
import { listenToUserDisplayName } from '../utils/user';
import { showAlert } from '../utils/dialogs';

// ─── Palette & helpers ───────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#6366F1', '#F43F5E', '#F59E0B', '#0D9488',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
];

function getAvatarColor(str) {
  if (!str) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatChatTime(ts) {
  if (!ts) return '';
  const date = ts instanceof Date ? ts : new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - date) / 86400000);
  if (diff === 0) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Avatar({ name, size = 52, color, emoji, uid }) {
  const bg = color || getAvatarColor(uid || name || '');
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: emoji ? size * 0.48 : size * 0.38, color: '#fff', fontWeight: '700' }}>
        {emoji || getInitials(name)}
      </Text>
    </View>
  );
}

function ChatRow({ onPress, avatar, name, subtitle, timestamp, accent, styles, theme }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.72} style={[styles.chatRow, accent && styles.chatRowAccent]}>
      {accent ? <View style={styles.accentBar} /> : null}
      <View style={styles.chatRowInner}>
        {avatar}
        <View style={styles.chatRowBody}>
          <View style={styles.chatRowTop}>
            <Text style={[styles.chatRowName, accent && styles.chatRowNameAccent]} numberOfLines={1}>
              {name}
            </Text>
            {timestamp ? <Text style={styles.chatRowTime}>{formatChatTime(timestamp)}</Text> : null}
          </View>
          <Text style={styles.chatRowPreview} numberOfLines={1}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color={theme.secondaryText} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ChatsHomeScreen({ navigation }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const [currentUser, setCurrentUser] = useState(null);
  const [familyId, setFamilyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dms, setDms] = useState([]);
  const [groups, setGroups] = useState([]);
  const [familyChatPreview, setFamilyChatPreview] = useState(null);
  const [familyMemberIds, setFamilyMemberIds] = useState([]);
  const [nameMap, setNameMap] = useState({});

  const nameListenersRef = useRef({});

  const subscribeToName = useCallback((uid) => {
    if (nameListenersRef.current[uid]) return;
    nameListenersRef.current[uid] = listenToUserDisplayName(uid, (n) => {
      setNameMap((prev) => ({ ...prev, [uid]: n || '' }));
    });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) { setLoading(false); setFamilyId(null); }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = onSnapshot(
      doc(db, 'users', currentUser.uid),
      (snap) => {
        setFamilyId(snap.exists() ? snap.data()?.familyId || null : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!familyId || !currentUser?.uid) return;

    const unsubMembers = subscribeToFamilyMemberIds(familyId, (ids) => {
      setFamilyMemberIds(ids);
      ids.forEach(subscribeToName);
    });
    const unsubPreview = subscribeToFamilyChatPreview(familyId, setFamilyChatPreview);
    const unsubDMs = subscribeToDMs(familyId, currentUser.uid, (list) => {
      setDms(list);
      list.forEach((dm) => (dm.members || []).forEach(subscribeToName));
    });
    const unsubGroups = subscribeToGroups(familyId, currentUser.uid, setGroups);

    return () => {
      unsubMembers(); unsubPreview(); unsubDMs(); unsubGroups();
      Object.values(nameListenersRef.current).forEach((fn) => fn?.());
      nameListenersRef.current = {};
    };
  }, [familyId, currentUser?.uid, subscribeToName]);

  const navigateToFamilyChat = () => {
    navigation.navigate('Conversation', {
      chat: { type: 'family', familyId, chatId: null, name: 'Family Chat', memberCount: familyMemberIds.length },
    });
  };

  const navigateToDM = (dm) => {
    const otherUid = (dm.members || []).find((uid) => uid !== currentUser?.uid) || '';
    navigation.navigate('Conversation', {
      chat: { type: 'dm', familyId, chatId: dm.id, name: nameMap[otherUid] || 'Family Member', members: dm.members },
    });
  };

  const navigateToGroup = (group) => {
    navigation.navigate('Conversation', {
      chat: { type: 'group', familyId, chatId: group.id, name: group.name, emoji: group.emoji, members: group.members },
    });
  };

  const handleMemberPress = useCallback(async (targetUid) => {
    if (!currentUser?.uid || !familyId) return;
    const existing = dms.find((dm) => (dm.members || []).includes(targetUid) && (dm.members || []).includes(currentUser.uid));
    if (existing) { navigateToDM(existing); return; }
    try {
      const dmId = await createOrGetDM(familyId, currentUser.uid, targetUid);
      const targetName = nameMap[targetUid] || 'Family Member';
      navigation.navigate('Conversation', {
        chat: { type: 'dm', familyId, chatId: dmId, name: targetName, members: [currentUser.uid, targetUid].sort() },
      });
    } catch {
      showAlert('Error', 'Could not open conversation.');
    }
  }, [currentUser?.uid, familyId, dms, nameMap, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#fff" />
      </SafeAreaView>
    );
  }

  const otherMemberIds = familyMemberIds.filter((uid) => uid !== currentUser?.uid);
  const familyPreviewText = familyChatPreview?.text
    || (familyMemberIds.length > 0 ? `${familyMemberIds.length} members` : 'Your family group chat');

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Blue header zone ─────────────────────────────────── */}
      <View style={styles.headerZone}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>MESSAGES</Text>
          <TouchableOpacity
            style={styles.composeBtn}
            onPress={() => navigation.navigate('NewChat', { familyId })}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Member avatars strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.memberStrip}
        >
          {/* New-chat shortcut */}
          <TouchableOpacity
            style={styles.memberItem}
            onPress={() => navigation.navigate('NewChat', { familyId })}
            activeOpacity={0.8}
          >
            <View style={styles.newChatCircle}>
              <Ionicons name="add" size={26} color="#fff" />
            </View>
            <Text style={styles.memberItemLabel}>New</Text>
          </TouchableOpacity>

          {/* Family members */}
          {otherMemberIds.map((uid) => (
            <TouchableOpacity
              key={uid}
              style={styles.memberItem}
              onPress={() => handleMemberPress(uid)}
              activeOpacity={0.8}
            >
              <View style={styles.memberAvatarWrapper}>
                <Avatar name={nameMap[uid] || '?'} uid={uid} size={52} />
                <View style={styles.onlineDot} />
              </View>
              <Text style={styles.memberItemLabel} numberOfLines={1}>
                {(nameMap[uid] || '').split(' ')[0] || '···'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Chat list (white card rising from header) ─────────── */}
      <View style={styles.chatListCard}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>

          {/* Family Chat — always pinned at top */}
          <ChatRow
            onPress={navigateToFamilyChat}
            accent
            name="Family Chat"
            subtitle={familyPreviewText}
            timestamp={familyChatPreview?.createdAt}
            styles={styles}
            theme={theme}
            avatar={<Avatar emoji="🏠" size={56} color={theme.primary} />}
          />

          {/* Direct Messages */}
          {dms.map((dm) => {
            const otherUid = (dm.members || []).find((uid) => uid !== currentUser?.uid) || '';
            const otherName = nameMap[otherUid] || 'Family Member';
            return (
              <ChatRow
                key={dm.id}
                onPress={() => navigateToDM(dm)}
                name={otherName}
                subtitle={dm.lastMessage || 'Start the conversation'}
                timestamp={dm.lastMessageAt}
                styles={styles}
            theme={theme}
                avatar={<Avatar name={otherName} uid={otherUid} size={56} />}
              />
            );
          })}

          {/* Groups */}
          {groups.length > 0 && (
            <Text style={styles.sectionLabel}>Groups</Text>
          )}
          {groups.map((group) => (
            <ChatRow
              key={group.id}
              onPress={() => navigateToGroup(group)}
              name={group.name}
              subtitle={group.lastMessage || `${(group.members || []).length} members`}
              timestamp={group.lastMessageAt}
              styles={styles}
            theme={theme}
              avatar={
                <Avatar
                  name={group.name}
                  uid={group.id}
                  size={56}
                  emoji={group.emoji || null}
                />
              }
            />
          ))}

          {/* Empty state */}
          {dms.length === 0 && groups.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>Start a conversation</Text>
              <Text style={styles.emptyBody}>
                Tap a family member above or the compose button to start messaging.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('NewChat', { familyId })}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyBtnText}>New Chat</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.primary,
    },

    // ── Header zone (blue) ──
    headerZone: {
      backgroundColor: theme.primary,
      paddingTop: spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: 2,
      color: '#fff',
    },
    composeBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(255,255,255,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Member strip ──
    memberStrip: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.lg,
      gap: spacing.md,
      alignItems: 'flex-start',
    },
    memberItem: {
      alignItems: 'center',
      width: 64,
    },
    memberAvatarWrapper: {
      position: 'relative',
    },
    onlineDot: {
      position: 'absolute',
      bottom: 1,
      right: 1,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#22C55E',
      borderWidth: 2,
      borderColor: theme.primary,
    },
    newChatCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: 'rgba(255,255,255,0.55)',
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberItemLabel: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.88)',
      marginTop: 5,
      fontWeight: '500',
      textAlign: 'center',
    },

    // ── Chat list card ──
    chatListCard: {
      flex: 1,
      backgroundColor: theme.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
    },

    // ── Chat row ──
    chatRow: {
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      overflow: 'hidden',
    },
    chatRowAccent: {
      backgroundColor: theme.primaryLight,
    },
    accentBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor: theme.primary,
    },
    chatRowInner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: 15,
      gap: 14,
    },
    chatRowBody: {
      flex: 1,
    },
    chatRowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    chatRowName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      flex: 1,
      marginRight: spacing.sm,
    },
    chatRowNameAccent: {
      color: theme.primary,
    },
    chatRowTime: {
      fontSize: 11,
      color: theme.secondaryText,
      fontWeight: '500',
    },
    chatRowPreview: {
      fontSize: 13,
      color: theme.secondaryText,
      lineHeight: 18,
    },

    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: theme.secondaryText,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: theme.background,
    },

    emptyState: {
      paddingTop: spacing.xxl + spacing.xl,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
    },
    emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    emptyBody: {
      fontSize: 14,
      color: theme.secondaryText,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: spacing.xl,
    },
    emptyBtn: {
      backgroundColor: theme.primary,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
    },
    emptyBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
  })
);
