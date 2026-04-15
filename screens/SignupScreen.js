import { useCallback, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';

export default function SignupScreen({ navigation }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
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
    } catch (signupError) {
      setError(signupError.message);
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
          <Input
            label="Full Name"
            placeholder="Your full name"
            value={name}
            onChangeText={setName}
            textContentType="name"
            autoComplete="name"
            returnKeyType="next"
          />
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
            placeholder="Create a password"
            secureTextEntry
            autoComplete="password"
            textContentType="newPassword"
            returnKeyType="done"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleSignup}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label={loading ? 'Creating account...' : 'Sign up'}
            onPress={handleSignup}
            loading={loading}
            disabled={loading}
            accessibilityHint="Create your account"
          />
          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.goBack()}>
            <Text style={[styles.linkText, { color: theme.primary }]}>Already have an account? Log in</Text>
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
