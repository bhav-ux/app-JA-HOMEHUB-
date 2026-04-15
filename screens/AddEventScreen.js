import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
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

export default function AddEventScreen({ navigation }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [familyId, setFamilyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const user = auth.currentUser;

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

  const onChangeDate = (event, selectedDate) => {
    if (event.type === 'set' && selectedDate) {
      setDate(selectedDate);
    }
    if (Platform.OS !== 'ios') {
      setShowPicker(false);
    }
  };

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

    try {
      setSaving(true);
      await createEventRecord({
        familyId,
        title,
        description,
        date,
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
            placeholder="Description (optional)"
            value={description}
            onChangeText={setDescription}
            multiline
            inputStyle={styles.textArea}
          />

          <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)}>
            <Text style={styles.dateLabel}>Event Date</Text>
            <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>
          </TouchableOpacity>

          {showPicker ? (
            <RNDateTimePicker mode="date" value={date} display="spinner" onChange={onChangeDate} />
          ) : null}

          <Button label={saving ? 'Saving Event...' : 'Save Event'} onPress={handleCreateEvent} loading={saving} disabled={saving} />
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
