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
  { top: -8, left: 20, w: 32, h: 32, r: '22deg' },
  { top: 22, left: 85, w: 18, h: 18, r: '-45deg' },
  { top: 5, left: 155, w: 26, h: 44, r: '15deg' },
  { top: 48, left: 230, w: 34, h: 14, r: '-30deg' },
  { top: 12, left: 295, w: 20, h: 20, r: '50deg' },
  { top: 72, left: 50, w: 14, h: 28, r: '38deg' },
  { top: 80, left: 180, w: 24, h: 24, r: '-18deg' },
  { top: 95, left: 320, w: 30, h: 12, r: '65deg' },
  { top: 115, left: 110, w: 20, h: 20, r: '8deg' },
  { top: 128, left: 260, w: 16, h: 32, r: '-42deg' },
  { top: 145, left: 10, w: 44, h: 12, r: '-25deg' },
  { top: 158, left: 200, w: 22, h: 22, r: '33deg' },
  { top: 168, left: 75, w: 28, h: 10, r: '-12deg' },
  { top: 162, left: 340, w: 16, h: 16, r: '48deg' },
];

export default function SignupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = useCallback(async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail) {
      setError('Please enter your name and email.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const pendingRequest = await sendHomeHubEmailLink({
        email: trimmedEmail,
        displayName: trimmedName,
        mode: 'signup',
      });
      navigation.navigate('EmailLinkSent', pendingRequest);
    } catch (nextError) {
      setError(getFirebaseErrorMessage(nextError, 'Unable to send your sign-up link right now.'));
    } finally {
      setLoading(false);
    }
  }, [email, name, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
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
          <Text style={styles.headerLabel}>Create Account</Text>
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
          <Text style={styles.title}>Join your family hub</Text>
          <Text style={styles.subtitle}>
            We'll email you a secure sign-in link and finish setting up your HomeHub account.
          </Text>

          <View style={styles.featureCard}>
            <Text style={styles.featureTitle}>What happens next</Text>
            <Text style={styles.featureBody}>1. Enter your details</Text>
            <Text style={styles.featureBody}>2. Open the secure email link</Text>
            <Text style={styles.featureBody}>3. Start your family setup</Text>
          </View>

          <View style={styles.fields}>
            <Input
              label="Full Name"
              placeholder="Your full name"
              autoComplete="name"
              returnKeyType="next"
              textContentType="name"
              value={name}
              onChangeText={setName}
            />
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
              onSubmitEditing={handleSignup}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={loading ? 'Sending link…' : 'Continue with Email'}
            onPress={handleSignup}
            loading={loading}
            disabled={loading}
            style={styles.btnOverride}
            textStyle={styles.btnText}
            accessibilityHint="Send a passwordless sign-up link to your email"
          />

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkHighlight}>Sign in</Text>
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
    color: '#6B7280',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 20,
  },
  featureCard: {
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  featureBody: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
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
