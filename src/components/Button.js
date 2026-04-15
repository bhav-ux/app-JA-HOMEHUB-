import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { createThemedStyles, radius, spacing, typography, useAppTheme } from '../theme';

export default function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
}) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const isDisabled = disabled || loading;

  const variantStyles = {
    primary: {
      container: styles.primaryContainer,
      text: styles.primaryText,
      spinner: '#FFFFFF',
    },
    secondary: {
      container: styles.secondaryContainer,
      text: styles.secondaryText,
      spinner: theme.primary,
    },
    danger: {
      container: styles.dangerContainer,
      text: styles.primaryText,
      spinner: '#FFFFFF',
    },
  };

  const activeVariant = variantStyles[variant] || variantStyles.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        activeVariant.container,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={activeVariant.spinner} />
        ) : (
          <Text style={[styles.text, activeVariant.text, textStyle]}>{label}</Text>
        )}
      </View>
    </Pressable>
  );
}

const useStyles = createThemedStyles(({ theme, shadow }) =>
  StyleSheet.create({
    base: {
      minHeight: 48,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    text: {
      fontSize: typography.body.fontSize + 2,
      fontWeight: '700',
    },
    primaryContainer: {
      backgroundColor: theme.primary,
    },
    primaryText: {
      color: '#FFFFFF',
    },
    secondaryContainer: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.primary,
    },
    secondaryText: {
      color: theme.primary,
    },
    dangerContainer: {
      backgroundColor: theme.error,
    },
    pressed: {
      transform: [{ scale: 0.98 }],
      opacity: 0.92,
    },
    disabled: {
      opacity: 0.6,
    },
  })
);
