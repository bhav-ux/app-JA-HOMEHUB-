import { StyleSheet, View } from 'react-native';
import { createThemedStyles, radius, spacing } from '../../theme';

export default function HomeHubCard({ children, variant = 'flat', style, ...props }) {
  const styles = useStyles();

  return (
    <View
      style={[styles.base, variant === 'elevated' && styles.elevated, style]}
      {...props}
    >
      {children}
    </View>
  );
}

const useStyles = createThemedStyles(({ theme, shadow }) =>
  StyleSheet.create({
    base: {
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    elevated: {
      ...shadow,
    },
  })
);
