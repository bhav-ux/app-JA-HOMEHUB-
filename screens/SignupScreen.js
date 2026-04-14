import { useCallback, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import ActionButton from '../src/components/ActionButton';
import { colors, radius, shadow, spacing, typography } from '../src/theme';

export default function SignupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = useCallback(async () => {
    if (!name.trim() || !email || !password) {
      setError('Please enter your full name, email, and password.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = credential.user?.uid;

      await setDoc(doc(db, 'users', uid), {
        email: email.trim(),
        displayName: name.trim(),
        familyId: null,
        createdAt: new Date(),
      });

      const rootNavigator = navigation.getParent();
      if (rootNavigator) {
        rootNavigator.replace('FamilySetup');
      } else {
        navigation.replace('FamilySetup');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [email, password, name, navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.brand}>JA HOMEHUB</Text>
        <View style={styles.card}>
          <Text style={styles.title}>Create account</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your full name"
              value={name}
              onChangeText={setName}
              textContentType="name"
              autoComplete="name"
              returnKeyType="next"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              returnKeyType="next"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Create a password"
              secureTextEntry
              autoComplete="password"
              textContentType="newPassword"
              returnKeyType="done"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleSignup}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <ActionButton
            label={loading ? 'Creating account…' : 'Sign up'}
            onPress={handleSignup}
            loading={loading}
            disabled={loading}
            accessibilityHint="Create your account"
            style={styles.primaryButton}
          />
          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>Already have an account? Log in</Text>
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
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    justifyContent: 'center',
  },
  brand: {
    fontSize: typography.title.fontSize + 4,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
    color: colors.textPrimary,
  },
  title: {
    ...typography.heading,
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
  field: {
    marginBottom: spacing.md,
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
    paddingVertical: spacing.sm + spacing.xs,
    fontSize: typography.body.fontSize + 2,
    backgroundColor: colors.surface,
  },
  error: {
    color: colors.error,
    fontSize: typography.small.fontSize,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  linkRow: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  linkText: {
    color: colors.primary,
    fontSize: typography.body.fontSize + 1,
  },
  primaryButton: {
    marginTop: spacing.xs,
  },
});
