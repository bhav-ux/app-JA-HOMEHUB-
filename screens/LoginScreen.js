import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import { spacing } from '../src/theme';
import { getFirebaseErrorMessage } from '../utils/firebaseError';

const DARK = '#111111';
const SHAPE = '#1E1E1E';

const SHAPES = [
  { top: -10, left: 8, w: 38, h: 38, r: '18deg' },
  { top: 18, left: 68, w: 20, h: 20, r: '45deg' },
  { top: 50, left: 140, w: 30, h: 14, r: '-22deg' },
  { top: 8, left: 210, w: 18, h: 38, r: '30deg' },
  { top: 65, left: 255, w: 28, h: 28, r: '-40deg' },
  { top: 6, left: 310, w: 22, h: 22, r: '55deg' },
  { top: 85, left: 28, w: 16, h: 32, r: '35deg' },
  { top: 90, left: 185, w: 26, h: 12, r: '-15deg' },
  { top: 112, left: 95, w: 20, h: 20, r: '10deg' },
  { top: 118, left: 320, w: 32, h: 14, r: '60deg' },
  { top: 135, left: 55, w: 42, h: 14, r: '-28deg' },
  { top: 148, left: 268, w: 18, h: 18, r: '42deg' },
  { top: 160, left: 155, w: 24, h: 10, r: '-10deg' },
  { top: 155, left: 0, w: 14, h: 26, r: '20deg' },
];

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const {
    signInWithGoogle,
    googleLoading,
    googleError,
    setGoogleError,
    isGoogleConfigured,
  } = useGoogleSignIn();

  const handleSignIn = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
    } catch (nextError) {
      setError(getFirebaseErrorMessage(nextError, 'Unable to sign in. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [email, password]);

  const handleGoogleSignIn = useCallback(async () => {
    setError('');
    setGoogleError('');
    await signInWithGoogle();
  }, [setGoogleError, signInWithGoogle]);

  const authBusy = loading || googleLoading;
  const displayError = error || googleError;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <View style={styles.header}>
          {SHAPES.map((shape, index) => (
            <View
              key={index}
              style={[
                styles.shape,
                {
                  top: shape.top,
                  left: shape.left,
                  width: shape.w,
                  height: shape.h,
                  transform: [{ rotate: shape.r }],
                },
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
          <Text style={styles.title}>Login</Text>

          <TouchableOpacity
            style={[styles.googleBtn, authBusy && styles.googleBtnDisabled]}
            onPress={handleGoogleSignIn}
            activeOpacity={0.8}
            disabled={authBusy || !isGoogleConfigured}
          >
            {googleLoading ? (
              <ActivityIndicator color="#111827" />
            ) : (
              <Text style={styles.googleText}>Continue with Google</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.fields}>
            <Input
              label="Email"
              placeholder="name@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="next"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              label="Password"
              placeholder="Your password"
              secureTextEntry
              autoComplete="password"
              returnKeyType="done"
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleSignIn}
            />
          </View>

          {displayError ? <Text style={styles.error}>{displayError}</Text> : null}

          <Button
            label={loading ? 'Signing in…' : 'Sign In'}
            onPress={handleSignIn}
            loading={loading}
            disabled={authBusy}
            style={styles.btnOverride}
            textStyle={styles.btnText}
          />

          <TouchableOpacity
            style={styles.forgotRow}
            onPress={() => navigation.navigate('ForgotPassword')}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Signup')}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>
              New to HomeHub? <Text style={styles.linkHighlight}>Signup</Text>
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
    marginBottom: 24,
  },
  googleBtn: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
  },
  googleBtnDisabled: {
    opacity: 0.65,
  },
  googleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerLabel: {
    fontSize: 13,
    color: '#9CA3AF',
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
  forgotRow: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  forgotText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
  },
  linkRow: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  linkHighlight: {
    color: '#111111',
    fontWeight: '700',
  },
});
