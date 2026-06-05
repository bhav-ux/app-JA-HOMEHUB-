import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import { spacing } from '../src/theme';
import { getFirebaseErrorMessage } from '../utils/firebaseError';
import {
  completeHomeHubEmailLinkSignIn,
  ensureHomeHubUserDocument,
  getPendingEmailLinkRequest,
  getStoredEmailForEmailLink,
  getUserDocument,
  isEmailLinkSignInUrl,
  resendPendingHomeHubEmailLink,
  resolvePostAuthDestination,
} from '../utils/emailLinkAuth';

const DARK = '#111111';
const SHAPE = '#1E1E1E';

const SHAPES = [
  { top: -8, left: 24, w: 28, h: 28, r: '18deg' },
  { top: 18, left: 98, w: 18, h: 18, r: '-32deg' },
  { top: 4, left: 168, w: 24, h: 42, r: '20deg' },
  { top: 50, left: 248, w: 34, h: 14, r: '-28deg' },
  { top: 16, left: 320, w: 20, h: 20, r: '48deg' },
  { top: 88, left: 42, w: 14, h: 28, r: '30deg' },
  { top: 104, left: 196, w: 26, h: 12, r: '-12deg' },
];

const delay = (duration) => new Promise((resolve) => {
  setTimeout(resolve, duration);
});

const EMAIL_RETRY_ERROR_CODES = new Set([
  'auth/invalid-email',
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
  'auth/missing-email',
  'auth/user-not-found',
]);

async function getIncomingEmailLink(routeLink) {
  if (routeLink && isEmailLinkSignInUrl(routeLink)) {
    return routeLink;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const currentUrl = window.location.href;
    if (isEmailLinkSignInUrl(currentUrl)) {
      return currentUrl;
    }
  }

  const initialUrl = await Linking.getInitialURL();
  if (initialUrl && isEmailLinkSignInUrl(initialUrl)) {
    return initialUrl;
  }

  return '';
}

export default function EmailLinkAuthScreen({ navigation, route }) {
  const [phase, setPhase] = useState('loading');
  const [emailLink, setEmailLink] = useState(route.params?.emailLink || '');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [pendingRequest, setPendingRequest] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const processedLinkRef = useRef('');

  const navigateAfterAuth = useCallback(async (uid) => {
    const destination = await resolvePostAuthDestination(uid);
    const rootNavigator = navigation.getParent?.() || navigation;

    rootNavigator.reset({
      index: 0,
      routes: [{ name: destination.routeName, params: destination.params }],
    });
  }, [navigation]);

  const finalizeProfileAndContinue = useCallback(async (user, displayNameValue) => {
    const trimmedName = displayNameValue.trim();
    if (!trimmedName) {
      setError('Please enter your name to finish creating your account.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await ensureHomeHubUserDocument({
        uid: user.uid,
        email: user.email || email,
        displayName: trimmedName,
        photoURL: user.photoURL || null,
      });
      setSuccessMessage('Your HomeHub account is ready.');
      setPhase('success');
      await delay(650);
      await navigateAfterAuth(user.uid);
    } catch (nextError) {
      setError(getFirebaseErrorMessage(nextError, 'Unable to finish setting up your account.'));
      setPhase('confirmProfile');
    } finally {
      setSubmitting(false);
    }
  }, [email, navigateAfterAuth]);

  const attemptEmailLinkSignIn = useCallback(async (targetLink, targetEmail, pendingOverride = null) => {
    try {
      setSubmitting(true);
      setError('');
      setSuccessMessage('');
      setPhase('loading');

      const { credential, pendingRequest: storedRequest } = await completeHomeHubEmailLinkSignIn({
        emailLink: targetLink,
        email: targetEmail,
      });

      const nextPendingRequest = pendingOverride || storedRequest || null;
      const signedInUser = credential.user;
      const signedInEmail = signedInUser.email || targetEmail;

      setPendingRequest(nextPendingRequest);
      setActiveUser(signedInUser);
      setEmail(signedInEmail);

      const userDoc = await getUserDocument(signedInUser.uid);
      if (userDoc.exists()) {
        setSuccessMessage("You're signed in. Opening your family hub...");
        setPhase('success');
        await delay(650);
        await navigateAfterAuth(signedInUser.uid);
        return;
      }

      const resolvedName =
        nextPendingRequest?.displayName?.trim() ||
        signedInUser.displayName?.trim() ||
        '';

      if (resolvedName) {
        await ensureHomeHubUserDocument({
          uid: signedInUser.uid,
          email: signedInEmail,
          displayName: resolvedName,
          photoURL: signedInUser.photoURL || null,
        });
        setSuccessMessage("Welcome to HomeHub. Let's finish your onboarding.");
        setPhase('success');
        await delay(650);
        await navigateAfterAuth(signedInUser.uid);
        return;
      }

      setName('');
      setPhase('confirmProfile');
    } catch (nextError) {
      setError(getFirebaseErrorMessage(nextError, 'This sign-in link is invalid or has expired.'));
      setPhase(EMAIL_RETRY_ERROR_CODES.has(nextError?.code) ? 'confirmEmail' : 'error');
    } finally {
      setSubmitting(false);
    }
  }, [navigateAfterAuth]);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      const incomingLink = await getIncomingEmailLink(route.params?.emailLink);
      if (!isMounted) return;

      if (!incomingLink) {
        setError('This sign-in link is invalid or has expired.');
        setPhase('error');
        return;
      }

      if (processedLinkRef.current === incomingLink) {
        return;
      }

      processedLinkRef.current = incomingLink;
      setEmailLink(incomingLink);

      const nextPendingRequest = await getPendingEmailLinkRequest();
      const storedEmail = nextPendingRequest?.email || (await getStoredEmailForEmailLink());

      if (!isMounted) return;

      setPendingRequest(nextPendingRequest || null);
      setEmail(storedEmail || '');
      setName(nextPendingRequest?.displayName || '');

      if (storedEmail) {
        await attemptEmailLinkSignIn(incomingLink, storedEmail, nextPendingRequest);
        return;
      }

      setPhase('confirmEmail');
    };

    bootstrap().catch((nextError) => {
      if (!isMounted) return;
      setError(getFirebaseErrorMessage(nextError, 'Unable to open this sign-in link.'));
      setPhase('error');
    });

    return () => {
      isMounted = false;
    };
  }, [attemptEmailLinkSignIn, route.params?.emailLink]);

  const handleConfirmEmail = useCallback(async () => {
    if (!email.trim()) {
      setError('Please enter the email address you used to request this link.');
      return;
    }

    await attemptEmailLinkSignIn(emailLink, email, pendingRequest);
  }, [attemptEmailLinkSignIn, email, emailLink, pendingRequest]);

  const handleFinishProfile = useCallback(async () => {
    if (!activeUser) {
      setError('Please reopen your sign-in link and try again.');
      return;
    }

    await finalizeProfileAndContinue(activeUser, name);
  }, [activeUser, finalizeProfileAndContinue, name]);

  const handleResend = useCallback(async () => {
    try {
      setSubmitting(true);
      const resentRequest = await resendPendingHomeHubEmailLink();
      navigation.replace('EmailLinkSent', resentRequest);
    } catch (nextError) {
      setError(getFirebaseErrorMessage(nextError, 'Unable to resend a new sign-in link.'));
      setPhase('error');
    } finally {
      setSubmitting(false);
    }
  }, [navigation]);

  const renderBody = () => {
    if (phase === 'loading' || phase === 'success') {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#111111" />
          <Text style={styles.stateTitle}>
            {phase === 'success' ? 'Almost there' : 'Signing you in'}
          </Text>
          <Text style={styles.stateBody}>
            {successMessage || "We're securely verifying your email link."}
          </Text>
        </View>
      );
    }

    if (phase === 'confirmEmail') {
      return (
        <>
          <Text style={styles.title}>Confirm your email</Text>
          <Text style={styles.subtitle}>
            For security, enter the email address that received this sign-in link.
          </Text>
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
              onSubmitEditing={handleConfirmEmail}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label={submitting ? 'Verifying…' : 'Continue'}
            onPress={handleConfirmEmail}
            loading={submitting}
            disabled={submitting}
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
          />
        </>
      );
    }

    if (phase === 'confirmProfile') {
      return (
        <>
          <Text style={styles.title}>Finish your profile</Text>
          <Text style={styles.subtitle}>
            One quick step left before you continue with HomeHub onboarding.
          </Text>
          <View style={styles.fields}>
            <Input
              label="Full Name"
              placeholder="Your full name"
              autoComplete="name"
              returnKeyType="done"
              textContentType="name"
              value={name}
              onChangeText={setName}
              onSubmitEditing={handleFinishProfile}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label={submitting ? 'Saving…' : 'Continue to HomeHub'}
            onPress={handleFinishProfile}
            loading={submitting}
            disabled={submitting}
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
          />
        </>
      );
    }

    return (
      <>
        <Text style={styles.title}>This link needs attention</Text>
        <Text style={styles.subtitle}>
          {error || 'The secure sign-in link is invalid, expired, or already used.'}
        </Text>
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Try this</Text>
          <Text style={styles.tipBody}>Request a fresh link and open it from the same device whenever possible.</Text>
        </View>
        <View style={styles.actions}>
          <Button
            label={submitting ? 'Resending…' : 'Resend Link'}
            onPress={handleResend}
            loading={submitting}
            disabled={submitting}
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
          />
          <TouchableOpacity
            style={styles.changeRow}
            onPress={() => navigation.replace('Login')}
            activeOpacity={0.7}
          >
            <Text style={styles.changeText}>Change Email</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

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
          <View style={styles.iconShell}>
            <Ionicons name="sparkles-outline" size={42} color="#FFFFFF" />
          </View>
        </View>

        <ScrollView
          style={styles.sheet}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderBody()}
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
    height: 200,
    backgroundColor: DARK,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  shape: {
    position: 'absolute',
    backgroundColor: SHAPE,
    borderRadius: 5,
  },
  iconShell: {
    width: 82,
    height: 82,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    flexGrow: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  stateTitle: {
    marginTop: spacing.md,
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  stateBody: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
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
  tipCard: {
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  tipBody: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: '#111111',
    borderRadius: 14,
    minHeight: 54,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  changeRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  changeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
});
