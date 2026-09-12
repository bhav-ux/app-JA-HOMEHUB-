import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createThemedStyles, useAppTheme } from '../../theme';
import { hapticLight } from '../../../utils/haptics';

/**
 * Generic row for settings/family/chat-style lists: leading slot (avatar/icon),
 * title + subtitle, and a trailing slot (defaults to a chevron when `onPress` is set).
 */
export default function HomeHubListRow({
  leading,
  title,
  subtitle,
  trailing,
  meta,
  accent = false,
  onPress,
  style,
}) {
  const { theme } = useAppTheme();
  const styles = useStyles();

  const content = (
    <View style={[styles.row, accent && styles.rowAccent, style]}>
      {accent ? <View style={styles.accentBar} /> : null}
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={[styles.title, accent && styles.titleAccent]} numberOfLines={1}>
            {title}
          </Text>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing !== undefined
        ? trailing
        : onPress
        ? <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
        : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => {
        hapticLight();
        onPress();
      }}
    >
      {content}
    </TouchableOpacity>
  );
}

const useStyles = createThemedStyles(({ theme, spacing: s }) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.lg,
      paddingVertical: 14,
      gap: 14,
      backgroundColor: theme.card,
    },
    rowAccent: { backgroundColor: theme.primaryLight },
    accentBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor: theme.primary,
    },
    leading: { alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1, minWidth: 0 },
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    title: { fontSize: 16, fontWeight: '600', color: theme.text, flex: 1, marginRight: s.sm },
    titleAccent: { color: theme.primary },
    meta: { fontSize: 11, color: theme.secondaryText, fontWeight: '500' },
    subtitle: { fontSize: 13, color: theme.secondaryText, lineHeight: 18 },
  })
);
