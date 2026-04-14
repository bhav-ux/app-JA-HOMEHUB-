import { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { arrayUnion, collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { colors, radius, shadow, spacing, typography } from '../src/theme';

export default function FamilySetupScreen({ navigation }) {
  const [familyCode, setFamilyCode] = useState('');
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
        createdAt: new Date(),
        members: [user.uid],
      });
      await setDoc(
        doc(db, 'users', user.uid),
        {
          familyId,
          email: user.email || '',
        },
        { merge: true }
      );
      navigation.replace('MainTabs', { familyId });
    } catch (err) {
      setError(err.message || 'Failed to create family.');
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
      setError(err.message || 'Failed to join family.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContent}>
          <Text style={styles.infoText}>Please log in to continue.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Join or Create a Family</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Family Code</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter family code"
            value={familyCode}
            onChangeText={setFamilyCode}
            autoCapitalize="none"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.button, loading && styles.disabled]}
            onPress={handleJoinFamily}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Join Family</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, loading && styles.disabled]}
            onPress={handleCreateFamily}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Create New Family</Text>
          </TouchableOpacity>
        </View>
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
    padding: spacing.xl,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  title: {
    ...typography.title,
    textAlign: 'center',
    marginBottom: spacing.lg,
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
  label: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    ...shadow,
  },
  buttonText: {
    color: '#fff',
    fontSize: typography.body.fontSize + 1,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: typography.body.fontSize + 1,
    fontWeight: '700',
  },
  error: {
    color: colors.textSecondary,
    fontSize: typography.small.fontSize,
  },
  disabled: {
    opacity: 0.6,
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
