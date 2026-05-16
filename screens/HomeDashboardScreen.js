import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { subscribeToEvents } from '../services/eventService';
import { subscribeToMessages } from '../services/chatService';
import { createThemedStyles, spacing, useAppTheme } from '../src/theme';
import AnimatedCard from '../src/components/AnimatedCard';

const AVATAR_PALETTE = [
  '#7B93C8',
  '#D4896A',
  '#76A895',
  '#9E7DC4',
  '#6BA4C4',
  '#C4956A',
  '#89B488',
  '#B07AB0',
];

const MAX_VISIBLE_AVATARS = 5;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good Night';
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  if (h < 21) return 'Good Evening';
  return 'Good Night';
}

function getDisplayName(user) {
  if (!user) return 'there';
  if (user.displayName) return user.displayName.split(' ')[0];
  if (user.email) return user.email.split('@')[0];
  return 'there';
}

function normalizeDate(raw) {
  if (!raw) return null;
  if (raw?.toDate) return raw.toDate();
  if (raw instanceof Date) return raw;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatRelativeDate(raw) {
  const d = normalizeDate(raw);
  if (!d) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const eventDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let prefix;
  if (eventDay.getTime() === today.getTime()) prefix = 'Today';
  else if (eventDay.getTime() === tomorrow.getTime()) prefix = 'Tomorrow';
  else prefix = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === 0 && m === 0) return prefix;
  return `${prefix} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function formatRelativeTime(date) {
  if (!date) return '';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function getTodayLabel() {
  const now = new Date();
  const weekday = now.toLocaleDateString(undefined, { weekday: 'long' });
  const day = now.getDate();
  const month = now.toLocaleDateString(undefined, { month: 'long' });
  return `${weekday}, ${day} ${month}`;
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name, index) {
  if (!name) return AVATAR_PALETTE[index % AVATAR_PALETTE.length];
  return AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length];
}

export default function HomeDashboardScreen({ navigation, route, familyId: familyIdProp }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const familyId = familyIdProp ?? route?.params?.familyId;
  const user = auth.currentUser;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  const [greeting, setGreeting] = useState(getGreeting());
  const [events, setEvents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    const id = setInterval(() => setGreeting(getGreeting()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!familyId) { setMembers([]); return; }
    let mounted = true;
    const unsub = onSnapshot(doc(db, 'families', familyId), async (snap) => {
      if (!snap.exists() || !mounted) return;
      const memberIds = snap.data()?.members || [];
      const resolved = await Promise.all(
        memberIds.slice(0, 8).map(async (uid, i) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', uid));
            if (userSnap.exists()) {
              const data = userSnap.data();
              const name = data.displayName || data.email?.split('@')[0] || 'Member';
              return { uid, name, index: i };
            }
          } catch {}
          return { uid, name: 'Member', index: i };
        })
      );
      if (mounted) setMembers(resolved);
    });
    return () => { mounted = false; unsub(); };
  }, [familyId]);

  useEffect(() => {
    if (!familyId) { setEvents([]); setEventsLoading(false); return; }
    setEventsLoading(true);
    return subscribeToEvents({
      familyId,
      onData: (e) => { setEvents(e); setEventsLoading(false); },
      onError: () => { setEvents([]); setEventsLoading(false); },
    });
  }, [familyId]);

  useEffect(() => {
    if (!familyId) { setMessages([]); return; }
    return subscribeToMessages({
      familyId,
      onData: setMessages,
      onError: () => setMessages([]),
    });
  }, [familyId]);

  const memberNameMap = useMemo(() => {
    const map = {};
    members.forEach((m) => { map[m.uid] = m.name; });
    return map;
  }, [members]);

  const upcomingEvent = useMemo(() => {
    const now = new Date();
    return events.find((e) => {
      const d = normalizeDate(e.date);
      return d && d >= now;
    }) ?? null;
  }, [events]);

  const latestMessage = useMemo(() => {
    if (messages.length === 0) return null;
    return messages[messages.length - 1];
  }, [messages]);

  const recentActivity = useMemo(() => {
    const items = [];
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      const senderName = memberNameMap[last.senderId]
        || last.email?.split('@')[0]
        || 'Someone';
      items.push({
        id: `msg-${last.id}`,
        icon: 'chatbubble-ellipses-outline',
        text: last.type === 'voice'
          ? `${senderName} sent a voice message`
          : `${senderName} sent a message`,
        date: last.createdAt instanceof Date ? last.createdAt : null,
        onPress: () => navigation.navigate('Chat'),
      });
    }
    [...events].reverse().slice(0, 4).forEach((event) => {
      const creatorName = memberNameMap[event.createdBy]
        || event.createdByEmail?.split('@')[0]
        || null;
      const eventLabel = `${event.emoji ? event.emoji + ' ' : ''}${event.title}`;
      const text = creatorName
        ? `${creatorName} added ${eventLabel}`
        : `${eventLabel} added to calendar`;
      items.push({
        id: `event-${event.id}`,
        icon: 'calendar-outline',
        text,
        date: normalizeDate(event.date),
        onPress: () => navigation.navigate('EventDetails', { event, familyId }),
      });
    });
    items.sort((a, b) => (b.date || new Date(0)) - (a.date || new Date(0)));
    return items.slice(0, 5);
  }, [events, messages, navigation, familyId, memberNameMap]);

  const handleAddEvent = () => {
    if (!user) { Alert.alert('Not signed in', 'Please sign in to add events.'); return; }
    navigation.navigate('AddEvent');
  };

  const handleCreateAlbum = () => {
    if (!familyId) { Alert.alert('Family not set', 'Join or create a family to create albums.'); return; }
    navigation.navigate('CreateAlbum', { familyId });
  };

  const quickActions = [
    { label: 'Event', icon: 'calendar-outline', onPress: handleAddEvent },
    { label: 'Chat', icon: 'chatbubble-outline', onPress: () => navigation.navigate('Chat') },
    { label: 'Album', icon: 'images-outline', onPress: handleCreateAlbum },
    { label: 'Note', icon: 'create-outline', onPress: () => navigation.navigate('AddCalendarNote') },
  ];

  const visibleMembers = members.slice(0, MAX_VISIBLE_AVATARS);
  const overflowCount = Math.max(0, members.length - MAX_VISIBLE_AVATARS);

  let focusState = 'loading';
  if (!eventsLoading) {
    if (upcomingEvent) focusState = 'event';
    else if (latestMessage) focusState = 'message';
    else focusState = 'empty';
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]} pointerEvents="auto">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.heroSection, { transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.greetingText}>
            {greeting},{' '}
            <Text style={styles.greetingName}>{getDisplayName(user)}</Text>
          </Text>
          <Text style={styles.dateText}>{getTodayLabel()}</Text>
        </Animated.View>

        {/* Today Focus */}
        <View style={styles.section}>
          <Text style={styles.sectionChip}>TODAY</Text>

          {focusState === 'loading' && (
            <View style={[styles.focusCard, styles.focusCardLoading]}>
              <ActivityIndicator size="small" color={`${theme.primary}88`} />
            </View>
          )}

          {focusState === 'event' && (
            <AnimatedCard
              style={styles.focusCard}
              onPress={() => navigation.navigate('EventDetails', { event: upcomingEvent, familyId })}
              accessibilityLabel={`Open event ${upcomingEvent.title}`}
              scaleDown={0.98}
            >
              <View style={styles.focusRow}>
                <View style={styles.focusIconWrap}>
                  {upcomingEvent.emoji
                    ? <Text style={styles.focusEmoji}>{upcomingEvent.emoji}</Text>
                    : <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                  }
                </View>
                <View style={styles.focusBody}>
                  <Text style={styles.focusTitle} numberOfLines={2}>{upcomingEvent.title}</Text>
                  <Text style={styles.focusDate}>{formatRelativeDate(upcomingEvent.date)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={`${theme.primary}66`} />
              </View>
            </AnimatedCard>
          )}

          {focusState === 'message' && (
            <AnimatedCard
              style={styles.focusCard}
              onPress={() => navigation.navigate('Chat')}
              accessibilityLabel="Open chat"
              scaleDown={0.98}
            >
              <View style={styles.focusRow}>
                <View style={styles.focusIconWrap}>
                  <Ionicons name="chatbubble-ellipses-outline" size={19} color={theme.primary} />
                </View>
                <View style={styles.focusBody}>
                  <Text style={styles.focusSender}>
                    {memberNameMap[latestMessage.senderId] || latestMessage.email?.split('@')[0] || 'Family'}
                  </Text>
                  <Text style={styles.focusMessage} numberOfLines={2}>
                    {latestMessage.type === 'voice'
                      ? '🎤  Voice message'
                      : `"${latestMessage.text?.length > 75
                          ? latestMessage.text.slice(0, 75) + '…'
                          : latestMessage.text}"`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={`${theme.primary}66`} />
              </View>
            </AnimatedCard>
          )}

          {focusState === 'empty' && (
            <View style={[styles.focusCard, styles.focusCardEmpty]}>
              <Text style={styles.focusEmptyIcon}>🌿</Text>
              <Text style={styles.focusEmptyTitle}>All quiet today</Text>
              <Text style={styles.focusEmptySubtitle}>No plans yet — enjoy the calm</Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsGrid}>
          {quickActions.map(({ label, icon, onPress }) => (
            <AnimatedCard
              key={label}
              style={styles.actionBtn}
              onPress={onPress}
              accessibilityLabel={label}
              scaleDown={0.95}
            >
              <View style={styles.actionIconWrap}>
                <Ionicons name={icon} size={20} color={theme.primary} />
              </View>
              <Text style={styles.actionLabel}>{label}</Text>
            </AnimatedCard>
          ))}
        </View>

        {/* Family Snapshot */}
        {members.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionChip}>YOUR FAMILY</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.familyScrollContent}
            >
              {visibleMembers.map((member, i) => (
                <View key={member.uid} style={styles.avatarWrap}>
                  <View style={[styles.avatar, { backgroundColor: getAvatarColor(member.name, i) }]}>
                    <Text style={styles.avatarInitials}>{getInitials(member.name)}</Text>
                  </View>
                  <Text style={styles.avatarName} numberOfLines={1}>
                    {member.name.split(' ')[0]}
                  </Text>
                </View>
              ))}
              {overflowCount > 0 && (
                <View style={styles.avatarWrap}>
                  <View style={styles.avatarOverflow}>
                    <Text style={styles.avatarOverflowText}>+{overflowCount}</Text>
                  </View>
                  <Text style={styles.avatarName}> </Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionChip}>RECENT</Text>
            <View>
              {recentActivity.map((item, i) => (
                <AnimatedCard
                  key={item.id}
                  style={[
                    styles.timelineRow,
                    i < recentActivity.length - 1 && styles.timelineRowDivider,
                  ]}
                  onPress={item.onPress}
                  accessibilityLabel={item.text}
                  scaleDown={0.98}
                >
                  <View style={styles.timelineDot}>
                    <Ionicons name={item.icon} size={12} color={theme.primary} />
                  </View>
                  <Text style={styles.timelineText} numberOfLines={2}>
                    {item.text}
                  </Text>
                  {item.date && (
                    <Text style={styles.timelineTime}>{formatRelativeTime(item.date)}</Text>
                  )}
                </AnimatedCard>
              ))}
            </View>
          </View>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ theme, shadow }) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    flex: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: 14,
    },

    // Header
    heroSection: {
      paddingBottom: 20,
    },
    greetingText: {
      fontSize: 26,
      fontWeight: '500',
      color: theme.text,
      letterSpacing: -0.4,
    },
    greetingName: {
      fontSize: 26,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.6,
    },
    dateText: {
      fontSize: 13,
      color: theme.secondaryText,
      marginTop: 5,
      fontWeight: '400',
      letterSpacing: 0.1,
    },

    // Section
    section: {
      marginBottom: 20,
    },
    sectionChip: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.secondaryText,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 8,
    },

    // Today Focus Card
    focusCard: {
      backgroundColor: theme.primaryLight,
      borderRadius: 18,
      padding: spacing.md,
      ...shadow,
    },
    focusCardLoading: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 68,
    },
    focusRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    focusIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.75)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    focusEmoji: {
      fontSize: 22,
    },
    focusBody: {
      flex: 1,
      marginRight: 6,
    },
    focusTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      letterSpacing: -0.2,
      lineHeight: 22,
    },
    focusDate: {
      fontSize: 12,
      color: theme.secondaryText,
      marginTop: 3,
    },
    focusSender: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.primary,
      letterSpacing: 0.2,
      marginBottom: 3,
    },
    focusMessage: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 20,
    },
    focusCardEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 20,
    },
    focusEmptyIcon: {
      fontSize: 28,
      marginBottom: 8,
    },
    focusEmptyTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      letterSpacing: -0.2,
    },
    focusEmptySubtitle: {
      fontSize: 12,
      color: theme.secondaryText,
      marginTop: 4,
    },

    // Quick Actions
    actionsGrid: {
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'space-between',
      gap: 8,
      marginHorizontal: -4,
      marginBottom: 18,
    },
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
      minHeight: 80,
      borderRadius: 17,
      paddingVertical: 14,
      paddingHorizontal: 6,
      ...shadow,
    },
    actionIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 9,
    },
    actionLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.text,
      letterSpacing: 0.1,
      lineHeight: 13,
      textAlign: 'center',
    },

    // Family Snapshot
    familyScrollContent: {
      paddingRight: spacing.sm,
      gap: 16,
    },
    avatarWrap: {
      alignItems: 'center',
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    avatarInitials: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
    avatarName: {
      fontSize: 11,
      color: theme.secondaryText,
      fontWeight: '500',
      maxWidth: 48,
      textAlign: 'center',
    },
    avatarOverflow: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    avatarOverflowText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.secondaryText,
      letterSpacing: 0.2,
    },

    // Recent Activity
    timelineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 2,
    },
    timelineRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    timelineDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      flexShrink: 0,
    },
    timelineText: {
      flex: 1,
      fontSize: 13,
      color: theme.text,
      lineHeight: 18,
      marginRight: 8,
    },
    timelineTime: {
      fontSize: 11,
      color: theme.secondaryText,
      flexShrink: 0,
    },

    bottomPad: {
      height: 40,
    },
  })
);
