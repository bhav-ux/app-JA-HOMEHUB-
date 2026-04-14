import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { deleteDoc, doc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { listenToUserDisplayName } from '../utils/user';

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
    if (!user || !event?.id || !familyId || event.createdBy !== user.uid) {
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
            await deleteDoc(doc(db, 'families', familyId, 'events', event.id));
            navigation.goBack();
          } catch (error) {
            console.error('Failed to delete event', error);
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
          >
            <Text style={styles.deleteButtonText}>{deleting ? 'Deleting…' : 'Delete Event'}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
  },
  date: {
    fontSize: 16,
    color: '#555',
  },
  meta: {
    fontSize: 13,
    color: '#666',
  },
  description: {
    marginTop: 8,
    fontSize: 16,
    color: '#222',
    lineHeight: 22,
  },
  deleteButton: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  infoText: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
  },
});
