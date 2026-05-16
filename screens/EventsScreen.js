import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { auth } from '../firebaseConfig';
import { getUserFamilyId, subscribeToEvents } from '../services/eventService';
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';
import AnimatedCard from '../src/components/AnimatedCard';

const FAB_SPRING = { tension: 300, friction: 20, useNativeDriver: true };

export default function EventsScreen({ navigation }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [familyId, setFamilyId] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fabScale = useRef(new Animated.Value(1)).current;

  const user = auth.currentUser;

  const formattedEvents = useMemo(
    () =>
      events.map((event) => {
        const date = event?.date?.toDate ? event.date.toDate() : event.date instanceof Date ? event.date : new Date(event.date);
        const isValidDate = !Number.isNaN(date?.getTime?.());
        return {
          ...event,
          formattedDate: isValidDate
            ? date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : '—',
        };
      }),
    [events]
  );

  useEffect(() => {
    const fetchFamily = async () => {
      if (!user?.uid) {
        setFamilyLoading(false);
        setLoading(false);
        setFamilyId(null);
        return;
      }
      try {
        const familyValue = await getUserFamilyId(user.uid);
        setFamilyId(familyValue || null);
      } catch (error) {
        console.error('[EventsScreen] Error fetching family', error);
      } finally {
        setFamilyLoading(false);
      }
    };
    fetchFamily();
  }, [user]);

  useEffect(() => {
    if (!user || !familyId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToEvents({
      familyId,
      onData: (nextEvents) => {
        setEvents(nextEvents);
        setLoading(false);
      },
      onError: (error) => {
        console.error('[EventsScreen] Error fetching events', error);
        setEvents([]);
        setLoading(false);
      },
    });

    return unsubscribe;
  }, [user, familyId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const onFabPressIn = useCallback(() => {
    Animated.spring(fabScale, { toValue: 0.88, ...FAB_SPRING }).start();
  }, [fabScale]);

  const onFabPressOut = useCallback(() => {
    Animated.spring(fabScale, { toValue: 1, ...FAB_SPRING }).start();
  }, [fabScale]);

  const handleAddEvent = () => {
    if (!user) {
      Alert.alert('Not signed in', 'You need to be signed in to create events.');
      return;
    }
    navigation.navigate('AddEvent');
  };

  const renderItem = ({ item }) => (
    <AnimatedCard
      style={styles.eventItem}
      onPress={() => navigation.navigate('EventDetails', { event: item, familyId })}
      accessibilityLabel={`Open event ${item.title}`}
    >
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <Text style={styles.eventDate}>{item.formattedDate}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </AnimatedCard>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContent}>
          <Text style={styles.infoText}>Please log in to view events.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (familyLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!familyId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContent}>
          <Text style={styles.infoText}>Set up or join a family to see events.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Events</Text>
        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={formattedEvents}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={formattedEvents.length ? styles.listContent : styles.emptyListContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📅</Text>
                <Text style={styles.infoText}>{"No plans yet\nTap + to add something together"}</Text>
              </View>
            }
          />
        )}
        <Animated.View style={[styles.fab, { transform: [{ scale: fabScale }] }]}>
          <TouchableOpacity
            style={styles.fabTouchable}
            onPress={handleAddEvent}
            onPressIn={onFabPressIn}
            onPressOut={onFabPressOut}
            activeOpacity={0.9}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: theme.background },
    title: { ...typography.title, marginBottom: spacing.md, color: theme.text },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingBottom: spacing.xxl + 40 },
    emptyListContent: { flexGrow: 1, paddingBottom: spacing.xxl + 40 },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },
    emptyEmoji: { fontSize: 36, marginBottom: 12 },
    infoText: { fontSize: typography.body.fontSize + 1, color: theme.secondaryText, textAlign: 'center', lineHeight: 22 },
    eventItem: {
      backgroundColor: theme.card,
      paddingVertical: spacing.md + 2,
      paddingHorizontal: spacing.md + 2,
      borderRadius: radius.lg,
      marginBottom: spacing.sm + 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.border,
      ...shadow,
    },
    eventInfo: { flex: 1 },
    eventTitle: { ...typography.heading, marginBottom: spacing.xs, color: theme.text },
    eventDate: { fontSize: typography.body.fontSize, color: theme.secondaryText },
    chevron: { fontSize: 22, color: theme.secondaryText, marginLeft: spacing.md },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      overflow: 'hidden',
      ...shadow,
    },
    fabTouchable: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    fabText: { color: '#fff', fontSize: 32, textAlign: 'center', marginTop: -2 },
  })
);
