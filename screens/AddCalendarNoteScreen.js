import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
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
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';

export default function AddCalendarNoteScreen({ navigation }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
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

  const hasDate = selectedDate !== null;

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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.header}>Add Calendar Note</Text>
          <Input label="Title" placeholder="Note title" value={title} onChangeText={setTitle} />
          <View style={styles.field}>
            <Text style={styles.label}>Date</Text>
            <TouchableOpacity style={styles.dateTimeField} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
              <Text style={styles.dateTimeLabel}>Select date</Text>
              <Text style={[styles.dateTimeValue, !formattedDate && styles.placeholder]}>
                {formattedDate || 'Select Date'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Button label={saving ? 'Saving Note...' : 'Save Note'} onPress={handleSave} loading={saving} disabled={!title.trim() || !hasDate || saving} />
        </View>
      </KeyboardAvoidingView>

      {Platform.OS === 'ios' ? (
        <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Select Date</Text>
                <TouchableOpacity onPress={() => handleDatePicked(null, selectedDate ?? new Date())}>
                  <Text style={styles.modalButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker value={selectedDate ?? new Date()} mode="date" display="spinner" onChange={handleDatePicked} />
            </View>
          </View>
        </Modal>
      ) : showDatePicker ? (
        <DateTimePicker value={selectedDate ?? new Date()} mode="date" display="default" onChange={handleDatePicked} />
      ) : null}
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxl,
      gap: spacing.lg,
    },
    header: { ...typography.title, textAlign: 'center', color: theme.text },
    field: { gap: spacing.sm },
    label: { fontSize: typography.body.fontSize, color: theme.secondaryText },
    dateTimeField: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      backgroundColor: theme.inputBackground,
    },
    dateTimeLabel: {
      fontSize: typography.small.fontSize,
      color: theme.secondaryText,
      marginBottom: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    dateTimeValue: { fontSize: typography.body.fontSize + 3, color: theme.text, fontWeight: '500' },
    placeholder: { color: theme.secondaryText, fontWeight: '400' },
    footer: {
      padding: spacing.lg,
      borderTopWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
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
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      width: '90%',
      maxWidth: 400,
      padding: spacing.lg,
      ...shadow,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: { ...typography.heading, color: theme.text },
    modalButtonText: { fontSize: typography.body.fontSize + 1, color: theme.primary },
  })
);
