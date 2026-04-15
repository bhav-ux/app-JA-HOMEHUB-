import { useCallback, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';

export default function LoginScreen({ navigation }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
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
    } catch (loginError) {
      setError(loginError.message);
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
          <Input
            label="Email"
            placeholder="name@example.com"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            returnKeyType="next"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="Password"
            placeholder="Enter your password"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            returnKeyType="done"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleLogin}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label={loading ? 'Logging in...' : 'Continue'}
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            accessibilityHint="Log in and continue"
          />
          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Signup')}>
            <Text style={[styles.linkText, { color: theme.primary }]}>Need an account? Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
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
      flex: 1,
      backgroundColor: theme.background,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
      justifyContent: 'center',
    },
    brand: {
      fontSize: typography.title.fontSize + 6,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: spacing.lg,
      color: theme.text,
    },
    title: {
      ...typography.heading,
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
    error: {
      color: theme.error,
      fontSize: typography.small.fontSize,
      textAlign: 'center',
    },
    linkRow: {
      marginTop: spacing.sm,
      alignItems: 'center',
    },
    linkText: {
      fontSize: typography.body.fontSize + 1,
    },
  })
);
