import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { colors, radius, shadow, spacing, typography } from '../src/theme';

export default function AddCalendarNoteScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [familyId, setFamilyId] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(true);

  const user = auth.currentUser;

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

  const formattedDate = useMemo(() => {
    if (!selectedDate) return null;
    return format(selectedDate, 'dd MMM yyyy');
  }, [selectedDate]);

  const hasDate = useMemo(() => {
    return selectedDate !== null;
  }, [selectedDate]);

  const handleDatePicked = (_event, date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (!date) return;
    setSelectedDate(date);
    if (Platform.OS === 'ios') {
      setShowDatePicker(false);
    }
  };

  const handleSave = useCallback(async () => {
    if (!user) {
      Alert.alert('Not signed in', 'You need to be signed in to create notes.');
      return;
    }
    if (!familyId) {
      Alert.alert('No family found', 'Please try again later.');
      return;
    }
    if (!title.trim() || !hasDate) {
      Alert.alert('Missing info', 'Please add a title and pick a date.');
      return;
    }

    try {
      setSaving(true);
      await addDoc(collection(db, 'families', familyId, 'notes'), {
        title: title.trim(),
        date: selectedDate,
        createdBy: user.uid,
        createdAt: new Date(),
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  }, [title, selectedDate, hasDate, navigation, user, familyId]);

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContent}>
          <Text style={styles.infoText}>Please log in to add notes.</Text>
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.header}>Add Calendar Note</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Note title"
              value={title}
              onChangeText={setTitle}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Date</Text>
            <TouchableOpacity
              style={styles.dateTimeField}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Select date"
            >
              <Text style={styles.dateTimeLabel}>Date</Text>
              <Text style={[styles.dateTimeValue, !formattedDate && styles.placeholder]}>
                {formattedDate || 'Select Date'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, (!title.trim() || !hasDate || saving) && styles.disabled]}
            onPress={handleSave}
            disabled={!title.trim() || !hasDate || saving}
            accessibilityRole="button"
            accessibilityLabel="Save note"
          >
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Note'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {Platform.OS === 'ios' ? (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Select Date</Text>
                <TouchableOpacity
                  onPress={() => {
                    handleDatePicked(null, selectedDate ?? new Date());
                  }}
                >
                  <Text style={[styles.modalButtonText, styles.modalDoneText]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={selectedDate ?? new Date()}
                mode="date"
                display="spinner"
                onChange={handleDatePicked}
              />
            </View>
          </View>
        </Modal>
      ) : (
        <>
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate ?? new Date()}
              mode="date"
              display="default"
              onChange={handleDatePicked}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl + spacing.xl,
    gap: spacing.lg,
  },
  header: {
    ...typography.title,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
    fontSize: typography.body.fontSize + 2,
    backgroundColor: colors.surface,
  },
  dateTimeField: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: spacing.xs,
  },
  dateTimeLabel: {
    fontSize: typography.small.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateTimeValue: {
    fontSize: typography.body.fontSize + 3,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  placeholder: {
    color: colors.textSecondary,
    fontWeight: '400',
  },
  footer: {
    padding: spacing.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadow,
  },
  saveText: {
    color: '#fff',
    fontSize: typography.body.fontSize + 2,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    width: '90%',
    maxWidth: 400,
    padding: spacing.lg,
    ...(Platform.OS === 'ios' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    }),
    ...(Platform.OS === 'android' && {
      elevation: 8,
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  modalButtonText: {
    fontSize: typography.body.fontSize + 1,
    color: colors.primary,
  },
  modalDoneText: {
    fontWeight: '600',
  },
});
