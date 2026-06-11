import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { createThemedStyles, useAppTheme } from '../../theme';
import { ACCENT } from './rewardsTheme';
import PointsPill from './PointsPill';
import { frequencyLabel } from '../../../services/rewardsService';

const VERIFICATION_META = {
  auto: { icon: 'flash-outline', label: 'Instant' },
  photo: { icon: 'camera-outline', label: 'Photo proof' },
  parent: { icon: 'people-outline', label: 'Needs approval' },
};

const STATUS_META = {
  pending: { icon: 'time-outline', label: 'Pending', color: ACCENT.points, bg: ACCENT.pointsBg },
  approved: { icon: 'checkmark-circle', label: 'Done', color: ACCENT.level, bg: ACCENT.levelBg },
  rejected: { icon: 'refresh-outline', label: 'Resubmit', color: ACCENT.streak, bg: ACCENT.streakBg },
};

export default function ChoreCard({ chore, submission, onPress, loading = false }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const verificationMeta = VERIFICATION_META[chore.verification] || VERIFICATION_META.parent;
  const status = submission?.status;
  const statusMeta = status ? STATUS_META[status] : null;
  const isLocked = status === 'pending' || status === 'approved';

  return (
    <AnimatedCard
      onPress={isLocked || loading ? undefined : onPress}
      disabled={isLocked || loading}
      accessibilityLabel={`${chore.title}, ${chore.points} points`}
      style={styles.cardWrap}
    >
      <View style={[styles.card, isLocked && styles.cardMuted]}>
        <View style={styles.iconCircle}>
          <Ionicons name={chore.icon || 'checkmark-circle-outline'} size={22} color={ACCENT.level} />
        </View>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>{chore.title}</Text>
          {chore.description ? (
            <Text style={styles.description} numberOfLines={1}>{chore.description}</Text>
          ) : null}
          <View style={styles.metaRow}>
            <PointsPill points={chore.points} size="sm" prefix="+" />
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={11} color={theme.secondaryText} />
              <Text style={styles.metaText}>{frequencyLabel(chore.frequency)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name={verificationMeta.icon} size={11} color={theme.secondaryText} />
              <Text style={styles.metaText}>{verificationMeta.label}</Text>
            </View>
          </View>
        </View>

        <View style={styles.action}>
          {loading ? (
            <ActivityIndicator size="small" color={ACCENT.level} />
          ) : statusMeta ? (
            <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
              <Ionicons name={statusMeta.icon} size={14} color={statusMeta.color} />
              <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </View>
          ) : (
            <View style={styles.submitButton}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </View>
          )}
        </View>
      </View>
    </AnimatedCard>
  );
}

const useStyles = createThemedStyles(({ theme, spacing, radius, shadow }) =>
  StyleSheet.create({
    cardWrap: {
      marginBottom: spacing.sm,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
      ...shadow,
    },
    cardMuted: {
      opacity: 0.7,
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ACCENT.levelBg,
    },
    body: {
      flex: 1,
      gap: 4,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    description: {
      fontSize: 12,
      color: theme.secondaryText,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 2,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    metaText: {
      fontSize: 11,
      color: theme.secondaryText,
    },
    action: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 40,
    },
    submitButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ACCENT.level,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '700',
    },
  })
);
