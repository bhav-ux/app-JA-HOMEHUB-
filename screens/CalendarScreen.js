import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { format } from 'date-fns';
import { auth, db } from '../firebaseConfig';
import { colors, radius, shadow, spacing, typography } from '../src/theme';
import { deleteCalendarEvent } from '../utils/delete';

export default function CalendarScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
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
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const familyValue = snap.exists() ? snap.data()?.familyId : null;
        setFamilyId(familyValue || null);
      } catch (error) {
        console.error('Error fetching family', error);
      } finally {
        setFamilyLoading(false);
      }
    };
    fetchFamily();
  }, [user]);

  useEffect(() => {
    if (!user || !familyId) {
      setLoading(false);
      return;
    }

    let eventsUnsubscribe;
    let notesUnsubscribe;
    let eventsLoaded = false;
    let notesLoaded = false;

    const checkLoading = () => {
      if (eventsLoaded && notesLoaded) {
        setLoading(false);
      }
    };

    setLoading(true);
    const eventsRef = collection(db, 'families', familyId, 'events');
    const eventsQuery = query(eventsRef, orderBy('date', 'asc'));
    eventsUnsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setEvents(data);
        eventsLoaded = true;
        checkLoading();
      },
      (error) => {
        console.error('Error fetching events', error);
        eventsLoaded = true;
        checkLoading();
      }
    );

    const notesRef = collection(db, 'families', familyId, 'notes');
    const notesQuery = query(notesRef, orderBy('date', 'asc'));
    notesUnsubscribe = onSnapshot(
      notesQuery,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setNotes(data);
        notesLoaded = true;
        checkLoading();
      },
      (error) => {
        console.error('Error fetching notes', error);
        notesLoaded = true;
        checkLoading();
      }
    );

    return () => {
      if (eventsUnsubscribe) eventsUnsubscribe();
      if (notesUnsubscribe) notesUnsubscribe();
    };
  }, [user, familyId]);

  const markedDates = useMemo(() => {
    const marked = {};
    
    // Add events with blue dots
    events.forEach((event) => {
      const dateValue = toValidDate(event.date);
      if (!dateValue) return;
      const dateKey = format(dateValue, 'yyyy-MM-dd');

      if (!marked[dateKey]) {
        marked[dateKey] = {
          marked: true,
          dots: [{ color: colors.primary }],
        };
      } else {
        marked[dateKey].dots.push({ color: colors.primary });
      }
    });

    // Add notes with green dots
    notes.forEach((note) => {
      const dateValue = toValidDate(note.date);
      if (!dateValue) return;
      const dateKey = format(dateValue, 'yyyy-MM-dd');

      if (!marked[dateKey]) {
        marked[dateKey] = {
          marked: true,
          dots: [{ color: colors.textSecondary }],
        };
      } else {
        marked[dateKey].dots.push({ color: colors.textSecondary });
      }
    });

    if (selectedDate) {
      marked[selectedDate] = {
        ...marked[selectedDate],
        selected: true,
        selectedColor: colors.primary,
      };
    }

    return marked;
  }, [events, notes, selectedDate]);

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];

    return events.filter((event) => {
      const eventValue = toValidDate(event.date);
      if (!eventValue) return false;
      return format(eventValue, 'yyyy-MM-dd') === selectedDate;
    });
  }, [events, selectedDate]);

  const selectedDateNotes = useMemo(() => {
    if (!selectedDate) return [];

    return notes.filter((note) => {
      const noteValue = toValidDate(note.date);
      if (!noteValue) return false;
      return format(noteValue, 'yyyy-MM-dd') === selectedDate;
    });
  }, [notes, selectedDate]);

  const handleAddNote = () => {
    if (!user) {
      Alert.alert('Not signed in', 'You need to be signed in to add notes.');
      return;
    }
    if (!familyId) {
      Alert.alert('No family found', 'Please try again later.');
      return;
    }
    navigation.navigate('AddCalendarNote');
  };

  const formatEventTime = (eventDate) => {
    const date = toValidDate(eventDate);
    if (!date) return '—';
    return format(date, 'h:mm a');
  };

  const handleDeleteCalendarEvent = (eventItem) => {
    if (!user || !familyId || !eventItem?.id) return;
    Alert.alert('Delete Event', 'Are you sure you want to delete this?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCalendarEvent({
              familyId,
              eventId: eventItem.id,
              currentUser: user,
            });
          } catch (error) {
            console.error('Failed to delete calendar event', error);
            Alert.alert('Not allowed', error.message || 'You can only delete your own events');
          }
        },
      },
    ]);
  };

  const renderEventItem = ({ item }) => {
    const canDelete = user && item.createdBy === user.uid;
    return (
      <View style={styles.eventCard}>
        <View style={styles.eventTimeContainer}>
          <Text style={styles.eventTime}>{formatEventTime(item.date)}</Text>
        </View>
        <View style={styles.eventContent}>
          <View style={styles.eventHeaderRow}>
            <Text style={styles.eventTitle}>{item.title}</Text>
            {canDelete ? (
              <TouchableOpacity
                onPress={() => handleDeleteCalendarEvent(item)}
                accessibilityRole="button"
                accessibilityLabel="Delete event"
                accessibilityHint="Remove this event"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {item.description ? <Text style={styles.eventDescription}>{item.description}</Text> : null}
        </View>
      </View>
    );
  };

  const handleNoteLongPress = (note) => {
    if (!user || !note?.createdBy || note.createdBy !== user.uid || !familyId) {
      return;
    }
    Alert.alert('Delete Note?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            // Bug fix: notes live under the family collection, not a global path.
            await deleteDoc(doc(db, 'families', familyId, 'notes', note.id));
          } catch (error) {
            console.error('Failed to delete note', error);
          }
        },
      },
    ]);
  };

  const renderNoteItem = ({ item }) => (
    <TouchableOpacity activeOpacity={0.9} onLongPress={() => handleNoteLongPress(item)}>
      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>{item.title}</Text>
      </View>
    </TouchableOpacity>
  );

  const selectedDateValue = toValidDate(selectedDate);

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContent}>
          <Text style={styles.infoText}>Please log in to view calendar.</Text>
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
        <Text style={styles.title}>Calendar</Text>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : (
          <>
            <Calendar
              current={selectedDate}
              onDayPress={(day) => setSelectedDate(day.dateString)}
              markedDates={markedDates}
              markingType="multi-dot"
              theme={{
                todayTextColor: colors.primary,
                arrowColor: colors.primary,
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: '#fff',
                calendarBackground: colors.surface,
                monthTextColor: colors.textPrimary,
                textMonthFontWeight: '700',
                textDayStyle: { color: colors.textPrimary },
                textSectionTitleColor: colors.textSecondary,
                textDayFontSize: 16,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 14,
              }}
              style={styles.calendar}
            />
            <View style={styles.eventsSection}>
              <Text style={styles.dateTitle}>
                {selectedDateValue ? format(selectedDateValue, 'MMM d, yyyy') : 'Invalid date'}
              </Text>
              
              {selectedDateEvents.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>
                    Events ({selectedDateEvents.length})
                  </Text>
                  <FlatList
                    data={selectedDateEvents}
                    keyExtractor={(item) => item.id}
                    renderItem={renderEventItem}
                    contentContainerStyle={styles.eventsList}
                    scrollEnabled={false}
                  />
                </>
              )}

              {selectedDateNotes.length > 0 && (
                <>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { marginTop: selectedDateEvents.length > 0 ? spacing.lg : 0 },
                    ]}
                  >
                    Notes ({selectedDateNotes.length})
                  </Text>
                  <FlatList
                    data={selectedDateNotes}
                    keyExtractor={(item) => item.id}
                    renderItem={renderNoteItem}
                    contentContainerStyle={styles.notesList}
                    scrollEnabled={false}
                  />
                </>
              )}

              {selectedDateEvents.length === 0 && selectedDateNotes.length === 0 && (
                <Text style={styles.emptyText}>No events or notes on this date</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.fab}
              onPress={handleAddNote}
              accessibilityRole="button"
              accessibilityLabel="Add calendar note"
              accessibilityHint="Create a new calendar note"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>
          </>
        )}
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
    backgroundColor: colors.background,
  },
  title: {
    ...typography.title,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    color: colors.textPrimary,
  },
  loader: {
    marginTop: spacing.xl,
  },
  calendar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  eventsSection: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  dateTitle: {
    fontSize: typography.heading.fontSize + 2,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  eventsList: {
    paddingBottom: spacing.xxl,
  },
  notesList: {
    paddingBottom: spacing.xxl,
  },
  emptyText: {
    fontSize: typography.body.fontSize + 1,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  eventTimeContainer: {
    marginRight: spacing.md,
    minWidth: 70,
  },
  eventTime: {
    fontSize: typography.body.fontSize + 1,
    fontWeight: '700',
    color: colors.primary,
  },
  eventContent: {
    flex: 1,
  },
  eventHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  eventTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  deleteText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '700',
  },
  deleteButton: {
    minHeight: 32,
    minWidth: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDescription: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  noteCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow,
    borderLeftWidth: 3,
    borderLeftColor: colors.textSecondary,
  },
  noteTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  fabText: {
    color: '#fff',
    fontSize: 32,
    marginTop: -4,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  infoText: {
    fontSize: typography.body.fontSize + 1,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
