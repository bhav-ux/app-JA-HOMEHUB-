import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { arrayUnion, collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { getFirebaseErrorMessage } from '../utils/firebaseError';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import { createThemedStyles, spacing, typography } from '../src/theme';

export default function FamilySetupScreen({ navigation }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [familyCode, setFamilyCode] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const user = auth.currentUser;

  const handleCreateFamily = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const familyRef = doc(collection(db, 'families'));
      const familyId = familyRef.id;
      await setDoc(familyRef, {
        name:      familyName.trim() || 'My Family',
        ownerId:   user.uid,
        adminIds:  [],
        members:   [user.uid],
        createdAt: new Date(),
      });
      await setDoc(
        doc(db, 'users', user.uid),
        { familyId, email: user.email || '' },
        { merge: true }
      );
      navigation.replace('MainTabs', { familyId });
    } catch (err) {
      setError(getFirebaseErrorMessage(err, 'Failed to create family.'));
    } finally {
      setLoading(false);
    }
  };

  const handleJoinFamily = async () => {
    if (!user) return;
    const code = familyCode.trim();
    if (!code) {
      setError('Please enter a family code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const familyRef = doc(db, 'families', code);
      const snap = await getDoc(familyRef);
      if (!snap.exists()) {
        Alert.alert('Invalid code', 'Please check the family code and try again.');
        setLoading(false);
        return;
      }

      await updateDoc(familyRef, {
        members: arrayUnion(user.uid),
      });
      await setDoc(
        doc(db, 'users', user.uid),
        {
          familyId: code,
          email: user.email || '',
        },
        { merge: true }
      );
      navigation.replace('MainTabs', { familyId: code });
    } catch (err) {
      setError(getFirebaseErrorMessage(err, 'Failed to join family.'));
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.centerContent}>
          <Text style={styles.infoText}>Please log in to continue.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.safeArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: spacing.lg + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Set up your family</Text>
          <Text style={styles.subtitle}>Create a new family group, or join one with a code.</Text>
          <View style={styles.card}>
            <Input
              label="Family Code"
              placeholder="Enter family code to join"
              value={familyCode}
              onChangeText={setFamilyCode}
              autoCapitalize="none"
            />
            <Input
              label="Family Name (for new families)"
              placeholder="e.g. The Johnsons"
              value={familyName}
              onChangeText={setFamilyName}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Join Family" onPress={handleJoinFamily} loading={loading} disabled={loading} />
            <Button label="Create New Family" onPress={handleCreateFamily} disabled={loading} variant="secondary" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      flexGrow: 1,
      padding: spacing.lg,
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    title: {
      ...typography.display,
      fontSize: 26,
      textAlign: 'center',
      color: theme.text,
    },
    subtitle: {
      fontSize: typography.body.fontSize + 1,
      textAlign: 'center',
      color: theme.secondaryText,
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadow,
    },
    error: {
      color: theme.error,
      fontSize: typography.small.fontSize,
    },
    centerContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      backgroundColor: theme.background,
    },
    infoText: {
      fontSize: typography.body.fontSize + 1,
      color: theme.secondaryText,
      textAlign: 'center',
    },
  })
);
