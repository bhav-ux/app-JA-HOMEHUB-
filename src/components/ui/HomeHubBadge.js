import { StyleSheet, Text, View } from 'react-native';
import { createThemedStyles, radius, spacing } from '../../theme';

const TONES = ['neutral', 'primary', 'success', 'warning', 'error'];

export default function HomeHubBadge({ label, tone = 'neutral', size = 'md', style, textStyle }) {
  const styles = useStyles();
  const resolvedTone = TONES.includes(tone) ? tone : 'neutral';

  return (
    <View style={[styles.base, styles[resolvedTone], size === 'sm' && styles.sm, style]}>
      <Text style={[styles.text, styles[`${resolvedTone}Text`], size === 'sm' && styles.smText, textStyle]}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = createThemedStyles(({ theme }) =>
  StyleSheet.create({
    base: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 4,
      borderRadius: radius.full,
    },
    sm: { paddingHorizontal: spacing.sm, paddingVertical: 2 },
    text: { fontSize: 12, fontWeight: '700' },
    smText: { fontSize: 10 },

    neutral: { backgroundColor: theme.inputBackground },
    neutralText: { color: theme.secondaryText },

    primary: { backgroundColor: theme.primaryLight },
    primaryText: { color: theme.primary },

    success: { backgroundColor: `${theme.success}22` },
    successText: { color: theme.success },

    warning: { backgroundColor: `${theme.warning}22` },
    warningText: { color: theme.warning },

    error: { backgroundColor: `${theme.error}1F` },
    errorText: { color: theme.error },
  })
);
