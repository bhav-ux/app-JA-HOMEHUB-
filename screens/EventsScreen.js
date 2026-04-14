import { useEffect, useState } from "react";
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
} from "react-native";
import { collection, doc, getDoc, onSnapshot, orderBy, query } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { colors, radius, shadow, spacing, typography } from "../src/theme";

export default function EventsScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [familyId, setFamilyId] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(true);

  const user = auth.currentUser;

  const toValidDate = (value) => {
    if (!value) return null;
    const date = value?.toDate ? value.toDate() : value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  useEffect(() => {
    const fetchFamily = async () => {
      if (!user?.uid) {
        setFamilyLoading(false);
        setLoading(false);
        setFamilyId(null);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const familyValue = snap.exists() ? snap.data()?.familyId : null;
        setFamilyId(familyValue || null);
        console.log("[Events] Family loaded:", familyValue || null);
      } catch (error) {
        console.error("Error fetching family", error);
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

    // Bug fix: events are scoped to families, not a global collection.
    setLoading(true);
    const eventsRef = collection(db, "families", familyId, "events");
    const q = query(eventsRef, orderBy("date", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setEvents(data);
        setLoading(false);
        console.log("[Events] Snapshot received:", data.length);
      },
      (error) => {
        console.error("Error fetching events", error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user, familyId]);

  const formattedEvents = events.map((event) => {
    const dateValue = toValidDate(event?.date);

    return {
      ...event,
      formattedDate: dateValue
        ? dateValue.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "—",
    };
  });

  const handleAddEvent = () => {
    if (!user) {
      Alert.alert("Not signed in", "You need to be signed in to create events.");
      return;
    }
    navigation.navigate("AddEvent");
  };

  const renderItem = ({ item }) => (
    <Pressable
      onPress={() => navigation.navigate("EventDetails", { event: item, familyId })}
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
          <ActivityIndicator size="large" color={colors.primary} />
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
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <FlatList
            data={formattedEvents}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListEmptyComponent={
              <View style={styles.centerContent}>
                <Text style={styles.infoText}>
                  No events yet — tap + to add one!
                </Text>
              </View>
            }
          />
        )}

        <TouchableOpacity
          style={styles.fab}
          onPress={handleAddEvent}
          accessibilityRole="button"
          accessibilityLabel="Add event"
          accessibilityHint="Create a new event"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.title,
    marginBottom: spacing.lg,
    color: colors.textPrimary,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  infoText: {
    fontSize: typography.body.fontSize + 1,
    color: colors.textSecondary,
    textAlign: "center",
  },
  eventItem: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...shadow,
  },
  eventItemPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    ...typography.heading,
    marginBottom: spacing.xs,
    color: colors.textPrimary,
  },
  eventDate: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 22,
    color: colors.textSecondary,
    marginLeft: spacing.md,
  },
  fab: {
    position: "absolute",
    right: spacing.xl,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    ...shadow,
  },
  fabText: {
    color: "#fff",
    fontSize: 32,
    textAlign: "center",
    marginTop: -2,
  },
});
