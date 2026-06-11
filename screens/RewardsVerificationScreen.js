import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../firebaseConfig';
import SubmissionCard from '../src/components/rewards/SubmissionCard';
import { ACCENT } from '../src/components/rewards/rewardsTheme';
import { approveSubmission, rejectSubmission, subscribeSubmissions } from '../services/rewardsService';
import { useFamilyMemberProfiles } from '../hooks/useFamilyMemberProfiles';
import { useFamilyRole, isApproverRole } from '../hooks/useFamilyRole';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { showAlert, showConfirm } from '../utils/dialogs';
import { toJsDate } from '../utils/dateKeys';
import { createThemedStyles, spacing, useAppTheme } from '../src/theme';

export default function RewardsVerificationScreen({ navigation, route, familyId: familyIdProp }) {
  const { theme, isDark } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const familyId = familyIdProp ?? route?.params?.familyId;
  const uid = auth.currentUser?.uid;

  const role = useFamilyRole(familyId, uid);
  const canManage = isApproverRole(role);
  const members = useFamilyMemberProfiles(familyId);
  const membersById = useMemo(() => new Map(members.map((m) => [m.uid, m])), [members]);

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);

  useEffect(() => {
    if (!familyId) { setSubmissions([]); setLoading(false); return; }
    setLoading(true);
    return subscribeSubmissions(familyId, (data) => { setSubmissions(data); setLoading(false); }, () => setLoading(false));
  }, [familyId]);

  const pending = useMemo(() => {
    return submissions
      .filter((s) => s.status === 'pending')
      .sort((a, b) => (toJsDate(a.submittedAt)?.getTime() || 0) - (toJsDate(b.submittedAt)?.getTime() || 0));
  }, [submissions]);

  const handleApprove = async (submission) => {
    if (!familyId || !uid || actingId) return;
    hapticLight();
    setActingId(submission.id);
    try {
      await approveSubmission(familyId, submission, uid);
      hapticMedium();
    } catch (error) {
      console.error('[RewardsVerificationScreen] Failed to approve submission', error);
      showAlert('Error', error.message || 'Could not approve this submission. Please try again.');
    } finally {
      setActingId(null);
    }
  };

  const handleReject = (submission) => {
    if (!familyId || !uid || actingId) return;
    showConfirm(
      'Reject this chore?',
      `${membersById.get(submission.userId)?.name || 'This member'} can resubmit afterwards.`,
      {
        confirmText: 'Reject',
        onConfirm: async () => {
          hapticLight();
          setActingId(submission.id);
          try {
            await rejectSubmission(familyId, submission, uid);
            hapticMedium();
          } catch (error) {
            console.error('[RewardsVerificationScreen] Failed to reject submission', error);
            showAlert('Error', error.message || 'Could not reject this submission. Please try again.');
          } finally {
            setActingId(null);
          }
        },
      }
    );
  };

  const gradientColors = isDark
    ? [theme.background, '#1E2620']
    : ['#FBF6EC', '#F2F8EE'];

  return (
    <View style={styles.flex}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
      <View style={[styles.blob, styles.blobTop, { backgroundColor: ACCENT.points }]} />

      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('MainTabs');
            }}
            style={styles.headerBtn}
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>✅ Verification</Text>
            <Text style={styles.headerSubtitle}>Review and approve chores</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {!familyId ? (
          <View style={styles.centered}>
            <Ionicons name="checkmark-done-outline" size={40} color={theme.secondaryText} />
            <Text style={styles.emptyTitle}>No family yet</Text>
            <Text style={styles.emptySubtitle}>Join or create a family to review chores.</Text>
          </View>
        ) : !canManage ? (
          <View style={styles.centered}>
            <Ionicons name="lock-closed-outline" size={40} color={theme.secondaryText} />
            <Text style={styles.emptyTitle}>Parents only</Text>
            <Text style={styles.emptySubtitle}>Only family owners and admins can review submissions.</Text>
          </View>
        ) : loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={ACCENT.points} />
          </View>
        ) : pending.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyEmoji}>🎉</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>No chores are waiting for approval right now.</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg }]}
          >
            <View style={styles.list}>
              {pending.map((submission) => (
                <SubmissionCard
                  key={submission.id}
                  submission={submission}
                  member={membersById.get(submission.userId)}
                  loading={actingId === submission.id}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const useStyles = createThemedStyles(({ theme, shadow }) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    blob: {
      position: 'absolute',
      borderRadius: 9999,
      opacity: 0.08,
    },
    blobTop: {
      width: 320,
      height: 320,
      top: -120,
      right: -100,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerSpacer: {
      width: 40,
    },
    headerTextWrap: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.2,
    },
    headerSubtitle: {
      marginTop: 2,
      fontSize: 12,
      color: theme.secondaryText,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    emptyEmoji: {
      fontSize: 44,
      marginBottom: spacing.sm,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    emptySubtitle: {
      marginTop: 6,
      fontSize: 13,
      color: theme.secondaryText,
      textAlign: 'center',
      lineHeight: 19,
      maxWidth: 300,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
    },
    list: {
      gap: spacing.sm,
    },
  })
);
