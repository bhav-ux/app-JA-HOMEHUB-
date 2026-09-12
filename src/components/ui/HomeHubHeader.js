import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createThemedStyles, spacing, typography, useAppTheme } from '../../theme';

/**
 * Large page-title header for screens that don't rely on the native-stack header
 * (e.g. tab roots). Optional back button and a single right-side action.
 */
export default function HomeHubHeader({ title, subtitle, onBack, rightIcon, onRightPress, style }) {
  const { theme } = useAppTheme();
  const styles = useStyles();

  return (
    <View style={[styles.wrap, style]}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
      ) : null}

      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>

      {rightIcon ? (
        <TouchableOpacity
          onPress={onRightPress}
          style={styles.rightBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={rightIcon} size={20} color="#fff" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(({ theme }) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    backBtn: { padding: 4, marginLeft: -4 },
    titleWrap: { flex: 1 },
    title: { ...typography.display, fontSize: 26, color: theme.text },
    subtitle: { fontSize: 13, color: theme.secondaryText, marginTop: 2 },
    rightBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
);
