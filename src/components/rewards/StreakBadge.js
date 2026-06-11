import { StyleSheet, Text, View } from 'react-native';
import { createThemedStyles } from '../../theme';
import { ACCENT } from './rewardsTheme';

export default function StreakBadge({ streak = 0, size = 'md' }) {
  const styles = useStyles();
  const isSmall = size === 'sm';
  const isActive = streak > 0;

  return (
    <View style={[styles.badge, isSmall && styles.badgeSmall, !isActive && styles.badgeInactive]}>
      <Text style={[styles.icon, isSmall && styles.iconSmall]}>🔥</Text>
      <Text style={[styles.label, isSmall && styles.labelSmall, !isActive && styles.labelInactive]}>
        {streak} {streak === 1 ? 'day' : 'days'}
      </Text>
    </View>
  );
}

const useStyles = createThemedStyles(({ theme }) =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: ACCENT.streakBg,
      alignSelf: 'flex-start',
    },
    badgeSmall: {
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    badgeInactive: {
      backgroundColor: theme.inputBackground,
    },
    icon: {
      fontSize: 14,
    },
    iconSmall: {
      fontSize: 11,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: ACCENT.streak,
    },
    labelSmall: {
      fontSize: 10,
    },
    labelInactive: {
      color: theme.secondaryText,
    },
  })
);
