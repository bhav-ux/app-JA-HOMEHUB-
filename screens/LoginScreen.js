import { useCallback, useState } from 'react';
import {
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
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import { spacing } from '../src/theme';
import { getFirebaseErrorMessage } from '../utils/firebaseError';
import { sendHomeHubEmailLink } from '../utils/emailLinkAuth';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const pendingRequest = await sendHomeHubEmailLink({
        email: trimmedEmail,
        mode: 'login',
      });
      navigation.navigate('EmailLinkSent', pendingRequest);
    } catch (nextError) {
      setError(getFirebaseErrorMessage(nextError, 'Unable to send your sign-in link right now.'));
    } finally {
      setLoading(false);
    }
  }, [email, navigation]);

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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in with a secure email link and pick up right where your family left off.
          </Text>

          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeTitle}>Passwordless</Text>
              <Text style={styles.badgeBody}>No password to remember</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeTitle}>Secure</Text>
              <Text style={styles.badgeBody}>Verified from your inbox</Text>
            </View>
          </View>

          <View style={styles.fields}>
            <Input
              label="Email"
              placeholder="name@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="done"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={handleContinue}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={loading ? 'Sending link…' : 'Continue with Email'}
            onPress={handleContinue}
            loading={loading}
            disabled={loading}
            style={styles.btnOverride}
            textStyle={styles.btnText}
            accessibilityHint="Send a passwordless sign-in link to your email"
          />

          <TouchableOpacity
            style={styles.forgotRow}
            onPress={() => navigation.navigate('ForgotPassword')}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotText}>
              Need a password reset for an older account?
              <Text style={styles.forgotHighlight}> Forgot password</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Signup')}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>
              New to HomeHub? <Text style={styles.linkHighlight}>Create your account</Text>
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
    color: '#6B7280',
    marginTop: 6,
    marginBottom: 24,
    lineHeight: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  badge: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  badgeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  badgeBody: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
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
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  forgotHighlight: {
    color: '#2563EB',
    fontWeight: '700',
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
