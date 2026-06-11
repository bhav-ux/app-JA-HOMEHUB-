import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { createThemedStyles, useAppTheme } from '../../theme';
import { ACCENT } from './rewardsTheme';
import PointsPill from './PointsPill';
import { toJsDate } from '../../../utils/dateKeys';

const AVATAR_PALETTE = [
  '#7B93C8', '#D4896A', '#76A895', '#9E7DC4',
  '#6BA4C4', '#C4956A', '#89B488', '#B07AB0',
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name) {
  if (!name) return AVATAR_PALETTE[0];
  return AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length];
}

function formatSubmittedAt(value) {
  const date = toJsDate(value);
  if (!date) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

export default function SubmissionCard({ submission, member, onApprove, onReject, loading = false }) {
  const { theme } = useAppTheme();
  const styles = useStyles();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {member?.photoURL ? (
          <Image source={{ uri: member.photoURL }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: getAvatarColor(member?.name) }]}>
            <Text style={styles.avatarInitials}>{getInitials(member?.name)}</Text>
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.name} numberOfLines={1}>{member?.name || 'Member'}</Text>
          <Text style={styles.time}>{formatSubmittedAt(submission.submittedAt)}</Text>
        </View>
      </View>

      <View style={styles.choreRow}>
        <View style={styles.choreIconCircle}>
          <Ionicons name={submission.choreIcon || 'checkmark-circle-outline'} size={18} color={ACCENT.level} />
        </View>
        <Text style={styles.choreTitle} numberOfLines={1}>{submission.choreTitle}</Text>
        <PointsPill points={submission.points} size="sm" prefix="+" />
      </View>

      {submission.photoURL ? (
        <Image source={{ uri: submission.photoURL }} style={styles.photo} resizeMode="cover" />
      ) : null}

      <View style={styles.actions}>
        <AnimatedCard
          onPress={loading ? undefined : () => onReject?.(submission)}
          disabled={loading}
          style={styles.actionWrap}
          accessibilityLabel="Reject submission"
        >
          <View style={[styles.actionButton, styles.rejectButton]}>
            <Ionicons name="close" size={18} color={ACCENT.streak} />
            <Text style={[styles.actionText, { color: ACCENT.streak }]}>Reject</Text>
          </View>
        </AnimatedCard>
        <AnimatedCard
          onPress={loading ? undefined : () => onApprove?.(submission)}
          disabled={loading}
          style={styles.actionWrap}
          accessibilityLabel="Approve submission"
        >
          <View style={[styles.actionButton, styles.approveButton]}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Approve</Text>
              </>
            )}
          </View>
        </AnimatedCard>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(({ theme, spacing, radius, shadow }) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
      ...shadow,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    avatarPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    headerInfo: {
      flex: 1,
    },
    name: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.text,
    },
    time: {
      fontSize: 11,
      color: theme.secondaryText,
      marginTop: 1,
    },
    choreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    choreIconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ACCENT.levelBg,
    },
    choreTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    photo: {
      width: '100%',
      height: 160,
      borderRadius: radius.md,
      backgroundColor: theme.inputBackground,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: 2,
    },
    actionWrap: {
      flex: 1,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: radius.md,
    },
    rejectButton: {
      backgroundColor: ACCENT.streakBg,
    },
    approveButton: {
      backgroundColor: ACCENT.level,
    },
    actionText: {
      fontSize: 13,
      fontWeight: '700',
    },
  })
);
