import { useCallback, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { getFirebaseErrorMessage } from '../utils/firebaseError';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import { spacing } from '../src/theme';

const DARK = '#111111';
const SHAPE = '#1E1E1E';

const SHAPES = [
  { top: -8,  left: 20,  w: 32, h: 32, r: '22deg'  },
  { top: 22,  left: 85,  w: 18, h: 18, r: '-45deg' },
  { top: 5,   left: 155, w: 26, h: 44, r: '15deg'  },
  { top: 48,  left: 230, w: 34, h: 14, r: '-30deg' },
  { top: 12,  left: 295, w: 20, h: 20, r: '50deg'  },
  { top: 72,  left: 50,  w: 14, h: 28, r: '38deg'  },
  { top: 80,  left: 180, w: 24, h: 24, r: '-18deg' },
  { top: 95,  left: 320, w: 30, h: 12, r: '65deg'  },
  { top: 115, left: 110, w: 20, h: 20, r: '8deg'   },
  { top: 128, left: 260, w: 16, h: 32, r: '-42deg' },
  { top: 145, left: 10,  w: 44, h: 12, r: '-25deg' },
  { top: 158, left: 200, w: 22, h: 22, r: '33deg'  },
  { top: 168, left: 75,  w: 28, h: 10, r: '-12deg' },
  { top: 162, left: 340, w: 16, h: 16, r: '48deg'  },
];

export default function SignupScreen({ navigation }) {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSignup = useCallback(async () => {
    if (!name.trim() || !email || !password) {
      setError('Please fill in all fields.');
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
      (rootNavigator || navigation).replace('FamilySetup');
    } catch (e) {
      setError(getFirebaseErrorMessage(e, 'Unable to create your account right now.'));
    } finally {
      setLoading(false);
    }
  }, [email, password, name, navigation]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <View style={styles.header}>
          {SHAPES.map((s, i) => (
            <View
              key={i}
              style={[
                styles.shape,
                { top: s.top, left: s.left, width: s.w, height: s.h, transform: [{ rotate: s.r }] },
              ]}
            />
          ))}
          <Text style={styles.headerLabel}>Sign Up</Text>
          <View style={styles.logoBox}>
            <Image
              source={require('../assets/icon.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
        </View>

        <ScrollView
          style={styles.sheet}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join your family hub — takes 30 seconds.</Text>

          <View style={styles.fields}>
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
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={loading ? 'Creating account…' : 'Register'}
            onPress={handleSignup}
            loading={loading}
            disabled={loading}
            style={styles.btnOverride}
            textStyle={styles.btnText}
            accessibilityHint="Create your account"
          />

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>
              Already have an account?{'  '}
              <Text style={styles.linkHighlight}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: DARK,
  },
  kav: {
    flex: 1,
  },
  header: {
    height: 210,
    backgroundColor: DARK,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 12,
  },
  shape: {
    position: 'absolute',
    backgroundColor: SHAPE,
    borderRadius: 5,
  },
  headerLabel: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  logoBox: {
    width: 56,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  logoImg: {
    width: 38,
    height: 38,
  },
  sheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: 32,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F0F0F',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 6,
    marginBottom: 28,
  },
  fields: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  error: {
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  btnOverride: {
    backgroundColor: '#111111',
    borderRadius: 14,
    minHeight: 54,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  linkRow: {
    marginTop: 22,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  linkHighlight: {
    color: '#2563EB',
    fontWeight: '700',
  },
});
