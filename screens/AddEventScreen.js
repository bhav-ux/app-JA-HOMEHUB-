import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import { auth } from '../firebaseConfig';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import { createEvent as createEventRecord, getUserFamilyId } from '../services/eventService';
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';

function todayAtMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function AddEventScreen({ navigation }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayAtMidnight);
  const [hasTime, setHasTime] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [familyId, setFamilyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const today = useMemo(todayAtMidnight, []);
  const user = auth.currentUser;

  const webDateValue = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
  const webMinDate = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, '0')}-${`${today.getDate()}`.padStart(2, '0')}`;
  const webTimeValue = hasTime
    ? `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`
    : '';

  useEffect(() => {
    const fetchFamily = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const nextFamilyId = await getUserFamilyId(user.uid);
        setFamilyId(nextFamilyId);
      } catch (error) {
        console.error('[AddEventScreen] Error fetching family', error);
        Alert.alert('Unable to load family', 'Please try again in a moment.');
      } finally {
        setLoading(false);
      }
    };
    fetchFamily();
  }, [user]);

  const onChangeDateNative = (event, selectedDate) => {
    if (event.type === 'set' && selectedDate) {
      const next = new Date(selectedDate);
      if (hasTime) {
        next.setHours(date.getHours(), date.getMinutes(), 0, 0);
      } else {
        next.setHours(0, 0, 0, 0);
      }
      setDate(next);
    }
    if (Platform.OS !== 'ios') setShowDatePicker(false);
  };

  const onChangeTimeNative = (event, selectedTime) => {
    if (event.type === 'set' && selectedTime) {
      const next = new Date(date);
      next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      setDate(next);
    }
    if (Platform.OS !== 'ios') setShowTimePicker(false);
  };

  const onChangeWebDate = (event) => {
    const nextDateValue = event?.target?.value;
    if (!nextDateValue) return;
    const timeStr = hasTime
      ? `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`
      : '00:00';
    const nextDate = new Date(`${nextDateValue}T${timeStr}:00`);
    if (!Number.isNaN(nextDate.getTime())) setDate(nextDate);
  };

  const onChangeWebTime = (event) => {
    const timeValue = event?.target?.value;
    if (!timeValue) return;
    const [hours, minutes] = timeValue.split(':').map(Number);
    const next = new Date(date);
    next.setHours(hours, minutes, 0, 0);
    setDate(next);
    setHasTime(true);
  };

  const handleOpenTimePicker = () => {
    if (!hasTime) {
      const next = new Date(date);
      next.setHours(12, 0, 0, 0);
      setDate(next);
      setHasTime(true);
    }
    setShowDatePicker(false);
    setShowTimePicker(true);
  };

  const handleClearTime = () => {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    setDate(next);
    setHasTime(false);
    setShowTimePicker(false);
  };

  const timeDisplayLabel = useMemo(
    () => (hasTime ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null),
    [hasTime, date]
  );

  const handleCreateEvent = async () => {
    if (!user) {
      Alert.alert('Not signed in', 'You need to be signed in to create events.');
      return;
    }
    if (!familyId) {
      Alert.alert('No family found', 'Please complete family setup first.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Error', 'Event title is required');
      return;
    }

    const eventDate = new Date(date);
    if (!hasTime) eventDate.setHours(0, 0, 0, 0);

    if (eventDate < today) {
      Alert.alert('Invalid Date', 'Events must be scheduled for today or later.');
      return;
    }

    try {
      setSaving(true);
      await createEventRecord({
        familyId,
        title,
        emoji,
        description,
        date: eventDate,
        hasTime,
        createdBy: user.uid,
        createdByEmail: user.email,
      });
      navigation.goBack();
    } catch (err) {
      console.error('[AddEventScreen] Failed to save event', err);
      Alert.alert('Failed to save', err?.message || 'The event could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerPage}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!familyId) {
    return (
      <SafeAreaView style={styles.centerPage}>
        <Text style={styles.warning}>No family assigned</Text>
        <Text style={styles.secondaryText}>Please complete family setup</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Add Event</Text>
        <View style={styles.card}>
          <Input placeholder="Event Title" value={title} onChangeText={setTitle} />
          <Input
            placeholder="Emoji (optional, e.g. 🎂)"
            value={emoji}
            onChangeText={setEmoji}
            maxLength={8}
          />
          <Input
            placeholder="Description (optional)"
            value={description}
            onChangeText={setDescription}
            multiline
            inputStyle={styles.textArea}
          />

          {Platform.OS === 'web' ? (
            <View style={styles.dateButton}>
              <Text style={styles.dateLabel}>Event Date</Text>
              <TouchableWithoutFeedback>
                <input
                  type="date"
                  value={webDateValue}
                  min={webMinDate}
                  onChange={onChangeWebDate}
                  style={styles.webDateInput}
                  aria-label="Event Date"
                />
              </TouchableWithoutFeedback>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => { setShowTimePicker(false); setShowDatePicker(true); }}
            >
              <Text style={styles.dateLabel}>Event Date</Text>
              <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>
            </TouchableOpacity>
          )}

          {showDatePicker && Platform.OS !== 'web' ? (
            <RNDateTimePicker
              mode="date"
              value={date}
              minimumDate={today}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onChangeDateNative}
            />
          ) : null}

          {Platform.OS === 'web' ? (
            <View style={styles.dateButton}>
              <Text style={styles.dateLabel}>Time (optional)</Text>
              <TouchableWithoutFeedback>
                <input
                  type="time"
                  value={webTimeValue}
                  onChange={onChangeWebTime}
                  style={styles.webDateInput}
                  aria-label="Event Time"
                />
              </TouchableWithoutFeedback>
              {hasTime ? (
                <TouchableOpacity onPress={handleClearTime} style={styles.clearTimeRow}>
                  <Text style={styles.clearTimeText}>Clear time</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : hasTime ? (
            <View style={styles.timeRow}>
              <TouchableOpacity
                style={[styles.dateButton, styles.flex1]}
                onPress={handleOpenTimePicker}
              >
                <Text style={styles.dateLabel}>Time</Text>
                <Text style={styles.dateText}>{timeDisplayLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.clearTimeBtn} onPress={handleClearTime}>
                <Text style={styles.clearTimeText}>Clear</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addTimeBtn} onPress={handleOpenTimePicker}>
              <Text style={styles.addTimeText}>+ Add Time (optional)</Text>
            </TouchableOpacity>
          )}

          {showTimePicker && Platform.OS !== 'web' ? (
            <RNDateTimePicker
              mode="time"
              value={date}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onChangeTimeNative}
            />
          ) : null}

          <Button
            label={saving ? 'Saving Event...' : 'Save Event'}
            onPress={handleCreateEvent}
            loading={saving}
            disabled={saving}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, padding: spacing.lg },
    title: {
      ...typography.title,
      textAlign: 'center',
      marginBottom: spacing.lg,
      color: theme.text,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadow,
    },
    textArea: { height: 96, textAlignVertical: 'top' },
    dateButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.inputBackground,
      borderRadius: radius.md,
      gap: spacing.xs,
    },
    dateLabel: { color: theme.secondaryText, fontSize: typography.small.fontSize },
    dateText: { color: theme.primary, fontSize: 16, fontWeight: '600' },
    webDateInput: {
      marginTop: spacing.xs,
      width: '100%',
      padding: 10,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.sm,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.inputBackground,
    },
    addTimeBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.border,
      backgroundColor: theme.inputBackground,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    addTimeText: { color: theme.primary, fontSize: 15, fontWeight: '500' },
    timeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch' },
    flex1: { flex: 1 },
    clearTimeBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      backgroundColor: theme.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearTimeRow: { marginTop: spacing.xs },
    clearTimeText: { color: theme.error, fontSize: 13, fontWeight: '600' },
    centerPage: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
      padding: spacing.lg,
    },
    warning: { ...typography.heading, color: theme.text },
    secondaryText: { marginTop: spacing.sm, color: theme.secondaryText },
  })
);
