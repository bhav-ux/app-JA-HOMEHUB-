import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { format } from 'date-fns';
import { auth, db } from '../firebaseConfig';
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';
import { deleteCalendarEvent } from '../utils/delete';

export default function CalendarScreen({ navigation }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
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

    let eventsLoaded = false;
    let notesLoaded = false;
    const checkLoading = () => {
      if (eventsLoaded && notesLoaded) setLoading(false);
    };

    setLoading(true);
    const eventsUnsubscribe = onSnapshot(
      query(collection(db, 'families', familyId, 'events'), orderBy('date', 'asc')),
      (snapshot) => {
        setEvents(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        eventsLoaded = true;
        checkLoading();
      },
      (error) => {
        console.error('Error fetching events', error);
        eventsLoaded = true;
        checkLoading();
      }
    );

    const notesUnsubscribe = onSnapshot(
      query(collection(db, 'families', familyId, 'notes'), orderBy('date', 'asc')),
      (snapshot) => {
        setNotes(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
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
      eventsUnsubscribe();
      notesUnsubscribe();
    };
  }, [user, familyId]);

  const markedDates = useMemo(() => {
    const marked = {};

    events.forEach((event) => {
      const dateValue = toValidDate(event.date);
      if (!dateValue) return;
      const dateKey = format(dateValue, 'yyyy-MM-dd');
      if (!marked[dateKey]) {
        marked[dateKey] = { marked: true, dots: [{ color: theme.primary }] };
      } else {
        marked[dateKey].dots.push({ color: theme.primary });
      }
    });

    notes.forEach((note) => {
      const dateValue = toValidDate(note.date);
      if (!dateValue) return;
      const dateKey = format(dateValue, 'yyyy-MM-dd');
      if (!marked[dateKey]) {
        marked[dateKey] = { marked: true, dots: [{ color: theme.secondaryText }] };
      } else {
        marked[dateKey].dots.push({ color: theme.secondaryText });
      }
    });

    if (selectedDate) {
      marked[selectedDate] = {
        ...marked[selectedDate],
        selected: true,
        selectedColor: theme.primary,
      };
    }

    return marked;
  }, [events, notes, selectedDate, theme.primary, theme.secondaryText]);

  const selectedDateEvents = useMemo(
    () =>
      events.filter((event) => {
        const eventValue = toValidDate(event.date);
        return eventValue && format(eventValue, 'yyyy-MM-dd') === selectedDate;
      }),
    [events, selectedDate]
  );

  const selectedDateNotes = useMemo(
    () =>
      notes.filter((note) => {
        const noteValue = toValidDate(note.date);
        return noteValue && format(noteValue, 'yyyy-MM-dd') === selectedDate;
      }),
    [notes, selectedDate]
  );

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

  const handleDeleteCalendarEvent = (eventItem) => {
    if (!user || !familyId || !eventItem?.id) return;
    Alert.alert('Delete Event', 'Are you sure you want to delete this?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCalendarEvent({ familyId, eventId: eventItem.id, currentUser: user });
          } catch (error) {
            console.error('Failed to delete calendar event', error);
            Alert.alert('Not allowed', error.message || 'You can only delete your own events');
          }
        },
      },
    ]);
  };

  const handleNoteLongPress = (note) => {
    if (!user || !note?.createdBy || note.createdBy !== user.uid || !familyId) return;
    Alert.alert('Delete Note?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'families', familyId, 'notes', note.id));
          } catch (error) {
            console.error('Failed to delete note', error);
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
          <Text style={styles.eventTime}>
            {toValidDate(item.date) ? format(toValidDate(item.date), 'h:mm a') : '—'}
          </Text>
        </View>
        <View style={styles.eventContent}>
          <View style={styles.eventHeaderRow}>
            <Text style={styles.eventTitle}>{item.title}</Text>
            {canDelete ? (
              <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteCalendarEvent(item)}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {item.description ? <Text style={styles.eventDescription}>{item.description}</Text> : null}
        </View>
      </View>
    );
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
        <Text style={styles.title}>Calendar</Text>
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
        ) : (
          <>
            <Calendar
              current={selectedDate}
              onDayPress={(day) => setSelectedDate(day.dateString)}
              markedDates={markedDates}
              markingType="multi-dot"
              theme={{
                todayTextColor: theme.primary,
                arrowColor: theme.primary,
                selectedDayBackgroundColor: theme.primary,
                selectedDayTextColor: '#fff',
                calendarBackground: theme.card,
                monthTextColor: theme.text,
                textMonthFontWeight: '700',
                textDayStyle: { color: theme.text },
                textSectionTitleColor: theme.secondaryText,
                textDayFontSize: 16,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 14,
              }}
              style={styles.calendar}
            />
            <View style={styles.eventsSection}>
              <Text style={styles.dateTitle}>{selectedDateValue ? format(selectedDateValue, 'MMM d, yyyy') : 'Invalid date'}</Text>

              {selectedDateEvents.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Events ({selectedDateEvents.length})</Text>
                  <FlatList data={selectedDateEvents} keyExtractor={(item) => item.id} renderItem={renderEventItem} contentContainerStyle={styles.eventsList} scrollEnabled={false} />
                </>
              ) : null}

              {selectedDateNotes.length > 0 ? (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: selectedDateEvents.length > 0 ? spacing.lg : 0 }]}>
                    Notes ({selectedDateNotes.length})
                  </Text>
                  <FlatList data={selectedDateNotes} keyExtractor={(item) => item.id} renderItem={renderNoteItem} contentContainerStyle={styles.notesList} scrollEnabled={false} />
                </>
              ) : null}

              {selectedDateEvents.length === 0 && selectedDateNotes.length === 0 ? (
                <Text style={styles.emptyText}>No events or notes on this date</Text>
              ) : null}
            </View>
            <TouchableOpacity style={styles.fab} onPress={handleAddNote}>
              <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, backgroundColor: theme.background },
    title: {
      ...typography.title,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      color: theme.text,
    },
    loader: { marginTop: spacing.xl },
    calendar: {
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingBottom: spacing.sm,
      backgroundColor: theme.card,
    },
    eventsSection: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    dateTitle: { fontSize: typography.heading.fontSize + 2, fontWeight: '700', color: theme.text, marginBottom: spacing.md },
    sectionTitle: { ...typography.heading, color: theme.secondaryText, marginBottom: spacing.sm },
    eventsList: { paddingBottom: spacing.xl },
    notesList: { paddingBottom: spacing.xl },
    emptyText: { fontSize: typography.body.fontSize + 1, color: theme.secondaryText, textAlign: 'center', marginTop: spacing.lg },
    eventCard: {
      flexDirection: 'row',
      backgroundColor: theme.card,
      borderRadius: radius.md,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: theme.primary,
      ...shadow,
    },
    eventTimeContainer: { marginRight: spacing.md, minWidth: 70 },
    eventTime: { fontSize: typography.body.fontSize + 1, fontWeight: '700', color: theme.primary },
    eventContent: { flex: 1 },
    eventHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    eventTitle: { ...typography.heading, color: theme.text },
    deleteText: { color: theme.error, fontSize: 13, fontWeight: '700' },
    deleteButton: {
      minHeight: 32,
      minWidth: 44,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: theme.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eventDescription: { ...typography.body, color: theme.secondaryText, marginTop: spacing.xs },
    noteCard: {
      backgroundColor: theme.card,
      borderRadius: radius.md,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: theme.secondaryText,
      ...shadow,
    },
    noteTitle: { ...typography.heading, color: theme.text },
    fab: {
      position: 'absolute',
      bottom: spacing.lg,
      right: spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
    },
    fabText: { color: '#fff', fontSize: 32, marginTop: -4 },
    centerContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      backgroundColor: theme.background,
    },
    infoText: { fontSize: typography.body.fontSize + 1, color: theme.secondaryText, textAlign: 'center' },
  })
);
