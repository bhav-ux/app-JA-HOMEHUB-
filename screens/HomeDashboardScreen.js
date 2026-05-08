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
  '#F59E0B',
  '#F43F5E',
  '#7C3AED',
  '#0D9488',
  '#EA580C',
  '#4F46E5',
  '#DB2777',
  '#059669',
];

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
      const sender = last.email ? last.email.split('@')[0] : 'Family';
      items.push({
        id: `msg-${last.id}`,
        icon: 'chatbubble-ellipses-outline',
        text: last.type === 'voice'
          ? `${sender} sent a voice message`
          : `${sender} said something in chat`,
        date: last.createdAt instanceof Date ? last.createdAt : null,
        onPress: () => navigation.navigate('Chat'),
      });
    }
    [...events].reverse().slice(0, 4).forEach((event) => {
      items.push({
        id: `event-${event.id}`,
        icon: 'calendar-outline',
        text: `${event.emoji ? event.emoji + ' ' : ''}${event.title} was added`,
        date: normalizeDate(event.date),
        onPress: () => navigation.navigate('EventDetails', { event, familyId }),
      });
    });
    items.sort((a, b) => (b.date || new Date(0)) - (a.date || new Date(0)));
    return items.slice(0, 5);
  }, [events, messages, navigation, familyId]);

  const handleAddEvent = () => {
    if (!user) { Alert.alert('Not signed in', 'Please sign in to add events.'); return; }
    navigation.navigate('AddEvent');
  };

  const handleCreateAlbum = () => {
    if (!familyId) { Alert.alert('Family not set', 'Join or create a family to create albums.'); return; }
    navigation.navigate('CreateAlbum', { familyId });
  };

  const quickActions = [
    { label: 'Event', icon: 'add-circle-outline', onPress: handleAddEvent },
    { label: 'Chat', icon: 'chatbubble-outline', onPress: () => navigation.navigate('Chat') },
    { label: 'Album', icon: 'images-outline', onPress: handleCreateAlbum },
    { label: 'Note', icon: 'document-text-outline', onPress: () => navigation.navigate('AddCalendarNote') },
  ];

  let focusState = 'loading';
  if (!eventsLoading) {
    if (upcomingEvent) focusState = 'event';
    else if (latestMessage) focusState = 'message';
    else focusState = 'empty';
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View style={[styles.heroSection, { transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.greetingText}>
            {greeting},{'\n'}
            <Text style={styles.greetingName}>{getDisplayName(user)}</Text>
          </Text>
          <Text style={styles.dateText}>{getTodayLabel()}</Text>
        </Animated.View>

        {/* Today Focus */}
        <View style={styles.section}>
          <Text style={styles.sectionChip}>TODAY</Text>

          {focusState === 'loading' && (
            <View style={[styles.focusCard, styles.focusCardLoading]}>
              <ActivityIndicator size="small" color={`${theme.primary}66`} />
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
                    : <Ionicons name="calendar-outline" size={22} color={theme.primary} />
                  }
                </View>
                <View style={styles.focusBody}>
                  <Text style={styles.focusTitle} numberOfLines={2}>{upcomingEvent.title}</Text>
                  <Text style={styles.focusDate}>{formatRelativeDate(upcomingEvent.date)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={`${theme.primary}55`} />
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
                <View style={[styles.focusIconWrap, styles.focusIconWrapMsg]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.primary} />
                </View>
                <View style={styles.focusBody}>
                  <Text style={styles.focusSender}>
                    {latestMessage.email ? latestMessage.email.split('@')[0] : 'Family'}
                  </Text>
                  <Text style={styles.focusMessage} numberOfLines={2}>
                    {latestMessage.type === 'voice'
                      ? '🎤  Voice message'
                      : `"${latestMessage.text?.length > 75
                          ? latestMessage.text.slice(0, 75) + '…'
                          : latestMessage.text}"`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={`${theme.primary}55`} />
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

        {/* Quick Action Pills */}
        <View style={styles.pillsRow}>
          {quickActions.map(({ label, icon, onPress }, i) => (
            <AnimatedCard
              key={label}
              style={[styles.pill, i < quickActions.length - 1 && styles.pillGap]}
              onPress={onPress}
              accessibilityLabel={label}
              scaleDown={0.93}
            >
              <Ionicons name={icon} size={15} color={theme.primary} style={styles.pillIcon} />
              <Text style={styles.pillLabel}>{label}</Text>
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
              {members.map((member, i) => (
                <View key={member.uid} style={styles.avatarWrap}>
                  <View style={[styles.avatar, { backgroundColor: getAvatarColor(member.name, i) }]}>
                    <Text style={styles.avatarInitials}>{getInitials(member.name)}</Text>
                  </View>
                  <Text style={styles.avatarName} numberOfLines={1}>
                    {member.name.split(' ')[0]}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Recent Activity Timeline */}
        {recentActivity.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionChip}>RECENT</Text>
            <View style={styles.timelineCard}>
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
                    <Ionicons name={item.icon} size={13} color={theme.primary} />
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
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ theme, shadow }) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },

    // Hero
    heroSection: {
      paddingBottom: spacing.xl + 4,
    },
    greetingText: {
      fontSize: 32,
      fontWeight: '300',
      color: theme.text,
      letterSpacing: -0.6,
      lineHeight: 40,
    },
    greetingName: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.8,
    },
    dateText: {
      fontSize: 14,
      color: theme.secondaryText,
      marginTop: 8,
      fontWeight: '400',
      letterSpacing: 0.1,
    },

    // Section label
    section: {
      marginBottom: spacing.xl,
    },
    sectionChip: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.secondaryText,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 10,
    },

    // Today Focus Card
    focusCard: {
      backgroundColor: theme.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: `${theme.primary}18`,
      padding: spacing.md + 2,
      ...shadow,
    },
    focusCardLoading: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 76,
    },
    focusRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    focusIconWrap: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: `${theme.primary}0F`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    focusIconWrapMsg: {
      backgroundColor: `${theme.primary}0C`,
    },
    focusEmoji: {
      fontSize: 24,
    },
    focusBody: {
      flex: 1,
      marginRight: 6,
    },
    focusTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
      letterSpacing: -0.2,
      lineHeight: 23,
    },
    focusDate: {
      fontSize: 13,
      color: theme.secondaryText,
      marginTop: 3,
    },
    focusSender: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.primary,
      letterSpacing: 0.2,
      marginBottom: 3,
    },
    focusMessage: {
      fontSize: 15,
      color: theme.text,
      lineHeight: 21,
    },
    focusCardEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl,
    },
    focusEmptyIcon: {
      fontSize: 34,
      marginBottom: 10,
    },
    focusEmptyTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
      letterSpacing: -0.2,
    },
    focusEmptySubtitle: {
      fontSize: 13,
      color: theme.secondaryText,
      marginTop: 5,
    },

    // Quick Action Pills
    pillsRow: {
      flexDirection: 'row',
      marginBottom: spacing.xl + 4,
    },
    pill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${theme.primary}0D`,
      borderRadius: 50,
      paddingVertical: 10,
      paddingHorizontal: 4,
    },
    pillGap: {
      marginRight: 8,
    },
    pillIcon: {
      marginRight: 4,
    },
    pillLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.primary,
      letterSpacing: 0.1,
    },

    // Family Snapshot
    familyScrollContent: {
      paddingRight: spacing.sm,
    },
    avatarWrap: {
      alignItems: 'center',
      marginRight: 18,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    avatarInitials: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.4,
    },
    avatarName: {
      fontSize: 11,
      color: theme.secondaryText,
      fontWeight: '500',
      maxWidth: 52,
      textAlign: 'center',
    },

    // Recent Activity Timeline
    timelineCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    timelineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: 14,
    },
    timelineRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    timelineDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: `${theme.primary}0D`,
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
      height: spacing.xl + 16,
    },
  })
);
