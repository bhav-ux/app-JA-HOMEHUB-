import { useEffect, useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { deleteEvent } from '../utils/delete';
import { auth } from '../firebaseConfig';
import { listenToUserDisplayName } from '../utils/user';
import Button from '../src/components/Button';
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';

export default function EventDetailsScreen({ route, navigation }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const { event, familyId: passedFamilyId } = route.params || {};
  const user = auth.currentUser;
  const [deleting, setDeleting] = useState(false);
  const [creatorName, setCreatorName] = useState('');
  const familyId = passedFamilyId || event?.familyId;

  useEffect(() => {
    if (!event?.createdBy) return;
    const unsubscribe = listenToUserDisplayName(event.createdBy, (value) => setCreatorName(value));
    return unsubscribe;
  }, [event?.createdBy]);

  const dateLabel = useMemo(() => {
    if (!event?.date) return 'No date available';
    const dateValue = event.date?.toDate ? event.date.toDate() : event.date instanceof Date ? event.date : new Date(event.date);
    if (Number.isNaN(dateValue.getTime())) return 'Invalid date';
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
          <Button label={deleting ? 'Deleting Event...' : 'Delete Event'} onPress={handleDelete} loading={deleting} variant="danger" />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ theme }) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { padding: spacing.lg, gap: spacing.lg },
    title: { ...typography.title, color: theme.text },
    date: { fontSize: typography.body.fontSize + 1, color: theme.secondaryText },
    meta: { fontSize: typography.small.fontSize, color: theme.secondaryText },
    description: { fontSize: typography.body.fontSize + 2, color: theme.text, lineHeight: 22 },
    centerContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    infoText: {
      fontSize: typography.body.fontSize + 1,
      color: theme.secondaryText,
      textAlign: 'center',
    },
  })
);
