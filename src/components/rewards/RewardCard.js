import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { createThemedStyles, useAppTheme } from '../../theme';
import { ACCENT } from './rewardsTheme';
import PointsPill from './PointsPill';

export default function RewardCard({ reward, balance = 0, onRedeem, onEdit, loading = false, isManager = false }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const canAfford = balance >= reward.cost;

  return (
    <View style={[styles.card, !reward.active && styles.cardInactive]}>
      {isManager ? (
        <TouchableOpacity style={styles.editButton} onPress={() => onEdit?.(reward)} hitSlop={8}>
          <Ionicons name="create-outline" size={16} color={theme.secondaryText} />
        </TouchableOpacity>
      ) : null}

      <View style={styles.iconCircle}>
        <Ionicons name={reward.icon || 'gift-outline'} size={26} color={ACCENT.streak} />
      </View>

      <Text style={styles.title} numberOfLines={2}>{reward.title}</Text>
      {reward.description ? (
        <Text style={styles.description} numberOfLines={2}>{reward.description}</Text>
      ) : null}

      <View style={styles.footer}>
        <PointsPill points={reward.cost} size="sm" />

        <AnimatedCard
          onPress={!canAfford || loading || !reward.active ? undefined : () => onRedeem?.(reward)}
          disabled={!canAfford || loading || !reward.active}
          accessibilityLabel={`Redeem ${reward.title} for ${reward.cost} points`}
        >
          <View style={[styles.redeemButton, (!canAfford || !reward.active) && styles.redeemButtonDisabled]}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.redeemText}>{reward.active ? 'Redeem' : 'Hidden'}</Text>
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
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: 6,
      ...shadow,
    },
    cardInactive: {
      opacity: 0.55,
    },
    editButton: {
      position: 'absolute',
      top: 10,
      right: 10,
      zIndex: 1,
      padding: 4,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ACCENT.streakBg,
      marginBottom: 4,
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    description: {
      fontSize: 12,
      color: theme.secondaryText,
      minHeight: 32,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    redeemButton: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: ACCENT.level,
      minWidth: 64,
      alignItems: 'center',
    },
    redeemButtonDisabled: {
      backgroundColor: theme.border,
    },
    redeemText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.secondaryText,
    },
  })
);
