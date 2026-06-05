import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
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
import { spacing } from '../src/theme';
import { showAlert } from '../utils/dialogs';
import { getFirebaseErrorMessage } from '../utils/firebaseError';
import {
  getPendingEmailLinkRequest,
  openEmailApp,
  resendPendingHomeHubEmailLink,
} from '../utils/emailLinkAuth';

const DARK = '#111111';
const SHAPE = '#1E1E1E';

const SHAPES = [
  { top: -8, left: 18, w: 28, h: 28, r: '14deg' },
  { top: 20, left: 92, w: 18, h: 18, r: '-28deg' },
  { top: 12, left: 170, w: 20, h: 36, r: '24deg' },
  { top: 54, left: 258, w: 30, h: 14, r: '-32deg' },
  { top: 24, left: 322, w: 18, h: 18, r: '45deg' },
  { top: 86, left: 42, w: 14, h: 26, r: '32deg' },
  { top: 100, left: 210, w: 24, h: 12, r: '-10deg' },
];

export default function EmailLinkSentScreen({ navigation, route }) {
  const [email, setEmail] = useState(route.params?.email || '');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let isMounted = true;

    if (route.params?.email) {
      setEmail(route.params.email);
      return () => {
        isMounted = false;
      };
    }

    getPendingEmailLinkRequest()
      .then((pendingRequest) => {
        if (isMounted && pendingRequest?.email) {
          setEmail(pendingRequest.email);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [route.params?.email]);

  const handleOpenEmail = useCallback(async () => {
    const opened = await openEmailApp();
    if (!opened) {
      showAlert(
        'Open email',
        'We could not open your email app automatically. Please open your inbox and tap the secure sign-in link.'
      );
    }
  }, []);

  const handleResend = useCallback(async () => {
    try {
      setLoading(true);
      setStatus('');
      const pendingRequest = await resendPendingHomeHubEmailLink();
      setEmail(pendingRequest.email);
      setStatus('A fresh sign-in link is on its way.');
    } catch (error) {
      showAlert('Unable to resend', getFirebaseErrorMessage(error, 'Please try again in a moment.'));
    } finally {
      setLoading(false);
    }
  }, []);

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
            <Ionicons name="mail-open-outline" size={44} color="#FFFFFF" />
          </View>
        </View>

        <ScrollView
          style={styles.sheet}
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We've sent a secure sign-in link to your email address.
          </Text>

          {email ? (
            <View style={styles.emailCard}>
              <Text style={styles.emailLabel}>Sent to</Text>
              <Text style={styles.emailValue}>{email}</Text>
            </View>
          ) : null}

          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>Next step</Text>
            <Text style={styles.tipBody}>Open the email on this device for the smoothest sign-in experience.</Text>
          </View>

          {status ? <Text style={styles.success}>{status}</Text> : null}

          <View style={styles.actions}>
            <Button
              label="Open Email App"
              onPress={handleOpenEmail}
              style={styles.primaryButton}
              textStyle={styles.primaryButtonText}
            />
            <Button
              label={loading ? 'Resending…' : 'Resend Link'}
              onPress={handleResend}
              loading={loading}
              disabled={loading}
              variant="secondary"
              style={styles.secondaryButton}
            />
            <TouchableOpacity
              style={styles.changeEmailRow}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Text style={styles.changeEmailText}>Change Email</Text>
            </TouchableOpacity>
          </View>
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
    width: 86,
    height: 86,
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
    lineHeight: 20,
  },
  emailCard: {
    marginTop: spacing.lg,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  emailLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#6B7280',
    marginBottom: 6,
  },
  emailValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  tipCard: {
    marginTop: spacing.md,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
    marginBottom: 6,
  },
  tipBody: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 19,
  },
  success: {
    marginTop: spacing.md,
    fontSize: 13,
    color: '#047857',
    textAlign: 'center',
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
  secondaryButton: {
    minHeight: 54,
    borderRadius: 14,
  },
  changeEmailRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  changeEmailText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
});
