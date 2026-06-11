import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createThemedStyles } from '../../theme';
import { ACCENT } from './rewardsTheme';

export default function PointsPill({ points, size = 'md', prefix = '' }) {
  const styles = useStyles();
  const isSmall = size === 'sm';

  return (
    <View style={[styles.pill, isSmall && styles.pillSmall]}>
      <Ionicons name="sparkles" size={isSmall ? 11 : 13} color={ACCENT.points} />
      <Text style={[styles.label, isSmall && styles.labelSmall]}>
        {prefix}{Number(points || 0).toLocaleString()}
      </Text>
    </View>
  );
}

const useStyles = createThemedStyles(() =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: ACCENT.pointsBg,
      alignSelf: 'flex-start',
    },
    pillSmall: {
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: ACCENT.points,
    },
    labelSmall: {
      fontSize: 10,
    },
  })
);
