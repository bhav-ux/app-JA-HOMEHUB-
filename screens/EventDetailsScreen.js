import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { deleteEvent } from '../utils/delete';
import { auth } from '../firebaseConfig';
import { listenToUserDisplayName } from '../utils/user';
import { colors, radius, shadow, spacing, typography } from '../src/theme';

export default function EventDetailsScreen({ route, navigation }) {
  const { event, familyId: passedFamilyId } = route.params || {};
  const user = auth.currentUser;
  const [deleting, setDeleting] = useState(false);
  const [creatorName, setCreatorName] = useState('');
  const familyId = passedFamilyId || event?.familyId;

  const toValidDate = (value) => {
    if (!value) return null;
    const date = value?.toDate ? value.toDate() : value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  useEffect(() => {
    if (!event?.createdBy) return;
    const unsubscribe = listenToUserDisplayName(event.createdBy, (value) => setCreatorName(value));
    return unsubscribe;
  }, [event?.createdBy]);

  const dateLabel = useMemo(() => {
    if (!event?.date) return 'No date available';
    const dateValue = toValidDate(event.date);
    if (!dateValue) {
      // Bug fix: guard invalid dates to avoid runtime errors in formatting.
      return 'Invalid date';
    }
    return dateValue.toLocaleString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [event]);

  const handleDelete = () => {
    if (!user || !event?.id || !familyId) {
      return;
    }

    Alert.alert('Delete Event', 'Are you sure you want to delete this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeleting(true);
            await deleteEvent({ familyId, eventId: event.id, currentUser: user });
            navigation.goBack();
          } catch (error) {
            console.error('Failed to delete event', error);
            Alert.alert('Not allowed', error.message || 'You can only delete your own events');
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (!event) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContent}>
          <Text style={styles.infoText}>Event not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const canDelete = user && event.createdBy === user.uid;
  const creatorLabel = creatorName || event.createdByEmail || event.createdBy || 'Unknown';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.date}>{dateLabel}</Text>
        {creatorLabel ? <Text style={styles.meta}>Created by: {creatorLabel}</Text> : null}
        {event.description ? <Text style={styles.description}>{event.description}</Text> : null}
        {canDelete ? (
          <TouchableOpacity
            style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
            onPress={handleDelete}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Delete event"
            accessibilityHint="Remove this event from your family"
          >
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.deleteButtonText}>Delete Event</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  date: {
    fontSize: typography.body.fontSize + 1,
    color: colors.textSecondary,
  },
  meta: {
    fontSize: typography.small.fontSize,
    color: colors.textSecondary,
  },
  description: {
    marginTop: spacing.sm,
    fontSize: typography.body.fontSize + 1,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  deleteButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.error,
    alignItems: 'center',
    ...shadow,
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: typography.body.fontSize + 1,
    fontWeight: '700',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  infoText: {
    fontSize: typography.body.fontSize + 1,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
