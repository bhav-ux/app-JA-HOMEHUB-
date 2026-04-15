import { StyleSheet, Text, TextInput, View } from 'react-native';
import { createThemedStyles, radius, spacing, typography } from '../theme';

export default function Input({ label, style, inputStyle, ...props }) {
  const styles = useStyles();

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={styles.placeholder.color}
        style={[styles.input, inputStyle]}
        {...props}
      />
    </View>
  );
}

const useStyles = createThemedStyles(({ theme }) =>
  StyleSheet.create({
    wrapper: {
      gap: spacing.sm,
    },
    label: {
      fontSize: typography.body.fontSize,
      color: theme.secondaryText,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: typography.body.fontSize + 2,
      color: theme.text,
      backgroundColor: theme.inputBackground,
    },
    placeholder: {
      color: theme.secondaryText,
    },
  })
);
