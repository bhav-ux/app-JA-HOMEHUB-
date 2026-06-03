import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { format } from 'date-fns';
import { auth, db } from '../firebaseConfig';
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';
import { deleteCalendarEvent } from '../utils/delete';
import { showAlert, showConfirm } from '../utils/dialogs';
import { getFirebaseErrorMessage } from '../utils/firebaseError';
import AnimatedCard from '../src/components/AnimatedCard';

const FAB_SPRING = { tension: 300, friction: 20, useNativeDriver: true };

export default function CalendarScreen({ navigation }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [familyId, setFamilyId] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);

  const fabScale = useRef(new Animated.Value(1)).current;

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

  const upcomingEvents = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return events
      .filter((event) => {
        const dateValue = toValidDate(event.date);
        if (!dateValue) return false;
        const dateKey = format(dateValue, 'yyyy-MM-dd');
        return dateValue >= todayStart && dateKey !== selectedDate;
      })
      .slice(0, 8);
  }, [events, selectedDate]);

  const openFabMenu = useCallback(() => setFabMenuOpen(true), []);
  const closeFabMenu = useCallback(() => setFabMenuOpen(false), []);

  const handleFabPress = useCallback(() => {
    if (fabMenuOpen) closeFabMenu();
    else openFabMenu();
  }, [fabMenuOpen, openFabMenu, closeFabMenu]);

  const handleAddNote = useCallback(() => {
    closeFabMenu();
    if (!user) {
      showAlert('Not signed in', 'You need to be signed in to add notes.');
      return;
    }
    if (!familyId) {
      showAlert('No family found', 'Please try again later.');
      return;
    }
    navigation.navigate('AddCalendarNote');
  }, [closeFabMenu, user, familyId, navigation]);

  const handleAddEventFromCalendar = useCallback(() => {
    closeFabMenu();
    if (!user) {
      showAlert('Not signed in', 'You need to be signed in to add events.');
      return;
    }
    if (!familyId) {
      showAlert('No family found', 'Please try again later.');
      return;
    }
    navigation.navigate('AddEvent');
  }, [closeFabMenu, user, familyId, navigation]);

  const handleDeleteCalendarEvent = (eventItem) => {
    if (!user || !familyId || !eventItem?.id) return;
    showConfirm('Delete Item', 'Are you sure you want to delete this?', {
      onConfirm: async () => {
        try {
          await deleteCalendarEvent({ familyId, eventId: eventItem.id, currentUser: user });
        } catch (error) {
          console.error('Failed to delete calendar event', error);
          showAlert('Not allowed', getFirebaseErrorMessage(error, 'You can only delete your own events'));
        }
      },
    });
  };

  const handleNoteLongPress = (note) => {
    if (!user || !note?.createdBy || note.createdBy !== user.uid || !familyId) return;
    showConfirm('Delete Item', 'Are you sure you want to delete this?', {
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'families', familyId, 'notes', note.id));
        } catch (error) {
          console.error('Failed to delete note', error);
        }
      },
    });
  };

  const renderEventItem = ({ item }) => {
    const canDelete = user && item.createdBy === user.uid;
    const dateValue = toValidDate(item.date);
    const timeDisplay = item.hasTime && dateValue ? format(dateValue, 'h:mm a') : null;
    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => navigation.navigate('EventDetails', { event: item, familyId })}
        activeOpacity={0.8}
      >
        {timeDisplay ? (
          <View style={styles.eventTimeContainer}>
            <Text style={styles.eventTime}>{timeDisplay}</Text>
          </View>
        ) : null}
        <View style={styles.eventContent}>
          <View style={styles.eventHeaderRow}>
            <Text style={styles.eventTitle}>
              {item.emoji ? `${item.emoji} ` : ''}{item.title}
            </Text>
            {canDelete ? (
              <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteCalendarEvent(item)}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {item.description ? <Text style={styles.eventDescription}>{item.description}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderNoteItem = ({ item }) => {
    const isOwner = user && item.createdBy === user.uid;
    if (Platform.OS === 'web') {
      return (
        <View style={styles.noteCard}>
          <View style={styles.noteRow}>
            <Text style={styles.noteTitle}>{item.title}</Text>
            {isOwner && (
              <TouchableOpacity
                style={styles.noteDeleteBtn}
                onPress={() => handleNoteLongPress(item)}
                accessibilityRole="button"
                accessibilityLabel="Delete note"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={16} color={theme.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    return (
      <AnimatedCard style={styles.noteCard} onLongPress={() => handleNoteLongPress(item)}>
        <View style={styles.noteRow}>
          <Text style={styles.noteTitle}>{item.title}</Text>
        </View>
      </AnimatedCard>
    );
  };

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
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
          >
            <Calendar
              current={selectedDate}
              onDayPress={(day) => setSelectedDate(day.dateString)}
              markedDates={markedDates}
              markingType="multi-dot"
              theme={{
                calendarBackground: theme.card,
                backgroundColor: theme.card,
                monthTextColor: theme.text,
                dayTextColor: theme.text,
                textDisabledColor: theme.secondaryText,
                textSectionTitleColor: theme.secondaryText,
                todayTextColor: theme.primary,
                arrowColor: theme.primary,
                selectedDayBackgroundColor: theme.primary,
                selectedDayTextColor: '#fff',
                dotColor: theme.primary,
                selectedDotColor: '#fff',
                indicatorColor: theme.primary,
                textMonthFontWeight: '700',
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

              {selectedDateEvents.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Events ({selectedDateEvents.length})</Text>
                  <FlatList
                    data={selectedDateEvents}
                    keyExtractor={(item) => item.id}
                    renderItem={renderEventItem}
                    contentContainerStyle={styles.eventsList}
                    scrollEnabled={false}
                  />
                </>
              ) : null}

              {selectedDateNotes.length > 0 ? (
                <>
                  <Text style={[styles.sectionTitle, selectedDateEvents.length > 0 ? styles.notesSectionTitle : null]}>
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
              ) : null}

              {selectedDateEvents.length === 0 && selectedDateNotes.length === 0 ? (
                <Text style={styles.emptyText}>Nothing planned for this day. Tap + to add.</Text>
              ) : null}
            </View>

            {upcomingEvents.length > 0 ? (
              <View style={styles.upcomingSection}>
                <Text style={styles.sectionTitle}>Upcoming Events</Text>
                {upcomingEvents.map((event) => {
                  const dateValue = toValidDate(event.date);
                  const dayLabel = dateValue ? format(dateValue, 'EEE, MMM d') : '—';
                  const timeLabel = event.hasTime && dateValue ? `  ·  ${format(dateValue, 'h:mm a')}` : '';
                  return (
                    <TouchableOpacity
                      key={event.id}
                      style={styles.upcomingCard}
                      onPress={() => navigation.navigate('EventDetails', { event, familyId })}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.upcomingDate}>{dayLabel}{timeLabel}</Text>
                      <Text style={styles.upcomingTitle} numberOfLines={1}>
                        {event.emoji ? `${event.emoji} ` : ''}{event.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>
        )}

        {fabMenuOpen ? (
          <TouchableOpacity
            activeOpacity={1}
            onPress={closeFabMenu}
            style={styles.fabBackdrop}
          />
        ) : null}

        {fabMenuOpen ? (
          <View style={[styles.fabSpeedItem, { bottom: spacing.lg + Math.max(insets.bottom, spacing.xs) + 64 }]}>
            <Text style={styles.fabSpeedLabel}>Add Note</Text>
            <TouchableOpacity style={styles.fabMini} onPress={handleAddNote}>
              <Ionicons name="pencil-outline" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>
        ) : null}

        {fabMenuOpen ? (
          <View style={[styles.fabSpeedItem, { bottom: spacing.lg + Math.max(insets.bottom, spacing.xs) + 120 }]}>
            <Text style={styles.fabSpeedLabel}>Add Event</Text>
            <TouchableOpacity style={styles.fabMini} onPress={handleAddEventFromCalendar}>
              <Ionicons name="calendar-outline" size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>
        ) : null}

        <Animated.View style={[styles.fab, { bottom: spacing.lg + Math.max(insets.bottom, spacing.xs), transform: [{ scale: fabScale }] }]}>
          <TouchableOpacity
            style={styles.fabTouchable}
            onPress={handleFabPress}
            onPressIn={onFabPressIn}
            onPressOut={onFabPressOut}
            activeOpacity={0.9}
          >
            <Text style={styles.fabText}>{fabMenuOpen ? '×' : '+'}</Text>
          </TouchableOpacity>
        </Animated.View>
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
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 100 },
    calendar: {
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingBottom: spacing.sm,
      backgroundColor: theme.card,
    },
    eventsSection: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    dateTitle: { fontSize: typography.heading.fontSize + 2, fontWeight: '700', color: theme.text, marginBottom: spacing.md },
    sectionTitle: { ...typography.heading, color: theme.secondaryText, marginBottom: spacing.sm },
    notesSectionTitle: { marginTop: spacing.lg },
    eventsList: { paddingBottom: spacing.sm },
    notesList: { paddingBottom: spacing.sm },
    emptyText: { fontSize: typography.body.fontSize + 1, color: theme.secondaryText, textAlign: 'center', marginTop: spacing.lg },
    eventCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.card,
      borderRadius: radius.md,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: theme.primary,
      ...shadow,
    },
    eventTimeContainer: { marginRight: spacing.md, minWidth: 62 },
    eventTime: { fontSize: typography.body.fontSize, fontWeight: '700', color: theme.primary },
    eventContent: { flex: 1, minWidth: 0 },
    eventHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
    eventTitle: { ...typography.heading, color: theme.text, flex: 1 },
    deleteText: { color: theme.error, fontSize: 13, fontWeight: '700' },
    deleteButton: {
      minHeight: 32,
      minWidth: 44,
      paddingHorizontal: spacing.sm,
      marginTop: 2,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: theme.error,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      ...(Platform.OS === 'web' ? { zIndex: 2, elevation: 2, cursor: 'pointer' } : {}),
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
    noteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    noteTitle: { ...typography.heading, color: theme.text, flex: 1 },
    noteDeleteBtn: {
      padding: 4,
      marginLeft: spacing.sm,
      opacity: 0.7,
      ...(Platform.OS === 'web' ? { zIndex: 2, elevation: 2, cursor: 'pointer' } : {}),
    },
    upcomingSection: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
    },
    upcomingCard: {
      backgroundColor: theme.card,
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
      borderLeftWidth: 2,
      borderLeftColor: theme.primary,
      ...shadow,
    },
    upcomingDate: {
      fontSize: typography.small.fontSize,
      color: theme.primary,
      fontWeight: '600',
      marginBottom: 2,
    },
    upcomingTitle: {
      fontSize: typography.body.fontSize,
      color: theme.text,
      fontWeight: '500',
    },
    fabBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.18)',
      zIndex: 10,
    },
    fabSpeedItem: {
      position: 'absolute',
      right: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      zIndex: 11,
    },
    fabSpeedLabel: {
      backgroundColor: theme.card,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 4,
      borderRadius: radius.sm,
      fontSize: 13,
      color: theme.text,
      fontWeight: '600',
      ...shadow,
    },
    fabMini: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      ...shadow,
    },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      overflow: 'hidden',
      zIndex: 12,
      ...shadow,
    },
    fabTouchable: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    fabText: { color: '#fff', fontSize: 32, marginTop: -4 },
    centerContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      backgroundColor: theme.background,
      paddingVertical: spacing.xxl,
    },
    infoText: { fontSize: typography.body.fontSize + 1, color: theme.secondaryText, textAlign: 'center' },
  })
);
