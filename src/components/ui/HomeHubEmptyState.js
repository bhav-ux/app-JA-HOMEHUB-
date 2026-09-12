import { StyleSheet, Text, View } from 'react-native';
import { createThemedStyles, spacing } from '../../theme';
import Button from '../Button';

export default function HomeHubEmptyState({ emoji = '💬', title, body, actionLabel, onAction, style }) {
  const styles = useStyles();

  return (
    <View style={[styles.wrap, style]}>
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(({ theme }) =>
  StyleSheet.create({
    wrap: {
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
    },
    emoji: { fontSize: 44, marginBottom: spacing.md },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    body: {
      fontSize: 14,
      color: theme.secondaryText,
      textAlign: 'center',
      lineHeight: 21,
    },
    action: { marginTop: spacing.xl, alignSelf: 'stretch' },
  })
);
