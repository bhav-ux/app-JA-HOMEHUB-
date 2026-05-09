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
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { getFirebaseErrorMessage } from '../utils/firebaseError';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import { spacing } from '../src/theme';

const DARK = '#111111';
const SHAPE = '#1E1E1E';

const SHAPES = [
  { top: -10, left: 8,   w: 38, h: 38, r: '18deg'  },
  { top: 18,  left: 68,  w: 20, h: 20, r: '45deg'  },
  { top: 50,  left: 140, w: 30, h: 14, r: '-22deg' },
  { top: 8,   left: 210, w: 18, h: 38, r: '30deg'  },
  { top: 65,  left: 255, w: 28, h: 28, r: '-40deg' },
  { top: 6,   left: 310, w: 22, h: 22, r: '55deg'  },
  { top: 85,  left: 28,  w: 16, h: 32, r: '35deg'  },
  { top: 90,  left: 185, w: 26, h: 12, r: '-15deg' },
  { top: 112, left: 95,  w: 20, h: 20, r: '10deg'  },
  { top: 118, left: 320, w: 32, h: 14, r: '60deg'  },
  { top: 135, left: 55,  w: 42, h: 14, r: '-28deg' },
  { top: 148, left: 268, w: 18, h: 18, r: '42deg'  },
  { top: 160, left: 155, w: 24, h: 10, r: '-10deg' },
  { top: 155, left: 0,   w: 14, h: 26, r: '20deg'  },
];

export default function LoginScreen({ navigation }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

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
        if (!familyId) target = 'FamilySetup';
        else params = { familyId };
      }
      const rootNavigator = navigation.getParent();
      (rootNavigator || navigation).replace(target, params);
    } catch (e) {
      setError(getFirebaseErrorMessage(e, 'Unable to log in right now.'));
    } finally {
      setLoading(false);
    }
  }, [email, password, navigation]);

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
          <View style={styles.logoBox}>
            <Image
              source={require('../assets/icon.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.appName}>JA HOMEHUB</Text>
        </View>

        <ScrollView
          style={styles.sheet}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Log in</Text>
          <Text style={styles.subtitle}>Welcome back — sign in to continue.</Text>

          <View style={styles.fields}>
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
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={loading ? 'Logging in…' : 'Continue'}
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.btnOverride}
            textStyle={styles.btnText}
            accessibilityHint="Log in and continue"
          />

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Signup')}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>
              Don't have an account?{'  '}
              <Text style={styles.linkHighlight}>Sign up</Text>
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
    height: 230,
    backgroundColor: DARK,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 10,
  },
  shape: {
    position: 'absolute',
    backgroundColor: SHAPE,
    borderRadius: 5,
  },
  logoBox: {
    width: 76,
    height: 76,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  logoImg: {
    width: 50,
    height: 50,
  },
  appName: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
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
    fontSize: 30,
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
