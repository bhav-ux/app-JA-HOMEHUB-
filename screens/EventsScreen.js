import { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { auth } from '../firebaseConfig';
import { getUserFamilyId, subscribeToEvents } from '../services/eventService';
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';

export default function EventsScreen({ navigation }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [familyId, setFamilyId] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(true);

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

  const handleAddEvent = () => {
    if (!user) {
      Alert.alert('Not signed in', 'You need to be signed in to create events.');
      return;
    }
    navigation.navigate('AddEvent');
  };

  const renderItem = ({ item }) => (
    <Pressable
      onPress={() => navigation.navigate('EventDetails', { event: item, familyId })}
      accessibilityRole="button"
      accessibilityLabel={`Open event ${item.title}`}
      style={({ pressed }) => [styles.eventItem, pressed && styles.eventItemPressed]}
    >
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <Text style={styles.eventDate}>{item.formattedDate}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
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
          <Text style={styles.infoText}>No family found for your account.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Events</Text>
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} />
        ) : (
          <FlatList
            data={formattedEvents}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListEmptyComponent={
              <View style={styles.centerContent}>
                <Text style={styles.infoText}>No events yet. Tap + to add one.</Text>
              </View>
            }
          />
        )}
        <TouchableOpacity style={styles.fab} onPress={handleAddEvent}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, padding: spacing.lg, backgroundColor: theme.background },
    title: { ...typography.title, marginBottom: spacing.lg, color: theme.text },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    infoText: { fontSize: typography.body.fontSize + 1, color: theme.secondaryText, textAlign: 'center' },
    eventItem: {
      backgroundColor: theme.card,
      padding: spacing.lg,
      borderRadius: radius.md,
      marginBottom: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.border,
      ...shadow,
    },
    eventItemPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
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
      justifyContent: 'center',
      alignItems: 'center',
      ...shadow,
    },
    fabText: { color: '#fff', fontSize: 32, textAlign: 'center', marginTop: -2 },
  })
);
