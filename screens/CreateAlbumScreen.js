import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDoc, collection } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { getFirebaseErrorMessage } from '../utils/firebaseError';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';

export default function CreateAlbumScreen({ navigation, route, familyId: familyIdProp }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [albumName, setAlbumName] = useState('');
  const [saving, setSaving] = useState(false);

  const user = auth.currentUser;
  const familyId = familyIdProp ?? route?.params?.familyId;

  const handleSave = useCallback(async () => {
    if (!familyId) {
      Alert.alert('Family not set', 'Join or create a family to add albums.');
      return;
    }
    if (!user) {
      Alert.alert('Not signed in', 'You need to be signed in to create albums.');
      return;
    }
    if (!albumName.trim()) {
      Alert.alert('Missing info', 'Please enter an album name.');
      return;
    }

    try {
      setSaving(true);
      await addDoc(collection(db, 'families', familyId, 'albums'), {
        name: albumName.trim(),
        createdBy: user.uid,
        createdAt: new Date(),
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', getFirebaseErrorMessage(error, 'Unable to create album right now.'));
    } finally {
      setSaving(false);
    }
  }, [albumName, familyId, navigation, user]);

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.centerContent}>
          <Text style={styles.infoText}>Please log in to create albums.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.container, { paddingBottom: spacing.lg }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.header}>Create Album</Text>
          <Input
            label="Album Name"
            placeholder="Enter album name"
            value={albumName}
            onChangeText={setAlbumName}
            autoFocus
          />
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
          <Button label={saving ? 'Saving...' : 'Save'} onPress={handleSave} loading={saving} disabled={!albumName.trim() || saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ theme }) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxl,
      gap: spacing.lg,
    },
    header: {
      ...typography.title,
      textAlign: 'center',
      color: theme.text,
    },
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
  })
);
