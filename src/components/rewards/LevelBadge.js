import { StyleSheet, Text, View } from 'react-native';
import { createThemedStyles } from '../../theme';
import { ACCENT } from './rewardsTheme';

export default function LevelBadge({ level, icon, size = 'md' }) {
  const styles = useStyles();
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, isSmall && styles.badgeSmall]}>
      <Text style={[styles.icon, isSmall && styles.iconSmall]}>{icon}</Text>
      <Text style={[styles.label, isSmall && styles.labelSmall]}>Lv {level}</Text>
    </View>
  );
}

const useStyles = createThemedStyles(() =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: ACCENT.levelBg,
      alignSelf: 'flex-start',
    },
    badgeSmall: {
      paddingHorizontal: 7,
      paddingVertical: 3,
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
      color: ACCENT.level,
    },
    labelSmall: {
      fontSize: 10,
    },
  })
);
