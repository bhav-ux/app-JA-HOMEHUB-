import { useCallback, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import ActionButton from '../src/components/ActionButton';
import { colors, radius, shadow, spacing, typography } from '../src/theme';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = useCallback(async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await signInWithEmailAndPassword(auth, email.trim(), password);
      const uid = auth.currentUser?.uid;
      let target = 'MainTabs';
      let params;
      if (uid) {
        const snap = await getDoc(doc(db, 'users', uid));
        const familyId = snap.exists() ? snap.data()?.familyId : null;
        if (!familyId) {
          // Bug fix: new users were sent to MainTabs without a family setup.
          target = 'FamilySetup';
        } else {
          params = { familyId };
        }
      }
      const rootNavigator = navigation.getParent();
      if (rootNavigator) {
        rootNavigator.replace(target, params);
      } else {
        navigation.replace(target, params);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [email, password, navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.brand}>JA HOMEHUB</Text>
        <View style={styles.card}>
          <Text style={styles.title}>Log in</Text>
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
              placeholder="Enter your password"
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              returnKeyType="done"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <ActionButton
            label={loading ? 'Logging in…' : 'Continue'}
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            accessibilityHint="Log in and continue"
            style={styles.primaryButton}
          />
          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.linkText}>Need an account? Sign up</Text>
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
