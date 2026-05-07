import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { subscribeToEvents } from '../services/eventService';
import { subscribeToMessages } from '../services/chatService';
import { createThemedStyles, spacing, useAppTheme } from '../src/theme';
import AnimatedCard from '../src/components/AnimatedCard';

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
  return `${prefix} • ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function formatDateShort(raw) {
  const d = normalizeDate(raw);
  if (!d) return '';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function HomeDashboardScreen({ navigation, route, familyId: familyIdProp }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const familyId = familyIdProp ?? route?.params?.familyId;
  const user = auth.currentUser;

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [greeting, setGreeting] = useState(getGreeting());
  const [events, setEvents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [memberCount, setMemberCount] = useState(null);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 360, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    const id = setInterval(() => setGreeting(getGreeting()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!familyId) return;
    return onSnapshot(doc(db, 'families', familyId), (snap) => {
      if (snap.exists()) setMemberCount((snap.data()?.members || []).length);
    });
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

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events.filter((e) => {
      const d = normalizeDate(e.date);
      return d && d >= now;
    });
  }, [events]);

  const upcomingEvent = upcomingEvents[0] ?? null;

  const recentActivity = useMemo(() => {
    const items = [];

    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      items.push({
        id: `msg-${last.id}`,
        icon: 'chatbubble-outline',
        title: last.email ? last.email.split('@')[0] : 'Family',
        subtitle:
          last.type === 'voice'
            ? 'Sent a voice message'
            : last.text?.length > 52
            ? last.text.slice(0, 52) + '…'
            : last.text || '',
        date: last.createdAt instanceof Date ? last.createdAt : new Date(0),
        onPress: () => navigation.navigate('Chat'),
      });
    }

    [...events]
      .reverse()
      .slice(0, 3)
      .forEach((event) => {
        items.push({
          id: `event-${event.id}`,
          icon: 'calendar-outline',
          title: event.title,
          subtitle: formatDateShort(event.date),
          date: normalizeDate(event.date) || new Date(0),
          onPress: () => navigation.navigate('EventDetails', { event, familyId }),
        });
      });

    items.sort((a, b) => b.date - a.date);
    return items.slice(0, 4);
  }, [events, messages, navigation, familyId]);

  const metaText = [
    memberCount !== null
      ? `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`
      : null,
    upcomingEvents.length > 0
      ? `${upcomingEvents.length} upcoming ${upcomingEvents.length === 1 ? 'event' : 'events'}`
      : null,
  ]
    .filter(Boolean)
    .join(' • ');

  const handleAddEvent = () => {
    if (!user) { Alert.alert('Not signed in', 'Please sign in to add events.'); return; }
    navigation.navigate('AddEvent');
  };

  const handleCreateAlbum = () => {
    if (!familyId) { Alert.alert('Family not set', 'Join or create a family to create albums.'); return; }
    navigation.navigate('CreateAlbum', { familyId });
  };

  const quickActions = [
    { label: 'Add Event', icon: 'add-circle-outline', onPress: handleAddEvent },
    { label: 'Chat', icon: 'chatbubble-outline', onPress: () => navigation.navigate('Chat') },
    { label: 'Album', icon: 'images-outline', onPress: handleCreateAlbum },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.header}>
          <Text style={styles.heroLine}>
            {greeting}, {getDisplayName(user)}
          </Text>
          {metaText ? <Text style={styles.heroMeta}>{metaText}</Text> : null}

          {/* Inline event strip */}
          <View style={styles.eventPreviewWrap}>
            {eventsLoading ? (
              <ActivityIndicator
                size="small"
                color={`${theme.primary}66`}
                style={styles.eventLoadingSpinner}
              />
            ) : upcomingEvent ? (
              <AnimatedCard
                style={styles.eventStrip}
                onPress={() =>
                  navigation.navigate('EventDetails', { event: upcomingEvent, familyId })
                }
                accessibilityLabel={`Open event ${upcomingEvent.title}`}
                scaleDown={0.98}
              >
                <View style={styles.eventStripRow}>
                  <View style={styles.eventStripLeft}>
                    {upcomingEvent.emoji ? (
                      <Text style={styles.eventStripEmoji}>{upcomingEvent.emoji}</Text>
                    ) : (
                      <Ionicons name="calendar-outline" size={17} color={theme.primary} />
                    )}
                  </View>
                  <View style={styles.eventStripBody}>
                    <Text style={styles.eventStripTitle} numberOfLines={1}>
                      {upcomingEvent.title}
                    </Text>
                    <Text style={styles.eventStripDate}>
                      {formatRelativeDate(upcomingEvent.date)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={`${theme.primary}66`} />
                </View>
              </AnimatedCard>
            ) : (
              <Text style={styles.noEventText}>No upcoming family events</Text>
            )}
          </View>
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.actionsRow}>
          {quickActions.map(({ label, icon, onPress }, i) => (
            <AnimatedCard
              key={label}
              style={[styles.actionBtn, i < quickActions.length - 1 && styles.actionBtnGap]}
              onPress={onPress}
              accessibilityLabel={label}
            >
              <View style={styles.actionIconWrap}>
                <Ionicons name={icon} size={20} color={theme.primary} />
              </View>
              <Text style={styles.actionLabel}>{label}</Text>
            </AnimatedCard>
          ))}
        </View>

        {/* ── Recent Activity ── */}
        {recentActivity.length > 0 && (
          <View style={styles.activitySection}>
            <Text style={styles.sectionLabel}>Activity</Text>
            {recentActivity.map((item, i) => (
              <AnimatedCard
                key={item.id}
                style={[
                  styles.activityRow,
                  i < recentActivity.length - 1 && styles.activityRowBorder,
                ]}
                onPress={item.onPress}
                accessibilityLabel={item.title}
                scaleDown={0.98}
              >
                <Ionicons
                  name={item.icon}
                  size={15}
                  color={theme.secondaryText}
                  style={styles.activityIcon}
                />
                <View style={styles.activityBody}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.activitySubtitle} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={12} color={`${theme.secondaryText}55`} />
              </AnimatedCard>
            ))}
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

    // ── Hero ──
    header: {
      paddingBottom: spacing.xl + 4,
    },
    heroLine: {
      fontSize: 26,
      fontWeight: '600',
      color: theme.text,
      letterSpacing: -0.4,
    },
    heroMeta: {
      fontSize: 13,
      color: theme.secondaryText,
      marginTop: 5,
    },
    eventPreviewWrap: {
      marginTop: 18,
    },
    eventLoadingSpinner: {
      alignSelf: 'flex-start',
    },
    eventStrip: {
      backgroundColor: `${theme.primary}09`,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: `${theme.primary}1C`,
      paddingVertical: 11,
      paddingHorizontal: 13,
    },
    eventStripRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    eventStripLeft: {
      width: 26,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    eventStripEmoji: {
      fontSize: 19,
    },
    eventStripBody: {
      flex: 1,
      marginRight: 6,
    },
    eventStripTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      letterSpacing: -0.1,
    },
    eventStripDate: {
      fontSize: 12,
      color: theme.secondaryText,
      marginTop: 2,
    },
    noEventText: {
      fontSize: 13,
      color: theme.secondaryText,
    },

    // ── Quick Actions ──
    actionsRow: {
      flexDirection: 'row',
      marginBottom: spacing.xl + 4,
    },
    actionBtn: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: spacing.md - 2,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
    },
    actionBtnGap: {
      marginRight: spacing.sm + 2,
    },
    actionIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: `${theme.primary}10`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    actionLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.text,
      letterSpacing: 0.1,
    },

    // ── Recent Activity ──
    activitySection: {
      marginBottom: spacing.xl,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.secondaryText,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      marginBottom: spacing.sm + 2,
    },
    activityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 11,
    },
    activityRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    activityIcon: {
      marginRight: 12,
    },
    activityBody: {
      flex: 1,
      marginRight: 6,
    },
    activityTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
    },
    activitySubtitle: {
      fontSize: 12,
      color: theme.secondaryText,
      marginTop: 2,
    },

    bottomPad: {
      height: spacing.xl,
    },
  })
);
